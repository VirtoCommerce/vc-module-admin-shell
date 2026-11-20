import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { modules } from "./modules";
import { availableSignInTypes, registeredSignInTypes, signInTypeLabel } from "./signInLogTypes";

/** The sign-in log's types in the user's language: the filter's options and a row's label (signInLogTypes.ts) */
export function useSignInLogTypes() {
  const { t } = useI18n({ useScope: "global" });

  // offered: the modules' types only while installed (the list loads once per page, then this follows it)
  const options = computed(() => {
    void modules.installed.value;
    return availableSignInTypes(registeredSignInTypes.value, modules.isInstalled).map((type) => ({
      value: type.value,
      label: t(type.label),
    }));
  });

  // labelled: every type the shell knows, installed or not, as the log may hold rows of a module removed since
  const everyType = computed(() => availableSignInTypes(registeredSignInTypes.value, () => true));
  const labelOf = (value?: string | null) => {
    const { label, known } = signInTypeLabel(value ?? undefined, everyType.value);
    return known ? t(label) : label;
  };

  return { options, labelOf };
}
