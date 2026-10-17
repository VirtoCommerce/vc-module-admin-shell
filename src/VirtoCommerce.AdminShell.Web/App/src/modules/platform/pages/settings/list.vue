<template>
  <VcBlade
    :title="$t('PLATFORM.SETTINGS.LIST.TITLE')"
    :toolbar-items="toolbar"
    :loading="loading"
    :modified="form.isModified.value"
    width="70%"
  >
    <!-- The unified settings blade (vc-platform docs/developer-guide/settingsV2.md): the groups as a tree, the settings of
         the chosen group as properties edited in place. Narrow (a phone): the tree, then the properties of a group. -->
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
            :placeholder="$t('PLATFORM.SETTINGS.LIST.SEARCH')"
            :aria-label="$t('PLATFORM.SETTINGS.LIST.SEARCH')"
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
        <div class="ps__filters">
          <button
            type="button"
            class="ps-chip"
            :aria-pressed="modifiedOnly"
            @click="modifiedOnly = !modifiedOnly"
          >
            <span class="ps-dot ps-dot--modified" />
            {{ $t("PLATFORM.SETTINGS.LIST.MODIFIED_ONLY") }}
            <span class="ps-chip__count">{{ modifiedCount }}</span>
          </button>
          <button
            type="button"
            class="ps-chip"
            :aria-pressed="includeTenant"
            @click="includeTenant = !includeTenant"
          >
            <VcIcon
              icon="lucide-store"
              size="xs"
            />
            {{ $t("PLATFORM.SETTINGS.LIST.TENANT") }}
          </button>
          <VcSelect
            v-model="moduleId"
            class="ps__module"
            size="small"
            :options="modules"
            :placeholder="$t('PLATFORM.SETTINGS.LIST.ALL_MODULES')"
            clearable
            searchable
          />
        </div>
      </div>

      <div class="ps__body">
        <nav
          class="ps__tree"
          role="tree"
          :aria-label="$t('PLATFORM.SETTINGS.LIST.GROUPS')"
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
            :aria-expanded="row.children.length ? isExpanded(row) : undefined"
            :tabindex="row.id === (focused ?? selected) ? 0 : -1"
            @click="select(row)"
            @focus="focused = row.id"
          >
            <button
              v-if="row.children.length && row.depth > 0"
              type="button"
              class="ps-node__toggle"
              tabindex="-1"
              :aria-label="isExpanded(row) ? $t('PLATFORM.SETTINGS.LIST.COLLAPSE') : $t('PLATFORM.SETTINGS.LIST.EXPAND')"
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
                v-if="row.depth === 0"
                icon="lucide-layers"
                size="s"
              />
            </span>
            <span class="ps-node__label">{{ row.label }}</span>
            <span
              v-if="row.dirty"
              class="ps-dot ps-dot--dirty"
              :title="$t('PLATFORM.SETTINGS.LIST.UNSAVED')"
            />
            <span
              v-else-if="row.modified"
              class="ps-dot ps-dot--modified"
              :title="$t('PLATFORM.SETTINGS.LIST.MODIFIED_HINT')"
            />
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
          class="ps__props"
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
            v-if="!sections.length && !loading"
            class="ps__empty"
          >
            <VcIcon
              icon="lucide-search-x"
              size="xl"
            />
            <p>{{ $t("PLATFORM.SETTINGS.LIST.EMPTY") }}</p>
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
            :key="section.id"
            class="ps-section"
            :data-group="section.id"
          >
            <h3 class="ps-section__title">
              <span class="ps-section__path">
                <template
                  v-for="(part, i) in section.path"
                  :key="i"
                >
                  <VcIcon
                    v-if="i"
                    class="ps-section__sep"
                    icon="lucide-chevron-right"
                    size="xs"
                  />
                  <span>{{ part }}</span>
                </template>
              </span>
              <span
                v-if="section.moduleId"
                class="ps-section__module"
              >{{ section.moduleId }}</span>
              <button
                type="button"
                class="ps__icon-btn ps-section__link"
                :title="$t('PLATFORM.SETTINGS.LIST.COPY_LINK')"
                :aria-label="$t('PLATFORM.SETTINGS.LIST.COPY_LINK')"
                @click="copyLink(section.id)"
              >
                <VcIcon
                  icon="lucide-link"
                  size="s"
                />
              </button>
            </h3>

            <div
              v-for="s in section.settings"
              :key="s.name"
              class="ps-prop"
              :class="{
                'ps-prop--modified': isModified(s),
                'ps-prop--dirty': isDirty(s),
                'ps-prop--found': s.name === found,
              }"
              :data-setting="s.name"
            >
              <div class="ps-prop__head">
                <div class="ps-prop__heading">
                  <span class="ps-prop__title">{{ settingTitle(s) }}</span>
                  <span
                    v-if="isDirty(s)"
                    class="ps-tag ps-tag--dirty"
                  >{{ $t("PLATFORM.SETTINGS.LIST.UNSAVED") }}</span>
                  <span
                    v-else-if="isModified(s)"
                    class="ps-tag ps-tag--modified"
                  >{{ $t("PLATFORM.SETTINGS.LIST.MODIFIED") }}</span>
                  <span
                    v-if="s.restartRequired"
                    class="ps-tag ps-tag--warn"
                    :title="$t('PLATFORM.SETTINGS.GROUP.RESTART_REQUIRED')"
                  >
                    <VcIcon
                      icon="lucide-power"
                      size="xs"
                    />{{ $t("PLATFORM.SETTINGS.GROUP.RESTART_REQUIRED") }}
                  </span>
                  <span
                    v-if="s.assignedToTenants?.length"
                    class="ps-tag"
                  >
                    <VcIcon
                      icon="lucide-store"
                      size="xs"
                    />{{ s.assignedToTenants.join(", ") }}
                  </span>
                  <span
                    v-if="s.isReadOnly"
                    class="ps-tag"
                  >
                    <VcIcon
                      icon="lucide-lock"
                      size="xs"
                    />{{ $t("PLATFORM.SETTINGS.LIST.READ_ONLY") }}
                  </span>
                </div>
                <div class="ps-prop__actions">
                  <button
                    v-if="isDirty(s)"
                    type="button"
                    class="ps__icon-btn"
                    :title="$t('PLATFORM.SETTINGS.LIST.DISCARD')"
                    :aria-label="$t('PLATFORM.SETTINGS.LIST.DISCARD')"
                    @click="discard(s)"
                  >
                    <VcIcon
                      icon="lucide-undo-2"
                      size="s"
                    />
                  </button>
                  <button
                    v-if="canResetToDefault(s)"
                    type="button"
                    class="ps__icon-btn"
                    :title="defaultTitle(s)"
                    :aria-label="defaultTitle(s)"
                    @click="resetToDefault(s)"
                  >
                    <VcIcon
                      icon="lucide-rotate-ccw"
                      size="s"
                    />
                  </button>
                </div>
              </div>
              <p
                v-if="settingDescription(s)"
                class="ps-prop__description"
              >
                {{ settingDescription(s) }}
              </p>

              <div class="ps-prop__editor">
                <div
                  v-if="s.isDictionary"
                  class="ps-prop__dictionary"
                >
                  <span
                    v-for="value in dictionaryValues(s)"
                    :key="String(value)"
                    class="ps-tag"
                  >{{ value }}</span>
                  <span
                    v-if="!dictionaryValues(s).length"
                    class="ps-prop__none"
                  >—</span>
                  <VcButton
                    variant="outline"
                    size="sm"
                    icon="lucide-pencil"
                    @click="openDictionary(s)"
                  >
                    {{ $t("PLATFORM.SETTINGS.GROUP.EDIT_VALUES") }}
                  </VcButton>
                </div>
                <VcSelect
                  v-else-if="s.allowedValues?.length"
                  v-model="item[s.name]"
                  :options="s.allowedValues.map((x) => ({ id: x, title: String(x) }))"
                  :required="s.isRequired"
                  :disabled="readonly(s)"
                  :clearable="!s.isRequired"
                  :error-message="requiredError(s)"
                  searchable
                />
                <div
                  v-else-if="s.valueType === 'Boolean'"
                  class="ps-prop__switch"
                >
                  <VcSwitch
                    v-model="item[s.name] as boolean"
                    :disabled="readonly(s)"
                  />
                  <span>{{ item[s.name] ? $t("PLATFORM.SETTINGS.LIST.ON") : $t("PLATFORM.SETTINGS.LIST.OFF") }}</span>
                </div>
                <VcInput
                  v-else-if="s.valueType === 'Integer' || s.valueType === 'PositiveInteger'"
                  v-model="item[s.name] as number"
                  type="integer"
                  :aria-label="settingTitle(s)"
                  :required="s.isRequired"
                  :disabled="readonly(s)"
                  :error-message="requiredError(s)"
                />
                <VcInput
                  v-else-if="s.valueType === 'Decimal'"
                  v-model="item[s.name] as number"
                  type="number"
                  step="any"
                  :aria-label="settingTitle(s)"
                  :required="s.isRequired"
                  :disabled="readonly(s)"
                  :error-message="requiredError(s)"
                />
                <VcDatePicker
                  v-else-if="s.valueType === 'DateTime'"
                  v-model="item[s.name] as Date"
                  type="datetime-local"
                  :required="s.isRequired"
                  :disabled="readonly(s)"
                  :error-message="requiredError(s)"
                />
                <template v-else-if="s.valueType === 'Json'">
                  <VcTextarea
                    v-model="item[s.name] as string"
                    class="platform-code"
                    maxlength="1000000"
                    :required="s.isRequired"
                    :disabled="readonly(s)"
                    :error-message="jsonError(s) || requiredError(s)"
                  />
                  <VcButton
                    class="ps-prop__format"
                    variant="ghost"
                    size="sm"
                    icon="lucide-braces"
                    :disabled="readonly(s) || !!jsonError(s) || !item[s.name]"
                    @click="formatJson(s)"
                  >
                    {{ $t("PLATFORM.SETTINGS.GROUP.FORMAT_JSON") }}
                  </VcButton>
                </template>
                <VcTextarea
                  v-else-if="s.valueType === 'LongText'"
                  v-model="item[s.name] as string"
                  maxlength="1000000"
                  :required="s.isRequired"
                  :disabled="readonly(s)"
                  :error-message="requiredError(s)"
                />
                <VcInput
                  v-else
                  v-model="item[s.name] as string"
                  :type="s.valueType === 'SecureString' ? 'password' : 'text'"
                  :aria-label="settingTitle(s)"
                  :hint="s.valueType === 'Cron' ? cronHint(s) : undefined"
                  :required="s.isRequired"
                  :disabled="readonly(s)"
                  :error-message="requiredError(s)"
                />
              </div>

              <code class="ps-prop__name">{{ s.name }}</code>
            </div>
          </div>
        </section>
      </div>
    </div>
    <input
      :ref="(el) => setFileInput(el)"
      type="file"
      accept=".json,application/json"
      hidden
      @change="onImportFile"
    />
  </VcBlade>
</template>

<script setup lang="ts">
import {
  ChangeLogClient,
  notification,
  useApiClient,
  useAsync,
  useBlade,
  useBladeStack,
  useLoading,
  usePermissions,
  usePopup,
  type IBladeToolbar,
} from "@vc-shell/framework";
import {
  VcBlade,
  VcButton,
  VcDatePicker,
  VcIcon,
  VcInput,
  VcSelect,
  VcSwitch,
  VcTextarea,
} from "@vc-shell/framework/ui";
import { useElementSize, useEventListener } from "@vueuse/core";
import { computed, nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { refreshItem, saveResetItems, usePlatformBladeForm } from "../../composables/blade";
import {
  exportDocument,
  groupId,
  groupPath,
  isEmpty,
  sameValue,
  settingDescription,
  settingFocus,
  settingsOf,
  settingTitle,
  toEditor,
  useSettingsStore,
  type SettingSchema,
  type SettingValues,
} from "../../composables/settings";

defineBlade({
  url: "/settings",
  name: "PlatformSettings",
  isWorkspace: true,
  permissions: ["platform:setting:access"],
});

/** A group of the tree: "Catalog|Search"; the root ("All settings") has the id "" */
interface TreeNode {
  id: string;
  label: string;
  depth: number;
  parent?: TreeNode;
  children: TreeNode[];
  /** settings in the group and the groups under it */
  count: number;
  /** a setting under it differs from its default */
  modified: boolean;
  /** a setting under it has an unsaved change */
  dirty: boolean;
}

const { t, locale } = useI18n({ useScope: "global" });
const { id: bladeId, openBlade, exposeToChildren, query } = useBlade();
const { updateBladeQuery } = useBladeStack();
const route = useRoute();
const router = useRouter();
const { hasAccess } = usePermissions();
const { showConfirmation } = usePopup();
const store = useSettingsStore();
const { getApiClient: changeLogClient } = useApiClient(ChangeLogClient);

const root = ref<HTMLElement>();
const panel = ref<HTMLElement>();
// a phone, or a narrow blade: the tree and a group's properties one after the other
const { width } = useElementSize(root);
const narrow = computed(() => width.value > 0 && width.value < 720);
const detail = ref(false);

const keyword = ref("");
const modifiedOnly = ref(false);
const includeTenant = ref(false);
const moduleId = ref<string>();
const selected = ref("");
const focused = ref<string>();
const expanded = ref(new Set<string>());
const found = ref<string>();

let fileInput: HTMLInputElement | undefined;
const setFileInput = (el: unknown) => {
  fileInput = el as HTMLInputElement;
};

/* ---- values: what the editors hold, against what is stored and the defaults ---- */

const item = ref<SettingValues>({});

const canUpdate = computed(() => hasAccess("platform:setting:update"));
const readonly = (s: SettingSchema) => !!s.isReadOnly || !canUpdate.value;
const defaultOf = (s: SettingSchema) => toEditor(s.defaultValue, s.valueType);

// a dictionary is edited in its own blade: its stored values are what it holds
const isDirty = (s: SettingSchema) =>
  !s.isDictionary && !sameValue(item.value[s.name], store.stored.value[s.name], s.valueType);
const isModified = (s: SettingSchema) =>
  s.isDictionary ? store.isModified(s) : !sameValue(item.value[s.name], defaultOf(s), s.valueType);

const changed = computed(() => store.schema.value.filter(isDirty));

const requiredError = (s: SettingSchema) =>
  s.isRequired && isEmpty(item.value[s.name]) ? t("PLATFORM.COMMON.REQUIRED") : undefined;

function jsonError(s: SettingSchema) {
  const value = item.value[s.name];
  if (isEmpty(value)) return undefined;
  try {
    JSON.parse(String(value));
    return undefined;
  } catch (e) {
    return t("PLATFORM.SETTINGS.GROUP.INVALID_JSON", { error: (e as Error).message });
  }
}

const valid = computed(() =>
  changed.value.every((s) => !requiredError(s) && (s.valueType !== "Json" || !jsonError(s))),
);

const form = usePlatformBladeForm({
  data: item,
  canSaveOverride: computed(() => changed.value.length > 0 && valid.value && canUpdate.value),
});

/** The editors from the stored values; `keepEdits` keeps the unsaved ones (a reload under them) */
function fill(keepEdits = false) {
  const edits = keepEdits ? Object.fromEntries(changed.value.map((s) => [s.name, item.value[s.name]])) : {};
  item.value = {
    ...Object.fromEntries(store.schema.value.map((s) => [s.name, toEditor(store.stored.value[s.name], s.valueType)])),
    ...edits,
  };
  form.setBaseline();
}

const { loading: loadLoading, action: load } = useAsync(async (keepEdits?: boolean) => {
  await store.load(String(locale.value || "en"));
  fill(!!keepEdits);
});

const { loading: saveLoading, action: save } = useAsync(async () => {
  const restart = changed.value.some((s) => s.restartRequired);
  await store.save(Object.fromEntries(changed.value.map((s) => [s.name, item.value[s.name]])));
  await store.load(String(locale.value || "en"));
  fill();
  notification.success(t("PLATFORM.SETTINGS.SAVED"));
  if (restart) notification.warning(t("PLATFORM.SETTINGS.LIST.RESTART_NOTE"));
});

const loading = useLoading(loadLoading, saveLoading);

const discard = (s: SettingSchema) => (item.value[s.name] = toEditor(store.stored.value[s.name], s.valueType));
const canResetToDefault = (s: SettingSchema) =>
  !s.isDictionary && !readonly(s) && !sameValue(item.value[s.name], defaultOf(s), s.valueType);
// legacy: reset only changes the value here, Save stores it
const resetToDefault = (s: SettingSchema) => (item.value[s.name] = defaultOf(s));

function defaultTitle(s: SettingSchema) {
  const value = s.defaultValue;
  if (isEmpty(value) || s.valueType === "Json" || s.valueType === "SecureString")
    return t("PLATFORM.SETTINGS.GROUP.RESET_TO_DEFAULT");
  return t("PLATFORM.SETTINGS.LIST.RESET_TO", { value: String(value) });
}

function formatJson(s: SettingSchema) {
  item.value[s.name] = JSON.stringify(JSON.parse(String(item.value[s.name])), null, 2);
}

const dictionaryValues = (s: SettingSchema) => {
  const values = store.stored.value[s.name];
  return Array.isArray(values) ? values : [];
};

const CRON = /^\s*(\S+\s+){4}\S+(\s+\S+)?\s*$/;
const cronHint = (s: SettingSchema) =>
  CRON.test(String(item.value[s.name] ?? ""))
    ? t("PLATFORM.SETTINGS.GROUP.CRON_HINT")
    : t("PLATFORM.SETTINGS.GROUP.CRON_INVALID");

function openDictionary(s: SettingSchema) {
  openBlade({ name: "PlatformSettingDictionary", param: s.name });
}

/* ---- filters: keyword, modified only, tenant settings, module ---- */

/** keyword search over name, title, group and value (the current one, as edited) */
function matches(s: SettingSchema, text: string) {
  const value = item.value[s.name] ?? store.stored.value[s.name];
  return [s.name, settingTitle(s), groupPath(s).join(" > "), typeof value === "object" ? JSON.stringify(value) : value].some(
    (x) => x != null && String(x).toLowerCase().includes(text),
  );
}

const inScope = (s: SettingSchema) => includeTenant.value || !s.assignedToTenants?.length;

// modified only reads the stored values: a setting being reset stays in view until it is saved
const modifiedCount = computed(() => store.schema.value.filter((s) => inScope(s) && store.isModified(s)).length);

const filtered = computed(() => !!keyword.value.trim() || modifiedOnly.value || !!moduleId.value);

const visible = computed(() => {
  const text = keyword.value.trim().toLowerCase();
  return store.schema.value.filter(
    (s) =>
      inScope(s) &&
      (!moduleId.value || s.moduleId === moduleId.value) &&
      (!modifiedOnly.value || store.isModified(s)) &&
      (!text || matches(s, text)),
  );
});

const modules = computed(() =>
  [...new Set(store.schema.value.filter(inScope).map((s) => s.moduleId).filter(Boolean))]
    .sort()
    .map((x) => ({ id: x as string, title: x as string })),
);

function clearFilters() {
  keyword.value = "";
  modifiedOnly.value = false;
  moduleId.value = undefined;
}

/* ---- the tree: the groups of the visible settings ---- */

const tree = computed(() => {
  const top: TreeNode = { id: "", label: t("PLATFORM.SETTINGS.LIST.ALL"), depth: 0, children: [], count: 0, modified: false, dirty: false };
  const byId = new Map<string, TreeNode>([["", top]]);
  for (const s of visible.value) {
    const modified = isModified(s);
    const dirty = isDirty(s);
    const path = groupPath(s);
    let node = top;
    const mark = (n: TreeNode) => {
      n.count++;
      n.modified ||= modified;
      n.dirty ||= dirty;
    };
    mark(top);
    path.forEach((label, i) => {
      const id = path.slice(0, i + 1).join("|");
      let child = byId.get(id);
      if (!child) {
        child = { id, label, depth: i + 1, parent: node, children: [], count: 0, modified: false, dirty: false };
        byId.set(id, child);
        node.children.push(child);
      }
      mark(child);
      node = child;
    });
  }
  const sort = (n: TreeNode) => {
    n.children.sort((a, b) => a.label.localeCompare(b.label));
    n.children.forEach(sort);
  };
  sort(top);
  return { top, byId };
});

// a search or a filter opens every group it leaves
const isExpanded = (n: TreeNode) => n.depth === 0 || filtered.value || expanded.value.has(n.id);

const rows = computed(() => {
  const list: TreeNode[] = [];
  const walk = (n: TreeNode) => {
    list.push(n);
    if (isExpanded(n)) n.children.forEach(walk);
  };
  walk(tree.value.top);
  return list;
});

function toggle(n: TreeNode) {
  const next = new Set(expanded.value);
  if (next.has(n.id)) next.delete(n.id);
  else next.add(n.id);
  expanded.value = next;
}

function expandTo(id: string) {
  const next = new Set(expanded.value);
  for (let n = tree.value.byId.get(id); n; n = n.parent) if (n.id) next.add(n.id);
  expanded.value = next;
}

function select(n: TreeNode) {
  selected.value = n.id;
  focused.value = n.id;
  if (n.children.length && n.depth > 0 && !expanded.value.has(n.id)) toggle(n);
  detail.value = true;
  panel.value?.scrollTo({ top: 0 });
}

// the group chosen is gone (filtered out): all settings
watch(tree, ({ byId }) => {
  if (!byId.has(selected.value)) selected.value = "";
  if (focused.value !== undefined && !byId.has(focused.value)) focused.value = undefined;
});

const currentTitle = computed(() => {
  const node = tree.value.byId.get(selected.value);
  return node?.depth ? node.id.split("|").join(" > ") : t("PLATFORM.SETTINGS.LIST.ALL");
});

/* keyboard of the tree (WAI-ARIA tree view): arrows move and open/close, Enter/Space choose, Home/End */
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
  const current = list[index];
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

/* ---- the properties: the settings of the chosen group and the groups under it, a section per group ---- */

const sections = computed(() => {
  const prefix = selected.value;
  const order = new Map<string, number>();
  let i = 0;
  const walk = (n: TreeNode) => {
    order.set(n.id, i++);
    n.children.forEach(walk);
  };
  walk(tree.value.top);
  const groups = new Map<string, { id: string; path: string[]; moduleId?: string; settings: SettingSchema[] }>();
  for (const s of visible.value) {
    const id = groupId(s);
    if (prefix && id !== prefix && !id.startsWith(`${prefix}|`)) continue;
    const group = groups.get(id) ?? { id, path: groupPath(s), moduleId: s.moduleId ?? undefined, settings: [] };
    group.settings.push(s);
    groups.set(id, group);
  }
  return [...groups.values()].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
});

/* ---- deep links: ?group=Catalog|Search scrolls to its section, ?setting=Name to the setting (global search too) ---- */

async function scrollTo(selector: string, flash?: string) {
  await nextTick();
  const element = panel.value?.querySelector<HTMLElement>(selector);
  if (!element) return;
  element.scrollIntoView({ block: flash ? "center" : "start", behavior: "smooth" });
  if (flash) {
    found.value = flash;
    setTimeout(() => {
      if (found.value === flash) found.value = undefined;
    }, 2400);
    element.querySelector<HTMLElement>("input, textarea, [tabindex]:not([tabindex='-1'])")?.focus({ preventScroll: true });
  }
}

/** Shows a setting: its group chosen in the tree, filters that hide it cleared */
async function revealSetting(name: string) {
  const s = store.schema.value.find((x) => x.name === name);
  if (!s) return;
  if (s.assignedToTenants?.length) includeTenant.value = true;
  if (!visible.value.includes(s)) clearFilters();
  selected.value = groupId(s);
  expandTo(selected.value);
  detail.value = true;
  await scrollTo(`.ps-prop[data-setting="${CSS.escape(name)}"]`, name);
}

async function revealGroup(id: string) {
  const settings = store.schema.value.filter((s) => groupId(s) === id || groupId(s).startsWith(`${id}|`));
  if (!settings.length) return;
  // tenant settings show up only for a group that has nothing else
  includeTenant.value ||= settings.every((s) => s.assignedToTenants?.length);
  clearFilters();
  selected.value = id;
  expandTo(id);
  detail.value = true;
  await scrollTo(`.ps-section[data-group="${CSS.escape(id)}"]`);
}

// the chosen group stays in the address (?group=Catalog|Search): a copied or reloaded link opens the blade on it;
// a setting's link (?setting=) gives way to its group once it is shown
// (the stack keeps it for its next address sync, which a choice in the tree doesn't cause: the address is set here too)
watch(selected, (group) => {
  updateBladeQuery(bladeId.value, { group, setting: "" });
  const { group: _group, setting: _setting, ...rest } = route.query;
  router.replace({ query: group ? { ...rest, group } : rest });
});

// the address the blade opened with: by the time the settings have loaded, the shell's start (sign-in, the workspace's
// own address) has dropped the query from the route, so it is read here, as the blade starts
const openedWith = new URLSearchParams(window.location.hash.split("?")[1] ?? "");

function linkParam(name: string) {
  const value = query.value?.[name] ?? route.query[name] ?? openedWith.get(name);
  return typeof value === "string" && value ? value : undefined;
}

async function copyLink(group: string) {
  const url = new URL(window.location.href);
  url.hash = `#/settings?group=${encodeURIComponent(group)}`;
  try {
    await navigator.clipboard.writeText(url.toString());
    notification.success(t("PLATFORM.SETTINGS.LIST.LINK_COPIED"));
  } catch {
    notification.error(url.toString());
  }
}

/* ---- export, import ---- */

async function exportJson() {
  const doc = exportDocument(await store.exportModified());
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" }));
  link.download = "settings-global.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

async function onImportFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  let settings: Record<string, unknown>;
  try {
    settings = settingsOf(JSON.parse(await file.text()));
  } catch {
    notification.error(t("PLATFORM.SETTINGS.LIST.IMPORT_INVALID"));
    return;
  }
  if (await showConfirmation(t("PLATFORM.SETTINGS.LIST.IMPORT_CONFIRM", { count: Object.keys(settings).length }))) {
    await store.save(settings, true);
    notification.success(t("PLATFORM.SETTINGS.SAVED"));
    await load();
  }
}

const toolbar = ref<IBladeToolbar[]>([
  ...saveResetItems(form, { save: () => save(), reset: () => fill(), resetDisabled: computed(() => !changed.value.length) }),
  refreshItem(() => load(true)),
  { id: "export", title: t("PLATFORM.SETTINGS.LIST.EXPORT"), icon: "lucide-download", clickHandler: () => exportJson() },
  {
    id: "import",
    title: t("PLATFORM.SETTINGS.LIST.IMPORT"),
    icon: "lucide-upload",
    permissions: ["platform:setting:update"],
    clickHandler: () => fileInput?.click(),
  },
  {
    id: "json",
    title: t("PLATFORM.SETTINGS.LIST.EDIT_JSON"),
    icon: "lucide-braces",
    clickHandler: () => openBlade({ name: "PlatformSettingsJson" }),
  },
  {
    id: "cache",
    title: t("PLATFORM.SETTINGS.LIST.RESET_CACHE"),
    icon: "lucide-eraser",
    permissions: ["cache:reset"],
    async clickHandler() {
      if (await showConfirmation(t("PLATFORM.SETTINGS.LIST.RESET_CACHE_CONFIRM"))) {
        await (await changeLogClient()).resetPlatformCache();
        notification.success(t("PLATFORM.SETTINGS.LIST.CACHE_RESET"));
      }
    },
  },
]);

// the dictionary and JSON blades reload the store: unsaved values here stay
exposeToChildren({ reload: () => load(true) });

load().then(async () => {
  const setting = settingFocus.value?.name ?? linkParam("setting");
  const group = linkParam("group");
  settingFocus.value = undefined;
  if (setting) await revealSetting(setting);
  else if (group) await revealGroup(group);
});

// a link pasted into the address bar of this tab, or back and forward between groups
useEventListener(window, "hashchange", () => {
  const link = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
  const setting = link.get("setting");
  const group = link.get("group") ?? "";
  if (!store.loaded.value || !window.location.hash.startsWith("#/settings")) return;
  if (setting) revealSetting(setting);
  else if (group !== selected.value) {
    if (group) revealGroup(group);
    else selected.value = "";
  }
});

// global search asks for a setting while the blade is open
watch(settingFocus, (focus) => {
  if (!focus || !store.loaded.value || loadLoading.value) return;
  settingFocus.value = undefined;
  revealSetting(focus.name);
});
</script>

<style lang="scss">
.ps {
  --ps-tree: 280px;
  --ps-modified: var(--color-primary-500);
  --ps-dirty: var(--color-warning-500);
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--color-neutral-0);

  /* the search and the filters */
  &__bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-neutral-200);
  }
  &__search {
    flex: 1 1 260px;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    padding: 0 6px 0 12px;
    border: 1px solid var(--color-neutral-300);
    border-radius: 8px;
    background: var(--color-neutral-0);
    color: var(--color-neutral-500);
    cursor: text;
    &:focus-within {
      border-color: var(--color-primary-500);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary-500) 18%, transparent);
    }
  }
  &__search-input {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: 0;
    outline: 0;
    background: transparent;
    font: inherit;
    font-size: 14px;
    color: var(--color-neutral-900);
    &::placeholder {
      color: var(--color-neutral-400);
    }
    &::-webkit-search-cancel-button {
      display: none;
    }
  }
  &__filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  &__module {
    width: 220px;
  }
  &__icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--color-neutral-500);
    cursor: pointer;
    &:hover {
      background: var(--color-neutral-100);
      color: var(--color-neutral-900);
    }
    &:focus-visible {
      outline: 2px solid var(--color-primary-500);
      outline-offset: 1px;
    }
  }

  &__body {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: var(--ps-tree) minmax(0, 1fr);
  }

  /* the tree */
  &__tree {
    overflow-y: auto;
    padding: 8px;
    border-right: 1px solid var(--color-neutral-200);
    background: var(--color-neutral-50);
  }

  /* the properties */
  &__props {
    overflow-y: auto;
    padding: 0 24px 40px;
    scroll-padding-top: 52px;
  }
  &__back {
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 4px;
    width: calc(100% + 32px);
    margin: 0 -16px;
    padding: 12px 16px;
    border: 0;
    border-bottom: 1px solid var(--color-neutral-200);
    background: var(--color-neutral-0);
    color: var(--color-primary-500);
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
    span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 64px 16px;
    color: var(--color-neutral-500);
    p {
      margin: 0;
    }
  }

  /* narrow: the tree, or a group's properties */
  &--narrow {
    .ps__body {
      grid-template-columns: minmax(0, 1fr);
    }
    .ps__tree {
      border-right: 0;
      background: var(--color-neutral-0);
    }
    .ps__props {
      display: none;
      padding: 0 16px 40px;
      scroll-padding-top: 100px;
    }
    .ps__module {
      flex: 1 1 160px;
      width: auto;
    }
    .ps-node {
      min-height: 44px;
    }
    .ps-section__title {
      top: 45px;
      margin: 0 -16px;
      padding: 14px 16px 10px;
    }
  }
  &--detail {
    .ps__tree {
      display: none;
    }
    .ps__props {
      display: block;
    }
  }
}

/* a dot: a setting differs from its default (modified) or has a change not saved yet (dirty) */
.ps-dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  &--modified {
    background: var(--ps-modified);
  }
  &--dirty {
    background: var(--ps-dirty);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ps-dirty) 22%, transparent);
  }
}

.ps-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--color-neutral-300);
  border-radius: 999px;
  background: var(--color-neutral-0);
  color: var(--color-neutral-700);
  font: inherit;
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
  &:hover {
    border-color: var(--color-neutral-400);
  }
  &[aria-pressed="true"] {
    border-color: var(--color-primary-500);
    background: color-mix(in srgb, var(--color-primary-500) 12%, var(--color-neutral-0));
    color: var(--color-neutral-900);
  }
  &:focus-visible {
    outline: 2px solid var(--color-primary-500);
    outline-offset: 1px;
  }
  &__count {
    min-width: 20px;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--color-neutral-100);
    color: var(--color-neutral-600);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }
}

.ps-node {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 8px 0 calc(4px + max(var(--depth) - 1, 0) * 16px);
  border-radius: 6px;
  color: var(--color-neutral-700);
  font-size: 14px;
  cursor: pointer;
  user-select: none;
  &:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-900);
  }
  &:focus-visible {
    outline: 2px solid var(--color-primary-500);
    outline-offset: -2px;
  }
  &--selected,
  &--selected:hover {
    background: color-mix(in srgb, var(--color-primary-500) 14%, transparent);
    color: var(--color-neutral-900);
    font-weight: 600;
  }
  &__toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--color-neutral-500);
    cursor: pointer;
    &:not(&--leaf):hover {
      background: var(--color-neutral-200);
    }
    .vc-icon {
      transition: transform 0.15s ease;
    }
  }
  &__chevron--open {
    transform: rotate(90deg);
  }
  &__label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  &__count {
    flex: none;
    color: var(--color-neutral-400);
    font-size: 12px;
    font-weight: 400;
    font-variant-numeric: tabular-nums;
  }
  &__go {
    flex: none;
    color: var(--color-neutral-400);
  }
}

.ps-section {
  content-visibility: auto;
  contain-intrinsic-size: auto 600px;
  &__title {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 -24px;
    padding: 14px 24px 10px;
    border-bottom: 1px solid var(--color-neutral-200);
    background: var(--color-neutral-0);
    color: var(--color-neutral-900);
    font-size: 15px;
    font-weight: 600;
    &:hover .ps-section__link,
    .ps-section__link:focus-visible {
      opacity: 1;
    }
  }
  &__path {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px 4px;
    min-width: 0;
  }
  &__sep {
    color: var(--color-neutral-400);
  }
  &__module {
    overflow: hidden;
    color: var(--color-neutral-400);
    font-size: 12px;
    font-weight: 400;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  &__link {
    margin-left: auto;
    opacity: 0;
    @media (hover: none) {
      opacity: 1;
    }
  }
}

.ps-prop {
  position: relative;
  padding: 16px 0 16px 14px;
  border-bottom: 1px solid var(--color-neutral-100);
  &:last-child {
    border-bottom: 0;
  }
  /* the bar on the left: modified (differs from the default) or dirty (not saved yet) */
  &::before {
    content: "";
    position: absolute;
    left: 0;
    top: 16px;
    bottom: 16px;
    width: 3px;
    border-radius: 3px;
    background: transparent;
  }
  &--modified::before {
    background: var(--ps-modified);
  }
  &--dirty::before {
    background: var(--ps-dirty);
  }
  &--found {
    animation: platform-setting-found 2.4s ease-out;
    border-radius: 8px;
  }

  &__head {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }
  &__heading {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 8px;
    min-width: 0;
    min-height: 28px;
  }
  &__title {
    color: var(--color-neutral-900);
    font-size: 14px;
    font-weight: 600;
  }
  &__actions {
    display: flex;
    gap: 2px;
    flex: none;
  }
  &__description {
    margin: 2px 0 0;
    max-width: 72ch;
    color: var(--color-neutral-500);
    font-size: 13px;
    line-height: 1.45;
  }
  &__editor {
    max-width: 640px;
    margin-top: 10px;
  }
  &__switch {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--color-neutral-700);
    font-size: 14px;
  }
  &__dictionary {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  &__none {
    color: var(--color-neutral-400);
  }
  &__format {
    margin-top: 6px;
  }
  &__name {
    display: inline-block;
    margin-top: 8px;
    color: var(--color-neutral-400);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11px;
    word-break: break-all;
  }
}

.ps-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--color-neutral-100);
  color: var(--color-neutral-600);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  &--modified {
    background: color-mix(in srgb, var(--ps-modified) 14%, transparent);
    color: var(--color-neutral-900);
  }
  &--dirty {
    background: color-mix(in srgb, var(--ps-dirty) 20%, transparent);
    color: var(--color-neutral-900);
  }
  &--warn {
    color: var(--color-neutral-700);
  }
}
</style>
