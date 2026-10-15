<template>
  <VcBlade
    :title="$t('PLATFORM.SECURITY.OAUTH.TITLE')"
    :toolbar-items="toolbar"
    :loading="loading"
    width="50%"
  >
    <VcDataTable
      v-model:selection="selection"
      selection-mode="multiple"
      :items="apps"
      :total-count="totalCount"
      :pagination="pagination"
      :state-key="'PLATFORM_OAUTH_APPS'"
      :active-item-id="activeId"
      :empty-state="{ icon: 'lucide-app-window', title: $t('PLATFORM.SECURITY.OAUTH.EMPTY') }"
      @row-click="(e: { data: AppRow }) => openApp(e.data)"
      @pagination-click="pagination.goToPage"
    >
      <VcColumn
        id="displayName"
        :title="$t('PLATFORM.SECURITY.OAUTH.NAME')"
        always-visible
      />
      <VcColumn
        id="clientId"
        :title="$t('PLATFORM.SECURITY.OAUTH.CLIENT_ID')"
      />
      <VcColumn
        id="clientType"
        :title="$t('PLATFORM.SECURITY.OAUTH.CLIENT_TYPE')"
      />
    </VcDataTable>
  </VcBlade>
</template>

<script setup lang="ts">
import {
  OAuthAppsClient,
  useApiClient,
  useAsync,
  useBlade,
  useDataTablePagination,
  useLoading,
  usePopup,
  type IBladeToolbar,
  type OpenIddictApplicationDescriptor,
} from "@vc-shell/framework";
import { VcBlade, VcColumn, VcDataTable } from "@vc-shell/framework/ui";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { refreshItem } from "../../composables/blade";
import { PAGE_SIZE } from "../../composables/list";

defineBlade({
  url: "/oauth-apps",
  name: "PlatformSecurityOAuthApps",
  permissions: ["platform:security:access"],
});

type AppRow = OpenIddictApplicationDescriptor & { id: string };

const { t } = useI18n({ useScope: "global" });
const { openBlade, exposeToChildren } = useBlade();
const { showConfirmation } = usePopup();
const { getApiClient } = useApiClient(OAuthAppsClient);

const apps = ref<AppRow[]>([]);
const totalCount = ref(0);
const selection = ref<AppRow[]>([]);
const activeId = ref<string>();
const pagination = useDataTablePagination({ stateKey: "PLATFORM_OAUTH_APPS", pageSize: PAGE_SIZE, totalCount });

const { loading: searchLoading, action: load } = useAsync(async () => {
  const result = await (await getApiClient()).search({ sort: "DisplayName:ASC", skip: pagination.skip, take: PAGE_SIZE });
  apps.value = (result.results ?? []).map((x) => ({ ...x, id: x.clientId! }));
  totalCount.value = result.totalCount ?? 0;
});

const { loading: deleteLoading, action: remove } = useAsync<string[]>(async (clientIds) => {
  await (await getApiClient()).delete(clientIds);
});

const loading = useLoading(searchLoading, deleteLoading);

load();
watch(() => pagination.skip, () => load());

// there is no GET by client id: the details blade gets the row (or a new descriptor) as options
function openApp(app?: AppRow) {
  activeId.value = app?.id;
  openBlade({
    name: "PlatformSecurityOAuthAppDetails",
    options: { app },
    onClose: () => (activeId.value = undefined),
  });
}

const toolbar = ref<IBladeToolbar[]>([
  refreshItem(() => load()),
  {
    id: "add",
    title: t("PLATFORM.COMMON.ADD"),
    icon: "lucide-plus",
    // the save (POST oauthapps) asks for :update, new or not
    permissions: ["platform:security:oauth_applications:update"],
    clickHandler: () => openApp(),
  },
  {
    id: "delete",
    title: t("PLATFORM.COMMON.DELETE"),
    icon: "lucide-trash-2",
    permissions: ["platform:security:oauth_applications:delete"],
    disabled: computed(() => !selection.value.length),
    async clickHandler() {
      if (await showConfirmation(t("PLATFORM.COMMON.DELETE_CONFIRMATION", { count: selection.value.length }))) {
        await remove(selection.value.map((a) => a.clientId!));
        selection.value = [];
        await load();
      }
    },
  },
]);

exposeToChildren({ reload: () => load() });
</script>
