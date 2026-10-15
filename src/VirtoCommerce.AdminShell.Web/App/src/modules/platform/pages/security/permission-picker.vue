<template>
  <VcBlade
    :title="$t('PLATFORM.SECURITY.ROLE.ASSIGN')"
    :subtitle="$t('PLATFORM.SECURITY.ROLE.PICKER_SUBTITLE')"
    :toolbar-items="toolbar"
    :loading="loading"
    width="50%"
  >
    <VcDataTable
      v-model:selection="selection"
      v-model:search-value="keyword"
      selection-mode="multiple"
      :items="rows"
      :total-count="rows.length"
      :searchable="true"
      :state-key="'PLATFORM_PERMISSION_PICKER'"
      :global-filters="globalFilters"
      :empty-state="{ icon: 'lucide-shield', title: $t('PLATFORM.SECURITY.ROLE.NO_PERMISSIONS') }"
      @filter="(e: { filters: Record<string, unknown> }) => (group = (e.filters.groupName as string) || undefined)"
    >
      <VcColumn
        id="name"
        :title="$t('PLATFORM.SECURITY.ROLE.PERMISSION')"
        sortable
        always-visible
      />
      <VcColumn
        id="description"
        :title="$t('PLATFORM.SECURITY.ROLES.DESCRIPTION')"
      />
      <VcColumn
        id="groupName"
        :title="$t('PLATFORM.SECURITY.ROLE.GROUP')"
        sortable
      />
    </VcDataTable>
  </VcBlade>
</template>

<script setup lang="ts">
import { SecurityClient, useApiClient, useAsync, useBlade, type IBladeToolbar } from "@vc-shell/framework";
import { VcBlade, VcColumn, VcDataTable } from "@vc-shell/framework/ui";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { registeredPermissions, type CatalogPermission } from "../../composables/security";

defineBlade({
  url: "/permissions",
  name: "PlatformSecurityPermissionPicker",
  permissions: ["platform:security:update"],
});

type Row = CatalogPermission & { id: string };

const { t } = useI18n({ useScope: "global" });
const { options, callParent, closeSelf } = useBlade<{ exclude?: string[] }>();
const { getApiClient } = useApiClient(SecurityClient);

const all = ref<Row[]>([]);
const selection = ref<Row[]>([]);
const keyword = ref("");
const group = ref<string>();

const rows = computed(() =>
  all.value.filter(
    (p) =>
      (!group.value || p.groupName === group.value) &&
      (!keyword.value || `${p.name} ${p.description} ${p.groupName}`.toLowerCase().includes(keyword.value.toLowerCase())),
  ),
);

const globalFilters = computed(() => [
  {
    id: "groupName",
    label: t("PLATFORM.SECURITY.ROLE.GROUP"),
    filter: {
      options: [...new Set(all.value.map((p) => p.groupName ?? ""))].filter(Boolean).sort().map((g) => ({ value: g, label: g })),
    },
  },
]);

const { loading, action: load } = useAsync(async () => {
  const exclude = new Set(options.value?.exclude ?? []);
  all.value = (await registeredPermissions(await getApiClient()))
    .filter((p) => !exclude.has(p.name!))
    .map((p) => ({ ...p, id: p.name! }))
    .sort((a, b) => `${a.groupName}${a.name}`.localeCompare(`${b.groupName}${b.name}`));
});

const toolbar = ref<IBladeToolbar[]>([
  {
    id: "confirm",
    title: t("PLATFORM.SECURITY.ROLE.ADD_SELECTED"),
    icon: "lucide-check",
    disabled: computed(() => !selection.value.length),
    async clickHandler() {
      await callParent("addPermissions", selection.value);
      await closeSelf();
    },
  },
]);

load();
</script>
