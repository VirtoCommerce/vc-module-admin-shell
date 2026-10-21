# White-Labeling — Guide

## Overview

A customer can run the Admin Shell under its own brand without changing the shell. White-labeling comes in three levels, by effort:

| Level | What changes | Who | How | Deploy? | Time |
|---|---|---|---|---|---|
| **Low** | Company name, logos, tab icon, Help / Support / Privacy / Terms links, default theme and appearance | administrator | Settings (Platform › Settings › Admin Shell › Branding, Theme) | no | minutes |
| **Medium** | The sign-in page's panel (the company's slides instead of Virto's, or none) and a welcome card on Home | administrator, marketing | Settings with JSON content, images in Assets | no | an hour |
| **High** | A custom color theme in the company's colors, light and dark, as the default for everyone or one more choice | developer, designer | A theme file (JSON) in the themes folder on the server | a file on the server | a day |

Everything is read by the shell from one anonymous endpoint, `GET api/admin-shell/branding`, at startup, so the sign-in page is branded too. Nothing is built into the shell's code, and a module update keeps the brand.

Sources:

| Part | File |
|---|---|
| Settings | `src/VirtoCommerce.AdminShell.Core/ModuleConstants.cs` (`Settings.BrandingSettings`) |
| Endpoint | `src/VirtoCommerce.AdminShell.Web/Controllers/Api/AdminShellBrandingController.cs`, `Services/BrandingService.cs` |
| Client | `App/src/shell/branding.ts` (load, apply, helpers), `shell/themeMode.ts` (themes), `pages/AuthShell.vue`, `pages/AuthSlides.vue`, `shell/dashboard/WelcomeCard.vue`, `styles/_themes.scss` |
| Sample theme file | [`docs/branding/acme-green.json`](branding/acme-green.json) |

## Review: where the brand shows

The shell's design was reviewed for every place a customer would expect its own brand. Each one is now driven by the branding:

| Element | Where | Default | Branding |
|---|---|---|---|
| Browser tab title | every page | Virto Commerce | **Company name** |
| Browser tab icon | every page | Virto favicon | **Browser tab icon**, else **Logo mark** |
| Wordmark | sign-in page header | Virto Commerce wordmark (light and dark) | **Logo**, **Logo for dark appearance** |
| Wordmark | Home section's panel (desktop) | Virto wordmark | **Logo**, **Logo for dark appearance** |
| Mark | the rail's top (desktop), the phone's top bar | Virto mark | **Logo mark** |
| "Sign in to … to continue" | sign-in form | Virto Commerce | **Company name** |
| Footer | sign-in page | © year Virto Commerce · Help | © year **Company name** · **Help** · **Support** · **Privacy** · **Terms** |
| Help, Support | avatar menu | — | **Help link**, **Support link** |
| Panel beside the sign-in form | sign-in page, from 1024 px | Virto's product slides and "Learn more at VirtoCommerce.com" | **Sign-in page panel**: Virto's, the company's **slides**, or none |
| Home | the dashboard | widgets only | **Home welcome card** above the widgets |
| Colors | everywhere, light and dark | Virto (and Warm, Blue, Indigo to pick) | **Default theme**, **Users choose their theme**, **theme files** |
| Aria labels | the logo buttons ("…, home") | Virto Commerce | **Company name** |

Not part of the Admin Shell's branding (see [Not covered](#not-covered)): the AngularJS admin opened from the shell, e-mails, and the environment ribbon (Development, Staging, …), which is there on purpose.

### Principles

- **No code, no rebuild.** Low and Medium are settings; High is a file. The shell's build is the same for every customer, so module updates never undo a brand.
- **One source.** The endpoint gives the whole brand at once. The browser keeps a copy, so the first paint shows the brand even before the answer arrives (a slow server waits at most 2.5 s, then the copy is used).
- **Safe by default.** The endpoint is anonymous and gives out only the brand. Links and images must be `https:`, `http:`, `mailto:` or a path on the platform (`javascript:` and other schemes are dropped). A theme file can only set known colors to plain color values: no CSS can be slipped in.
- **Accessible.** Texts stay readable in light and dark: logos have a dark variant, theme files have a dark palette, and a primary without its shades gets them computed (hover, soft backgrounds, ink). The state colors (danger, warning, success) stay the shell's in every theme, so red still means danger.
- **Every screen.** Each element was checked on desktop and on a phone (from 360 px), in light and dark.

---

## Low: name, logos, links

### Requirements

| What | Requirement |
|---|---|
| Permission | `platform:setting:update` (Platform › Settings) |
| Logo | SVG (preferred) or PNG with a transparent background; about **200 × 48 px**, shown 40 px high on the sign-in page and up to 137 × 46 px on Home. Text must be readable on white (light) — give a second logo for dark backgrounds if it isn't. |
| Logo mark | Square SVG or PNG, at least **64 × 64 px**, readable at 24 px: the rail and the phone's top bar |
| Tab icon | ICO, PNG (32 × 32) or SVG. Optional: the mark is used without it. |
| Image hosting | Any `https:` URL the browsers can reach, or a path on the platform. The usual place: **Content › Assets** (upload, then copy the file's URL). |
| Links | `https:` or `mailto:` |

### How to

1. Upload the logo, the dark logo and the mark to **Content › Assets**, for example in a `branding` folder. Copy their URLs (`https://<platform>/assets/branding/logo.svg`).
2. Open **Platform › Settings**, choose **Admin Shell › Branding** in the tree, or search for *Branding*.
3. Fill in:

   | Setting | Name | Example |
   |---|---|---|
   | Company name | `AdminShell.Branding.CompanyName` | `Acme Admin` |
   | Logo | `AdminShell.Branding.LogoUrl` | `https://admin.acme.com/assets/branding/acme-logo.svg` |
   | Logo for dark appearance | `AdminShell.Branding.LogoDarkUrl` | `…/acme-logo-dark.svg` |
   | Logo mark | `AdminShell.Branding.MarkUrl` | `…/acme-mark.svg` |
   | Browser tab icon | `AdminShell.Branding.FaviconUrl` | (empty: the mark) |
   | Help link | `AdminShell.Branding.HelpUrl` | `https://help.acme.com/admin` (empty: no Help) |
   | Support link | `AdminShell.Branding.SupportUrl` | `mailto:admin-support@acme.com` |
   | Privacy policy link | `AdminShell.Branding.PrivacyUrl` | `https://acme.com/privacy` |
   | Terms of use link | `AdminShell.Branding.TermsUrl` | `https://acme.com/terms` |

4. Optionally, under **Admin Shell › Theme**:

   | Setting | Name | Values |
   |---|---|---|
   | Default theme | `AdminShell.Theme.Default` | `virto` (default), `warm`, `blue`, `indigo`, or a theme file's id (High) |
   | Default appearance | `AdminShell.Theme.Appearance` | `system`, `light`, `dark` (default) |
   | Users choose their theme | `AdminShell.Theme.UserChoice` | on (default); off: everyone has the default theme, and the theme pickers in the avatar menu and My profile are gone |

   The defaults apply to the sign-in page and to every user who hasn't picked a theme or appearance. Users keep their own picks while *Users choose their theme* is on.

5. **Save**, then reload the Admin Shell (or open it in a new tab). The sign-in page has the brand too.

To go back to Virto's, empty a field (or use ⟲ *Reset to default* where there is a default). Through the API, send `""` for a text, `[]` for the slides and `{}` for the welcome card: `null` doesn't clear a setting without a default.

The same values can be set by the API (`POST api/platform/settings/v2/global/values`) or shipped with an import (Settings › **Import JSON**), so one brand can move between environments:

```json
{
  "settings": {
    "AdminShell.Branding.CompanyName": "Acme Admin",
    "AdminShell.Branding.LogoUrl": "https://admin.acme.com/assets/branding/acme-logo.svg",
    "AdminShell.Branding.LogoDarkUrl": "https://admin.acme.com/assets/branding/acme-logo-dark.svg",
    "AdminShell.Branding.MarkUrl": "https://admin.acme.com/assets/branding/acme-mark.svg",
    "AdminShell.Branding.SupportUrl": "mailto:admin-support@acme.com",
    "AdminShell.Theme.Default": "blue"
  }
}
```

---

## Medium: the sign-in page and Home

### Requirements

| What | Requirement |
|---|---|
| Permission | `platform:setting:update` |
| Slide image | JPG, PNG, WebP or SVG, about **1200 × 800 px** (the panel is 52–56 % of the screen from 1024 px, under the words or alone). Keep important content top-left: the image is cropped to fit. Optional dark variant. |
| Welcome image | About **320 × 192 px** (shown 160 × 96 on desktop, full width × 120 on a phone) |
| Texts | Short: a chip of 2–4 words, a headline up to ~60 characters, a body up to ~200, up to 3–4 points. Plain text: no HTML or Markdown. |
| Languages | Any text can be one string, or one per language: `{ "en": "Welcome", "de": "Willkommen" }` (the UI's language, then English, then the first) |
| JSON | Valid JSON: the Settings screen checks it and has **Format JSON** |

### The sign-in page's panel

The panel beside the sign-in form shows from 1024 px wide (on a phone the page is the form only). Choose what it shows with **Sign-in page panel** (`AdminShell.SignIn.Showcase`):

| Value | Shows |
|---|---|
| `virto` (default) | Virto Commerce's product slides |
| `custom` | The company's slides from **Sign-in page slides** (Virto's if the list is empty) |
| `none` | Only the form, across the page |

**Sign-in page slides** (`AdminShell.SignIn.Slides`) is a JSON list. Each slide has words and an image, or only an image:

```json
[
  {
    "chip": "Acme Admin",
    "title": { "en": "Everything your team needs, in one place", "de": "Alles, was Ihr Team braucht, an einem Ort" },
    "body": "Orders, catalog and customers for every Acme store.",
    "points": ["Single sign-on with your Acme account", "Help at help.acme.com"],
    "image": "https://admin.acme.com/assets/branding/slide-1.png",
    "imageDark": "https://admin.acme.com/assets/branding/slide-1-dark.png",
    "alt": "The Acme Admin dashboard",
    "link": { "text": "What's new in Acme Admin", "url": "https://acme.com/admin/news" }
  },
  {
    "image": "https://admin.acme.com/assets/branding/campaign.jpg",
    "alt": "Spring campaign"
  }
]
```

| Field | Meaning |
|---|---|
| `chip` | The small label above the headline, with the logo mark |
| `title`, `body`, `points` | The headline, a paragraph and a checked list |
| `image`, `imageDark` | The picture under the words; without words it fills the panel |
| `alt` | The picture's description for screen readers |
| `link` | A link at the bottom of the panel while the slide shows |

Slides change every 7 seconds and pause while the pointer or keyboard focus is on the panel. With *reduce motion* set in the operating system they stay put. Dots let people pick a slide. The panel takes the theme's colors.

### Home's welcome card

**Home welcome card** (`AdminShell.Home.Welcome`) puts the company's message above the widgets on Home: news, a maintenance window, where to get help.

```json
{
  "title": "Welcome to Acme Admin",
  "body": "Spring prices go live on March 1.\nPlease review your catalogs by Friday.",
  "image": "https://admin.acme.com/assets/branding/welcome.png",
  "links": [
    { "text": "Settings", "url": "/apps/admin-shell/#/settings?group=Admin%20Shell%7CHome" },
    { "text": "Help center", "url": "https://help.acme.com/admin" }
  ]
}
```

| Field | Meaning |
|---|---|
| `title`, `body` | The heading and the text; a line break in the text (`\n`) starts a new line |
| `image`, `imageDark` | A picture on the left (on a phone, above) |
| `links` | Buttons; the first is the primary one. A path (`/apps/...`) opens in the same tab, a URL in a new one. |

`{}` hides the card. Each user can dismiss the card; it comes back when its content changes, so a new message is seen.

### Proposed next steps

| Idea | Why | How |
|---|---|---|
| A content source instead of JSON | Marketing edits slides without touching settings | Read the slides and the welcome card from a CMS page (Content › Pages) or a News article, keeping this JSON as the format |
| Several welcome cards with dates | A message that shows from/until a date | `from`/`until` on the card, a list instead of one |
| Per-role welcome card | A message for one team | The card as a role setting, like the role menu layer |

---

## High: a custom color theme

### Requirements

| What | Requirement |
|---|---|
| Access | Write access to the server's file system, or to a volume mounted into the platform's container |
| Skills | A designer's palette: a primary color for light and for dark, ideally the surfaces and inks too. Check contrast: text on surfaces and on the primary at least **4.5:1** (WCAG AA). |
| File | `{id}.json`: the id (file name) in lowercase letters, digits and dashes, up to 32 characters, not `virto`, `warm`, `blue` or `indigo`; up to 64 KB; at most 20 theme files |
| Platform | The Admin Shell module of this version or later |

### How to

1. Start from the sample [`docs/branding/acme-green.json`](branding/acme-green.json):

   ```json
   {
     "name": "Acme Green",
     "base": "indigo",
     "light": { "primary": "#0f7a55", "link": "#0b6b4a" },
     "dark":  { "primary": "#4cc59a", "link": "#6fd3ad" }
   }
   ```

2. Save it in the themes folder: **`app_data/admin-shell/themes/`** under the platform's folder, for example `C:\vc-platform\app_data\admin-shell\themes\acme-green.json`. Another folder (a mounted volume, a shared drive) is set in `appsettings.json`:

   ```json
   { "AdminShell": { "ThemesPath": "/mnt/branding/themes" } }
   ```

   A relative path is under the platform's folder.

3. Within half a minute, reload the Admin Shell: **Acme Green** is in the theme list of the avatar menu and of My profile, with its colors as its mark.
4. To make it everyone's theme, set **Default theme** (`AdminShell.Theme.Default`) to `acme-green`. Also turn off **Users choose their theme** to make it the only one.

### The theme file

| Field | Meaning |
|---|---|
| `name` | The name in the theme lists (up to 40 characters); default: the id |
| `base` | The built-in palette the theme starts from: `indigo` (neutral grey, default), `blue` (cool) or `warm` (beige). The colors the file doesn't set are the base's. |
| `light`, `dark` | The colors of each appearance (see the palette below). Give both: users switch between light and dark. |

**A primary is enough.** When a mode sets `primary` but not its shades, they follow it: `primary-hover` (a little darker in light, lighter in dark), `primary-soft` and `select` (tinted backgrounds), `primary-ink` (text on those), `focus` and `on-primary`. Set any of them to override.

**Palette keys** (the same for `light` and `dark`):

| Key | Used for |
|---|---|
| `bg` | The app's ground: behind the blades, the rail |
| `plate` | Cards, blades, dialogs, the menu panel |
| `panel` | Slightly tinted surfaces: table stripes, the tree, section headers |
| `sunken` | Inputs' and tiles' backgrounds |
| `select` | Selected rows and menu items |
| `line`, `line-soft` | Borders and dividers |
| `ink`, `ink-2` | Text and headings; secondary text |
| `muted`, `faint` | Hints, placeholders, disabled text |
| `primary`, `primary-hover` | Buttons, links in the menu, the active item, focus rings |
| `on-primary` | Text on a primary button |
| `primary-soft`, `primary-ink` | A tinted background and the text on it (selected menu item) |
| `link`, `focus` | Links; the keyboard focus ring |
| `chip` | Chips and segmented controls |
| `shade` | Shadows (a color with alpha) |

Values are plain colors: `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`/`rgba()`, `hsl()`/`hsla()`, or a color name. Anything else is skipped and logged as a warning in the platform's log. So is an unknown key, a file with a bad name, or invalid JSON.

### How it works

`styles/_themes.scss` turns a palette (`--as-p-*` variables) into all the shell's tokens: its chrome (`--as-*`), its colors (`--color-*`), and vc-shell's palette (`--primary-*`, `--neutrals-*`). The built-in themes are palettes in the stylesheet. A theme file's theme is set on `<html>` as `data-color-theme="acme-green"` with `data-color-base="indigo"`: the base's palette applies, then a small style the shell writes from the file (`<style id="as-theme-files">`) overrides the colors the file sets. Every screen, including module plugins, follows without knowing the theme.

### Virto Cloud and containers

The themes folder must be on the server or on a volume the platform sees. On Docker or Kubernetes, mount a volume (or a ConfigMap) at the folder and point `AdminShell:ThemesPath` at it. On a managed environment without file access, the theme files have to be added with the environment's deployment; until then, a built-in theme (Low) is the way.

---

## Reference

### Endpoint

`GET api/admin-shell/branding`: anonymous, not cached by the browser.

```json
{
  "companyName": "Acme Admin",
  "logoUrl": "https://…/acme-logo.svg",
  "logoDarkUrl": "https://…/acme-logo-dark.svg",
  "markUrl": "https://…/acme-mark.svg",
  "faviconUrl": null,
  "links": { "help": "https://…", "support": "mailto:…", "privacy": null, "terms": null },
  "signIn": { "showcase": "custom", "slides": [ … ] },
  "home": { "welcome": { … } },
  "theme": {
    "default": "acme-green",
    "appearance": "light",
    "userChoice": true,
    "custom": [ { "id": "acme-green", "name": "Acme Green", "base": "indigo", "light": { … }, "dark": { … } } ]
  }
}
```

A default theme that doesn't exist (a removed file) falls back to `virto`. A user's pick of a removed theme shows the default theme until the file is back.

### Settings

| Name | Type | Default | Level |
|---|---|---|---|
| `AdminShell.Branding.CompanyName` | ShortText | (Virto Commerce) | Low |
| `AdminShell.Branding.LogoUrl` | ShortText | (Virto's) | Low |
| `AdminShell.Branding.LogoDarkUrl` | ShortText | (the logo) | Low |
| `AdminShell.Branding.MarkUrl` | ShortText | (Virto's) | Low |
| `AdminShell.Branding.FaviconUrl` | ShortText | (the mark) | Low |
| `AdminShell.Branding.HelpUrl` | ShortText | Virto's user guide | Low |
| `AdminShell.Branding.SupportUrl`, `PrivacyUrl`, `TermsUrl` | ShortText | — | Low |
| `AdminShell.Theme.Default` | ShortText | `virto` | Low / High |
| `AdminShell.Theme.Appearance` | `system` / `light` / `dark` | `dark` | Low |
| `AdminShell.Theme.UserChoice` | Boolean | on | Low |
| `AdminShell.SignIn.Showcase` | `virto` / `custom` / `none` | `virto` | Medium |
| `AdminShell.SignIn.Slides` | Json | `[]` | Medium |
| `AdminShell.Home.Welcome` | Json | `{}` | Medium |

`AdminShell.UI.Theme`, the user's theme, no longer has a fixed list of values, so it can hold a theme file's id.

## Not covered

| Part | Today | Next step |
|---|---|---|
| The AngularJS admin (opened from the shell for screens not moved yet) | Its own branding: the platform's `VirtoCommerce.Platform.UI.Customization` setting | Read the Admin Shell's brand there too, or retire the screens |
| E-mails (password reset, invitations) | The platform's notification templates | Brand them in Notifications |
| Fonts, corner radius | The shell's | A `font` and `radius` in the theme file |
| The sign-in page's background and layout | Fixed | A background image setting |
| The environment ribbon | Shown on purpose on non-production hosts | — |

## Testing

Check each level on a desktop (1440 px) and a phone (375 px), in light and dark:

1. **Low.** Set the name, the logos, the mark and the links. Sign out: the sign-in page shows the logo (and the dark logo in dark), "Sign in to *name* to continue", and © *name* with the links. Sign in: the tab title and icon, the mark at the top of the rail and in the phone's top bar, the logo on Home's panel, Help and Support in the avatar menu.
2. **Theme defaults.** Set *Default theme* to `blue` and *Default appearance* to `light`: a browser with no pick (a private window) gets them on the sign-in page and after signing in. Turn off *Users choose their theme*: the theme pickers are gone and everyone has the default.
3. **Medium.** Set *Sign-in page panel* to `custom` with two slides: the panel shows them (from 1024 px), changes every 7 s, pauses on hover, and the dots pick a slide; a slide with only an image fills the panel. `none`: the form only. Set the welcome card: it's above the widgets on Home, and Dismiss hides it until its content changes.
4. **High.** Put the sample theme file in the themes folder: *Acme Green* is in the avatar menu and in My profile with its mark. Pick it: the rail, buttons, selection and focus are green, in light and dark. Break the file (a non-color value): that color is skipped, and the platform log names it.
5. **Safety.** A `javascript:` link or image in any setting is not shown.
