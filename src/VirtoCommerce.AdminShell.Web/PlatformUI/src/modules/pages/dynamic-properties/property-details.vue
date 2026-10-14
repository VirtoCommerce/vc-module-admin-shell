<template>
  <VcBlade
    :title="isNew ? $t('PLATFORM.DYNAMIC.NEW_TITLE') : item.name"
    :subtitle="(item.objectType ?? options?.objectType ?? '').split('.').pop()"
    :toolbar-items="toolbar"
    :loading="loading"
    :modified="form.isModified.value"
    width="50%"
  >
    <VcContainer>
      <VcForm class="platform-form">
        <VcRow class="tw-gap-4">
          <VcCol>
            <VcInput
              v-model="item.name"
              :label="$t('PLATFORM.DYNAMIC.NAME')"
              required
              :error-message="item.name ? undefined : $t('PLATFORM.COMMON.REQUIRED')"
            />
          </VcCol>
          <VcCol>
            <VcSelect
              v-model="item.valueType"
              :label="$t('PLATFORM.DYNAMIC.VALUE_TYPE')"
              :options="valueTypes"
              :clearable="false"
              :disabled="!isNew"
            />
          </VcCol>
        </VcRow>
        <VcRow class="tw-gap-4">
          <VcCol>
            <VcSwitch
              v-model="item.isRequired"
              :label="$t('PLATFORM.DYNAMIC.REQUIRED')"
            />
          </VcCol>
          <VcCol>
            <VcSwitch
              v-model="item.isArray"
              :label="$t('PLATFORM.DYNAMIC.MULTIVALUE')"
              :disabled="!isNew || !allowed('isArray')"
            />
          </VcCol>
          <VcCol>
            <VcSwitch
              v-model="item.isMultilingual"
              :label="$t('PLATFORM.DYNAMIC.MULTILINGUAL')"
              :disabled="!isNew || !allowed('isMultilingual')"
            />
          </VcCol>
          <VcCol>
            <VcSwitch
              v-model="item.isDictionary"
              :label="$t('PLATFORM.DYNAMIC.DICTIONARY')"
              :disabled="!isNew || !allowed('isDictionary')"
            />
          </VcCol>
        </VcRow>
        <VcInput
          v-model="item.displayOrder"
          type="integer"
          :label="$t('PLATFORM.DYNAMIC.DISPLAY_ORDER')"
        />
        <VcTextarea
          v-model="item.description"
          :label="$t('PLATFORM.DYNAMIC.DESCRIPTION')"
        />
        <VcCard :header="$t('PLATFORM.DYNAMIC.DISPLAY_NAMES')">
          <div class="platform-card-body">
            <VcInput
              v-for="name in item.displayNames ?? []"
              :key="name.locale"
              v-model="name.name"
              :label="name.locale"
            />
          </div>
        </VcCard>
      </VcForm>
    </VcContainer>
  </VcBlade>
</template>

<script setup lang="ts">
import {
  DynamicPropertiesClient,
  DynamicPropertyValueType,
  notification,
  useApiClient,
  useAsync,
  useBlade,
  useBladeForm,
  useBladeWidgets,
  useLoading,
  usePermissions,
  usePopup,
  type DynamicProperty,
  type IBladeToolbar,
} from "@vc-shell/framework";
import { VcBlade, VcCard, VcCol, VcContainer, VcForm, VcInput, VcRow, VcSelect, VcSwitch, VcTextarea } from "@vc-shell/framework/ui";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { settingValues } from "../../api";

defineBlade({
  url: "/property",
  name: "PlatformDynamicPropertyDetails",
  permissions: ["platform:dynamic_properties:access"],
});

type Flag = "isArray" | "isMultilingual" | "isDictionary";

const { t } = useI18n({ useScope: "global" });
const { param, options, openBlade, replaceWith, closeSelf, callParent, exposeToChildren } = useBlade<{ objectType?: string }>();
const { hasAccess } = usePermissions();
const { showConfirmation } = usePopup();
const { getApiClient } = useApiClient(DynamicPropertiesClient);

const isNew = computed(() => !param.value);
const item = ref<DynamicProperty>({});
const languages = ref<string[]>([]);
const dictionaryCount = ref<number>();

const valueTypes = computed(() =>
  Object.values(DynamicPropertyValueType)
    .filter((x) => x !== DynamicPropertyValueType.Undefined)
    .map((x) => ({ id: x, title: t(`PLATFORM.DYNAMIC.VALUE_TYPES.${x}`) })),
);

// legacy flag rules (enforced client-side only; the server validator is effectively inert)
const RULES: Record<Flag, string[]> = {
  isDictionary: ["ShortText"],
  isMultilingual: ["ShortText", "LongText", "Html"],
  isArray: ["ShortText", "Integer", "Decimal"],
};
const allowed = (flag: Flag) => RULES[flag].includes(item.value.valueType ?? "");
watch(
  () => item.value.valueType,
  () => {
    if (!isNew.value) return;
    for (const flag of Object.keys(RULES) as Flag[]) if (!allowed(flag)) item.value[flag] = false;
  },
);

const form = useBladeForm({
  data: item,
  canSaveOverride: computed(
    () => !!item.value.name && hasAccess(isNew.value ? "platform:dynamic_properties:create" : "platform:dynamic_properties:update"),
  ),
  closeConfirmMessage: computed(() => t("PLATFORM.COMMON.CLOSE_CONFIRMATION")),
});

/** one display name per platform language (VirtoCommerce.Core.General.Languages), matched case-insensitively */
function withDisplayNames(property: DynamicProperty): DynamicProperty {
  const names = property.displayNames ?? [];
  return {
    ...property,
    displayNames: languages.value.map((locale) => ({
      locale,
      name: names.find((n) => n.locale?.toLowerCase() === locale.toLowerCase())?.name ?? "",
    })),
  };
}

const { loading: loadLoading, action: load } = useAsync(async () => {
  const client = await getApiClient();
  const [values, result] = await Promise.all([
    // legacy: settings.getValues, which needs no setting permission
    settingValues("VirtoCommerce.Core.General.Languages"),
    // there is no GET by id and the search ignores objectIds: look the property up within its object type
    isNew.value ? undefined : client.searchDynamicProperties({ objectType: options.value?.objectType, take: 1000 }),
  ]);
  languages.value = (values ?? []).map(String).sort();
  if (isNew.value) {
    item.value = withDisplayNames({ objectType: options.value?.objectType, valueType: DynamicPropertyValueType.ShortText });
  } else {
    item.value = withDisplayNames(result?.results?.find((p) => p.id === param.value) ?? {});
    if (item.value.isDictionary) await countDictionary();
  }
  form.setBaseline();
});

async function countDictionary() {
  dictionaryCount.value = (await (await getApiClient()).searchDictionaryItems({ propertyId: param.value, take: 0 })).totalCount ?? 0;
}

const payload = () => ({ ...item.value, displayNames: (item.value.displayNames ?? []).filter((n) => n.name) });

const { loading: saveLoading, action: save } = useAsync(async () => {
  const client = await getApiClient();
  if (isNew.value) {
    const created = await client.createProperty(payload());
    notification.success(t("PLATFORM.COMMON.SAVED"));
    form.setBaseline();
    await callParent("reload");
    await replaceWith({ name: "PlatformDynamicPropertyDetails", param: created.id, options: options.value });
    return;
  }
  await client.updateProperty(payload());
  notification.success(t("PLATFORM.COMMON.SAVED"));
  await Promise.all([callParent("reload"), load()]);
});

const loading = useLoading(loadLoading, saveLoading);

const toolbar = computed<IBladeToolbar[]>(() => [
  {
    id: "save",
    title: isNew.value ? t("PLATFORM.COMMON.CREATE") : t("PLATFORM.COMMON.SAVE"),
    icon: "lucide-save",
    disabled: computed(() => !form.canSave.value),
    clickHandler: () => save(),
  },
  {
    id: "reset",
    title: t("PLATFORM.COMMON.RESET"),
    icon: "lucide-undo-2",
    isVisible: !isNew.value,
    disabled: computed(() => !form.isModified.value),
    clickHandler: () => load(),
  },
  {
    id: "delete",
    title: t("PLATFORM.COMMON.DELETE"),
    icon: "lucide-trash-2",
    permissions: ["platform:dynamic_properties:delete"],
    isVisible: !isNew.value,
    async clickHandler() {
      if (await showConfirmation(t("PLATFORM.DYNAMIC.DELETE_CONFIRM", { name: item.value.name }))) {
        await (await getApiClient()).deleteProperty([item.value.id!]);
        form.setBaseline();
        await callParent("reload");
        await closeSelf();
      }
    },
  },
]);

useBladeWidgets([
  {
    id: "PlatformDynamicPropertyDictionary",
    icon: "lucide-book-a",
    title: "PLATFORM.DYNAMIC.DICTIONARY_ITEMS",
    badge: computed(() => dictionaryCount.value ?? ""),
    isVisible: computed(() => !isNew.value && !!item.value.isDictionary),
    onClick: () =>
      openBlade({
        name: "PlatformDynamicPropertyDictionary",
        param: item.value.id,
        options: { property: item.value, languages: languages.value },
      }),
  },
]);

load();

// the dictionary blade changes only the item count: unsaved edits here stay
exposeToChildren({ reload: () => countDictionary() });
</script>
