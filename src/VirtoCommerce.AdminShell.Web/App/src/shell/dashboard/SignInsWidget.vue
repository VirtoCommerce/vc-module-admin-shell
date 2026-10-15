<!-- Sign-in activity: the last 7 days against the 7 before (POST api/platform/security/sign-in-log/stats),
     drawn with the Total Sales metric rows -->
<template>
  <DashboardWidgetCard
    :header="$t('SHELL.DASHBOARD.SIGN_INS.TITLE')"
    icon="lucide-shield-check"
    :loading="loading"
  >
    <template #content>
      <div
        v-if="stats && !stats.recordingEnabled"
        class="dash-empty"
      >
        <VcIcon
          icon="lucide-shield-off"
          size="xl"
        />
        {{ $t("SHELL.DASHBOARD.SIGN_INS.DISABLED") }}
      </div>
      <div
        v-else
        class="dash-metrics"
      >
        <div
          v-for="metric in metrics"
          :key="metric.key"
          class="dash-metric"
        >
          <span
            class="dash-metric__icon"
            :class="`dash-metric__icon--${metric.tint}`"
          >
            <VcIcon :icon="metric.icon" />
          </span>
          <div class="dash-metric__body">
            <div class="dash-metric__label">{{ $t(`SHELL.DASHBOARD.SIGN_INS.${metric.key}`) }}</div>
            <div class="dash-metric__line">
              <span class="dash-metric__value">{{ metric.value }}</span>
              <span
                v-if="metric.change"
                class="dash-delta"
                :class="{ 'dash-delta--down': metric.bad }"
              >
                {{ formatCount(metric.change, true) }}
                <VcIcon :icon="metric.change < 0 ? 'lucide-trending-down' : 'lucide-trending-up'" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </DashboardWidgetCard>
</template>

<script lang="ts" setup>
import { DashboardWidgetCard, useAsync } from "@vc-shell/framework";
import { VcIcon } from "@vc-shell/framework/ui";
import { computed, onMounted, ref } from "vue";
import { signInLogApi, type SignInLogStats } from "../../modules/platform/composables/security";
import { criteriaDate, daysAgo } from "./api";

const stats = ref<SignInLogStats>();

// the app's error handler shows a failure
const { loading, action: load } = useAsync(
  async () => {
    stats.value = await signInLogApi.stats({ startDate: criteriaDate(daysAgo(7)) });
  },
  { notify: false },
);
onMounted(load);

const formatCount = (value: number, signed = false) =>
  new Intl.NumberFormat(undefined, { signDisplay: signed ? "exceptZero" : "auto" }).format(value);

// more failures is the bad direction, so it turns red when it goes up; no earlier period to compare (null) shows no
// change, as the sign-in log does
const metrics = computed(() => {
  const s = stats.value;
  const row = (key: string, icon: string, tint: string, now = 0, before?: number | null, upIsBad = false) => ({
    key,
    icon,
    tint,
    value: formatCount(now),
    change: before == null ? 0 : now - before,
    bad: before != null && (upIsBad ? now > before : now < before),
  });
  return [
    row("TOTAL", "lucide-log-in", "blue", s?.totalCount, s?.previousTotalCount),
    row("FAILED", "lucide-shield-alert", "amber", s?.failedCount, s?.previousFailedCount, true),
    row("USERS", "lucide-users", "green", s?.distinctUserCount, s?.previousDistinctUserCount),
  ];
});
</script>
