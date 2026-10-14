<template>
  <VcBlade
    :title="$t('PLATFORM.SECURITY.APIKEYS.TITLE')"
    :subtitle="options?.userName"
    :toolbar-items="toolbar"
    :loading="loading"
    width="50%"
  >
    <VcDataTable
      v-model:selection="selection"
      selection-mode="multiple"
      :items="keys"
      :state-key="'PLATFORM_USER_APIKEYS'"
      :empty-state="{ icon: 'lucide-key', title: $t('PLATFORM.SECURITY.APIKEYS.EMPTY') }"
    >
      <VcColumn
        id="apiKey"
        :title="$t('PLATFORM.SECURITY.APIKEYS.KEY')"
        always-visible
      >
        <template #body="{ data }">
          <code class="platform-mono">{{ data.apiKey }}</code>
        </template>
      </VcColumn>
      <VcColumn
        id="isActive"
        :title="$t('PLATFORM.SECURITY.APIKEYS.ACTIVE')"
        width="110px"
      >
        <template #body="{ data }">
          <VcSwitch
            :model-value="data.isActive"
            :aria-label="$t('PLATFORM.SECURITY.APIKEYS.ACTIVE')"
            :disabled="!hasAccess('platform:security:update')"
            @update:model-value="(value?: boolean) => toggle(data, !!value)"
          />
        </template>
      </VcColumn>
      <VcColumn
        id="createdDate"
        :title="$t('PLATFORM.SECURITY.USER.CREATED')"
        type="date-ago"
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
  usePermissions,
  usePopup,
  type IBladeToolbar,
  type UserApiKey,
} from "@vc-shell/framework";
import { VcBlade, VcColumn, VcDataTable, VcSwitch } from "@vc-shell/framework/ui";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

defineBlade({
  url: "/apikeys",
  name: "PlatformSecurityUserApiKeys",
  permissions: ["platform:security:access"],
});

const { t } = useI18n({ useScope: "global" });
const { param, options, callParent } = useBlade<{ userName?: string }>();
const { hasAccess } = usePermissions();
const { showConfirmation } = usePopup();
const { getApiClient } = useApiClient(SecurityClient);

const keys = ref<UserApiKey[]>([]);
const selection = ref<UserApiKey[]>([]);

const { loading: loadLoading, action: load } = useAsync(async () => {
  keys.value = (await (await getApiClient()).getUserApiKeys(param.value!)) ?? [];
  selection.value = [];
});

const { loading: changeLoading, action: change } = useAsync<(client: SecurityClient) => Promise<unknown>>(async (fn) => {
  await fn!(await getApiClient());
  await load();
  await callParent("reload");
});

const loading = useLoading(loadLoading, changeLoading);

const toggle = (key: UserApiKey, isActive: boolean) => change((client) => client.updateUserApiKey({ ...key, isActive }));

const toolbar = ref<IBladeToolbar[]>([
  { id: "refresh", title: t("PLATFORM.COMMON.REFRESH"), icon: "lucide-refresh-cw", clickHandler: () => load() },
  {
    id: "generate",
    title: t("PLATFORM.SECURITY.APIKEYS.GENERATE"),
    icon: "lucide-plus",
    permissions: ["platform:security:update"],
    // legacy generates a UUID v4 client-side
    clickHandler: () =>
      change((client) =>
        client.saveUserApiKey({ apiKey: crypto.randomUUID(), isActive: true, userId: param.value, userName: options.value?.userName }),
      ),
  },
  {
    id: "delete",
    title: t("PLATFORM.COMMON.DELETE"),
    icon: "lucide-trash-2",
    permissions: ["platform:security:delete"],
    disabled: computed(() => !selection.value.length),
    async clickHandler() {
      if (await showConfirmation(t("PLATFORM.COMMON.DELETE_CONFIRMATION", { count: selection.value.length }))) {
        await change((client) => client.deleteUserApiKeys(selection.value.map((k) => k.id!)));
      }
    },
  },
]);

load();
</script>

