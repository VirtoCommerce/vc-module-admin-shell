<template>
  <!--
    Global search. In the header: the box, with the results in a dropdown under it (Ctrl/Cmd+K focuses it).
    trigger: a box-shaped button that opens the phone's search sheet (in the phone drawer).
  -->
  <button
    v-if="trigger && available"
    type="button"
    class="as-search as-search--trigger"
    @click="emit('open-sheet')"
  >
    <VcIcon
      class="as-search__icon"
      icon="lucide-search"
    />
    <span class="as-search__placeholder">{{ $t("SHELL.SEARCH.PLACEHOLDER") }}</span>
  </button>
  <div
    v-else-if="available"
    ref="root"
    class="as-search"
    :class="{ 'as-search--open': open }"
  >
    <VcIcon
      class="as-search__icon"
      icon="lucide-search"
    />
    <input
      ref="input"
      v-model="box.query.value"
      class="as-search__input"
      type="text"
      autocomplete="off"
      spellcheck="false"
      enterkeyhint="search"
      :placeholder="$t('SHELL.SEARCH.PLACEHOLDER')"
      :aria-label="$t('SHELL.SEARCH.LABEL')"
      role="combobox"
      aria-autocomplete="list"
      :aria-controls="listId"
      :aria-expanded="open"
      :aria-activedescendant="open ? panel?.activeOptionId : undefined"
      @input="onInput"
      @focus="open = true"
      @keydown="onKeydown"
    />
    <button
      v-if="box.query.value"
      type="button"
      class="as-search__clear"
      :aria-label="$t('SHELL.SEARCH.CLEAR')"
      :title="$t('SHELL.SEARCH.CLEAR')"
      @mousedown.prevent
      @click="clear"
    >
      <VcIcon
        icon="lucide-x"
        size="s"
      />
    </button>
    <kbd
      v-else-if="shortcut && !open"
      class="as-search__kbd"
      >{{ shortcutLabel }}</kbd
    >
    <Transition name="as-search-drop">
      <SearchPanel
        v-if="open"
        ref="panel"
        class="as-search__drop"
        :style="dropStyle"
        :box="box"
        :list-id="listId"
      />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { isTextInputFocused, matchesEvent, useKeyboardShortcuts } from "@vc-shell/framework";
import { VcIcon } from "@vc-shell/framework/ui";
import { onClickOutside, useElementBounding, useEventListener, useWindowSize } from "@vueuse/core";
import { computed, onMounted, ref, watch } from "vue";
import { globalSearch } from "./search/globalSearch";
import SearchPanel from "./search/SearchPanel.vue";
import { useSearchBox, type SearchCloseReason } from "./search/useSearchBox";

/** shortcut: Ctrl/Cmd+K focuses this box (the header's); trigger: render the button that opens the phone sheet */
const props = defineProps<{ shortcut?: boolean; trigger?: boolean }>();
const emit = defineEmits<{ (e: "open-sheet"): void }>();

const listId = "as-search-results";
const root = ref<HTMLElement>();
const input = ref<HTMLInputElement>();
const panel = ref<InstanceType<typeof SearchPanel>>();
const open = ref(false);

// hidden when there is nothing the user may search
const available = computed(() => globalSearch.usableProviders().length > 0);

// The dropdown, placed from where the box is: under it, right-aligned to it when there is room, else moved to stay in
// the workspace (with a blade open the header lists the blade path and the box sits further left), as tall as the window
// lets it be. Fixed, so nothing around the header clips it.
const DROP_WIDTH = 620;
const EDGE = 16;
const bounds = useElementBounding(root);
const workspace = ref<HTMLElement | null>(null);
const area = useElementBounding(workspace);
const viewport = useWindowSize();
onMounted(() => (workspace.value = document.querySelector<HTMLElement>(".as-workspace")));
// the blade path can move the box without resizing it: measure again on opening
watch(open, (isOpen) => {
  if (!isOpen) return;
  bounds.update();
  area.update();
});
const dropStyle = computed(() => {
  const minLeft = (workspace.value ? area.left.value : 0) + EDGE;
  const maxRight = (workspace.value ? Math.min(area.right.value, viewport.width.value) : viewport.width.value) - EDGE;
  const width = Math.max(Math.min(DROP_WIDTH, maxRight - minLeft), 0);
  const left = Math.min(Math.max(bounds.right.value - width, minLeft), maxRight - width);
  const top = bounds.bottom.value + 8;
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    maxHeight: `${Math.min(640, viewport.height.value - top - EDGE)}px`,
  };
});

// where focus was when Ctrl+K brought it to the box: Escape returns it there
let returnFocus: HTMLElement | null = null;

/**
 * Escape closes the dropdown and keeps focus: back where Ctrl+K took it from, else in the box (the combobox keeps it,
 * as the ARIA pattern has it). A chosen result or a press outside lets focus go with the user.
 */
function close(reason: SearchCloseReason | "outside" = "outside") {
  open.value = false;
  const back = returnFocus;
  returnFocus = null;
  if (reason !== "escape") {
    input.value?.blur();
    return;
  }
  if (back?.isConnected && back !== input.value) back.focus();
  else input.value?.focus();
}

const box = useSearchBox({ onClose: close });

function onInput() {
  open.value = true;
  box.onInput();
}

function onKeydown(event: KeyboardEvent) {
  if (!open.value && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
    open.value = true;
    return;
  }
  box.onKeydown(event);
}

function clear() {
  box.clear();
  input.value?.focus();
}

// a press outside closes the dropdown; the query stays, and focusing the box shows its results again
onClickOutside(root, () => {
  if (open.value) close();
});

const { hotkey, isMac, formatShortcut } = useKeyboardShortcuts();
const shortcutLabel = formatShortcut(hotkey.mod.k).parts.join(" ");
useEventListener(window, "keydown", (event: KeyboardEvent) => {
  // the box handles its own keys; Escape elsewhere (focus moved off the box) still closes the open dropdown
  if (event.key === "Escape" && open.value && document.activeElement !== input.value) {
    close("escape");
    return;
  }
  if (!props.shortcut || !available.value || !matchesEvent(hotkey.mod.k, event, isMac)) return;
  // an editor's own Ctrl+K (insert link) stays the editor's
  if (isTextInputFocused() && document.activeElement !== input.value) return;
  event.preventDefault();
  if (document.activeElement !== input.value && document.activeElement instanceof HTMLElement) {
    returnFocus = document.activeElement;
  }
  open.value = true;
  input.value?.focus();
  input.value?.select();
});
</script>
