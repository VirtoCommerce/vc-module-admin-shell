// What the platform screens' blades share: the form with its close confirmation, and the Save, Reset and Refresh toolbar
// items, so a change of an icon, a title or a rule is one edit.
import { i18n, useBladeForm, type IBladeToolbar } from "@vc-shell/framework";
import { computed, type ComputedRef } from "vue";

type BladeFormOptions = Parameters<typeof useBladeForm>[0];
type BladeForm = ReturnType<typeof useBladeForm>;

// the toolbar helpers run wherever a blade builds its toolbar (a computed too), so they read the global i18n
const t = (key: string) => i18n.global.t(key);

/** useBladeForm that asks before a blade with unsaved changes closes */
export function usePlatformBladeForm(options: Omit<BladeFormOptions, "closeConfirmMessage">): BladeForm {
  return useBladeForm({ ...options, closeConfirmMessage: computed(() => t("PLATFORM.COMMON.CLOSE_CONFIRMATION")) });
}

/**
 * Save and Reset of a detail blade. Save (Create on a new item) while the form can be saved; Reset back to the stored
 * state while there are changes. `resetDisabled` replaces that rule, `resetVisible` hides Reset (on a new item).
 */
export function saveResetItems(
  form: BladeForm,
  options: {
    save: () => unknown;
    reset: () => unknown;
    isNew?: boolean;
    resetVisible?: boolean;
    resetDisabled?: ComputedRef<boolean>;
  },
): IBladeToolbar[] {
  return [
    {
      id: "save",
      title: options.isNew ? t("PLATFORM.COMMON.CREATE") : t("PLATFORM.COMMON.SAVE"),
      icon: "lucide-save",
      disabled: computed(() => !form.canSave.value),
      clickHandler: () => options.save(),
    },
    {
      id: "reset",
      title: t("PLATFORM.COMMON.RESET"),
      icon: "lucide-undo-2",
      ...(options.resetVisible === undefined ? {} : { isVisible: options.resetVisible }),
      disabled: options.resetDisabled ?? computed(() => !form.isModified.value),
      clickHandler: () => options.reset(),
    },
  ];
}

/** Refresh of a list blade: loads it again */
export function refreshItem(load: () => unknown): IBladeToolbar {
  return { id: "refresh", title: t("PLATFORM.COMMON.REFRESH"), icon: "lucide-refresh-cw", clickHandler: () => load() };
}
