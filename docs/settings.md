# Settings — Architecture

## Overview

The Admin Shell works with the platform's settings in three places:

| Where | What | Scope | API |
|---|---|---|---|
| **Settings** screen (Platform › Settings) | Every global setting of the platform and its modules, edited by an administrator | global | `api/platform/settings/v2/global` |
| **Avatar menu** and **My profile** | The user's language, appearance and color theme | per user | `api/platform/settings/v2/me` |
| **Menu layers** | The global, role and user menu patches | global, per role, per user | the shell's own menu API (see [menu-layers.md](menu-layers.md)) |

The Settings screen follows the [Unified Settings Blade](https://github.com/VirtoCommerce/vc-platform/blob/dev/docs/developer-guide/settingsV2.md#unified-settings-blade) of the AngularJS admin: a single blade with the setting groups as a tree on the left and the settings of the chosen group on the right, edited in place. Everything is built on the client from the platform's Settings v2 API. The shell adds no server code for it.

Sources (under `src/VirtoCommerce.AdminShell.Web/App/src/`):

| File | Role |
|---|---|
| `modules/platform/composables/settings.ts` | The settings store (schema, stored values, translations), value comparison, group paths, the focus request |
| `modules/platform/pages/settings/list.vue` | The Settings blade: tree, properties, filters, toolbar, deep links, phone layout |
| `modules/platform/pages/settings/dictionary.vue` | The values of a dictionary setting (a child blade) |
| `modules/platform/pages/settings/json.vue` | Edit the modified settings as one JSON document (a child blade) |
| `shell/search/providers/platform.ts` | Global search over setting names and titles; opens the Settings blade on a setting |
| `shell/themeMode.ts` | The user's appearance, theme and language, kept in the user's profile |
| `modules/platform/pages/user-profile/main.vue` | My profile: the same preferences, plus the platform's regional settings |

## How it fits together

```
                    ┌────────────────────────────── Settings v2 API ───────────────────────────────┐
                    │ GET  global/schema    GET global/values    POST global/values?replaceAll=     │
                    │ GET  me/values?moduleId=                    POST me/values                    │
                    └──────────────┬──────────────────────────────────────────────┬────────────────┘
                                   │                                              │
                  composables/settings.ts (one shared store)            shell/themeMode.ts
                  schema · stored · translations                         appearance · theme · language
                     │            │              │                          │                │
          Settings blade   dictionary / JSON   global search          avatar menu       My profile
          (list.vue)       blades              (platform.settings)
```

- **One store.** `useSettingsStore()` returns module-level refs, so the Settings blade, its child blades and the global search provider read the same schema and stored values. A child blade that saves calls the parent's `reload` (`exposeToChildren`), and the blade reloads the store without losing the user's unsaved edits.
- **Schema + values, merged on the client.** `GET global/schema` gives the flat list of setting descriptors (name, group, type, default, allowed values, flags). `GET global/values` gives `{ name: value }` for every setting that isn't hidden. The blade keeps three values per setting: the **default** (schema), the **stored** value (values) and the **edited** value (the editor).
- **Labels.** A setting's title and description come from the platform's AngularJS translations (`settings.<Name>.title` / `.description`, `GET api/platform/localization?lang=`), then the descriptor's `displayName`, then its name. `settingTitle()` / `settingDescription()` resolve them. The keys are nested by the dots of the name, so the lookup tries the longest dotted prefix first.

## The Settings blade

### Layout

```
┌─ Settings ──────────────────────────────────────────────────────────────────────────┐
│ Save · Reset · Refresh · Export JSON · Import JSON · Edit as JSON · Reset cache     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ [🔍 Search settings by name, group or value      ]  (● Modified 28) (Tenant) [Module▾]│
├────────────────────────┬────────────────────────────────────────────────────────────┤
│ ≡ All settings  ● 154  │ Cart › General                       VirtoCommerce.Cart  🔗 │
│ › Admin Shell      1   │ ┃ Cron expression for cart hard delete job  [Unsaved]  ↶ ⟲ │
│ ⌄ Cart           ● 6   │ ┃ Specify when the cart deletion job should run             │
│     Abandoned …    1   │ ┃ [0 2 */1 * *                     ]                        │
│     General      ● 5   │ ┃ Cart.CronDeleteObsoleteCarts                              │
│ › Catalog        ● 15  │                                                            │
│ …                      │   Hard delete for previously soft deleted carts            │
└────────────────────────┴────────────────────────────────────────────────────────────┘
```

- **Tree** (left, 280px, scrolls on its own). It's built from `groupName` split on `|` (`groupPath()`), sorted by name at each level, under an **All settings** root. A node shows the number of settings in it and the groups under it, and a dot:
  - **blue**: a setting under it differs from its default;
  - **amber**: a setting under it has an unsaved change.

  A chevron expands and collapses a node, and choosing a node expands it. While a search or a filter is on, every group it leaves is expanded. The tree follows the WAI-ARIA tree pattern: arrow keys move, open and close; Enter or Space chooses; Home and End jump.
- **Properties** (right, scrolls on its own). The settings of the chosen node and the groups under it, one section per full group path in tree order. The section header (`Cart › General`, the module id, a copy-link button) sticks to the top while its section scrolls. Sections use `content-visibility: auto`, so *All settings* (about 250 settings) renders quickly.

### A property

Each setting shows its title, the tags that apply, its description, the editor and its name in monospace.

| Value type | Editor |
|---|---|
| any type with `allowedValues` | `VcSelect`, searchable, clearable unless required |
| `Boolean` | `VcSwitch` with On / Off |
| `Integer`, `PositiveInteger` | `VcInput type="integer"` |
| `Decimal` | `VcInput type="number"` |
| `DateTime` | `VcDatePicker` (date and time) |
| `Json` | monospace `VcTextarea` with a JSON check and **Format JSON** |
| `LongText` | `VcTextarea` |
| `SecureString` | `VcInput type="password"` |
| `Cron` | `VcInput` with a cron check in the hint |
| `ShortText` and the rest | `VcInput` |
| dictionary (`isDictionary`) | its values as chips, and **Edit values**, which opens `PlatformSettingDictionary` |

**Markers.** A bar on the left of a setting, and a tag next to its title, show its state:

| State | Rule | Shown as |
|---|---|---|
| Modified | edited value ≠ default (`sameValue(edited, default)` is false) | blue bar, *Modified* tag, blue dot in the tree |
| Unsaved | edited value ≠ stored value | amber bar, *Unsaved* tag, amber dot in the tree, the blade's "unsaved changes" banner |
| Restart required | `restartRequired` | *Restart required* tag; after a save, a notice that the platform must restart |
| Tenant | `assignedToTenants` | a tag with the tenant types (`Store`, …) |
| Read-only | `isReadOnly`, or no `platform:setting:update` | *Read-only* tag, editor disabled |

`sameValue()` compares values the way the AngularJS blade does: empty string equals null, JSON is compared with normalized line breaks, dates as instants, arrays as JSON.

**Actions on a setting:** **Discard the change** (↶, back to the stored value) while it's unsaved, and **Reset to default** (⟲, the tooltip shows the default) while it differs from its default. Like the AngularJS blade, resetting only changes the edited value; **Save** stores it.

### Search and filters

| Control | Behavior |
|---|---|
| Search | Name, translated title, group path and the current value (JSON values stringified) |
| **Modified** chip | Only settings whose *stored* value differs from the default, with their count. It reads the stored value, so a setting you reset stays in view until it's saved. |
| **Tenant settings** chip | Settings assigned to tenants (`assignedToTenants`) are hidden by default, as in the AngularJS blade, and shown with this on |
| Module | One module's settings |

Filters change the tree too: only groups that still have settings show (with their parents). If the chosen group disappears, the blade falls back to *All settings*. When nothing matches, the blade offers **Clear filters**.

### Saving

**Save** posts only the settings whose edited value differs from the stored one: `POST global/values?replaceAll=false` with `{ name: value }`. The blade then reloads the store and refills the editors. Save is enabled while there are changes, every changed setting is valid (required filled, JSON parses) and the user has `platform:setting:update`. **Reset** puts every editor back to its stored value. **Refresh** reloads from the server and keeps unsaved edits.

`DateTime` values are sent as `"yyyy-MM-dd HH:mm:ss.fffffffZ"` (a space instead of `T`). Platforms up to 3.1079.0 parse an ISO string as a date and store it shifted by the server's UTC offset (see `dateWire()`).

Leaving the blade with unsaved changes asks first (`usePlatformBladeForm`).

### Toolbar

| Command | What it does | Permission |
|---|---|---|
| Save, Reset, Refresh | See above | `platform:setting:update` for Save |
| Export JSON | Downloads `settings-global.json`: `{ version, exportedAt, scope: "global", settings }` with the modified settings (`GET global/values?modifiedOnly=true`) | — |
| Import JSON | Reads such a file (or a bare `{ name: value }` map), confirms, then `POST global/values?replaceAll=true`: modified settings missing from the file go back to their defaults | `platform:setting:update` |
| Edit as JSON | Opens `PlatformSettingsJson` on the same document; saving replaces in the same way | `platform:setting:update` to save |
| Reset cache | Clears the platform cache (`ChangeLogClient.resetPlatformCache`) | `cache:reset` |

### Deep links

The chosen group is kept in the address, so a link copied from the address bar, or from a section's 🔗 button, opens the blade on that group in any browser:

| Link | Opens |
|---|---|
| `/apps/admin-shell/#/settings?group=Catalog%7CSearch` | the *Catalog › Search* group chosen in the tree, its parents expanded |
| `/apps/admin-shell/#/settings?setting=Cart.CronDeleteObsoleteCarts` | the setting's group, the setting scrolled to, flashed and focused |

How it works:

- **Writing the address.** Choosing a node writes `?group=` with `router.replace` and `updateBladeQuery` (vc-shell's blade stack). Choosing *All settings* removes it, and once the group shows, a `?setting=` gives way to `?group=`.
- **Reading a link.** The shell's start (sign-in, the workspace's own address) drops the query from the route before the settings have loaded. So the blade reads the address it opened with as it starts (`window.location.hash`), then the blade's and the route's query.
- **Links in an open tab.** A link pasted into the address bar of a tab that is already open (`hashchange`) moves the blade too.
- **Tenant settings.** A link turns on *Tenant settings* only when the linked setting is a tenant setting, or the group has only tenant settings. It clears filters that would hide what it points at.
- **Global search** doesn't build links. It calls `focusSetting(name)` (a module-level request in `composables/settings.ts`) and opens the workspace. The blade takes the request when it loads, or right away if it is already open.

### Phones and narrow blades

The blade watches its own width (`useElementSize`). Below 720px it shows one panel at a time:

1. **The tree**, full width, with 44px rows and a chevron that says the row opens something.
2. **A group's settings**, with a sticky back button (`‹ Cart > General`) that returns to the tree.

A link opens on the group's settings. The search box, the chips and the module filter wrap to the width. The copy-link button stays visible on touch screens (`@media (hover: none)`).

### Styling

The blade's styles live in `list.vue` under `.ps` / `.ps-*`. They use the shell's tokens only (`--color-neutral-*`, `--color-primary-500`, `--color-warning-500`), so they follow light and dark and every color theme ([styles/_themes.scss](../src/VirtoCommerce.AdminShell.Web/App/src/styles/_themes.scss)). The flash of a setting opened from a link (`platform-setting-found`) is in `modules/platform/styles.scss`.

## The user's preferences

The appearance (`system` / `light` / `dark`), the color theme (`virto` / `warm` / `blue` / `indigo`) and the language follow the user to every browser:

| Setting | Owner | Registered as |
|---|---|---|
| `AdminShell.UI.Appearance` | the Admin Shell module | `ModuleConstants.Settings.UserAppearance`, for the `UserProfile` tenant |
| `AdminShell.UI.Theme` | the Admin Shell module | `ModuleConstants.Settings.UserTheme`, for the `UserProfile` tenant |
| `VirtoCommerce.Platform.UI.Language` | the platform | shared with the AngularJS admin |

`shell/themeMode.ts` loads them when a user signs in (`GET me/values?moduleId=VirtoCommerce.AdminShell` and `?moduleId=Platform`); the profile wins over the browser's copy. It saves only what changed (`POST me/values`), batched over 400ms. The browser keeps a copy (`localStorage`) for the sign-in page and the first paint. The avatar menu and My profile both edit the same refs, so a change in one shows in the other.

The module also registers the menu settings (`AdminShell.Menu.Global`, `.Role`, `.User`, `.Recent`); [menu-layers.md](menu-layers.md) describes them. `.User` and `.Recent` are hidden, so they don't appear on the Settings screen.

## Adding a setting (module developers)

A setting registered by a module shows in the Settings blade without any client code:

```csharp
public static SettingDescriptor ScanInterval { get; } = new()
{
    Name = "VirtoCommerce.Search.IndexingJobs.ScanInterval", // the key in every API payload
    GroupName = "Search|Indexing",                           // the tree: Search › Indexing
    ValueType = SettingValueType.ShortText,
    DefaultValue = "0/5 * * * *",
    RestartRequired = false,
};

settingsRegistrar.RegisterSettings(new[] { ScanInterval }, ModuleInfo.Id);
```

Guidelines:

- **`GroupName`** places the setting: `Module|Area`, two levels at most. Settings without a group go under *General*.
- **Title and description** go in the module's `Localizations/en.VirtoCommerce.<Module>.json` under `settings.<Name>.title` and `.description`, the same keys the AngularJS admin reads. Without them, the title is the `DisplayName`, then the name.
- **`AllowedValues`** gives a select. **`IsDictionary`** lets administrators edit the list (with translations when `IsLocalizable`).
- **`RestartRequired`** for values read only at startup: the blade tags them and reminds the user after a save.
- **`IsHidden`** keeps a setting out of the values API and the blade (per-user state, internal flags).
- Settings registered **for a tenant type** (`RegisterSettingsForType`) carry `assignedToTenants` and show only with *Tenant settings* on. Their per-store values are edited on the store, not here.

## Not covered yet

| Part | AngularJS blade | Here |
|---|---|---|
| Tenant mode (one store's or one user's settings in the same blade) | `tenant/{type}/{id}` data source | Global settings only |
| Entity mode (OK / Cancel, settings of an unsaved entity) | yes | — |
| JSON editor | CodeMirror with highlighting and folding | Textarea with a check and Format |
| Restart command | in the toolbar | — |

## Testing

There are no unit tests for the blade yet. Check by hand on the demo, at desktop width and on a phone (Browser pane → Mobile), in light and dark:

1. Choose a few groups: the address shows `?group=…`. Open that address in a new browser: the same group is chosen.
2. Edit a value: an amber bar and *Unsaved* appear, with amber dots up the tree and the unsaved-changes banner. ↶ undoes it.
3. ⟲ resets to the default; **Save** stores it; the *Modified* count changes.
4. Search for a value (`0/5`), filter by module, turn *Modified* on and off.
5. Open a setting from global search (`Ctrl+K`, type a setting's title): it's scrolled to and flashed.
6. Save a `restartRequired` setting: the restart notice shows.
