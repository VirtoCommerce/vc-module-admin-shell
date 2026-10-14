<template>
  <VcBlade
    :title="$t('PLATFORM.DYNAMIC.TITLE')"
    :toolbar-items="toolbar"
    :loading="loading"
    width="40%"
  >
    <VcDataTable
      v-model:search-value="keyword"
      :items="visible"
      :total-count="visible.length"
      :searchable="true"
      :state-key="'PLATFORM_DYNAMIC_TYPES'"
      :active-item-id="activeId"
      :empty-state="{ icon: 'lucide-list-plus', title: $t('PLATFORM.DYNAMIC.NO_TYPES') }"
      @row-click="(e: { data: TypeRow }) => openType(e.data)"
    >
      <VcColumn
        id="name"
        :title="$t('PLATFORM.DYNAMIC.OBJECT_TYPE')"
        always-visible
      >
        <template #body="{ data }">
          <div class="platform-module-cell">
            <span class="platform-module-cell__title">{{ data.name }}</span>
            <span class="platform-module-cell__descr">{{ data.id }}</span>
          </div>
        </template>
      </VcColumn>
    </VcDataTable>
  </VcBlade>
</template>

<script setup lang="ts">
import { DynamicPropertiesClient, useApiClient, useAsync, useBlade, type IBladeToolbar } from "@vc-shell/framework";
import { VcBlade, VcColumn, VcDataTable } from "@vc-shell/framework/ui";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

defineBlade({
  url: "/dynamic-properties",
  name: "PlatformDynamicProperties",
  isWorkspace: true,
  permissions: ["platform:dynamic_properties:access"],
});

interface TypeRow {
  id: string;
  name: string;
}

const { t } = useI18n({ useScope: "global" });
const { openBlade } = useBlade();
const { getApiClient } = useApiClient(DynamicPropertiesClient);

const types = ref<TypeRow[]>([]);
const keyword = ref("");
const activeId = ref<string>();

const visible = computed(() =>
  types.value.filter((x) => !keyword.value || x.id.toLowerCase().includes(keyword.value.toLowerCase())),
);

// object types are registered in code by modules (IDynamicPropertyRegistrar); the short class name is the title
const { loading, action: load } = useAsync(async () => {
  types.value = ((await (await getApiClient()).getObjectTypes()) ?? [])
    .map((id) => ({ id, name: id.split(".").pop() ?? id }))
    .sort((a, b) => a.id.localeCompare(b.id));
});

function openType(type: TypeRow) {
  activeId.value = type.id;
  openBlade({ name: "PlatformDynamicPropertyList", param: type.id, onClose: () => (activeId.value = undefined) });
}

const toolbar = ref<IBladeToolbar[]>([
  { id: "refresh", title: t("PLATFORM.COMMON.REFRESH"), icon: "lucide-refresh-cw", clickHandler: () => load() },
]);

load();
</script>
