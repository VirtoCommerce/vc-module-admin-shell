<template>
  <VcBlade
    :title="$t('PLATFORM.MODULES.TITLE')"
    :subtitle="$t(`PLATFORM.MODULES.VIEWS.${view.toUpperCase()}`)"
    :toolbar-items="toolbar"
    :loading="loading"
    width="50%"
  >
    <!-- a table per view: the data table keeps rows it has shown when its items shrink (Installed -> Updates) -->
    <VcDataTable
      :key="view"
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
            :src="rootedUrl(data.iconUrl) ?? fallbackIcon"
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
import { useAsync, useBlade, useBladeStack, type IBladeToolbar } from "@vc-shell/framework";
import { VcBlade, VcColumn, VcDataTable, VcStatus } from "@vc-shell/framework/ui";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { refreshItem } from "../../composables/blade";
import { useModules, type ModuleAction, type ModuleRow } from "../../composables/modules";
import { rootedUrl } from "../../../../utils/url";

defineBlade({
  url: "/modules",
  name: "PlatformModules",
  isWorkspace: true,
  permissions: ["platform:module:access"],
});

const fallbackIcon = "/images/module-logo.svg";
const { t } = useI18n({ useScope: "global" });
const { id: bladeId, openBlade, exposeToChildren, closeChildren } = useBlade();
const { updateBladeQuery } = useBladeStack();
const modules = useModules();

const route = useRoute();
const router = useRouter();

/* the view comes from the menu (Modules · Browse, Installed, Updates: ?view=), as the AngularJS tree's nodes did */
const VIEWS = ["browse", "installed", "updates"] as const;
type View = (typeof VIEWS)[number];
const isView = (x: unknown): x is View => VIEWS.includes(x as View);
// a link opened in a new browser: the shell's start drops the query before this blade reads it (see settings/list.vue)
const openedWith = new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("view");
// the view shown: the one the address asks for, kept while an address without one (the shell's start drops queries; the
// menu always names one, Modules itself is Installed) comes and goes
const view = ref<View>(isView(route.query.view) ? route.query.view : isView(openedWith) ? openedWith : "installed");
watch(
  () => route.query.view,
  (asked) => {
    if (isView(asked)) view.value = asked;
  },
);
// the address names the view, so the menu marks it. The blade stack keeps it for its own address sync (opening a
// module's details rebuilds the address from it), and the route is set too, whenever the address loses it (as the
// Settings blade keeps its group)
watch(view, (current) => updateBladeQuery(bladeId.value, { view: current }), { immediate: true });
const onModules = () => route.path === "/modules" || route.path.startsWith("/modules/");
watch(
  () => [route.path, route.query.view, view.value],
  () => {
    if (!onModules() || route.query.view === view.value) return;
    router.replace({ query: { ...route.query, view: view.value } });
  },
  { immediate: true },
);

const keyword = ref("");
const group = ref<string>();
const selection = ref<ModuleRow[]>([]);
const activeId = ref<string>();

const { loading, action: load } = useAsync<boolean | undefined>(async (rescan) => {
  await modules.load(!!rescan);
  selection.value = [];
});
load();

// legacy tree nodes: Browse (all), Installed (with errors among them, marked), Updates
function inView(m: ModuleRow, v: View) {
  switch (v) {
    case "installed":
      return !!m.isInstalled;
    case "updates":
      return !!m.isInstalled && m.hasUpdate;
    default:
      return true;
  }
}

// another view: a fresh selection, and a module's details open from the last view close (it may not be in this one)
watch(view, () => {
  selection.value = [];
  activeId.value = undefined;
  closeChildren();
});

const visible = computed(() => {
  const text = keyword.value.trim().toLowerCase();
  return modules.rows.value.filter(
    (m) =>
      inView(m, view.value) &&
      (!group.value || (m.groups?.length ? m.groups.includes(group.value) : group.value === "ungrouped")) &&
      (!text || [m.title, m.id, m.description].some((x) => x?.toLowerCase().includes(text))),
  );
});

const globalFilters = computed(() => [
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
  refreshItem(() => load(true)),
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
