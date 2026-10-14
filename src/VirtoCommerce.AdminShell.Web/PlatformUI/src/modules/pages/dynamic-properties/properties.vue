<template>
  <VcBlade
    :title="typeName"
    :subtitle="$t('PLATFORM.DYNAMIC.PROPERTIES')"
    :toolbar-items="toolbar"
    :loading="loading"
    width="50%"
  >
    <VcDataTable
      v-model:search-value="keyword"
      :items="properties"
      :total-count="totalCount"
      :pagination="pagination"
      :searchable="true"
      :state-key="'PLATFORM_DYNAMIC_PROPERTIES'"
      :active-item-id="activeId"
      :empty-state="{ icon: 'lucide-list-plus', title: $t('PLATFORM.DYNAMIC.NO_PROPERTIES') }"
      @row-click="(e: { data: DynamicProperty }) => openProperty(e.data.id)"
      @pagination-click="pagination.goToPage"
    >
      <VcColumn
        id="name"
        :title="$t('PLATFORM.DYNAMIC.NAME')"
        always-visible
      />
      <VcColumn
        id="valueType"
        :title="$t('PLATFORM.DYNAMIC.VALUE_TYPE')"
        width="140px"
      >
        <template #body="{ data }">{{ $t(`PLATFORM.DYNAMIC.VALUE_TYPES.${data.valueType}`) }}</template>
      </VcColumn>
      <VcColumn
        id="flags"
        :title="$t('PLATFORM.DYNAMIC.FLAGS')"
      >
        <template #body="{ data }">
          <div class="tw-inline-flex platform-badges">
            <VcStatus
              v-for="flag in flags(data)"
              :key="flag"
              variant="info"
            >
              {{ flag }}
            </VcStatus>
          </div>
        </template>
      </VcColumn>
    </VcDataTable>
  </VcBlade>
</template>

<script setup lang="ts">
import {
  DynamicPropertiesClient,
  useApiClient,
  useAsync,
  useBlade,
  useDataTablePagination,
  useFunctions,
  type DynamicProperty,
  type IBladeToolbar,
} from "@vc-shell/framework";
import { VcBlade, VcColumn, VcDataTable, VcStatus } from "@vc-shell/framework/ui";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

defineBlade({
  url: "/properties",
  name: "PlatformDynamicPropertyList",
  permissions: ["platform:dynamic_properties:access"],
});

const PAGE_SIZE = 20;
const { t } = useI18n({ useScope: "global" });
const { param, openBlade, exposeToChildren } = useBlade();
const { debounce } = useFunctions();
const { getApiClient } = useApiClient(DynamicPropertiesClient);

const properties = ref<DynamicProperty[]>([]);
const totalCount = ref(0);
const keyword = ref("");
const activeId = ref<string>();
const pagination = useDataTablePagination({ stateKey: "PLATFORM_DYNAMIC_PROPERTIES", pageSize: PAGE_SIZE, totalCount });
const typeName = computed(() => param.value?.split(".").pop() ?? "");

const flags = (p: DynamicProperty) =>
  [
    p.isRequired && t("PLATFORM.DYNAMIC.REQUIRED"),
    p.isDictionary && t("PLATFORM.DYNAMIC.DICTIONARY"),
    p.isArray && t("PLATFORM.DYNAMIC.MULTIVALUE"),
    p.isMultilingual && t("PLATFORM.DYNAMIC.MULTILINGUAL"),
  ].filter(Boolean) as string[];

const { loading, action: load } = useAsync(async () => {
  const result = await (
    await getApiClient()
  ).searchDynamicProperties({ objectType: param.value, keyword: keyword.value || undefined, skip: pagination.skip, take: PAGE_SIZE });
  properties.value = result.results ?? [];
  totalCount.value = result.totalCount ?? 0;
});

function openProperty(id?: string) {
  activeId.value = id;
  openBlade({
    name: "PlatformDynamicPropertyDetails",
    param: id,
    options: { objectType: param.value },
    onClose: () => {
      activeId.value = undefined;
      load();
    },
  });
}

load();
watch(keyword, () => pagination.setPage(1));
watch([keyword, () => pagination.skip], debounce(() => load(), 300));

const toolbar = ref<IBladeToolbar[]>([
  { id: "refresh", title: t("PLATFORM.COMMON.REFRESH"), icon: "lucide-refresh-cw", clickHandler: () => load() },
  {
    id: "add",
    title: t("PLATFORM.COMMON.ADD"),
    icon: "lucide-plus",
    permissions: ["platform:dynamic_properties:create"],
    clickHandler: () => openProperty(),
  },
]);

exposeToChildren({ reload: () => load() });
</script>
