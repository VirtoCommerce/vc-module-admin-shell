<template>
  <VcBlade
    :title="isNew ? $t('PLATFORM.SECURITY.OAUTH.NEW_TITLE') : item.displayName || item.clientId"
    :subtitle="$t('PLATFORM.SECURITY.OAUTH.SUBTITLE')"
    :toolbar-items="toolbar"
    :loading="loading"
    :modified="form.isModified.value"
    width="50%"
  >
    <VcContainer>
      <VcForm class="platform-form">
        <VcInput
          v-model="item.displayName"
          :label="$t('PLATFORM.SECURITY.OAUTH.NAME')"
          required
          :error-message="item.displayName ? undefined : $t('PLATFORM.COMMON.REQUIRED')"
        />
        <VcField
          :label="$t('PLATFORM.SECURITY.OAUTH.CLIENT_ID')"
          :model-value="item.clientId"
          copyable
        />
        <template v-if="isNew">
          <VcField
            :label="$t('PLATFORM.SECURITY.OAUTH.CLIENT_SECRET')"
            :model-value="item.clientSecret"
            copyable
          />
          <VcBanner variant="warning">{{ $t("PLATFORM.SECURITY.OAUTH.SECRET_WARNING") }}</VcBanner>
        </template>
        <VcField
          :label="$t('PLATFORM.SECURITY.OAUTH.CLIENT_TYPE')"
          :model-value="item.clientType ?? '—'"
        />
        <VcMultivalue
          v-model="redirectUris"
          option-label="id"
          option-value="id"
          :label="$t('PLATFORM.SECURITY.OAUTH.REDIRECT_URIS')"
          :placeholder="$t('PLATFORM.SECURITY.OAUTH.URI_PLACEHOLDER')"
          :error-message="uriError(item.redirectUris)"
        />
        <VcMultivalue
          v-model="postLogoutRedirectUris"
          option-label="id"
          option-value="id"
          :label="$t('PLATFORM.SECURITY.OAUTH.POST_LOGOUT_URIS')"
          :placeholder="$t('PLATFORM.SECURITY.OAUTH.URI_PLACEHOLDER')"
          :error-message="uriError(item.postLogoutRedirectUris)"
        />
      </VcForm>
    </VcContainer>
  </VcBlade>
</template>

<script setup lang="ts">
import {
  OAuthAppsClient,
  notification,
  useApiClient,
  useAsync,
  useBlade,
  useLoading,
  usePermissions,
  usePopup,
  type IBladeToolbar,
  type OpenIddictApplicationDescriptor,
} from "@vc-shell/framework";
import { VcBanner, VcBlade, VcContainer, VcField, VcForm, VcInput, VcMultivalue } from "@vc-shell/framework/ui";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { saveResetItems, usePlatformBladeForm } from "../../composables/blade";

defineBlade({
  url: "/oauth-app",
  name: "PlatformSecurityOAuthAppDetails",
  permissions: ["platform:security:access"],
});

// the generated type marks the collections readonly; they are plain arrays on the wire
type App = Omit<OpenIddictApplicationDescriptor, "redirectUris" | "postLogoutRedirectUris"> & {
  redirectUris?: string[];
  postLogoutRedirectUris?: string[];
};

const { t } = useI18n({ useScope: "global" });
const { options, closeSelf, callParent } = useBlade<{ app?: App }>();
const { hasAccess } = usePermissions();
const { showConfirmation } = usePopup();
const { getApiClient } = useApiClient(OAuthAppsClient);

const isNew = computed(() => !options.value?.app);
const item = ref<App>({});

const asChips = (key: "redirectUris" | "postLogoutRedirectUris") =>
  computed({
    get: () => (item.value[key] ?? []).map((id) => ({ id })),
    set: (chips: { id?: string }[]) => (item.value[key] = chips.map((c) => String(c.id ?? "").trim()).filter(Boolean)),
  });
const redirectUris = asChips("redirectUris");
const postLogoutRedirectUris = asChips("postLogoutRedirectUris");

// legacy validator "uriWithoutQuery": absolute URI, no query string
function uriError(uris?: string[]) {
  const bad = (uris ?? []).find((u) => {
    try {
      return !!new URL(u).search;
    } catch {
      return true;
    }
  });
  return bad ? t("PLATFORM.SECURITY.OAUTH.URI_INVALID", { uri: bad }) : undefined;
}

const valid = computed(() => !!item.value.displayName && !uriError(item.value.redirectUris) && !uriError(item.value.postLogoutRedirectUris));

const form = usePlatformBladeForm({
  data: item,
  // POST oauthapps saves new and existing apps alike, with :update
  canSaveOverride: computed(() => valid.value && hasAccess("platform:security:oauth_applications:update")),
});

const { loading: loadLoading, action: load } = useAsync(async () => {
  const app = options.value?.app ?? ((await (await getApiClient()).new()) as App);
  item.value = JSON.parse(JSON.stringify(app));
  form.setBaseline();
});

const { loading: saveLoading, action: save } = useAsync(async () => {
  // upsert by client id; the server keeps the secret on update and normalizes the permissions
  await (await getApiClient()).save(item.value as OpenIddictApplicationDescriptor);
  notification.success(t("PLATFORM.COMMON.SAVED"));
  form.setBaseline();
  await callParent("reload");
  await closeSelf();
});

const loading = useLoading(loadLoading, saveLoading);

const toolbar = computed<IBladeToolbar[]>(() => [
  ...saveResetItems(form, { save: () => save(), reset: () => load(), isNew: isNew.value, resetVisible: !isNew.value }),
  {
    id: "delete",
    title: t("PLATFORM.COMMON.DELETE"),
    icon: "lucide-trash-2",
    permissions: ["platform:security:oauth_applications:delete"],
    isVisible: !isNew.value,
    async clickHandler() {
      if (await showConfirmation(t("PLATFORM.COMMON.DELETE_CONFIRMATION", { count: 1 }))) {
        await (await getApiClient()).delete([item.value.clientId!]);
        form.setBaseline();
        await callParent("reload");
        await closeSelf();
      }
    },
  },
]);

load();
</script>
