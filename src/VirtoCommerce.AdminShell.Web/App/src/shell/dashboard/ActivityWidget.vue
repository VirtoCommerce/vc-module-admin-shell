<!-- Recent activity, in the design's "Announcements and news" slot (Dashboard.jsx AnnouncementsWidget):
     the platform has no news feed, but its change log says what changed, who changed it and when -->
<template>
  <DashboardWidgetCard
    :header="$t('SHELL.DASHBOARD.ACTIVITY.TITLE')"
    icon="lucide-history"
    :loading="loading"
  >
    <template #content>
      <div
        v-if="entries.length"
        class="dash-feed"
      >
        <div
          v-for="entry in entries"
          :key="entry.id"
          class="dash-feed__item"
        >
          <span
            class="dash-feed__dot"
            :class="`dash-feed__dot--${(entry.operationType ?? '').toLowerCase()}`"
          />
          <div class="dash-feed__body">
            <div class="dash-feed__title">{{ titleOf(entry) }}</div>
            <div
              v-if="entry.detail"
              class="dash-feed__text"
            >
              {{ entry.detail }}
            </div>
            <div class="dash-feed__meta">{{ words(entry.modifiedBy ?? entry.createdBy) }} · {{ formatWhen(entry.modifiedDate) }}</div>
          </div>
        </div>
      </div>
      <div
        v-else-if="!loading"
        class="dash-empty"
      >
        <VcIcon
          icon="lucide-history"
          size="xl"
        />
        {{ $t("SHELL.DASHBOARD.ACTIVITY.EMPTY") }}
      </div>
    </template>
  </DashboardWidgetCard>
</template>

<script lang="ts" setup>
import { ChangeLogClient, DashboardWidgetCard, useApiClient, useAsync, type OperationLog } from "@vc-shell/framework";
import { VcIcon } from "@vc-shell/framework/ui";
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { formatWhen } from "./api";

const { t } = useI18n({ useScope: "global" });
const { getApiClient } = useApiClient(ChangeLogClient);
const entries = ref<OperationLog[]>([]);

// the app's error handler shows a failure
const { loading, action: load } = useAsync(
  async () => {
    const result = await (await getApiClient()).searchChangesV2({ sort: "modifiedDate:desc", take: 4 });
    entries.value = result.results ?? [];
  },
  { notify: false },
);
onMounted(load);

// "system:ProcessSubscriptionOrdersJob" -> "Process subscription orders job", "CustomerOrder" -> "Customer order"
function words(value?: string) {
  const name = (value ?? "").replace(/^[a-z]+:/i, "");
  const spaced = name.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const titleOf = (entry: OperationLog) => {
  const key = `SHELL.DASHBOARD.ACTIVITY.${(entry.operationType ?? "Modified").toUpperCase()}`;
  return `${words(entry.objectType)} ${t(key)}`;
};
</script>
