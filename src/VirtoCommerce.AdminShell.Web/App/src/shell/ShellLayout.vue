<template>
  <!-- VcApp's layout slot: the rail and panel on desktop; on phones a top bar and the same navigation in a drawer -->
  <div
    v-if="environmentName && !isIgnored"
    class="as-ribbon"
    role="note"
  >
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
        :aria-label="$t('SHELL.NAV.HOME')"
        @click="router.push({ path: '/' })"
      >
        <img
          :src="logoMark"
          alt=""
        />
      </button>
      <span class="as-mbar__title">{{ title }}</span>
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
  </template>
</template>

<script setup lang="ts">
import { formatBadgeCount, useBladeStack, useEnvironmentName } from "@vc-shell/framework";
import { VcIcon } from "@vc-shell/framework/ui";
import { useEventListener } from "@vueuse/core";
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAdminMenu } from "../composables/useAdminMenu";
import { badgeCounts, startBadges } from "./badges";
import { drawerOpen } from "./navState";
import ShellNav from "./ShellNav.vue";
import logoMark from "/assets/logo-mark.svg";

defineProps<{ mobile: boolean; avatar?: string }>();

const router = useRouter();
const route = useRoute();
const { blades, activeBlade } = useBladeStack();
const { menu, load, activeTitle } = useAdminMenu();
// the menu and its counters load with the layout, which is always there (the phone drawer mounts its nav on opening)
onMounted(() => {
  load();
  startBadges(menu);
});
const { environmentName, isIgnored } = useEnvironmentName();

const showBar = computed(() => blades.value.length <= 1);
// everything waiting in the menu, on the button that opens it
const waiting = computed(() => Object.values(badgeCounts.value).reduce((sum, n) => sum + n, 0));

// a blade's own title, else the menu item of the screen that's open (Dashboard, an app)
const title = computed(() => activeBlade.value?.title || activeTitle.value);

let closedByNavigation = false;
watch(
  () => route.fullPath,
  () => {
    closedByNavigation = drawerOpen.value;
    drawerOpen.value = false;
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
