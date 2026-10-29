# Platform Admin UI — Requirements

## 1. Purpose and scope

This document defines what the Virto Commerce **platform admin UI** must do, independent of the technology it is built with. The current implementation is the Admin Shell (Vue 3 and vc-shell, this repository). A future implementation, for example in React, is complete when it meets every **MUST** below and keeps the extension contract (section 8) so existing modules keep working.

In scope:

- **The shell:** signing in, the layout, navigation, search, notifications, the dashboard, user preferences, branding.
- **The platform's own screens:** Settings, Security, Modules, Dynamic properties, License, Developer tools, User profile.
- **The host for module UIs:** how modules add screens, menu items, widgets, search results and counters, and how screens not yet migrated from the AngularJS admin keep working.
- **Quality:** security, accessibility, responsiveness, localization, theming, performance, operation without internet.

Not in scope: the business screens of modules (Catalog, Orders, …). They are plugins; this document only requires the host to support them.

**Keywords.** MUST: required for a conforming implementation. SHOULD: expected unless there is a documented reason. MAY: optional. Requirements are numbered (`NAV-3`) so tests, tickets and reviews can refer to them.

## 2. Principles

| # | Principle |
|---|---|
| P-1 | **The server is the source of truth.** Menus, settings, permissions, preferences and branding come from platform APIs. The UI keeps no state that matters only in the browser; browser storage is a cache or a per-device convenience. |
| P-2 | **Permissions are enforced by the server.** The UI hides what a user may not do, but never relies on hiding for security. |
| P-3 | **Modular.** The UI knows the platform; modules bring their own screens. The shell never contains a module's business code. |
| P-4 | **One URL per place.** Every screen, record and settings group has a URL that can be bookmarked, shared and reopened in another browser. |
| P-5 | **Coexistence.** Screens not migrated from the AngularJS admin open inside the new UI, with the same session, until they are replaced. |
| P-6 | **No customer code.** Branding and customization are configuration (settings, files), never a fork of the UI. |
| P-7 | **Works everywhere.** Desktop and phone, light and dark, keyboard and screen reader, and on a private network without internet. |

## 3. Roles

Roles are personas. Access is granted by platform permissions assigned through roles; one person may have several personas.

| Role | Responsibilities in the admin UI | Typical permissions |
|---|---|---|
| **Business user** (merchandiser, order manager, marketer, support agent) | Daily work in module screens: catalogs, orders, customers, promotions. Uses search, the dashboard, notifications and menu counters to find work. | Module permissions; allowed by the platform's `PlatformUI:Access` policy |
| **Platform administrator** | Configures the platform: settings, modules, license, dynamic properties, cache; watches background jobs and the environment. | `platform:setting:*`, `platform:module:*`, `platform:dynamic_properties:*`, `cache:reset` |
| **Security administrator** | Manages users, roles, permissions with scopes, API keys, OAuth applications, sessions; audits sign-ins and changes. | `platform:security:*`, `platform:security:sign_in_log:read` |
| **Developer / integrator** | Explores APIs and tools, creates API keys and OAuth apps for integrations, reads logs and diagnostics. | `platform:developer-tools:access`, `platform:security:*` |
| **System integrator / partner** | Deploys the platform for a customer: installs modules, brands the UI, sets menu layers per role. | `admin-shell:menu:manage`, `platform:setting:update`, `platform:module:manage` |
| **Module developer** | Extends the UI from a module: screens, menu items, widgets on other blades, search providers, dashboard widgets, counters. | (development) |
| **Customer IT / operator** | Runs the platform on-premises or in a private network; needs the UI to work offline, behind SSO and with its own brand. | `platform:setting:update` |

## 4. Responsibilities of the admin UI

The admin UI MUST provide these capabilities. Sections 5–9 detail them.

| # | Capability |
|---|---|
| R-1 | Authenticate users (password, a second factor when the platform asks for one, external providers, password flows) and keep the session. |
| R-2 | Present a navigation built from the platform, modules and layers (global, role, user), filtered by permissions. |
| R-3 | Host screens as blades in a workspace with stable URLs, and guard unsaved changes. |
| R-4 | Find anything from one search box: screens, settings, records from modules. |
| R-5 | Show notifications, background job progress and counters of pending work. |
| R-6 | Give each user a dashboard of widgets from the platform and modules. |
| R-7 | Provide the platform administration screens (section 6.2). |
| R-8 | Keep user preferences (language, regional format, time zone, appearance, theme, menu pins) in the user's profile. |
| R-9 | Load module UIs at runtime and offer them the extension points (section 8). |
| R-10 | Embed screens of the AngularJS admin and external apps until they are replaced. |
| R-11 | Apply the installation's branding without code changes. |
| R-12 | Show the environment (development, staging, production) and the platform's build and license. |

## 5. Scenarios

Each scenario lists its acceptance criteria. Together they are the acceptance test of an implementation.

**S-01 Sign in.** A user opens the admin and signs in with user name and password, or with an external provider (Google, Microsoft, others configured on the platform).
- The sign-in page shows the installation's brand (logo, name, links) and works on a phone.
- A wrong password shows an error without revealing whether the user exists; a locked account is reported as locked.
- After signing in, the user lands on the page they asked for (a deep link), else Home.
- Sign-out returns to the sign-in page and asks first if a blade has unsaved changes.

**S-02 Password flows.** Forgot password (email link), reset password (token link), accept an invitation (token link), and a forced password change (expired or temporary password) MUST work from the email links, inside the branded sign-in layout.

**S-03 Find anything.** A user presses Ctrl+K (⌘K) or taps search on a phone, types two letters and gets ranked results grouped by kind (menu items, settings, users, roles, module records). Enter opens the result in its screen. Aliases narrow the search ("setting smtp").

**S-04 Open a shared link.** A user opens a URL a colleague sent (a record, a settings group). After signing in if needed, the same screen opens on the same record. If they lack permission, an "access denied" message shows instead of an empty screen.

**S-05 Change settings.** An administrator finds a setting by browsing groups or by searching its name, title or value. They edit it in place, see which settings differ from defaults and which are unsaved, and save, reset one or reset all. They can export modified settings to JSON, import them in another environment, or edit them as JSON. Settings that need a restart are marked.

**S-06 Add a user.** A security administrator creates a user (name, email, type), assigns roles, sends an invitation or sets a password, and can later lock or unlock the user, verify their email, reset their password, see their API keys, sessions, changes and sign-ins, and terminate sessions.

**S-07 Create a role with scoped permissions.** A security administrator creates a role, picks permissions grouped by module, limits some to scopes (a store, a catalog, …), and assigns the role to users. Removing a permission takes effect for every user of the role.

**S-08 Integrate a system.** A developer generates an API key for a technical user, or registers an OAuth application (client id, secret, grant types). Secrets are shown once.

**S-09 Audit sign-ins.** A security administrator filters the sign-in log by outcome, sign-in type, user and date, opens a record, and sees statistics on the dashboard.

**S-10 Install or update modules.** An administrator browses installed, available and updatable modules, reads a module's details (version, dependencies, release notes), installs, updates or uninstalls one or several. Dependencies are added automatically and listed before confirming. Progress shows live; the platform restart is requested and the UI reconnects after it.

**S-11 Activate a license.** An administrator sees the current license (type, owner, expiration, community/expired state) and activates a new one with an activation code (online) or a license file (offline), reviewing it before confirming.

**S-12 Extend data with dynamic properties.** An administrator picks an object type (Product, Customer, Order, …), adds properties (type, multilingual, multi-value, dictionary), and edits dictionary values with translations.

**S-13 Personalize.** A user changes language, regional format, time zone, relative dates, appearance (system, light, dark) and color theme; pins menu items and hides others; rearranges dashboard widgets. The choices follow the user to another browser and device.

**S-14 See pending work.** Menu items show counters (new orders, returns requested, …) refreshed periodically. Notifications for finished imports, exports and jobs appear in the bell, with progress for running ones.

**S-15 Work on a phone.** All scenarios above are possible on a 360 px wide phone: a top bar with the menu, search and notifications; one blade at a time with a back path; toolbar actions in an action button.

**S-16 Use a screen not migrated yet.** A user opens a menu item backed by the AngularJS admin; it opens inside the shell with the same session, and navigation, search and deep links keep working. When a module ships a new screen that replaces the item, the menu switches to it without configuration.

**S-17 Brand the admin.** A partner sets the company name, logos, links, sign-in slides, a Home welcome card and a custom color theme (section 7.9), without rebuilding the UI.

**S-18 Configure the menu for roles.** A partner hides, renames or moves menu items for everyone (global layer) or for a role, and adds links to external tools. Users still pin and hide items for themselves.

**S-19 Work in a private network.** With no internet access, the admin loads, signs in and works completely: no fonts, scripts, styles or images are fetched from outside the platform.

**S-20 Explore the API.** A developer opens Developer tools and uses the platform's API explorers inside the admin or in a new tab.

**S-21 Sign in with a second factor.** Multi-factor authentication is on (vc-module-mfa, `MultiFactorAuthentication.Enabled`). A user enters their user name and password; the admin asks for the one-time code sent to their email, showing where it went (masked). They enter the code and land where S-01 says.
- A wrong code shows an error and lets them try again; after too many wrong codes, an expired step or a locked account, the admin says so and offers only "Back to sign in".
- "Resend code" is offered after the wait the platform reports, with a countdown, and confirms that a new code was sent.
- The step works on a phone, in every language (right-to-left included), and with the keyboard and a screen reader; the phone offers the code from the email or SMS (one-time-code autofill).
- With MFA off, or for external providers, nothing changes: the user goes straight in.

## 6. Pages

### 6.1 Shell pages

| Page | Requirements |
|---|---|
| **Sign in** | Password form; one button per external provider configured on the platform; forgot-password link; branding (logo, name, footer links, side panel); theme switch; error messages; works without the side panel below 1024 px. |
| **Sign-in code (second factor)** | Shown after a correct password when the platform asks for a second factor (section 7.10); same layout as sign-in; the masked destination, the code field, resend with countdown, back to sign in; clear error states. |
| **Forgot / reset password, invitation, forced change** | Reached from email links with user and token in the URL; same layout as sign-in; clear success and error states. |
| **Home (dashboard)** | Widget grid from the platform and modules; drag, resize, keyboard move; layout per user with reset; optional welcome card from branding. Each widget handles its own loading, empty and error state. |
| **Legacy host** | Shows an AngularJS admin screen by its state in an embedded frame on the same origin, keeps the frame alive between visits, mirrors the screen into the URL. |
| **Embedded app** | Shows an app registered with the platform (`<app>` in a module manifest) inside the shell, or opens it in a new tab. |
| **User profile** | Language, regional format, time zone, relative dates and threshold, appearance, theme; change password; saved in the user's profile. |
| **Access denied / not found** | A message with a way back; never an empty screen. |

### 6.2 Platform screens

All are blades in the workspace with a URL, and require the permission listed.

| Area | Blade | Permission | Must provide |
|---|---|---|---|
| **Settings** | Settings (workspace) | `platform:setting:access` | Group tree with counts; settings of a group edited in place with editors per type (text, number, boolean, date, select, JSON, secure, dictionary); markers for modified and unsaved; reset to default; search by name, title, group, value; filters (modified, module, tenant settings); save, reset, refresh, export JSON, import JSON, reset cache; URL keeps the group (`?group=`) and a setting (`?setting=`); phone layout (tree, then group). |
| | Dictionary values | `platform:setting:access` | Allowed values of a dictionary setting, with translations when localizable. |
| | Edit as JSON | `platform:setting:access` | The modified settings as one document; saving replaces them. |
| **Security** | Security (workspace) | `platform:security:access` | Entry to users, roles, OAuth apps, sign-in log. |
| | Users | `platform:security:access` | Search; filters (type, status, role, flags, last sign-in); add; delete selected. |
| | User details | `platform:security:access` | Create and edit (name, email, type, roles, flags); change password; lock, unlock; verify email; delete; open API keys, sessions, changes and sign-in log of the user. |
| | Password | `platform:security:update` | Set or reset a user's password with the platform's rules. |
| | API keys | `platform:security:access` | Generate, show once, delete. |
| | Sessions | `platform:security:access` | Active sessions; terminate one or all. |
| | Changes | `platform:security:access` | The change log of the user record. |
| | Roles, role details | `platform:security:access` | Search, add, delete; edit name and description; assign and remove permissions. |
| | Permission picker, scopes | `platform:security:update` | Permissions grouped by module; scopes per permission (store, catalog, …). |
| | OAuth apps, details | `platform:security:access` | Register, edit, delete client applications; secrets shown once. |
| | Sign-in log, record | `platform:security:sign_in_log:read` | Search with outcome, type, user, date filters; record details; statistics for the dashboard. |
| **Modules** | Modules (workspace) | `platform:module:access` | Installed, browse all, not installed, updates, with errors; group filter; select several to install, update, uninstall. |
| | Module details | `platform:module:access` | Version, latest version, required platform, authors, license, dependencies (required and optional), release notes; install, update, uninstall. |
| | Progress | `platform:module:manage` | Live progress and log; restart the platform; reconnect afterwards. |
| **Dynamic properties** | Dynamic properties (workspace) | `platform:dynamic_properties:access` | Laid out as Settings: the object types as a tree by module (Orders › Customer order) with property counts, and the properties of the chosen module or type as cards with their value type and flags; search over names, display names, descriptions and value types; Required, Dictionary, Multilingual, Multivalue and With properties filters. Types without properties are a row of chips under a module or All; one chosen on its own offers Add property. On a phone, the tree, then the properties. |
| | Property details | `platform:dynamic_properties:access` | Add, edit (type, multi-value, multilingual, dictionary, display names), delete; opens beside the list from a card or Add property. |
| | Dictionary | `platform:dynamic_properties:access` | Dictionary items with translations. |
| **License** | License (workspace) | `platform:module:manage` | Current license state; activation by code or by file with review. |
| **Developer tools** | Developer tools (workspace) | `platform:developer-tools:access` | The platform's tools (API explorers) inside the admin or in a new tab. |

## 7. Shell requirements

### 7.1 Layout

- **LAY-1** MUST have, on desktop (1024 px and wider): a rail of sections, a panel with the section's items, a header with search, and a workspace of blades.
- **LAY-2** Below 1024 px MUST switch to the phone layout: a top bar (logo, title, search, menu), the navigation in a drawer, one blade at a time with a back path, toolbar actions in a floating action button.
- **LAY-3** The panel SHOULD fold to the rail and remember the choice per user.
- **LAY-4** MUST show an environment ribbon on non-production hosts (development, test, staging, demo) and MAY show one on production.

### 7.2 Navigation and menu

- **NAV-1** The menu MUST be composed on the server, in this order: the default menu (platform and modules' contributions) → global patch → role patches (an item stays visible if any of the user's roles keeps it) → the user's own pins and hidden items. Then it is filtered by the user's permissions.
- **NAV-2** Item targets MUST include: a UI screen (route), an AngularJS screen (state), an embedded app, and an external URL (new tab).
- **NAV-3** A module's item that `replaces` an AngularJS item MUST take its place, its pins and its recent uses.
- **NAV-4** Home MUST show the user's recent places, ranked by use with decay over time (current: 30 kept, half-life 7 days).
- **NAV-5** Users MUST be able to pin, unpin and hide items, and restore hidden ones.
- **NAV-6** Items MAY show counters (8.5); a section shows the sum of its items.

### 7.3 Blades and URLs

- **BLD-1** Screens MUST open as blades: a workspace blade per area, child blades to its right, the last one active. On a phone, only the last one shows.
- **BLD-2** The URL MUST encode the workspace, the open blades with their record ids, and query state (a settings group, a filter), so a URL reopens the same view (P-4).
- **BLD-3** Closing a blade, navigating away, signing out or reloading with unsaved changes MUST ask for confirmation.
- **BLD-4** Blades SHOULD support maximizing and MUST show a loading state, errors in place, and a banner for messages.
- **BLD-5** Toolbar buttons MUST distinguish enabled and disabled by more than color (current: enabled actions on a tile, disabled faded with a not-allowed pointer) and carry `aria-disabled`.

### 7.4 Search

- **SRC-1** One search box (Ctrl+K / ⌘K, a sheet on phones) MUST query all registered providers in parallel, rank the results, group them by provider, and let the keyboard move and open them.
- **SRC-2** The shell MUST provide menu items, settings, users and roles; modules add their own (8.4).
- **SRC-3** A slow or failing provider MUST NOT block the others.

### 7.5 Notifications and jobs

- **NOT-1** MUST receive push notifications from the platform (real time) and show them in a bell with an unread count.
- **NOT-2** MUST show the progress of running background jobs (imports, exports, module installs) and the result when they finish.

### 7.6 Dashboard

- **DSH-1** MUST show a grid of widgets registered by the shell and modules, each with a declared default size and position and an optional permission.
- **DSH-2** Users MUST be able to move and resize widgets (mouse and keyboard) and reset the layout.
- **DSH-3** The shell provides: alerts and notifications, recent activity, sign-in activity.

### 7.7 User menu and preferences

- **USR-1** The avatar menu MUST show the user, their license state, language, appearance (system, light, dark), color theme, Help and Support links when configured, the classic admin link while AngularJS screens exist, Profile, Sign out, and the platform build.
- **USR-2** Preferences MUST be saved in the user's profile on the server (Settings v2 "me" values) and applied on any device; the browser keeps only a copy for the first paint.

### 7.8 Localization and formats

- **I18N-1** All UI text MUST come from translation resources; modules add theirs.
- **I18N-2** Setting titles and descriptions MUST come from the platform's translations, falling back to display names.
- **I18N-3** Dates and numbers MUST follow the user's regional format and time zone, with relative dates ("5 minutes ago") up to a user-chosen threshold.

### 7.9 Branding (white-labeling)

- **BRD-1** MUST read the brand from one anonymous endpoint at startup and apply it to the sign-in pages too.
- **BRD-2** Low effort, MUST support: company name, logo (light and dark), square mark, tab icon, Help, Support, Privacy and Terms links, default appearance and theme, and a switch that enforces the default theme.
- **BRD-3** Medium effort, MUST support: the sign-in side panel (default slides, the company's slides, or none) and a Home welcome card, with texts per language.
- **BRD-4** High effort, MUST support: color themes from files on the server (a palette for light and dark over a built-in base), validated so no arbitrary CSS can be injected.
- **BRD-5** Links and images from the brand MUST be limited to `https:`, `http:`, `mailto:` and same-site paths.

See [branding.md](branding.md).

### 7.10 Sign-in and multi-factor authentication

The admin that the platform serves as the main admin owns signing in: its sign-in page is the one users see, and every other UI on the platform (the AngularJS admin in a frame, embedded apps) reuses the session it creates. So the main admin, whatever it is built with, MUST implement the whole sign-in, the second factor included. The platform provides the contract; the UI provides the screens.

**The contract.** Multi-factor authentication is a module (vc-module-mfa) on top of the platform's two-factor sign-in extension points (`ITwoFactorPolicy`, vc-platform#3133). The platform decides when a second factor is needed; the module sends and checks the code:

1. The password sign-in (`POST api/platform/security/login`) answers `requiresTwoFactor: true` when the password is right and a second factor is needed. The user isn't signed in yet; the platform keeps them in its two-factor cookie.
2. `POST api/mfa/signin/send` (`{ provider }`, anonymous, uses the two-factor cookie) sends a code and answers `{ succeeded, provider, providers: [{ name, destination }], resendSecondsRemaining, error: { code } }`. `destination` is already masked.
3. `POST api/mfa/signin/verify` (`{ code, provider, rememberMe }`) answers `{ succeeded, error: { code } }`. On success the platform replaces the two-factor cookie with the normal session cookie.
4. The error codes are `invalid_code` (the user may try again), `resend_too_soon` (not an error: the last code still works, wait `resendSecondsRemaining`), and the final ones `invalid_two_factor_token`, `code_attempts_exceeded`, `user_is_locked_out`, `user_is_temporary_locked_out`, `sign_in_not_allowed`, `lockout_disabled`, `mfa_provider_not_available`.

Settings, limits and wording come from the module ([vc-module-mfa README](https://github.com/VirtoCommerce/vc-module-mfa)): `MultiFactorAuthentication.Enabled` turns it on for the Backoffice, and the lifetime of the step, the resend interval and the number of attempts are the platform's configuration, not the UI's.

**Requirements.**

- **MFA-1** On `requiresTwoFactor`, the sign-in page MUST open the code step instead of showing an error, and MUST keep the user's password out of it (the step uses the two-factor cookie only).
- **MFA-2** The code step MUST request a code when it opens, show the masked destination when the module returns one, and accept six digits in a field with `inputmode="numeric"` and `autocomplete="one-time-code"`.
- **MFA-3** "Resend code" MUST wait the seconds the module reports (`resendSecondsRemaining`) with a visible countdown, then confirm the new code. `resend_too_soon` MUST NOT be shown as an error.
- **MFA-4** `invalid_code` MUST clear the field and keep the step open. Every other error code is final: the step MUST show its message and offer only "Back to sign in". Unknown codes show the generic sign-in failure.
- **MFA-5** A successful code MUST finish the sign-in exactly as a password sign-in does: the platform's `PlatformUI:Access` check first, then a forced password change if the password expired, then the deep link the user asked for (S-01), else Home. The step and the sign-in page MUST NOT be used as the deep link.
- **MFA-6** When the platform asks for a second factor but `api/mfa` doesn't exist (the module isn't installed), the step MUST say that a second sign-in step is required but not available, as the AngularJS admin does, and offer "Back to sign in".
- **MFA-7** The step MUST meet the quality requirements of the sign-in page: the brand and layout, light and dark, phone width (RSP-1), WCAG 2.2 AA (a labelled field, errors in a live region, focus moved back to the field after an error), and every language of the UI. The masked destination MUST keep its own direction inside right-to-left text.
- **MFA-8** The session after the code MUST be the platform's cookie session (SEC-1). The UI MUST NOT request a token with the password grant afterwards: with MFA on, that sign-in needs its own code, and a second email would confuse the user.
- **MFA-9** External providers and API clients are outside this step: the platform applies MFA to password sign-ins only, and the token endpoint has its own two-step grant (`two_factor_required`, then `grant_type=mfa`) for apps that use it.
- **MFA-10** The texts SHOULD be the module's (the same wording in the AngularJS admin and the main admin). A new UI MAY keep its own translations as long as every error code above has one.

**Who owns the screen.** The code step is part of the main admin, next to the sign-in page, and not a module plugin: it uses the sign-in layout, branding, language and post-sign-in routing of the shell, and it must work before any plugin has loaded. The AngularJS admin keeps the module's own screen (the state the module registers with `data.twoFactorSignIn`). Sign-in methods that modules add (passkeys) come through a plugin contract instead (EXT-14): the shell owns the screens, the plugin the browser side of its method.

## 8. Extension contract

Modules depend on these contracts; a new implementation MUST keep them, or ship an adapter, so that modules don't need to change at the same time. Each is detailed in its own guide (see [README.md](README.md)).

| # | Extension point | Contract |
|---|---|---|
| EXT-1 | **Plugins** | A module ships a UI plugin in `{module}/plugins/admin-shell/` with a `plugin.json` (remote name, exposed entry, contributions). The host lists installed plugins from the server, loads them at runtime (Module Federation today), and installs each one into the app. A plugin that fails to load MUST NOT break the shell or other plugins. |
| EXT-2 | **Screens** | A plugin registers blades by name with a URL segment, a permission list and whether it is a workspace; other code opens them by name with a record id, query and options. |
| EXT-3 | **Menu contributions** | `contributions.menu` in `plugin.json`: id, section, title, icon, route, permission, priority, and `replaces` for an AngularJS item. |
| EXT-4 | **Global search providers** | `registerProvider({ id, title, icon, order, minLength, aliases, permission, search(query, context) })`, results with title, description, icon and an open action. |
| EXT-5 | **Menu counters** | `register({ itemId, hint, permission, count({ signal }) })`, polled by the host while the tab is visible. |
| EXT-6 | **Dashboard widgets** | `registerDashboardWidget({ id, name, component, size, position, permissions })`. |
| EXT-7 | **Blade widgets** | Widgets on a module's own blades, or on blades of modules it depends on, by blade name; the blade publishes its record to widgets. |
| EXT-8 | **Shared widgets** | A module provides a widget by id; the module that owns a blade places it, with props. A placed widget shows only when its provider is installed. |
| EXT-9 | **Installed modules** | `isInstalled(id)`, `whenInstalled(id)`, `version(id)`, so plugins use optional dependencies only when present. |
| EXT-10 | **AngularJS screens** | Open an AngularJS state or blade inside the shell, and receive data from it, with the same session. |
| EXT-11 | **Embedded apps** | Apps registered in a module's manifest open inside the shell or in a tab. |
| EXT-12 | **Sign-in page** | An extension point after the sign-in form. |
| EXT-13 | **Translations and permissions** | Plugins merge their translations and check the user's permissions through the host. |
| EXT-14 | **Sign-in methods** | `$signInMethods.extend(name, { title, signInTitle, icon, signIn, createKey, createKeyTitle, describeKey, keyIcon })` adds the browser side of a method the platform lists (a passkey): its button on the sign-in page and its "Add" and key rows in the profile's sign-in methods. `signIn(parameters)` signs in with a cookie through any grant type. See [sign-in-page.md](sign-in-page.md#sign-in-methods-passkeys-and-other-module-methods). |
| EXT-15 | **Object settings** | `openBlade({ name: "PlatformObjectSettings", options: { tenantType, tenantId, mode } })` opens the settings blade for one object: `connected` edits the entity's own settings (the opening blade exposes `getEntitySettings` and `applyEntitySettings`, its entity saves them), `disconnected` reads and saves through the tenant settings API. See [object-settings.md](object-settings.md). |

**Dependency rule.** A plugin MAY reference another module's blades, routes, API or widgets only when its `module.manifest` depends on that module, directly or transitively, or declares it as an optional dependency and checks EXT-9 before using it. A module MUST NOT place UI on blades of modules that depend on it; it provides a shared widget instead (EXT-8). An implementation SHOULD verify this rule in CI from the manifests.

## 9. Server APIs used by the UI

The UI MUST use only platform and module APIs; it has no server of its own beyond the Admin Shell module.

| Area | API |
|---|---|
| Session | Platform sign-in (cookie), current user, external sign-in providers, password and invitation flows |
| Second factor | `POST api/mfa/signin/send`, `POST api/mfa/signin/verify` (vc-module-mfa, anonymous, two-factor cookie; section 7.10) |
| Sign-in methods | `GET api/platform/security/sign-in-methods` (anonymous), `GET api/platform/security/currentuser/sign-in-methods`, `PUT`/`DELETE …/currentuser/sign-in-methods/{name}/keys/{id}`, `POST api/platform/security/sign-in` (cookie, any grant type), `POST …/currentuser/changepassword` (sets a password when there is none); passkeys: `api/passkeys` (vc-module-passkeys) |
| Menu | `GET api/admin-shell/menu` (effective menu), `me/prefs`, `me/recent/{itemId}`, global and role layers (`admin-shell:menu:manage`) |
| Branding | `GET api/admin-shell/branding` (anonymous) |
| Plugins and apps | `GET api/apps/admin-shell/manifest` (plugins), `api/platform/apps` |
| Settings | `api/platform/settings/v2/global/{schema,values}`, `…/me/values`, dictionary values |
| Profile | `api/platform/profiles/currentuser`, localization (`api/platform/localization`, locales, regional formats) |
| Security | users, roles, permissions, API keys, OAuth apps, sessions, change log, sign-in log (`api/platform/security/…`) |
| Modules and license | modules (list, install, update, uninstall, progress, restart), licensing (activate), system info |
| Other | dynamic properties, diagnostics, developer tools, push notifications (SignalR), cache reset |

## 10. Quality requirements

### Security

- **SEC-1** Authentication MUST use the platform's cookie session; tokens MUST NOT be kept in browser storage.
- **SEC-2** Every action MUST be checked by the server; the UI hides what the user may not do (P-2).
- **SEC-3** Content from settings or users (brand texts, JSON, names) MUST be rendered as text, never as HTML.
- **SEC-4** Secrets (API keys, client secrets, secure settings) MUST be shown once or masked.
- **SEC-5** The anonymous branding endpoint MUST expose nothing but the brand.

### Accessibility

- **A11Y-1** MUST meet WCAG 2.2 AA: contrast (4.5:1 text, 3:1 icons and controls), keyboard access to everything, visible focus, labels for controls, landmarks.
- **A11Y-2** Trees, lists, menus and dialogs MUST follow the WAI-ARIA patterns (tree, listbox, menu, dialog).
- **A11Y-3** States MUST NOT rely on color alone (modified, unsaved, disabled, errors).
- **A11Y-4** Motion MUST respect "reduce motion" (slides, transitions).

### Responsiveness and theming

- **RSP-1** Every screen MUST work from 360 px wide; the phone layout applies below 1024 px (LAY-2).
- **THM-1** MUST support light, dark and the operating system's appearance, and the color themes (built-in and from files) through design tokens; screens and plugins use the tokens, never fixed colors.

### Performance

- **PRF-1** The sign-in page SHOULD be interactive within 2 s on a typical connection; the shell after sign-in within 3 s, with plugins loading in the background.
- **PRF-2** Large lists MUST be paginated or virtualized; a screen with hundreds of settings MUST stay responsive.
- **PRF-3** The host page MUST be revalidated on every load (no-cache) so a module update reaches browsers at once; other files are cacheable by content hash.

### Operation

- **OPS-1** MUST make no request outside the platform's origin (fonts, scripts, styles, images, telemetry) unless configured (P-7, S-19).
- **OPS-2** MUST run under the platform's path (`/apps/admin-shell/`) behind proxies and with a base path.
- **OPS-3** SHOULD report client errors to the user (notification) and MAY send them to the platform's telemetry when configured.
- **OPS-4** MUST support the browsers the platform supports (current Chrome, Edge, Firefox, Safari).

## 11. Compatibility and migration

- **CMP-1** MUST coexist with the AngularJS admin (P-5): AngularJS screens open inside the shell (EXT-10) and the classic admin stays reachable from the user menu until no screen needs it.
- **CMP-2** URLs, permissions, setting names and profile settings MUST stay compatible, so bookmarks, roles and preferences survive a new implementation.
- **CMP-3** A new implementation MUST be able to load the existing module plugins (section 8) or provide a migration path agreed with module owners, versioned through `plugin.json`.
- **CMP-4** Whichever admin the platform serves as the main one (the root of the site) owns the sign-in, the second factor included (section 7.10); the other admins reuse its session and never show their own sign-in inside it. When the AngularJS admin moves into a module, it keeps its sign-in screens for installations that still use it as the main admin.

## 12. Open questions

| Question | Context |
|---|---|
| How do plugins built for the current host run in a new one (React)? | Today plugins are Vue remotes; options are a Vue island per plugin, web components, or a new plugin contract with a transition period. |
| Should the AngularJS admin read the Admin Shell's branding? | Today it has its own (`VirtoCommerce.Platform.UI.Customization`). |
| Should Google Analytics in the AngularJS admin be off by default? | `VirtoCommerce.SendDiagnosticData` is on by default and breaks OPS-1 for embedded legacy screens. |
| Should disabled actions show on phones? | vc-shell hides them in the phone action list today. |
| How does the platform choose the main admin served at the root? | Today the AngularJS admin is at `/` and the Admin Shell at `/apps/admin-shell/`. A platform option (for example a redirect from `/` to the chosen admin) also needs the sign-in redirect, external sign-in return URLs and the links in password and invitation emails to follow it (CMP-4). |
| Should module sign-in steps become plugins too? | Sign-in methods are a plugin contract (EXT-14, passkeys), while the MFA code step is built into the shell (section 7.10). A second factor from a module other than vc-module-mfa would need the same: a step a plugin registers, which the host opens on `requiresTwoFactor` once plugins have loaded. |

## 13. Current implementation

| Topic | Where |
|---|---|
| Overview, technical description | [architecture.md](architecture.md), [technical-description.md](technical-description.md) |
| Settings screen | [settings.md](settings.md) |
| Branding | [branding.md](branding.md) |
| Extension points | [plugins.md](plugins.md), [menu-contributions.md](menu-contributions.md), [menu-layers.md](menu-layers.md), [global-search.md](global-search.md), [menu-counters.md](menu-counters.md), [dashboard-widgets.md](dashboard-widgets.md), [blade-widgets.md](blade-widgets.md), [legacy-screens.md](legacy-screens.md), [embedded-apps.md](embedded-apps.md), [sign-in-page.md](sign-in-page.md) |
