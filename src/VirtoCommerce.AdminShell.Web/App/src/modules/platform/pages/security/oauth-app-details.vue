<template>
  <VcBlade
    :title="isNew ? $t('PLATFORM.SECURITY.OAUTH.NEW_TITLE') : item.displayName || item.clientId"
    :subtitle="$t('PLATFORM.SECURITY.OAUTH.SUBTITLE')"
    :toolbar-items="toolbar"
    :loading="loading"
    :modified="form.isModified.value"
    width="60%"
  >
    <VcContainer>
      <VcForm class="platform-form">
        <VcRow class="tw-gap-4">
          <VcCol>
            <VcInput
              v-model="item.displayName"
              :label="$t('PLATFORM.SECURITY.OAUTH.NAME')"
              required
              :error-message="item.displayName ? undefined : $t('PLATFORM.COMMON.REQUIRED')"
            />
          </VcCol>
          <VcCol>
            <VcInput
              v-if="isNew"
              v-model="item.clientId"
              :label="$t('PLATFORM.SECURITY.OAUTH.CLIENT_ID')"
              required
              :error-message="clientIdError"
            />
            <VcField
              v-else
              :label="$t('PLATFORM.SECURITY.OAUTH.CLIENT_ID')"
              :model-value="item.clientId"
              copyable
            />
          </VcCol>
        </VcRow>

        <VcRow class="tw-gap-4">
          <VcCol>
            <VcSelect
              :model-value="item.clientType"
              :label="$t('PLATFORM.SECURITY.OAUTH.CLIENT_TYPE')"
              :options="clientTypeOptions"
              :hint="
                item.clientType ? $t(`PLATFORM.SECURITY.OAUTH.CLIENT_TYPES.${upper(item.clientType)}_HINT`) : undefined
              "
              :disabled="!isNew"
              :clearable="false"
              @update:model-value="setClientType"
            />
          </VcCol>
          <VcCol>
            <VcSelect
              v-model="item.applicationType"
              :label="$t('PLATFORM.SECURITY.OAUTH.APPLICATION_TYPE')"
              :options="applicationTypeOptions"
              :hint="$t(`PLATFORM.SECURITY.OAUTH.APPLICATION_TYPES.${upper(item.applicationType || 'web')}_HINT`)"
              :placeholder="$t('PLATFORM.SECURITY.OAUTH.APPLICATION_TYPES.WEB')"
              :clearable="false"
            />
          </VcCol>
        </VcRow>

        <template v-if="isNew && item.clientType === 'confidential'">
          <VcField
            :label="$t('PLATFORM.SECURITY.OAUTH.CLIENT_SECRET')"
            :model-value="item.clientSecret"
            copyable
          />
          <div>
            <VcButton
              variant="secondary"
              size="sm"
              icon="lucide-download"
              @click="downloadCredentials"
            >
              {{ $t("PLATFORM.SECURITY.OAUTH.DOWNLOAD") }}
            </VcButton>
          </div>
          <VcBanner variant="warning">{{ $t("PLATFORM.SECURITY.OAUTH.SECRET_WARNING") }}</VcBanner>
        </template>

        <VcCard :header="$t('PLATFORM.SECURITY.OAUTH.SIGN_IN')">
          <div class="platform-card-body">
            <VcSelect
              v-model="item.consentType"
              :label="$t('PLATFORM.SECURITY.OAUTH.CONSENT_TYPE')"
              :options="consentTypeOptions"
              :hint="consentHint"
              :placeholder="$t('PLATFORM.SECURITY.OAUTH.CONSENT_TYPES.EXPLICIT')"
              :clearable="false"
            />
            <VcSwitch
              :model-value="requiresPkce(item)"
              :label="$t('PLATFORM.SECURITY.OAUTH.PKCE')"
              :tooltip="$t('PLATFORM.SECURITY.OAUTH.PKCE_HINT')"
              @update:model-value="(on?: boolean) => setPkce(item, !!on)"
            />
            <VcBanner
              v-if="item.clientType === 'public' && !requiresPkce(item)"
              variant="warning"
            >
              {{ $t("PLATFORM.SECURITY.OAUTH.PKCE_WARNING") }}
            </VcBanner>
            <VcCheckboxGroup
              :model-value="grantTypes"
              :label="$t('PLATFORM.SECURITY.OAUTH.GRANT_TYPES')"
              :options="grantTypeOptions"
              :error-message="hasGrantType(item) ? undefined : $t('PLATFORM.SECURITY.OAUTH.GRANT_TYPE_REQUIRED')"
              orientation="horizontal"
              @update:model-value="(values: string[]) => setChecked(GRANT_TYPES, values)"
            />
            <VcBanner
              v-if="item.clientType === 'public' && hasPermission(item, CLIENT_CREDENTIALS)"
              variant="warning"
            >
              {{ $t("PLATFORM.SECURITY.OAUTH.CLIENT_CREDENTIALS_WARNING") }}
            </VcBanner>
            <VcCheckboxGroup
              :model-value="scopes"
              :label="$t('PLATFORM.SECURITY.OAUTH.SCOPES')"
              :hint="$t('PLATFORM.SECURITY.OAUTH.SCOPES_HINT')"
              :options="scopeOptions"
              orientation="horizontal"
              @update:model-value="(values: string[]) => setChecked(SCOPES, values)"
            />
            <VcMultivalue
              v-model="redirectUris"
              option-label="id"
              option-value="id"
              :label="$t('PLATFORM.SECURITY.OAUTH.REDIRECT_URIS')"
              :placeholder="$t('PLATFORM.SECURITY.OAUTH.URI_PLACEHOLDER')"
              :error-message="uriError(item.redirectUris, baseline.redirectUris)"
            />
            <VcBanner
              v-if="hasPermission(item, AUTHORIZATION_CODE) && !item.redirectUris?.length"
              variant="warning"
            >
              {{ $t("PLATFORM.SECURITY.OAUTH.REDIRECT_REQUIRED") }}
            </VcBanner>
            <VcBanner
              v-if="legacyHttpUris.length"
              variant="warning"
            >
              {{ $t("PLATFORM.SECURITY.OAUTH.URI_HTTP_LEGACY", { uri: legacyHttpUris.join(", ") }) }}
            </VcBanner>
            <VcMultivalue
              v-model="postLogoutRedirectUris"
              option-label="id"
              option-value="id"
              :label="$t('PLATFORM.SECURITY.OAUTH.POST_LOGOUT_URIS')"
              :placeholder="$t('PLATFORM.SECURITY.OAUTH.URI_PLACEHOLDER')"
              :error-message="uriError(item.postLogoutRedirectUris, baseline.postLogoutRedirectUris)"
            />
          </div>
        </VcCard>

        <VcCard :header="$t('PLATFORM.SECURITY.OAUTH.RESOURCES')">
          <div class="platform-card-body">
            <p class="platform-note">{{ $t("PLATFORM.SECURITY.OAUTH.RESOURCES_HINT") }}</p>
            <VcCheckbox
              v-for="resource in resources"
              :key="resource.uri"
              :model-value="selectedResources.includes(resource.uri)"
              @update:model-value="(on: boolean | boolean[]) => toggleResource(resource.uri, on === true)"
            >
              {{ resourceTitle(resource) }}
              <template v-if="resource.title || !resource.isRegistered">
                <br />
                <span class="platform-note">
                  <span
                    v-if="resource.title"
                    class="platform-mono"
                    >{{ resource.uri }}</span
                  >
                  <template v-if="!resource.isRegistered">
                    ({{ $t("PLATFORM.SECURITY.OAUTH.NOT_REGISTERED") }})</template
                  >
                </span>
              </template>
            </VcCheckbox>
            <p
              v-if="!resources.length"
              class="platform-note"
            >
              {{ $t("PLATFORM.SECURITY.OAUTH.NO_RESOURCES") }}
            </p>
            <VcMultivalue
              v-model="otherResources"
              option-label="id"
              option-value="id"
              :label="$t('PLATFORM.SECURITY.OAUTH.OTHER_RESOURCES')"
              :placeholder="$t('PLATFORM.SECURITY.OAUTH.URI_PLACEHOLDER')"
              :error-message="resourceError"
            />
            <VcBanner
              v-if="unregisteredResources.length"
              variant="warning"
            >
              {{ $t("PLATFORM.SECURITY.OAUTH.UNREGISTERED_WARNING", { resources: unregisteredResources.join(", ") }) }}
            </VcBanner>
          </div>
        </VcCard>

        <VcCard
          v-if="otherPermissions(item).length"
          :header="$t('PLATFORM.SECURITY.OAUTH.OTHER_PERMISSIONS')"
        >
          <div class="platform-card-body">
            <p class="platform-note">{{ $t("PLATFORM.SECURITY.OAUTH.OTHER_PERMISSIONS_HINT") }}</p>
            <VcMultivalue
              v-model="extraPermissions"
              option-label="id"
              option-value="id"
              :placeholder="$t('PLATFORM.SECURITY.OAUTH.PERMISSION_PLACEHOLDER')"
            />
          </div>
        </VcCard>
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
} from "@vc-shell/framework";
import {
  VcBanner,
  VcBlade,
  VcButton,
  VcCard,
  VcCheckbox,
  VcCheckboxGroup,
  VcCol,
  VcContainer,
  VcField,
  VcForm,
  VcInput,
  VcMultivalue,
  VcRow,
  VcSelect,
  VcSwitch,
} from "@vc-shell/framework/ui";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { saveResetItems, usePlatformBladeForm } from "../../composables/blade";
import {
  APPLICATION_TYPES,
  AUTHORIZATION_CODE,
  CLIENT_CREDENTIALS,
  CLIENT_TYPES,
  CONSENT_TYPES,
  GRANT_TYPES,
  SCOPES,
  findApp,
  hasGrantType,
  hasPermission,
  oauthResources,
  otherPermissions,
  requiresPkce,
  resourcesOf,
  saveApp,
  setPermission,
  setPkce,
  setResources,
  uriProblem,
  type OAuthApp,
  type OAuthResource,
} from "../../composables/oauth-apps";

defineBlade({
  url: "/oauth-app",
  name: "PlatformSecurityOAuthAppDetails",
  permissions: ["platform:security:access"],
});

// app: an application of the list, none for a new one
const { t } = useI18n({ useScope: "global" });
const { options, closeSelf, callParent } = useBlade<{ app?: OAuthApp }>();
const { hasAccess } = usePermissions();
const { showConfirmation } = usePopup();
const { getApiClient } = useApiClient(OAuthAppsClient);

const isNew = computed(() => !options.value?.app);
const item = ref<OAuthApp>({});
// the stored state, for the URIs saved before the HTTPS rule
const baseline = ref<OAuthApp>({});
// the secret of a new application, for a switch back from a public to a confidential client
const newSecret = ref<string>();
const resources = ref<OAuthResource[]>([]);
const clientIdTaken = ref<string>();

const upper = (value: string) => value.toUpperCase();
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const clientTypeOptions = computed(() =>
  CLIENT_TYPES.map((x) => ({ id: x, title: t(`PLATFORM.SECURITY.OAUTH.CLIENT_TYPES.${upper(x)}`) })),
);
const applicationTypeOptions = computed(() =>
  APPLICATION_TYPES.map((x) => ({ id: x, title: t(`PLATFORM.SECURITY.OAUTH.APPLICATION_TYPES.${upper(x)}`) })),
);
const consentTypeOptions = computed(() => {
  const values: string[] = [...CONSENT_TYPES];
  // a consent type the screen doesn't offer (external) stays selectable on the client that has it
  if (item.value.consentType && !values.includes(item.value.consentType)) values.push(item.value.consentType);
  return values.map((x) => ({ id: x, title: t(`PLATFORM.SECURITY.OAUTH.CONSENT_TYPES.${upper(x)}`) }));
});
const consentHint = computed(() =>
  t(`PLATFORM.SECURITY.OAUTH.CONSENT_TYPES.${upper(item.value.consentType || "explicit")}_HINT`),
);
const grantTypeOptions = computed(() =>
  GRANT_TYPES.map((x) => ({ value: x, label: t(`PLATFORM.SECURITY.OAUTH.GRANTS.${upper(x.slice(3))}`) })),
);
const scopeOptions = computed(() => SCOPES.map((x) => ({ value: x, label: x.slice(4) })));

const grantTypes = computed(() => GRANT_TYPES.filter((x) => hasPermission(item.value, x)));
const scopes = computed(() => SCOPES.filter((x) => hasPermission(item.value, x)));

function setChecked(all: readonly string[], checked: string[]) {
  all.forEach((x) => setPermission(item.value, x, checked.includes(x)));
}

function setClientType(type: string) {
  item.value.clientType = type;
  if (type === "public") {
    // a public client has no secret, proves the sign-in with PKCE and can't use the client credentials grant
    item.value.clientSecret = "";
    setPkce(item.value, true);
    setPermission(item.value, CLIENT_CREDENTIALS, false);
  } else {
    item.value.clientSecret = newSecret.value;
  }
}

// resources: those the platform knows (MCP endpoints, Authorization:Resources) are checkboxes, the others free text
const selectedResources = computed(() => resourcesOf(item.value));
// a resource of the client that the platform doesn't list stays in the free text
const isKnown = (uri: string) => resources.value.some((x) => x.uri === uri);
const resourceTitle = (resource: OAuthResource) =>
  resource.title
    ? resource.kind === "mcp"
      ? t("PLATFORM.SECURITY.OAUTH.MCP_ENDPOINT", { title: resource.title })
      : resource.title
    : resource.uri;

function toggleResource(uri: string, on: boolean) {
  const rest = selectedResources.value.filter((x) => x !== uri);
  setResources(item.value, on ? [...rest, uri] : rest);
}

const otherResources = computed({
  get: () => selectedResources.value.filter((x) => !isKnown(x)).map((id) => ({ id })),
  set: (chips: { id?: string }[]) =>
    setResources(item.value, [
      ...selectedResources.value.filter(isKnown),
      ...chips.map((c) => String(c.id ?? "").trim()).filter(Boolean),
    ]),
});
const registered = computed(() => new Set(resources.value.filter((x) => x.isRegistered).map((x) => x.uri)));
// with no resource list (an older platform), nothing is known to be missing
const unregisteredResources = computed(() =>
  resources.value.length ? selectedResources.value.filter((x) => !registered.value.has(x)) : [],
);
const resourceError = computed(() => {
  const bad = selectedResources.value.find((x) => !isKnown(x) && uriProblem(x) === "invalid");
  return bad ? t("PLATFORM.SECURITY.OAUTH.RESOURCE_INVALID", { uri: bad }) : undefined;
});

const asChips = (key: "redirectUris" | "postLogoutRedirectUris") =>
  computed({
    get: () => (item.value[key] ?? []).map((id) => ({ id })),
    set: (chips: { id?: string }[]) => (item.value[key] = chips.map((c) => String(c.id ?? "").trim()).filter(Boolean)),
  });
const redirectUris = asChips("redirectUris");
const postLogoutRedirectUris = asChips("postLogoutRedirectUris");

// a URI the client already had is not checked again (the server keeps it), but an HTTP one is pointed out
function uriError(uris?: string[], stored?: string[]) {
  for (const uri of uris ?? []) {
    const problem = uriProblem(uri);
    if (problem && !(problem === "http" && stored?.includes(uri))) {
      return t(`PLATFORM.SECURITY.OAUTH.URI_${upper(problem)}`, { uri });
    }
  }
  return undefined;
}
const legacyHttpUris = computed(() =>
  [...(item.value.redirectUris ?? []), ...(item.value.postLogoutRedirectUris ?? [])].filter(
    (x) => uriProblem(x) === "http",
  ),
);

const extraPermissions = computed({
  get: () => otherPermissions(item.value).map((id) => ({ id })),
  set: (chips: { id?: string }[]) => {
    const kept = new Set(chips.map((c) => String(c.id ?? "")));
    item.value.permissions = (item.value.permissions ?? []).filter(
      (x) => kept.has(x) || !otherPermissions(item.value).includes(x),
    );
  },
});

const clientIdError = computed(() => {
  if (!item.value.clientId?.trim()) return t("PLATFORM.COMMON.REQUIRED");
  if (clientIdTaken.value === item.value.clientId) return t("PLATFORM.SECURITY.OAUTH.CLIENT_ID_TAKEN");
  return undefined;
});

const valid = computed(
  () =>
    !!item.value.displayName &&
    !clientIdError.value &&
    hasGrantType(item.value) &&
    !resourceError.value &&
    !uriError(item.value.redirectUris, baseline.value.redirectUris) &&
    !uriError(item.value.postLogoutRedirectUris, baseline.value.postLogoutRedirectUris),
);

const form = usePlatformBladeForm({
  data: item,
  // POST oauthapps saves new and existing apps alike, with :update
  canSaveOverride: computed(() => valid.value && hasAccess("platform:security:oauth_applications:update")),
});

// the secret can't be shown again after the application is created: keep it in a file too
function downloadCredentials() {
  const { clientId, clientSecret } = item.value;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(
    new Blob([`client_id=${clientId}\r\nclient_secret=${clientSecret}\r\n`], { type: "text/plain" }),
  );
  link.download = `oauth-client-${clientId}.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
}

const { loading: loadLoading, action: load } = useAsync(async () => {
  resources.value = await oauthResources();

  if (isNew.value) {
    item.value = (await (await getApiClient()).new()) as OAuthApp;
    newSecret.value = item.value.clientSecret;
  } else {
    // the stored state; the row of the list on a platform without GET by client id
    const app = options.value!.app!;
    item.value = clone((await findApp(app.clientId!).catch(() => undefined)) ?? app);
  }
  baseline.value = clone(item.value);
  form.setBaseline();
});

const { loading: saveLoading, action: save } = useAsync(async () => {
  if (isNew.value && (await findApp(item.value.clientId!).catch(() => undefined))) {
    // POST oauthapps updates the application with the client id: don't overwrite another one
    clientIdTaken.value = item.value.clientId;
    return;
  }
  try {
    await saveApp(item.value);
  } catch (error) {
    notification.error((error as Error).message);
    return;
  }
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
