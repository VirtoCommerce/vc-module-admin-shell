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
  useLoading,
  usePopup,
  type IBladeToolbar,
  type Role,
} from "@vc-shell/framework";
import { VcBlade, VcColumn, VcDataTable } from "@vc-shell/framework/ui";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { refreshItem } from "../../composables/blade";
import { PAGE_SIZE, useSearchableList } from "../../composables/list";

defineBlade({
  url: "/roles",
  name: "PlatformSecurityRoles",
  permissions: ["platform:security:access"],
});

const { t } = useI18n({ useScope: "global" });
// options.keyword: the list opens filtered (global search's "Show all")
const { openBlade, exposeToChildren, options } = useBlade<{ keyword?: string }>();
const { showConfirmation } = usePopup();
const { getApiClient } = useApiClient(SecurityClient);

const roles = ref<Role[]>([]);
const selection = ref<Role[]>([]);
const activeId = ref<string>();
// the keyword, page and reload after typing; options.keyword: the list opens filtered (global search's "Show all")
const { keyword, totalCount, pagination } = useSearchableList({
  stateKey: "PLATFORM_ROLES",
  keyword: options.value?.keyword,
  load: () => load(),
});

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
  refreshItem(() => load()),
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
