/**
 * Opening a search result the way a user would get there, so the screens behave as usual (a detail blade refreshes its
 * list after a save, unsaved changes are asked about). Vue screens go through vc-shell's blade stack; AngularJS screens
 * through the embedded AngularJS admin's own blade navigation (the LegacyHost frame, same origin).
 */
import type { BladeDescriptor } from "@vc-shell/framework";
import { useBladeStack } from "@vc-shell/framework";
import type { Router } from "vue-router";
import { legacyAdminBaseUrl } from "../legacyAdmin";

type BladeStack = ReturnType<typeof useBladeStack>;
type BladeOpenEvent = Omit<Parameters<BladeStack["openBlade"]>[0], "parentId">;

let router: Router | undefined;
let stack: BladeStack | undefined;

/** Bound once by the shell (from a component's setup, where the router and the blade stack are) */
export function configureSearchNavigation(options: { router: Router; bladeStack: BladeStack }) {
  router = options.router;
  stack = options.bladeStack;
}

function required<T>(value: T | undefined, what: string): T {
  if (!value) throw new Error(`[global-search] ${what} is not configured`);
  return value;
}

/** Resolves with test()'s value once it is truthy; rejects after timeoutMs */
export function waitFor<T>(
  test: () => T | null | undefined | false,
  timeoutMs = 5000,
  what = "the screen",
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    (function poll() {
      let value: T | null | undefined | false;
      try {
        value = test();
      } catch {
        value = undefined;
      }
      if (value) resolve(value);
      else if (Date.now() > deadline) reject(new Error(`[global-search] ${what} did not open`));
      else setTimeout(poll, 50);
    })();
  });
}

/** Goes to a route of the shell (a Vue screen, Home); resolves once the router has moved */
export async function goTo(to: Parameters<Router["push"]>[0]) {
  await required(router, "The router").push(to);
}

/**
 * Opens a Vue blade: goes to the workspace (skipped when it is open), then opens each blade of `blades` under the
 * previous one. A blade already open there with the same name and param (and no options asked) is reused, so a list
 * stays as it is; blades open over the last one (or over the workspace, with no `blades`) close, so it is on top.
 *
 *   openBlade({ route: "/security", workspace: "PlatformSecurity",
 *               blades: [{ name: "PlatformSecurityUsers" }, { name: "PlatformSecurityUserDetails", param: user.id }] })
 */
export async function openBlade(options: { route: string; workspace: string; blades?: BladeOpenEvent[] }) {
  const bladeStack = required(stack, "The blade stack");
  if (bladeStack.workspace.value?.name !== options.workspace) {
    await goTo(options.route);
    await waitFor(() => bladeStack.workspace.value?.name === options.workspace, 5000, options.workspace);
  }
  let parent = bladeStack.workspace.value as BladeDescriptor;
  for (const event of options.blades ?? []) {
    // a blade asked for with options (a keyword, a setting to point at) opens again so it gets them
    const open =
      !event.options &&
      bladeStack.blades.value.find(
        (b: BladeDescriptor) =>
          b.parentId === parent.id && b.name === event.name && (b.param ?? "") === (event.param ?? ""),
      );
    if (open) {
      parent = open;
      continue;
    }
    await bladeStack.openBlade({ ...event, parentId: parent.id });
    const opened = bladeStack.blades.value[bladeStack.blades.value.length - 1];
    // a guard kept the blades that were open (the user chose to keep unsaved changes): stop here
    if (!opened || opened.name !== event.name || opened.parentId !== parent.id) return;
    parent = opened;
  }
  // the last blade asked for (the workspace when there are none) ends on top: a list already open (Show all) closes the
  // detail open over it, as a phone shows only the top blade; unsaved changes there are asked about as usual
  await bladeStack.closeChildren(parent.id);
}

/* ---- AngularJS screens: the embedded admin in the LegacyHost frame ---- */

/** A blade of the AngularJS admin (bladeNavigationService) */
export interface LegacyBlade {
  id: string;
  controller?: string;
  parentBlade?: LegacyBlade;
  [key: string]: unknown;
}

interface Injector {
  get<T = any>(name: string): T;
}

export interface LegacyContext {
  /** The AngularJS injector of the embedded admin: injector.get("virtoCommerce.orderModule.knownOperations") */
  injector: Injector;
  /** The blade found by `parent`, if one was asked for */
  parent?: LegacyBlade;
  /** bladeNavigationService.showBlade, under `parent` unless another parent is given */
  showBlade: (blade: Record<string, unknown>, parent?: LegacyBlade) => void;
}

function legacyInjector(): Injector | undefined {
  const frame = document.querySelector<HTMLIFrameElement>("iframe.legacy-host");
  const win = frame?.contentWindow as (Window & { angular?: any }) | null | undefined;
  try {
    const injector = win?.angular?.element(win.document.body).injector?.() as Injector | undefined;
    // the admin is up once its blade navigation is (the injector exists a little earlier, while it bootstraps)
    return injector?.get("platformWebApp.bladeNavigationService") ? injector : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Opens an AngularJS screen: shows the embedded admin on the workspace `url` (an AngularJS state url, as in the menu:
 * /workspace/orders), waits for the blade `parent` (an id, or a predicate when blades share an id) to be there and,
 * with `parentReady`, to have that method (or pass that test), then calls open() inside AngularJS. The first open loads the AngularJS admin,
 * which takes a few seconds.
 *
 *   openLegacy({ url: "/workspace/customers", parent: "members", parentReady: "showDetailBlade",
 *                open: ({ parent }) => parent.showDetailBlade(member) })
 */
export async function openLegacy(options: {
  url: string;
  parent?: string | ((blade: LegacyBlade) => boolean);
  /** a method the parent blade must have, or a test of it: the list is ready for a blade under it */
  parentReady?: string | ((blade: LegacyBlade) => boolean);
  open: (context: LegacyContext) => void;
}) {
  const route = required(router, "The router").currentRoute.value;
  const routeChanges = route.name !== "Legacy" || route.query.url !== options.url;
  // LegacyHost moves the admin to the url when the route changes (and reloads the state when it is there already)
  await goTo({ name: "Legacy", query: { url: options.url } });
  // no AngularJS admin installed: LegacyHost says so, and there is no admin to wait for
  if ((await legacyAdminBaseUrl()) === null) return;
  const injector = await waitFor(legacyInjector, 30000, "The AngularJS admin");
  // the route named this url already, so nothing moved the admin: it may have gone elsewhere by itself (a link in a blade)
  const frameWindow = document.querySelector<HTMLIFrameElement>("iframe.legacy-host")?.contentWindow;
  if (!routeChanges && frameWindow && injector.get("$location").path() !== options.url) {
    frameWindow.location.hash = `#!${options.url}`;
  }
  const navigation = injector.get("platformWebApp.bladeNavigationService");
  const test = typeof options.parent === "function" ? options.parent : (b: LegacyBlade) => b.id === options.parent;
  // the admin is on the url with no state change under way (a blade found earlier could be one the change removes)
  const settled = () => injector.get("$location").path() === options.url && !injector.get("$state").transition;
  // a blade on screen: the admin keeps a state's blades between visits, so until the state shows its own again, the
  // list holds the previous visit's, whose scopes are gone
  const ready = (b: LegacyBlade) => {
    const check = options.parentReady;
    if (!check) return true;
    return typeof check === "function" ? check(b) : typeof b[check] === "function";
  };
  const live = (b: LegacyBlade) => {
    const scope = b.$scope as { $$destroyed?: boolean } | undefined;
    return !!scope && !scope.$$destroyed;
  };
  let parent: LegacyBlade | undefined;
  if (options.parent) {
    parent = await waitFor(
      () => settled() && (navigation.stateBlades() as LegacyBlade[]).find((b) => test(b) && live(b) && ready(b)),
      15000,
      typeof options.parent === "string" ? options.parent : options.url,
    );
  } else {
    await waitFor(settled, 15000, options.url);
  }
  // inside AngularJS's digest, as its own click handlers run
  injector.get("$rootScope").$evalAsync(() =>
    options.open({
      injector,
      parent,
      showBlade: (blade, under) => navigation.showBlade(blade, under ?? parent),
    }),
  );
}
