<template>
  <VcBlade
    :title="$t('PLATFORM.MODULES.TITLE')"
    :toolbar-items="toolbar"
    :loading="loading"
    width="50%"
  >
    <VcDataTable
      v-model:search-value="keyword"
      v-model:selection="selection"
      selection-mode="multiple"
      :items="visible"
      :total-count="visible.length"
      :searchable="true"
      :state-key="'PLATFORM_MODULES'"
      :active-item-id="activeId"
      :show-all-columns="!activeId"
      :global-filters="globalFilters"
      :empty-state="{ icon: 'lucide-blocks', title: $t('PLATFORM.MODULES.EMPTY') }"
      @row-click="(e: { data: ModuleRow }) => openModule(e.data)"
      @filter="onFilter"
    >
      <VcColumn
        id="iconUrl"
        :title="''"
        width="64px"
      >
        <template #body="{ data }">
          <img
            class="platform-module-icon"
            :src="iconSrc(data.iconUrl) ?? fallbackIcon"
            alt=""
          />
        </template>
      </VcColumn>
      <VcColumn
        id="title"
        :title="$t('PLATFORM.MODULES.MODULE')"
        always-visible
      >
        <template #body="{ data }">
          <div class="platform-module-cell">
            <span class="platform-module-cell__title">{{ data.title || data.id }}</span>
            <span class="platform-module-cell__descr">{{ data.hasErrors ? data.validationErrors.join(" ") : data.description }}</span>
          </div>
        </template>
      </VcColumn>
      <VcColumn
        id="version"
        :title="$t('PLATFORM.MODULES.VERSION')"
        width="120px"
      />
      <VcColumn
        id="status"
        :title="$t('PLATFORM.MODULES.STATUS')"
        width="170px"
      >
        <template #body="{ data }">
          <div class="tw-inline-flex">
            <VcStatus :variant="statusOf(data).variant">{{ statusOf(data).text }}</VcStatus>
          </div>
        </template>
      </VcColumn>
    </VcDataTable>
  </VcBlade>
</template>

<script setup lang="ts">
import { useAsync, useBlade, type IBladeToolbar } from "@vc-shell/framework";
import { VcBlade, VcColumn, VcDataTable, VcStatus } from "@vc-shell/framework/ui";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { iconSrc, useModules, type ModuleAction, type ModuleRow } from "../../composables/modules";

defineBlade({
  url: "/modules",
  name: "PlatformModules",
  isWorkspace: true,
  permissions: ["platform:module:access"],
});

const fallbackIcon = "/images/module-logo.svg";
const { t } = useI18n({ useScope: "global" });
const { openBlade, exposeToChildren } = useBlade();
const modules = useModules();

const keyword = ref("");
const status = ref<string>("installed");
const group = ref<string>();
const selection = ref<ModuleRow[]>([]);
const activeId = ref<string>();

const { loading, action: load } = useAsync<boolean | undefined>(async (rescan) => {
  await modules.load(!!rescan);
  selection.value = [];
});
load();

// legacy tree nodes: Browse (all), Installed, Not installed, Updates, With errors
function inStatus(m: ModuleRow, s: string) {
  switch (s) {
    case "installed":
      return !!m.isInstalled;
    case "notInstalled":
      return !m.isInstalled;
    case "updates":
      return !!m.isInstalled && m.hasUpdate;
    case "errors":
      return m.hasErrors;
    default:
      return true;
  }
}
const count = (s: string) => modules.rows.value.filter((m) => inStatus(m, s)).length;

const visible = computed(() => {
  const text = keyword.value.trim().toLowerCase();
  return modules.rows.value.filter(
    (m) =>
      inStatus(m, status.value) &&
      (!group.value || (m.groups?.length ? m.groups.includes(group.value) : group.value === "ungrouped")) &&
      (!text || [m.title, m.id, m.description].some((x) => x?.toLowerCase().includes(text))),
  );
});

const globalFilters = computed(() => [
  {
    id: "status",
    label: t("PLATFORM.MODULES.STATUS"),
    filter: {
      options: ["installed", "all", "notInstalled", "updates", "errors"].map((s) => {
        const key = `PLATFORM.MODULES.FILTERS.${s.toUpperCase()}`;
        return { value: s, label: `${t(key)} (${count(s)})` };
      }),
    },
  },
  {
    id: "group",
    label: t("PLATFORM.MODULES.GROUP"),
    filter: {
      options: [...new Set(modules.rows.value.flatMap((m) => (m.groups?.length ? m.groups : ["ungrouped"])))]
        .sort()
        .map((g) => ({ value: g, label: g })),
    },
  },
]);

function onFilter(event: { filters: Record<string, unknown> }) {
  status.value = (event.filters.status as string) || "installed";
  group.value = (event.filters.group as string) || undefined;
  selection.value = [];
}

function statusOf(m: ModuleRow): { variant: "success" | "warning" | "danger" | "info"; text: string } {
  if (m.hasErrors) return { variant: "danger", text: t("PLATFORM.MODULES.FILTERS.ERRORS") };
  if (m.isInstalled && m.hasUpdate) return { variant: "warning", text: t("PLATFORM.MODULES.UPDATE_TO", { version: m.latestVersion }) };
  if (m.isInstalled) return { variant: "success", text: t("PLATFORM.MODULES.INSTALLED") };
  return { variant: "info", text: t("PLATFORM.MODULES.FILTERS.NOTINSTALLED") };
}

function openModule(m: ModuleRow) {
  activeId.value = m.id;
  openBlade({ name: "PlatformModuleDetails", param: m.id, onClose: () => (activeId.value = undefined) });
}

const run = async (action: ModuleAction) => {
  await modules.perform(action, selection.value);
};

const toolbar = ref<IBladeToolbar[]>([
  { id: "refresh", title: t("PLATFORM.COMMON.REFRESH"), icon: "lucide-refresh-cw", clickHandler: () => load(true) },
  {
    id: "install",
    title: t("PLATFORM.MODULES.INSTALL"),
    icon: "lucide-download",
    permissions: ["platform:module:manage"],
    disabled: computed(() => !selection.value.length || selection.value.some((m) => m.isInstalled)),
    clickHandler: () => run("install"),
  },
  {
    id: "update",
    title: t("PLATFORM.MODULES.UPDATE"),
    icon: "lucide-arrow-up-circle",
    permissions: ["platform:module:manage"],
    disabled: computed(() => !selection.value.length || selection.value.some((m) => !m.isInstalled || !m.hasUpdate)),
    clickHandler: () => run("update"),
  },
  {
    id: "uninstall",
    title: t("PLATFORM.MODULES.UNINSTALL"),
    icon: "lucide-trash-2",
    permissions: ["platform:module:manage"],
    disabled: computed(() => !selection.value.length || selection.value.some((m) => !m.isInstalled || m.isRemovable === false)),
    clickHandler: () => run("uninstall"),
  },
]);

exposeToChildren({ reload: () => load(false) });
</script>

<style lang="scss">
.platform-module-icon {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

</style>
