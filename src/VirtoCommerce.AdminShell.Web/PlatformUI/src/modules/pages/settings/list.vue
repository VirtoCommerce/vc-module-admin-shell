<template>
  <VcBlade
    :title="$t('PLATFORM.SETTINGS.LIST.TITLE')"
    :toolbar-items="toolbar"
    :loading="loading"
    width="50%"
  >
    <VcDataTable
      v-model:search-value="keyword"
      :items="rows"
      :total-count="rows.length"
      :searchable="true"
      :state-key="'PLATFORM_SETTINGS'"
      :active-item-id="activeGroup"
      :global-filters="globalFilters"
      :empty-state="{ icon: 'lucide-settings-2', title: $t('PLATFORM.SETTINGS.LIST.EMPTY') }"
      @row-click="(e: { data: GroupRow }) => openGroup(e.data.id)"
      @filter="onFilter"
    >
      <VcColumn
        id="title"
        :title="$t('PLATFORM.SETTINGS.LIST.GROUP')"
        always-visible
      />
      <VcColumn
        id="moduleId"
        :title="$t('PLATFORM.SETTINGS.LIST.MODULE')"
      />
      <VcColumn
        id="count"
        :title="$t('PLATFORM.SETTINGS.LIST.COUNT')"
        type="number"
        width="110px"
      />
      <VcColumn
        id="modified"
        :title="$t('PLATFORM.SETTINGS.LIST.MODIFIED')"
        width="130px"
      >
        <template #body="{ data }"><span v-if="data.modified" class="vc-table-cell-number">{{ data.modified }}</span></template>
      </VcColumn>
    </VcDataTable>
    <input
      :ref="(el) => setFileInput(el)"
      type="file"
      accept=".json,application/json"
      hidden
      @change="onImportFile"
    />
  </VcBlade>
</template>

<script setup lang="ts">
import { ChangeLogClient, useApiClient, useAsync, useBlade, usePopup, notification, type IBladeToolbar } from "@vc-shell/framework";
import { VcBlade, VcColumn, VcDataTable } from "@vc-shell/framework/ui";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { exportDocument, groupPath, settingsOf, settingTitle, useSettingsStore, type SettingSchema } from "../../composables/settings";

defineBlade({
  url: "/settings",
  name: "PlatformSettings",
  isWorkspace: true,
  permissions: ["platform:setting:access"],
});

interface GroupRow {
  id: string;
  title: string;
  moduleId: string;
  count: number;
  modified: number;
}

const { t, locale } = useI18n({ useScope: "global" });
const { openBlade, exposeToChildren } = useBlade();
const { showConfirmation } = usePopup();
const store = useSettingsStore();
const { getApiClient: changeLogClient } = useApiClient(ChangeLogClient);

const keyword = ref("");
const filters = ref<{ moduleId?: string; show: string[] }>({ show: [] });
const activeGroup = ref<string>();
let fileInput: HTMLInputElement | undefined;
const setFileInput = (el: unknown) => {
  fileInput = el as HTMLInputElement;
};

const { loading, action: load } = useAsync(() => store.load(String(locale.value || "en")));
load();

/** keyword search over name, title, group and value (legacy filter panel) */
function matches(s: SettingSchema, text: string) {
  const value = store.stored.value[s.name];
  return [s.name, settingTitle(s), groupPath(s).join(" › "), typeof value === "object" ? JSON.stringify(value) : value]
    .some((x) => x != null && String(x).toLowerCase().includes(text));
}

const visible = computed(() => {
  const text = keyword.value.trim().toLowerCase();
  return store.schema.value.filter(
    (s) =>
      (filters.value.show.includes("tenant") || !s.assignedToTenants?.length) &&
      (!filters.value.moduleId || s.moduleId === filters.value.moduleId) &&
      (!filters.value.show.includes("modified") || store.isModified(s)) &&
      (!text || matches(s, text)),
  );
});

const rows = computed<GroupRow[]>(() => {
  const groups = new Map<string, GroupRow>();
  for (const s of visible.value) {
    const id = groupPath(s).join("|");
    const row = groups.get(id) ?? { id, title: groupPath(s).join(" › "), moduleId: s.moduleId ?? "", count: 0, modified: 0 };
    row.count++;
    if (store.isModified(s)) row.modified++;
    groups.set(id, row);
  }
  return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title));
});

const globalFilters = computed(() => [
  {
    id: "moduleId",
    label: t("PLATFORM.SETTINGS.LIST.MODULE"),
    filter: {
      options: [...new Set(store.schema.value.map((s) => s.moduleId).filter(Boolean))]
        .sort()
        .map((x) => ({ value: x as string, label: x as string })),
    },
  },
  {
    id: "show",
    label: t("PLATFORM.SETTINGS.LIST.SHOW"),
    filter: {
      multiple: true,
      options: [
        { value: "modified", label: t("PLATFORM.SETTINGS.LIST.MODIFIED_ONLY") },
        { value: "tenant", label: t("PLATFORM.SETTINGS.LIST.TENANT") },
      ],
    },
  },
]);

function onFilter(event: { filters: Record<string, unknown> }) {
  const show = event.filters.show;
  let shown: string[] = [];
  if (Array.isArray(show)) shown = show;
  else if (show) shown = [show as string];
  filters.value = {
    moduleId: (event.filters.moduleId as string) || undefined,
    show: shown,
  };
}

function openGroup(group: string) {
  activeGroup.value = group;
  openBlade({
    name: "PlatformSettingsGroup",
    param: group,
    options: { keyword: keyword.value.trim() || undefined, includeTenant: filters.value.show.includes("tenant") },
    onClose: () => (activeGroup.value = undefined),
  });
}

async function exportJson() {
  const doc = exportDocument(await store.exportModified());
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" }));
  link.download = "settings-global.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

async function onImportFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  let settings: Record<string, unknown>;
  try {
    settings = settingsOf(JSON.parse(await file.text()));
  } catch {
    notification.error(t("PLATFORM.SETTINGS.LIST.IMPORT_INVALID"));
    return;
  }
  if (await showConfirmation(t("PLATFORM.SETTINGS.LIST.IMPORT_CONFIRM", { count: Object.keys(settings).length }))) {
    await store.save(settings, true);
    notification.success(t("PLATFORM.SETTINGS.SAVED"));
    await load();
  }
}

const toolbar = ref<IBladeToolbar[]>([
  { id: "refresh", title: t("PLATFORM.COMMON.REFRESH"), icon: "lucide-refresh-cw", clickHandler: () => load() },
  { id: "export", title: t("PLATFORM.SETTINGS.LIST.EXPORT"), icon: "lucide-download", clickHandler: () => exportJson() },
  {
    id: "import",
    title: t("PLATFORM.SETTINGS.LIST.IMPORT"),
    icon: "lucide-upload",
    permissions: ["platform:setting:update"],
    clickHandler: () => fileInput?.click(),
  },
  {
    id: "json",
    title: t("PLATFORM.SETTINGS.LIST.EDIT_JSON"),
    icon: "lucide-braces",
    clickHandler: () => openBlade({ name: "PlatformSettingsJson" }),
  },
  {
    id: "cache",
    title: t("PLATFORM.SETTINGS.LIST.RESET_CACHE"),
    icon: "lucide-eraser",
    permissions: ["cache:reset"],
    async clickHandler() {
      if (await showConfirmation(t("PLATFORM.SETTINGS.LIST.RESET_CACHE_CONFIRM"))) {
        await (await changeLogClient()).resetPlatformCache();
        notification.success(t("PLATFORM.SETTINGS.LIST.CACHE_RESET"));
      }
    },
  },
]);

exposeToChildren({ reload: () => load() });
</script>
