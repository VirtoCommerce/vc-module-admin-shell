import { useLatestRequest } from "@vc-shell/framework";
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { adminMenuApi, type EffectiveMenu, type MenuItem, type MenuTarget, type UserMenuPrefs } from "../api/adminMenu";

// one shared state for the whole app (menu + legacy frame read it)
const menu = ref<EffectiveMenu>({ sections: [], pinned: [], recent: [], hidden: [] });

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

export function useAdminMenu() {
  const router = useRouter();
  const route = useRoute();

  async function load() {
    const next = await menuRequest.latest(adminMenuApi.getMenu());
    if (next) menu.value = { ...next, recent: stableRecent(menu.value.recent, next.recent) };
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
        return { name: "EmbeddedApp", params: { appId: target.appId }, query: target.route ? { path: target.route } : {} };
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
    const fillsSlot = recent.length < RECENT_SIZE && !pinnedIds.value.has(itemId) && !recent.some((x) => x.id === itemId);
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
      prefs.pinned = pinnedIds.value.has(item.id) ? prefs.pinned.filter((x) => x !== item.id) : [...prefs.pinned, item.id];
    });

  const hide = (item: MenuItem) =>
    updatePrefs((prefs) => {
      prefs.hidden.push(item.id);
    });

  const restoreHidden = () =>
    updatePrefs((prefs) => {
      prefs.hidden = [];
    });

  return { menu, load, open, isActive, active, activeTitle, togglePin, hide, restoreHidden, pinnedIds, trackUses };
}
