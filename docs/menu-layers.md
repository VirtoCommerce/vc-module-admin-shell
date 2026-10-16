# Menu Layers — Configuration Guide

## Overview

The Admin Shell menu is configurable without changing code, by the people who run the platform. Each request composes it from layers, and no layer edits another:

```
default menu ──► global patch ──► role patches ──► user preferences ──► permission filter ──► effective menu
(Virto Commerce:  (system integrator / customer:   (each user: pins,     (the server leaves out what
 default-menu.json, one for the platform, one per   hidden items, order) the user may not open)
 apps, plugins)    role)
```

- **Default menu:** shipped with the modules (`default-menu.json`, installed apps, [plugin contributions](menu-contributions.md)). It changes with module versions.
- **Global patch:** the organisation's changes for everyone: rename, reorder, move or hide sections and items, add links.
- **Role patches:** changes for the users of a role, e.g. a lean menu for fulfilment staff.
- **User preferences:** each user pins and hides items in the shell's own menu.

Patches name sections and items by id, so they keep working when a module upgrades. When a module replaces an AngularJS screen with a Vue one, a patch written for the old id (`legacy.stores`) applies to the new item.

Source: `src/VirtoCommerce.AdminShell.Core/Services/MenuComposer.cs`, `src/VirtoCommerce.AdminShell.Web/Services/AdminMenuService.cs`, `src/VirtoCommerce.AdminShell.Web/Controllers/Api/AdminShellMenuController.cs`.

## Where the layers are stored

| Layer | Platform setting | Stored for | API (`/api/admin-shell/menu`) |
|---|---|---|---|
| Global patch | `AdminShell.Menu.Global` | the platform | `GET` / `PUT /global` |
| Role patch | `AdminShell.Menu.Role` | each role | `GET` / `PUT /roles/{roleId}` |
| User preferences | `AdminShell.Menu.User` (hidden) | each user | `GET` / `PUT /me/prefs` (the user's own) |

The global and role endpoints need the permission `admin-shell:menu:manage`; the user's own need `admin-shell:access`. The values are JSON; property names are case-insensitive. A value that isn't valid JSON is ignored (that layer counts as empty) so a typo can't take the menu down for everyone. There is no menu editor UI yet: use the API. The global patch is also a platform setting (group *Admin Shell → Menu*), so it can be edited as JSON in the platform's settings.

Start from the default menu to find ids: `GET /api/admin-shell/menu/default`.

## Quick start

A global patch that renames a section, moves Pricing to Configuration, hides Subscriptions and adds a link to the company wiki:

```json
{
  "sections": {
    "catalog": { "title": "Catalog" }
  },
  "items": {
    "legacy.pricing": { "sectionId": "configuration", "priority": 5 },
    "legacy.subscriptions": { "hidden": true }
  },
  "addItems": [
    {
      "id": "acme.wiki",
      "sectionId": "configuration",
      "title": "Team wiki",
      "icon": "lucide-book-open",
      "priority": 200,
      "target": { "type": "url", "url": "https://wiki.example.com/commerce" }
    }
  ]
}
```

```
PUT /api/admin-shell/menu/global
Content-Type: application/json

{ …the patch above… }
```

The menu changes on the next page load; nothing is cached.

## Patch reference (`MenuPatch`)

```json
{
  "sections":    { "<sectionId>": { "title": "…", "icon": "…", "priority": 10, "hidden": true } },
  "items":       { "<itemId>":    { "title": "…", "icon": "…", "priority": 10, "sectionId": "…", "hidden": true } },
  "addSections": [ { "id": "…", "title": "…", "icon": "…", "priority": 50, "permission": "…", "groups": [] } ],
  "addItems":    [ { "id": "…", "sectionId": "…", "title": "…", "icon": "…", "priority": 10, "permission": "…", "target": { … } } ]
}
```

Applied in this order:

| Part | Effect |
|---|---|
| `addSections` | Adds sections whose id is new. |
| `addItems` | Adds items to an existing section (`sectionId`), when the menu doesn't already have that id. Give a `target` ([targets](menu-contributions.md#targets)); `route` isn't resolved here, and an item with no target and no children is dropped. `permission` hides it from users without that permission. |
| `sections` | Overrides a section's `title`, `icon`, `priority`; `hidden: true` removes it. |
| `items` | Overrides an item's `title`, `icon`, `priority`; `sectionId` moves it to another section; `hidden: true` removes it (children too; a parent left empty disappears). |

Fields left out (or `null`) keep the value below. Unknown ids are ignored.

## Role patches

Each role has its own patch, in the same format. For a user with several roles:

- renames, moves, priorities and additions apply role after role, in role-name order; a later role wins for the same field;
- a section or item is **hidden only if every role of the user hides it**. A role that keeps an item visible keeps it for the user. A role without a patch keeps everything.

Example, a role for warehouse staff (`PUT /api/admin-shell/menu/roles/{roleId}`):

```json
{
  "sections": { "marketing": { "hidden": true }, "insights": { "hidden": true } },
  "items": { "legacy.inventory": { "sectionId": "dashboard", "priority": 5 } }
}
```

Hiding is not a security boundary. A user who may not use a screen must not have its permission; the menu then leaves the item out by itself.

## User preferences (`UserMenuPrefs`)

Each user pins, hides and restores items in the shell's panel; the preferences are stored per user. `order` is supported by the API (`PUT /me/prefs`) but the shell has no UI to reorder items yet.

```json
{
  "pinned": ["legacy.orders", "platform.settings"],
  "hidden": ["legacy.subscriptions"],
  "order": { "orders": ["legacy.customers", "legacy.orders"] }
}
```

- `pinned` items show in *Pinned* at the top of the panel.
- `hidden` removes items for this user; the shell lists them so they can be restored.
- `order` lists item ids per section; listed items come first in that order, the rest keep the default order.

*Recent* (the user's most used items) is computed by the server from uses the shell records (`AdminShell.Menu.Recent`), and isn't edited.

## Guidelines

- Patch by id; don't copy the default menu into a patch. Then module upgrades still reach your users.
- Hide with roles, not with the global patch, when only some users shouldn't see something: a role patch hides only for that role.
- Prefix added items' ids with your organisation (`acme.wiki`) so they never collide with a module's.
- Check a patch with a test user of each role after changing it.

## Testing

- `GET /api/admin-shell/menu/global` and `/roles/{roleId}` return what is stored.
- Sign in as a user of the role (or `GET /api/admin-shell/menu` as that user) to see the effective menu.
- The composition rules are covered by `tests/VirtoCommerce.AdminShell.Tests/MenuComposerTests.cs`; add a test there when changing them.
