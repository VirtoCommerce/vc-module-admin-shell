import { useLatestRequest, useUser } from "@vc-shell/framework";
import { computed, effectScope, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { adminMenuApi, type EffectiveMenu, type MenuItem, type MenuTarget, type UserMenuPrefs } from "../api/adminMenu";
import { loadServerTexts, localizeMenu, menuLocale } from "../shell/menuTitles";

const EVERYTHING_ALLOWED = { allowPin: true, allowHide: true, allowReorder: true };

// one shared state for the whole app (menu + legacy frame read it): the server's menu (English titles and keys) and
// the same menu in the user's language, which is what everything shows
const serverMenu = ref<EffectiveMenu>({
  sections: [],
  pinned: [],
  recent: [],
  hidden: [],
  personalization: EVERYTHING_ALLOWED,
});
const menu = ref<EffectiveMenu>({
  sections: [],
  pinned: [],
  recent: [],
  hidden: [],
  personalization: EVERYTHING_ALLOWED,
});

/** The workspace blades no menu entry opens (bladeDiscovery.ts); sent with each menu request, the server puts them in More */
const discovered = ref<MenuItem[]>([]);

// load() runs from several places at once; only the latest request may set the menu
const menuRequest = useLatestRequest();
let prefsQueue: Promise<void> = Promise.resolve();

const RECENT_SIZE = 5;

/** The Home section of the default menu (ModuleConstants.HomeSectionId) */
export const HOME_SECTION_ID = "dashboard";

/**
 * Recent as shown: the server ranks it by use, but on screen an item keeps its place for the whole session, so opening
 * a page never reshuffles the list under the cursor (the new ranking shows on the next load of the app). A newly ranked
 * item only fills a free slot; items the server no longer lists (pinned, hidden) leave.
 */
function stableRecent(shown: MenuItem[], ranked: MenuItem[]): MenuItem[] {
  const byId = new Map(ranked.map((x) => [x.id, x]));
  const kept = shown.flatMap((x) => byId.get(x.id) ?? []);
  const added = ranked.filter((x) => !kept.includes(x));
  return [...kept, ...added].slice(0, RECENT_SIZE);
}

function localize() {
  const locale = menuLocale();
  const { menu: shown, serverTextsNeeded } = localizeMenu(serverMenu.value, locale);
  menu.value = {
    ...shown,
    personalization: shown.personalization ?? EVERYTHING_ALLOWED,
    recent: stableRecent(menu.value.recent, shown.recent),
  };
  // a title key of the platform's server texts (an AngularJS screen's): they load once per language, then titles redo
  if (serverTextsNeeded) {
    loadServerTexts(locale)
      .then((loaded) => loaded && menuLocale() === locale && localize())
      .catch(() => undefined);
  }
}

// the titles follow a language switch without asking the server again
watch(
  () => menuLocale(),
  () => localize(),
);

const emptyMenu = (): EffectiveMenu => ({
  sections: [],
  pinned: [],
  recent: [],
  hidden: [],
  personalization: EVERYTHING_ALLOWED,
});

/** The signed-in user, read where the menu loads: an answer for someone who has signed out since is dropped */
let currentUserId: () => string | undefined = () => undefined;
let followingUser = false;

/**
 * The menu and Recent on screen belong to one user. Another user signing in in the same tab (after a sign-out, or
 * after an expired session) must not see them, not even while their own menu loads, and Recent must not keep the
 * previous user's pages in its places: both go as soon as the user changes, then the new user's menu loads.
 */
function followUser(load: () => Promise<void>) {
  if (followingUser) return;
  followingUser = true;
  const { user } = useUser();
  currentUserId = () => user.value?.id ?? undefined;
  // detached: the first component to use the menu may come and go, the shared menu stays
  effectScope(true).run(() =>
    watch(
      () => user.value?.id,
      (id, previous) => {
        if (id === previous) return;
        serverMenu.value = emptyMenu();
        menu.value = emptyMenu();
        prefsQueue = Promise.resolve();
        if (id) load();
      },
    ),
  );
}

export function useAdminMenu() {
  const router = useRouter();
  const route = useRoute();

  async function load() {
    const owner = currentUserId();
    const next = await menuRequest.latest(adminMenuApi.getMenu(discovered.value));
    // the user changed while it loaded: that menu is someone else's
    if (next && owner === currentUserId()) {
      serverMenu.value = next;
      localize();
    }
  }

  followUser(load);

  /** The workspace blades found once the plugins loaded: a new list loads the menu with them */
  function setDiscovered(items: MenuItem[]) {
    if (JSON.stringify(items) === JSON.stringify(discovered.value)) return;
    discovered.value = items;
    load();
  }

  /** "/modules?view=updates" -> the path and its query: a screen's views as menu items (Modules · Updates) */
  function splitRoute(address: string) {
    const [path, search = ""] = address.split("?");
    return { path, query: Object.fromEntries(new URLSearchParams(search)) };
  }

  /** Route for a menu item, or undefined if it has no target (a url opens in a tab of its own, see open) */
  function routeFor(item: MenuItem) {
    const target = item.target;
    switch (target?.type) {
      case "vue":
        return target.route ? splitRoute(target.route) : undefined;
      case "legacy":
        return { name: "Legacy", query: { url: target.legacyUrl ?? "/workspace" } };
      case "app":
        // route: a page inside the app (News' lists)
        return {
          name: "EmbeddedApp",
          params: { appId: target.appId },
          query: target.route ? { path: target.route } : {},
        };
      default:
        return undefined;
    }
  }

  /** the open screen is this app, on any of its pages */
  const onApp = (target: MenuTarget) => route.name === "EmbeddedApp" && String(route.params.appId) === target.appId;

  function isActive(item: MenuItem) {
    const target = item.target;
    switch (target?.type) {
      case "vue": {
        if (!target.route) return false;
        // a view of a screen (a query in its route) is open when the screen is and shows that view
        const { path, query } = splitRoute(target.route);
        const onPath = route.path === path || route.path.startsWith(path + "/");
        return onPath && Object.entries(query).every(([key, value]) => route.query[key] === value);
      }
      case "legacy":
        return route.name === "Legacy" && route.query.url === target.legacyUrl;
      case "app":
        return onApp(target) && (route.query.path ?? "") === (target.route ?? "");
      default:
        return false;
    }
  }

  /** The open screen's place in the menu (section, item and, for an app with its pages here, the page) */
  const active = computed(() => {
    for (const section of menu.value.sections) {
      for (const item of section.items) {
        // the page first: News opens on "All", which is News' own target too
        const child = item.children?.find(isActive);
        if (child || isActive(item)) return { section, item, child };
      }
    }
    // an app on a page this menu doesn't list (an old /app/tasks link, a task opened inside it) is still its item
    if (route.name !== "EmbeddedApp") return undefined;
    for (const section of menu.value.sections) {
      const item = section.items.find((x) => x.target?.type === "app" && onApp(x.target));
      if (item) return { section, item, child: undefined };
    }
    return undefined;
  });
  /** "News · All", or the item's own title */
  const activeTitle = computed(() =>
    active.value?.child ? `${active.value.item.title} · ${active.value.child.title}` : (active.value?.item.title ?? ""),
  );

  async function open(item: MenuItem) {
    // a url is someone else's site (a vendor dashboard that refuses framing): it gets a tab of its own, and as the
    // route doesn't change, the click is what counts toward Recent
    if (item.target?.type === "url") {
      if (item.target.url) window.open(item.target.url, "_blank", "noopener");
      recordUse(item.id);
      return;
    }
    const to = routeFor(item);
    if (to) await router.push(to);
  }

  // counts toward Recent; the list on screen keeps its order (stableRecent), so the new ranking is only worth loading
  // when the page can fill a free slot: it isn't shown yet, and not pinned (the server leaves pinned pages out)
  function recordUse(itemId: string) {
    const recent = menu.value.recent;
    const fillsSlot =
      recent.length < RECENT_SIZE && !pinnedIds.value.has(itemId) && !recent.some((x) => x.id === itemId);
    adminMenuApi
      .addRecent(itemId)
      .then(() => (fillsSlot ? load() : undefined))
      .catch(() => undefined);
  }

  /**
   * Recent counts the pages people use, however they get there: a menu click, a link in a widget, back and forward, a
   * deep link. Home's own pages have their place on Home. Called once, by the shell layout.
   */
  function trackUses() {
    watch(
      () => active.value?.child?.id ?? active.value?.item.id,
      (id) => {
        if (id && active.value?.section.id !== HOME_SECTION_ID) recordUse(id);
      },
    );
  }

  // one change at a time: each reads what the previous one saved, so a quick pin and hide keep both
  function updatePrefs(change: (prefs: UserMenuPrefs) => void) {
    const run = prefsQueue.then(async () => {
      const prefs = await adminMenuApi.getPrefs();
      prefs.pinned ??= [];
      prefs.hidden ??= [];
      prefs.order ??= {};
      change(prefs);
      await adminMenuApi.savePrefs(prefs);
      await load();
    });
    prefsQueue = run.catch(() => undefined);
    return run;
  }

  const pinnedIds = computed(() => new Set(menu.value.pinned.map((x) => x.id)));

  const togglePin = (item: MenuItem) =>
    updatePrefs((prefs) => {
      prefs.pinned = pinnedIds.value.has(item.id)
        ? prefs.pinned.filter((x) => x !== item.id)
        : [...prefs.pinned, item.id];
    });

  const hide = (item: MenuItem) =>
    updatePrefs((prefs) => {
      prefs.hidden.push(item.id);
    });

  const restoreHidden = () =>
    updatePrefs((prefs) => {
      prefs.hidden = [];
    });

  /** What the user may change (pin, hide, reorder): the SI's choice in Configuration › Menu › Personalization */
  const personalization = computed(() => menu.value.personalization ?? EVERYTHING_ALLOWED);

  return {
    menu,
    load,
    open,
    isActive,
    active,
    activeTitle,
    togglePin,
    hide,
    restoreHidden,
    pinnedIds,
    trackUses,
    setDiscovered,
    discovered,
    personalization,
  };
}
