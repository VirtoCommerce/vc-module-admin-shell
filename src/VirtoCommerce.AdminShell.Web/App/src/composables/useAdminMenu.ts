import { useLatestRequest } from "@vc-shell/framework";
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { adminMenuApi, type EffectiveMenu, type MenuItem, type UserMenuPrefs } from "../api/adminMenu";

// one shared state for the whole app (menu + legacy frame read it)
const menu = ref<EffectiveMenu>({ sections: [], pinned: [], hidden: [] });

// load() runs from several places at once; only the latest request may set the menu
const menuRequest = useLatestRequest();
let prefsQueue: Promise<void> = Promise.resolve();

export function useAdminMenu() {
  const router = useRouter();
  const route = useRoute();

  async function load() {
    const next = await menuRequest.latest(adminMenuApi.getMenu());
    if (next) menu.value = next;
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
      return;
    }
    const to = routeFor(item);
    if (!to) {
      return;
    }
    await router.push(to);
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

  const hide = (item: MenuItem) => updatePrefs((prefs) => void prefs.hidden.push(item.id));

  const restoreHidden = () => updatePrefs((prefs) => void (prefs.hidden = []));

  return { menu, load, open, isActive, active, activeTitle, togglePin, hide, restoreHidden, pinnedIds };
}
