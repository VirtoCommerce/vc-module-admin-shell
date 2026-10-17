# Menu Counters — Developer Guide

## Overview

A menu item can show a **counter**: how many things wait for someone in that screen (new orders, returns requested, reviews to moderate). The rail section shows the sum of its items' counters, and on a phone the menu button shows the total. The tooltip says what is counted (*12 new orders*).

The shell doesn't know what a module counts. Each module registers the counter of its own menu item from its plugin with the shell's `menuCounters` registry, and the shell does the rest: it asks the counters of the items in the user's menu once the menu arrives, then every minute while the tab is visible, and again when the user comes back to the tab.

Source: `src/VirtoCommerce.AdminShell.Web/App/src/shell/menuCounters.ts` (the registry and the polling), `src/shell/ShellNav.vue` and `src/shell/ShellLayout.vue` (where counts show).

### Counters today

| Menu item | Module | Counts | Endpoint | Permission |
|---|---|---|---|---|
| `orders` | Orders | new orders (`statuses: ["New"]`) | `POST api/order/customerOrders/search` | `order:read` |
| `returns` | Return | returns requested (`statuses: ["Requested"]`) | `POST api/return/search` | `return:read` |
| `quotes` | Quote | quotes waiting for a proposal (`statuses: ["Processing"]`) | `POST api/quote/requests/search` | `quote:read` |
| `customerReviews` | Customer Reviews | reviews to moderate (`reviewStatus: ["New"]`) | `POST api/customerReviews/search` | `customerReviews:read` |
| `tasks` | (the shell) | open tasks (`isActive: true`) | `POST api/task-management/search` | `task:read` |

Each module's counter is in its plugin (branch `feat/VCST-6327-admin-shell`), in `src/<Module>.Web/vue/src/modules/menuCounter.ts`, registered from the plugin's `install(app)`. Tasks is registered by the shell itself: its menu item is the shell's (`default-menu.json`), as Task Management runs as an embedded app without a plugin.

## Quick start

```ts
// src/modules/menuCounter.ts
import type { App } from "vue";

/** The part of the shell's menu counter registry this module uses */
interface MenuCounters {
  register(counter: {
    itemId: string;
    hint: string;
    permission?: string | string[];
    count(context: { signal: AbortSignal }): Promise<number>;
  }): void;
}

export function registerOrdersCounter(app: App) {
  const counters = app.config.globalProperties.$menuCounters as MenuCounters | undefined;
  if (!counters) return; // a vc-shell host without menu counters
  counters.register({
    itemId: "orders",               // the id of the module's menu item (plugin.json contributions.menu)
    hint: "ORDERS.MENU.COUNTER",    // "{count} new orders"
    permission: "order:read",
    count: async ({ signal }) => {
      const response = await fetch("/api/order/customerOrders/search", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ statuses: ["New"], take: 0 }), // take 0: only the total travels
        signal,
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return ((await response.json()) as { totalCount?: number }).totalCount ?? 0;
    },
  });
}
```

```ts
// src/modules/index.ts
export default {
  install(app: App) {
    appModule.install(app);
    registerOrdersCounter(app);
  },
};
```

```json
// locales/en.json
{ "ORDERS": { "MENU": { "TITLE": "Orders", "COUNTER": "{count} new orders" } } }
```

A plugin can't import the host's code, so it reaches the registry through the app it is installed into: `app.config.globalProperties.$menuCounters`, or `inject("adminShell.menuCounters")` in a component.

## Counter reference

| Property | Type | Required | Description |
|---|---|---|---|
| `itemId` | string | yes | The menu item the count shows on. Registering the same `itemId` again replaces the counter. When a Vue item `replaces` an AngularJS one, use the new item's id. |
| `hint` | string | yes | The tooltip: a translation key (or text) given `{ count }`. Say what waits, not what the number is: *12 new orders*, *3 reviews to moderate*. |
| `permission` | string \| string[] | | The counter is asked only for users with it (an array means *any of*). Use the read permission of the endpoint; the item's own permission is already checked by the menu. |
| `count({ signal })` | function | yes | Returns a promise of the count. Pass `signal` to `fetch`: it is aborted when the counts are asked again before the answer came. A rejected promise or a non-number shows no counter, rather than a wrong one. |

### Registry — `$menuCounters`

| Method | Description |
|---|---|
| `register(counter)` | Adds or replaces the counter of `counter.itemId`. Can be called at any time; the counts are asked again shortly after. |
| `unregister(itemId)` | Removes a counter. |
| `getCounters()` | The registered counters. |
| `refresh()` | Asks every count again now, e.g. after the plugin processed what it counts (an order moved out of *New*), so the user doesn't wait for the next minute. |

## When counters are asked

- Once the user's menu has loaded, and shortly after plugins register (registrations in a burst cause one round).
- Every 60 seconds while the tab is visible; on coming back to the tab, if the counts are older than that.
- Only for items in the user's menu, and only with the counter's `permission`.
- Not on the sign-in page; signing out clears the counts.
- A count of 0 shows no counter.

## Guidelines

- Count what waits for an action in the screen the item opens, and filter the screen the same way when the user opens it (or say what the number means in `hint`).
- Ask for the total only: `take: 0`, no response groups. The counts are asked every minute for every user with the shell open.
- Use the module's search endpoint with the criteria its list uses, so the number matches what the user then sees.
- Call `refresh()` after an action that changes the count, rather than waiting for the next round.

## Testing

In the browser console of the Admin Shell:

```js
const counters = document.querySelector("#app").__vue_app__.config.globalProperties.$menuCounters;
counters.getCounters().map((c) => c.itemId); // is it registered?
counters.refresh();                           // ask now
```

Check: the counter shows on the item and adds to its rail section; its tooltip; a user without the permission sees no counter and makes no request; the count changes after the action that changes it (and `refresh()`); a phone-sized window (the menu button's total).
