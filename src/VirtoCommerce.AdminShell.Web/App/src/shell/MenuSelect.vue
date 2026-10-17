<template>
  <!-- A select for the avatar's menu, drawn like vc-shell's select in a blade (field, list, check on the chosen one):
       the browser's own list can't be styled. A listbox: arrows, Home/End, Enter/Space, Escape and type-ahead. -->
  <div
    ref="root"
    class="as-ms"
    :class="{ 'as-ms--open': open }"
  >
    <button
      ref="field"
      type="button"
      class="as-um__select as-ms__field"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-label="`${label}: ${current?.label ?? ''}`"
      @click="open ? close() : show()"
      @keydown="onFieldKey"
    >
      <VcIcon
        v-if="icon"
        :icon="icon"
      />
      <span
        v-else-if="current?.swatch !== undefined"
        class="as-um__swatch"
        :class="current.swatch"
        :style="current.swatchStyle"
        aria-hidden="true"
      />
      <span class="as-ms__value">{{ current?.label }}</span>
      <VcIcon
        class="as-um__select-chevron"
        icon="lucide-chevron-down"
      />
    </button>
    <ul
      v-if="open"
      ref="list"
      class="as-ms__list"
      :style="place"
      role="listbox"
      tabindex="-1"
      :aria-label="label"
      :aria-activedescendant="`${uid}-${active}`"
      @keydown="onListKey"
    >
      <li
        v-for="(option, i) in options"
        :id="`${uid}-${i}`"
        :key="option.value"
        role="option"
        class="as-ms__option"
        :class="{ 'as-ms__option--active': i === active }"
        :aria-selected="option.value === modelValue"
        @click="choose(option)"
        @mousemove="active = i"
      >
        <span
          v-if="option.swatch !== undefined"
          class="as-um__swatch"
          :class="option.swatch"
          :style="option.swatchStyle"
          aria-hidden="true"
        />
        <span class="as-ms__label">{{ option.label }}</span>
        <VcIcon
          v-if="option.value === modelValue"
          class="as-ms__check"
          icon="lucide-check"
        />
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { VcIcon } from "@vc-shell/framework/ui";
import { onClickOutside, useEventListener } from "@vueuse/core";
import { computed, nextTick, ref, useId, type CSSProperties } from "vue";

export interface MenuSelectOption {
  value: string;
  label: string;
  /** classes of a color dot before the label (as-um__swatch modifiers) */
  swatch?: string;
  /** the dot's colors as variables (--as-swatch-light, --as-swatch-dark), for a theme file's theme */
  swatchStyle?: Record<string, string>;
}

const props = defineProps<{
  modelValue: string;
  options: MenuSelectOption[];
  /** what is chosen, for screen readers */
  label: string;
  /** an icon in the field instead of the chosen option's swatch */
  icon?: string;
}>();
const emit = defineEmits<{ (e: "update:modelValue", value: string): void }>();

const uid = useId();
const root = ref<HTMLElement>();
const field = ref<HTMLButtonElement>();
const list = ref<HTMLElement>();
const open = ref(false);
// fixed to the window, under the field or over it when it wouldn't fit below (the avatar's menu sits at the bottom of
// the rail); the menu clips its content, so the list is drawn outside it
const place = ref<CSSProperties>({});
const active = ref(0);

const current = computed(() => props.options.find((o) => o.value === props.modelValue));
const selectedIndex = () => {
  const index = props.options.findIndex((o) => o.value === props.modelValue);
  return Math.max(0, index);
};

async function show(at = selectedIndex()) {
  active.value = at;
  open.value = true;
  const rect = field.value?.getBoundingClientRect();
  if (!rect) return;
  place.value = { left: `${rect.left}px`, top: `${rect.bottom + 4}px`, minWidth: `${rect.width}px` };
  await nextTick();
  const height = list.value?.offsetHeight ?? 0;
  if (rect.bottom + 4 + height > window.innerHeight && rect.top - 4 - height >= 0) {
    place.value = { ...place.value, top: "auto", bottom: `${window.innerHeight - rect.top + 4}px` };
  }
  // no scrolling of the containers: the avatar's menu clips its content, and scrolling it would hide its top
  list.value?.focus({ preventScroll: true });
  scrollActive();
}

function close(focusField = true) {
  if (!open.value) return;
  open.value = false;
  if (focusField) field.value?.focus({ preventScroll: true });
}

function choose(option: MenuSelectOption) {
  if (option.value !== props.modelValue) emit("update:modelValue", option.value);
  close();
}

// keeps the active option in view by scrolling the list only (scrollIntoView would scroll the menu around it too)
function scrollActive() {
  const box = list.value;
  const option = box?.children[active.value] as HTMLElement | undefined;
  if (!box || !option) return;
  if (option.offsetTop < box.scrollTop) box.scrollTop = option.offsetTop;
  else if (option.offsetTop + option.offsetHeight > box.scrollTop + box.clientHeight)
    box.scrollTop = option.offsetTop + option.offsetHeight - box.clientHeight;
}

function move(to: number) {
  active.value = (to + props.options.length) % props.options.length;
  scrollActive();
}

// type-ahead: letters typed within a second pick the next option starting with them
let typed = "";
let typedAt = 0;
function typeAhead(key: string) {
  const now = Date.now();
  typed = now - typedAt > 1000 ? key : typed + key;
  typedAt = now;
  const starts = (o: MenuSelectOption) => o.label.toLowerCase().startsWith(typed.toLowerCase());
  const from = typed.length === 1 ? active.value + 1 : active.value;
  const ordered = [...props.options.slice(from), ...props.options.slice(0, from)];
  const found = ordered.find(starts);
  if (found) move(props.options.indexOf(found));
}

function onFieldKey(event: KeyboardEvent) {
  if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
    event.preventDefault();
    show();
  }
}

function onListKey(event: KeyboardEvent) {
  const keys: Record<string, () => void> = {
    ArrowDown: () => move(active.value + 1),
    ArrowUp: () => move(active.value - 1),
    Home: () => move(0),
    End: () => move(props.options.length - 1),
    Enter: () => choose(props.options[active.value]),
    " ": () => choose(props.options[active.value]),
    // the list closes, not the avatar's menu around it
    Escape: () => close(),
  };
  if (keys[event.key]) {
    event.preventDefault();
    event.stopPropagation();
    keys[event.key]();
  } else if (event.key === "Tab") {
    close(false);
  } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    typeAhead(event.key);
  }
}

onClickOutside(root, () => close(false));
// a fixed list would stay behind when the menu scrolls or the window changes: it closes instead
useEventListener(window, "resize", () => close(false));
useEventListener(
  window,
  "scroll",
  (event: Event) => {
    if (event.target !== list.value) close(false);
  },
  { capture: true, passive: true },
);
</script>
