# Menu Layers — Configuration Guide

## Overview

The Admin Shell menu is configurable without changing code, by the people who run the platform. Each request composes it from layers, and no layer edits another:

```
default menu ──► global patch ──► role patches ──► user preferences ──► permission filter ──► effective menu
(Virto Commerce:  (system integrator / customer:   (each user: pins,     (the server leaves out what
 default-menu.json, one for the platform, one per   hidden items, order) the user may not open)
 apps, plugins)    role)
```

- **Default menu:** shipped with the modules (`default-menu.json`, installed apps, [plugin contributions](menu-contributions.md)) plus the workspace blades no entry opens, in *More* (see *Discovered blades*). It changes with module versions.
- **Global patch:** the organisation's changes for everyone: rename, reorder, move or hide sections and items, add links.
- **Role patches:** changes for the users of a role, e.g. a lean menu for fulfilment staff.
- **User preferences:** each user pins and hides items in the shell's own menu.

Patches name sections and items by id, so they keep working when a module upgrades. When an item's id changes (the AngularJS `legacy.stores` became `stores`; a module's Vue screen replaces another item), a patch written for the old id applies to the item.

Source: `src/VirtoCommerce.AdminShell.Core/Services/MenuComposer.cs`, `src/VirtoCommerce.AdminShell.Data/Services/AdminMenuService.cs`, `src/VirtoCommerce.AdminShell.Web/Controllers/Api/AdminShellMenuController.cs`.

## Where the layers are stored

| Layer | Platform setting | Stored for | API (`/api/admin-shell/menu`) |
|---|---|---|---|
| Global patch | `AdminShell.Menu.Global` | the platform | `GET` / `PUT /global` |
| Role patch | `AdminShell.Menu.Role` | each role | `GET` / `PUT /roles/{roleId}` |
| User preferences | `AdminShell.Menu.User` (hidden) | each user | `GET` / `PUT /me/prefs` (the user's own) |

The global and role endpoints need the permission `admin-shell:menu:manage`; the user's own need `admin-shell:access`. The values are JSON; property names are case-insensitive. A value that isn't valid JSON is ignored (that layer counts as empty) so a typo can't take the menu down for everyone. The global patch is what the menu editor (*Configuration › Monitoring & Tools › Admin Shell Menu Editor*, below) writes; it is also a platform setting (group *Admin Shell → Menu*), so it can be edited as JSON in the platform's settings. Role patches have no editor yet: use the API.

## The menu editor (Configuration › Monitoring & Tools › Admin Shell Menu Editor)

Users with `admin-shell:menu:manage` open *Configuration › Monitoring & Tools › Admin Shell Menu Editor* (route `/menu-editor`). It edits the global patch and shows the result at once, without saving:

| Tab | What it does |
|---|---|
| Menu | Every section and item of the default menu with the patch applied: sections on a tinted header, their items indented under it, by panel group. Drag a section by its header, or an item, to reorder it or drop it into another group or section (mouse; on touch, press and hold first, or drag the grip at once; with the keyboard, the arrow keys on the grip). Each group is a drop zone, an empty one too; while dragging, a grouped section also shows one for *no group*. Rename a section or an item in the user's language and in English (the fallback of every other language), hide and show, add a section (header) or a link (*Add link* at the end of its section; forms have *Cancel* and close on Esc), undo one change, or undo all. Hidden entries stay listed, struck through. Chips say what changed: *Hidden*, *Changed*, *Added*, *Found automatically* (a discovered blade in *More*). |
| Personalization | What users may change in their own menu: pin, hide, reorder (see *Personalization limits*). |
| AngularJS screens | Reads the AngularJS admin's own menu (`platformWebApp.mainMenuService`, from the admin started in a hidden frame) and lists the screens the menu doesn't open yet; the ones it opens (also those a default menu item opens as Vue now, by its `fallback`) are listed on demand. *Add* puts a screen into a section of your choice (*More* by default) as an `addItems` entry with a `legacy` target and the screen's AngularJS title key, so it shows translated. |

The toolbar has *Save*; *Reset*, which drops the changes made since the last save; *Refresh*; *Edit as JSON*; and *Undo all changes*, which removes the whole patch, so the Virto Commerce menu applies again once you save.

*Edit as JSON* (toolbar, named as on the settings screen) opens the patch being edited as a JSON document beside the editor: the value of `AdminShell.Menu.Global`, with the editor's unsaved changes. *Download* saves it (`admin-shell-menu-<date>.json`) for a backup or another environment; *Upload* or paste one and *Apply* it to restore. The document is checked as you type (valid JSON, an object whose `sections` and `items` are objects and whose `addSections` and `addItems` are lists of entries with an `id`); *Apply* hands it to the editor, which shows the result before *Save* stores it, and *Discard edits* goes back to the editor's patch.

*Save* writes the global patch and the personalization settings and reloads the shell's menu. A drag renumbers the section's items (or the sections) 100 apart, as the default menu is. The editor works on ids, as patches do, so the Virto Commerce menu keeps improving under your changes.

## Personalization limits

| Setting | Default | Off |
|---|---|---|
| `AdminShell.Menu.AllowPin` | on | The pin action is gone, and the users' pins stop showing in *Pinned*. |
| `AdminShell.Menu.AllowHide` | on | The hide action and *Show hidden items* are gone, and the items users hid show again. |
| `AdminShell.Menu.AllowReorder` | on | The users' own order (`order` in their preferences) doesn't apply. |

Turning a setting off doesn't delete anything: the users' preferences stay stored, and they apply again when the setting is turned on. The effective menu carries the flags (`personalization`), so the shell offers only the actions that are allowed. The settings are ordinary platform settings (group *Admin Shell → Menu*), so they can also be set per environment through configuration.

## Discovered blades

Every workspace blade the host and the loaded plugins register (`defineBlade({ isWorkspace: true, url })`) is a screen people need to reach. Once the plugins have loaded, the shell sends the ones it found with the menu request (`POST /api/admin-shell/menu` with `{ "discovered": [...] }`); the server adds those whose route no menu item opens to the section *More* (id `more`, after *Apps*), with the plugin's `menuItem` title (a translation key) and icon when the blade has one. Their ids are `blade.<BladeName>`, so a patch can rename, move or hide them like any item: move them where they belong in the editor. The host's own blades that have another way in (the user profile, the steps of Modules) are left out. Source: `App/src/shell/bladeDiscovery.ts`, `MenuComposer.AddDiscovered`.

A contribution whose `sectionId` the menu doesn't have, or that has none, goes to *More* too.

Start from the default menu to find ids: `GET /api/admin-shell/menu/default`.

## Quick start

A global patch that renames a section, moves Pricing to Configuration, hides Subscriptions and adds a link to the company wiki:

```json
{
  "sections": {
    "catalog": { "title": "Catalog" }
  },
  "items": {
    "pricing": { "sectionId": "configuration", "priority": 50 },
    "subscriptions": { "hidden": true }
  },
  "addItems": [
    {
      "id": "acme.wiki",
      "sectionId": "configuration",
      "title": "Team wiki",
      "icon": "lucide-book-open",
      "priority": 2450,
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
  "sections":    { "<sectionId>": { "title": "…", "icon": "…", "priority": 150, "hidden": true } },
  "items":       { "<itemId>":    { "title": "…", "icon": "…", "priority": 150, "sectionId": "…", "hidden": true } },
  "addSections": [ { "id": "…", "title": "…", "icon": "…", "priority": 650, "permission": "…", "groups": [] } ],
  "addItems":    [ { "id": "…", "sectionId": "…", "title": "…", "icon": "…", "priority": 150, "permission": "…", "target": { … } } ]
}
```

Applied in this order:

| Part | Effect |
|---|---|
| `addSections` | Adds sections whose id is new. |
| `addItems` | Adds items to an existing section (`sectionId`), when the menu doesn't already have that id. Give a `target` ([targets](menu-contributions.md#targets)); `route` isn't resolved here, and an item with no target and no children is dropped. `permission` hides it from users without that permission. |
| `sections` | Overrides a section's `title`, `titles`, `icon`, `priority`; `hidden: true` removes it. |
| `items` | Overrides an item's `title`, `titles`, `icon`, `priority`; `sectionId` moves it to another section, `group` puts it under one of its section's groups (by the group's title; `""` for none); `hidden: true` removes it (children too; a parent left empty disappears). |

Titles: `title` is one title for every language (the original format). `titles` gives it by language, `{ "en": "Accounts", "de": "Konten" }`: the user's language wins, then English; both win over the item's translation key ([Localization](localization.md#menu)).

Fields left out (or `null`) keep the value below. Unknown ids are ignored.

Priorities: the default menu's sections are 100 apart (Home 100, Products 200, Orders & Customers 300, Marketing & Content 400, Insights 500, Configuration 600, Apps 700, More 800), and so are the items of each section (100, 200, 300… in their order). An entry goes between two with a value in between: `150` puts an item between a section's first and second; `650` puts a section between Configuration and Apps. The menu editor numbers what it moves the same way.

## Role patches

Each role has its own patch, in the same format. For a user with several roles:

- renames, moves, priorities and additions apply role after role, in role-name order; a later role wins for the same field;
- a section or item is **hidden only if every role of the user hides it**. A role that keeps an item visible keeps it for the user. A role without a patch keeps everything.

Example, a role for warehouse staff (`PUT /api/admin-shell/menu/roles/{roleId}`):

```json
{
  "sections": { "marketing": { "hidden": true }, "insights": { "hidden": true } },
  "items": { "inventory": { "sectionId": "dashboard", "priority": 150 } }
}
```

Hiding is not a security boundary. A user who may not use a screen must not have its permission; the menu then leaves the item out by itself.

## User preferences (`UserMenuPrefs`)

Each user pins, hides and restores items in the shell's panel; the preferences are stored per user. `order` is supported by the API (`PUT /me/prefs`) but the shell has no UI to reorder items yet.

```json
{
  "pinned": ["orders", "platform.settings"],
  "hidden": ["subscriptions"],
  "order": { "orders": ["customers", "orders"] }
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
