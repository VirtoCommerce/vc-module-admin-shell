<template>
  <!-- widgets come from the host (shell/dashboard) and from module plugins via registerDashboardWidget; which ones show,
       where and how big comes from the dashboard layers (shell/dashboard/layers.ts) -->
  <div
    ref="root"
    class="as-dashboard"
    :class="{ 'as-dashboard--welcome': hasWelcome && !editingAll, 'as-dashboard--everyone': editingAll }"
    @pointerdown.capture="arm"
    @keydown.capture="onKey"
    @change.capture="tidy"
  >
    <!-- customizing Home for everyone (admin-shell:dashboard:manage): what is saved is every user's starting point -->
    <div
      v-if="editingAll"
      class="as-dashboard__everyone"
      role="region"
      :aria-label="$t('SHELL.DASHBOARD.EVERYONE.TITLE')"
    >
      <VcIcon
        icon="lucide-users"
        size="s"
      />
      <div class="as-dashboard__everyone-text">
        <strong>{{ $t("SHELL.DASHBOARD.EVERYONE.TITLE") }}</strong>
        <span>{{ $t("SHELL.DASHBOARD.EVERYONE.HINT") }}</span>
      </div>
      <label class="as-dashboard__check">
        <input
          v-model="resetUsers"
          type="checkbox"
        />
        {{ $t("SHELL.DASHBOARD.EVERYONE.RESET_USERS") }}
      </label>
      <button
        type="button"
        class="as-dashboard__btn"
        :disabled="saving"
        @click="leaveEveryone"
      >
        {{ $t("SHELL.DASHBOARD.EVERYONE.CANCEL") }}
      </button>
      <button
        type="button"
        class="as-dashboard__btn as-dashboard__btn--primary"
        :disabled="saving"
        @click="saveEveryone"
      >
        {{ $t("SHELL.DASHBOARD.EVERYONE.SAVE") }}
      </button>
    </div>
    <div
      class="as-dashboard__actions"
      :class="{ 'as-dashboard__actions--everyone': editingAll }"
      :style="editingAll ? undefined : { right: resetRight }"
    >
      <button
        v-if="editingAll || dashboardState.personalization.allowHide"
        type="button"
        class="as-dashboard__reset"
        :aria-expanded="panelOpen"
        aria-controls="as-dashboard-widgets"
        @click="panelOpen = !panelOpen"
      >
        <VcIcon
          icon="lucide-layout-grid"
          size="xs"
        />
        {{ $t("SHELL.DASHBOARD.WIDGETS") }}
      </button>
      <button
        v-if="editingAll || canMove || canResize"
        type="button"
        class="as-dashboard__reset"
        @click="resetLayout"
      >
        <VcIcon
          icon="lucide-rotate-ccw"
          size="xs"
        />
        {{ editingAll ? $t("SHELL.DASHBOARD.EVERYONE.MODULE_DEFAULTS") : $t("SHELL.DASHBOARD.RESET_LAYOUT") }}
      </button>
      <button
        v-if="dashboardState.canManage && !editingAll"
        type="button"
        class="as-dashboard__reset"
        @click="startEveryone"
      >
        <VcIcon
          icon="lucide-users"
          size="xs"
        />
        {{ $t("SHELL.DASHBOARD.CUSTOMIZE_ALL") }}
      </button>
    </div>
    <!-- the widgets list: the user's own choice, or for everyone while customizing -->
    <div
      v-if="panelOpen"
      id="as-dashboard-widgets"
      class="as-dashboard__panel"
      :class="{ 'as-dashboard__panel--everyone': editingAll }"
      :style="editingAll ? undefined : { right: resetRight }"
    >
      <div class="as-dashboard__panel-head">
        <strong>{{
          editingAll ? $t("SHELL.DASHBOARD.EVERYONE.PANEL_TITLE") : $t("SHELL.DASHBOARD.WIDGETS_TITLE")
        }}</strong>
        <button
          type="button"
          class="as-dashboard__close"
          :aria-label="$t('SHELL.DASHBOARD.CLOSE')"
          @click="panelOpen = false"
        >
          <VcIcon
            icon="lucide-x"
            size="xs"
          />
        </button>
      </div>
      <label
        v-for="widget in panelWidgets"
        :key="widget.id"
        class="as-dashboard__row"
      >
        <input
          type="checkbox"
          :checked="!widget.hidden"
          @change="toggleWidget(widget.id, ($event.target as HTMLInputElement).checked)"
        />
        <span class="as-dashboard__row-text">
          <span>{{ widget.label }}</span>
          <small v-if="editingAll">{{ widget.permission }}</small>
        </span>
      </label>
    </div>
    <!-- the company's message (white-labeling), above the widgets -->
    <WelcomeCard v-if="!editingAll" />
    <DraggableDashboard
      v-if="ready"
      :key="generation"
      ref="dashboard"
      :resizable="canResize"
      :show-drag-handles="canMove"
    />
  </div>
</template>

<script lang="ts" setup>
import { DashboardServiceKey, DraggableDashboard, notification, useDashboard, usePopup } from "@vc-shell/framework";
import { VcIcon } from "@vc-shell/framework/ui";
import type { GridStack } from "gridstack";
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { adminDashboardApi } from "../api/adminDashboard";
import { branding } from "../shell/branding";
import {
  diffLayout,
  fromStorage,
  hiddenIn,
  layoutIn,
  LAYOUT_STORAGE_KEY,
  OPEN_DASHBOARD,
  readEffective,
  toPatch,
  toStorage,
  visibleWidgets,
  type EffectiveDashboard,
  type WidgetLayout,
} from "../shell/dashboard/layers";
import WelcomeCard from "../shell/dashboard/WelcomeCard.vue";

const { t, te } = useI18n({ useScope: "global" });
const { showConfirmation } = usePopup();
const route = useRoute();
const router = useRouter();
const dashboard = ref<InstanceType<typeof DraggableDashboard> | null>(null);
// with the welcome card above the grid, the page scrolls as one (the card, then the widgets)
const hasWelcome = computed(() => !!branding.value.home.welcome);
// a new grid after a reset or a change of mode (see resetLayout)
const generation = ref(0);

/* ---- the layers (docs/dashboard-widgets.md, "Layers") ---- */

// the widgets the modules registered that the user's permissions allow (vc-shell's service checks them)
const registry = useDashboard();
// the user's dashboard. Until it is read the grid waits, so a hidden widget never shows and its room is never kept.
// If it can't be read, every widget shows, the layout stays this browser's, and nothing is saved (synced: false)
const dashboardState = ref<EffectiveDashboard>(OPEN_DASHBOARD);
const synced = ref(false);
const ready = ref(false);
// customizing for everyone: the widgets hidden in the layer for everyone being edited
const editingAll = ref(false);
const everyoneHidden = ref<string[]>([]);
const resetUsers = ref(false);
const saving = ref(false);
const panelOpen = ref(false);

const canMove = computed(() => editingAll.value || dashboardState.value.personalization.allowMove);
const canResize = computed(() => editingAll.value || dashboardState.value.personalization.allowResize);

// the widgets as each mode places them: while customizing, the modules' own (the layout for everyone comes in as the
// saved layout); else without the hidden ones and with the layout for everyone over the modules'
const base = computed(() =>
  editingAll.value ? registry.getWidgets() : visibleWidgets(registry.getWidgets(), dashboardState.value),
);
const shown = computed(() =>
  editingAll.value ? base.value.filter((w) => !everyoneHidden.value.includes(w.id)) : base.value,
);
// the grid reports each widget's place back to the service; one it no longer knows (removed while the grid moved it) is
// left alone instead of failing the whole update
const knownIds = () => new Set(registry.getWidgets().map((w) => w.id));
provide(DashboardServiceKey, {
  ...registry,
  getWidgets: () => shown.value,
  updateWidgetPosition: (id, position) => {
    if (knownIds().has(id)) registry.updateWidgetPosition(id, position);
  },
});

function labelOf(name: string, id: string) {
  return name ? (te(name) ? t(name) : name) : id;
}
// the list: while customizing, every widget with the permission it needs; else those the user may hide or show (not
// the ones hidden for everyone or by the user's roles)
const panelWidgets = computed(() => {
  const forced = new Set(dashboardState.value.hidden);
  return registry
    .getWidgets()
    .filter((w) => editingAll.value || !forced.has(w.id))
    .map((w) => ({
      id: w.id,
      label: labelOf(w.name, w.id),
      hidden: editingAll.value ? everyoneHidden.value.includes(w.id) : dashboardState.value.userHidden.includes(w.id),
      permission: w.permissions?.length
        ? t("SHELL.DASHBOARD.PERMISSION", { permission: w.permissions.join(", ") })
        : t("SHELL.DASHBOARD.NO_PERMISSION"),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
});

// vc-shell's grid reads its saved layout when it starts: it gets the layout of the mode it starts in
function writeStorage(layout: Record<string, WidgetLayout>, widgets = base.value) {
  try {
    const placements = toStorage(widgets, layout);
    if (placements.length) localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(placements));
    else localStorage.removeItem(LAYOUT_STORAGE_KEY);
  } catch {
    // storage blocked: the grid starts from the widgets' defaults
  }
}
function readStorage() {
  try {
    return fromStorage(localStorage.getItem(LAYOUT_STORAGE_KEY));
  } catch {
    return [];
  }
}

// the layout a browser kept before it was saved on the server is carried over once, if the user has none there yet
const MIGRATED_KEY = "admin-shell:dashboard-migrated";
async function carryOver(state: EffectiveDashboard) {
  try {
    if (localStorage.getItem(MIGRATED_KEY)) return;
    localStorage.setItem(MIGRATED_KEY, "1");
    if (Object.keys(state.layout).length || state.userHidden.length || !state.personalization.allowMove) return;
    const layout = diffLayout(readStorage(), visibleWidgets(registry.getWidgets(), state));
    if (!Object.keys(layout).length) return;
    state.layout = layout;
    await adminDashboardApi.savePrefs({ widgets: toPatch([], layout), layoutVersion: state.layoutVersion });
  } catch {
    // stays as the server has it
  }
}

async function load() {
  try {
    dashboardState.value = readEffective(await adminDashboardApi.getMine());
    synced.value = true;
    await carryOver(dashboardState.value);
    writeStorage(dashboardState.value.layout);
  } catch {
    dashboardState.value = OPEN_DASHBOARD;
    synced.value = false;
  }
}

// the user's own layer: the widgets the user hid, and the places and sizes that differ from the defaults
let saveTimer: ReturnType<typeof setTimeout> | undefined;
function saveMine(delay = 600) {
  if (!synced.value || editingAll.value) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const state = dashboardState.value;
    state.layout = diffLayout(readStorage(), base.value);
    try {
      await adminDashboardApi.savePrefs({
        widgets: toPatch(state.userHidden, state.layout),
        layoutVersion: state.layoutVersion,
      });
    } catch {
      notification.error(t("SHELL.DASHBOARD.SAVE_FAILED"));
    }
  }, delay);
}

function toggleWidget(id: string, show: boolean) {
  if (editingAll.value) {
    everyoneHidden.value = show ? everyoneHidden.value.filter((x) => x !== id) : [...everyoneHidden.value, id];
    return;
  }
  const state = dashboardState.value;
  state.userHidden = show ? state.userHidden.filter((x) => x !== id) : [...state.userHidden, id];
  saveMine(0);
}

/* ---- customizing for everyone ---- */

// a change of mode changes the widgets the grid shows: the grid goes away first and starts again with the new ones and
// their layout, so it never moves a widget the new mode doesn't have
async function switchMode(change: () => Promise<void> | void) {
  ready.value = false;
  panelOpen.value = false;
  await nextTick();
  try {
    await change();
  } finally {
    generation.value++;
    ready.value = true;
  }
}

async function startEveryone() {
  try {
    const patch = await adminDashboardApi.getGlobal();
    await switchMode(() => {
      everyoneHidden.value = hiddenIn(patch.widgets);
      resetUsers.value = false;
      editingAll.value = true;
      writeStorage(layoutIn(patch.widgets), registry.getWidgets());
    });
  } catch {
    notification.error(t("SHELL.DASHBOARD.SAVE_FAILED"));
  }
}

async function leaveEveryone() {
  await switchMode(async () => {
    editingAll.value = false;
    if (route.query.customize) await router.replace({ query: { ...route.query, customize: undefined } });
    await load();
  });
}

async function saveEveryone() {
  saving.value = true;
  try {
    // closed up, as after a user's own move, then saved by the grid
    root.value?.querySelector<GridElement>(".grid-stack")?.gridstack?.compact("compact");
    dashboard.value?.saveLayout();
    // only what differs from the modules' own, so a module's new default still reaches the widgets nobody placed
    const layout = diffLayout(readStorage(), registry.getWidgets());
    await adminDashboardApi.saveGlobal({ widgets: toPatch(everyoneHidden.value, layout) }, resetUsers.value);
    notification.success(t("SHELL.DASHBOARD.EVERYONE.SAVED"));
    await leaveEveryone();
  } catch {
    notification.error(t("SHELL.DASHBOARD.SAVE_FAILED"));
  } finally {
    saving.value = false;
  }
}

/* ---- the grid ---- */

// vc-shell's grid only floats widgets up, so moving one leaves holes beside it. After the user moves or resizes a
// widget the widgets close up: in reading order, each takes the first place it fits. Only after the user's own moves,
// not when vc-shell loads or resets a layout, which stay as given; vc-shell saves the change events the compaction
// fires. A mouse move is one change, after a press in the grid; gridstack's change event doesn't bubble, so it's caught
// on the way down, beside vc-shell's own handler. The keyboard moves a widget a cell at a time, so there the widgets
// close up when it is dropped (Enter or Space on the picked-up widget; seen here before vc-shell handles the key).
// Each of the user's changes then goes to the user's layer, so the layout is the same in every browser.
type GridElement = HTMLElement & { gridstack?: GridStack };
let armed = false;
function arm(event: Event) {
  armed = !!(event.target as Element).closest?.(".grid-stack");
}
function closeUp(grid: GridStack) {
  setTimeout(() => {
    grid.compact("compact");
    saveMine();
  });
}
function tidy(event: Event) {
  const grid = (event.target as GridElement).gridstack;
  if (!armed || !grid) return;
  armed = false;
  closeUp(grid);
}
// the keys vc-shell moves (arrows) and resizes (Shift + arrows) a picked-up widget with: kept from it when users may not
const ARROWS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
function onKey(event: KeyboardEvent) {
  armed = false;
  const target = event.target as Element;
  const pickUp = event.key === "Enter" || event.key === " ";
  const onWidget = !!target.closest?.(".grid-stack-item");
  if (
    onWidget &&
    ((ARROWS.has(event.key) && (event.shiftKey ? !canResize.value : !canMove.value)) ||
      (pickUp && !canMove.value && !canResize.value))
  ) {
    event.stopPropagation();
    return;
  }
  if (pickUp && target.classList?.contains("vc-gridstack-dashboard__item--grabbed")) {
    const grid = target.closest<GridElement>(".grid-stack")?.gridstack;
    if (grid) closeUp(grid);
  }
}

// vc-shell's reset saves the widgets' own positions but moves the widgets one by one in the order they registered, and a
// widget that floats up into a row another one hasn't reached yet pushes that one down (plugins register theirs as
// they load, e.g. Inventory before Orders). A new grid loads the saved positions all at once, as on a first visit.
// The actions line up with the cards' right edge: the grid's margin, the widget's inset and the scrollbar when the
// page scrolls add up differently with the width, so it is measured, not a fixed offset
const root = ref<HTMLElement>();
const resetRight = ref<string>();
function alignReset() {
  const grid = root.value?.querySelector<HTMLElement>(".grid-stack");
  if (!root.value || !grid) return;
  const item = grid.querySelector(".grid-stack-item");
  const content = item?.querySelector(".grid-stack-item-content");
  const inset = item && content ? item.getBoundingClientRect().right - content.getBoundingClientRect().right : 0;
  resetRight.value = `${Math.round(root.value.getBoundingClientRect().right - grid.getBoundingClientRect().right + inset)}px`;
}
let resizeObserver: ResizeObserver | undefined;
// the grid appears after the widgets load, and again after a reset; where users may not move, it doesn't drag
function lock(grid: GridStack) {
  // nothing to change: a static grid; else only what users may not do is off. Widgets the plugins add later get it too
  const apply = () => {
    if (!canMove.value && !canResize.value) grid.setStatic(true);
    else {
      grid.setStatic(false);
      grid.enableMove(canMove.value);
      grid.enableResize(canResize.value);
    }
  };
  apply();
  grid.off("added");
  grid.on("added", apply);
}
function watchGrid(attempt = 0) {
  const grid = root.value?.querySelector<GridElement>(".grid-stack");
  if (grid?.gridstack) {
    resizeObserver?.observe(grid);
    alignReset();
    lock(grid.gridstack);
  } else if (attempt < 50) setTimeout(() => watchGrid(attempt + 1), 100);
}
onMounted(async () => {
  resizeObserver = new ResizeObserver(() => alignReset());
  if (root.value) resizeObserver.observe(root.value);
  await load();
  ready.value = true;
  // the configurator's "Customize on Home" opens Home in this mode
  if (route.query.customize && dashboardState.value.canManage) await startEveryone();
  await nextTick();
  watchGrid();
});
watch(generation, () => nextTick(() => watchGrid()));
onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  clearTimeout(saveTimer);
});

async function resetLayout() {
  if (editingAll.value) {
    // the modules' own places and sizes, as the start of the layout for everyone
    writeStorage({}, registry.getWidgets());
    generation.value++;
    return;
  }
  if (await showConfirmation(t("SHELL.DASHBOARD.RESET_LAYOUT_CONFIRM"))) {
    writeStorage({});
    dashboard.value?.rearrangeWidgets();
    generation.value++;
    saveMine(0);
  }
}
</script>

<style lang="scss">
// the grid scrolls inside the workspace; the actions sit in its 24px top margin, so the cards keep their place
.as-dashboard {
  height: 100%;
  position: relative;
}

// the welcome card (white-labeling) scrolls away with the widgets: the page scrolls, not the grid's own container, which
// would sit under the card at the full height and lose its bottom
.as-dashboard--welcome {
  overflow-y: auto;

  > .vc-container,
  > .vc-container > .vc-container__inner {
    height: auto;
    overflow: visible;
  }
}

// customizing for everyone: the bar above, the grid in the rest
.as-dashboard--everyone {
  display: flex;
  flex-direction: column;

  > .vc-container {
    flex: 1;
    min-height: 0;
  }
}

.as-dashboard__everyone {
  align-items: center;
  background: var(--color-primary-50);
  border-bottom: 1px solid var(--color-primary-200);
  color: var(--color-neutral-900);
  display: flex;
  flex: none;
  flex-wrap: wrap;
  font-size: 13px;
  gap: 8px 16px;
  padding: 10px 16px;
}

.as-dashboard__everyone-text {
  display: flex;
  flex: 1 1 280px;
  flex-direction: column;
  gap: 2px;

  span {
    color: var(--color-neutral-600);
  }
}

.as-dashboard__check {
  align-items: center;
  cursor: pointer;
  display: flex;
  gap: 6px;
}

.as-dashboard__btn {
  background: var(--color-neutral-0);
  border: 1px solid var(--color-neutral-300);
  border-radius: 6px;
  color: var(--color-neutral-800);
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  height: 32px;
  padding: 0 14px;

  &:disabled {
    cursor: default;
    opacity: 0.6;
  }
}

.as-dashboard__btn--primary {
  background: var(--color-primary-500);
  border-color: var(--color-primary-500);
  color: var(--color-neutral-0);
}

.as-dashboard__actions {
  display: flex;
  gap: 4px;
  position: absolute;
  right: 14px;
  top: 2px;
  z-index: 2;
}

// under the bar while customizing, in the grid's top margin
.as-dashboard__actions--everyone {
  align-self: flex-end;
  flex: none;
  margin: 2px 14px -22px 0;
  position: relative;
  right: auto;
  top: auto;
}

.as-dashboard__reset {
  align-items: center;
  background: var(--color-neutral-0);
  border: 0;
  border-radius: 999px;
  color: var(--color-neutral-500);
  cursor: pointer;
  display: flex;
  font-family: inherit;
  font-size: 12px;
  gap: 4px;
  height: 20px;
  padding: 0 8px;

  &:hover,
  &[aria-expanded="true"] {
    color: var(--color-primary-500);
  }
}

.as-dashboard__panel {
  background: var(--color-neutral-0);
  border: 1px solid var(--color-neutral-200);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 12%);
  display: flex;
  flex-direction: column;
  max-height: 60vh;
  overflow-y: auto;
  padding: 8px 0;
  position: absolute;
  right: 14px;
  top: 26px;
  width: 300px;
  z-index: 3;
}

.as-dashboard__panel--everyone {
  top: 84px;
}

.as-dashboard__panel-head {
  align-items: center;
  display: flex;
  font-size: 13px;
  justify-content: space-between;
  padding: 4px 12px 8px;
}

.as-dashboard__close {
  background: none;
  border: 0;
  color: var(--color-neutral-500);
  cursor: pointer;
  display: flex;
  padding: 2px;
}

.as-dashboard__row {
  align-items: flex-start;
  cursor: pointer;
  display: flex;
  font-size: 13px;
  gap: 8px;
  padding: 6px 12px;

  &:hover {
    background: var(--color-neutral-50);
  }

  input {
    margin-top: 2px;
  }
}

.as-dashboard__row-text {
  display: flex;
  flex-direction: column;
  gap: 2px;

  small {
    color: var(--color-neutral-500);
    font-size: 11px;
  }
}
</style>
