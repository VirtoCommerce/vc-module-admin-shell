<template>
  <!-- Jump to any screen in the menu: in the header on desktop, at the top of the phone drawer -->
  <div class="as-search">
    <VcIcon
      class="as-search__icon"
      icon="lucide-search"
    />
    <input
      ref="input"
      v-model="query"
      class="as-search__input"
      type="search"
      :placeholder="$t('SHELL.NAV.JUMP_TO')"
      :aria-label="$t('SHELL.NAV.JUMP_TO')"
      role="combobox"
      aria-controls="as-search-results"
      :aria-expanded="results.length > 0"
      @keydown.down.prevent="move(1)"
      @keydown.up.prevent="move(-1)"
      @keydown.enter.prevent="pick(results[cursor])"
      @keydown.esc="query = ''"
    />
    <kbd
      v-if="!query && shortcut"
      class="as-search__kbd"
      >{{ shortcutLabel }}</kbd
    >
    <ul
      v-if="results.length"
      id="as-search-results"
      class="as-search__results"
      role="listbox"
    >
      <li
        v-for="(result, index) in results"
        :key="result.item.id"
        role="option"
        :aria-selected="index === cursor"
        class="as-search__result"
        :class="{ 'as-search__result--active': index === cursor }"
        @mousedown.prevent="pick(result)"
        @mouseenter="cursor = index"
      >
        <span>{{ result.item.title }}</span>
        <span class="as-search__where">{{ result.where }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { isTextInputFocused, matchesEvent, useKeyboardShortcuts } from "@vc-shell/framework";
import { VcIcon } from "@vc-shell/framework/ui";
import { useEventListener } from "@vueuse/core";
import { computed, ref, watch } from "vue";
import type { MenuItem } from "../api/adminMenu";
import { useAdminMenu } from "../composables/useAdminMenu";

/** shortcut: Ctrl/Cmd+K focuses this search (the header's; a phone has no keyboard shortcut) */
const props = defineProps<{ shortcut?: boolean }>();
const emit = defineEmits<{ (e: "picked"): void }>();

const { menu, open } = useAdminMenu();

const input = ref<HTMLInputElement>();
const query = ref("");
const cursor = ref(0);
const results = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return [];
  const found: { item: MenuItem; where: string }[] = [];
  for (const section of menu.value.sections) {
    for (const item of section.items) {
      if (item.title.toLowerCase().includes(q)) found.push({ item, where: section.title });
      for (const child of item.children ?? []) {
        if (child.title.toLowerCase().includes(q)) found.push({ item: child, where: `${section.title} · ${item.title}` });
      }
    }
  }
  return found.slice(0, 8);
});
watch(query, () => (cursor.value = 0));

const move = (step: number) => {
  if (results.value.length) cursor.value = (cursor.value + step + results.value.length) % results.value.length;
};

function pick(result?: { item: MenuItem }) {
  if (!result) return;
  open(result.item);
  query.value = "";
  input.value?.blur();
  emit("picked");
}

const { hotkey, isMac, formatShortcut } = useKeyboardShortcuts();
const shortcutLabel = formatShortcut(hotkey.mod.k).parts.join(" ");
useEventListener(window, "keydown", (event: KeyboardEvent) => {
  if (!props.shortcut || !matchesEvent(hotkey.mod.k, event, isMac)) return;
  // an editor's own Ctrl+K (insert link) stays the editor's
  if (isTextInputFocused() && document.activeElement !== input.value) return;
  event.preventDefault();
  input.value?.focus();
});
</script>
