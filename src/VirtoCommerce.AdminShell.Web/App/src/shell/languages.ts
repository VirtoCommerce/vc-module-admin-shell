import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { MenuSelectOption } from "./MenuSelect.vue";

/** The languages a user can pick (avatar menu, sign-in page): each one with a language_name, by that name */
export function useLanguageOptions() {
  const { availableLocales, getLocaleMessage } = useI18n({ useScope: "global" });
  return computed<MenuSelectOption[]>(() =>
    availableLocales
      .map((lang) => ({ value: lang, label: (getLocaleMessage(lang) as { language_name?: string }).language_name ?? "" }))
      .filter((x) => x.label),
  );
}
