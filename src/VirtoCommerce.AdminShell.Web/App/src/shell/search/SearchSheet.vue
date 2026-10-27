<template>
  <!-- Global search on a phone: a full-screen sheet with the box on top and the results under it -->
  <Teleport to="body">
    <Transition name="as-gs-sheet">
      <div
        v-if="searchSheetOpen"
        class="as-gs-sheet"
        role="dialog"
        aria-modal="true"
        :aria-label="$t('SHELL.SEARCH.LABEL')"
      >
        <div class="as-gs-sheet__bar">
          <button
            type="button"
            class="as-gs-sheet__back"
            :aria-label="$t('SHELL.SEARCH.CLOSE')"
            @click="close"
          >
            <VcIcon
              icon="lucide-arrow-left"
              size="l"
            />
          </button>
          <div class="as-gs-sheet__box">
            <VcIcon
              class="as-gs-sheet__icon"
              icon="lucide-search"
            />
            <input
              ref="input"
              v-model="box.query.value"
              class="as-gs-sheet__input"
              type="search"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              enterkeyhint="search"
              :placeholder="$t('SHELL.SEARCH.PLACEHOLDER')"
              :aria-label="$t('SHELL.SEARCH.LABEL')"
              role="combobox"
              aria-autocomplete="list"
              :aria-controls="listId"
              aria-expanded="true"
              :aria-activedescendant="panel?.activeOptionId"
              @input="box.onInput()"
              @keydown="box.onKeydown"
            />
            <button
              v-if="box.query.value"
              type="button"
              class="as-gs-sheet__clear"
              :aria-label="$t('SHELL.SEARCH.CLEAR')"
              @mousedown.prevent
              @click="clear"
            >
              <VcIcon
                icon="lucide-circle-x"
                size="m"
              />
            </button>
          </div>
        </div>
        <SearchPanel
          ref="panel"
          sheet
          :box="box"
          :list-id="listId"
        />
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { VcIcon } from "@vc-shell/framework/ui";
import { useEventListener } from "@vueuse/core";
import { nextTick, ref, watch } from "vue";
import { searchSheetOpen } from "../navState";
import SearchPanel from "./SearchPanel.vue";
import { useSearchBox } from "./useSearchBox";

const listId = "as-search-sheet-results";
const input = ref<HTMLInputElement>();
const panel = ref<InstanceType<typeof SearchPanel>>();

// the control that opened the sheet (the header's search button): focus returns there when the sheet closes, rather
// than to the page as the sheet's own input goes
let opener: HTMLElement | null = null;

function close() {
  searchSheetOpen.value = false;
}

const box = useSearchBox({ onClose: close });

function clear() {
  box.clear();
  input.value?.focus();
}

// the keyboard comes up with the sheet; the page under it doesn't scroll
watch(searchSheetOpen, async (isOpen) => {
  document.documentElement.classList.toggle("as-gs-sheet-open", isOpen);
  if (!isOpen) {
    const back = opener;
    opener = null;
    await nextTick();
    if (back?.isConnected) back.focus();
    return;
  }
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  await nextTick();
  input.value?.focus();
});

useEventListener(window, "keydown", (event: KeyboardEvent) => {
  if (searchSheetOpen.value && event.key === "Escape" && document.activeElement !== input.value) close();
});
</script>
