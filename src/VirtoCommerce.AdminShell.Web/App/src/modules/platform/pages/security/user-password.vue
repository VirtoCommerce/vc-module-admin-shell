<template>
  <VcBlade
    :title="$t('SHELL.ACCOUNT.CHANGE_PASSWORD')"
    :subtitle="param"
    :toolbar-items="toolbar"
    :loading="loading"
    width="40%"
  >
    <VcContainer>
      <VcForm class="platform-form">
        <VcInput
          v-model="newPassword"
          type="password"
          autocomplete="new-password"
          :label="$t('PLATFORM.SECURITY.USER.NEW_PASSWORD')"
          required
          :error-message="errors"
          @update:model-value="check"
        />
        <VcSwitch
          v-model="forceChange"
          :label="$t('PLATFORM.SECURITY.USER.FORCE_CHANGE')"
        />
      </VcForm>
    </VcContainer>
  </VcBlade>
</template>

<script setup lang="ts">
import { SecurityClient, notification, useApiClient, useAsync, useBlade, type IBladeToolbar } from "@vc-shell/framework";
import { VcBlade, VcContainer, VcForm, VcInput, VcSwitch } from "@vc-shell/framework/ui";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ensureSucceeded, usePasswordCheck } from "../../composables/security";

defineBlade({
  url: "/password",
  name: "PlatformSecurityUserPassword",
  permissions: ["platform:security:update"],
});

const { t } = useI18n({ useScope: "global" });
const { param, closeSelf, callParent } = useBlade();
const { getApiClient } = useApiClient(SecurityClient);

const newPassword = ref("");
const forceChange = ref(true);
const { errors, check } = usePasswordCheck(() => param.value, newPassword);

const { loading, action: reset } = useAsync(async () => {
  ensureSucceeded(
    await (
      await getApiClient()
    ).resetPassword(param.value!, { newPassword: newPassword.value, forcePasswordChangeOnNextSignIn: forceChange.value }),
  );
  notification.success(t("PLATFORM.SECURITY.USER.PASSWORD_CHANGED_OK"));
  await callParent("reload");
  await closeSelf();
});

const toolbar = ref<IBladeToolbar[]>([
  {
    id: "ok",
    title: t("PLATFORM.COMMON.SAVE"),
    icon: "lucide-save",
    disabled: computed(() => !newPassword.value || !!errors.value),
    clickHandler: () => reset(),
  },
]);
</script>
