# Menu Contributions — Developer Guide

## Overview

The Admin Shell menu is composed on the server. A module adds its entries by listing them in its plugin's `plugin.json` under `contributions.menu`; the shell reads them when it builds the default menu, so they go through the same layers (global and role patches, user pins and order) and the same permission filter as every other item.

The most important use is **replacing an AngularJS screen**: an item with `replaces: "legacy.<id>"` takes the AngularJS item's place, group and priority, and everything recorded on the old id (patches, pins, hidden items, *Recent*) follows it. Users keep their menu when a module moves to Vue.

Source: `src/VirtoCommerce.AdminShell.Web/Services/DefaultMenuBuilder.cs` (reading), `src/VirtoCommerce.AdminShell.Core/Services/MenuComposer.cs` (replacements), `src/VirtoCommerce.AdminShell.Core/Models/MenuModels.cs` (model), `src/VirtoCommerce.AdminShell.Web/Content/default-menu.json` (the default sections and items).

## Where menu items come from

| Source | Who edits it | Items |
|---|---|---|
| `Content/default-menu.json` (this module) | Admin Shell developers | Sections and groups; AngularJS screens (`legacy.*`), the platform's Vue screens (`platform.*`), known apps. An item whose `moduleId` isn't installed is dropped. |
| Installed apps | module developers (`module.manifest`) | Each app with `<placement>MainMenu</placement>` that the default menu doesn't place → *Apps* section. See [Embedded apps](embedded-apps.md). |
| `plugin.json` → `contributions.menu` | module developers | This guide. |
| Global and role patches | system integrators, customers | Add, rename, move, hide. See [Menu layers](menu-layers.md). |

> vc-shell's own `defineBlade({ menuItem })` is not shown in the Admin Shell: the shell replaces vc-shell's menu with its own. Declare menu entries in `plugin.json`.

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
        "priority": 10,
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
| `title` | string | Label. |
| `icon` | string | A vc-shell icon (`lucide-*`). |
| `iconUrl` | string | An image instead of the icon. |
| `sectionId` | string | The section (rail entry). Missing section: created with this id as its title, after *Configuration*. No `sectionId`: section *Other*. Ignored when the item replaces another: it takes that item's section. |
| `priority` | int | Order in the section, lower first; ties by title. Ignored when the item replaces another: it takes that item's priority. |
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
| `dashboard` | Home | 0 | |
| `catalog` | Products | 10 | |
| `orders` | Orders & Customers | 20 | Sales, Customers |
| `marketing` | Marketing & Content | 30 | Merchandising, Content, Engagement |
| `insights` | Insights | 35 | Analytics, Search |
| `configuration` | Configuration | 90 | Store, Platform, Catalog & Search, Security & Privacy, Data & Files, Monitoring & Tools |
| `apps` | Apps | 100 | |

### Groups

A section's `groups` list item ids (`{ "title": "Sales", "items": ["legacy.orders", "quotes", "legacy.subscriptions", "returns"] }`). Some ids are reserved for modules that will contribute them (`quotes`, `returns`, `contracts`, `loyalty`, `customerReviews`, `webhooks`, `audit-log`, …): a contribution with that id lands in its group without setting `group`. A replacing item takes the replaced item's group.

## Replacing an AngularJS screen

1. Find the AngularJS item's id in `Content/default-menu.json` (`legacy.stores`, `legacy.inventory`, `legacy.orders`).
2. Contribute the Vue item with `replaces` set to it. Section, priority and group come from the replaced item, so the entry stays where users know it (set `group` only to choose another group). To move it elsewhere, use a [menu patch](menu-layers.md).
3. Ids are rewritten: a global or role patch, a user's pin, hide or order, and *Recent* recorded on `legacy.stores` now apply to `stores`.
4. Other entry points of the old screen (dashboard widgets, search results that open `/workspace/stores`) are the plugin's to update.

Replacements apply to the default menu only. A `replaces` on an item added by a patch has no effect.

## Guidelines

- Keep one item per workspace; put sub-pages in `children` only when the screen itself has no navigation.
- Always set `permission`; without it every user sees the item and gets an error when the screen loads data.
- Don't remove an AngularJS item from `default-menu.json` when a module gets a Vue screen: older module versions still need it, and `replaces` hides it wherever the new plugin is installed.

## Testing

- `GET /api/admin-shell/menu/default` (permission `admin-shell:menu:manage`) shows the default menu with your item; the AngularJS one is gone if `replaces` is set.
- `GET /api/admin-shell/menu` shows the effective menu of the signed-in user.
- In the shell: the item is in its section and group, it opens the screen, and a user without the permission doesn't see it.
