# Admin Shell Documentation

## Start here

| Document | For | What it covers |
|---|---|---|
| [Architecture overview](architecture.md) | everyone | What the Admin Shell is and the ideas it is built on, in one page. |
| [Technical description](technical-description.md) | developers | The server and client parts, startup, routing, menu composition, build and deployment. |

## Extension points

What modules, system integrators and customers can add or change without changing the shell. Each guide follows the same outline: overview, quick start, reference, guidelines, testing.

| Extension point | Who uses it | How | Guide |
|---|---|---|---|
| Plugins | module developers | A Module Federation remote in `{module}/plugins/admin-shell/`: the way in for everything below | [plugins.md](plugins.md) |
| Menu contributions | module developers | `contributions.menu` in `plugin.json`; `replaces` takes over an AngularJS item | [menu-contributions.md](menu-contributions.md) |
| Menu layers | system integrators, customers, users | Global and role patches in platform settings / API; each user's pins and hidden items | [menu-layers.md](menu-layers.md) |
| Global search | module developers | `$globalSearch.registerProvider` | [global-search.md](global-search.md) |
| Menu counters | module developers | `$menuCounters.register` | [menu-counters.md](menu-counters.md) |
| Dashboard widgets | module developers | `registerDashboardWidget`, shared `.dash-*` styles | [dashboard-widgets.md](dashboard-widgets.md) |
| Blade widgets | module developers | `registerExternalWidget` on another module's or the platform's blades | [blade-widgets.md](blade-widgets.md) |
| AngularJS screens | module developers | `legacy` menu targets, the `Legacy` route, `$globalSearch.openLegacy` | [legacy-screens.md](legacy-screens.md) |
| Embedded apps | module developers | `<app>` with `MainMenu` placement; `app` and `url` menu targets | [embedded-apps.md](embedded-apps.md) |
| Sign-in page | module developers | `useExtensionPoint("auth:after-form")` | [sign-in-page.md](sign-in-page.md) |

## Not extensible yet

| Part | Today | Possible next step |
|---|---|---|
| User menu, header, layout | Fixed | — |
| Branding | Static logos and product name in the host | — |
| Menu editor UI | API and settings only | — |
