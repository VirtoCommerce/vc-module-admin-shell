/**
 * White-labeling (docs/branding.md): the installation's brand, read once at startup from the module
 * (GET api/admin-shell/branding, anonymous, so the sign-in page has it too) and applied to the page: the name in the
 * browser tab, the favicon and the theme files' themes. The screens read `branding` for logos, links and texts.
 *
 * Low effort: the brand settings (name, logos, links). Medium: the sign-in page's slides and Home's welcome card.
 * High: theme files in the themes folder, turned here into a style of --as-p-* palette colors (styles/_themes.scss).
 */
import { computed, shallowRef } from "vue";
import { i18n } from "@vc-shell/framework";
import { request } from "../api/http";

/** A text in one language, or in several: { "en": "...", "de": "..." } */
export type BrandText = string | Record<string, string>;

export interface BrandLink {
  text?: BrandText;
  url?: string;
}

export interface BrandSlide {
  chip?: BrandText;
  title?: BrandText;
  body?: BrandText;
  points?: BrandText[];
  image?: string;
  imageDark?: string;
  alt?: BrandText;
  link?: BrandLink;
}

export interface BrandWelcome {
  title?: BrandText;
  body?: BrandText;
  image?: string;
  imageDark?: string;
  links?: BrandLink[];
}

export type Palette = Record<string, string>;

export interface CustomTheme {
  id: string;
  name: string;
  /** the built-in palette it starts from: warm, blue or indigo */
  base: string;
  light: Palette;
  dark: Palette;
}

export interface Branding {
  companyName?: string;
  logoUrl?: string;
  logoDarkUrl?: string;
  markUrl?: string;
  faviconUrl?: string;
  links: { help?: string; support?: string; privacy?: string; terms?: string };
  signIn: { showcase: "virto" | "custom" | "none"; slides: BrandSlide[] };
  home: { welcome?: BrandWelcome | null };
  theme: { default: string; appearance: "system" | "light" | "dark"; userChoice: boolean; custom: CustomTheme[] };
}

export const DEFAULT_COMPANY = "Virto Commerce";
const DEFAULT_HELP = "https://docs.virtocommerce.org/platform/user-guide/latest/getting-started/";

const defaults = (): Branding => ({
  links: { help: DEFAULT_HELP },
  signIn: { showcase: "virto", slides: [] },
  home: { welcome: null },
  theme: { default: "virto", appearance: "dark", userChoice: true, custom: [] },
});

// this browser's copy of the last branding: the first paint when the module is slow or unreachable
const CACHE_KEY = "adminShell.branding";

function cached(): Branding | undefined {
  try {
    const text = localStorage.getItem(CACHE_KEY);
    return text ? normalize(JSON.parse(text)) : undefined;
  } catch {
    return undefined;
  }
}

/** The branding in use: the shell's own until loadBranding() has read the installation's */
export const branding = shallowRef<Branding>(cached() ?? defaults());

/** The company's name, or Virto Commerce */
export const companyName = computed(() => branding.value.companyName || DEFAULT_COMPANY);

function normalize(value: Partial<Branding> | null | undefined): Branding {
  const base = defaults();
  if (!value || typeof value !== "object") return base;
  const showcase = value.signIn?.showcase;
  const appearance = value.theme?.appearance;
  return {
    ...base,
    ...value,
    links: { ...base.links, ...value.links },
    signIn: {
      showcase: showcase === "custom" || showcase === "none" ? showcase : "virto",
      slides: Array.isArray(value.signIn?.slides) ? value.signIn.slides.filter((x) => x && typeof x === "object") : [],
    },
    home: { welcome: value.home?.welcome && typeof value.home.welcome === "object" ? value.home.welcome : null },
    theme: {
      default: value.theme?.default || "virto",
      appearance: appearance === "system" || appearance === "light" ? appearance : "dark",
      userChoice: value.theme?.userChoice !== false,
      custom: Array.isArray(value.theme?.custom) ? value.theme.custom : [],
    },
  };
}

/**
 * Reads the installation's branding; called once before the app mounts, beside loading the user. Waits `timeoutMs` at
 * most: a slow answer still lands, the page just starts with the copy kept in this browser.
 */
export async function loadBranding(timeoutMs = 2500) {
  const load = request<Branding>("GET", "/api/admin-shell/branding")
    .then((value) => {
      branding.value = normalize(value);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(branding.value));
      } catch {
        // private mode or full storage: no copy
      }
    })
    .catch(() => {
      // an older module or no connection: the copy or the shell's own
    })
    .finally(applyBranding);
  await Promise.race([load, new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
  applyBranding();
}

/* ---- the page: the tab's title and icon, the theme files' style ---- */

function applyBranding() {
  const b = branding.value;
  document.title = companyName.value;
  const favicon = safeUrl(b.faviconUrl) ?? safeUrl(b.markUrl);
  if (favicon) {
    document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']").forEach((link) => link.remove());
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = favicon;
    document.head.appendChild(link);
  }
  applyThemeStyle(b.theme.custom);
}

// the defaults a theme file may leave out, from its primary color and the base palette's plate (light, dark)
const DERIVED: Record<"light" | "dark", Palette> = {
  light: {
    "primary-hover": "color-mix(in srgb, var(--as-p-primary) 86%, #000000)",
    "primary-soft": "color-mix(in srgb, var(--as-p-primary) 12%, var(--as-p-plate))",
    select: "color-mix(in srgb, var(--as-p-primary) 16%, var(--as-p-plate))",
    "primary-ink": "color-mix(in srgb, var(--as-p-primary) 72%, #000000)",
    focus: "var(--as-p-primary)",
    "on-primary": "#ffffff",
  },
  dark: {
    "primary-hover": "color-mix(in srgb, var(--as-p-primary) 82%, #ffffff)",
    "primary-soft": "color-mix(in srgb, var(--as-p-primary) 18%, var(--as-p-plate))",
    select: "color-mix(in srgb, var(--as-p-primary) 22%, var(--as-p-plate))",
    "primary-ink": "color-mix(in srgb, var(--as-p-primary) 65%, #ffffff)",
    focus: "var(--as-p-primary)",
    "on-primary": "var(--as-p-bg)",
  },
};

/** The CSS of a theme file's theme: its colors over its base palette's (the server keeps only colors) */
export function themeCss(theme: CustomTheme) {
  const block = (mode: "light" | "dark") => {
    const colors = theme[mode] ?? {};
    // a new primary without its shades would sit on the base palette's: the shades follow the primary
    const derived = colors.primary ? DERIVED[mode] : {};
    const all = { ...derived, ...colors };
    return Object.entries(all)
      .filter(([key]) => /^[a-z0-9-]+$/.test(key))
      .map(([key, value]) => `  --as-p-${key}: ${value};`)
      .join("\n");
  };
  const id = CSS.escape(theme.id);
  return [
    `:root[data-color-theme="${id}"]:not([data-theme="dark"]) {\n${block("light")}\n}`,
    `:root[data-color-theme="${id}"][data-theme="dark"] {\n${block("dark")}\n}`,
  ].join("\n");
}

function applyThemeStyle(themes: CustomTheme[]) {
  const id = "as-theme-files";
  let style = document.getElementById(id) as HTMLStyleElement | null;
  if (!themes.length) {
    style?.remove();
    return;
  }
  if (!style) {
    style = document.createElement("style");
    style.id = id;
    document.head.appendChild(style);
  }
  style.textContent = themes.map(themeCss).join("\n");
}

/* ---- helpers for the screens ---- */

/** A link or an image the brand gives: http(s), mailto:, or a path on this site; anything else (javascript:) is dropped */
export function safeUrl(url?: string | null) {
  const value = url?.trim();
  if (!value) return undefined;
  if (/^(https?:|mailto:)/i.test(value) || /^\/(?!\/)/.test(value)) return value;
  return undefined;
}

/** A brand text in the UI's language: the language's, then English, then the first */
export function brandText(text?: BrandText | null) {
  if (!text) return "";
  if (typeof text === "string") return text;
  const locale = String((i18n.global.locale as unknown as { value?: string }).value ?? i18n.global.locale ?? "en");
  return text[locale] ?? text[locale.split("-")[0]] ?? text.en ?? Object.values(text)[0] ?? "";
}

/** The logo for the appearance; undefined when the brand has none (the shell's own shows) */
export const brandLogo = (dark: boolean) =>
  safeUrl(dark ? branding.value.logoDarkUrl || branding.value.logoUrl : branding.value.logoUrl);

/** The square mark; undefined when the brand has none */
export const brandMark = () => safeUrl(branding.value.markUrl);

// the built-in palettes' primary colors (styles/_themes.scss), light and dark: a theme file's swatch without its own
const BASE_PRIMARY: Record<string, [string, string]> = {
  warm: ["#7a4a2a", "#c8a17d"],
  blue: ["#237aa5", "#5fb3e0"],
  indigo: ["#4a63e0", "#61afef"],
};

/** A theme file's swatch (its primary in light and dark), as the variables of the .as-um__swatch mark */
export function themeSwatch(theme: CustomTheme): Record<string, string> {
  const [light, dark] = BASE_PRIMARY[theme.base] ?? BASE_PRIMARY.indigo;
  return { "--as-swatch-light": theme.light?.primary ?? light, "--as-swatch-dark": theme.dark?.primary ?? dark };
}
