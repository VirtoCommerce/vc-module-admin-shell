<template>
  <VcBlade
    :title="$t('PLATFORM.SECURITY.ROLES.TITLE')"
    :toolbar-items="toolbar"
    :loading="loading"
    width="50%"
  >
    <VcDataTable
      v-model:search-value="keyword"
      v-model:selection="selection"
      selection-mode="multiple"
      :items="roles"
      :total-count="totalCount"
      :pagination="pagination"
      :searchable="true"
      :state-key="'PLATFORM_ROLES'"
      :active-item-id="activeId"
      :empty-state="{ icon: 'lucide-shield', title: $t('PLATFORM.SECURITY.ROLES.EMPTY') }"
      @row-click="(e: { data: Role }) => openRole(e.data)"
      @pagination-click="pagination.goToPage"
    >
      <VcColumn
        id="name"
        :title="$t('PLATFORM.SECURITY.ROLES.NAME')"
        always-visible
      />
      <VcColumn
        id="description"
        :title="$t('PLATFORM.SECURITY.ROLES.DESCRIPTION')"
      />
    </VcDataTable>
  </VcBlade>
</template>

<script setup lang="ts">
import {
  SecurityClient,
  useApiClient,
  useAsync,
  useBlade,
  useDataTablePagination,
  useFunctions,
  useLoading,
  usePopup,
  type IBladeToolbar,
  type Role,
} from "@vc-shell/framework";
import { VcBlade, VcColumn, VcDataTable } from "@vc-shell/framework/ui";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

defineBlade({
  url: "/roles",
  name: "PlatformSecurityRoles",
  permissions: ["platform:security:access"],
});

const PAGE_SIZE = 20;
const { t } = useI18n({ useScope: "global" });
const { openBlade, exposeToChildren } = useBlade();
const { debounce } = useFunctions();
const { showConfirmation } = usePopup();
const { getApiClient } = useApiClient(SecurityClient);

const roles = ref<Role[]>([]);
const totalCount = ref(0);
const selection = ref<Role[]>([]);
const activeId = ref<string>();
const keyword = ref("");
const pagination = useDataTablePagination({ stateKey: "PLATFORM_ROLES", pageSize: PAGE_SIZE, totalCount });

const { loading: searchLoading, action: load } = useAsync(async () => {
  const result = await (
    await getApiClient()
  ).searchRoles({ keyword: keyword.value || undefined, sort: "name:asc", skip: pagination.skip, take: PAGE_SIZE });
  roles.value = result.results ?? [];
  totalCount.value = result.totalCount ?? 0;
});

const { loading: deleteLoading, action: remove } = useAsync<string[]>(async (ids) => {
  await (await getApiClient()).deleteRoles(ids);
});

const loading = useLoading(searchLoading, deleteLoading);

load();
watch(keyword, () => pagination.setPage(1));
watch([keyword, () => pagination.skip], debounce(() => load(), 300));

function openRole(role?: Role) {
  activeId.value = role?.id;
  openBlade({
    name: "PlatformSecurityRoleDetails",
    param: role?.name,
    onClose: () => {
      activeId.value = undefined;
      load();
    },
  });
}

const toolbar = ref<IBladeToolbar[]>([
  { id: "refresh", title: t("PLATFORM.COMMON.REFRESH"), icon: "lucide-refresh-cw", clickHandler: () => load() },
  {
    id: "add",
    title: t("PLATFORM.COMMON.ADD"),
    icon: "lucide-plus",
    permissions: ["platform:security:create"],
    clickHandler: () => openRole(),
  },
  {
    id: "delete",
    title: t("PLATFORM.COMMON.DELETE"),
    icon: "lucide-trash-2",
    permissions: ["platform:security:delete"],
    disabled: computed(() => !selection.value.length),
    async clickHandler() {
      if (await showConfirmation(t("PLATFORM.COMMON.DELETE_CONFIRMATION", { count: selection.value.length }))) {
        await remove(selection.value.map((r) => r.id!));
        selection.value = [];
        await load();
      }
    },
  },
]);

exposeToChildren({ reload: () => load() });
</script>
