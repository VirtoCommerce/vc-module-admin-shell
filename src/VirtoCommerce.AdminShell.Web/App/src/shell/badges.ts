import { useUser } from "@vc-shell/framework";
import { effectScope, ref, watch, type Ref } from "vue";
import type { EffectiveMenu } from "../api/adminMenu";
import { postJson } from "./dashboard/api";

/**
 * Counters on menu items (and their rail section): what waits for someone, counted with the item's own search API
 * (take 0, so only the total travels). Keyed by menu item id; an item that isn't in the user's menu isn't asked.
 * ponytail: the host knows these few; a module would register its own counter here once one needs it.
 */
const SOURCES: Record<string, { url: string; body: Record<string, unknown>; hint: string }> = {
  orders: { url: "/api/order/customerOrders/search", body: { statuses: ["New"] }, hint: "SHELL.BADGES.ORDERS" },
  returns: { url: "/api/return/search", body: { statuses: ["Requested"] }, hint: "SHELL.BADGES.RETURNS" },
  quotes: { url: "/api/quote/requests/search", body: { statuses: ["Processing"] }, hint: "SHELL.BADGES.QUOTES" },
  customerReviews: { url: "/api/customerReviews/search", body: { reviewStatus: ["New"] }, hint: "SHELL.BADGES.REVIEWS" },
  tasks: { url: "/api/task-management/search", body: { isActive: true }, hint: "SHELL.BADGES.TASKS" },
};

const POLL_MS = 60_000;

export const badgeCounts = ref<Record<string, number>>({});

export const badgeHint = (itemId: string) => SOURCES[itemId]?.hint;

let started = false;

/** Starts counting once for the app (the rail and the phone drawer share it) */
export function startBadges(menu: Ref<EffectiveMenu>) {
  if (started) return;
  started = true;
  const { isAuthenticated } = useUser();

  let lastRefresh = 0;
  async function refresh() {
    // signed out (the login page): no counting, and no counters left over for the next user
    if (!isAuthenticated.value) {
      badgeCounts.value = {};
      return;
    }
    if (document.hidden) return;
    lastRefresh = Date.now();
    const present = new Set(menu.value.sections.flatMap((s) => s.items.map((i) => i.id)));
    const counted = await Promise.all(
      Object.entries(SOURCES)
        .filter(([id]) => present.has(id))
        .map(([id, source]) =>
          postJson<{ totalCount?: number }>(source.url, { ...source.body, take: 0 }).then(
            (result) => [id, result.totalCount ?? 0] as const,
            // no counter rather than a wrong one
            () => undefined,
          ),
        ),
    );
    const next = Object.fromEntries(counted.filter((x) => !!x));
    // the same counts again leave the rail and panel as they are
    if (JSON.stringify(next) !== JSON.stringify(badgeCounts.value)) badgeCounts.value = next;
  }

  // the menu arrives after sign-in; then every minute while the tab is visible, and on coming back to it once
  // the counts are that old
  // in a detached scope, as the interval and the listener below live for the whole page: started from the layout, the
  // watcher would stop when the layout unmounts on sign-out, and the next user's counters would wait for the next tick
  effectScope(true).run(() => watch([() => menu.value.sections.length, isAuthenticated], refresh, { immediate: true }));
  setInterval(refresh, POLL_MS);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && Date.now() - lastRefresh >= POLL_MS) refresh();
  });
}
