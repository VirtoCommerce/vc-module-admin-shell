/**
 * The user's regional format and time zone (profile settings VirtoCommerce.Platform.UI.RegionalFormat and TimeZone,
 * shared with the AngularJS admin), for the dates and numbers the shell and module plugins show. The profile page edits
 * them; this file reads them when a user signs in and again after the profile saves them, and the formatters below use
 * them. A profile without a choice, or with one Intl rejects, gets this browser's locale and zone (shell/regionalFormat.ts).
 *
 * Plugins reach it through the app (they can't import the host's code): app.config.globalProperties.$regional, or
 * inject(REGIONAL_SETTINGS_KEY). vc-shell's own components (data table date and money cells, the date picker,
 * notifications) take neither: they use the browser's language and zone.
 */
import { useUser } from "@vc-shell/framework";
import { effectScope, readonly, shallowRef, watch, type App, type Ref } from "vue";
import { request } from "../api/http";
import {
  effectiveRegional,
  formatDateIn,
  formatNumberIn,
  regionalOfProfile,
  type EffectiveRegional,
  type ProfileSetting,
} from "./regionalFormat";

type DateValue = Date | string | number | null | undefined;

export interface RegionalSettings {
  /** The locale dates and numbers use (BCP 47, "en-US"), reactive */
  locale: Readonly<Ref<string>>;
  /** The time zone dates use (IANA, "Europe/Berlin"), reactive */
  timeZone: Readonly<Ref<string>>;
  /** A date in the user's format and zone; "medium" date style by default. "" for no or an invalid date */
  formatDate: (value: DateValue, options?: Intl.DateTimeFormatOptions) => string;
  /** A date and time in the user's format and zone; "medium" date, "short" time by default */
  formatDateTime: (value: DateValue, options?: Intl.DateTimeFormatOptions) => string;
  /** A number in the user's format */
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  /** Reads the settings from the profile again (after a change saved elsewhere) */
  reload: () => Promise<void>;
}

/** The injection key module plugins use: inject(REGIONAL_SETTINGS_KEY) */
export const REGIONAL_SETTINGS_KEY = "adminShell.regionalSettings";

declare module "vue" {
  interface ComponentCustomProperties {
    $regional: RegionalSettings;
  }
}

const current = shallowRef<EffectiveRegional>(effectiveRegional(undefined, undefined));
const locale = shallowRef(current.value.locale);
const timeZone = shallowRef(current.value.timeZone);

function apply(next: EffectiveRegional) {
  current.value = next;
  locale.value = next.locale;
  timeZone.value = next.timeZone;
}

let generation = 0;

/** Reads the signed-in user's choice from the profile; this browser's locale and zone until then, and if it fails */
export async function loadRegionalSettings(): Promise<void> {
  const mine = ++generation;
  try {
    const profile = await request<{ settings?: ProfileSetting[] }>("GET", "/api/platform/profiles/currentuser");
    if (mine === generation) apply(regionalOfProfile(profile));
  } catch {
    // not signed in, or the platform didn't answer: the browser's
    if (mine === generation) apply(effectiveRegional(undefined, undefined));
  }
}

/** Back to this browser's locale and zone (signed out) */
function reset() {
  generation++;
  apply(effectiveRegional(undefined, undefined));
}

export const regionalSettings: RegionalSettings = {
  locale: readonly(locale),
  timeZone: readonly(timeZone),
  formatDate: (value, options) => formatDateIn(current.value, value, options),
  formatDateTime: (value, options = { dateStyle: "medium", timeStyle: "short" }) =>
    formatDateIn(current.value, value, options),
  formatNumber: (value, options) => formatNumberIn(current.value, value, options),
  reload: loadRegionalSettings,
};

/** The shell's own code: the same object plugins get */
export const useRegionalSettings = () => regionalSettings;

/** Makes the settings available to module plugins and follows the signed-in user; called once from main.ts */
export function installRegionalSettings(app: App) {
  app.provide(REGIONAL_SETTINGS_KEY, regionalSettings);
  app.config.globalProperties.$regional = regionalSettings;

  effectScope(true).run(() => {
    const { user } = useUser();
    watch(
      () => user.value?.id,
      (id, previous) => {
        if (id === previous) return;
        if (id) void loadRegionalSettings();
        else reset();
      },
      { immediate: true },
    );
  });
}
