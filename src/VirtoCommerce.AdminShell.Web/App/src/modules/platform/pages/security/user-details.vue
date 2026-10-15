<template>
  <VcBlade
    :title="title"
    :subtitle="isNew ? $t('PLATFORM.SECURITY.USER.NEW_SUBTITLE') : item.userType"
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
              v-model="item.userName"
              :label="$t('PLATFORM.SECURITY.USERS.USER_NAME')"
              required
              :error-message="item.userName ? undefined : $t('PLATFORM.COMMON.REQUIRED')"
            />
          </VcCol>
          <VcCol>
            <VcInput
              v-model="item.email"
              type="email"
              :label="$t('PLATFORM.SECURITY.USERS.EMAIL')"
            />
          </VcCol>
        </VcRow>
        <VcRow class="tw-gap-4">
          <VcCol>
            <VcSelect
              v-model="item.userType"
              :label="$t('PLATFORM.SECURITY.USERS.ACCOUNT_TYPE')"
              :options="lookups.accountTypes.value"
              :clearable="false"
            />
          </VcCol>
          <VcCol>
            <VcSelect
              v-model="item.status"
              :label="$t('PLATFORM.SECURITY.USERS.STATUS')"
              :options="lookups.accountStatuses.value"
            />
          </VcCol>
        </VcRow>
        <VcSelect
          v-model="roleIds"
          :label="$t('PLATFORM.SECURITY.USER.ROLES')"
          :options="lookups.roles.value"
          option-value="id"
          option-label="name"
          multiple
          searchable
        />
        <VcRow class="tw-gap-4">
          <VcCol>
            <VcSwitch
              v-model="item.isAdministrator"
              :label="$t('PLATFORM.SECURITY.USER.ADMINISTRATOR')"
            />
          </VcCol>
          <VcCol v-if="!isNew">
            <VcSwitch
              v-model="item.emailConfirmed"
              :label="$t('PLATFORM.SECURITY.USER.EMAIL_CONFIRMED')"
              :disabled="!hasAccess('platform:security:verifyEmail')"
            />
          </VcCol>
        </VcRow>

        <template v-if="isNew">
          <VcRow class="tw-gap-4">
            <VcCol>
              <VcInput
                v-model="password"
                type="password"
                autocomplete="new-password"
                :label="$t('PLATFORM.SECURITY.USER.PASSWORD')"
                :error-message="passwordErrors"
                @update:model-value="checkPassword"
              />
            </VcCol>
            <VcCol>
              <VcInput
                v-model="passwordRepeat"
                type="password"
                autocomplete="new-password"
                :label="$t('PLATFORM.SECURITY.USER.PASSWORD_REPEAT')"
                :error-message="passwordRepeat && passwordRepeat !== password ? $t('PLATFORM.SECURITY.USER.PASSWORD_MISMATCH') : undefined"
              />
            </VcCol>
          </VcRow>
        </template>

        <VcCard
          v-else
          :header="$t('PLATFORM.SECURITY.USER.ACCOUNT_INFO')"
        >
          <div class="platform-card-body">
            <VcRow class="tw-gap-4">
              <VcCol>
                <VcField
                  :label="$t('PLATFORM.SECURITY.USER.STATE')"
                  :model-value="locked ? $t('PLATFORM.SECURITY.USERS.LOCKED') : $t('PLATFORM.SECURITY.USER.ACTIVE')"
                />
              </VcCol>
              <VcCol>
                <VcField
                  :label="$t('PLATFORM.SECURITY.USERS.LAST_LOGIN')"
                  :model-value="realDate(item.lastLoginDate)"
                  type="date-ago"
                />
              </VcCol>
              <VcCol>
                <VcField
                  :label="$t('PLATFORM.SECURITY.USER.CREATED')"
                  :model-value="realDate(item.createdDate)"
                  type="date"
                />
              </VcCol>
            </VcRow>
            <VcRow class="tw-gap-4">
              <VcCol>
                <VcField
                  :label="$t('PLATFORM.SECURITY.USER.PASSWORD_CHANGED')"
                  :model-value="realDate(item.lastPasswordChangedDate)"
                  type="date-ago"
                />
              </VcCol>
              <VcCol>
                <VcField
                  :label="$t('PLATFORM.SECURITY.USER.PASSWORD_EXPIRED')"
                  :model-value="item.passwordExpired ? $t('PLATFORM.COMMON.YES') : $t('PLATFORM.COMMON.NO')"
                />
              </VcCol>
              <VcCol>
                <VcField
                  :label="$t('PLATFORM.SECURITY.USER.ID')"
                  :model-value="item.id"
                  copyable
                />
              </VcCol>
            </VcRow>
          </div>
        </VcCard>

        <VcCard
          v-if="!isNew"
          :header="$t('PLATFORM.SECURITY.USER.EXTERNAL_LOGINS')"
        >
          <div class="platform-card-body">
            <VcField
              v-for="login in item.logins ?? []"
              :key="`${login.loginProvider}:${login.providerKey}`"
              :label="login.loginProvider"
              :model-value="login.providerKey"
              copyable
            />
            <span
              v-if="!item.logins?.length"
              class="platform-note"
            >
              {{ $t("PLATFORM.SECURITY.USER.NO_EXTERNAL_LOGINS") }}
            </span>
          </div>
        </VcCard>
      </VcForm>
    </VcContainer>
  </VcBlade>
</template>

<script setup lang="ts">
import {
  SecurityClient,
  defineBladeContext,
  notification,
  useApiClient,
  useAsync,
  useBlade,
  useBladeForm,
  useBladeWidgets,
  useLoading,
  usePermissions,
  usePopup,
  type ApplicationUser,
  type IBladeToolbar,
} from "@vc-shell/framework";
import {
  VcBlade,
  VcCard,
  VcCol,
  VcContainer,
  VcField,
  VcForm,
  VcInput,
  VcRow,
  VcSelect,
  VcSwitch,
} from "@vc-shell/framework/ui";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ensureSucceeded, usePasswordCheck, useSecurityLookups } from "../../composables/security";

defineBlade({
  url: "/user",
  name: "PlatformSecurityUserDetails",
  permissions: ["platform:security:access"],
});

const { t } = useI18n({ useScope: "global" });
const { param, openBlade, closeSelf, replaceWith, callParent, exposeToChildren } = useBlade();
const { hasAccess } = usePermissions();
const { showConfirmation } = usePopup();
const { getApiClient } = useApiClient(SecurityClient);
const lookups = useSecurityLookups();

const isNew = computed(() => !param.value);
const item = ref<ApplicationUser>({ roles: [] });
const locked = ref(false);
const passwordChangeEnabled = ref(false);
const passwordLogin = ref(true);
const apiKeyCount = ref(0);
const sessionCount = ref(0);
const password = ref("");
const passwordRepeat = ref("");
const { errors: passwordErrors, check: checkPassword } = usePasswordCheck(() => item.value.userName, password);

const title = computed(() => (isNew.value ? t("PLATFORM.SECURITY.USER.NEW_TITLE") : item.value.userName ?? ""));
// seeded accounts carry DateTime.MinValue
const realDate = (date?: Date) => (date && new Date(date).getFullYear() > 1900 ? date : undefined);

// roles are edited as a multi-select (legacy: separate assign/remove blade, saved with the user)
const roleIds = computed({
  get: () => (item.value.roles ?? []).map((r) => r.id!),
  set: (ids: string[]) => {
    item.value.roles = ids.map((id) => item.value.roles?.find((r) => r.id === id) ?? lookups.roles.value.find((r) => r.id === id)!);
  },
});

const valid = computed(
  () => !!item.value.userName && (!isNew.value || ((!password.value || !passwordErrors.value) && password.value === passwordRepeat.value)),
);

const form = useBladeForm({
  data: item,
  canSaveOverride: computed(() => valid.value && hasAccess(isNew.value ? "platform:security:create" : "platform:security:update")),
  closeConfirmMessage: computed(() => t("PLATFORM.COMMON.CLOSE_CONFIRMATION")),
});

const { loading: loadLoading, action: load } = useAsync(async () => {
  const client = await getApiClient();
  await lookups.load();
  if (isNew.value) {
    item.value = { roles: [], userType: lookups.defaultAccountType.value ?? "Manager", status: lookups.defaultAccountStatus.value };
    form.setBaseline();
    return;
  }
  const user = await client.getUserById(param.value!);
  const [changeEnabled, loginTypes] = await Promise.all([
    client.passwordChangeEnabled(),
    client.getLoginTypes(),
    refreshAccount(user.id!),
  ]);
  item.value = user;
  // typed as UserLockedResult but the endpoint returns { enabled }
  passwordChangeEnabled.value = !!(changeEnabled as { enabled?: boolean }).enabled;
  passwordLogin.value = (loginTypes ?? []).some((x) => x.authenticationType === "Password" && x.enabled);
  form.setBaseline();
});

// the lock state and the widget counts: what the toolbar actions and the child blades change besides the user itself
async function refreshAccount(userId = item.value.id!) {
  const client = await getApiClient();
  const [lockState, keys, sessions] = await Promise.all([
    client.isUserLocked(userId),
    client.getUserApiKeys(userId),
    client.searchUserSessions(userId, { userId, take: 0 }),
  ]);
  locked.value = !!lockState.locked;
  apiKeyCount.value = keys?.length ?? 0;
  sessionCount.value = sessions.totalCount ?? 0;
}

// unsaved edits here survive an action or a child blade's change (API keys, sessions, password): only its result is re-read
const reload = () => (form.isModified.value ? refreshAccount() : load());

const { loading: saveLoading, action: save } = useAsync(async () => {
  const client = await getApiClient();
  if (isNew.value) {
    ensureSucceeded(await client.create({ ...item.value, password: password.value || undefined }));
    const created = await client.getUserByName(item.value.userName!);
    notification.success(t("PLATFORM.COMMON.SAVED"));
    form.setBaseline();
    await callParent("reload");
    await replaceWith({ name: "PlatformSecurityUserDetails", param: created.id });
    return;
  }
  ensureSucceeded(await client.update(item.value));
  notification.success(t("PLATFORM.COMMON.SAVED"));
  await load();
});

const { loading: actionLoading, action: run } = useAsync<() => Promise<unknown>>(async (fn) => {
  await fn!();
  await reload();
});

const loading = useLoading(loadLoading, saveLoading, actionLoading);

const toolbar = computed<IBladeToolbar[]>(() =>
  isNew.value
    ? [
        {
          id: "create",
          title: t("PLATFORM.COMMON.CREATE"),
          icon: "lucide-save",
          disabled: computed(() => !form.canSave.value),
          clickHandler: () => save(),
        },
      ]
    : [
        { id: "save", title: t("PLATFORM.COMMON.SAVE"), icon: "lucide-save", disabled: computed(() => !form.canSave.value), clickHandler: () => save() },
        {
          id: "reset",
          title: t("PLATFORM.COMMON.RESET"),
          icon: "lucide-undo-2",
          disabled: computed(() => !form.isModified.value),
          clickHandler: () => load(),
        },
        {
          id: "password",
          title: t("SHELL.ACCOUNT.CHANGE_PASSWORD"),
          icon: "lucide-key-round",
          permissions: ["platform:security:update"],
          isVisible: computed(() => passwordChangeEnabled.value && passwordLogin.value),
          clickHandler: () => openBlade({ name: "PlatformSecurityUserPassword", param: item.value.userName }),
        },
        {
          id: "lock",
          title: t("PLATFORM.SECURITY.USER.LOCK"),
          icon: "lucide-lock",
          permissions: ["platform:security:update"],
          isVisible: computed(() => !locked.value),
          async clickHandler() {
            if (await showConfirmation(t("PLATFORM.SECURITY.USER.LOCK_CONFIRM", { name: item.value.userName }))) {
              await run(async () => ensureSucceeded(await (await getApiClient()).lockUser(item.value.id!)));
            }
          },
        },
        {
          id: "unlock",
          title: t("PLATFORM.SECURITY.USER.UNLOCK"),
          icon: "lucide-lock-open",
          permissions: ["platform:security:update"],
          isVisible: computed(() => locked.value),
          clickHandler: () => run(async () => ensureSucceeded(await (await getApiClient()).unlockUser(item.value.id!))),
        },
        {
          id: "verify",
          title: t("PLATFORM.SECURITY.USER.SEND_VERIFICATION"),
          icon: "lucide-mail-check",
          permissions: ["platform:security:verifyEmail"],
          isVisible: computed(() => !!item.value.email && !item.value.emailConfirmed),
          disabled: computed(() => form.isModified.value),
          clickHandler: () =>
            run(async () => {
              await (await getApiClient()).sendVerificationEmail(item.value.id!);
              notification.success(t("PLATFORM.SECURITY.USER.VERIFICATION_SENT"));
            }),
        },
        {
          id: "delete",
          title: t("PLATFORM.COMMON.DELETE"),
          icon: "lucide-trash-2",
          permissions: ["platform:security:delete"],
          async clickHandler() {
            if (await showConfirmation(t("PLATFORM.SECURITY.USERS.DELETE_CONFIRM", { count: 1 }))) {
              await (await getApiClient()).delete([item.value.userName!]);
              form.setBaseline();
              await callParent("reload");
              await closeSelf();
            }
          },
        },
      ],
);

useBladeWidgets([
  {
    id: "PlatformUserApiKeys",
    icon: "lucide-key",
    title: "PLATFORM.SECURITY.APIKEYS.TITLE",
    badge: computed(() => apiKeyCount.value),
    isVisible: computed(() => !isNew.value),
    onClick: () => openBlade({ name: "PlatformSecurityUserApiKeys", param: item.value.id, options: { userName: item.value.userName } }),
  },
  {
    id: "PlatformUserSessions",
    icon: "lucide-monitor-smartphone",
    title: "PLATFORM.SECURITY.SESSIONS.TITLE",
    badge: computed(() => sessionCount.value),
    isVisible: computed(() => !isNew.value),
    onClick: () => openBlade({ name: "PlatformSecurityUserSessions", param: item.value.id }),
  },
  {
    id: "PlatformUserChanges",
    icon: "lucide-history",
    title: "PLATFORM.SECURITY.CHANGES.TITLE",
    isVisible: computed(() => !isNew.value),
    onClick: () => openBlade({ name: "PlatformSecurityUserChanges", param: item.value.id, options: { userName: item.value.userName } }),
  },
  {
    id: "PlatformUserSignInLog",
    icon: "lucide-log-in",
    title: "PLATFORM.SECURITY.SIGNIN.TITLE",
    isVisible: computed(() => !isNew.value && hasAccess("platform:security:sign_in_log:read")),
    onClick: () => openBlade({ name: "PlatformSecuritySignInLog", options: { userId: item.value.id, userName: item.value.userName } }),
  },
]);

// the user, for widgets other modules add to this blade (e.g. Customer's linked contact; targetBlades: ["PlatformSecurityUserDetails"])
defineBladeContext({ item });

onMounted(() => load());

exposeToChildren({ reload });
</script>

