<template>
  <VcBlade
    :title="$t('PLATFORM.SECURITY.APIKEYS.TITLE')"
    :subtitle="options?.userName"
    :toolbar-items="toolbar"
    :loading="loading"
    width="50%"
  >
    <VcBanner
      v-if="newKey"
      variant="warning"
      icon="lucide-key"
      class="platform-apikeys__new"
      :collapsed-height="1000"
    >
      <template #title>{{ $t("PLATFORM.SECURITY.APIKEYS.NEW_KEY") }}</template>
      <p>{{ $t("PLATFORM.SECURITY.APIKEYS.NEW_KEY_WARNING") }}</p>
      <div class="platform-apikeys__new-value">
        <code
          ref="newKeyElement"
          class="platform-mono"
          data-testid="new-api-key"
          >{{ newKey }}</code
        >
        <VcButton
          size="sm"
          icon="lucide-copy"
          @click="copyNewKey"
        >
          {{ $t("PLATFORM.SECURITY.APIKEYS.COPY") }}
        </VcButton>
        <VcButton
          size="sm"
          variant="secondary"
          @click="newKey = undefined"
        >
          {{ $t("PLATFORM.SECURITY.APIKEYS.DONE") }}
        </VcButton>
      </div>
    </VcBanner>
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
  notification,
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
import { VcBanner, VcBlade, VcButton, VcColumn, VcDataTable, VcSwitch } from "@vc-shell/framework/ui";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { refreshItem } from "../../composables/blade";

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
// The platform returns a key's value once, in the response that created it; the list shows only a hint.
const newKey = ref<string>();

const { loading: loadLoading, action: load } = useAsync(async () => {
  keys.value = (await (await getApiClient()).getUserApiKeys(param.value!)) ?? [];
  selection.value = [];
});

const { loading: changeLoading, action: change } = useAsync<(client: SecurityClient) => Promise<unknown>>(
  async (fn) => {
    await fn!(await getApiClient());
    await load();
    await callParent("reload");
  },
);

const loading = useLoading(loadLoading, changeLoading);

// The key comes back with its hint in place of the value, which tells the platform to keep the stored key.
const toggle = (key: UserApiKey, isActive: boolean) =>
  change((client) => client.updateUserApiKey({ ...key, isActive }));

const newKeyElement = ref<HTMLElement>();

// Where the browser refuses the Clipboard API (a non-secure context, a denied permission), the key is selected
// in the banner so the user can copy it with the keyboard or the context menu.
function selectNewKey() {
  const selection = window.getSelection();
  if (newKeyElement.value && selection) {
    selection.selectAllChildren(newKeyElement.value);
  }
}

async function copyNewKey() {
  try {
    await navigator.clipboard.writeText(newKey.value ?? "");
    notification.success(t("PLATFORM.SECURITY.APIKEYS.COPIED"));
  } catch {
    selectNewKey();
    notification.error(t("PLATFORM.SECURITY.APIKEYS.COPY_FAILED"));
  }
}

const toolbar = ref<IBladeToolbar[]>([
  refreshItem(() => load()),
  {
    id: "generate",
    title: t("PLATFORM.SECURITY.APIKEYS.GENERATE"),
    icon: "lucide-plus",
    permissions: ["platform:security:update"],
    // No value: the platform generates the key and returns it this once.
    clickHandler: () =>
      change(async (client) => {
        const saved = await client.saveUserApiKey({
          isActive: true,
          userId: param.value,
          userName: options.value?.userName,
        });
        newKey.value = saved?.[0]?.apiKey;
      }),
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

<style lang="scss">
.platform-apikeys__new {
  margin: 12px;

  p {
    margin: 0 0 8px;
  }
}

.platform-apikeys__new-value {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;

  code {
    word-break: break-all;
    user-select: all;
  }
}
</style>
