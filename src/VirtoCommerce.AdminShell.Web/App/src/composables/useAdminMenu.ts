import { useLatestRequest } from "@vc-shell/framework";
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { adminMenuApi, type EffectiveMenu, type MenuItem, type UserMenuPrefs } from "../api/adminMenu";

// one shared state for the whole app (menu + legacy frame read it)
const menu = ref<EffectiveMenu>({ sections: [], pinned: [], recent: [], hidden: [] });

// load() runs from several places at once; only the latest request may set the menu
const menuRequest = useLatestRequest();
let prefsQueue: Promise<void> = Promise.resolve();

const RECENT_SIZE = 5;

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

  /** Route for a menu item, or undefined if it has no target (a url opens in a tab of its own, see open) */
  function routeFor(item: MenuItem) {
    const target = item.target;
    switch (target?.type) {
      case "vue":
        return target.route ? { path: target.route } : undefined;
      case "legacy":
        return { name: "Legacy", query: { url: target.legacyUrl ?? "/workspace" } };
      case "app":
        // route: a page inside the app (News' lists)
        return { name: "EmbeddedApp", params: { appId: target.appId }, query: target.route ? { path: target.route } : {} };
      default:
        return undefined;
    }
  }

  function isActive(item: MenuItem) {
    const target = item.target;
    switch (target?.type) {
      case "vue":
        return !!target.route && (route.path === target.route || route.path.startsWith(target.route + "/"));
      case "legacy":
        return route.name === "Legacy" && route.query.url === target.legacyUrl;
      case "app":
        return (
          route.name === "EmbeddedApp" &&
          route.params.appId === target.appId &&
          (route.query.path ?? "") === (target.route ?? "")
        );
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
    return undefined;
  });
  /** "News · All", or the item's own title */
  const activeTitle = computed(() =>
    active.value?.child ? `${active.value.item.title} · ${active.value.child.title}` : (active.value?.item.title ?? ""),
  );

  async function open(item: MenuItem) {
    // a url is someone else's site (a vendor dashboard that refuses framing): it gets a tab of its own
    if (item.target?.type === "url") {
      if (item.target.url) window.open(item.target.url, "_blank", "noopener");
      recordUse(item);
      return;
    }
    const to = routeFor(item);
    if (!to) {
      return;
    }
    await router.push(to);
    recordUse(item);
  }

  // counts toward Recent; the list on screen keeps its order (stableRecent), so only a free slot needs the new ranking now
  function recordUse(item: MenuItem) {
    const hasFreeSlot = menu.value.recent.length < RECENT_SIZE;
    adminMenuApi
      .addRecent(item.id)
      .then(() => (hasFreeSlot ? load() : undefined))
      .catch(() => undefined);
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

  return { menu, load, open, isActive, active, activeTitle, togglePin, hide, restoreHidden, pinnedIds };
}
