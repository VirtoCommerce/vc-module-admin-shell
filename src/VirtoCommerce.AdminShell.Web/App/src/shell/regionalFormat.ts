// The rules for the user's regional format and time zone (shell/regionalSettings.ts applies them). No imports: the
// tests run them on Node's own test runner.

/** The profile settings that hold the user's choice (the platform's, shared with the AngularJS admin) */
export const REGIONAL_FORMAT_SETTING = "VirtoCommerce.Platform.UI.RegionalFormat";
export const TIME_ZONE_SETTING = "VirtoCommerce.Platform.UI.TimeZone";

/** A profile setting as GET /api/platform/profiles/currentuser returns it */
export interface ProfileSetting {
  name?: string;
  value?: unknown;
  defaultValue?: unknown;
}

/** The locale and time zone that dates and numbers use */
export interface EffectiveRegional {
  /** a BCP 47 tag Intl takes ("en-US") */
  locale: string;
  /** an IANA zone Intl takes ("Europe/Berlin") */
  timeZone: string;
}

/**
 * A stored regional format as a tag Intl takes, or undefined when there is none or it isn't a locale. The platform
 * stores lower case with a dash ("en-us"); older values have an underscore ("af_ZA"). Intl's canonical form restores
 * the case ("en-US", "zh-Hans-CN").
 */
export function normalizeLocale(code: unknown): string | undefined {
  if (typeof code !== "string") return undefined;
  const tag = code.trim().replace(/_/g, "-");
  if (!tag) return undefined;
  try {
    return Intl.getCanonicalLocales(tag)[0];
  } catch {
    return undefined;
  }
}

/** A stored time zone when Intl takes it, else undefined (an unknown or removed zone) */
export function normalizeTimeZone(zone: unknown): string | undefined {
  if (typeof zone !== "string") return undefined;
  const id = zone.trim();
  if (!id) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: id });
    return id;
  } catch {
    return undefined;
  }
}

/** This browser's locale: the language it asks pages for */
export const browserLocale = (): string =>
  normalizeLocale(globalThis.navigator?.language) ?? Intl.DateTimeFormat().resolvedOptions().locale;

/** This browser's zone: the operating system's */
export const browserTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * The locale and time zone to use: the user's choice when Intl takes it, else this browser's (a format or zone the
 * profile doesn't set, or one Intl rejects).
 */
export function effectiveRegional(
  regionalFormat: unknown,
  timeZone: unknown,
  browser: Partial<EffectiveRegional> = {},
): EffectiveRegional {
  return {
    locale: normalizeLocale(regionalFormat) ?? browser.locale ?? browserLocale(),
    timeZone: normalizeTimeZone(timeZone) ?? browser.timeZone ?? browserTimeZone(),
  };
}

/**
 * A setting's value in the profile: the user's choice only. Without one the browser's applies, not the platform's
 * default (RegionalFormat defaults to "en", which would drop the browser's region), as in the AngularJS admin.
 */
function settingValue(settings: ProfileSetting[] | undefined, name: string): unknown {
  return settings?.find((s) => s.name === name)?.value ?? undefined;
}

/** The effective locale and time zone of a profile (its settings) */
export function regionalOfProfile(
  profile: { settings?: ProfileSetting[] } | undefined,
  browser: Partial<EffectiveRegional> = {},
): EffectiveRegional {
  return effectiveRegional(
    settingValue(profile?.settings, REGIONAL_FORMAT_SETTING),
    settingValue(profile?.settings, TIME_ZONE_SETTING),
    browser,
  );
}

/** A date for Intl: undefined for nothing or an invalid date */
export function toDate(value: Date | string | number | null | undefined): Date | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Formats a date in a locale and zone; `options` may name their own zone (a license's calendar date is UTC) */
export function formatDateIn(
  regional: EffectiveRegional,
  value: Date | string | number | null | undefined,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat(regional.locale, { timeZone: regional.timeZone, ...options }).format(date) : "";
}

/** Formats a number in a locale */
export function formatNumberIn(regional: EffectiveRegional, value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(regional.locale, options).format(value);
}
