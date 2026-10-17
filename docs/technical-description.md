# Admin Shell — Technical Description

This document describes how the Admin Shell is built and how its parts work together. For the short version see [Architecture overview](architecture.md); for what modules can add see the [extension points](README.md#extension-points).

## 1. Repository layout

| Path | What it is |
|---|---|
| `src/VirtoCommerce.AdminShell.Core` | Menu model (`Models/MenuModels.cs`), the pure menu composer (`Services/MenuComposer.cs`), settings and permissions (`ModuleConstants.cs`). |
| `src/VirtoCommerce.AdminShell.Web` | The module: `Module.cs`, `module.manifest`, the menu API (`Controllers/Api/AdminShellMenuController.cs`), `Services/DefaultMenuBuilder.cs` and `Services/AdminMenuService.cs`, `Middlewares/AppIndexNoCacheStartupFilter.cs`, `Content/default-menu.json`. |
| `src/VirtoCommerce.AdminShell.Web/App` | The host application (Vue 3, vc-shell). Built into `Content/admin-shell`, which the platform serves at `/apps/admin-shell/`. |
| `tests/VirtoCommerce.AdminShell.Tests` | Menu composition tests (`MenuComposerTests.cs`). |
| `docs` | This documentation. |

The module has no database tables: everything it stores is in platform settings.

## 2. Server side

### 2.1 The module and the app

`module.manifest` declares the module `VirtoCommerce.AdminShell` and the app `admin-shell` (`<permission>admin-shell:access</permission>`, `<placement>AppMenu</placement>`, so it appears in the platform's Apps dropdown). The platform serves the app's static files from `Content/admin-shell` at `/apps/admin-shell/`; the module must ship that folder, or the platform refuses to start the module.

`Module.cs`:

- registers `AdminMenuService` and `DefaultMenuBuilder` (transient);
- registers `AppIndexNoCacheStartupFilter`, which sets `Cache-Control: no-cache` on `index.html` (`/apps/admin-shell`, `/apps/admin-shell/`, `/apps/admin-shell/index.html`). The hashed build assets stay cacheable, and a new build is picked up without a hard refresh. It is a startup filter because the platform registers the apps' static files before modules' `PostInitialize`;
- registers the permissions and settings below.

### 2.2 Permissions and settings

| Permission | Meaning |
|---|---|
| `admin-shell:access` | Open the Admin Shell and read your own menu. |
| `admin-shell:menu:manage` | Read and change the global and role menu layers through the API. |

| Setting (group `Admin Shell\|Menu`, JSON) | Stored for | Default | Content |
|---|---|---|---|
| `AdminShell.Menu.Global` | the platform | `{}` | Global menu patch (`MenuPatch`). |
| `AdminShell.Menu.Role` | each role (`Role` tenant) | `{}` | The role's menu patch (`MenuPatch`). |
| `AdminShell.Menu.User` (hidden) | each user (`UserProfile` tenant) | `{}` | Pinned, hidden and ordered items (`UserMenuPrefs`). Hidden so the AngularJS profile save can't overwrite it. |
| `AdminShell.Menu.Recent` (hidden) | each user | `[]` | Usage scores for *Recent* (`RecentUse[]`). |
| `AdminShell.UI.Appearance` | each user | `dark` | `system`, `light` or `dark`. |
| `AdminShell.UI.Theme` | each user | `virto` | `virto`, `warm`, `blue` or `indigo`. |

A setting that isn't valid JSON is treated as empty and doesn't take the menu down. Writes of the user's settings are serialised per user with a distributed lock.

### 2.3 Menu API

`api/admin-shell/menu` (`AdminShellMenuController`):

| Verb and route | Permission | Purpose |
|---|---|---|
| `GET /` | `admin-shell:access` | The effective menu of the current user: `{ sections, pinned, recent, hidden }`. |
| `GET /me/prefs`, `PUT /me/prefs` | `admin-shell:access` | The user's own pins, hidden items and order. |
| `POST /me/recent/{itemId}` | `admin-shell:access` | Records a use of a menu item (for *Recent*). |
| `GET /default` | `admin-shell:menu:manage` | The default menu before any patch. |
| `GET /global`, `PUT /global` | `admin-shell:menu:manage` | The global patch. |
| `GET /roles/{roleId}`, `PUT /roles/{roleId}` | `admin-shell:menu:manage` | A role's patch. |

There is no UI for the global and role layers yet; they are managed through this API or the platform settings. See [Menu layers](menu-layers.md).

### 2.4 How the menu is built

**Default menu** (`DefaultMenuBuilder.Build`, rebuilt on every request):

1. `Content/default-menu.json` — the sections and the items of the AngularJS screens, platform screens and known apps. An item whose `moduleId` isn't installed is dropped.
2. Installed platform apps with `<placement>MainMenu</placement>` that the seed doesn't place itself are added to the *Apps* section (`app.{appId}`).
3. Every module whose `plugins/admin-shell/` has both `plugin.json` and `remoteEntry.js` adds the items of `contributions.menu`. See [Menu contributions](menu-contributions.md).

**Effective menu** (`MenuComposer.Compose`, a pure function covered by tests):

1. Replacements: an item with `replaces` takes the replaced item's section, priority and group, and the replaced item is removed. Old ids are mapped to new ones, so patches, pins, hidden items and *Recent* recorded on the AngularJS item follow the Vue screen.
2. Global patch.
3. Role patches, one per role of the user, in role-name order. A section or item is hidden only if every role hides it.
4. User preferences: hidden items, item order per section.
5. Permissions: items and sections the user may not open are removed, then empty sections.
6. Sorting by priority, then title; groups assigned; `pinned` and `recent` resolved against the visible items.

*Recent* ranks items by uses: each use adds 1, and a score halves every 7 days; the 30 most used items are kept. Items of the Home section aren't tracked.

### 2.5 Plugin manifest (platform)

The plugin list doesn't come from this module. The platform's `GET /api/apps/admin-shell/manifest` returns the plugins of all installed modules: for each module it probes `{moduleRoot}/plugins/admin-shell/` and includes the plugin when its entry file (`remoteEntry.js`) exists. The response carries each plugin's entry path with a `hash` (the file's write time) used for cache busting, and the remote's name and exposed module from `plugin.json`. The descriptor is cached; `POST /api/apps/manifest/invalidate` (permission to manage modules) refreshes it without a restart. See [Plugins](plugins.md).

## 3. Client side (host application)

### 3.1 Stack

Vue 3.5, vue-router 5 (hash history under `/apps/admin-shell/`), `@vc-shell/framework` 2.6.3-rc.0 with a Yarn patch (`App/.yarn/patches`: login redirect, empty user as signed out, blade/toolbar/table fixes), `@vc-shell/mf-host` for Module Federation, Tailwind with the `tw-` prefix.

### 3.2 Startup (`App/src/main.ts`)

1. `shell/deepLink` captures the requested hash before the router changes it.
2. `shell/dashboard` registers the host's dashboard widgets.
3. The current user is loaded.
4. The app is created with vc-shell (`VirtoShellFramework`), the host's platform screens (`PlatformModule`), the global search and menu counter registries (`installGlobalSearch`, `installMenuCounters`) and the router; the host's locales are merged.
5. `registerRemoteModules(app, { router, appName: "admin-shell" })` starts loading the plugins (not awaited).
6. The router is ready → the app mounts.

Plugins load in parallel with the first render. Each is installed as soon as its remote resolves, with `app.use(plugin, { router })`. When all have loaded, `ModulesReadyKey` becomes `true`; `App.vue` then re-opens the requested deep link, now that the plugins' routes exist. A plugin that fails is logged and skipped; the others still load. If the manifest request fails (401, 404, 5xx), the shell runs without plugins and logs a warning; an unexpected error while loading shows vc-shell's *Unable to load application modules*.

### 3.3 Layout

`App.vue` replaces vc-shell's layout with the shell's own (`ShellLayout`):

- **Desktop:** a rail of sections (`ShellNav`), a collapsible panel with the section's items in groups, *Pinned* and *Recent*, and a header (`ShellHeader`) with the breadcrumbs of the open blades and the search box. The panel state is kept in local storage.
- **Phone:** a top bar (logo, title of the top blade, search, menu with the total of the counters) and a drawer with the menu. The search opens as a full-screen sheet.
- **Environment ribbon:** the environment in a corner ribbon (a tag at the top on phones), read from the host name with the AngularJS admin banner's rules: Development (`localhost`, an IP, `*dev*`), QA (`*qa*`, `*test*`), UAT (`*stage*`, `*uat*`), Demo (`*demo*`), Production (`*prod*`), or the host name itself. Each has its color (amber, blue, purple, teal, red; gray for other hosts) at 70%; Production carries a pulsing dot.
- **User menu** (avatar): license status, language, appearance (light, dark, system), theme (Virto, Warm, Blue, Indigo), *Classic admin*, profile, sign out, platform version.

### 3.4 Routing and menu targets

| Route | Name | Shows |
|---|---|---|
| `#/` | `Home` | The dashboard. |
| `#/<blade url>` | (vc-shell) | Vue workspaces declared with `defineBlade({ url, isWorkspace: true })` by the host's platform screens and by plugins (`/security`, `/orders`, …). |
| `#/legacy?url=/workspace/…` | `Legacy` | The AngularJS admin on that state. |
| `#/app/:appId?path=…` | `EmbeddedApp` | A platform app in an iframe. |
| `#/login`, `#/invite`, `#/resetpassword`, `#/forgot-password`, `#/changepassword` | | Sign-in and account pages. |

`useAdminMenu.routeFor(item)` maps a menu item's target to a route: `vue` → the route, `legacy` → `Legacy` with `url`, `app` → `EmbeddedApp`, `url` → a new browser tab. Opening an item records a use for *Recent*.

### 3.5 The embedded AngularJS admin (`shell/LegacyHost.vue`)

One iframe for the whole session, created the first time an AngularJS screen opens: `/?EmbeddedMode=true#!{url}`, same origin. It is laid over the workspace and hidden (not unloaded) when a Vue screen is shown, so the classic admin starts once and keeps its state. Opening another screen changes the frame's hash; opening the current one again reloads its state, which reopens it from its root blade. The shell can drive it through the AngularJS injector (see [AngularJS screens](legacy-screens.md)).

### 3.6 Embedded apps (`pages/FramePage.vue`)

Platform apps (Tasks, News, …) load in an iframe: `/apps/{appId}/#{path}?EmbeddedMode=true`. For same-origin vc-shell apps the shell injects a style that copies its colour variables and theme, and hides the app's own navigation when the menu item lists the app's pages as children. Sites that refuse framing are `url` items and open in a new tab. See [Embedded apps](embedded-apps.md).

### 3.7 Platform screens (`App/src/modules/platform`)

A vc-shell app module (`defineAppModule({ blades, locales })`) with the platform's screens: Settings, Security (users with their API keys and sessions, roles, OAuth apps, sign-in log), Modules, Dynamic properties, Developer tools, License, User profile. Shared helpers: `composables/blade.ts` (form with close confirmation, Save/Reset/Refresh toolbar items) and `composables/list.ts` (searchable paged list, `PAGE_SIZE = 20`). These blades publish their item with `defineBladeContext`, so modules can add widgets to them.

### 3.8 Global search (`shell/search`)

A registry of search providers exposed to plugins as `app.config.globalProperties.$globalSearch` (and `inject("adminShell.globalSearch")`), with the header box, the phone sheet and helpers to open results in Vue or AngularJS screens. See [Global search](global-search.md).

### 3.9 Dashboard (`pages/Dashboard.vue`, `shell/dashboard`)

vc-shell's `DraggableDashboard` (Gridstack, 12 columns) with the widgets registered by the host and by plugins. The layout is saved per browser (`localStorage["vc-dashboard-layout"]`). The host adds:

- **Compaction after the user's own moves:** widgets close up in reading order.
- **Reset layout:** the default positions are applied all at once, in a fresh grid.

On a phone the widgets are stacked. See [Dashboard widgets](dashboard-widgets.md).

### 3.10 Theme, styles and locales

- **Appearance** (user menu and profile): `system`, `light` or `dark` (default `dark`); vc-shell sets `data-theme` on `<html>`.
- **Kept in the user's profile:** appearance, theme (the module's `AdminShell.UI.*` user settings) and language (the platform's `VirtoCommerce.Platform.UI.Language`, shared with the AngularJS admin) are read after sign-in and saved on change through the platform's Settings v2 "me" values (`shell/themeMode.ts`), so they follow the user to every browser and device. `localStorage` (`adminShell.theme`, `adminShell.colorTheme`, vc-shell's language) keeps a copy for the sign-in page and the first paint; the profile wins over it. The profile blade lists the three with the platform's other preferences and saves only its own fields.
- **Theme** (user menu after Appearance, and profile): Virto (default), Warm, Blue or Indigo; `data-color-theme` on `<html>`. `styles/_themes.scss` turns each palette (surfaces, lines and inks from the AngularJS admin's modern look, vc-platform PR 3134) into the shell's `--as-*`, `--color-*` and vc-shell's palette, in light and dark. The state colors stay the shell's in every theme, and no primary takes a state's hue (Warm's red-orange became an espresso brown).
- **Design tokens** (`styles/_tokens.scss`): global CSS variables (`--color-{primary…info}-50…950`, `--fg-*`, `--bg-*`, `--border-*`) with dark overrides. Plugins use them.
- **Dashboard classes** (`styles/custom.scss`, `.dash-*`): shared by the host's and the plugins' widgets.
- **Shell-private styles** (`.as-*`, `styles/_shell.scss`) are not an API.
- **Locales:** the host's (`SHELL.*`, `PLATFORM.*`) and each plugin's (through `defineAppModule({ locales })`) are merged into one i18n. A locale that defines `language_name` appears in the language picker.

### 3.11 Menu counters (`shell/menuCounters.ts`)

A registry of counters per menu item, exposed to plugins as `app.config.globalProperties.$menuCounters` (and `inject("adminShell.menuCounters")`). Orders, Return, Quote and Customer Reviews register theirs from their plugins; the shell registers the one of its own Tasks item. The shell asks the counters of the items in the user's menu (with the counter's permission) once the menu arrives, after plugins register, every 60 s while the tab is visible and again when it becomes visible; a superseded round is aborted. See [Menu counters](menu-counters.md).

### 3.12 Sign-in and deep links

The shell has its own sign-in page (`pages/Login.vue`, `AuthShell`, `AuthShowcase`): password and external providers, and the `auth:after-form` extension point. A link opened while signed out returns to its page after sign-in (`redirectAfterLogin`, same-site paths only). A deep link (`#/orders/…`) opened directly waits for the plugins to register their routes before it is applied.

## 4. Build, packaging and deployment

| Part | Build | Output |
|---|---|---|
| Server | `dotnet build`; `vc-build Compile`, `Test`, `Compress` in CI | The module package. |
| Host app | in `App/`: `yarn install`, `yarn build:app`; copy `dist` to `Content/admin-shell` (vc-build's `BuildCustomApp` does it in CI) | `Content/admin-shell/` (git-ignored). |
| A module's plugin | in `{module}.Web/vue/`: `yarn install`, `yarn build`; the module's `.csproj` runs it before publish, so `vc-build Compress` packs it (`SkipAdminShellPlugin=true` leaves it out) | `{module}.Web/plugins/admin-shell/` → `{module}/plugins/admin-shell/` in the package. |

**Local check on a running platform:** copy the built host into `modules/VirtoCommerce.AdminShell/Content/admin-shell` and a plugin into `modules/{Module}/plugins/admin-shell`. Neither needs a restart: `index.html` isn't cached, the menu is rebuilt per request, and the manifest is rebuilt per request in Development (otherwise call the invalidate endpoint).

## 5. Testing

- Server: `tests/VirtoCommerce.AdminShell.Tests` covers menu composition (layers, role union, replacements, pins and *Recent* following a replacement, invalid JSON).
- Client: `yarn type-check` in `App/` and in each plugin.
- In the browser: the global search can be driven from the console (see [Global search — Testing a provider](global-search.md#testing-a-provider)); check screens on desktop and at phone width, in light and dark themes.
