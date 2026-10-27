import { i18n } from "@vc-shell/framework";
import { request as api } from "../../api/http";

// the shell's JSON request (settings v2 values, profiles, localization, sign-in log, currencies), as the screens call it
export { api };

/**
 * A setting's values as legacy's settings.getValues reads them (GET settings/values/{name}: allowed values, else [value],
 * else [default]). Needs only a signed-in user, unlike GET settings/{name}; a failed lookup is an empty list.
 */
export const settingValues = (name: string) =>
  api<unknown[] | null>("GET", `/api/platform/settings/values/${encodeURIComponent(name)}`).catch(() => []);

/** The language the UI shows now (vue-i18n's global locale), for the platform texts loaded per language */
export function currentLocale(): string {
  const locale = i18n.global.locale as unknown;
  return String((locale as { value?: string } | null)?.value ?? locale ?? "") || "en";
}

const translations = new Map<string, Promise<Record<string, unknown>>>();

/** The platform's merged AngularJS translations (setting titles, permission descriptions); best-effort, loaded once per locale. */
export const platformTranslations = (locale = currentLocale()) => {
  let loaded = translations.get(locale);
  if (!loaded) {
    loaded = api<Record<string, unknown>>("GET", `/api/platform/localization?lang=${encodeURIComponent(locale)}`).catch(
      () => ({}) as Record<string, unknown>,
    );
    translations.set(locale, loaded);
  }
  return loaded;
};
