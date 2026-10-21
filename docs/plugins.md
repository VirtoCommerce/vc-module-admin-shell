# Admin Shell Plugins — Developer Guide

## Overview

A module brings its UI to the Admin Shell as a **plugin**: a [Module Federation](https://module-federation.io/) remote built with vc-shell into the module's `plugins/admin-shell/` folder. The platform lists the plugins of all installed modules in the app manifest, and the shell loads them at runtime. The shell doesn't know any module: a plugin comes and goes with its module, and every other extension point (menu, search, dashboard, widgets) is reached from the plugin.

What a plugin can bring:

| Extension | How | Guide |
|---|---|---|
| Screens (blades) and their routes | `defineAppModule({ blades })` | below |
| Translations | `defineAppModule({ locales })` | below |
| Notification types | `defineAppModule({ notifications })` | vc-shell |
| Menu items, replacing AngularJS ones | `contributions.menu` in `plugin.json` | [Menu contributions](menu-contributions.md) |
| Global search groups | `$globalSearch.registerProvider` | [Global search](global-search.md) |
| Counters on menu items | `$menuCounters.register` | [Menu counters](menu-counters.md) |
| Dashboard widgets | `registerDashboardWidget` | [Dashboard widgets](dashboard-widgets.md) |
| Widgets in other modules' blades | `registerExternalWidget` | [Blade widgets](blade-widgets.md) |
| Content on the sign-in page | `useExtensionPoint("auth:after-form")` | [Sign-in page](sign-in-page.md) |
| Opening AngularJS screens | `$globalSearch.openLegacy` | [AngularJS screens](legacy-screens.md) |

Real plugins to copy, on the `feat/VCST-6327-admin-shell` branches: **Cart** (`vc-module-cart`, the smallest: one dashboard widget, no screens), **Inventory** (`vc-module-inventory`, small: blades, blade widgets, a dashboard widget), **Store** (blades, search), **Orders** (blades, search, dashboard widgets, a blade widget), **Customer**, **Catalog**.

## How a plugin is loaded

```
module package                         platform                                 Admin Shell host
{module}/plugins/admin-shell/          GET /api/apps/admin-shell/manifest       registerRemoteModules()
  remoteEntry.js  ──── exists? ───►    { plugins: [ { id, version,      ──►     load remoteEntry.js?v=hash
  plugin.json                              entry: { path, hash },                 app.use(plugin, { router })
  assets/…                                 remote: { name, exposed } } ] }        as soon as it resolves
```

- The platform includes a plugin only when `remoteEntry.js` exists in `{moduleRoot}/plugins/admin-shell/`. Its id and version default to the module's.
- `hash` is the entry file's write time, so a new build is fetched without clearing caches. The manifest is cached by the platform; in Development it is rebuilt on every request, otherwise `POST /api/apps/manifest/invalidate` refreshes it.
- The host installs each plugin as soon as its remote loads, in parallel with the first render. A plugin that fails is logged in the browser console and skipped; the others still load.
- Shared singletons (one copy for the host and all plugins): `vue`, `vue-router`, `vue-i18n`, `vee-validate`, `lodash-es`, `@vueuse/core`, `@vc-shell/framework` and its `/ui`, `/ai-agent`, `/extensions` entries. Use the host's versions; don't bundle your own.

## Quick start

### 1. Folder

```
src/VirtoCommerce.<Module>.Web/vue/
  package.json            # @vc-shell/framework, @vc-shell/mf-module, vue, vue-router (same versions as the host)
  vite.config.mts
  index.html              # Vite needs an HTML entry; the host uses remoteEntry.js
  tsconfig.json           # extends @vc-shell/ts-config
  public/plugin.json      # copied to the output: remote name, menu contributions
  src/api_client/         # generated with @vc-shell/api-client-generator
  src/modules/index.ts    # the plugin's entry
  src/modules/pages/      # blades
  src/modules/locales/    # en.json, index.ts
```

`vue/.gitignore` leaves out `node_modules`, `dist` and `.yarn/*` (except `.yarn/releases`), and the repository's `.gitignore` leaves out the build output `src/VirtoCommerce.<Module>.Web/plugins/`.

### 2. Build configuration

```ts
// vite.config.mts
import path from "node:path";
import { getDynamicModuleConfiguration } from "@vc-shell/mf-module";

const base = "/modules/$(VirtoCommerce.Inventory)/plugins/admin-shell/";
process.env.APP_BASE_PATH = base;

export default getDynamicModuleConfiguration({
  appId: "admin-shell",
  moduleRoot: path.resolve(__dirname, ".."),   // output: <module>.Web/plugins/admin-shell/
  entry: "./src/modules/index.ts",
  remoteName: "inventory_admin",               // unique; the same as plugin.json's remote.name
  base,
});
```

```json
// public/plugin.json
{
  "remote": { "name": "inventory_admin", "exposed": "./Module" },
  "contributions": { "menu": [ { "id": "inventory", "sectionId": "catalog", "title": "Inventory", "icon": "lucide-boxes",
                                 "route": "/inventory", "permission": "inventory:access", "priority": 30,
                                 "replaces": "legacy.inventory" } ] }
}
```

### 3. Entry

```ts
// src/modules/index.ts
import { defineAppModule, registerExternalWidget } from "@vc-shell/framework";
import type { App } from "vue";
import * as blades from "./pages";
import * as locales from "./locales";
import { registerInventorySearch } from "./search";
// dashboard widgets register at import, before the host builds the dashboard
import "./dashboard";

const appModule = defineAppModule({ blades, locales });

export default {
  install(app: App) {
    appModule.install(app);
    registerInventorySearch(app); // uses app.config.globalProperties.$globalSearch
  },
};
```

The host accepts a default export with `install`, a named `install`, or every export that has `install`, and calls it as `app.use(plugin, { router })`.

### 4. Blades

A blade declares its name, its URL and the permissions it needs; a workspace blade gets a route of its own (`#/inventory`), which the menu item opens:

```ts
defineBlade({ url: "/inventory", name: "InventoryFulfillmentCenterList", isWorkspace: true, permissions: ["inventory:access"] });
```

Export blades by name from `pages/index.ts`. Blade names are global: prefix them with the module (`InventoryDetails`, `OrdersDetails`). Other plugins and the global search open a blade by its name.

### 5. Packaging

Build the plugin before the module is published, so `vc-build Compress` packs it (from `vc-module-inventory`):

```xml
<Target Name="BuildAdminShellPlugin" BeforeTargets="Publish"
        Condition="'$(SkipAdminShellPlugin)' != 'true' AND Exists('$(MSBuildProjectDirectory)\vue\package.json')">
  <Exec Command="corepack enable" ContinueOnError="true" />
  <Exec Command="yarn install --immutable" WorkingDirectory="$(MSBuildProjectDirectory)\vue" />
  <Exec Command="yarn type-check" WorkingDirectory="$(MSBuildProjectDirectory)\vue" />
  <Exec Command="yarn build" WorkingDirectory="$(MSBuildProjectDirectory)\vue" />
</Target>
<!-- the platform probes {moduleRoot}/plugins/, publish goes to {moduleRoot}/bin; list the files after the build -->
<Target Name="CopyAdminShellPluginOnPublish" AfterTargets="Publish" DependsOnTargets="BuildAdminShellPlugin"
        Condition="'$(SkipAdminShellPlugin)' != 'true'">
  <ItemGroup><AdminShellPlugin Include="$(MSBuildProjectDirectory)\plugins\**\*" /></ItemGroup>
  <Copy SourceFiles="@(AdminShellPlugin)" DestinationFiles="$(PublishDir)\..\plugins\%(RecursiveDir)%(Filename)%(Extension)" />
</Target>
```

`SkipAdminShellPlugin=true` builds the module without its plugin.

## Reference

### `plugin.json`

| Field | Read by | Description |
|---|---|---|
| `remote.name` | platform | The Module Federation container name. Unique across modules (`<module>_admin`). |
| `remote.exposed` | platform | The exposed module. Default `./Module`. |
| `id`, `version` | platform | Default to the module's id and version. |
| `entry` | platform | Entry file name. Default `remoteEntry.js`; keep the default, the menu reads contributions only next to `remoteEntry.js`. |
| `contentFiles` | platform | Extra files to load, relative to the folder (`.css` as styles). Rarely needed: Vite links the plugin's CSS itself. |
| `contributions.menu` | Admin Shell | Menu items. See [Menu contributions](menu-contributions.md). |

### What the host provides

| Name | Where | Description |
|---|---|---|
| `$globalSearch` | `app.config.globalProperties`, `inject("adminShell.globalSearch")` | The search registry and the navigation helpers (`openBlade`, `openLegacy`, `goTo`, `waitFor`). Guard for its absence to run in other vc-shell hosts. |
| `$menuCounters` | `app.config.globalProperties`, `inject("adminShell.menuCounters")` | The menu counter registry. Guard for its absence too. |
| `$modules` | `app.config.globalProperties`, `inject("adminShell.modules")` | The installed modules: `isInstalled(id)`, `whenInstalled(id)`, `version(id)`. See [Using other modules](#using-other-modules). |
| `$sharedWidgets` | `app.config.globalProperties`, `inject("adminShell.sharedWidgets")` | Widgets one module provides and another places on its own blades. See [Blade widgets](blade-widgets.md#shared-widgets). |
| `ModulesReadyKey` | `inject` (vc-shell) | `true` once all plugins have loaded. |
| Design tokens | global CSS | `--color-{primary,secondary,accent,neutral,warning,danger,success,info}-50…950`, `--fg-*`, `--bg-*`, `--border-*`, with dark-theme values. |
| `.dash-*` classes | global CSS | Dashboard widget markup. See [Dashboard widgets](dashboard-widgets.md). |
| vc-shell | `@vc-shell/framework` | Everything else: blades, toolbars, tables, forms, notifications, permissions (`usePermissions`), API clients (`useApiClient`), popups. |

A plugin can't import the host's code (`src/...` of the shell) or its private styles (`.as-*`). If a plugin needs something the host has, it belongs in vc-shell or in a registry the host exposes.

### Using other modules

A plugin may use another module's blades, API or routes only as its `module.manifest` allows:

| The other module is | The plugin may | Example |
|---|---|---|
| A dependency (`<dependency id="…" />`), directly or through other modules | use it freely | Orders opens the Customer blades |
| An optional dependency (`<dependency id="…" optional="true" />`) | use it only when it is installed: hide the picker, link or widget otherwise | Shipping's fulfillment-center picker needs Inventory |
| Not declared | not use it: declare it, or leave it out | — |

An optional dependency is the platform's own: the module installs without it, and it isn't part of the dependency-cycle check (`ModuleCatalog.SolveDependencies` skips it), so a module may declare one even on a module that depends on it. Modules already use it (Catalog on Bulk Actions and Export, Marketing on Customer and Orders).

```xml
<dependency id="VirtoCommerce.Inventory" version="3.1010.0" optional="true" />
```

Check the module with `$modules` before using it. In a template the check is reactive (false until the list has loaded, so the control appears once the answer is known); in code, wait for it:

```vue
<template>
  <VcSelect v-if="$modules.isInstalled('VirtoCommerce.Inventory')" :options="searchFulfillmentCenters" … />
</template>
```

```ts
const modules = inject<InstalledModules | undefined>("adminShell.modules");
if (await modules?.whenInstalled("VirtoCommerce.Catalog")) openBlade({ name: "CatalogBrowse", options: { pick } });
```

A widget on another module's blade needs no check: without that module the blade doesn't exist and the widget never shows. To put a widget on blades of a module that depends on yours, don't register it there: provide it and let that module place it ([shared widgets](blade-widgets.md#shared-widgets)).

**Testing without a module.** This browser can treat modules as missing, without uninstalling them: set `localStorage.setItem("adminShell.debug.missingModules", "VirtoCommerce.Customer,VirtoCommerce.Inventory")` in the browser console and reload. The console warns while it is set; remove the key to go back.

### Translations

Ship `locales/en.json` under one top-level key for the module (`INVENTORY`, `ORDERS`) and pass it to `defineAppModule({ locales })`; it is merged into the host's i18n. A locale file with a `language_name` key adds that language to the shell's language picker.

## Guidelines

- Prefix everything global with the module: blade names, search provider ids, dashboard widget ids, external widget ids, locale keys, the remote name.
- Declare `permissions` on blades, widgets and providers, so the shell doesn't show what the user can't use; the API still checks.
- Use vc-shell's components and the design tokens; check both themes and a phone-sized window.
- Keep one plugin per module. A module that adds to another module's screens does it with [blade widgets](blade-widgets.md), not by importing the other plugin.
- Use another module only as `module.manifest` allows, and check an optional one with `$modules` ([Using other modules](#using-other-modules)).

## Testing a plugin

1. `yarn type-check` and `yarn build` in `vue/`.
2. Copy `plugins/admin-shell/` into `{platform}/modules/{Module}/plugins/admin-shell/` (no restart; in production call `POST /api/apps/manifest/invalidate`).
3. In the browser: `GET /api/apps/admin-shell/manifest` lists the plugin; the console shows no loading errors; the menu item opens the screen; a deep link to it (`#/inventory`) works after a reload.
4. For each optional dependency: list it in `adminShell.debug.missingModules`, reload, and check that its pickers, links and widgets are hidden and nothing fails.
