<template>
  <VcBlade
    :title="$t('PLATFORM.SETTINGS.JSON.TITLE')"
    :subtitle="$t('PLATFORM.SETTINGS.JSON.SUBTITLE')"
    :toolbar-items="toolbar"
    :loading="loading"
    :modified="form.isModified.value"
    width="60%"
  >
    <VcContainer>
      <VcForm class="platform-form">
        <VcTextarea
          v-model="text"
          class="platform-code platform-code--tall"
          maxlength="5000000"
          :label="$t('PLATFORM.SETTINGS.JSON.LABEL')"
          :hint="$t('PLATFORM.SETTINGS.JSON.HINT')"
          :error-message="error"
        />
      </VcForm>
    </VcContainer>
  </VcBlade>
</template>

<script setup lang="ts">
import { notification, useAsync, useBlade, useLoading, usePermissions, usePopup, type IBladeToolbar } from "@vc-shell/framework";
import { VcBlade, VcContainer, VcForm, VcTextarea } from "@vc-shell/framework/ui";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { saveResetItems, usePlatformBladeForm } from "../../composables/blade";
import { exportDocument, settingsOf, useSettingsStore } from "../../composables/settings";

defineBlade({
  url: "/settings-json",
  name: "PlatformSettingsJson",
  permissions: ["platform:setting:access"],
});

const { t } = useI18n({ useScope: "global" });
const { callParent } = useBlade();
const { hasAccess } = usePermissions();
const { showConfirmation } = usePopup();
const store = useSettingsStore();

const text = ref("");

const parsed = computed(() => {
  try {
    return settingsOf(JSON.parse(text.value));
  } catch {
    return undefined;
  }
});
const error = computed(() => (text.value && !parsed.value ? t("PLATFORM.SETTINGS.JSON.INVALID") : undefined));

const form = usePlatformBladeForm({
  data: text,
  canSaveOverride: computed(() => !!parsed.value && hasAccess("platform:setting:update")),
});

// the same document the export downloads: modified settings only
const { loading: loadLoading, action: load } = useAsync(async () => {
  text.value = JSON.stringify(exportDocument(await store.exportModified()), null, 2);
  form.setBaseline();
});

const { loading: saveLoading, action: save } = useAsync(async () => {
  // replaceAll: modified settings missing from the document are reset to their defaults (legacy behaviour)
  if (!(await showConfirmation(t("PLATFORM.SETTINGS.JSON.SAVE_CONFIRM", { count: Object.keys(parsed.value!).length })))) return;
  await store.save(parsed.value!, true);
  notification.success(t("PLATFORM.SETTINGS.SAVED"));
  await load();
  await callParent("reload");
});

const loading = useLoading(loadLoading, saveLoading);

const toolbar = ref<IBladeToolbar[]>([
  ...saveResetItems(form, { save: () => save(), reset: () => load() }),
  {
    id: "format",
    title: t("PLATFORM.SETTINGS.GROUP.FORMAT_JSON"),
    icon: "lucide-braces",
    disabled: computed(() => !parsed.value),
    clickHandler: () => (text.value = JSON.stringify(JSON.parse(text.value), null, 2)),
  },
]);

load();
</script>

