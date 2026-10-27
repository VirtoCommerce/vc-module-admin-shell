<template>
  <VcBlade
    :title="title"
    :subtitle="$t('PLATFORM.SETTINGS.DICTIONARY.SUBTITLE')"
    :toolbar-items="toolbar"
    :loading="loading"
    :modified="form.isModified.value"
    width="50%"
  >
    <DictionaryEditor
      v-model:rows="rows"
      v-model:selection="selection"
      :languages="languages"
      :can-edit="canEdit"
      state-key="PLATFORM_SETTING_DICTIONARY"
    />
  </VcBlade>
</template>

<script setup lang="ts">
import {
  LocalizableSettingsClient,
  SettingClient,
  notification,
  useApiClient,
  useAsync,
  useBlade,
  useLoading,
  usePermissions,
  usePopup,
  type IBladeToolbar,
} from "@vc-shell/framework";
import { VcBlade } from "@vc-shell/framework/ui";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { saveResetItems, usePlatformBladeForm } from "../../composables/blade";
import { settingTitle, useSettingsStore } from "../../composables/settings";
import DictionaryEditor, { sameAlias, type DictionaryRow as Row } from "../../components/dictionary-editor.vue";

defineBlade({
  url: "/dictionary",
  name: "PlatformSettingDictionary",
  permissions: ["platform:setting:access"],
});

const { t } = useI18n({ useScope: "global" });
const { param, callParent } = useBlade();
const { hasAccess } = usePermissions();
const { showConfirmation } = usePopup();
const store = useSettingsStore();
const { getApiClient: settingsClient } = useApiClient(SettingClient);
const { getApiClient: localizableClient } = useApiClient(LocalizableSettingsClient);

const schema = computed(() => store.schema.value.find((s) => s.name === param.value));
const title = computed(() => (schema.value ? settingTitle(schema.value) : param.value ?? ""));
const isLocalizable = computed(() => !!schema.value?.isLocalizable);
const canEdit = computed(() => !schema.value?.isReadOnly && hasAccess("platform:setting:update"));

const rows = ref<Row[]>([]);
const languages = ref<string[]>([]);
const loadedAliases = ref<string[]>([]);
const selection = ref<Row[]>([]);
let seq = 0;

const form = usePlatformBladeForm({
  data: rows,
  canSaveOverride: computed(() => canEdit.value),
});

const { loading: loadLoading, action: load } = useAsync(async () => {
  if (!store.loaded.value) await store.load();
  if (isLocalizable.value) {
    const result = await (await localizableClient()).getSettingsAndLanguages();
    languages.value = result.languages ?? [];
    const setting = result.settings?.find((s) => s.name === param.value);
    // keep the stored order of the allowed values (the endpoint returns the items sorted, saving would reorder them)
    const order = (store.stored.value[param.value!] as string[] | undefined) ?? [];
    const rank = (alias?: string) => {
      const i = order.indexOf(alias ?? "");
      return i < 0 ? order.length : i;
    };
    const items = [...(setting?.items ?? [])].sort((a, b) => rank(a.alias) - rank(b.alias));
    rows.value = items.map((item) => ({
      id: String(seq++),
      alias: item.alias ?? "",
      ...Object.fromEntries(languages.value.map((l) => [l, item.localizedValues?.find((v) => v.languageCode === l)?.value ?? ""])),
    })) as Row[];
  } else {
    const values = store.stored.value[param.value!];
    rows.value = (Array.isArray(values) ? values : []).map((x) => ({ id: String(seq++), alias: String(x) }) as Row);
  }
  loadedAliases.value = rows.value.map((r) => r.alias);
  selection.value = [];
  form.setBaseline();
});

const { loading: saveLoading, action: save } = useAsync(async () => {
  const aliases = rows.value.map((r) => r.alias.trim()).filter(Boolean);
  if (isLocalizable.value) {
    const client = await localizableClient();
    const removed = loadedAliases.value.filter((a) => !aliases.some((x) => sameAlias(x, a)));
    if (removed.length) await client.deleteDictionaryItems(param.value!, removed);
    await client.saveDictionaryItems(
      param.value!,
      rows.value
        .filter((r) => r.alias.trim())
        .map((r) => ({
          alias: r.alias.trim(),
          localizedValues: languages.value.map((l) => ({ languageCode: l, value: r[l] || undefined })).filter((v) => v.value),
        })),
    );
  } else {
    // legacy global mode saves dictionaries through the V1 endpoint: the setting entry with its new allowed values
    const client = await settingsClient();
    const entry = await client.getGlobalSetting(param.value!);
    entry.allowedValues = aliases;
    await client.update([entry]);
  }
  notification.success(t("PLATFORM.SETTINGS.SAVED"));
  await store.load();
  await load();
  await callParent("reload");
});

const loading = useLoading(loadLoading, saveLoading);

const toolbar = ref<IBladeToolbar[]>([
  ...saveResetItems(form, { save: () => save(), reset: () => load() }),
  {
    id: "delete",
    title: t("PLATFORM.COMMON.DELETE"),
    icon: "lucide-trash-2",
    disabled: computed(() => !selection.value.length || !canEdit.value),
    async clickHandler() {
      if (await showConfirmation(t("PLATFORM.DICTIONARY.DELETE_CONFIRM", { count: selection.value.length }))) {
        const ids = new Set(selection.value.map((r) => r.id));
        rows.value = rows.value.filter((r) => !ids.has(r.id));
        selection.value = [];
      }
    },
  },
]);

load();
</script>

