# Localization — Guide

## Overview

The Admin Shell shows its interface in the language each user picks (avatar menu › Language, or My profile; before signing in, the language picker beside the theme switch on the sign-in page, kept in the browser until the profile's language applies). It ships the same 13 languages as the AngularJS platform:

| Code | Language | Code | Language | Code | Language |
|---|---|---|---|---|---|
| `en` | English (source) | `fr` | Français | `pl` | Polski |
| `de` | Deutsch | `it` | Italiano | `pt` | Português |
| `es` | Español | `ja` | 日本語 | `ru` | Русский |
| `fi` | Suomi | `no` | Norsk | `sv` | Svenska |
| | | | | `zh` | 中文 |

Besides these, the Admin Shell and its module plugins speak **Arabic** (`ar`) and **Hebrew** (`he`), both right to left (see *Right-to-left languages*). The platform offers a language once a module ships its server texts in it, so both are in the platform's list too.

The language codes are the platform's (`GET api/platform/localization/locales`), so a user's language, stored once in their profile (`VirtoCommerce.Platform.UI.Language`), applies to the AngularJS admin and to the Admin Shell alike.

English is the source and the fallback: a text missing in a language shows in English, never as a key.

## Where texts come from

A screen's texts come from five places. A language is complete when all five have it.

| # | Texts | Files | Loaded by |
|---|---|---|---|
| 1 | **vc-shell** (tables, dialogs, date picker, sign-in and password pages, assets) | vc-shell ships `en` and `de` (`@vc-shell/framework/locales/de`); the other 11 are in `App/src/locales/framework/<code>.json` | English by the framework itself; the rest by the host, which merges `App/src/locales/framework/index.ts` (vc-shell's German included: vc-shell doesn't load it in this host) at startup, before its own texts |
| 2 | **The shell** (navigation, search, user menu, dashboard, sign-in page, branding) | `App/src/locales/<code>.json` | `main.ts` (`$mergeLocaleMessage`) |
| 3 | **Platform screens** (Settings, Security, Modules, Dynamic properties, License, Profile, Developer tools) | `App/src/modules/platform/locales/<code>.json` | the platform module (`defineAppModule({ locales })`) |
| 4 | **Module plugins** (each module's screens and widgets) | `{module}/src/*.Web/vue/src/modules/locales/<code>.json` | the plugin (`defineAppModule({ locales })`) when it loads |
| 2b | **The menu** (section, group and item titles) | `App/src/locales/menu/<code>.json` | `main.ts`, with the shell's texts; see *Menu* below |
| 5 | **Server texts** (setting titles and descriptions, permission names) | `Localizations/<code>.VirtoCommerce.<Module>.json` of the platform and of each module, including `Localizations/<code>.VirtoCommerce.AdminShell.json` here | the platform (`GET api/platform/localization?lang=`), read by the Settings screen and the AngularJS admin |

Each `locales` folder has an `index.ts` that exports one object per language:

```ts
import * as en from "./en.json";
import * as de from "./de.json";
// ...
export { en, de, es, fi, fr, it, ja, no, pl, pt, ru, sv, zh };
```

The language menu lists every language that has a `language_name` in the shell's file (#2): `"language_name": "Deutsch"`. That one key decides whether a language is offered.

### Menu

The menu's titles have files of their own: `App/src/locales/menu/<code>.json`, merged at startup like the shell's texts. The server sends each section, group and item with its English title and, optionally, a `titleKey`; the shell shows, in this order:

1. a title the [menu editor](menu-layers.md#the-menu-editor-configuration--menu) gave in the user's language (`titles` of the global patch), else its English one;
2. the entry's `titleKey`: a key of the shell's texts or of a plugin's (`defineAppModule({ locales })`), else of the platform's server texts (#5), which is where an AngularJS screen's `main-menu-title` lives (they load only when such a key is asked for);
3. the menu's file, by id: `MENU.SECTIONS.<sectionId>`, `MENU.GROUPS.<sectionId>_<groupId>`, `MENU.ITEMS.<itemId>`, with every character but letters and digits as `_` (`legacy.catalog` → `MENU.ITEMS.legacy_catalog`);
4. the English title.

`MENU.RAIL.<sectionId>` gives a short rail label where the first word of the section's title doesn't do (`configuration` → "Settings"). The titles follow a language switch at once, without asking the server again. A module whose items aren't in the menu's file gives a `titleKey` from its own locales in its [contribution](menu-contributions.md); a discovered blade takes its `menuItem.title` key. Source: `App/src/shell/menuTitles.ts`.

### vc-shell's English defaults

Some vc-shell components default a text prop to fixed English instead of a translated text: the table search's "Search...", the phone table's "More", "Actions" and "Cancel", the date picker's labels, the loading and progress labels. A screen that doesn't pass its own text would show them in English. The host gives these props a default in the user's language (`App/src/locales/framework/defaults.ts`): vc-shell's own text where it has one (`COMPONENTS.ORGANISMS.VC_TABLE.SEARCH`), the shell's otherwise (`SHELL.FRAMEWORK`). Module plugins share vc-shell with the host, so their screens get the same texts without changes.

Still English, because vc-shell builds them in code (fix in vc-shell): the screen-reader announcements of the dashboard's drag and drop, the "Remove …" label of a multi-select chip, the "Active"/"Inactive" label of a status icon, and the "Fullscreen" label of the rich text editor.

## Right-to-left languages

Arabic, Hebrew, Persian and Urdu are written right to left. For them the whole page turns around: the menu rail and the menu move to the right, blades open to the left, labels, fields and toolbars start on the right. How it works:

| Part | What it does | Where |
|---|---|---|
| Page direction | `<html dir="rtl">` while the UI language is written right to left (`ar`, `he`, `fa`, `ur` and others; `dir="ltr"` otherwise), with `<html lang>` | vc-shell's language switch (`useLanguages().setLocale`); `useTextDirection()` and `isRtlElement()` for code that places things itself |
| Mirrored styles | at build time every left/right rule of the shell, Tailwind and vc-shell's stylesheet gets its mirror under `[dir="rtl"]` (margins, paddings, positions, borders, corners, text alignment, rotations) | `App/postcss.config.cjs` (`postcss-rtlcss`) |
| Not mirrored | the dashboard grid (gridstack) places widgets itself and has its own right-to-left rules, so its rules are left out | `App/postcss.config.cjs` (`keepGridstack`) |
| Arrows | arrows that mean forward, back, open or in/out (chevrons, arrows, log in/out, panel, undo/redo) point the way of reading | vc-shell's stylesheet (`.vc-icon--rtl-mirror` for another icon) |
| Text with its own direction | data in tables, cards and fields (emails, codes, versions, URLs, amounts) keeps its own direction inside the right-to-left page, so it is cut and ordered from its first letter | vc-shell's stylesheet; code (`pre`, `code`, `kbd`, `samp`) always left to right in `App/src/styles/_rtl.scss` |
| Arabic and Hebrew letters | Noto Sans Arabic and Noto Sans Hebrew, bundled with the app (no font service), added to the shell's font names for those scripts' code points only | `App/src/styles/_rtl.scss` (`$scripts`), `@fontsource-variable/noto-sans-arabic`, `@fontsource-variable/noto-sans-hebrew` |

Writing a screen that works both ways:

- **Use logical CSS** where you can: `margin-inline-start`, `padding-inline-end`, `inset-inline-start`, `text-align: start`. Physical rules (`margin-left`) still work, mirrored at build time in the shell; a module plugin's own styles aren't mirrored, so they need logical properties.
- **Icons:** a directional Lucide icon (chevrons, arrows, log in/out, panels, undo/redo) flips by itself; give another icon the class `vc-icon--rtl-mirror`. An icon that shows a direction in the world (a chart going up, "open in new tab") doesn't flip; one that shows the way of reading does.
- **Data:** put codes, emails and URLs in table cells, fields or the mobile card's fields; elsewhere give the element `dir="auto"` (or `dir="ltr"` for code-like values) so they read correctly.
- **Sentences around fields** (the condition builders) are separate texts: each language orders them in its reading order, so keep them short.
- **Charts** keep their time axis left to right, as charts in Arabic and Hebrew interfaces usually do.

Adding another right-to-left language (Persian `fa`, Urdu `ur`): the steps of *Adding a new language* below; the direction, styles and arrows already apply (vc-shell knows both as right to left). A script without a bundled font gets one in `_rtl.scss` (`$scripts`); Urdu's Nastaliq is taller than Naskh, so check line heights.

## Adding a new language

Example: Dutch (`nl`).

### Requirements

| What | Why |
|---|---|
| The platform must know the language | Its list (`api/platform/localization/locales`) comes from the platform's `Localizations/nl.VirtoCommerce.Platform.json`; without it users can't pick Dutch in their profile and the setting titles stay English. Contribute it to vc-platform. |
| A translator, or a reviewed machine translation | The source files are English; keep the platform's established terms (see *Glossary*). |
| The key structure | Every translated file has exactly the keys of its English file, in the same nesting. |

### Steps

1. **vc-shell texts (#1).** Copy `App/node_modules/@vc-shell/framework/dist/locales/en.json` to `App/src/locales/framework/nl.json`, translate the values, and add `nl` to `App/src/locales/framework/index.ts`. (When vc-shell ships the language itself, import its file there instead, as German is: `import de from "@vc-shell/framework/locales/de"`.)
2. **Shell texts (#2).** Copy `App/src/locales/en.json` to `nl.json`, translate it, set `"language_name": "Nederlands"`, and add `nl` to `App/src/locales/index.ts`.
3. **Platform screens (#3).** The same in `App/src/modules/platform/locales/`.
4. **Server texts (#5).** Copy `Localizations/en.VirtoCommerce.AdminShell.json` to `nl.VirtoCommerce.AdminShell.json` and translate it.
5. **Each module (#4, #5).** In every module repository: `vue/src/modules/locales/nl.json` plus its `index.ts`, and `Localizations/nl.VirtoCommerce.<Module>.json`.
6. **Check** every file against its English source:

   ```bash
   python scripts/l10n_check.py src/VirtoCommerce.AdminShell.Web/App/src/locales/en.json src/VirtoCommerce.AdminShell.Web/App/src/locales/nl.json
   ```

   The check fails on missing or extra keys, empty values, changed placeholders (`{count}`), changed plural forms (`a | b`) and changed HTML tags, and warns when many strings are still English.
7. **Build and look.** `yarn type-check`, then deploy, pick *Nederlands* in the avatar menu and go through the sign-in page, Home, a list, a details blade with unsaved changes, Settings, Security and a module screen. Long words (German, Finnish) are the usual layout risk: check buttons, the rail labels and table headers on a phone too.

### Translation rules

- **Values only.** Keys, nesting and order stay as in English.
- **Placeholders stay.** `{count}`, `{name}`, `{version}`, `@:OTHER.KEY` and HTML tags are copied unchanged; their position may move with the grammar.
- **Plural forms** are separated by ` | ` (vue-i18n): keep their number.
- **Names stay.** Virto Commerce, Admin Shell, API, JSON, OAuth, SKU, URL, CSV, keyboard shortcuts and setting names (`AdminShell.Branding.LogoUrl`).
- **Style.** Short, as a professional admin product says it; buttons are verbs; the formal or neutral address the platform uses in that language.
- **Glossary.** Reuse the terms of the AngularJS translations so both admins say the same: the platform's `Localizations/<code>.VirtoCommerce.Platform.json` and `Common.json`, and each module's `Localizations/<code>.VirtoCommerce.<Module>.json`.

## Adding or changing a text

- Add the key to `en.json` first; the other languages fall back to English until they are translated.
- Add the translations in the same pull request when you can. When you can't, list the missing keys in the PR so they can be translated together.
- Never reuse a key for a different meaning; add a new one.
- Run the check on every language of the folder you changed.

## Machine translation

The 12 non-English languages of the Admin Shell and of the module plugins were machine-translated (October 2026), with the platform's and each module's AngularJS translations as the glossary, and checked with `l10n_check.py`. A review by native speakers is welcome: fix the JSON file and keep the keys.

## Testing

1. Pick each language in the avatar menu: the shell, the platform screens and the module screens change at once, and the choice follows the user to another browser.
2. Look for English left over: a text in English means a missing key in that language (or in vc-shell, #1).
3. Look for keys shown as text (`PLATFORM.SETTINGS.LIST.TITLE`): a key missing in English too.
   - Server texts (setting titles, payment, shipping and tax method names) come from `api/platform/localization?lang=<the user's language>`, with English for what that language lacks; a plugin that asks for `lang=en` shows them in English for everyone.
   - Setting group names ("General", "Search") are names from the modules' code with no translations anywhere, in the AngularJS admin too.
4. Check long translations on a phone (375 px) and in the 1024 px desktop layout.
