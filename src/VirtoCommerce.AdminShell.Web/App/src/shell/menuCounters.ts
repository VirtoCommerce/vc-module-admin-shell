/**
 * Counters on menu items (and their rail section): what waits for someone, e.g. new orders. Each module registers the
 * counter of its own menu item from its plugin, through the app it is installed into (it can't import the host's code):
 * app.config.globalProperties.$menuCounters, or inject(MENU_COUNTERS_KEY). The shell asks the counters of the items in
 * the user's menu, once the menu arrives and then every minute while the tab is visible. See docs/menu-counters.md.
 */
import { useUser } from "@vc-shell/framework";
import { effectScope, ref, shallowRef, watch, type App, type Ref } from "vue";
import type { EffectiveMenu } from "../api/adminMenu";
import { request } from "../api/http";

export type Permission = string | string[];

export interface MenuCounterContext {
  /** Aborted when the counts are asked again before this answer came; pass it to fetch */
  signal: AbortSignal;
}

export interface MenuCounter {
  /** The menu item the count shows on: the item's id in the menu, or a sub-item's (Modules · Updates) */
  itemId: string;
  /** The tooltip: a translation key or text, given { count } ("{count} new orders") */
  hint: string;
  /** Asked only for users with it (an array means any of); the item's own permission is checked by the menu */
  permission?: Permission;
  /** The count. A failed or rejected count shows no counter rather than a wrong one */
  count: (context: MenuCounterContext) => Promise<number>;
  /**
   * "attention" (default): work waiting for someone, a badge, added to the rail section's sum. "total": how many there
   * are (Modules · Installed), a muted number, not added to the section
   */
  tone?: "attention" | "total";
}

export interface MenuCounters {
  /** Adds a counter, or replaces the one of the same item. Can be called at any time; the counts are asked again */
  register: (counter: MenuCounter) => void;
  unregister: (itemId: string) => void;
  /** The registered counters */
  getCounters: () => MenuCounter[];
  /** Asks the counts again now, e.g. after the plugin processed what it counts */
  refresh: () => void;
}

/** The injection key module plugins use: inject(MENU_COUNTERS_KEY) */
export const MENU_COUNTERS_KEY = "adminShell.menuCounters";

declare module "vue" {
  interface ComponentCustomProperties {
    $menuCounters: MenuCounters;
  }
}

const POLL_MS = 60_000;

const counters = shallowRef(new Map<string, MenuCounter>());

/** The latest count per menu item id; an item without one has no counter */
export const counterValues = ref<Record<string, number>>({});

export const counterHint = (itemId: string) => counters.value.get(itemId)?.hint;

/** A counter that is a plain total (muted, not in the section's sum) rather than work waiting */
export const isTotalCounter = (itemId: string) => counters.value.get(itemId)?.tone === "total";

/** The work waiting on these items: their counts, without the plain totals */
export const waitingOn = (itemIds: string[]) =>
  itemIds.reduce((sum, id) => sum + (isTotalCounter(id) ? 0 : (counterValues.value[id] ?? 0)), 0);

let refreshNow: () => void = () => undefined;

export const menuCounters: MenuCounters = {
  register(counter) {
    counters.value = new Map(counters.value).set(counter.itemId, counter);
  },
  unregister(itemId) {
    const next = new Map(counters.value);
    if (next.delete(itemId)) counters.value = next;
  },
  getCounters: () => [...counters.value.values()],
  refresh: () => refreshNow(),
};

/** Makes the registry available to module plugins and adds the shell's own counter; called once from main.ts */
export function installMenuCounters(app: App) {
  app.provide(MENU_COUNTERS_KEY, menuCounters);
  app.config.globalProperties.$menuCounters = menuCounters;

  // Tasks is the shell's own menu item (default-menu.json): the Task Management app runs embedded, without a plugin
  menuCounters.register({
    itemId: "tasks",
    hint: "SHELL.BADGES.TASKS",
    permission: "task:read",
    count: ({ signal }) =>
      request<{ totalCount?: number }>("POST", "/api/task-management/search", { isActive: true, take: 0 }, signal).then(
        (r) => r.totalCount ?? 0,
      ),
  });
}

let started = false;

/** Starts counting once for the app (the rail and the phone drawer share it) */
export function startMenuCounters(menu: Ref<EffectiveMenu>, hasPermission: (permission: Permission) => boolean) {
  if (started) return;
  started = true;
  const { isAuthenticated } = useUser();

  let lastRefresh = 0;
  let current: AbortController | undefined;
  async function refresh() {
    current?.abort();
    // signed out (the login page): no counting, and no counters left over for the next user
    if (!isAuthenticated.value) {
      counterValues.value = {};
      return;
    }
    if (document.hidden) return;
    lastRefresh = Date.now();
    const controller = (current = new AbortController());
    // the items and their sub-items (Modules · Updates)
    const present = new Set(menu.value.sections.flatMap((s) => s.items.flatMap((i) => [i.id, ...(i.children ?? []).map((c) => c.id)])));
    const counted = await Promise.all(
      menuCounters
        .getCounters()
        .filter((c) => present.has(c.itemId) && (!c.permission || hasPermission(c.permission)))
        .map((c) =>
          Promise.resolve()
            .then(() => c.count({ signal: controller.signal }))
            .then(
              (count) => [c.itemId, count] as const,
              // no counter rather than a wrong one
              () => undefined,
            ),
        ),
    );
    if (controller.signal.aborted) return;
    const next = Object.fromEntries(counted.filter((x) => !!x && Number.isFinite(x[1])) as [string, number][]);
    // the same counts again leave the rail and panel as they are
    if (JSON.stringify(next) !== JSON.stringify(counterValues.value)) counterValues.value = next;
  }
  refreshNow = refresh;

  // the menu arrives after sign-in, and plugins register their counters as they load; then every minute while the tab
  // is visible, and on coming back to it once the counts are that old
  // in a detached scope, as the interval and the listener below live for the whole page: started from the layout, the
  // watcher would stop when the layout unmounts on sign-out, and the next user's counters would wait for the next tick
  let registered: ReturnType<typeof setTimeout> | undefined;
  effectScope(true).run(() => {
    watch([() => menu.value.sections.length, isAuthenticated], refresh, { immediate: true });
    // plugins load one after another: one round for a burst of registrations
    watch(counters, () => {
      clearTimeout(registered);
      registered = setTimeout(refresh, 300);
    });
  });
  setInterval(refresh, POLL_MS);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && Date.now() - lastRefresh >= POLL_MS) refresh();
  });
}
