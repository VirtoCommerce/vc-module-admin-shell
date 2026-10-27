# Admin Shell Documentation

## Start here

| Document | For | What it covers |
|---|---|---|
| [Admin UI requirements](admin-ui-requirements.md) | product owners, architects, anyone building a new admin UI | What the platform admin UI must do, whatever it is built with: roles, scenarios, pages, the shell, the extension contract modules rely on, APIs and quality requirements. |
| [Architecture overview](architecture.md) | everyone | What the Admin Shell is and the ideas it is built on, in one page. |
| [Technical description](technical-description.md) | developers | The server and client parts, startup, routing, menu composition, build and deployment. |
| [White-labeling](branding.md) | administrators, developers | Three levels of branding for a customer: name, logos and links (settings); the sign-in page and Home (settings with content); a custom color theme (theme files). Requirements, steps and testing. |
| [Localization](localization.md) | developers, translators | The 13 languages, where each screen's texts come from, how to add a language or a text, the translation check. |
| [Settings](settings.md) | developers | The Settings screen (tree, properties edited in place, deep links, phone layout), the settings store and the user's preferences, all on the platform's Settings v2 API. |

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
| Menu editor UI | API and settings only | — |
