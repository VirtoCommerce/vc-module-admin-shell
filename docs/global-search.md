# Global Search in the Admin Shell — Developer Guide

## Overview

The search box in the Admin Shell header (**Ctrl+K** / **⌘K**) searches the platform and every installed module from one place. On phones the same search opens as a full-screen sheet, from the search button in the top bar or the box at the top of the menu drawer.

The design is the AngularJS admin's global search ([vc-platform `docs/developer-guide/global-search.md`](https://github.com/VirtoCommerce/vc-platform/blob/c3b6102df76ccda8aeef76020fbd1d91147d864b/docs/developer-guide/global-search.md)) carried over to the shell: the shell doesn't know what a module can find. Each module registers one or more **search providers** with the shell's `globalSearch` registry, and the box shows the results of all providers grouped by provider.

A provider can answer in two ways:

- **Sync (client-side):** filter data that is already in the browser (menu items, a cached list) and return the items immediately.
- **Async (API):** call the module's search endpoint and return a promise. The group shows *Searching…* until it answers, and *Search failed* (with *Retry*) if it fails or takes longer than 8 seconds; an answer that still comes while the search is on screen replaces *Search failed*. Other groups aren't held back.

Source: `src/VirtoCommerce.AdminShell.Web/App/src/shell/search/` — `globalSearch.ts` (the registry), `navigation.ts` (opening results), `providers/` (built-in providers), `useSearchBox.ts`, `SearchPanel.vue` and `SearchSheet.vue` (the UI), `ShellSearch.vue` (the header box).

### Built-in providers

The shell's own (order 10–50):

| Provider id | Group | Source | Permission | Aliases |
|---|---|---|---|---|
| `shell.menu` | Menu | the user's effective menu (client) | per menu item (the server leaves out what the user may not open) | `menu`, `page`, `pages` |
| `platform.apps` | Apps | apps-menu apps that aren't in the menu (client, loaded once) | per app | `app`, `apps` |
| `platform.settings` | Settings | global settings schema, loaded once (shared with the Settings screen) | `platform:setting:access` | `setting`, `settings` |
| `platform.security.users` | Users | `api/platform/security/users/search` | `platform:security:read` + `platform:security:access` | `user`, `users` |
| `platform.security.roles` | Roles | `api/platform/security/roles/search` | `platform:security:read` + `platform:security:access` | `role`, `roles` |

These are the only providers the shell registers. Every module registers its own from its Admin Shell plugin (order 100+), as each module registers its provider with `globalSearchService` in the AngularJS admin; the shell doesn't know what a module can find. A plugin is loaded only when its module is installed.

### Providers of the modules

| Module | Provider id | Endpoint | Permission | Aliases | Opens |
|---|---|---|---|---|---|
| Orders | `orders` | `POST api/order/customerOrders/search` (`responseGroup: WithPrices`) | `order:read` + `order:access` | `order`, `orders`; `match` puts an order number (`CO123…`) first | `OrdersDetails` over `OrdersList`; *Show all*: the list with the query |
| Customer | `customers` | `POST api/members/search` (`deepSearch`) | `customer:read` + `customer:access` | `customer`, `contact`, `organization` (+ plurals) | the member type's details blade over `CustomerMembersList`; *Show all*: the list with the query |
| Catalog | `catalog.products` | `POST api/catalog/listentries` (`objectTypes: CatalogProduct`) | `catalog:read` + `catalog:access` | `product`, `products`, `sku` | `CatalogProductDetails` over `CatalogList`; *Show all*: `CatalogBrowse` across all catalogs |
| Store | `stores` | `POST api/stores/search` (few stores: loaded once, filtered in the browser) | `store:read` + `store:access` | `store`, `stores` | `StoreDetails` over `StoresList` |

Each is in its module's Admin Shell plugin (branch `feat/VCST-6327-admin-shell`), in `src/<Module>.Web/vue/src/modules/search.ts`, registered from the plugin's `install(app)` in `index.ts`. They are good examples to copy.

## How a search runs

```
keystroke ──► 150 ms debounce ──► parse "alias: text" ──► usable providers (permission, isAvailable, minLength)
                                                        │
              sync providers ───────────────────────────┼──► group rendered immediately
              async providers ── wait provider.delay ───┴──► API call (context.signal) ──► group rendered on arrival
                                                                   │
              8 s without an answer, or an error ──────────────────┴──► group shows "Search failed" + Retry
                                                                             (a late answer to the current search still lands)

next keystroke ──► previous search cancelled: pending delays dropped, context.signal aborted, late answers ignored
```

- Groups keep a fixed position (provider `order`), so the list doesn't jump when a slow group arrives. A provider whose `match` fits the query moves to the top.
- The highlighted row stays on the same item while other groups arrive.
- A provider that finishes with no items is hidden; a pending or failed one keeps its place.
- With an empty box the dropdown lists the groups the user can search; picking one types its alias (`orders: `).

## Quick start

A module plugin (a Module Federation remote loaded by the shell) can't import the shell's code. It reaches the registry through the Vue app it is installed into:

```ts
// in the plugin's install(app)
const globalSearch = app.config.globalProperties.$globalSearch;
// or, in a component's setup: inject("adminShell.globalSearch")
```

Guard for hosts that have no global search (`if (globalSearch) …`), so the same plugin runs in other vc-shell apps.

### 1. Sync provider (client-side data)

```ts
let cache: Promise<Warehouse[]> | undefined; // a small list: load once, filter in the browser

globalSearch.registerProvider({
  id: "inventory.warehouses",
  title: "INVENTORY.SEARCH.GROUP_TITLE", // translation key
  icon: "lucide-warehouse",               // shown in the "Search in" list
  order: 140,
  permission: "inventory:read",
  aliases: ["warehouse", "warehouses"],
  search: async (query, context) => {
    cache ??= fetch("/api/inventory/fulfillmentcenters/search", { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } })
      .then((r) => r.json())
      .then((r) => r.results);
    const ranked = globalSearch.rankItems(await cache, query, (w) => [w.name, w.id, w.address?.city], context.take);
    return ranked.map((w) => ({
      id: w.id,
      title: w.name,
      description: w.address?.city,
      icon: "lucide-warehouse",
      // the plugin's own way to its detail blade (vc-shell navigation, as its list does)
      execute: () => openWarehouse(w.id),
    }));
  },
});
```

A provider that returns a plain array from memory (no promise) is fully synchronous.

### 2. Async provider (API search)

```ts
globalSearch.registerProvider({
  id: "orders",
  title: "ORDERS.SEARCH.GROUP_TITLE",
  icon: "lucide-receipt",
  order: 100,
  permission: "order:read",
  minLength: 2,          // don't call the API for one letter
  delay: 250,            // wait for a pause in typing before calling the API
  aliases: ["order", "orders"],
  match: /^CO\d{3,}/i,   // an order number: show Orders first
  search: async (query, context) => {
    const response = await fetch("/api/order/customerOrders/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword: query, take: context.take, sort: "createdDate:desc", responseGroup: "WithPrices" }),
      signal: context.signal, // aborted when the user types on
    });
    const data = await response.json();
    return {
      total: data.totalCount, // "Show all 245 in Orders"
      // the plugin's list, filtered by the query (the list takes a keyword the plugin asks it to show)
      showAll: () => globalSearch.openBlade({ route: "/orders", workspace: "OrdersList" }).then(() => (requestedKeyword.value = query)),
      items: data.results.map((order) => ({
        id: order.id,
        title: order.number,
        description: [order.customerName, order.storeName].filter(Boolean).join(" · "),
        badge: order.status,
        meta: new Intl.NumberFormat(undefined, { style: "currency", currency: order.currency }).format(order.total),
        icon: "lucide-receipt",
        // the order over the orders list, as the list opens it
        execute: () => globalSearch.openBlade({ route: "/orders", workspace: "OrdersList", blades: [{ name: "OrdersDetails", param: order.id }] }),
      })),
    };
  },
});
```

Register providers once, from the plugin's `install`, not from blade components.

## Provider reference

| Property | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Unique id. Registering the same id again replaces the provider. Prefix with the module name: `orders`, `catalog.products`. |
| `title` | string | yes | Group heading: a translation key or text. Its translation is also an alias. |
| `search(query, context)` | function | yes | Returns items, `{ items, total, showAll }`, or a promise of either. |
| `icon` | string | | A vc-shell icon (`lucide-*`) for the group in the "Search in" list, and the items' default icon. |
| `order` | number | | Group position, lower first. The shell uses 10–50; modules use 100 and up. |
| `permission` | string \| string[] | | The provider is skipped unless the user has it (an array means *any of*). |
| `isAvailable()` | function | | Extra check, e.g. a second permission or an installed module. Return `false` when there is nothing to find. |
| `minLength` | number | | Shortest query the provider answers. Default `1`; use `2`–`3` for API providers. |
| `delay` | number (ms) | | Extra wait after the 150 ms debounce before `search` is called. Use `200`–`300` for API providers. Default `0`. |
| `aliases` | string[] | | Typing `alias: text` searches only this provider (case-insensitive). The translated `title` works as an alias too. |
| `match` | RegExp \| function(query) | | When it matches the query, the group is shown first. Use it for recognisable formats: order numbers, SKUs, emails. |

### `context`

| Property | Description |
|---|---|
| `take` | Number of items to return: 8, or 20 when the user scoped the search with an alias. |
| `signal` | An `AbortSignal`, aborted when the search is superseded. Pass it to `fetch`. (The AngularJS admin passes a `cancel` promise for `$http`; this is its counterpart.) |
| `scoped` | `true` when the user typed this provider's alias, so the group is the only one shown. |

### Result

Return either an array of items, or:

```ts
{
  items: [...],         // the items to show (at most context.take are used)
  total: 245,           // optional: how many the server found
  showAll: () => {},    // optional: adds a "Show all 245 in {group}" row when total > items.length
}
```

### Item

| Property | Description |
|---|---|
| `id` | Stable id. |
| `title` | First line; the query words are highlighted. |
| `description` | Second line (customer · store, email · type, …); highlighted too. |
| `icon` | A vc-shell icon name (`lucide-user`, `fas fa-user`). |
| `iconUrl` | An image instead of the icon, e.g. a product thumbnail (the icon shows if it fails to load). |
| `badge` | A short status pill on the right (`New`, `Paid`). |
| `meta` | A short right-aligned value (`$120.50`, a date). |
| `permission` | The item is dropped unless the user has it. |
| `external` | Shows an external-link mark (for results that open a new tab). |
| `execute()` | Required. Runs on click or Enter; the search box closes first. A thrown error or rejected promise shows a notification. |

## Registry reference — `globalSearch`

| Method | Description |
|---|---|
| `registerProvider(provider)` | Adds or replaces a provider. Can be called at any time; the box and its "Search in" list follow. |
| `unregisterProvider(id)` | Removes a provider. |
| `getProviders()` | The registered providers, in order. |
| `usableProviders()` | The providers the current user can search, in order. |
| `isAvailable()` | `true` when at least one provider is usable for the current user. The search box is hidden otherwise. |
| `search(query, { onGroup, take, only })` | Runs a search. `onGroup(groups)` is called whenever a group changes; each group is `{ provider, title, status: 'pending' \| 'done' \| 'error', items, total, showAll }`. The promise resolves with the groups that found something; a group that timed out is reported again through `onGroup` if its answer still comes before `promise.cancel()`. `only`: provider ids to ask (the box's Retry). Useful in tests. |
| `rankItems(items, query, fields, take)` | Filters and orders client-side items: every query word must appear; whole-text prefix beats word prefix beats substring; earlier fields weigh more. `fields(item)` returns the searchable texts. Also useful to re-order API results. |
| `hasPermission(permission)` | `true` when the user has the permission (string, or array meaning *any of*). |
| `translate(keyOrText)` | The global i18n translation, falling back to the text. |
| `parseQuery(query)` | `{ text, scope }`: the query without an alias prefix, and the providers the alias selects (`null` for all). |
| `openBlade`, `openLegacy`, `goTo`, `waitFor` | Opening a result, below. |

### Opening a result

Open results the way a user would get there, so the screens behave as usual (a detail blade refreshes its list after a save, unsaved changes are asked about). The registry carries the shell's helpers for it (`src/shell/search/navigation.ts`), so a plugin can use them as `globalSearch.openLegacy(…)`, the counterpart of the AngularJS service's `openBlade`, `goToWorkspace` and `waitForBlade`:

| Helper | Description |
|---|---|
| `openBlade({ route, workspace, blades })` | A Vue screen: goes to the workspace `route` (skipped when the workspace blade `workspace` is open), then opens each of `blades` (`{ name, param?, options? }`) under the previous one. An open blade with the same name and param is reused; one asked for with `options` opens again so it gets them. Stops if the user keeps unsaved changes. |
| `openLegacy({ url, parent, parentReady, open })` | An AngularJS screen: shows the embedded admin on the state `url` (`/workspace/orders`, as in the menu), waits for the blade `parent` (an id, or a predicate when blades share an id) to be on screen and, with `parentReady`, to have that method or pass that test, then calls `open({ injector, parent, showBlade })` inside AngularJS. The first open loads the AngularJS admin, which takes a few seconds. |
| `goTo(route)` | Any shell route. |
| `waitFor(test, timeoutMs)` | Resolves with `test()`'s value once it is truthy. |

A plugin with Vue screens can as well open them with vc-shell's navigation, as its own lists do.

**AngularJS lists that set themselves up after they show.** The embedded admin keeps a screen's blades between visits, and some lists close their children while they initialise (the catalog list's search box does, once the catalogs are loaded). `openLegacy` waits for a blade that is on screen; for a list like the catalog's, give `parentReady` a test that holds once the list is set up.

## Permissions

- Set `permission` on the provider; the provider is skipped (no API call) without it. Use `isAvailable()` for a second requirement, e.g. the workspace's `:access` permission or an installed module.
- Set `permission` on items that need more than the provider (the registry drops them).
- The server must still enforce permissions on the endpoint; the client checks only decide what to show.
- When no provider is usable for a user, the search box (and the phone's search button) is hidden.

## Localization

- Add the group title key to the plugin's locale files, e.g. `ORDERS.SEARCH.GROUP_TITLE`.
- The translated title is also an alias, so `Bestellungen: CO123` works in German without extra configuration.
- The shell's texts (*Searching…*, *Search failed*, *Retry*, *Show all {count} in {group}*, hints) are under `SHELL.SEARCH.*`.

## Guidelines

- Keep `search` fast: return at most `context.take` items and request only the fields you show (response groups). Check what the response group returns: the orders search's `Default` leaves prices out, `WithPrices` has them.
- Always pass `context.signal` to `fetch` so superseded requests are aborted.
- Use `minLength` and `delay` for API providers; a client-side provider needs neither.
- Rank server results when the API doesn't: `rankItems` first, then the remaining results.
- Don't throw for "nothing found": return an empty array. Errors and timeouts show *Search failed* for your group only.
- Keep titles short; put secondary data in `description`, `badge` and `meta`.
- In `execute`, don't assume the screen is empty: the user may have blades open, possibly with unsaved changes.

## Testing a provider

In the browser console of the Admin Shell:

```js
const search = document.querySelector("#app").__vue_app__.config.globalProperties.$globalSearch;
search.getProviders().map((p) => p.id);                         // is it registered?
search.usableProviders().map((p) => p.id);                      // can this user search it?
search.search("CO123", { onGroup: (groups) => console.log(groups) }) // groups as they arrive
  .then((groups) => console.log("done", groups));
```

Check: results with and without the permission; `alias: text` scoping; a slow or failing endpoint (the group shows *Searching…*, then *Search failed* after 8 s, without blocking other groups, and *Retry* asks again); typing quickly (only the last request completes); light and dark themes; a phone-sized window (the search sheet).
