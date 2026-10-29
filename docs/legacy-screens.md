# AngularJS Screens in the Admin Shell — Developer Guide

## Overview

Until every module has a Vue UI, the Admin Shell keeps the AngularJS admin's screens working **inside** the shell. The classic admin runs in one embedded frame for the whole session; menu items, search results and widgets open its screens there, and the user stays in the shell's navigation.

This is how a module stays usable before it has a plugin, and how a plugin can still open a screen it hasn't ported yet.

Source: `src/VirtoCommerce.AdminShell.Web/App/src/shell/LegacyHost.vue` (the frame), `src/router/routes.ts` (the `Legacy` route), `src/shell/search/navigation.ts` (`openLegacy`).

## How it works

```
#/legacy?url=/workspace/orders
      │
      ▼
LegacyHost (one iframe per session, same origin)
  first use:   src = {admin}?EmbeddedMode=true#!/workspace/orders   (the classic admin, without its own navigation)
  next uses:   frame.location.hash = #!/workspace/catalog       (no reload: the admin keeps its state)
  same url:    $state.reload()                                   (the screen reopens from its root blade)
  Vue screen:  the frame is hidden, not unloaded
```

- The frame is laid over the shell's workspace and follows its size; the shell's rail, panel, header and search stay usable.
- It loads the first time an AngularJS screen opens (a few seconds: the whole classic admin starts), then stays loaded.
- It is the same origin as the shell, so the shell can reach the admin's AngularJS injector.
- `{admin}` is where the AngularJS admin (module VirtoCommerce.AdminAngularJs, app `platform`) opens: `/` when it owns the site root, `/apps/platform/` when Admin Shell does. The shell reads it from `GET /api/platform/common/ui/context` (`adminUIs`), once per page; platforms without that list serve the AngularJS admin at `/`. Source: `src/shell/legacyAdmin.ts`.
- Without the AngularJS admin installed, AngularJS menu items show a message instead of the frame, and `openLegacy` returns without opening anything.
- The embedded admin keeps its own look; the shell doesn't restyle it.

## Opening an AngularJS screen

### From the menu

A menu item with a `legacy` target (`default-menu.json` has one for every module's workspace):

```json
{ "id": "legacy.orders", "title": "Orders", "moduleId": "VirtoCommerce.Orders", "permission": "order:access",
  "target": { "type": "legacy", "legacyUrl": "/workspace/orders" } }
```

`legacyUrl` is the AngularJS state URL, as in the classic admin's address bar after `#!`. When the module ships a Vue screen, its plugin [replaces](menu-contributions.md#replacing-an-angularjs-screen) the item.

### From a plugin or the shell: the route

```ts
router.push({ name: "Legacy", query: { url: "/workspace/Inventory" } });
```

This opens the workspace from its root, like the menu.

### Into a specific blade: `openLegacy`

To open a record (an order, a customer), wait for the workspace's list blade and call the AngularJS code that opens the detail, as the list does. The shell's helper does the waiting; it is on the global search registry, so a plugin reaches it through `app.config.globalProperties.$globalSearch`:

```ts
const shell = app.config.globalProperties.$globalSearch;

await shell.openLegacy({
  url: "/workspace/customers",           // the state to show
  parent: "members",                     // the list blade's id (or a predicate)
  parentReady: "showDetailBlade",        // a method the list has once it is set up (or a test)
  open: ({ parent }) => parent.showDetailBlade(member),
});

// or a blade definition of your own under the list: copy the one the module's list blade builds
await shell.openLegacy({
  url: "/workspace/<module>",
  parent: "<list blade id>",
  open: ({ injector, showBlade }) =>
    showBlade({ id: "<detail blade id>", controller: "<module's detail controller>",
                template: "Modules/$(<ModuleId>)/Scripts/blades/<detail>.tpl.html", /* the blade's own fields */ }),
});
```

| Option | Description |
|---|---|
| `url` | The AngularJS state URL (`/workspace/orders`). |
| `parent` | The blade to open under: its `id`, or `(blade) => boolean` when several blades share an id. Omit to only show the state. |
| `parentReady` | A method name the parent must have, or `(blade) => boolean`. Use it for lists that set themselves up after they appear (the catalog list closes its children until its catalogs are loaded). |
| `open(context)` | Runs inside AngularJS's digest. `context.injector` (the admin's `$injector`), `context.parent` (the blade found), `context.showBlade(blade, under?)` (`bladeNavigationService.showBlade` under the parent). |

`openLegacy` returns at once when no AngularJS admin is installed. Otherwise it waits up to 30 s for the classic admin to start and 15 s for the parent blade; it rejects with an error after that (the global search shows it as a notification). If the user moved the frame elsewhere by itself (a link inside a blade), it brings it back to `url` first.

Other helpers on the same object: `goTo(route)` (any shell route), `waitFor(test, timeoutMs)` (resolves with `test()`'s value once it is truthy), `openBlade(...)` for Vue screens. See [Global search — Opening a result](global-search.md#opening-a-result).

## Guidelines

- Open screens the way a user gets there (the list, then the detail), so the blades behave as usual: a detail refreshes its list after a save, unsaved changes are asked about.
- Use AngularJS code you find in the module's own list blade (`showDetailBlade`, the blade definition it builds); it is the module's contract, and it is what changes with the module's version.
- Prefer a Vue screen when the module has one: the AngularJS route costs the classic admin's start-up on first use.
- Don't style or script the embedded admin from a plugin beyond opening blades; it is the module's UI.

## Testing

- Open the screen from a cold page (the first use starts the classic admin), and again with the screen already open (it reloads from its root).
- Open a record while another blade of the same workspace is open, and while a blade has unsaved changes.
- Switch to a Vue screen and back: the AngularJS screen keeps its state.
