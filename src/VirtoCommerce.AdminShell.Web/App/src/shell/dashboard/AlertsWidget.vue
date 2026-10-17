<!-- Alerts and Notifications (Dashboard.jsx AlertsWidget): the user's unread platform notifications
     (job results, exports, system messages), live over SignalR; dismissing one marks it read -->
<template>
  <DashboardWidgetCard
    :header="$t('SHELL.DASHBOARD.ALERTS.TITLE')"
    icon="lucide-bell"
  >
    <template #content>
      <div
        v-if="alerts.length"
        class="dash-alerts"
      >
        <div
          v-for="alert in alerts"
          :key="alert.id"
          class="dash-alert"
          :class="`dash-alert--${kindOf(alert)}`"
        >
          <div class="dash-alert__body">
            <div class="dash-alert__title">{{ alert.title || alert.notifyType }}</div>
            <div
              v-if="alert.description"
              class="dash-alert__text"
            >
              {{ alert.description }}
            </div>
            <div class="dash-alert__date">{{ formatWhen(alert.created) }}</div>
          </div>
          <button
            type="button"
            class="dash-dismiss"
            :title="$t('SHELL.DASHBOARD.DISMISS')"
            :aria-label="$t('SHELL.DASHBOARD.DISMISS')"
            @click="dismiss(alert)"
          >
            <VcIcon
              icon="lucide-x"
              size="s"
            />
          </button>
        </div>
      </div>
      <div
        v-else
        class="dash-empty"
      >
        <VcIcon
          icon="lucide-bell-ring"
          size="xl"
        />
        <strong>{{ $t("SHELL.DASHBOARD.ALERTS.EMPTY") }}</strong>
        <span>{{ $t("SHELL.DASHBOARD.ALERTS.EMPTY_HINT") }}</span>
      </div>
    </template>
  </DashboardWidgetCard>
</template>

<script lang="ts" setup>
import { DashboardWidgetCard, useNotificationStore } from "@vc-shell/framework";
import { VcIcon } from "@vc-shell/framework/ui";
import { computed, onMounted } from "vue";
import { formatWhen } from "./api";

interface Alert {
  id?: string;
  title?: string;
  description?: string;
  notifyType?: string;
  created?: string | Date;
  isNew?: boolean;
  finished?: string | Date;
  errorCount?: number;
  errors?: unknown[];
}

const store = useNotificationStore();

onMounted(() => {
  if (!store.history.value.length) store.loadHistory();
});

const alerts = computed(() =>
  (store.history.value as Alert[])
    .filter((x) => x.isNew)
    .sort((a, b) => new Date(b.created ?? 0).getTime() - new Date(a.created ?? 0).getTime())
    .slice(0, 3),
);

const dismiss = (alert: Alert) => store.markAsRead(alert as Parameters<typeof store.markAsRead>[0]);

// job-style notifications carry errors / a finish time; everything else is informational
function kindOf(alert: Alert): "danger" | "success" | "info" {
  if (alert.errorCount || alert.errors?.length || /error|fail/i.test(`${alert.notifyType} ${alert.title}`)) return "danger";
  return alert.finished ? "success" : "info";
}
</script>
