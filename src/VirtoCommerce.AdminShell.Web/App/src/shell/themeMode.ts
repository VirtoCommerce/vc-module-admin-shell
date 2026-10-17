import { useLanguages, useTheme, useUser } from "@vc-shell/framework";
import { usePreferredDark, useStorage } from "@vueuse/core";
import { computed, effectScope, watch } from "vue";
import { useI18n } from "vue-i18n";
import { request } from "../api/http";
import { branding, themeSwatch } from "./branding";

export const THEME_MODES = ["system", "light", "dark"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

// vc-shell knows light and dark; "system" follows the OS on top of it. The user's pick lives in the user's profile
// (below); this browser keeps a copy for the sign-in page and the first paint. Only a pick is stored ("" until there is
// one; the old key, "adminShell.themeMode", stored the default on every first visit).
const pickedMode = useStorage<ThemeMode | "">("adminShell.theme", "", undefined, { writeDefaults: false });

/** The built-in color themes (styles/_themes.scss): Virto, the shell's own palette, has no attribute */
export const COLOR_THEMES = ["virto", "warm", "blue", "indigo"] as const;
/** A built-in theme's id, or a theme file's (shell/branding.ts) */
export type ColorTheme = string;

// in the profile too, with the browser's copy
const pickedTheme = useStorage<string>("adminShell.colorTheme", "", undefined, { writeDefaults: false });

/** The color themes there are: the built-ins, then the installation's theme files */
export const colorThemeIds = computed(() => [...COLOR_THEMES, ...branding.value.theme.custom.map((x) => x.id)]);
const isTheme = (id: string) => colorThemeIds.value.includes(id);

/** A theme as the pickers show it: its name (a built-in's from the translations) and its mark */
export interface ColorThemeOption {
  id: string;
  /** a theme file's name; a built-in's title is SHELL.USER_MENU.COLOR_THEMES.<ID> */
  name?: string;
  swatchClass: string;
  swatchStyle?: Record<string, string>;
}

/** The pickers' themes: the built-ins, then the theme files' */
export const colorThemeOptions = computed<ColorThemeOption[]>(() => [
  ...COLOR_THEMES.map((id) => ({ id, swatchClass: `as-um__swatch--${id}` })),
  ...branding.value.theme.custom.map((x) => ({ id: x.id, name: x.name, swatchClass: "", swatchStyle: themeSwatch(x) })),
]);

/** Users pick their theme, unless the installation gives everyone its default (AdminShell.Theme.UserChoice) */
export const themeChoice = computed(() => branding.value.theme.userChoice);

/**
 * The appearance in use: the user's pick, else the installation's default (AdminShell.Theme.Appearance). Setting it is
 * the user's pick.
 */
export const themeMode = computed<ThemeMode>({
  get: () => pickedMode.value || branding.value.theme.appearance,
  set: (mode) => (pickedMode.value = mode),
});

/**
 * The color theme in use: the user's pick (a theme there still is), else the installation's default
 * (AdminShell.Theme.Default); always the default when users don't choose. Setting it is the user's pick.
 */
export const colorTheme = computed<ColorTheme>({
  get: () => {
    const fallback = isTheme(branding.value.theme.default) ? branding.value.theme.default : "virto";
    if (!themeChoice.value) return fallback;
    return pickedTheme.value && isTheme(pickedTheme.value) ? pickedTheme.value : fallback;
  },
  set: (theme) => (pickedTheme.value = theme),
});

// data-color-theme on <html> next to vc-shell's data-theme (none for Virto); a theme file's theme also names the built-in
// palette it starts from (data-color-base)
function applyColorTheme(theme: string) {
  const root = document.documentElement;
  const file = branding.value.theme.custom.find((x) => x.id === theme);
  if (theme !== "virto" && isTheme(theme)) root.dataset.colorTheme = theme;
  else delete root.dataset.colorTheme;
  if (file) root.dataset.colorBase = file.base || "indigo";
  else delete root.dataset.colorBase;
}

let started = false;

// anything else stored reads as the default, dark
function themeFor(mode: ThemeMode, dark: boolean) {
  if (mode === "system") return dark ? "dark" : "light";
  return mode === "light" ? "light" : "dark";
}

/* ---- the user's profile: the appearance and theme (the module's per-user settings, ModuleConstants.Settings.
   UserAppearance and UserTheme) and the language (the platform's, shared with the AngularJS admin and the profile blade),
   through the platform's Settings v2 "me" values, so they follow the user to every browser and device ---- */

const ME_VALUES = "/api/platform/settings/v2/me/values";
const APPEARANCE = "AdminShell.UI.Appearance";
const THEME = "AdminShell.UI.Theme";
export const LANGUAGE = "VirtoCommerce.Platform.UI.Language";

type Prefs = Record<typeof APPEARANCE | typeof THEME | typeof LANGUAGE, string>;

let profileUser: string | undefined; // the user whose profile is read (saves wait for it)
let stored: Partial<Prefs> = {}; // what the profile holds
let loading = false;
let pickedWhileLoading = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let currentPrefs: () => Prefs = () => ({ [APPEARANCE]: pickedMode.value, [THEME]: pickedTheme.value, [LANGUAGE]: "" });

/**
 * Reads the signed-in user's preferences and applies them: the profile wins over this browser's copy (another user's
 * maybe). Only what the user picked (modifiedOnly): without a pick the installation's default applies. The language
 * applies when the shell has it (the platform's list is longer).
 */
async function loadProfile(
  userId: string,
  setLanguage: (lang: string) => void,
  hasLanguage: (lang: string) => boolean,
) {
  profileUser = undefined;
  loading = true;
  pickedWhileLoading = false;
  try {
    const [look, platform] = await Promise.all([
      request<Record<string, unknown>>("GET", `${ME_VALUES}?moduleId=VirtoCommerce.AdminShell&modifiedOnly=true`),
      request<Record<string, unknown>>("GET", `${ME_VALUES}?moduleId=Platform&modifiedOnly=true`).catch(
        () => ({}) as Record<string, unknown>,
      ),
    ]);
    profileUser = userId;
    const mode = look?.[APPEARANCE] as ThemeMode;
    const theme = look?.[THEME];
    const language = platform?.[LANGUAGE];
    // a theme file's theme stays the user's pick even while the file is gone: it comes back with the file
    stored = {
      [APPEARANCE]: THEME_MODES.includes(mode) ? mode : pickedMode.value,
      [THEME]: typeof theme === "string" && theme ? theme : pickedTheme.value,
      [LANGUAGE]: typeof language === "string" ? language : undefined,
    };
    // a pick made while the profile was loading wins, and is saved
    if (pickedWhileLoading) saveSoon();
    else {
      pickedMode.value = stored[APPEARANCE] as ThemeMode | "";
      pickedTheme.value = stored[THEME] ?? "";
      if (stored[LANGUAGE] && hasLanguage(stored[LANGUAGE])) setLanguage(stored[LANGUAGE]);
    }
  } catch {
    // an older platform without these settings, or no access: this browser's copy stays
  } finally {
    loading = false;
  }
}

// a few picks in a row are saved once; only what changed goes back
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (!profileUser) return;
    const prefs = currentPrefs();
    const changed = Object.fromEntries(
      Object.entries(prefs).filter(([name, value]) => value && value !== stored[name as keyof Prefs]),
    );
    if (!Object.keys(changed).length) return;
    try {
      await request("POST", ME_VALUES, changed);
      stored = { ...stored, ...changed };
    } catch {
      // kept in this browser; the next change tries again
    }
  }, 400);
}

/** Applies the mode to vc-shell's theme and the color theme to the page, and keeps them in the user's profile; call once
 * from the app root */
export function useThemeMode() {
  if (started) return;
  started = true;
  const { setTheme } = useTheme();
  // detached scope: outlives the component (Login or App) that started it
  effectScope(true).run(() => {
    const prefersDark = usePreferredDark();
    watch(
      [themeMode, prefersDark],
      ([mode, dark]) => setTheme(themeFor(mode, dark)),
      { immediate: true },
    );
    // again when the branding arrives: a theme file names its base palette
    watch([colorTheme, branding], () => applyColorTheme(colorTheme.value), { immediate: true });

    const { user } = useUser();
    const { currentLocale, setLocale } = useLanguages();
    const i18n = useI18n({ useScope: "global" });
    currentPrefs = () => ({
      [APPEARANCE]: pickedMode.value,
      [THEME]: pickedTheme.value,
      [LANGUAGE]: currentLocale.value,
    });
    watch(
      () => user.value?.id,
      (userId) => {
        if (userId) loadProfile(userId, setLocale, (lang) => i18n.availableLocales.includes(lang));
        else profileUser = undefined;
      },
      { immediate: true },
    );
    watch([pickedMode, pickedTheme, currentLocale], () => {
      if (loading) pickedWhileLoading = true;
      else if (profileUser) saveSoon();
    });
  });
}
