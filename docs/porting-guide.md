# Porting an AngularJS admin module to the Admin Shell (vc-shell 2.7.0)

The Admin Shell (`vc-module-admin-shell`, app id `admin-shell`, served at `http://localhost:10645/apps/admin-shell/`)
is a vc-shell host. Each platform module contributes its **Vue admin UI** — a vc-shell *dynamic module*
(`@vc-shell/mf-module`, `defineAppModule`) loaded by the host over Module Federation. It is built into
`<Module>.Web/plugins/admin-shell/`; the folder and its `plugin.json` keep those names because the platform's
app-manifest discovery looks for them. The host discovers it at runtime (no platform restart in Development) and its
menu item replaces the module's legacy (AngularJS) menu item.

Reference implementation: **Orders** — `vc-module-order/src/VirtoCommerce.OrdersModule.Web/vue/`
(list, details, nested blades, dashboard widgets) and **Subscription** — `vc-module-subscription/.../vue/`
(a cross-module widget). Rich vc-shell screens to borrow from: `C:\Projects\GitHub\VirtoCommerce\vendor-portal\src\modules`
(products, offers, orders). Framework source: `C:\Projects\GitHub\VirtoCommerce\vc-shell\framework` (components in `ui/components`).

## 1. Skeleton (copy from the Orders plugin)

In `src/<Module>.Web/vue/` create (copy and rename):

| File | Notes |
|---|---|
| `package.json` | name `<module>-admin`; keep every `@vc-shell/*` at **exactly `2.7.0`**; `generate-api-client` script lists your module(s): `--APP_PLATFORM_MODULES='[VirtoCommerce.X]'` |
| `.yarnrc.yml`, `.yarn/releases/yarn-4.9.1.cjs`, empty `yarn.lock`, `.gitignore` | as in Orders |
| `tsconfig.json`, `index.html` | as in Orders (vite needs index.html) |
| `vite.config.mts` | `base = "/modules/$(VirtoCommerce.X)/plugins/admin-shell/"`, `process.env.APP_BASE_PATH = base`, `getDynamicModuleConfiguration({ appId: "admin-shell", moduleRoot: path.resolve(__dirname, ".."), entry: "./src/modules/index.ts", remoteName: "<module>_admin", base })` — always pass the options |
| `public/plugin.json` | `remote: { name: "<module>_admin", exposed: "./Module" }` and `contributions.menu[]` (see 3) |
| `src/modules/index.ts` | `export default defineAppModule({ blades, locales })`; cross-module widgets and dashboard widgets are registered at top level before it |

Also: in the module's `.csproj` exclude `vue\**` and `plugins\**` from Compile/Content/EmbeddedResource/None and add the
`AdminShellPlugin Include="plugins\**"` publish copy (see `VirtoCommerce.OrdersModule.Web.csproj`); in the repo `.gitignore`
ignore `src/<Module>.Web/plugins/`.

Commands — **run yarn from PowerShell** (Git Bash mangles paths and the yarn shim):
```
cd <Module>.Web\vue; yarn install; $env:APP_PLATFORM_URL="http://localhost:10645/"; yarn generate-api-client; yarn type-check; yarn build
```
`yarn build` writes `../plugins/admin-shell/` (remoteEntry.js + plugin.json). Reload the host to pick it up.
If `generate-api-client` fails for a module, hand-write a small typed fetch client (same-origin cookie auth works).

## 2. Conventions

- **Blades**: `defineBlade({ url, name, isWorkspace, permissions })`. Names are global — prefix them with the module
  (`CatalogProductDetails`, `CustomerContactDetails`). The workspace blade `url` equals the menu `route`.
- **Control reference: the vc-shell storybook — https://vc-shell-storybook.govirto.com/** (component list:
  `/index.json`). Check it before building any control by hand; e.g. dynamic properties are `VcDynamicProperty`,
  images `VcImageUpload`/`VcGallery`, money `VcInputCurrency`, colors `VcColorInput`, videos `VcVideo`.
- Use vc-shell components (`VcBlade`, `VcDataTable`/`VcColumn`, `VcForm`, `VcInput`, `VcSelect`, `VcTextarea`,
  `VcSwitch`, `VcCheckbox`, `VcDatePicker`, `VcEditor`, `VcGallery`, `VcFileUpload`, `VcCard`, `VcStatus`, `VcWidget`...).
  The host restyles them globally to the design (Platform Atomic Round V3) — **don't add your own chrome**; then the
  design comes for free. Lists look like the Orders list; details like the Orders detail (VcForm + VcCard sections).
- Toolbar actions via `toolbar-items`; save/reset/delete like Orders `details.vue` (`useBladeForm`/`useModificationTracker`
  as used there); confirm destructive actions with the framework's popup/confirmation.
- Nested entities open as child blades (`openBlade({ name, param, options })`); widgets on a details blade via
  `useBladeWidgets`/`VcWidget` (see Orders details: Payments/Shipments/Changes).
- Localization: `src/modules/locales/en.json` under your module's root key; use `$t`.
- Imports: in a remote import from **`@vc-shell/framework`** (main barrel) and `@vc-shell/framework/ui` only — never
  `/dashboard`, `/charts` (not shared → duplicate framework, broken DI).

## 3. Menu

`public/plugin.json` → `contributions.menu`:
```json
{ "id": "catalog", "sectionId": "catalog", "title": "Catalog", "icon": "lucide-folder", "route": "/catalog",
  "permission": "catalog:access", "priority": 10, "replaces": "legacy.catalog" }
```
Section ids: `dashboard`, `catalog`, `orders`, `marketing`, `configuration`. Legacy item ids are in
`vc-module-admin-shell/src/VirtoCommerce.AdminShell.Web/Content/default-menu.json` (`legacy.*`). Use the legacy item's
title, icon, priority and permission so the menu doesn't move.

## 4. Gotchas (all hit in this project)

1. **Object template refs don't bind inside a remote** (`ref="x"` + `const x = ref()` stays undefined). Use a function ref:
   `:ref="(el) => (x = el)"`.
2. **Tailwind classes only exist if the host uses them.** Prefer vc-shell components; for custom layout write plain
   (scoped) CSS with the host tokens: `var(--color-neutral-700)`, `var(--color-primary-500)`, `var(--color-secondary-50)`,
   `var(--color-neutral-200)` (borders) etc. (`vc-module-admin-shell/.../App/src/styles/_tokens.scss`).
   **Never hard-code a color** (`#fff`, `white`, hex): the tokens have dark-theme values (`:root[data-theme="dark"]`),
   literals don't. Check your screens with the user menu's Theme → Dark, and at phone width (375px).
   On phones a list is rows of "name + values" without column labels; a count would read as a bare number, so give
   number columns `type="number"`, or wrap a custom count template in `<span class="vc-table-cell-number">` (render
   nothing when empty) — those keep their label ("Settings: 1").
3. Shared host CSS classes available to plugins: `.dash-*` (dashboard), `.dash-inline` (wrap a `VcStatus` in a table cell).
4. Git Bash rewrites `/paths` in arguments (`#/x` → `#C:/Program Files/Git/x`): prefix node commands with `MSYS_NO_PATHCONV=1`.
5. PowerShell 5 `Set-Content` writes a BOM — don't use it for JSON.
6. ASP.NET binds ISO dates **with `Z`** into server-local time; send UTC without `Z` when exact boundaries matter.
7. `VcDataTable` money cells show `0` as "Not set" — format amounts yourself where 0 is meaningful.
8. Some endpoints return `null` collections instead of `[]` — null-guard.

## 5. Cross-module widgets (contracts)

A module adds widgets to another module's details blade with `registerExternalWidget({ id, title, component, targetBlades })`
and reads the host blade's entity with `injectBladeContext()`; the owner blade exposes it with `defineBladeContext({ item })`.
Blade names and contexts every owner must expose:

| Owner | Blade name | Context |
|---|---|---|
| Catalog | `CatalogProductDetails` | `{ item: CatalogProduct }` |
| Catalog | `CatalogCategoryDetails` | `{ item: Category }` |
| Catalog | `CatalogDetails` | `{ item: Catalog }` |
| Customer | `CustomerContactDetails` | `{ item: Contact }` |
| Customer | `CustomerOrganizationDetails` | `{ item: Organization }` |
| Store | `StoreDetails` | `{ item: Store }` |
| Orders | `OrdersDetails` | `{ item: CustomerOrder }` (exists) |
| Orders | `OrderLineItemDetails` | `{ item: OrderLineItem }` (exists) |
| Marketing | `MarketingPromotionDetails` | `{ item: Promotion }` |
| Platform | `PlatformSecurityUserDetails` | `{ item: ApplicationUser }` |
| Platform | `PlatformUserProfile` | `{ item: current user }` (incl. `memberId`) |
| Platform | `PlatformModuleDetails` | `{ item: ModuleDescriptor }` (`blade.param` is the module id) |
| Tax | `TaxProviderDetails` | `{ item: TaxProvider }` |

If your module's AngularJS code registers widgets into another module's blades, port them as external widgets against
these names. If the target plugin doesn't exist yet, still build the widget; it will be verified at integration.

- **Ownership:** a widget lives in the repo of the module whose legacy scripts registered it — not in the target's. It then
  loads only when that module is installed, so no `systeminfo` checks are needed.
- **Unsaved entities:** add `isVisible: (blade) => !!blade?.param` so the widget doesn't show on a "New …" blade.
- **Refreshing the owner:** `StoreDetails` exposes `reload`/`reloadWidgets` to children (`callParent("reloadWidgets")`
  from a blade a widget opened). Other owners: check the blade before relying on it.
- **Toolbar entries:** some blade toolbars are extension points other modules add commands to (the contract is a doc
  comment at the top of each blade). vc-shell's desktop "More" overflow menu doesn't apply a command's `disabled`, so
  re-check the condition in `onClick`:
  - `catalog-items-toolbar`: Catalog browse.
  - `customer-members-toolbar`: Customer `members-list.vue`. ctx `{ organization?, selection, keyword?, totalCount, openBlade, reload }`.
  - `pricing-pricelist-products-toolbar`: Pricing `pricelist-products.vue`. ctx `{ pricelistId, pricelist?, selection, keyword?, totalCount, openBlade, reload }`.
  - `orders-list-toolbar`: Orders `list.vue` (`OrdersList`). ctx `{ selection, keyword?, totalCount, openBlade, reload }`.
    Used by Avalara's "Send to AvaTax".
  - `orders-details-toolbar`: Orders `details.vue` (`OrdersDetails`), also the home of the legacy line items blade's
    commands (the order's line items are a table in this blade, with ticks). ctx
    `{ order, locked, selection, openBlade, recalculate, reload }`; `selection` is the ticked line items, `order` is read
    live (the blade replaces it on every recalculate). Used by Return's "Create return" and OrderManagement's
    "Add item" / "Remove".
  - `orders-line-item-toolbar`: Orders `line-item-details.vue` (`OrderLineItemDetails`). ctx
    `{ order, item?, locked, openBlade, reload }`. Used by ProductSnapshot's "Product snapshot".
- **Popups from toolbar commands:** a command's callback runs outside a component, so `usePopup` (it needs `useI18n`)
  throws there. Open a blade instead (as CustomerExportImport's Export does).
- vc-shell shows the first 3 widgets in the bar and the rest in its "More" dropdown — keep that (the host only restyles it).

## 6. Verification (required before you report)

- Session: `C:\Users\ALEXAN~1\AppData\Local\Temp\claude\C--Projects-GitHub-vc-platform\ff3a4587-dfbc-4280-abb9-0b857415bfcd\scratchpad\shot\`
  has `playwright-core` and `login.js`. Put your scripts in `shot/<module>/` (they resolve `playwright-core` from the
  parent). Get your own session file: `VC_USER=admin VC_PASS=<given in your task> node ../login.js state.json`; sessions
  expire — re-run it when you see the login page. Chrome: `C:/Program Files/Google/Chrome/Application/chrome.exe`,
  viewport 1920×1032.
- Write a Playwright script that drives the **real host** (`http://localhost:10645/apps/admin-shell/`): open your section
  from the menu (rail button `.as-rail__item` with the section's short label, then `.as-item__main` with the item's title
  in the panel; or go straight to its route, e.g. `#/orders`), and exercise every item of your parity checklist — list loads,
  search/filter, open details, edit + save + **revert**, create + **delete** a test entity, nested blades, widgets,
  no console errors (`pageerror` and `console.error`). Print PASS/FAIL per check. Screenshot the main screens (full
  resolution, look at them) and fix anything that looks broken or off-design.
- **Leave the data as you found it.** Never: restart the platform, install/uninstall modules, restore backups, delete
  pre-existing data, change pre-existing settings without restoring them, rebuild a search index with "delete existing".
- **Never commit.** Work only in your module's repo (plus read-only references).

## 7. Report

Return: the parity checklist (legacy feature → Vue status: done / partial / not ported + why), the verification
output (PASS/FAIL list), screenshot paths, files created/changed, and anything left for integration.
