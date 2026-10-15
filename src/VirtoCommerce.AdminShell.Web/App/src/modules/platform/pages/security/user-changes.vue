<template>
  <VcBlade
    :title="$t('PLATFORM.SECURITY.CHANGES.TITLE')"
    :subtitle="options?.userName"
    :toolbar-items="toolbar"
    :loading="loading"
    width="50%"
  >
    <VcDataTable
      v-model:search-value="keyword"
      :items="changes"
      :total-count="totalCount"
      :pagination="pagination"
      :searchable="true"
      :state-key="'PLATFORM_USER_CHANGES'"
      :empty-state="{ icon: 'lucide-history', title: $t('PLATFORM.SECURITY.CHANGES.EMPTY') }"
      @pagination-click="pagination.goToPage"
    >
      <VcColumn
        id="createdDate"
        :title="$t('PLATFORM.SECURITY.SIGNIN.DATE')"
        type="datetime"
        width="200px"
        always-visible
      />
      <VcColumn
        id="operationType"
        :title="$t('PLATFORM.SECURITY.CHANGES.OPERATION')"
      />
      <VcColumn
        id="detail"
        :title="$t('PLATFORM.SECURITY.CHANGES.DETAIL')"
      />
      <VcColumn
        id="createdBy"
        :title="$t('PLATFORM.SECURITY.CHANGES.BY')"
      />
    </VcDataTable>
  </VcBlade>
</template>

<script setup lang="ts">
// Legacy 'accountDetail' change log widget (operation-list blade): POST changelog/v2/search by the user's id.
import {
  ChangeLogClient,
  useApiClient,
  useAsync,
  useBlade,
  useDataTablePagination,
  useFunctions,
  type IBladeToolbar,
  type OperationLog,
} from "@vc-shell/framework";
import { VcBlade, VcColumn, VcDataTable } from "@vc-shell/framework/ui";
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";

defineBlade({
  url: "/changes",
  name: "PlatformSecurityUserChanges",
  permissions: ["platform:security:access"],
});

const PAGE_SIZE = 20;
const { t } = useI18n({ useScope: "global" });
const { param, options } = useBlade<{ userName?: string }>();
const { debounce } = useFunctions();
const { getApiClient } = useApiClient(ChangeLogClient);

const changes = ref<OperationLog[]>([]);
const totalCount = ref(0);
const keyword = ref("");
const pagination = useDataTablePagination({ stateKey: "PLATFORM_USER_CHANGES", pageSize: PAGE_SIZE, totalCount });

const { loading, action: load } = useAsync(async () => {
  const result = await (await getApiClient()).searchChangesV2({
    objectIds: [param.value!],
    keyword: keyword.value || undefined,
    sort: "createdDate:desc",
    skip: pagination.skip,
    take: PAGE_SIZE,
  });
  changes.value = result.results ?? [];
  totalCount.value = result.totalCount ?? 0;
});

load();
watch(keyword, () => pagination.setPage(1));
watch([keyword, () => pagination.skip], debounce(() => load(), 300));

const toolbar = ref<IBladeToolbar[]>([
  { id: "refresh", title: t("PLATFORM.COMMON.REFRESH"), icon: "lucide-refresh-cw", clickHandler: () => load() },
]);
</script>
