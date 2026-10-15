<template>
  <VcBlade
    :title="$t('PLATFORM.SECURITY.SESSIONS.TITLE')"
    :toolbar-items="toolbar"
    :loading="loading"
    width="50%"
  >
    <VcDataTable
      v-model:selection="selection"
      selection-mode="multiple"
      :items="sessions"
      :total-count="totalCount"
      :state-key="'PLATFORM_USER_SESSIONS'"
      :empty-state="{ icon: 'lucide-monitor-smartphone', title: $t('PLATFORM.SECURITY.SESSIONS.EMPTY') }"
    >
      <VcColumn
        id="ipAddress"
        :title="$t('PLATFORM.SECURITY.SESSIONS.IP')"
        always-visible
      />
      <VcColumn
        id="userAgent"
        :title="$t('PLATFORM.SECURITY.SESSIONS.USER_AGENT')"
      />
      <VcColumn
        id="createdDate"
        :title="$t('PLATFORM.SECURITY.USER.CREATED')"
        type="date-ago"
      />
      <VcColumn
        id="expirationDate"
        :title="$t('PLATFORM.SECURITY.SESSIONS.EXPIRES')"
        type="datetime"
      />
    </VcDataTable>
  </VcBlade>
</template>

<script setup lang="ts">
import { SecurityClient, useApiClient, useAsync, useBlade, useLoading, usePopup, type IBladeToolbar, type UserSession } from "@vc-shell/framework";
import { VcBlade, VcColumn, VcDataTable } from "@vc-shell/framework/ui";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { refreshItem } from "../../composables/blade";

defineBlade({
  url: "/sessions",
  name: "PlatformSecurityUserSessions",
  permissions: ["platform:security:access"],
});

const { t } = useI18n({ useScope: "global" });
const { param, callParent } = useBlade();
const { showConfirmation } = usePopup();
const { getApiClient } = useApiClient(SecurityClient);

const sessions = ref<UserSession[]>([]);
const totalCount = ref(0);
const selection = ref<UserSession[]>([]);

const { loading: loadLoading, action: load } = useAsync(async () => {
  const result = await (await getApiClient()).searchUserSessions(param.value!, { userId: param.value, take: 100 });
  sessions.value = result.results ?? [];
  totalCount.value = result.totalCount ?? 0;
  selection.value = [];
});

const { loading: terminateLoading, action: terminate } = useAsync<string[] | undefined>(async (ids) => {
  const client = await getApiClient();
  if (ids) await Promise.all(ids.map((id) => client.terminateUserSession(param.value!, id)));
  else await client.terminateAllUserSessions(param.value!);
  await load();
  await callParent("reload");
});

const loading = useLoading(loadLoading, terminateLoading);

const toolbar = ref<IBladeToolbar[]>([
  refreshItem(() => load()),
  {
    id: "terminate",
    title: t("PLATFORM.SECURITY.SESSIONS.TERMINATE"),
    icon: "lucide-log-out",
    permissions: ["platform:security:revokeToken"],
    disabled: computed(() => !selection.value.length),
    async clickHandler() {
      if (await showConfirmation(t("PLATFORM.SECURITY.SESSIONS.TERMINATE_CONFIRM", { count: selection.value.length }))) {
        await terminate(selection.value.map((s) => s.id!));
      }
    },
  },
  {
    id: "terminateAll",
    title: t("PLATFORM.SECURITY.SESSIONS.TERMINATE_ALL"),
    icon: "lucide-circle-x",
    permissions: ["platform:security:revokeToken"],
    disabled: computed(() => !sessions.value.length),
    async clickHandler() {
      if (await showConfirmation(t("PLATFORM.SECURITY.SESSIONS.TERMINATE_ALL_CONFIRM"))) {
        await terminate(undefined);
      }
    },
  },
]);

load();
</script>
