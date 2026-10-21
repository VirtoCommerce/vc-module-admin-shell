<template>
  <!-- Above the blades: the open stack as a path (only its last two blades are on screen), jump-to search, environment -->
  <header class="as-header">
    <button
      v-if="!panelOpen"
      type="button"
      class="as-header__menu"
      :title="$t('SHELL.NAV.SHOW_MENU')"
      @click="panelOpen = true"
    >
      <VcIcon icon="lucide-panel-left-open" />
      {{ sectionTitle }}
    </button>
    <nav
      v-if="crumbs.length"
      class="as-crumbs"
      :aria-label="$t('SHELL.NAV.OPEN_BLADES')"
    >
      <template
        v-for="(crumb, index) in crumbs"
        :key="crumb.id"
      >
        <VcIcon
          v-if="index"
          class="as-crumbs__sep"
          icon="lucide-chevron-right"
        />
        <button
          type="button"
          class="as-crumbs__item"
          :class="{ 'as-crumbs__item--shown': crumb.shown, 'as-crumbs__item--current': crumb.current }"
          :aria-current="crumb.current ? 'page' : undefined"
          @click="crumb.current || closeChildren(crumb.id)"
        >
          {{ crumb.title }}
        </button>
      </template>
    </nav>
    <span class="as-header__spacer" />

    <ShellSearch shortcut />
  </header>
</template>

<script setup lang="ts">
import { useBladeStack } from "@vc-shell/framework";
import type { BladeDescriptor } from "@vc-shell/framework";
import { VcIcon } from "@vc-shell/framework/ui";
import { computed } from "vue";
import { useAdminMenu } from "../composables/useAdminMenu";
import { panelOpen, panelSection } from "./navState";
import ShellSearch from "./ShellSearch.vue";

const { blades, closeChildren } = useBladeStack();
const { menu } = useAdminMenu();

const sectionTitle = computed(() => menu.value.sections.find((s) => s.id === panelSection.value)?.title);

// vc-shell shows the last two blades side by side (one while its AI panel is open; not used here)
const VISIBLE_BLADES = 2;
const crumbs = computed(() => {
  const stack: BladeDescriptor[] = blades.value.filter((b: BladeDescriptor) => b.visible);
  return stack.map((b, i) => ({
    id: b.id,
    title: b.title ?? b.name,
    shown: i >= stack.length - VISIBLE_BLADES,
    current: i === stack.length - 1,
  }));
});

</script>
