<template>
  <VcBlade
    :title="$t('PLATFORM.SIGN_IN_METHODS.SET_PASSWORD')"
    :toolbar-items="toolbar"
    :loading="loading"
    width="40%"
  >
    <VcContainer>
      <VcForm
        class="platform-form"
        @submit.prevent="save()"
      >
        <p class="platform-note">{{ $t("PLATFORM.SIGN_IN_METHODS.SET_PASSWORD_HINT") }}</p>
        <!-- the user name, for the browser's password manager -->
        <input
          type="text"
          name="username"
          autocomplete="username"
          :value="user?.userName"
          hidden
          readonly
        />
        <VcInput
          v-model="newPassword"
          type="password"
          autocomplete="new-password"
          :label="$t('PLATFORM.SECURITY.USER.NEW_PASSWORD')"
          required
          :error-message="errors"
          @update:model-value="check"
        />
        <VcInput
          v-model="repeat"
          type="password"
          autocomplete="new-password"
          :label="$t('PLATFORM.SECURITY.USER.PASSWORD_REPEAT')"
          required
          :error-message="mismatch"
        />
      </VcForm>
    </VcContainer>
  </VcBlade>
</template>

<script setup lang="ts">
// A password for an account that has none (it signs in with a passkey or an external provider): the platform adds it
// through the current user's change password without the old one (vc-platform#3144), as the AngularJS profile does
import { notification, useAsync, useBlade, useUser, type IBladeToolbar } from "@vc-shell/framework";
import { VcBlade, VcContainer, VcForm, VcInput } from "@vc-shell/framework/ui";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ensureSucceeded, usePasswordCheck } from "../../composables/security";

defineBlade({
  url: "/set-password",
  name: "PlatformUserSetPassword",
});

const { t } = useI18n({ useScope: "global" });
const { closeSelf, callParent } = useBlade();
const { user } = useUser();

const newPassword = ref("");
const repeat = ref("");
const { errors, check } = usePasswordCheck(() => user.value?.userName, newPassword);
const mismatch = computed(() =>
  repeat.value && repeat.value !== newPassword.value ? t("PLATFORM.SECURITY.USER.PASSWORD_MISMATCH") : undefined,
);
const canSave = computed(() => !!newPassword.value && repeat.value === newPassword.value && !errors.value);

const { loading, action: save } = useAsync(async () => {
  if (!canSave.value) return;
  // a refused password comes back as 400 with the identity errors (the policy, an account that already has one)
  const response = await fetch("/api/platform/security/currentuser/changepassword", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ newPassword: newPassword.value }),
  });
  const result = (await response.json().catch(() => ({}))) as { succeeded?: boolean; errors?: string[] };
  // a refusal without identity errors (403 while impersonating, a server error) still says what happened
  if (!response.ok && !result.errors?.length) throw new Error(`${response.status} ${response.statusText}`);
  ensureSucceeded({ ...result, succeeded: response.ok && result.succeeded !== false });
  notification.success(t("PLATFORM.SIGN_IN_METHODS.PASSWORD_SET_OK"));
  await callParent("reload");
  await closeSelf();
});

const toolbar = ref<IBladeToolbar[]>([
  {
    id: "save",
    title: t("PLATFORM.COMMON.SAVE"),
    icon: "lucide-save",
    disabled: computed(() => !canSave.value),
    clickHandler: () => save(),
  },
]);
</script>
