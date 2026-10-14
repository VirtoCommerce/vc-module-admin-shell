<template>
  <VcBlade
    :title="$t('PLATFORM.SECURITY.SIGNIN.TITLE')"
    :subtitle="options?.userName"
    :toolbar-items="toolbar"
    :loading="loading"
    width="70%"
  >
    <div class="platform-signin">
      <div class="platform-signin__stats">
        <div class="platform-signin__period">
          <VcSelect
            v-model="period"
            :label="$t('PLATFORM.SECURITY.SIGNIN.PERIOD')"
            :options="periods"
            :clearable="false"
          />
        </div>
        <VcBanner
          v-if="stats && !stats.recordingEnabled"
          variant="warning"
        >
          {{ $t("PLATFORM.SECURITY.SIGNIN.RECORDING_DISABLED") }}
        </VcBanner>
        <div class="platform-tiles">
          <div
            v-for="tile in tiles"
            :key="tile.label"
            class="platform-tile"
          >
            <div class="platform-tile__label">{{ tile.label }}</div>
            <div class="platform-tile__value">{{ tile.value }}</div>
            <div
              v-if="tile.delta !== undefined"
              class="platform-tile__delta"
            >
              {{ tile.delta >= 0 ? "+" : "" }}{{ tile.delta }} {{ $t("PLATFORM.SECURITY.SIGNIN.VS_PREVIOUS") }}
            </div>
          </div>
        </div>
        <div class="platform-breakdowns">
          <div
            v-for="b in breakdowns"
            :key="b.title"
            class="platform-breakdown"
          >
            <div class="platform-breakdown__title">{{ b.title }}</div>
            <button
              v-for="row in b.rows"
              :key="row.key"
              type="button"
              class="platform-breakdown__row"
              @click="b.apply(row.key)"
            >
              <span>{{ row.key }}</span>
              <span>{{ row.count }}</span>
            </button>
            <div
              v-if="!b.rows.length"
              class="platform-breakdown__empty"
            >
              —
            </div>
          </div>
        </div>
      </div>
      <VcDataTable
        v-model:search-value="criteria.keyword"
        :items="records"
        :total-count="totalCount"
        :pagination="pagination"
        :searchable="true"
        :state-key="'PLATFORM_SIGNIN_LOG'"
        :active-item-id="activeId"
        :global-filters="globalFilters"
        :empty-state="{ icon: 'lucide-log-in', title: $t('PLATFORM.SECURITY.SIGNIN.EMPTY') }"
        @row-click="(e: { data: UserSignInLog }) => openRecord(e.data)"
        @pagination-click="pagination.goToPage"
        @filter="onFilter"
      >
        <VcColumn
          id="createdDate"
          :title="$t('PLATFORM.SECURITY.SIGNIN.DATE')"
          type="datetime"
          always-visible
        />
        <VcColumn
          id="userName"
          :title="$t('PLATFORM.SECURITY.USERS.USER_NAME')"
        />
        <VcColumn
          id="succeeded"
          :title="$t('PLATFORM.SECURITY.SIGNIN.OUTCOME')"
        >
          <template #body="{ data }">
            <div class="tw-inline-flex">
              <VcStatus :variant="data.succeeded ? 'success' : 'danger'">
                {{ data.succeeded ? $t("PLATFORM.SECURITY.SIGNIN.SUCCEEDED") : data.failureReason || $t("PLATFORM.SECURITY.SIGNIN.FAILED") }}
              </VcStatus>
            </div>
          </template>
        </VcColumn>
        <VcColumn
          id="signInType"
          :title="$t('PLATFORM.SECURITY.SIGNIN.TYPE')"
        />
        <VcColumn
          id="ipAddress"
          :title="$t('PLATFORM.SECURITY.SESSIONS.IP')"
        />
      </VcDataTable>
    </div>
  </VcBlade>
</template>

<script setup lang="ts">
import { useAsync, useBlade, useDataTablePagination, useFunctions, useLoading, type IBladeToolbar } from "@vc-shell/framework";
import { VcBanner, VcBlade, VcColumn, VcDataTable, VcSelect, VcStatus } from "@vc-shell/framework/ui";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { signInLogApi, type SignInLogCriteria, type SignInLogStats, type UserSignInLog } from "../../composables/security";

defineBlade({
  url: "/sign-in-log",
  name: "PlatformSecuritySignInLog",
  permissions: ["platform:security:sign_in_log:read"],
});

const PAGE_SIZE = 20;
const SIGN_IN_TYPES = ["Password", "External", "Impersonation", "ImpersonationRevert", "ClientCredentials", "Logout"];
const { t } = useI18n({ useScope: "global" });
const { options, openBlade } = useBlade<{ userId?: string; userName?: string }>();
const { debounce } = useFunctions();

// legacy dashboard periods (minutes); "all" sends no dates
const periods = computed(() => [
  { id: "30", title: t("PLATFORM.SECURITY.SIGNIN.PERIODS.MIN30") },
  { id: "60", title: t("PLATFORM.SECURITY.SIGNIN.PERIODS.HOUR1") },
  { id: "1440", title: t("PLATFORM.SECURITY.SIGNIN.PERIODS.HOURS24") },
  { id: "10080", title: t("PLATFORM.SECURITY.SIGNIN.PERIODS.DAYS7") },
  { id: "43200", title: t("PLATFORM.SECURITY.SIGNIN.PERIODS.DAYS30") },
  { id: "all", title: t("PLATFORM.SECURITY.SIGNIN.PERIODS.ALL") },
]);
const period = ref("1440");

const criteria = ref<SignInLogCriteria & { keyword: string }>({ keyword: "" });
const records = ref<UserSignInLog[]>([]);
const totalCount = ref(0);
const stats = ref<SignInLogStats>();
const activeId = ref<string>();
const pagination = useDataTablePagination({ stateKey: "PLATFORM_SIGNIN_LOG", pageSize: PAGE_SIZE, totalCount });

function base(): SignInLogCriteria {
  const minutes = Number(period.value);
  return {
    userId: options.value?.userId,
    // UTC without "Z": ASP.NET would bind a Z date into server-local time (porting guide, gotcha 6)
    startDate: Number.isFinite(minutes) ? new Date(Date.now() - minutes * 60_000).toISOString().replace("Z", "") : undefined,
  };
}

const { loading: listLoading, action: loadList } = useAsync(async () => {
  const result = await signInLogApi.search({
    ...base(),
    ...criteria.value,
    keyword: criteria.value.keyword || undefined,
    sort: "createdDate:desc",
    skip: pagination.skip,
    take: PAGE_SIZE,
  });
  records.value = result.results ?? [];
  totalCount.value = result.totalCount ?? 0;
});

const { loading: statsLoading, action: loadStats } = useAsync(async () => {
  stats.value = await signInLogApi.stats(base());
});

const loading = useLoading(listLoading, statsLoading);
const reload = () => Promise.all([loadStats(), loadList()]);

const delta = (now: number, before?: number | null) => (before == null ? undefined : now - before);
const tiles = computed(() => {
  const s = stats.value;
  if (!s) return [];
  return [
    { label: t("PLATFORM.SECURITY.SIGNIN.TOTAL"), value: s.totalCount, delta: delta(s.totalCount, s.previousTotalCount) },
    { label: t("PLATFORM.SECURITY.SIGNIN.FAILED"), value: s.failedCount, delta: delta(s.failedCount, s.previousFailedCount) },
    { label: t("PLATFORM.SECURITY.SIGNIN.USERS"), value: s.distinctUserCount, delta: delta(s.distinctUserCount, s.previousDistinctUserCount) },
    {
      label: t("PLATFORM.SECURITY.SIGNIN.IMPERSONATIONS"),
      value: s.impersonationCount,
      delta: delta(s.impersonationCount, s.previousImpersonationCount),
    },
  ];
});

// back to the first page; the page watcher searches then, so search here only when already on it
function toFirstPage() {
  if (pagination.skip) pagination.setPage(1);
  else loadList();
}

// drill-downs: clicking a breakdown row filters the list (legacy dashboard -> list)
function applyFilter(change: SignInLogCriteria) {
  criteria.value = { keyword: criteria.value.keyword, ...change };
  toFirstPage();
}
const breakdowns = computed(() => {
  const s = stats.value;
  return [
    { title: t("PLATFORM.SECURITY.SIGNIN.TOP_FAILED_IPS"), rows: s?.topFailedIpAddresses ?? [], apply: (k: string) => applyFilter({ ipAddress: k, succeeded: false }) },
    { title: t("PLATFORM.SECURITY.SIGNIN.TOP_FAILED_USERS"), rows: s?.topFailedUserNames ?? [], apply: (k: string) => applyFilter({ keyword: k, succeeded: false }) },
    { title: t("PLATFORM.SECURITY.SIGNIN.FAILURE_REASONS"), rows: s?.failureReasonBreakdown ?? [], apply: (k: string) => applyFilter({ failureReasons: [k], succeeded: false }) },
    { title: t("PLATFORM.SECURITY.SIGNIN.BY_STORE"), rows: s?.signInsByStore ?? [], apply: (k: string) => applyFilter({ storeId: k }) },
  ];
});

const globalFilters = computed(() => [
  {
    id: "outcome",
    label: t("PLATFORM.SECURITY.SIGNIN.OUTCOME"),
    filter: {
      options: [
        { value: "succeeded", label: t("PLATFORM.SECURITY.SIGNIN.SUCCEEDED") },
        { value: "failed", label: t("PLATFORM.SECURITY.SIGNIN.FAILED") },
      ],
    },
  },
  { id: "signInTypes", label: t("PLATFORM.SECURITY.SIGNIN.TYPE"), filter: { multiple: true, options: SIGN_IN_TYPES.map((x) => ({ value: x, label: x })) } },
]);

function onFilter(event: { filters: Record<string, unknown> }) {
  const types = event.filters.signInTypes;
  applyFilter({
    succeeded: event.filters.outcome ? event.filters.outcome === "succeeded" : undefined,
    signInTypes: Array.isArray(types) && types.length ? types : types ? [types as string] : undefined,
  });
}

function openRecord(record: UserSignInLog) {
  activeId.value = record.id;
  openBlade({ name: "PlatformSecuritySignInLogDetails", options: { record }, onClose: () => (activeId.value = undefined) });
}

reload();
watch(period, () => {
  loadStats();
  toFirstPage();
});
watch(() => criteria.value.keyword, debounce(toFirstPage, 300));
watch(() => pagination.skip, () => loadList());

const toolbar = ref<IBladeToolbar[]>([
  { id: "refresh", title: t("PLATFORM.COMMON.REFRESH"), icon: "lucide-refresh-cw", clickHandler: () => reload() },
  {
    id: "clear",
    title: t("PLATFORM.SECURITY.SIGNIN.VIEW_ALL"),
    icon: "lucide-filter-x",
    clickHandler: () => applyFilter({}),
  },
]);
</script>

<style lang="scss">
.platform-signin {
  display: flex;
  flex-direction: column;
  height: 100%;
  &__stats {
    padding: 16px 22px 8px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  &__period {
    max-width: 240px;
  }
}

.platform-tiles {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.platform-tile {
  border: 1px solid var(--color-neutral-200);
  border-radius: 10px;
  padding: 12px 14px;
  &__label {
    font-size: 12px;
    color: var(--color-neutral-500);
  }
  &__value {
    font-size: 24px;
    font-weight: 600;
    color: var(--color-neutral-900);
  }
  &__delta {
    font-size: 12px;
    color: var(--color-neutral-500);
  }
}

.platform-breakdowns {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px 40px;
}

.platform-breakdown {
  font-size: 13px;
  &__title {
    font-weight: 600;
    color: var(--color-neutral-700);
    margin-bottom: 4px;
  }
  &__row {
    display: flex;
    justify-content: space-between;
    width: 100%;
    border: 0;
    background: none;
    padding: 3px 0;
    color: var(--color-primary-600);
    cursor: pointer;
    text-align: left;
  }
  &__empty {
    color: var(--color-neutral-400);
  }
}
</style>
