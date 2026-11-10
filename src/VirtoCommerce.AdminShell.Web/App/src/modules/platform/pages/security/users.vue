<template>
  <VcBlade
    :title="$t('PLATFORM.SECURITY.USERS.TITLE')"
    :toolbar-items="toolbar"
    :loading="loading"
    width="50%"
  >
    <VcDataTable
      v-model:search-value="keyword"
      v-model:sort-field="sortField"
      v-model:sort-order="sortOrder"
      v-model:selection="selection"
      selection-mode="multiple"
      :items="users"
      :total-count="totalCount"
      :pagination="pagination"
      :searchable="true"
      :state-key="'PLATFORM_USERS'"
      :active-item-id="activeId"
      :show-all-columns="!activeId"
      :global-filters="globalFilters"
      :empty-state="{ icon: 'lucide-users', title: $t('PLATFORM.SECURITY.USERS.EMPTY') }"
      @row-click="(e: { data: ApplicationUser }) => openUser(e.data.id)"
      @pagination-click="pagination.goToPage"
      @filter="onFilter"
    >
      <VcColumn
        id="userName"
        :title="$t('PLATFORM.SECURITY.USERS.USER_NAME')"
        sortable
        always-visible
      />
      <VcColumn
        id="email"
        :title="$t('PLATFORM.SECURITY.USERS.EMAIL')"
        sortable
      />
      <VcColumn
        id="userType"
        :title="$t('PLATFORM.SECURITY.USERS.ACCOUNT_TYPE')"
        sortable
      />
      <VcColumn
        id="status"
        :title="$t('PLATFORM.SECURITY.USERS.STATUS')"
        sortable
      >
        <template #body="{ data }">
          <div
            v-if="data.status || isLocked(data)"
            class="tw-inline-flex platform-badges"
          >
            <VcStatus
              v-if="isLocked(data)"
              variant="danger"
            >
              {{ $t("PLATFORM.SECURITY.USERS.LOCKED") }}
            </VcStatus>
            <VcStatus
              v-if="data.status"
              :variant="data.status === 'Approved' ? 'success' : data.status === 'Rejected' ? 'danger' : 'info'"
            >
              {{ data.status }}
            </VcStatus>
          </div>
        </template>
      </VcColumn>
      <VcColumn
        id="lastLoginDate"
        :title="$t('PLATFORM.SECURITY.USERS.LAST_LOGIN')"
        type="date-ago"
        sortable
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
  useDataTableSort,
  useLoading,
  usePopup,
  type ApplicationUser,
  type IBladeToolbar,
} from "@vc-shell/framework";
import { VcBlade, VcColumn, VcDataTable, VcStatus } from "@vc-shell/framework/ui";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { refreshItem } from "../../composables/blade";
import { PAGE_SIZE, useSearchableList } from "../../composables/list";
import { dayRange, tableFilters, useSearchPresets } from "../../composables/search";
import { ensureSucceeded, useSecurityLookups } from "../../composables/security";

defineBlade({
  url: "/users",
  name: "PlatformSecurityUsers",
  permissions: ["platform:security:access"],
});

const { t } = useI18n({ useScope: "global" });
// options.keyword: the list opens filtered (global search's "Show all")
const { openBlade, exposeToChildren, options } = useBlade<{ keyword?: string }>();
const { showConfirmation } = usePopup();
const { getApiClient } = useApiClient(SecurityClient);
const lookups = useSecurityLookups();
lookups.load();

const users = ref<ApplicationUser[]>([]);
const selection = ref<ApplicationUser[]>([]);
const activeId = ref<string>();
const filters = ref<Record<string, unknown>>({});

const { sortField, sortOrder, sortExpression } = useDataTableSort({
  stateKey: "PLATFORM_USERS",
  initialField: "userName",
  initialDirection: "ASC",
});
// the keyword, page and reload after typing; a filter goes back to page 1, the sort reloads; options.keyword: the list
// opens filtered (global search's "Show all")
const { keyword, totalCount, pagination } = useSearchableList({
  stateKey: "PLATFORM_USERS",
  keyword: options.value?.keyword,
  load: () => load(),
  resetOn: [filters],
  reloadOn: [sortExpression],
});

const isLocked = (u: ApplicationUser) => !!u.lockoutEnd && new Date(u.lockoutEnd) > new Date();

const { loading: searchLoading, action: load } = useAsync(async () => {
  const f = filters.value;
  const flags = (f.flags as string[] | undefined) ?? [];
  const lastLogin = dayRange(f.loginStartDate, f.loginEndDate);
  const result = await (
    await getApiClient()
  ).searchUsers({
    keyword: keyword.value || undefined,
    sort: sortExpression.value,
    skip: pagination.skip,
    take: PAGE_SIZE,
    userType: (f.userType as string) || undefined,
    status: (f.status as string) || undefined,
    roles: f.role ? [f.role as string] : undefined,
    onlyLocked: flags.includes("locked") || undefined,
    emailConfirmed: flags.includes("unverified") ? false : undefined,
    loginStartDate: lastLogin.from,
    loginEndDate: lastLogin.to,
  });
  users.value = result.results ?? [];
  totalCount.value = result.totalCount ?? 0;
});

const { loading: deleteLoading, action: remove } = useAsync<string[]>(async (names) => {
  // legacy deletes by user name
  const client = await getApiClient();
  ensureSucceeded((await client.delete(names)) as unknown as { succeeded?: boolean });
});

const loading = useLoading(searchLoading, deleteLoading);

const globalFilters = computed(() =>
  tableFilters([
    {
      id: "status",
      label: t("PLATFORM.SECURITY.USERS.STATUS"),
      filter: { options: lookups.accountStatuses.value.map((x) => ({ value: x.id, label: x.title })) },
    },
    {
      id: "role",
      label: t("PLATFORM.SECURITY.USERS.ROLE"),
      filter: { options: lookups.roles.value.map((r) => ({ value: r.name!, label: r.name! })) },
    },
    {
      id: "lastLogin",
      label: t("PLATFORM.SECURITY.USERS.LAST_LOGIN"),
      filter: { range: ["loginStartDate", "loginEndDate"] as [string, string] },
    },
    // yes/no states as their own pills ("Locked"), offered behind + Filter; the account type too
    {
      id: "userType",
      label: t("PLATFORM.SECURITY.USERS.ACCOUNT_TYPE"),
      filter: { options: lookups.accountTypes.value.map((x) => ({ value: x.id, label: x.title })) },
      pinned: false,
    },
    { id: "locked", label: t("PLATFORM.SECURITY.USERS.LOCKED"), filter: { toggle: true }, pinned: false },
    {
      id: "unverified",
      label: t("PLATFORM.SECURITY.USERS.EMAIL_NOT_VERIFIED"),
      filter: { toggle: true },
      pinned: false,
    },
  ]),
);

// the presets the list offers everyone: the accounts an administrator checks most
useSearchPresets("PlatformSecurityUsers", [
  {
    id: "locked",
    name: t("PLATFORM.SECURITY.USERS.PRESETS.LOCKED"),
    values: { locked: true },
    pinned: true,
    version: 1,
  },
  {
    id: "unverified",
    name: t("PLATFORM.SECURITY.USERS.PRESETS.UNVERIFIED"),
    values: { unverified: true },
    pinned: true,
    version: 1,
  },
  {
    id: "recent",
    name: t("PLATFORM.SECURITY.USERS.PRESETS.RECENT"),
    values: { lastLogin: { relative: "7d" } },
    version: 1,
  },
]);

function onFilter(event: { filters: Record<string, unknown> }) {
  const { locked, unverified, ...rest } = event.filters;
  filters.value = { ...rest, flags: [locked && "locked", unverified && "unverified"].filter(Boolean) };
}

load();

function openUser(id?: string) {
  activeId.value = id;
  openBlade({
    name: "PlatformSecurityUserDetails",
    param: id,
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
    clickHandler: () => openUser(),
  },
  {
    id: "delete",
    title: t("PLATFORM.COMMON.DELETE"),
    icon: "lucide-trash-2",
    permissions: ["platform:security:delete"],
    disabled: computed(() => !selection.value.length),
    async clickHandler() {
      if (await showConfirmation(t("PLATFORM.SECURITY.USERS.DELETE_CONFIRM", { count: selection.value.length }))) {
        await remove(selection.value.map((u) => u.userName!));
        selection.value = [];
        await load();
      }
    },
  },
]);

exposeToChildren({ reload: () => load() });
</script>
