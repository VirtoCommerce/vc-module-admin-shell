/**
 * Legacy discovery: the AngularJS admin's own main menu (platformWebApp.mainMenuService), read from the admin running in a
 * frame of the same origin. The menu editor lists the screens it finds, so a system integrator can add the ones the menu
 * doesn't have yet. The AngularJS admin is the module VirtoCommerce.AdminAngularJs, at the site root or /apps/platform/
 * (see legacyAdmin); without the module there are no screens to find.
 */

import { legacyAdminBaseUrl, legacyAdminSrc } from "./legacyAdmin";

/** A screen of the AngularJS admin's menu */
export interface LegacyScreen {
  /** the AngularJS menu path ("browse/catalog", "configuration/stores") */
  path: string;
  /** the AngularJS state ("workspace.catalog") */
  state: string;
  /** the state's url in the AngularJS admin ("/workspace/catalog"): the legacy menu target */
  legacyUrl: string;
  /** translation key of the title, from the platform's server texts ("catalog.main-menu-title") */
  titleKey: string;
  permission?: string;
  priority?: number;
  /** a Font Awesome icon ("fa fa-folder") */
  icon?: string;
}

interface AngularMenuItem {
  path?: string;
  title?: string;
  icon?: string;
  priority?: number;
  permission?: string;
  action?: () => void;
}

interface Injector {
  get<T = unknown>(name: string): T;
}

/** the persistent frame the shell shows AngularJS screens in, or a hidden one of our own for as long as it takes */
function frameOfAdmin(adminUrl: string): { frame: HTMLIFrameElement; own: boolean } {
  const existing = document.querySelector<HTMLIFrameElement>("iframe.legacy-host");
  if (existing) return { frame: existing, own: false };
  const frame = document.createElement("iframe");
  frame.src = adminUrl;
  frame.title = "AngularJS admin";
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  Object.assign(frame.style, {
    position: "fixed",
    width: "1px",
    height: "1px",
    left: "-10000px",
    top: "0",
    opacity: "0",
    border: "0",
  });
  document.body.appendChild(frame);
  return { frame, own: true };
}

function injectorOf(frame: HTMLIFrameElement): Injector | undefined {
  const win = frame.contentWindow as
    (Window & { angular?: { element(el: Element): { injector?: () => Injector } } }) | null;
  try {
    const injector = win?.angular?.element(win.document.body).injector?.();
    // the admin is up once its menu has been filled (modules add their items while it starts)
    const service = injector?.get<{ menuItems?: AngularMenuItem[] }>("platformWebApp.mainMenuService");
    return service?.menuItems?.length ? injector : undefined;
  } catch {
    return undefined;
  }
}

async function waitFor<T>(probe: () => T | undefined, timeoutMs: number): Promise<T> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const value = probe();
    if (value) return value;
    if (Date.now() > until) throw new Error("The AngularJS admin didn't start in time");
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

// the item's action opens a state: $state.go("workspace.catalog"), minified in the platform's bundle to t.go("…")
const STATE_OF_ACTION = /\.go\(\s*['"]([^'"]+)['"]/;
// the AngularJS admin's own home: the shell has its own Home
const HOME_STATE = "workspace";

/** The screens of the AngularJS admin's menu (items with a state to open; its groups like "browse" are left out) */
export async function discoverLegacyScreens(timeoutMs = 45000): Promise<LegacyScreen[]> {
  const base = await legacyAdminBaseUrl();
  // no AngularJS admin installed: no screens to find
  if (base === null) return [];
  const { frame, own } = frameOfAdmin(legacyAdminSrc(base));
  try {
    const injector = await waitFor(() => injectorOf(frame), timeoutMs);
    // the modules finish adding their items a moment after the first ones
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const service = injector.get<{ menuItems: AngularMenuItem[] }>("platformWebApp.mainMenuService");
    const $state = injector.get<{ href(state: string): string | null }>("$state");
    const screens: LegacyScreen[] = [];
    for (const item of service.menuItems ?? []) {
      const state = item.action ? STATE_OF_ACTION.exec(String(item.action))?.[1] : undefined;
      const href = state ? $state.href(state) : null;
      if (!state || state === HOME_STATE || !href || !item.path || !item.title) continue;
      screens.push({
        path: item.path,
        state,
        legacyUrl: href.replace(/^#!?/, ""),
        titleKey: item.title,
        permission: item.permission,
        priority: Number.isFinite(item.priority) ? item.priority : undefined,
        icon: item.icon,
      });
    }
    return screens;
  } finally {
    if (own) frame.remove();
  }
}
