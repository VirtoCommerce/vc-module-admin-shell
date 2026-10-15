<template>
  <!-- The results of a search box, grouped by provider; under the header's box (dropdown) or in the phone's sheet -->
  <div
    class="as-gs"
    :class="{ 'as-gs--sheet': sheet }"
  >
    <!-- scoped to one group ("orders: …"): say so, with a way back to everything -->
    <div
      v-if="box.scope.value"
      class="as-gs__scope"
    >
      <span>{{ $t("SHELL.SEARCH.SEARCHING_IN") }}</span>
      <button
        type="button"
        class="as-gs__chip as-gs__chip--on"
        :aria-label="$t('SHELL.SEARCH.SEARCH_EVERYWHERE')"
        :title="$t('SHELL.SEARCH.SEARCH_EVERYWHERE')"
        @mousedown.prevent
        @click="box.unscope()"
      >
        <VcIcon
          v-if="box.scope.value.icon"
          :icon="box.scope.value.icon"
          size="s"
        />
        {{ titleOf(box.scope.value) }}
        <VcIcon
          icon="lucide-x"
          size="xs"
        />
      </button>
    </div>

    <div
      :id="listId"
      ref="body"
      class="as-gs__body"
      role="listbox"
      :aria-label="$t('SHELL.SEARCH.RESULTS')"
    >
      <!-- nothing typed yet: where the user can search -->
      <div
        v-if="!typed"
        class="as-gs__intro"
      >
        <div class="as-gs__label">
          {{ $t(box.scope.value ? "SHELL.SEARCH.TYPE_TO_SEARCH" : "SHELL.SEARCH.SEARCH_IN") }}
        </div>
        <div
          v-if="!box.scope.value"
          class="as-gs__chips"
        >
          <button
            v-for="provider in box.scopes.value"
            :key="provider.id"
            type="button"
            class="as-gs__chip"
            @mousedown.prevent
            @click="box.scopeTo(provider)"
          >
            <VcIcon
              v-if="provider.icon"
              :icon="provider.icon"
              size="s"
            />
            {{ titleOf(provider) }}
          </button>
        </div>
        <p
          v-if="!box.scope.value"
          class="as-gs__tip"
        >
          <i18n-t
            keypath="SHELL.SEARCH.TIP_SCOPE"
            scope="global"
          >
            <template #example>
              <kbd class="as-gs__kbd">{{ exampleAlias }}:</kbd>
            </template>
          </i18n-t>
        </p>
      </div>

      <!-- typed, all answered, nothing found -->
      <div
        v-else-if="!box.groups.value.length && !box.loading.value"
        class="as-gs__empty"
      >
        <VcIcon
          class="as-gs__empty-icon"
          icon="lucide-search-x"
          size="xl"
        />
        <div class="as-gs__empty-title">{{ $t("SHELL.SEARCH.NO_RESULTS", { query: box.answered.value }) }}</div>
        <div class="as-gs__empty-hint">
          {{ $t(box.scope.value ? "SHELL.SEARCH.NO_RESULTS_SCOPED" : "SHELL.SEARCH.NO_RESULTS_HINT") }}
        </div>
      </div>

      <!-- typed, the first answers still on their way -->
      <div
        v-else-if="!box.groups.value.length"
        class="as-gs__empty as-gs__empty--busy"
      >
        <VcIcon
          class="as-gs__spinner"
          icon="lucide-loader-circle"
        />
        {{ $t("SHELL.SEARCH.SEARCHING") }}
      </div>

      <section
        v-for="group in box.groups.value"
        :key="group.provider.id"
        class="as-gs__group"
        role="group"
        :aria-labelledby="`${listId}-${group.provider.id}`"
      >
        <header class="as-gs__head">
          <span
            :id="`${listId}-${group.provider.id}`"
            class="as-gs__head-title"
            >{{ group.title }}</span
          >
          <span
            v-if="group.status === 'pending'"
            class="as-gs__status"
          >
            <VcIcon
              class="as-gs__spinner"
              icon="lucide-loader-circle"
              size="xs"
            />
            {{ $t("SHELL.SEARCH.SEARCHING") }}
          </span>
          <span
            v-else-if="group.status === 'error'"
            class="as-gs__status as-gs__status--error"
          >
            <VcIcon
              icon="lucide-circle-alert"
              size="xs"
            />
            {{ $t("SHELL.SEARCH.FAILED") }}
            <button
              type="button"
              class="as-gs__retry"
              @mousedown.prevent
              @click="box.retry(group)"
            >
              {{ $t("SHELL.SEARCH.RETRY") }}
            </button>
          </span>
          <span
            v-else-if="group.total !== null"
            class="as-gs__status"
            >{{ formatCount(group.total) }}</span
          >
        </header>

        <div
          v-for="item in group.items"
          :id="optionId(group, item.id)"
          :key="item.id"
          class="as-gs__row"
          :class="{ 'as-gs__row--active': box.activeKey.value === keyOf(group, item.id) }"
          role="option"
          :aria-selected="box.activeKey.value === keyOf(group, item.id)"
          @mousedown.prevent
          @mousemove="hover(keyOf(group, item.id))"
          @click="box.select(entryOf(group, item.id))"
        >
          <span class="as-gs__tile">
            <img
              v-if="item.iconUrl && !broken.has(item.iconUrl)"
              :src="item.iconUrl"
              alt=""
              loading="lazy"
              @error="broken.add(item.iconUrl)"
            />
            <VcIcon
              v-else
              :icon="item.icon || group.provider.icon || 'lucide-circle-dot'"
              size="m"
            />
          </span>
          <span class="as-gs__text">
            <span class="as-gs__title">
              <template
                v-for="(part, index) in highlight(item.title, box.answered.value)"
                :key="index"
              >
                <mark v-if="part.mark">{{ part.text }}</mark>
                <template v-else>{{ part.text }}</template>
              </template>
            </span>
            <span
              v-if="item.description"
              class="as-gs__descr"
            >
              <template
                v-for="(part, index) in highlight(item.description, box.answered.value)"
                :key="index"
              >
                <mark v-if="part.mark">{{ part.text }}</mark>
                <template v-else>{{ part.text }}</template>
              </template>
            </span>
          </span>
          <span
            v-if="item.badge || item.meta"
            class="as-gs__aside"
          >
            <span
              v-if="item.badge"
              class="as-gs__badge"
              >{{ item.badge }}</span
            >
            <span
              v-if="item.meta"
              class="as-gs__meta"
              >{{ item.meta }}</span
            >
          </span>
          <VcIcon
            v-if="item.external"
            class="as-gs__external"
            icon="lucide-external-link"
            size="s"
            :title="$t('SHELL.NAV.NEW_TAB')"
          />
          <VcIcon
            v-else
            class="as-gs__enter"
            icon="lucide-corner-down-left"
            size="s"
          />
        </div>

        <div
          v-if="box.hasShowAll(group)"
          :id="optionId(group, '*')"
          class="as-gs__row as-gs__row--all"
          :class="{ 'as-gs__row--active': box.activeKey.value === keyOf(group, '*') }"
          role="option"
          :aria-selected="box.activeKey.value === keyOf(group, '*')"
          @mousedown.prevent
          @mousemove="hover(keyOf(group, '*'))"
          @click="box.select(entryOf(group, '*'))"
        >
          <span class="as-gs__tile as-gs__tile--plain">
            <VcIcon
              icon="lucide-list"
              size="m"
            />
          </span>
          <span class="as-gs__text">
            <span class="as-gs__title">{{
              $t("SHELL.SEARCH.SHOW_ALL", { count: formatCount(group.total!), group: group.title })
            }}</span>
          </span>
          <VcIcon
            class="as-gs__enter"
            icon="lucide-arrow-right"
            size="s"
          />
        </div>
      </section>
    </div>

    <footer
      v-if="!sheet"
      class="as-gs__foot"
    >
      <span><kbd class="as-gs__kbd">↑</kbd><kbd class="as-gs__kbd">↓</kbd>{{ $t("SHELL.SEARCH.KEYS_MOVE") }}</span>
      <span><kbd class="as-gs__kbd">↵</kbd>{{ $t("SHELL.SEARCH.KEYS_OPEN") }}</span>
      <span><kbd class="as-gs__kbd">Esc</kbd>{{ $t("SHELL.SEARCH.KEYS_CLOSE") }}</span>
      <span
        v-if="box.loading.value"
        class="as-gs__foot-busy"
      >
        <VcIcon
          class="as-gs__spinner"
          icon="lucide-loader-circle"
          size="xs"
        />
      </span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { VcIcon } from "@vc-shell/framework/ui";
import { computed, nextTick, reactive, ref, watch } from "vue";
import { globalSearch, highlight, type SearchGroup, type SearchProvider } from "./globalSearch";
import type { SearchBox } from "./useSearchBox";

const props = defineProps<{ box: SearchBox; listId: string; sheet?: boolean }>();

const body = ref<HTMLElement>();
// thumbnails that failed to load show the icon instead
const broken = reactive(new Set<string>());

const typed = computed(() => !!props.box.parsed.value.text);
// the tip's example: Orders when the user can search orders, else the last group they can
const exampleAlias = computed(() => {
  const scopes = props.box.scopes.value;
  return (scopes.find((p) => p.id === "orders") ?? scopes[scopes.length - 1])?.aliases?.[0] ?? "menu";
});

const titleOf = (provider: SearchProvider) => globalSearch.translate(provider.title);
const keyOf = (group: SearchGroup, id: string) => `${group.provider.id}\u0000${id}`;
const entryOf = (group: SearchGroup, id: string) => props.box.entries.value.find((x) => x.key === keyOf(group, id));
const optionId = (group: SearchGroup, id: string) =>
  `${props.listId}-o${props.box.entries.value.findIndex((x) => x.key === keyOf(group, id))}`;

const numberFormat = new Intl.NumberFormat();
const formatCount = (n: number) => numberFormat.format(n);

// the mouse picks the row only when it moves (a list arriving under a still pointer doesn't steal the keyboard's row)
const hover = (key: string) => props.box.setActive(key);

/** The id of the highlighted row, for the input's aria-activedescendant */
const activeOptionId = computed(() => {
  const index = props.box.entries.value.findIndex((x) => x.key === props.box.activeKey.value);
  return index < 0 ? undefined : `${props.listId}-o${index}`;
});
defineExpose({ activeOptionId });

// keep the highlighted row in view as the arrows move it
watch(
  () => props.box.activeKey.value,
  async () => {
    await nextTick();
    body.value?.querySelector(".as-gs__row--active")?.scrollIntoView({ block: "nearest" });
  },
);
</script>
