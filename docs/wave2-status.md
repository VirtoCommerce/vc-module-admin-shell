# Wave 2: modules from modules_v3.json at 3.1000+ (started 2026-10-13)

Source list: https://github.com/VirtoCommerce/vc-modules/blob/master/modules_v3.json, filtered to modules with a version
of 3.1000.0 or later: 103 modules, of which 51 were already here. Inventory and build logs:
`C:\Users\ALEXAN~1\AppData\Local\Temp\claude\C--Projects-GitHub-vc-platform\ff3a4587-dfbc-4280-abb9-0b857415bfcd\scratchpad\modules\`.

## Checked out and registered
- Cloned 49 repos into `C:\Projects\GitHub\VirtoCommerce`. Import, GoogleEcommerceAnalytics and PushMessages were already here.
- Not available: Contentful (no repo URL in the registry) and OneShell (`vc-module-one-shell` is private; the Admin Shell replaces it).
- Built 51 modules. Three needed `-p:NuGetAudit=false` because vulnerability warnings are treated as errors: Hotjar, StateMachine, ModuleFederation.
- XCart moved to tag 3.1042.0, which Quote needs. PushMessages was fast-forwarded on dev.
- Built and copied apps into `Content/<app>`: News, PushMessages, TaskManagement.
- Platform: 94 modules load, health 200.

Not registered (junction removed; source kept):

| Module | Why |
|---|---|
| ModuleFederation | Needs a built `Content/modularity`, throws at startup. Superseded by the Admin Shell. |
| ElasticSearch9 | Can't load next to ElasticSearch8: two versions of `Elastic.Clients.Elasticsearch`. |
| SalesRep | A singleton authorization handler depends on the scoped `ISalesRepRoleResolver`, so startup fails DI validation in Development. Bug in the module. |
| PushMessages | Needs System.Reactive 6.1, which no module ships in a source build. A stale 4.4 copy came from its old build. |
| Import | Its app comes from `import-app/dist`, which isn't in the repo. |
| SystemOperations | Its app content is missing and the app doesn't build. |
| VirtoOZManagement | Its app content is missing. |
| CITest | CI test module. |

## Migration (agents follow docs/migration-brief-wave2.md)
| Module | Agent | Status |
|---|---|---|
| StateMachine, Return | wave 1 | done: 31/0 each, light/dark, phone. Return: "Create return" is reached through the order's Returns widget (OrdersDetails has no toolbar extension point); approve/decline was checked with the request intercepted, since it emails the buyer. StateMachine: entity type is typed in (no module registers types in the browser), the condition editor isn't ported (no module registers condition trees), jszip 3.10.1 bundled. Test definitions were removed with SQL (the module has no delete endpoint) |
| Loyalty | wave 1 | done: 68/0, light/dark, phone. The operation log was tested empty only (no API creates rows); the contact balance widget was tested disabled only (no contact here has an account). Two menu items under Marketing |
| Quote | wave 1 | done: 57/57 + 8/8 PASS, light/dark, phone. Attachment upload unverified (no upload scope configured here). New menu item (no legacy seed entry). Server quirks seen, same in legacy: selected tier and address isDefault not stored, delete 500s on configured items with isConfigured=false |
| Contracts | wave 1 | done: 35/0 desktop flow, 24/0 light/dark × desktop/phone. Not ported: the vendor field's pencil and the price list picker's saved filters; the product picker is a flat search instead of the category tree. Phone price inputs show no labels (host hides mobile field labels) |
| AuditLog, ProductSnapshot, BackInStock | wave 1 | done: all PASS (AuditLog 50+11, ProductSnapshot 13+4, BackInStock 11+4; light/dark). Records, snapshots and configurable tracking were tested with faked responses (none on this instance). Product snapshot is a widget on OrderLineItemDetails (that blade has no toolbar extension point). Server: AuditLogController.SearchRecords is annotated as AuditLogRecord[] but returns { totalCount, results } |
| DynamicAssociations, CustomerReviews | wave 2 | done: 56/0 and 30/0. DynamicAssociations: category conditions use Catalog's CatalogBrowse pick mode (it can't pre-select, so the rule keeps its own removable list); the generated client types /preview as string[] but it returns { totalCount, results }. CustomerReviews: read-only details (no get-by-id endpoint, so it uses the list row), product rating widget on CatalogProductDetails |
| SqlQueries, EnvironmentsCompare, ShopifyTaxonomy | wave 2 | done: SqlQueries 36/36, EnvironmentsCompare 27/27 desktop and 29/29 phone, ShopifyTaxonomy 12/12 desktop and 13/13 phone (all in light and dark). SqlQueries: plain monospace editor (CodeMirror dropped); this instance has no `ConnectionStrings:SqlQueries.*`, so results were checked with served responses. EnvCompare: only "Current" exists here; multi-environment compare tested with served data. Shopify: a toolbar command on the Catalog list; a real run was tested up to "no taxonomy file for uk-UA". vc-shell: VcDatePicker throws RangeError on typed free text |
| CustomerExportImport, PriceExportImport, Punchout | wave 2 | done: CustExp 38+6, PriceExp 28+7, Punchout 23+8 (each in light and dark). Added toolbar extension points `customer-members-toolbar` (Customer members-list.vue) and `pricing-pricelist-products-toolbar` (Pricing pricelist-products.vue). Export dialogs became blades (usePopup throws in toolbar callbacks). The Punchout widget shows a 0/1 badge |
| AvalaraTax (vc-module-avatax), NativePaymentMethods, WebHooks | wave 2 | done: NativePay 25+9, WebHooks 39+9, Avalara 29+22 (each in light and dark). Added `defineBladeContext({ item })` to Tax `TaxProviderDetails`. Avalara bulk "Send to AvaTax" isn't ported (OrdersList has no toolbar extension point). An empty `Avalara.Credentials.CompanyCode` setting row is left (value null; id 37dea9aa-43af-47fe-840e-8227b516accd) |
| GDPR, OrderManagement, AI, TaskManagement, PowerBiReports, Hotjar, GoogleEcommerceAnalytics, BuilderIO | wave 2 | done: GDPR 13/0, OrderManagement 16+13, AI 8/0 (each in light and dark). OrderManagement's add/remove items is a "Manage items" widget on OrdersDetails (no toolbar extension point there). AI ("Virto OZ") is tested with a stub chatbot (no ChatbotUrl here). PowerBiReports, Hotjar, GA and BuilderIO register nothing in AngularJS. TaskManagement's two permission scopes are now toggles in PlatformUI permission-scopes.vue. News and Tasks apps open |

API-only, nothing to migrate: AlgoliaSearch, AzureAppConfiguration, CyberSource, Datatrans, ElasticAppSearch, GoogleSSO, MarketingExperienceApi, News (app only), OTP, OpenIdConnect, OpenSearch, Sanity, SeqLog, ShipStation, Skyflow, XPickup, XRecommend.

## Follow-ups (after wave 2)
All fixed on 2026-10-13 (uncommitted), and live after the restart:
- **Menu icons:** apps with a relative icon URL (News) get a leading "/" (DefaultMenuBuilder.cs). The Hotjar, PowerBiReports and AlgoliaSearch manifests now point at their real logo files.
- **Orders toolbars:** extension points `orders-list-toolbar`, `orders-details-toolbar` and `orders-line-item-toolbar` were added. Return's "Create return", ProductSnapshot, Avalara's bulk "Send to AvaTax" and OrderManagement's "Add item"/"Remove" moved back onto toolbars.
- **Vendor apps:** Builder.io, Hotjar and GA open in a new tab (url targets in default-menu.json).
- **vc-shell (one yarn patch on the host; source fixes with tests in the local vc-shell repo, to upstream):**
  - toolbar "More" overflow, keeping toolbar order;
  - disabled items in More;
  - the VcDatePicker RangeError on typed text;
  - the maximized blade un-maximizes when a child opens;
  - `useUserManagement` export.
- **Server:**
  - PowerBiReports: a not-configured page instead of the redirect to `/False`.
  - Quote: the selected tier and address isDefault are stored (migration `AddTierPriceIsSelectedAndAddressIsDefault`). A posted selectedTierPrice no longer overwrites the first tier.
  - SqlQueries: parameter order kept (migration `AddSqlQueryParameterSortOrder`).
  - AuditLog/DynamicAssociations: swagger types fixed and Vue clients regenerated.
- **Sign-in:** new sign-in page: Buyer24 style, light/dark, "Continue with …" SSO names.

Still open:
- **Return:** the Return lines blade is cramped next to the order (30% width).
- **Returns widget:** the count is stale after "Create return" until the order is reopened (legacy behaves the same).
- **Product snapshots:** orphan OrderProductSnapshot rows are left for deleted test orders (no delete API).
