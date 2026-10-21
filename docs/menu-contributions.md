# Menu Contributions — Developer Guide

## Overview

The Admin Shell menu is composed on the server. A module adds its entries by listing them in its plugin's `plugin.json` under `contributions.menu`; the shell reads them when it builds the default menu, so they go through the same layers (global and role patches, user pins and order) and the same permission filter as every other item.

The default menu already places the screens of Virto Commerce modules, and opens each one's Vue route as soon as the module's plugin is installed (its AngularJS screen until then). A contribution is how a module adds a screen the default menu doesn't know, or replaces an item of another source. Everything recorded on an item's former ids (patches, pins, hidden items, *Recent*) follows it, so users keep their menu when a module moves to Vue.

Source: `src/VirtoCommerce.AdminShell.Data/Services/DefaultMenuBuilder.cs` (reading), `src/VirtoCommerce.AdminShell.Core/Services/MenuComposer.cs` (replacements), `src/VirtoCommerce.AdminShell.Core/Models/MenuModels.cs` (model), `src/VirtoCommerce.AdminShell.Web/Content/default-menu.json` (the default sections and items).

## Where menu items come from

| Source | Who edits it | Items |
|---|---|---|
| `Content/default-menu.json` (this module) | Admin Shell developers | Sections and groups; the screens of Virto Commerce modules (each with its plugin's Vue `route` and its AngularJS `target`, see [below](#screens-of-the-default-menu)), the platform's Vue screens (`platform.*`), known apps. An item whose `moduleId` isn't installed is dropped. |
| Installed apps | module developers (`module.manifest`) | Each app with `<placement>MainMenu</placement>` that the default menu doesn't place → *Apps* section. See [Embedded apps](embedded-apps.md). |
| `plugin.json` → `contributions.menu` | module developers | This guide. A contribution for a screen the default menu places (same id, one of its `aliases`, or the id it `replaces`) adds nothing: the default menu keeps the title, place and route. |
| Global and role patches | system integrators, customers | Add, rename, move, hide. See [Menu layers](menu-layers.md). |

> vc-shell's own `defineBlade({ menuItem })` doesn't place a blade in the Admin Shell's menu: declare entries in `plugin.json`. A workspace blade that no entry opens isn't lost, though: the shell finds it and lists it in *More* with its `menuItem` title and icon ([discovered blades](menu-layers.md#discovered-blades)).

## Quick start

```json
{
  "remote": { "name": "store_admin", "exposed": "./Module" },
  "contributions": {
    "menu": [
      {
        "id": "stores",
        "sectionId": "configuration",
        "title": "Stores",
        "icon": "lucide-store",
        "route": "/stores",
        "permission": "store:access",
        "priority": 100,
        "replaces": "legacy.stores"
      }
    ]
  }
}
```

`route` is the URL of a workspace blade of the plugin (`defineBlade({ url: "/stores", isWorkspace: true })`).

The contribution is read only when both `plugin.json` and `remoteEntry.js` are in `{module}/plugins/admin-shell/` (a declared but unbuilt plugin would only produce dead items). An invalid `plugin.json` is logged and its contributions are skipped.

## Item reference

| Field | Type | Description |
|---|---|---|
| `id` | string | Required. Unique across the menu. Prefix with the module or keep the short id the default menu's groups expect (see *Groups*). |
| `title` | string | Label, in English. |
| `titleKey` | string | Translation key of the label in the plugin's locales (`STORES.MENU.TITLE`); without one the shell looks for `MENU.ITEMS.<id>` in its menu file, then shows `title`. See [Localization](localization.md#menu). |
| `icon` | string | A vc-shell icon (`lucide-*`). |
| `iconUrl` | string | An image instead of the icon. |
| `sectionId` | string | The section (rail entry). A section the menu doesn't have, or none: *More*, after *Apps*, where a patch can move it. Ignored when the item replaces another: it takes that item's section. |
| `priority` | int | Order in the section, lower first; ties by title. The default menu's items are 100 apart (100, 200, 300… in each section), so `250` goes between the second and the third. Ignored when the item replaces another: it takes that item's priority. |
| `permission` | string | The item is hidden without it. Use the module's `:access` permission. |
| `route` | string | Shorthand for `target: { "type": "vue", "route": … }`. |
| `target` | object | What the item opens, when it isn't a Vue route of the plugin (below). |
| `replaces` | string | Id of the item this one supersedes, usually `legacy.<id>`. |
| `group` | string | Panel group title. Without it, the item joins the group of the item it replaces, or the group whose list names its id. |
| `children` | item[] | Sub-items, shown under the item in the panel. |
| `moduleId` | string | Defaults to the contributing module. |

### Targets

| `type` | Fields | Opens |
|---|---|---|
| `vue` | `route` | A Vue screen in the shell (`#/stores`). |
| `legacy` | `legacyUrl` | An AngularJS screen on that state (`/workspace/stores`), in the embedded classic admin. |
| `app` | `appId`, `route` | A platform app in an iframe (`/apps/{appId}/#{route}`). |
| `url` | `url` | A new browser tab (sites that refuse framing). |

### Sections of the default menu

| Section id | Title | Priority | Groups |
|---|---|---|---|
| `dashboard` | Home | 100 | |
| `catalog` | Products | 200 | |
| `orders` | Orders & Customers | 300 | Sales, Customers |
| `marketing` | Marketing & Content | 400 | Merchandising, Content, Engagement |
| `insights` | Insights | 500 | Analytics, Search |
| `configuration` | Configuration | 600 | Store, Platform, Catalog & Search, Security & Privacy, Data & Files, Monitoring & Tools |
| `apps` | Apps | 700 | |
| `more` | More | 800 | Only when it has items: contributions without a known section, [discovered blades](menu-layers.md#discovered-blades) |

Sections and items are 100 apart so a patch or a seed can put an entry between two (`650`: a section between Configuration and Apps).

### Groups

A section's `groups` list item ids (`{ "title": "Sales", "items": ["orders", "quotes", "subscriptions", "returns"] }`). A contribution whose id a group lists lands in that group without setting `group`. A replacing item takes the replaced item's group, and a group that lists an item's former id (one of its `aliases`) holds the item.

## Screens of the default menu

A Virto Commerce module's screen has one item in `default-menu.json`, named by the screen (`orders`, not `legacy.orders`), whatever UI the installed module version has:

```json
{
  "id": "orders", "title": "Orders", "icon": "lucide-file-text", "priority": 100,
  "moduleId": "VirtoCommerce.Orders", "permission": "order:access",
  "route": "/orders",
  "target": { "type": "legacy", "legacyUrl": "/workspace/orders" },
  "aliases": ["legacy.orders"]
}
```

| Field | Meaning |
|---|---|
| `route` | The workspace blade of the module's Admin Shell plugin. The item opens it when `{module}/plugins/admin-shell/` has `plugin.json` and `remoteEntry.js`. |
| `target` | What the item opens otherwise: the AngularJS screen. An item with a `route` and no `target` (a screen that only has a Vue UI) is left out while the plugin isn't installed. The menu API returns the AngularJS target of an item that opens its Vue route as `fallback`. |
| `aliases` | Ids the item had before. Global and role patches, a user's pins, hides and order, *Recent* and group lists recorded on `legacy.orders` apply to `orders`. |

So a module needs no contribution for a screen the default menu places: building its plugin switches the item to Vue in place. When a module gets a Vue screen, set the item's `route` and keep its `target` for older module versions.

## Replacing another item

A contribution can take the place of an item the default menu doesn't know the module's screen for (a partner's AngularJS screen, an item of another module):

1. Contribute the Vue item with `replaces` set to the old item's id. Section, priority and group come from the replaced item, so the entry stays where users know it (set `group` only to choose another group). To move it elsewhere, use a [menu patch](menu-layers.md).
2. Ids are rewritten: a global or role patch, a user's pin, hide or order, and *Recent* recorded on the old id now apply to the new one.
3. Other entry points of the old screen (dashboard widgets, search results that open `/workspace/...`) are the plugin's to update.

If the replaced id is an item of `default-menu.json` (or one of its `aliases`), the default menu's item keeps its place and opens the contribution's `route`. Replacements apply to the default menu only. A `replaces` on an item added by a patch has no effect.

## Guidelines

- Keep one item per workspace; put sub-pages in `children` only when the screen itself has no navigation.
- Always set `permission`; without it every user sees the item and gets an error when the screen loads data.
- Don't remove an item's AngularJS `target` from `default-menu.json` when a module gets a Vue screen: older module versions still need it, and the item opens the Vue `route` wherever the new plugin is installed.
- Never change an item's id without adding the old one to `aliases`: stored patches and user settings name items by id.

## Testing

- `POST /api/admin-shell/menu/default` (permission `admin-shell:menu:manage`, body `{}`) shows the default menu with your item; the AngularJS one is gone if `replaces` is set.
- `POST /api/admin-shell/menu` (body `{}`) shows the effective menu of the signed-in user.
- In the shell: the item is in its section and group, it opens the screen, and a user without the permission doesn't see it.
