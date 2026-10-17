<template>
  <VcBlade
    :title="notification?.title || $t('PLATFORM.MODULES.PROGRESS.TITLE')"
    :subtitle="notification?.description"
    :toolbar-items="toolbar"
    width="50%"
  >
    <VcContainer>
      <VcForm class="platform-form">
        <VcBanner
          v-if="finished"
          :variant="errors ? 'danger' : 'success'"
        >
          {{ errors ? $t("PLATFORM.MODULES.PROGRESS.FAILED", { count: errors }) : $t("PLATFORM.MODULES.PROGRESS.DONE") }}
        </VcBanner>
        <VcProgress
          v-else
          :value="percent"
        />
        <ol class="platform-log">
          <li
            v-for="(entry, i) in notification?.progressLog ?? []"
            :key="i"
            :class="`platform-log__${String(entry.level).toLowerCase()}`"
          >
            {{ entry.message }}
          </li>
        </ol>
      </VcForm>
    </VcContainer>
  </VcBlade>
</template>

<script setup lang="ts">
// Progress of a module install/update/uninstall job (legacy module-wizard-progress-step). ponytail: polls the push
// notification store every 2 s instead of subscribing to SignalR; switch to the framework's notifications hub if it lags.
import {
  ModulesClient,
  PushNotificationClient,
  useApiClient,
  useBlade,
  usePopup,
  type IBladeToolbar,
  type ModulePushNotification,
} from "@vc-shell/framework";
import { VcBanner, VcBlade, VcContainer, VcForm, VcProgress } from "@vc-shell/framework/ui";
import { computed, onBeforeUnmount, ref } from "vue";
import { useI18n } from "vue-i18n";

defineBlade({
  url: "/module-progress",
  name: "PlatformModulesProgress",
  permissions: ["platform:module:manage"],
});

const { t } = useI18n({ useScope: "global" });
const { param, options, callParent } = useBlade<{ notification?: ModulePushNotification }>();
const { showConfirmation } = usePopup();
const { getApiClient: pushClient } = useApiClient(PushNotificationClient);
const { getApiClient: modulesClient } = useApiClient(ModulesClient);

const notification = ref<ModulePushNotification | undefined>(options.value?.notification);
const finished = computed(() => !!notification.value?.finished);
const errors = computed(() => (notification.value?.progressLog ?? []).filter((x) => String(x.level) === "Error").length);
const percent = computed(() => {
  const total = notification.value?.totalCount || 0;
  const done = (notification.value?.progressLog ?? []).filter((x) => /successfully/i.test(x.message ?? "")).length;
  return total ? Math.min(100, Math.round((done / total) * 100)) : 0;
});

const timer = setInterval(async () => {
  if (finished.value) {
    clearInterval(timer);
    callParent("reload");
    return;
  }
  const result = await (await pushClient()).searchPushNotification({ ids: [param.value!], take: 1 });
  const latest = result.notifyEvents?.[0] as ModulePushNotification | undefined;
  if (latest) notification.value = latest;
}, 2000);
onBeforeUnmount(() => clearInterval(timer));

const toolbar = ref<IBladeToolbar[]>([
  {
    id: "restart",
    title: t("PLATFORM.MODULES.PROGRESS.RESTART"),
    icon: "lucide-power",
    permissions: ["platform:module:manage"],
    disabled: computed(() => !finished.value),
    async clickHandler() {
      if (await showConfirmation(t("PLATFORM.MODULES.PROGRESS.RESTART_CONFIRM"))) {
        await (await modulesClient()).restart();
      }
    },
  },
]);
</script>

<style lang="scss">
.platform-log {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  &__error {
    color: var(--color-danger-500);
  }
  &__warning {
    color: var(--color-warning-700);
  }
}
</style>
