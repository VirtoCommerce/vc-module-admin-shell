<template>
  <!-- widgets come from the host (shell/dashboard) and from module plugins via registerDashboardWidget -->
  <div
    class="as-dashboard"
    :class="{ 'as-dashboard--welcome': hasWelcome }"
    @pointerdown.capture="arm"
    @keydown.capture="onKey"
    @change.capture="tidy"
  >
    <button
      type="button"
      class="as-dashboard__reset"
      @click="resetLayout"
    >
      <VcIcon
        icon="lucide-rotate-ccw"
        size="xs"
      />
      {{ $t("SHELL.DASHBOARD.RESET_LAYOUT") }}
    </button>
    <!-- the company's message (white-labeling), above the widgets -->
    <WelcomeCard />
    <DraggableDashboard
      :key="generation"
      ref="dashboard"
      resizable
      show-drag-handles
    />
  </div>
</template>

<script lang="ts" setup>
import { DraggableDashboard, usePopup } from "@vc-shell/framework";
import { VcIcon } from "@vc-shell/framework/ui";
import type { GridStack } from "gridstack";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { branding } from "../shell/branding";
import WelcomeCard from "../shell/dashboard/WelcomeCard.vue";

const { t } = useI18n({ useScope: "global" });
const { showConfirmation } = usePopup();
const dashboard = ref<InstanceType<typeof DraggableDashboard> | null>(null);
// with the welcome card above the grid, the page scrolls as one (the card, then the widgets)
const hasWelcome = computed(() => !!branding.value.home.welcome);
// a new grid after a reset (see resetLayout)
const generation = ref(0);

// vc-shell's grid only floats widgets up, so moving one leaves holes beside it. After the user moves or resizes a
// widget the widgets close up: in reading order, each takes the first place it fits. Only after the user's own moves,
// not when vc-shell loads or resets a layout, which stay as given; vc-shell saves the change events the compaction
// fires. A mouse move is one change, after a press in the grid; gridstack's change event doesn't bubble, so it's caught
// on the way down, beside vc-shell's own handler. The keyboard moves a widget a cell at a time, so there the widgets
// close up when it is dropped (Enter or Space on the picked-up widget; seen here before vc-shell handles the key).
type GridElement = HTMLElement & { gridstack?: GridStack };
let armed = false;
function arm(event: Event) {
  armed = !!(event.target as Element).closest?.(".grid-stack");
}
function tidy(event: Event) {
  const grid = (event.target as GridElement).gridstack;
  if (!armed || !grid) return;
  armed = false;
  setTimeout(() => grid.compact("compact"));
}
function onKey(event: KeyboardEvent) {
  armed = false;
  const target = event.target as Element;
  if ((event.key === "Enter" || event.key === " ") && target.classList?.contains("vc-gridstack-dashboard__item--grabbed")) {
    const grid = target.closest<GridElement>(".grid-stack")?.gridstack;
    if (grid) setTimeout(() => grid.compact("compact"));
  }
}

// vc-shell's reset saves the widgets' own positions but moves the widgets one by one in the order they registered, and a
// widget that floats up into a row another one hasn't reached yet pushes that one down (plugins register theirs as
// they load, e.g. Inventory before Orders). A new grid loads the saved positions all at once, as on a first visit.
async function resetLayout() {
  if (await showConfirmation(t("SHELL.DASHBOARD.RESET_LAYOUT_CONFIRM"))) {
    dashboard.value?.rearrangeWidgets();
    generation.value++;
  }
}
</script>

<style lang="scss">
// the grid scrolls inside the workspace; the reset link sits in its 24px top margin, so the cards keep their place
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
  position: absolute;
  right: 14px;
  top: 2px;
  z-index: 2;

  &:hover {
    color: var(--color-primary-500);
  }
}
</style>
