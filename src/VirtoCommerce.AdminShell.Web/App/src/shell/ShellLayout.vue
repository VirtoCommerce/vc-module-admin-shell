<template>
  <!-- VcApp's layout slot: the rail and panel on desktop; on phones a top bar and the same navigation in a drawer -->
  <div
    v-if="environmentName"
    class="as-ribbon"
    :class="`as-ribbon--${environmentKind}`"
    role="note"
  >
    <!-- production: a recording light, as the AngularJS admin's banner marks it -->
    <span
      v-if="environmentKind === 'prod'"
      class="as-ribbon__live"
      aria-hidden="true"
    />
    {{ environmentName }}
  </div>
  <ShellNav
    v-if="!mobile"
    :avatar="avatar"
  />
  <template v-else>
    <!-- a child blade brings its own back button and title, so the bar is there on the first screen only (vc-shell's rule) -->
    <header
      v-if="showBar"
      class="as-mbar"
    >
      <button
        type="button"
        class="as-mbar__logo"
        :aria-label="$t('SHELL.NAV.HOME', { name: companyName })"
        @click="router.push({ path: '/' })"
      >
        <img
          :src="brandMark() ?? logoMark"
          alt=""
        />
      </button>
      <span class="as-mbar__title">{{ title }}</span>
      <button
        v-if="searchAvailable"
        type="button"
        class="as-mbar__search"
        :aria-label="$t('SHELL.SEARCH.LABEL')"
        @click="searchSheetOpen = true"
      >
        <VcIcon
          icon="lucide-search"
          size="l"
        />
      </button>
      <button
        ref="menuButton"
        type="button"
        class="as-mbar__menu"
        :aria-label="$t('SHELL.NAV.MENU')"
        :aria-expanded="drawerOpen"
        @click="drawerOpen = true"
      >
        <VcIcon
          icon="lucide-menu"
          size="l"
        />
        <span
          v-if="waiting"
          class="as-badge as-mbar__badge"
          >{{ formatBadgeCount(waiting) }}</span
        >
      </button>
    </header>
    <Transition name="as-drawer">
      <div
        v-if="drawerOpen"
        class="as-drawer"
      >
        <div
          class="as-drawer__scrim"
          @click="drawerOpen = false"
        />
        <div
          ref="drawerBody"
          class="as-drawer__body"
          role="dialog"
          aria-modal="true"
          :aria-label="$t('SHELL.NAV.MENU')"
          @keydown.tab="keepFocusInside"
        >
          <ShellNav
            drawer
            :avatar="avatar"
            @navigate="drawerOpen = false"
            @close="drawerOpen = false"
          />
        </div>
      </div>
    </Transition>
    <SearchSheet />
  </template>
</template>

<script setup lang="ts">
import {
  detectThemePreset,
  formatBadgeCount,
  useBladeStack,
  useEnvironmentName,
  usePermissions,
} from "@vc-shell/framework";
import { VcIcon } from "@vc-shell/framework/ui";
import { useEventListener } from "@vueuse/core";
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAdminMenu } from "../composables/useAdminMenu";
import { useBladeDiscovery } from "./bladeDiscovery";
import { startMenuCounters, waitingOn } from "./menuCounters";
import { drawerOpen, searchSheetOpen } from "./navState";
import { globalSearch, useGlobalSearchSetup } from "./search";
import SearchSheet from "./search/SearchSheet.vue";
import ShellNav from "./ShellNav.vue";
import logoMark from "/assets/logo-mark.svg";
import { brandMark, companyName } from "./branding";

const props = defineProps<{ mobile: boolean; avatar?: string }>();

const router = useRouter();
const route = useRoute();
const { blades, activeBlade } = useBladeStack();
const { menu, load, activeTitle, trackUses, setDiscovered } = useAdminMenu();
// the workspace blades no menu entry opens go to More once the plugins have loaded (nothing installed is missing)
useBladeDiscovery(setDiscovered);
const { hasAccess } = usePermissions();
// the menu, its counters and Recent's use count live with the layout, which is always there (the phone drawer mounts
// its nav on opening)
onMounted(() => {
  load();
  startMenuCounters(menu, hasAccess);
});
trackUses();
// the environment from the host name, as the AngularJS admin's banner reads it: its label, and its kind for the color
// (prod, dev, test, staging, demo, default); production shows too, marked
const { environmentName } = useEnvironmentName();
const environmentKind = detectThemePreset(window.location.hostname);

// global search: providers bound to the user and the shell's navigation (the layout is always there)
useGlobalSearchSetup();
const searchAvailable = computed(() => globalSearch.usableProviders().length > 0);

// phones: Ctrl/Cmd+K (a tablet's keyboard) opens the search sheet
useEventListener(window, "keydown", (event: KeyboardEvent) => {
  const shortcut = (event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "k";
  if (!props.mobile || !shortcut || !searchAvailable.value) return;
  event.preventDefault();
  drawerOpen.value = false;
  searchSheetOpen.value = true;
});
// the sheet belongs to phones: growing the window past the phone layout closes it
watch(
  () => props.mobile,
  (mobile) => {
    if (!mobile) searchSheetOpen.value = false;
  },
);

const showBar = computed(() => blades.value.length <= 1);
// everything waiting in the menu, on the button that opens it: the items' own counters (a sub-item's repeats its item's,
// Modules · Updates), without plain totals
const waiting = computed(() => waitingOn(menu.value.sections.flatMap((s) => s.items.map((i) => i.id))));

// a blade's own title, else the menu item of the screen that's open (Dashboard, an app)
const title = computed(() => activeBlade.value?.title || activeTitle.value);

let closedByNavigation = false;
watch(
  () => route.fullPath,
  () => {
    closedByNavigation = drawerOpen.value;
    drawerOpen.value = false;
    searchSheetOpen.value = false;
  },
);

// a modal drawer: focus moves in on opening, Tab stays inside, and closing it returns focus to the menu button
const menuButton = ref<HTMLElement>();
const drawerBody = ref<HTMLElement>();
const focusables = () =>
  [...(drawerBody.value?.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], input") ?? [])].filter(
    (el) => el.offsetParent !== null,
  );
watch(drawerOpen, async (isOpen) => {
  await nextTick();
  if (isOpen) focusables()[0]?.focus();
  else if (!closedByNavigation) menuButton.value?.focus();
  closedByNavigation = false;
});
function keepFocusInside(event: KeyboardEvent) {
  const items = focusables();
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
useEventListener(window, "keydown", (event: KeyboardEvent) => {
  if (event.key === "Escape") drawerOpen.value = false;
});
</script>
