<template>
  <VcBlade
    :title="$t('PLATFORM.DYNAMIC.DICTIONARY_ITEMS')"
    :subtitle="property?.name"
    :toolbar-items="toolbar"
    :loading="loading"
    :modified="form.isModified.value"
    width="50%"
  >
    <DictionaryEditor
      v-model:rows="rows"
      v-model:selection="selection"
      :languages="multilingual ? languages : []"
      :can-edit="canEdit"
      state-key="PLATFORM_DYNAMIC_DICTIONARY"
    />
  </VcBlade>
</template>

<script setup lang="ts">
import {
  DynamicPropertiesClient,
  notification,
  useApiClient,
  useAsync,
  useBlade,
  useBladeForm,
  useLoading,
  usePermissions,
  usePopup,
  type DynamicProperty,
  type DynamicPropertyDictionaryItem,
  type IBladeToolbar,
} from "@vc-shell/framework";
import { VcBlade } from "@vc-shell/framework/ui";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import DictionaryEditor, { type DictionaryRow } from "../../components/dictionary-editor.vue";

defineBlade({
  url: "/dictionary-items",
  name: "PlatformDynamicPropertyDictionary",
  permissions: ["platform:dynamic_properties:access"],
});

// alias = the item name; itemId = the saved item's id (missing on new rows)
const { t } = useI18n({ useScope: "global" });
const { param, options, callParent } = useBlade<{ property?: DynamicProperty; languages?: string[] }>();
const { hasAccess } = usePermissions();
const { showConfirmation } = usePopup();
const { getApiClient } = useApiClient(DynamicPropertiesClient);

const property = computed(() => options.value?.property);
const languages = computed(() => options.value?.languages ?? []);
const multilingual = computed(() => !!property.value?.isMultilingual);
// dictionary items are saved and deleted with the update permission
const canEdit = computed(() => hasAccess("platform:dynamic_properties:update"));

const rows = ref<DictionaryRow[]>([]);
const selection = ref<DictionaryRow[]>([]);
let seq = 0;

const form = useBladeForm({
  data: rows,
  canSaveOverride: canEdit,
  closeConfirmMessage: computed(() => t("PLATFORM.COMMON.CLOSE_CONFIRMATION")),
});

const toRow = (item: DynamicPropertyDictionaryItem): DictionaryRow =>
  ({
    id: String(seq++),
    itemId: item.id ?? "",
    alias: item.name ?? "",
    ...Object.fromEntries(
      languages.value.map((l) => [l, item.displayNames?.find((n) => n.locale?.toLowerCase() === l.toLowerCase())?.name ?? ""]),
    ),
  }) as DictionaryRow;

const { loading: loadLoading, action: load } = useAsync(async () => {
  rows.value = ((await (await getApiClient()).getAllDictionaryItems(param.value!)) ?? []).map(toRow);
  selection.value = [];
  form.setBaseline();
});

// POST dictionaryitems upserts the whole list (empty id = create)
const { loading: saveLoading, action: save } = useAsync(async () => {
  await (
    await getApiClient()
  ).saveDictionaryItems(
    rows.value.map((r) => ({
      id: r.itemId || undefined,
      propertyId: param.value,
      name: r.alias.trim(),
      displayNames: multilingual.value ? languages.value.filter((l) => r[l]).map((l) => ({ locale: l, name: r[l] })) : [],
    })),
  );
  notification.success(t("PLATFORM.COMMON.SAVED"));
  await load();
  await callParent("reload");
});

const { loading: deleteLoading, action: remove } = useAsync<DictionaryRow[]>(async (selected) => {
  const wasModified = form.isModified.value;
  const ids = selected!.map((r) => r.itemId).filter(Boolean);
  if (ids.length) await (await getApiClient()).deleteDictionaryItem(ids);
  const removed = new Set(selected!.map((r) => r.id));
  rows.value = rows.value.filter((r) => !removed.has(r.id));
  selection.value = [];
  if (!wasModified) form.setBaseline();
  await callParent("reload");
});

const loading = useLoading(loadLoading, saveLoading, deleteLoading);

const toolbar = ref<IBladeToolbar[]>([
  { id: "save", title: t("PLATFORM.COMMON.SAVE"), icon: "lucide-save", disabled: computed(() => !form.canSave.value), clickHandler: () => save() },
  {
    id: "reset",
    title: t("PLATFORM.COMMON.RESET"),
    icon: "lucide-undo-2",
    disabled: computed(() => !form.isModified.value),
    clickHandler: () => load(),
  },
  {
    id: "delete",
    title: t("PLATFORM.COMMON.DELETE"),
    icon: "lucide-trash-2",
    permissions: ["platform:dynamic_properties:update"],
    disabled: computed(() => !selection.value.length),
    async clickHandler() {
      // legacy deletes saved items right away
      if (await showConfirmation(t("PLATFORM.COMMON.DELETE_CONFIRMATION", { count: selection.value.length }))) {
        await remove(selection.value);
      }
    },
  },
]);

load();
</script>
