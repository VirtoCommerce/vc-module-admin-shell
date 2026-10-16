# Virto Commerce Admin Shell Module

## Overview

The Admin Shell module is the Vue admin of the Virto Commerce platform, built on [vc-shell](https://github.com/VirtoCommerce/vc-shell). It runs at `/apps/admin-shell/` next to the AngularJS admin and gradually replaces it. Modules bring their own UI as Admin Shell plugins (Module Federation remotes) that load at runtime. AngularJS screens and platform apps that have no Vue UI yet keep working inside the shell. The menu is composed on the server per user, from the modules' defaults and the organisation's, roles' and users' changes.

## Key Features

* **Module plugins:** modules ship their UI in `plugins/admin-shell/`. The platform lists installed plugins in the app manifest and the shell loads them at runtime, with their screens, menu items, search providers and widgets.
* **Seamless migration:**
  * menu items open Vue screens, AngularJS screens (the classic admin in a persistent embedded frame), platform apps (embedded) or external links;
  * a module's Vue screen `replaces` its AngularJS item and keeps its place, group, pins and user settings.
* **Server-driven, layered menu:** the default menu (`default-menu.json`, installed apps, plugin contributions) → a global patch → role patches → each user's pins and hidden items. The result is filtered by permission, and a section or item stays visible when any role keeps it.
* **Menu counters:** menu items show what waits (new orders, returns requested, reviews to moderate). Each module registers its counter from its plugin, and the shell polls them every minute while the tab is visible.
* **Recent and Pinned:**
  * the panel lists the pages a user opens most (frequency with a 7-day half-life);
  * users can pin and hide items.
* **Global search:** the header box (Ctrl+K / ⌘K; a full-screen sheet on phones) searches every registered provider at once, grouped by provider.
  * `alias: text` scopes a search;
  * slow groups don't hold back the others;
  * a group that fails or takes over 8 seconds shows *Search failed* with *Retry*.
* **Platform screens in Vue:** Settings, Security, Modules, Dynamic properties, Developer tools, License and the user profile ship with the host.
* **Dashboard:**
  * the host's and the modules' widgets on a draggable, resizable grid;
  * the layout is saved per browser;
  * *Reset layout* restores the defaults.
* **Desktop and phone:**
  * a section rail and panel on desktop;
  * a top bar and drawer on phones;
  * light, dark and system themes.
* **Extension points for modules:**
  * menu contributions;
  * search providers;
  * menu counters;
  * dashboard widgets;
  * widgets on other modules' and the platform's blades;
  * the sign-in page.

## Configuration

### Application Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `AdminShell.Menu.Global` | Json | `{}` | Global menu patch for everyone: add, rename, move, reorder or hide sections and items |
| `AdminShell.Menu.Role` | Json (per role) | `{}` | A role's menu patch; an item is hidden only if every role of the user hides it |
| `AdminShell.Menu.User` | Json (per user, hidden) | `{}` | The user's pinned and hidden items, set from the shell (and an item order, API only) |
| `AdminShell.Menu.Recent` | Json (per user, hidden) | `[]` | Usage scores behind *Recent*, recorded by the shell |
| `AdminShell.UI.Appearance` | ShortText (per user) | `dark` | Light, dark or the system's appearance; set in the user menu or the profile, and follows the user to every browser |
| `AdminShell.UI.Theme` | ShortText (per user) | `virto` | The color theme: Virto, Warm, Blue or Indigo; set like the appearance |

A setting that isn't valid JSON is ignored, so one typo can't take the menu down. See [Menu layers](docs/menu-layers.md).

### Permissions

| Permission | Description |
|------------|-------------|
| `admin-shell:access` | Open the Admin Shell and read your own menu |
| `admin-shell:menu:manage` | Read and change the global and role menu layers through the API |

## Architecture

The module hosts the Admin Shell app and composes its menu; the platform serves the app and the plugin manifest, and each module serves its own plugin:

```
┌──────────────────────────────────────────────────────────────────────┐
│  Host app (Vue 3, vc-shell) — Content/admin-shell → /apps/admin-shell │
│  layout · menu · global search · dashboard · platform screens          │
├──────────────────┬──────────────────────┬─────────────────────────────┤
│  Module plugins  │  AngularJS admin     │  Platform apps              │
│  (MF remotes)    │  (embedded frame)    │  (embedded frames)          │
├──────────────────┴──────────────────────┴─────────────────────────────┤
│  Web Layer (menu API, default menu builder, module initialization)    │
├───────────────────────────────────────────────────────────────────────┤
│  Core Layer (menu model, menu composer, settings, permissions)        │
├───────────────────────────────────────────────────────────────────────┤
│  Platform (app hosting, plugin manifest, settings, security)          │
└───────────────────────────────────────────────────────────────────────┘
```

### Startup Flow

1. The browser opens `/apps/admin-shell/`. The platform serves the host app; `index.html` isn't cached, so a new build is picked up at once.
2. The host loads the current user, installs vc-shell, the platform screens and the global search registry, and mounts.
3. In parallel it reads the plugin manifest (`GET /api/apps/admin-shell/manifest`, platform). It installs each module's plugin as soon as it loads; a failing plugin is skipped.
4. The shell loads the user's menu (`GET /api/admin-shell/menu`).
5. A deep link opened directly is applied once the plugins have registered their routes.

### Menu Composition Flow

1. `DefaultMenuBuilder` builds the default menu on every request:
   * `Content/default-menu.json`, without items of modules that aren't installed;
   * installed apps with `MainMenu` placement;
   * `contributions.menu` from each module's `plugins/admin-shell/plugin.json`.
2. `MenuComposer` applies replacements: a Vue item takes the place of the AngularJS item it `replaces`, and old ids are mapped to new ones.
3. The global patch and the role patches are applied; hiding is a union over the user's roles.
4. The user's preferences are applied; items and sections without permission are removed.
5. The result is sorted, grouped, and returned with *Pinned* and *Recent*.

## Components

### Projects

| Project | Layer | Purpose |
|---------|-------|---------|
| `VirtoCommerce.AdminShell.Core` | Core | Menu model, menu composer (pure, unit-tested), module constants, settings and permissions |
| `VirtoCommerce.AdminShell.Web` | Web | Menu API, default menu builder, settings storage, module initialization, `Content/default-menu.json` |
| `VirtoCommerce.AdminShell.Web/App` | Client | The host app: layout, menu, global search, dashboard, platform screens; built into `Content/admin-shell` |
| `VirtoCommerce.AdminShell.Tests` | Tests | Menu composition tests |

### Key Services

| Service | Responsibility |
|---------|----------------|
| `MenuComposer` | Composes the effective menu from the default menu, patches, user preferences and permissions; ranks *Recent* |
| `DefaultMenuBuilder` | Builds the default menu from `default-menu.json`, installed apps and plugin contributions |
| `AdminMenuService` | Reads and writes the menu layers in platform settings (JSON, per platform, role and user) and resolves the user's effective menu |
| `AppIndexNoCacheStartupFilter` | Serves the host's `index.html` with `Cache-Control: no-cache` |

### Client Extension Points

| Extension point | API | Guide |
|---------|-----|-------|
| Plugins | Module Federation remote in `{module}/plugins/admin-shell/` | [plugins.md](docs/plugins.md) |
| Menu contributions | `contributions.menu` in `plugin.json` | [menu-contributions.md](docs/menu-contributions.md) |
| Global search | `app.config.globalProperties.$globalSearch` | [global-search.md](docs/global-search.md) |
| Menu counters | `app.config.globalProperties.$menuCounters` | [menu-counters.md](docs/menu-counters.md) |
| Dashboard widgets | `registerDashboardWidget` | [dashboard-widgets.md](docs/dashboard-widgets.md) |
| Blade widgets | `registerExternalWidget` | [blade-widgets.md](docs/blade-widgets.md) |
| AngularJS screens | `legacy` menu targets, `$globalSearch.openLegacy` | [legacy-screens.md](docs/legacy-screens.md) |
| Embedded apps | `<app>` with `MainMenu` placement | [embedded-apps.md](docs/embedded-apps.md) |
| Sign-in page | `useExtensionPoint("auth:after-form")` | [sign-in-page.md](docs/sign-in-page.md) |

### REST API

Base route: `api/admin-shell/menu`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Get the current user's effective menu (sections, pinned, recent, hidden) |
| `GET` | `/me/prefs` | Get the current user's menu preferences |
| `PUT` | `/me/prefs` | Save the current user's menu preferences |
| `POST` | `/me/recent/{itemId}` | Record a use of a menu item for *Recent* |
| `GET` | `/default` | Get the default menu before any patch (`admin-shell:menu:manage`) |
| `GET` | `/global` | Get the global menu patch (`admin-shell:menu:manage`) |
| `PUT` | `/global` | Save the global menu patch (`admin-shell:menu:manage`) |
| `GET` | `/roles/{roleId}` | Get a role's menu patch (`admin-shell:menu:manage`) |
| `PUT` | `/roles/{roleId}` | Save a role's menu patch (`admin-shell:menu:manage`) |

## Build

* **Server:** `dotnet build`.
* **Host app:** in `src/VirtoCommerce.AdminShell.Web/App`, run `yarn install` and `yarn build:app`, then copy `dist` to `../Content/admin-shell`; vc-build's `BuildCustomApp` does this in CI.
* The host applies fixes to `@vc-shell/framework` 2.6.3-rc.0 through a Yarn patch in `App/.yarn/patches`.

## Documentation

* [Documentation index](docs/README.md)
* [Architecture overview](docs/architecture.md)
* [Technical description](docs/technical-description.md)
* [View on GitHub](https://github.com/VirtoCommerce/vc-module-admin-shell/)

## References

* [Deployment](https://docs.virtocommerce.org/platform/developer-guide/Tutorials-and-How-tos/Tutorials/deploy-module-from-source-code/)
* [Installation](https://docs.virtocommerce.org/platform/user-guide/modules-installation/)
* [Home](https://virtocommerce.com)
* [Community](https://www.virtocommerce.org)
* [Download latest release](https://github.com/VirtoCommerce/vc-module-admin-shell/releases/latest)

## License

Copyright (c) Virto Solutions LTD.  All rights reserved.

This software is licensed under the Virto Commerce Open Software License (the "License"); you
may not use this file except in compliance with the License. You may
obtain a copy of the License at http://virtocommerce.com/opensourcelicense.

Unless required by the applicable law or agreed to in written form, the software
distributed under the License is provided on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
implied.
