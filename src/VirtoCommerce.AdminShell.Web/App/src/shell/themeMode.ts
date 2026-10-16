import { useLanguages, useTheme, useUser } from "@vc-shell/framework";
import { usePreferredDark, useStorage } from "@vueuse/core";
import { effectScope, watch } from "vue";
import { useI18n } from "vue-i18n";
import { request } from "../api/http";

export const THEME_MODES = ["system", "light", "dark"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

// vc-shell knows light and dark; "system" follows the OS on top of it. The user's choice lives in the user's profile
// (below); this browser keeps a copy for the sign-in page and the first paint. Dark until the user picks one, and only a
// pick is stored (the old key, "adminShell.themeMode", stored the default on every first visit).
export const themeMode = useStorage<ThemeMode>("adminShell.theme", "dark", undefined, { writeDefaults: false });

/** The color themes (styles/_themes.scss): Virto, the shell's own palette, is the default */
export const COLOR_THEMES = ["virto", "warm", "blue", "indigo"] as const;
export type ColorTheme = (typeof COLOR_THEMES)[number];

// in the profile too, with the browser's copy; the default isn't stored
export const colorTheme = useStorage<ColorTheme>("adminShell.colorTheme", "virto", undefined, { writeDefaults: false });

// data-color-theme on <html> next to vc-shell's data-theme; none for the default, or for anything unknown stored
function applyColorTheme(theme: string) {
  const root = document.documentElement;
  if (theme !== "virto" && (COLOR_THEMES as readonly string[]).includes(theme)) root.dataset.colorTheme = theme;
  else delete root.dataset.colorTheme;
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
let currentPrefs: () => Prefs = () => ({ [APPEARANCE]: themeMode.value, [THEME]: colorTheme.value, [LANGUAGE]: "" });

/**
 * Reads the signed-in user's preferences and applies them: the profile wins over this browser's copy (another user's
 * maybe). The language applies when the shell has it (the platform's list is longer).
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
      request<Record<string, unknown>>("GET", `${ME_VALUES}?moduleId=VirtoCommerce.AdminShell`),
      request<Record<string, unknown>>("GET", `${ME_VALUES}?moduleId=Platform`).catch(
        () => ({}) as Record<string, unknown>,
      ),
    ]);
    profileUser = userId;
    const mode = look?.[APPEARANCE] as ThemeMode;
    const theme = look?.[THEME] as ColorTheme;
    const language = platform?.[LANGUAGE];
    stored = {
      [APPEARANCE]: THEME_MODES.includes(mode) ? mode : themeMode.value,
      [THEME]: COLOR_THEMES.includes(theme) ? theme : colorTheme.value,
      [LANGUAGE]: typeof language === "string" ? language : undefined,
    };
    // a pick made while the profile was loading wins, and is saved
    if (pickedWhileLoading) saveSoon();
    else {
      themeMode.value = stored[APPEARANCE] as ThemeMode;
      colorTheme.value = stored[THEME] as ColorTheme;
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
    watch(colorTheme, applyColorTheme, { immediate: true });

    const { user } = useUser();
    const { currentLocale, setLocale } = useLanguages();
    const i18n = useI18n({ useScope: "global" });
    currentPrefs = () => ({
      [APPEARANCE]: themeMode.value,
      [THEME]: colorTheme.value,
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
    watch([themeMode, colorTheme, currentLocale], () => {
      if (loading) pickedWhileLoading = true;
      else if (profileUser) saveSoon();
    });
  });
}
