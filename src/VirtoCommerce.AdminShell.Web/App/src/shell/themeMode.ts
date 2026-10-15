import { useTheme } from "@vc-shell/framework";
import { usePreferredDark, useStorage } from "@vueuse/core";
import { effectScope, watch } from "vue";

export type ThemeMode = "system" | "light" | "dark";

// vc-shell knows light and dark; "system" follows the OS on top of it. A per-browser choice, like vc-shell's own.
// Dark until the user picks one, and only a pick is stored (the old key, "adminShell.themeMode", stored the default
// on every first visit, so its "system" said nothing about a choice).
export const themeMode = useStorage<ThemeMode>("adminShell.theme", "dark", undefined, { writeDefaults: false });

let started = false;

// anything else stored reads as the default, dark
function themeFor(mode: ThemeMode, dark: boolean) {
  if (mode === "system") return dark ? "dark" : "light";
  return mode === "light" ? "light" : "dark";
}

/** Applies the mode to vc-shell's theme; call once from the app root */
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
  });
}
