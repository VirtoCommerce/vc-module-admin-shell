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
  type IBladeToolbar,
  type OperationLog,
} from "@vc-shell/framework";
import { VcBlade, VcColumn, VcDataTable } from "@vc-shell/framework/ui";
import { ref } from "vue";
import { refreshItem } from "../../composables/blade";
import { PAGE_SIZE, useSearchableList } from "../../composables/list";

defineBlade({
  url: "/changes",
  name: "PlatformSecurityUserChanges",
  permissions: ["platform:security:access"],
});

const { param, options } = useBlade<{ userName?: string }>();
const { getApiClient } = useApiClient(ChangeLogClient);

const changes = ref<OperationLog[]>([]);
const { keyword, totalCount, pagination } = useSearchableList({ stateKey: "PLATFORM_USER_CHANGES", load: () => load() });

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

const toolbar = ref<IBladeToolbar[]>([
  refreshItem(() => load()),
]);
</script>
