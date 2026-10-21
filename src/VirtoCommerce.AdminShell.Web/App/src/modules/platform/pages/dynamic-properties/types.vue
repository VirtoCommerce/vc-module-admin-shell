<template>
  <VcBlade
    :title="$t('PLATFORM.DYNAMIC.TITLE')"
    :toolbar-items="toolbar"
    :loading="loading"
    width="70%"
  >
    <!-- Laid out as the settings screen (pages/settings/list.vue, whose ps-* styles it shares): the object types as a
         tree by module, the properties of the chosen node as cards. Narrow (a phone): the tree, then the properties. -->
    <div
      ref="root"
      class="ps"
      :class="{ 'ps--narrow': narrow, 'ps--detail': narrow && detail }"
    >
      <div class="ps__bar">
        <label class="ps__search">
          <VcIcon
            class="ps__search-icon"
            icon="lucide-search"
            size="s"
          />
          <input
            v-model="keyword"
            type="search"
            class="ps__search-input"
            :placeholder="$t('PLATFORM.DYNAMIC.SEARCH')"
            :aria-label="$t('PLATFORM.DYNAMIC.SEARCH')"
          />
          <button
            v-if="keyword"
            type="button"
            class="ps__icon-btn"
            :title="$t('PLATFORM.SETTINGS.LIST.CLEAR')"
            :aria-label="$t('PLATFORM.SETTINGS.LIST.CLEAR')"
            @click="keyword = ''"
          >
            <VcIcon
              icon="lucide-x"
              size="s"
            />
          </button>
        </label>
        <!-- the filters in a panel behind a button, as vc-shell's tables have them (VcDataTable global filters) -->
        <span ref="filterAnchor">
          <!-- icon only: the name is for screen readers and the tooltip; the badge counts the filters in force -->
          <VcButton
            class="as-filter-button"
            variant="secondary"
            size="sm"
            icon="lucide-funnel"
            :title="$t('COMPONENTS.ORGANISMS.VC_TABLE.GLOBAL_FILTERS.BUTTON')"
            :aria-label="$t('COMPONENTS.ORGANISMS.VC_TABLE.GLOBAL_FILTERS.BUTTON')"
            :aria-expanded="filtersOpen"
            @click="openFilters"
          >
            <span
              v-if="activeFilterCount"
              class="vc-global-filters-button__badge"
              >{{ activeFilterCount }}</span
            >
          </VcButton>
        </span>
        <VcPopover
          v-model:show="filtersOpen"
          :anchor-ref="filterAnchor"
          :title="$t('COMPONENTS.ORGANISMS.VC_TABLE.GLOBAL_FILTERS.TITLE')"
          placement="bottom-end"
          :max-height="480"
        >
          <div class="vc-global-filters-panel__content pdp-filters">
            <label class="pdp-filters__row">
              <VcSwitch v-model="draft.withProperties" />
              <span>{{ $t("PLATFORM.DYNAMIC.WITH_PROPERTIES") }}</span>
            </label>
            <label
              v-for="flag in FLAGS"
              :key="flag.key"
              class="pdp-filters__row"
            >
              <VcSwitch v-model="draft.flags[flag.key]" />
              <span>{{ $t(flag.label) }}</span>
              <span class="pdp-filters__count">{{ flagCount(flag.key) }}</span>
            </label>
          </div>
          <template #footer>
            <VcButton
              variant="outline"
              size="sm"
              @click="clearFilterPanel"
            >
              {{ $t("COMPONENTS.ORGANISMS.VC_TABLE.COLUMN_FILTER.CLEAR") }}
            </VcButton>
            <VcButton
              size="sm"
              @click="applyFilters"
            >
              {{ $t("COMPONENTS.ORGANISMS.VC_TABLE.COLUMN_FILTER.APPLY") }}
            </VcButton>
          </template>
        </VcPopover>
      </div>

      <div class="ps__body">
        <nav
          class="ps__tree"
          role="tree"
          :aria-label="$t('PLATFORM.DYNAMIC.OBJECT_TYPES')"
          @keydown="onTreeKey"
        >
          <div
            v-for="row in rows"
            :key="row.id"
            :ref="(el) => setRowRef(row.id, el)"
            class="ps-node"
            :class="{ 'ps-node--selected': row.id === selected }"
            :style="{ '--depth': row.depth }"
            role="treeitem"
            :aria-level="row.depth + 1"
            :aria-selected="row.id === selected"
            :aria-expanded="row.children.length && row.depth > 0 ? isExpanded(row) : undefined"
            :title="row.typeId"
            :tabindex="row.id === (focused ?? selected) ? 0 : -1"
            @click="select(row)"
            @focus="focused = row.id"
          >
            <button
              v-if="row.children.length && row.depth > 0"
              type="button"
              class="ps-node__toggle"
              tabindex="-1"
              :aria-label="
                isExpanded(row) ? $t('PLATFORM.SETTINGS.LIST.COLLAPSE') : $t('PLATFORM.SETTINGS.LIST.EXPAND')
              "
              @click.stop="toggle(row)"
            >
              <VcIcon
                icon="lucide-chevron-right"
                size="s"
                :class="{ 'ps-node__chevron--open': isExpanded(row) }"
              />
            </button>
            <span
              v-else
              class="ps-node__toggle ps-node__toggle--leaf"
            >
              <VcIcon
                v-if="row.depth !== 1"
                :icon="row.depth === 0 ? 'lucide-layers' : TYPE_ICON"
                size="s"
              />
            </span>
            <span
              class="ps-node__label"
              :class="{ 'pdp-node__label--empty': row.depth === 2 && !row.count }"
              >{{ row.label }}</span
            >
            <span class="ps-node__count">{{ row.count }}</span>
            <VcIcon
              v-if="narrow"
              class="ps-node__go"
              icon="lucide-chevron-right"
              size="s"
            />
          </div>
        </nav>

        <section
          ref="panel"
          class="ps__props pdp-panel"
          :aria-label="currentTitle"
        >
          <button
            v-if="narrow"
            type="button"
            class="ps__back"
            @click="detail = false"
          >
            <VcIcon
              icon="lucide-chevron-left"
              size="s"
            />
            <span>{{ currentTitle }}</span>
          </button>

          <div
            v-if="!sections.length && !emptyTypes.length && !loading"
            class="ps__empty"
          >
            <VcIcon
              icon="lucide-search-x"
              size="xl"
            />
            <p>{{ $t("PLATFORM.DYNAMIC.NOTHING_FOUND") }}</p>
            <VcButton
              v-if="filtered"
              variant="outline"
              size="sm"
              @click="clearFilters"
            >
              {{ $t("PLATFORM.SETTINGS.LIST.CLEAR_FILTERS") }}
            </VcButton>
          </div>

          <div
            v-for="section in sections"
            :key="section.type.id"
            class="ps-section"
            :data-type="section.type.id"
          >
            <h3 class="ps-section__title">
              <span class="ps-section__path">
                <span>{{ section.type.module }}</span>
                <VcIcon
                  class="ps-section__sep"
                  icon="lucide-chevron-right"
                  size="xs"
                />
                <VcIcon
                  class="pdp-section__icon"
                  :icon="TYPE_ICON"
                  size="s"
                />
                <span>{{ section.type.label }}</span>
              </span>
              <code
                class="ps-section__module pdp-section__code"
                :title="section.type.id"
                >{{ section.type.shortId }}</code
              >
              <VcButton
                v-if="canCreate"
                class="pdp-section__add"
                variant="ghost"
                size="sm"
                icon="lucide-plus"
                @click="openProperty(section.type.id)"
              >
                {{ $t("PLATFORM.DYNAMIC.ADD_PROPERTY") }}
              </VcButton>
            </h3>

            <p
              v-if="!section.properties.length"
              class="pdp-section__none"
            >
              {{ $t("PLATFORM.DYNAMIC.NO_PROPERTIES_YET") }}
            </p>

            <button
              v-for="p in section.properties"
              :key="p.id"
              type="button"
              class="ps-prop pdp-prop"
              :class="{ 'pdp-prop--active': p.id === activeId }"
              @click="openProperty(section.type.id, p.id)"
            >
              <span class="ps-prop__head">
                <span class="ps-prop__heading">
                  <span class="ps-prop__title">{{ propertyTitle(p) }}</span>
                  <span class="ps-tag pdp-tag--type">
                    <VcIcon
                      :icon="VALUE_TYPE_ICONS[p.valueType ?? ''] ?? 'lucide-type'"
                      size="xs"
                    />{{ $t(`PLATFORM.DYNAMIC.VALUE_TYPES.${p.valueType ?? "Undefined"}`) }}
                  </span>
                  <span
                    v-for="flag in flagsOf(p)"
                    :key="flag.key"
                    class="ps-tag"
                    >{{ $t(flag.label) }}</span
                  >
                </span>
                <VcIcon
                  class="pdp-prop__go"
                  icon="lucide-chevron-right"
                  size="s"
                />
              </span>
              <span
                v-if="p.description"
                class="ps-prop__description"
                >{{ p.description }}</span
              >
              <code
                v-if="propertyTitle(p) !== p.name"
                class="ps-prop__name"
                >{{ p.name }}</code
              >
            </button>
          </div>
          <div
            v-if="emptyTypes.length"
            class="ps-section"
          >
            <h3 class="ps-section__title">
              <span class="ps-section__path">{{ $t("PLATFORM.DYNAMIC.WITHOUT_PROPERTIES") }}</span>
            </h3>
            <div class="pdp-empty-types">
              <button
                v-for="type in emptyTypes"
                :key="type.id"
                type="button"
                class="ps-chip"
                :title="type.id"
                @click="selectType(type.id)"
              >
                {{ type.module }} › {{ type.label }}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  </VcBlade>
</template>

<script setup lang="ts">
import {
  DynamicPropertiesClient,
  useApiClient,
  useAsync,
  useBlade,
  usePermissions,
  type DynamicProperty,
  type IBladeToolbar,
} from "@vc-shell/framework";
import { VcBlade, VcButton, VcIcon, VcPopover, VcSwitch } from "@vc-shell/framework/ui";
import { useElementSize } from "@vueuse/core";
import { computed, nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { refreshItem } from "../../composables/blade";

defineBlade({
  url: "/dynamic-properties",
  name: "PlatformDynamicProperties",
  isWorkspace: true,
  permissions: ["platform:dynamic_properties:access"],
});

/** An object type, named for people: "VirtoCommerce.OrdersModule.Core.Model.CustomerOrder" is Orders › Customer order */
interface ObjectType {
  id: string;
  module: string;
  label: string;
  /** the class name, for telling types of the same name apart (Cart's and Orders' LineItem) */
  shortId: string;
}

/** The tree: All (""), modules ("module:Orders"), object types (their id) */
interface TreeNode {
  id: string;
  label: string;
  depth: number;
  parent?: TreeNode;
  children: TreeNode[];
  count: number;
  typeId?: string;
}

type FlagKey = "isRequired" | "isDictionary" | "isArray" | "isMultilingual";
const FLAGS: { key: FlagKey; label: string }[] = [
  { key: "isRequired", label: "PLATFORM.DYNAMIC.REQUIRED" },
  { key: "isDictionary", label: "PLATFORM.DYNAMIC.DICTIONARY" },
  { key: "isMultilingual", label: "PLATFORM.DYNAMIC.MULTILINGUAL" },
  { key: "isArray", label: "PLATFORM.DYNAMIC.MULTIVALUE" },
];

/** The icon of every object type: a record with its properties */
const TYPE_ICON = "lucide-table-properties";

const VALUE_TYPE_ICONS: Record<string, string> = {
  ShortText: "lucide-type",
  LongText: "lucide-align-left",
  Integer: "lucide-hash",
  Decimal: "lucide-hash",
  DateTime: "lucide-calendar",
  Boolean: "lucide-toggle-left",
  Html: "lucide-code",
  Image: "lucide-image",
};

const { t, locale } = useI18n({ useScope: "global" });
const { openBlade, exposeToChildren } = useBlade();
const { hasAccess } = usePermissions();
const { getApiClient } = useApiClient(DynamicPropertiesClient);

const root = ref<HTMLElement>();
const panel = ref<HTMLElement>();
// a phone, or a narrow blade: the tree and a node's properties one after the other
const { width } = useElementSize(root);
const narrow = computed(() => width.value > 0 && width.value < 720);
const detail = ref(false);

const types = ref<ObjectType[]>([]);
const properties = ref<DynamicProperty[]>([]);
const keyword = ref("");
const withPropertiesOnly = ref(false);
const flagFilter = ref(new Set<FlagKey>());
const selected = ref("");
const focused = ref<string>();
const collapsed = ref(new Set<string>());
const activeId = ref<string>();

const canCreate = computed(() => hasAccess("platform:dynamic_properties:create"));

/* ---- names ---- */

const humanize = (name: string) => {
  const spaced = name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  return spaced.charAt(0) + spaced.slice(1).toLowerCase();
};

function objectType(id: string): ObjectType {
  const parts = id.split(".");
  const shortId = parts[parts.length - 1] ?? id;
  // the module's namespace: VirtoCommerce.<Name>Module.Core... or VirtoCommerce.<Name>.Core...
  const space = parts[0] === "VirtoCommerce" && parts.length > 2 ? parts[1] : parts.slice(0, -1).join(".");
  return {
    id,
    module: space.replace(/Module$/, "") || shortId,
    label: humanize(shortId),
    shortId,
  };
}

/** A property's name in the user's language, else its name */
function propertyTitle(p: DynamicProperty) {
  const lang = locale.value.toLowerCase();
  const names = p.displayNames ?? [];
  const localeOf = (x: { locale?: string }) => (x.locale ?? "").toLowerCase();
  const exact = names.find((x) => x.name && localeOf(x) === lang);
  const sameLanguage = names.find((x) => x.name && localeOf(x).split("-")[0] === lang.split("-")[0]);
  return exact?.name ?? sameLanguage?.name ?? p.name ?? "";
}

const flagsOf = (p: DynamicProperty) => FLAGS.filter((f) => p[f.key]);

/* ---- loading: the types and every property in one go (they are few: tens, not thousands) ---- */

const { loading, action: load } = useAsync(async () => {
  const client = await getApiClient();
  const [ids, firstPage] = await Promise.all([client.getObjectTypes(), client.searchDynamicProperties({ take: 500 })]);
  const all = [...(firstPage.results ?? [])];
  while (all.length < (firstPage.totalCount ?? 0)) {
    const next = await client.searchDynamicProperties({ skip: all.length, take: 500 });
    if (!next.results?.length) break;
    all.push(...next.results);
  }
  types.value = (ids ?? []).map(objectType);
  properties.value = all;
});

/* ---- filters ---- */

// the panel edits a draft; Apply puts it in force, as in vc-shell's table filters
const filterAnchor = ref<HTMLElement | null>(null);
const filtersOpen = ref(false);
const draft = ref({ withProperties: false, flags: {} as Partial<Record<FlagKey, boolean>> });

function openFilters() {
  draft.value = {
    withProperties: withPropertiesOnly.value,
    flags: Object.fromEntries([...flagFilter.value].map((key) => [key, true])),
  };
  filtersOpen.value = !filtersOpen.value;
}

function applyFilters() {
  withPropertiesOnly.value = draft.value.withProperties;
  flagFilter.value = new Set(FLAGS.map((f) => f.key).filter((key) => draft.value.flags[key]));
  filtersOpen.value = false;
}

function clearFilterPanel() {
  withPropertiesOnly.value = false;
  flagFilter.value = new Set();
  filtersOpen.value = false;
}

const activeFilterCount = computed(() => flagFilter.value.size + (withPropertiesOnly.value ? 1 : 0));

const filtered = computed(() => !!keyword.value.trim() || withPropertiesOnly.value || flagFilter.value.size > 0);

function clearFilters() {
  keyword.value = "";
  withPropertiesOnly.value = false;
  flagFilter.value = new Set();
}

const text = (...values: (string | undefined | null)[]) => values.filter(Boolean).join(" ").toLowerCase();

const propertyMatches = (p: DynamicProperty, words: string[]) => {
  const haystack = text(
    p.name,
    p.description,
    p.valueType,
    t(`PLATFORM.DYNAMIC.VALUE_TYPES.${p.valueType ?? "Undefined"}`),
    ...(p.displayNames ?? []).map((x) => x.name),
  );
  return words.every((w) => haystack.includes(w));
};

const flagCount = (key: FlagKey) => properties.value.filter((p) => p[key]).length;

/** Per type, the properties the filters leave; a type left out has no entry */
const visible = computed(() => {
  const words = keyword.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const byType = new Map<string, DynamicProperty[]>();
  for (const type of types.value) {
    const typeMatches = words.length > 0 && words.every((w) => text(type.id, type.module, type.label).includes(w));
    const own = properties.value
      .filter((p) => p.objectType === type.id)
      .filter((p) => [...flagFilter.value].every((key) => p[key]))
      .filter((p) => typeMatches || propertyMatches(p, words))
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || (a.name ?? "").localeCompare(b.name ?? ""));
    const keep =
      own.length > 0 || (typeMatches && !flagFilter.value.size) || (!filtered.value && !withPropertiesOnly.value);
    if (keep) byType.set(type.id, own);
  }
  return byType;
});

/* ---- the tree ---- */

const tree = computed(() => {
  const top: TreeNode = { id: "", label: "", depth: 0, children: [], count: 0 };
  const byId = new Map<string, TreeNode>([["", top]]);
  for (const type of types.value) {
    const own = visible.value.get(type.id);
    if (!own) continue;
    const moduleId = `module:${type.module}`;
    let module = byId.get(moduleId);
    if (!module) {
      module = { id: moduleId, label: type.module, depth: 1, parent: top, children: [], count: 0 };
      byId.set(moduleId, module);
      top.children.push(module);
    }
    const node: TreeNode = {
      id: type.id,
      label: type.label,
      depth: 2,
      parent: module,
      children: [],
      count: own.length,
      typeId: type.id,
    };
    byId.set(type.id, node);
    module.children.push(node);
    module.count += own.length;
    top.count += own.length;
  }
  top.children.sort((a, b) => a.label.localeCompare(b.label));
  top.children.forEach((m) => m.children.sort((a, b) => a.label.localeCompare(b.label)));
  return { top, byId };
});

// "All object types" is translated where the tree is read, so the tree doesn't build again on a language switch
const allLabel = computed(() => t("PLATFORM.DYNAMIC.ALL_TYPES"));
const labelOf = (n: TreeNode) => (n.depth === 0 ? allLabel.value : n.label);

const isExpanded = (n: TreeNode) => n.depth === 0 || filtered.value || !collapsed.value.has(n.id);

const rows = computed(() => {
  const list: (TreeNode & { label: string })[] = [];
  const walk = (n: TreeNode) => {
    list.push({ ...n, label: labelOf(n) });
    if (isExpanded(n)) n.children.forEach(walk);
  };
  walk(tree.value.top);
  return list;
});

function toggle(n: TreeNode) {
  const next = new Set(collapsed.value);
  if (next.has(n.id)) next.delete(n.id);
  else next.add(n.id);
  collapsed.value = next;
}

function select(n: TreeNode) {
  selected.value = n.id;
  focused.value = n.id;
  detail.value = true;
  panel.value?.scrollTo({ top: 0 });
}

// the node chosen is gone (filtered out): all object types
watch(tree, ({ byId }) => {
  if (!byId.has(selected.value)) selected.value = "";
  if (focused.value !== undefined && !byId.has(focused.value)) focused.value = undefined;
});

const currentTitle = computed(() => {
  const node = tree.value.byId.get(selected.value);
  if (!node?.depth) return allLabel.value;
  return node.depth === 2 ? `${node.parent?.label} › ${node.label}` : node.label;
});

/* keyboard of the tree (WAI-ARIA tree view), as on the settings screen */
const rowElements = new Map<string, HTMLElement>();
function setRowRef(id: string, el: unknown) {
  if (el) rowElements.set(id, el as HTMLElement);
  else rowElements.delete(id);
}

function focusRow(n?: TreeNode) {
  if (!n) return;
  focused.value = n.id;
  nextTick(() => rowElements.get(n.id)?.focus());
}

function onTreeKey(event: KeyboardEvent) {
  const list = rows.value;
  const index = list.findIndex((n) => n.id === (focused.value ?? selected.value));
  const current = tree.value.byId.get(list[index]?.id ?? "\u0000");
  if (!current) return;
  const keys: Record<string, () => void> = {
    ArrowDown: () => focusRow(list[index + 1]),
    ArrowUp: () => focusRow(list[index - 1]),
    Home: () => focusRow(list[0]),
    End: () => focusRow(list[list.length - 1]),
    ArrowRight: () => {
      if (current.children.length && !isExpanded(current)) toggle(current);
      else focusRow(current.children[0]);
    },
    ArrowLeft: () => {
      if (current.children.length && current.depth > 0 && isExpanded(current) && !filtered.value) toggle(current);
      else focusRow(current.parent);
    },
    Enter: () => select(current),
    " ": () => select(current),
  };
  if (keys[event.key]) {
    event.preventDefault();
    keys[event.key]();
  }
}

/* ---- the panel: a section per object type under the chosen node ---- */

const chosenNode = computed(() => tree.value.byId.get(selected.value) ?? tree.value.top);

/** The object types under the chosen node (one type, a module's or all), with their properties */
const chosenTypes = computed(() => {
  const node = chosenNode.value;
  let typeNodes: TreeNode[];
  if (node.depth === 2) typeNodes = [node];
  else if (node.depth === 1) typeNodes = node.children;
  else typeNodes = node.children.flatMap((m) => m.children);
  return typeNodes.flatMap((n) => {
    const type = types.value.find((x) => x.id === n.typeId);
    return type ? [{ type, properties: visible.value.get(type.id) ?? [] }] : [];
  });
});

// a type chosen on its own shows even without properties, to add one; under a module or All, the types without
// properties are a row of chips at the end, so the properties there are not lost among empty sections
const sections = computed(() =>
  chosenNode.value.depth === 2 ? chosenTypes.value : chosenTypes.value.filter((x) => x.properties.length),
);
const emptyTypes = computed(() =>
  chosenNode.value.depth === 2 ? [] : chosenTypes.value.filter((x) => !x.properties.length).map((x) => x.type),
);

function selectType(id: string) {
  const node = tree.value.byId.get(id);
  if (!node) return;
  if (node.parent && collapsed.value.has(node.parent.id)) toggle(node.parent);
  select(node);
}

/* ---- opening a property (or a new one) in its own blade ---- */

function openProperty(objectType: string, id?: string) {
  activeId.value = id;
  openBlade({
    name: "PlatformDynamicPropertyDetails",
    param: id,
    options: { objectType },
    onClose: () => {
      activeId.value = undefined;
      load();
    },
  });
}

// the chosen object type, for the toolbar's Add
const chosenType = computed(() => tree.value.byId.get(selected.value)?.typeId);

const toolbar = computed<IBladeToolbar[]>(() => [
  refreshItem(() => load()),
  {
    id: "add",
    title: t("PLATFORM.DYNAMIC.ADD_PROPERTY"),
    icon: "lucide-plus",
    permissions: ["platform:dynamic_properties:create"],
    disabled: !chosenType.value,
    clickHandler: () => chosenType.value && openProperty(chosenType.value),
  },
]);

// the details blade reloads its parent after a save or a delete
exposeToChildren({ reload: () => load() });

load();
</script>

<style lang="scss">
// the settings screen's ps-* styles carry the layout; these are what properties add: cards that open, the type tags
.pdp-prop {
  display: block;
  width: 100%;
  font: inherit;
  text-align: start;
  color: inherit;
  background: transparent;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.12s ease;

  // room for the arrow, which stands centred at the card's end whatever the card holds (a description, a code name)
  padding-inline-end: 40px;

  &__go {
    position: absolute;
    inset-inline-end: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-neutral-400);
  }
}

// a card that opens takes the table rows' colours: the tokens custom.scss gives the tables' --table-row-bg-hover and
// --table-row-bg-selected (those two are set on tables only), with the accent bar and the arrow in the theme's colour. .ps-prop.pdp-prop outweighs the settings
// screen's [dir] .ps-prop rules, whatever order the stylesheets load in.
.ps-prop.pdp-prop:hover,
.ps-prop.pdp-prop--active {
  &::before {
    background: var(--color-primary-500);
  }

  .pdp-prop__go {
    color: var(--color-primary-500);
  }
}

.ps-prop.pdp-prop:hover {
  background: var(--color-secondary-50);
}

.ps-prop.pdp-prop--active {
  background: var(--bg-row-selected);
}

.ps-prop.pdp-prop:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: -2px;
}

.pdp-tag--type {
  color: var(--color-primary-700);
  background: var(--color-primary-50);
}

// the properties panel sizes the section headers: below 560px there is no room for the class name beside the title
// (the tree's tooltip has the full name), and Add property keeps to one line
.pdp-panel {
  container-type: inline-size;
}

@container (max-width: 560px) {
  .pdp-section__code {
    display: none;
  }
}

.pdp-section__add {
  white-space: nowrap;
  margin-inline-start: auto;
}

.pdp-section__none {
  margin: 4px 0 8px;
  color: var(--color-neutral-500);
  font-size: 13px;
}

.pdp-filters {
  display: flex;
  flex-direction: column;
  gap: 10px;

  &__row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    cursor: pointer;
  }

  &__count {
    margin-inline-start: auto;
    color: var(--color-neutral-500);
    font-variant-numeric: tabular-nums;
  }
}

.pdp-section__icon {
  color: var(--color-neutral-500);
}

.pdp-empty-types {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px 0 8px;
}

.pdp-node__label--empty {
  color: var(--color-neutral-500);
}
</style>
