<template>
  <VcBlade
    :title="$t('PLATFORM.DASHBOARD.TITLE')"
    :toolbar-items="toolbar"
    :loading="loading"
    :modified="dirty"
    :width="jsonOpen ? '50%' : '100%'"
  >
    <div class="dash-config">
      <nav
        class="dash-config__tabs"
        role="tablist"
      >
        <button
          v-for="item in tabs"
          :key="item.id"
          type="button"
          role="tab"
          class="dash-config__tab"
          :class="{ 'dash-config__tab--active': tab === item.id }"
          :aria-selected="tab === item.id"
          @click="tab = item.id"
        >
          {{ item.title }}
        </button>
      </nav>

      <div class="dash-config__body">
        <p
          v-if="error"
          class="dash-config__error"
        >
          {{ error }}
        </p>

        <!-- rules: every widget with who it is hidden from; the pencil opens its rule below it -->
        <section v-if="tab === 'rules'">
          <p class="dash-config__hint">{{ $t("PLATFORM.DASHBOARD.RULES_HINT") }}</p>
          <div class="dash-config__rules">
            <div class="dash-config__rules-head">
              <span>{{ $t("PLATFORM.DASHBOARD.WIDGET") }}</span>
              <span>{{ $t("PLATFORM.DASHBOARD.VISIBILITY") }}</span>
              <span />
            </div>
            <div
              v-for="widget in ruleRows"
              :key="widget.id"
              class="dash-config__rule"
              :class="{ 'dash-config__rule--open': editing === widget.id }"
            >
              <div class="dash-config__rule-row">
                <div class="dash-config__rule-widget">
                  <strong>{{ widget.label }}</strong>
                  <small>{{ widget.permission }}</small>
                </div>
                <div class="dash-config__rule-chips">
                  <span
                    v-if="widget.everyone"
                    class="dash-config__chip dash-config__chip--danger"
                  >
                    <VcIcon
                      icon="lucide-eye-off"
                      size="xs"
                    />
                    {{ $t("PLATFORM.DASHBOARD.HIDDEN_ALL") }}
                  </span>
                  <template v-else-if="widget.roles.length">
                    <span class="dash-config__chip-label">{{ $t("PLATFORM.DASHBOARD.HIDDEN_FROM") }}</span>
                    <span
                      v-for="role in widget.roles"
                      :key="role.id"
                      class="dash-config__chip"
                    >
                      {{ role.name }}
                    </span>
                  </template>
                  <span
                    v-else
                    class="dash-config__chip dash-config__chip--ok"
                  >
                    <VcIcon
                      icon="lucide-eye"
                      size="xs"
                    />
                    {{
                      widget.permissions?.length
                        ? $t("PLATFORM.DASHBOARD.SHOWN_ALL")
                        : $t("SHELL.DASHBOARD.NO_PERMISSION")
                    }}
                  </span>
                </div>
                <button
                  type="button"
                  class="dash-config__icon"
                  :title="$t('PLATFORM.DASHBOARD.EDIT_RULE')"
                  :aria-label="`${$t('PLATFORM.DASHBOARD.EDIT_RULE')}: ${widget.label}`"
                  :aria-expanded="editing === widget.id"
                  @click="toggleEditor(widget.id)"
                >
                  <VcIcon
                    :icon="editing === widget.id ? 'lucide-chevron-up' : 'lucide-pencil'"
                    size="s"
                  />
                </button>
              </div>

              <!-- the widget's rule -->
              <div
                v-if="editing === widget.id"
                class="dash-config__editor"
              >
                <fieldset class="dash-config__options">
                  <legend>{{ $t("PLATFORM.DASHBOARD.WHO_SEES") }}</legend>
                  <label
                    v-for="option in modeOptions"
                    :key="option.value"
                    class="dash-config__option"
                    :class="{ 'dash-config__option--on': editor.mode === option.value }"
                  >
                    <input
                      v-model="editor.mode"
                      type="radio"
                      :value="option.value"
                      :name="`mode-${widget.id}`"
                    />
                    <span>
                      <strong>{{ option.title }}</strong>
                      <small>{{ option.hint }}</small>
                    </span>
                  </label>
                </fieldset>

                <div
                  v-if="editor.mode === 'roles'"
                  class="dash-config__roles"
                >
                  <div class="dash-config__roles-head">
                    <input
                      v-model="roleSearch"
                      type="search"
                      class="dash-config__search"
                      :placeholder="$t('PLATFORM.DASHBOARD.SEARCH_ROLES')"
                      :aria-label="$t('PLATFORM.DASHBOARD.SEARCH_ROLES')"
                    />
                    <span class="dash-config__muted">
                      {{ $t("PLATFORM.DASHBOARD.SELECTED", { count: editor.roles.length }) }}
                    </span>
                  </div>
                  <div class="dash-config__role-list">
                    <label
                      v-for="role in visibleRoles"
                      :key="role.id"
                      class="dash-config__role"
                      :class="{ 'dash-config__role--off': role.blind }"
                    >
                      <input
                        v-model="editor.roles"
                        type="checkbox"
                        :value="role.id"
                        :disabled="role.blind && !editor.roles.includes(role.id)"
                      />
                      <span>{{ role.name }}</span>
                      <small v-if="role.blind">{{ $t("PLATFORM.DASHBOARD.NO_PERMISSION_ROLE") }}</small>
                    </label>
                    <p
                      v-if="!visibleRoles.length"
                      class="dash-config__muted"
                    >
                      {{ $t("PLATFORM.DASHBOARD.NO_ROLES_FOUND") }}
                    </p>
                  </div>
                  <p class="dash-config__muted">{{ $t("PLATFORM.DASHBOARD.ROLES_RULE") }}</p>
                </div>

                <div class="dash-config__actions dash-config__actions--end">
                  <button
                    type="button"
                    class="dash-config__button"
                    @click="editing = ''"
                  >
                    {{ $t("PLATFORM.DASHBOARD.CANCEL") }}
                  </button>
                  <button
                    type="button"
                    class="dash-config__button dash-config__button--primary"
                    :disabled="editor.mode === 'roles' && !editor.roles.length"
                    @click="applyEditor(widget.id)"
                  >
                    {{ $t("PLATFORM.DASHBOARD.APPLY") }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- what users may change on their Home (as in the Menu Editor), and the layout for everyone, set on Home -->
        <section v-if="tab === 'personalization'">
          <p class="dash-config__hint">{{ $t("PLATFORM.DASHBOARD.PERSONALIZATION_HINT") }}</p>
          <label
            v-for="item in personalizationItems"
            :key="item.key"
            class="dash-config__label"
          >
            <input
              v-model="personalization[item.key]"
              type="checkbox"
            />
            <span>
              <strong>{{ item.title }}</strong>
              <small>{{ item.hint }}</small>
            </span>
          </label>
          <h3 class="dash-config__subtitle">{{ $t("PLATFORM.DASHBOARD.LAYOUT_TITLE") }}</h3>
          <p class="dash-config__hint">{{ $t("PLATFORM.DASHBOARD.LAYOUT_HINT") }}</p>
          <div class="dash-config__actions">
            <button
              type="button"
              class="dash-config__button dash-config__button--primary"
              :disabled="dirty"
              :title="dirty ? $t('PLATFORM.DASHBOARD.SAVE_FIRST') : undefined"
              @click="customizeOnHome"
            >
              {{ $t("PLATFORM.DASHBOARD.CUSTOMIZE_ON_HOME") }}
            </button>
            <button
              type="button"
              class="dash-config__button"
              :disabled="dirty"
              @click="resetUserLayouts"
            >
              {{ $t("PLATFORM.DASHBOARD.RESET_USERS") }}
            </button>
          </div>
          <p class="dash-config__meta">
            {{ $t("PLATFORM.DASHBOARD.PLACED", { count: placedCount }) }} ·
            {{ $t("PLATFORM.DASHBOARD.LAYOUT_VERSION", { version: global.layoutVersion ?? 0 }) }}
          </p>
        </section>
      </div>
    </div>
  </VcBlade>
</template>

<script lang="ts" setup>
import { notification, useBlade, useBladeStack, useDashboard, usePopup, type IBladeToolbar } from "@vc-shell/framework";
import { VcBlade, VcIcon } from "@vc-shell/framework/ui";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { adminDashboardApi } from "../../../../api/adminDashboard";
import {
  hiddenIn,
  layoutIn,
  roleCanSee,
  toPatch,
  type DashboardPatch,
  type DashboardPersonalization,
  type WidgetLayout,
} from "../../../../shell/dashboard/layers";
import type { DashboardDocument } from "./document";
import { useLeaveGuard } from "../../../../shell/leaveGuard";
import { refreshItem } from "../../composables/blade";

defineBlade({
  url: "/dashboard-configurator",
  name: "PlatformDashboardConfigurator",
  isWorkspace: true,
  permissions: ["admin-shell:dashboard:manage"],
});

const { t, te } = useI18n({ useScope: "global" });
const { showConfirmation } = usePopup();
const router = useRouter();
const { closeBlade, blades } = useBladeStack();
// the whole width, and half of it while the JSON blade is open beside it (as the Menu Editor)
const jsonOpen = computed(() => blades.value.some((x: { name: string }) => x.name === "PlatformDashboardEditorJson"));
const { openBlade, exposeToChildren } = useBlade();
const registry = useDashboard();

type Tab = "rules" | "personalization";
const tab = ref<Tab>("rules");
const tabs = computed<{ id: Tab; title: string }[]>(() => [
  { id: "rules", title: t("PLATFORM.DASHBOARD.TAB_RULES") },
  // the Menu Editor's name for the same tab
  { id: "personalization", title: t("PLATFORM.MENU_EDITOR.TABS.PERSONALIZATION") },
]);

const loading = ref(false);
const error = ref("");

/* ---- rules: a widget hidden from a scope. Each scope is a layer: everyone is the global one, a role its own ---- */

/** Who a rule hides the widget from; a new kind of scope (an account type, a user) is one more case here */
type RuleScope = { type: "everyone" } | { type: "role"; roleId: string };
interface Rule {
  widgetId: string;
  scope: RuleScope;
}

const global = ref<DashboardPatch>({});
const roles = ref<{ id: string; name: string }[]>([]);
const rolePermissions = ref(new Map<string, string[]>());
const rules = ref<Rule[]>([]);
// the rules as loaded, to see what changed and which layers to save
const savedRules = ref<Rule[]>([]);

const scopeKey = (scope: RuleScope) => (scope.type === "everyone" ? "everyone" : `role:${scope.roleId}`);
const ruleKey = (rule: Rule) => `${rule.widgetId}|${scopeKey(rule.scope)}`;
const byText = (a: string, b: string) => a.localeCompare(b);
const rulesKey = (list: Rule[]) => list.map(ruleKey).sort(byText).join();

// a widget's name is a translation key or a text; a widget without one shows its id
function labelOf(name: string, id: string) {
  if (!name) return id;
  return te(name) ? t(name) : name;
}
// every widget installed here (the administrator's permissions allow them all), with the permission it needs
const widgets = computed(() =>
  registry.getWidgets().map((w) => ({
    id: w.id,
    label: labelOf(w.name, w.id),
    permissions: w.permissions,
    permission: w.permissions?.length
      ? t("SHELL.DASHBOARD.PERMISSION", { permission: w.permissions.join(", ") })
      : t("SHELL.DASHBOARD.NO_PERMISSION"),
  })),
);
const roleName = (id: string) => roles.value.find((r) => r.id === id)?.name ?? id;

// a row per widget, and one for each id a rule names that isn't installed here
const ruleRows = computed(() => {
  const installed = new Set(widgets.value.map((w) => w.id));
  const others = [...new Set(rules.value.map((r) => r.widgetId))]
    .filter((id) => !installed.has(id))
    .map((id) => ({ id, label: id, permissions: undefined, permission: t("PLATFORM.DASHBOARD.NOT_INSTALLED") }));
  return [...widgets.value, ...others]
    .map((w) => {
      const own = rules.value.filter((r) => r.widgetId === w.id);
      return {
        ...w,
        everyone: own.some((r) => r.scope.type === "everyone"),
        roles: own
          .flatMap((r) => (r.scope.type === "role" ? [{ id: r.scope.roleId, name: roleName(r.scope.roleId) }] : []))
          .sort((a, b) => a.name.localeCompare(b.name)),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
});

/* ---- a widget's rule, edited below its row ---- */

type Mode = "shown" | "everyone" | "roles";
const editing = ref("");
const editor = ref<{ mode: Mode; roles: string[] }>({ mode: "shown", roles: [] });
const roleSearch = ref("");
const modeOptions = computed<{ value: Mode; title: string; hint: string }[]>(() => [
  { value: "shown", title: t("PLATFORM.DASHBOARD.MODE_SHOWN"), hint: t("PLATFORM.DASHBOARD.MODE_SHOWN_HINT") },
  { value: "everyone", title: t("PLATFORM.DASHBOARD.MODE_EVERYONE"), hint: t("PLATFORM.DASHBOARD.MODE_EVERYONE_HINT") },
  { value: "roles", title: t("PLATFORM.DASHBOARD.MODE_ROLES"), hint: t("PLATFORM.DASHBOARD.MODE_ROLES_HINT") },
]);

async function toggleEditor(widgetId: string) {
  if (editing.value === widgetId) {
    editing.value = "";
    return;
  }
  const own = rules.value.filter((r) => r.widgetId === widgetId);
  const roleIds = own.flatMap((r) => (r.scope.type === "role" ? [r.scope.roleId] : []));
  let mode: Mode = "shown";
  if (own.some((r) => r.scope.type === "everyone")) mode = "everyone";
  else if (roleIds.length) mode = "roles";
  editor.value = { mode, roles: roleIds };
  roleSearch.value = "";
  editing.value = widgetId;
}

// a role without the widget's permission doesn't see it anyway: it can't be picked (only unpicked)
const editedWidget = computed(() => ruleRows.value.find((w) => w.id === editing.value));
const visibleRoles = computed(() => {
  const text = roleSearch.value.trim().toLowerCase();
  return roles.value
    .filter((r) => !text || r.name.toLowerCase().includes(text))
    .map((r) => {
      const held = rolePermissions.value.get(r.id);
      return { ...r, blind: !!held && !roleCanSee(editedWidget.value?.permissions, held) };
    });
});

function applyEditor(widgetId: string) {
  const others = rules.value.filter((r) => r.widgetId !== widgetId);
  let mine: Rule[] = [];
  if (editor.value.mode === "everyone") mine = [{ widgetId, scope: { type: "everyone" } }];
  else if (editor.value.mode === "roles")
    mine = editor.value.roles.map((roleId): Rule => ({ widgetId, scope: { type: "role", roleId } }));
  rules.value = [...others, ...mine];
  editing.value = "";
}

/* ---- the layout for everyone and what users may change ---- */

const placedCount = computed(() => Object.keys(layout.value).length);
const personalization = ref<DashboardPersonalization>({ allowMove: true, allowResize: true });
const savedPersonalization = ref("");
const personalizationItems = computed<{ key: keyof DashboardPersonalization; title: string; hint: string }[]>(() => [
  { key: "allowMove", title: t("PLATFORM.DASHBOARD.ALLOW_MOVE"), hint: t("PLATFORM.DASHBOARD.ALLOW_MOVE_HINT") },
  { key: "allowResize", title: t("PLATFORM.DASHBOARD.ALLOW_RESIZE"), hint: t("PLATFORM.DASHBOARD.ALLOW_RESIZE_HINT") },
]);

// the places and sizes for everyone, as loaded and as edited (by the JSON blade, or Undo all)
const layout = ref<Record<string, WidgetLayout>>({});
const savedLayout = ref("{}");
const layoutChanged = computed(() => JSON.stringify(layout.value) !== savedLayout.value);

const dirty = computed(
  () =>
    rulesKey(rules.value) !== rulesKey(savedRules.value) ||
    layoutChanged.value ||
    JSON.stringify(personalization.value) !== savedPersonalization.value,
);
useLeaveGuard(dirty, "/dashboard-configurator", () => t("PLATFORM.COMMON.CLOSE_CONFIRMATION"));

async function load() {
  loading.value = true;
  error.value = "";
  try {
    // every role with its permissions and its rules comes in one answer
    const [patch, value, found] = await Promise.all([
      adminDashboardApi.getGlobal(),
      adminDashboardApi.getPersonalization(),
      adminDashboardApi.getRoles(),
    ]);
    global.value = patch ?? {};
    roles.value = (found ?? []).map((r) => ({ id: r.id, name: r.name || r.id }));
    rolePermissions.value = new Map((found ?? []).map((r) => [r.id, r.permissions ?? []]));
    rules.value = [
      ...hiddenIn(global.value.widgets).map((widgetId): Rule => ({ widgetId, scope: { type: "everyone" } })),
      ...(found ?? []).flatMap((role) =>
        hiddenIn(role.dashboard?.widgets).map((widgetId): Rule => ({
          widgetId,
          scope: { type: "role", roleId: role.id },
        })),
      ),
    ];
    savedRules.value = [...rules.value];
    layout.value = layoutIn(global.value.widgets);
    savedLayout.value = JSON.stringify(layout.value);
    personalization.value = { allowMove: value?.allowMove ?? true, allowResize: value?.allowResize ?? true };
    savedPersonalization.value = JSON.stringify(personalization.value);
    editing.value = "";
  } catch (e) {
    error.value = String((e as Error).message ?? e);
  } finally {
    loading.value = false;
  }
}

// the hidden widgets of each layer the rules touch; a layer with none left is saved empty
function hiddenBy(list: Rule[]) {
  const byScope = new Map<string, string[]>();
  for (const rule of list) {
    const key = scopeKey(rule.scope);
    byScope.set(key, [...(byScope.get(key) ?? []), rule.widgetId]);
  }
  return byScope;
}

async function save() {
  loading.value = true;
  error.value = "";
  try {
    const before = hiddenBy(savedRules.value);
    const after = hiddenBy(rules.value);
    const same = (a: string[] = [], b: string[] = []) => [...a].sort(byText).join() === [...b].sort(byText).join();
    for (const key of new Set([...before.keys(), ...after.keys()])) {
      if (key === "everyone" && layoutChanged.value) continue; // saved below with the layout
      if (same(before.get(key), after.get(key))) continue;
      const hidden = after.get(key) ?? [];
      if (key === "everyone") {
        // the places and sizes set on Home stay as they are
        await adminDashboardApi.saveGlobal({ widgets: toPatch(hidden, layout.value) });
      } else {
        await adminDashboardApi.saveRole(key.slice(5), { widgets: toPatch(hidden, {}) });
      }
    }
    if (layoutChanged.value) {
      await adminDashboardApi.saveGlobal({ widgets: toPatch(after.get("everyone") ?? [], layout.value) });
    }
    if (JSON.stringify(personalization.value) !== savedPersonalization.value) {
      await adminDashboardApi.savePersonalization(personalization.value);
    }
    notification.success(t("PLATFORM.COMMON.SAVED"));
    await load();
  } catch (e) {
    error.value = String((e as Error).message ?? e);
    loading.value = false;
  }
}

function reset() {
  rules.value = [...savedRules.value];
  layout.value = JSON.parse(savedLayout.value);
  personalization.value = JSON.parse(savedPersonalization.value);
  editing.value = "";
}

async function customizeOnHome() {
  await closeBlade(0);
  await router.push({ path: "/", query: { customize: "1" } });
}

async function resetUserLayouts() {
  if (!(await showConfirmation(t("PLATFORM.DASHBOARD.RESET_USERS_CONFIRM")))) return;
  try {
    await adminDashboardApi.saveGlobal(global.value, true);
    notification.success(t("PLATFORM.DASHBOARD.RESET_USERS_DONE"));
    await load();
  } catch (e) {
    error.value = String((e as Error).message ?? e);
  }
}

/* ---- the whole dashboard as a document (Edit as JSON), and Undo all changes ---- */

/** Roles by name, so a document moves between environments; a role the document names that isn't here is refused */
function toDocument(): DashboardDocument {
  const byScope = hiddenBy(rules.value);
  const roleRules: Record<string, string[]> = {};
  for (const role of [...roles.value].sort((a, b) => a.name.localeCompare(b.name))) {
    const hidden = byScope.get(`role:${role.id}`);
    if (hidden?.length) roleRules[role.name] = [...hidden].sort(byText);
  }
  return {
    everyone: { widgets: toPatch(byScope.get("everyone") ?? [], layout.value) },
    roles: roleRules,
    personalization: { ...personalization.value },
  };
}

function applyDocument(doc: DashboardDocument) {
  const byName = new Map(roles.value.map((r) => [r.name, r.id]));
  const unknown = Object.keys(doc.roles ?? {}).filter((name) => !byName.has(name));
  if (unknown.length) throw new Error(t("PLATFORM.DASHBOARD.JSON_UNKNOWN_ROLES", { roles: unknown.join(", ") }));
  rules.value = [
    ...hiddenIn(doc.everyone?.widgets).map((widgetId): Rule => ({ widgetId, scope: { type: "everyone" } })),
    ...Object.entries(doc.roles ?? {}).flatMap(([name, ids]) =>
      (ids ?? []).map((widgetId): Rule => ({ widgetId, scope: { type: "role", roleId: byName.get(name)! } })),
    ),
  ];
  layout.value = layoutIn(doc.everyone?.widgets);
  personalization.value = {
    allowMove: doc.personalization?.allowMove ?? true,
    allowResize: doc.personalization?.allowResize ?? true,
  };
  editing.value = "";
}

exposeToChildren({
  getDocument: () => toDocument(),
  applyDocument: (doc: DashboardDocument) => applyDocument(doc),
});

const hasAnything = computed(
  () =>
    rules.value.length > 0 ||
    Object.keys(layout.value).length > 0 ||
    !personalization.value.allowMove ||
    !personalization.value.allowResize,
);

// back to the modules' own dashboard: no rules, the modules' places and sizes, users may change theirs. Saved with Save
async function undoAll() {
  if (!(await showConfirmation(t("PLATFORM.DASHBOARD.UNDO_ALL_CONFIRM")))) return;
  rules.value = [];
  layout.value = {};
  personalization.value = { allowMove: true, allowResize: true };
  editing.value = "";
}

const toolbar = computed<IBladeToolbar[]>(() => [
  {
    id: "save",
    title: t("PLATFORM.COMMON.SAVE"),
    icon: "lucide-save",
    disabled: !dirty.value,
    clickHandler: () => save(),
  },
  {
    id: "reset",
    title: t("PLATFORM.COMMON.RESET"),
    icon: "lucide-undo-2",
    disabled: !dirty.value,
    clickHandler: () => reset(),
  },
  refreshItem(() => load()),
  {
    id: "json",
    // the settings screen's and the Menu Editor's name for the same kind of view
    title: t("PLATFORM.SETTINGS.LIST.EDIT_JSON"),
    icon: "lucide-braces",
    clickHandler: () => openBlade({ name: "PlatformDashboardEditorJson" }),
  },
  {
    id: "undo-all",
    title: t("PLATFORM.MENU_EDITOR.UNDO_ALL"),
    icon: "lucide-rotate-ccw",
    disabled: !hasAnything.value,
    clickHandler: () => undoAll(),
  },
]);

load();
</script>

<style lang="scss">
.dash-config {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.dash-config__tabs {
  border-bottom: 1px solid var(--color-neutral-200);
  display: flex;
  flex: none;
  gap: 4px;
  overflow-x: auto;
  padding: 0 16px;
}

.dash-config__tab {
  background: none;
  border: 0;
  border-bottom: 2px solid transparent;
  color: var(--color-neutral-600);
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  padding: 10px 12px;
  white-space: nowrap;
}

.dash-config__tab--active {
  border-bottom-color: var(--color-primary-500);
  color: var(--color-primary-600);
  font-weight: 600;
}

.dash-config__body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.dash-config__hint,
.dash-config__meta {
  color: var(--color-neutral-600);
  font-size: 13px;
  margin: 0 0 12px;
  max-width: 860px;
}

.dash-config__meta {
  font-size: 12px;
}

.dash-config__muted {
  color: var(--color-neutral-500);
  font-size: 12px;
  margin: 0;
}

.dash-config__subtitle {
  font-size: 14px;
  margin: 24px 0 8px;
}

.dash-config__error {
  color: var(--color-danger-500);
  font-size: 13px;
  margin: 0 0 12px;
}

.dash-config__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.dash-config__actions--end {
  justify-content: flex-end;
  margin: 0;
}

.dash-config__button {
  background: var(--color-neutral-0);
  border: 1px solid var(--color-neutral-300);
  border-radius: 6px;
  color: var(--color-neutral-800);
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  height: 32px;
  padding: 0 14px;

  &:disabled {
    cursor: default;
    opacity: 0.6;
  }
}

.dash-config__button--primary {
  background: var(--color-primary-500);
  border-color: var(--color-primary-500);
  color: var(--color-neutral-0);
}

/* the rules list: a row per widget, its rule opening below it */
.dash-config__rules {
  border: 1px solid var(--color-neutral-200);
  border-radius: 8px;
  container: dash-rules / inline-size;
  max-width: 860px;
  overflow: hidden;
}

.dash-config__rules-head,
.dash-config__rule-row {
  align-items: center;
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(180px, 2fr) minmax(200px, 3fr) 36px;
  padding: 10px 12px;
}

.dash-config__rules-head {
  background: var(--color-neutral-50);
  color: var(--color-neutral-600);
  font-size: 12px;
  font-weight: 600;
}

.dash-config__rule {
  border-top: 1px solid var(--color-neutral-100);
}

.dash-config__rule--open {
  background: var(--color-neutral-50);
}

.dash-config__rule-widget {
  display: flex;
  flex-direction: column;
  font-size: 13px;
  gap: 2px;
  min-width: 0;

  small {
    color: var(--color-neutral-500);
    font-size: 11px;
  }
}

.dash-config__rule-chips {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
}

.dash-config__chip-label {
  color: var(--color-neutral-500);
  font-size: 12px;
}

.dash-config__chip {
  align-items: center;
  background: var(--color-neutral-100);
  border-radius: 999px;
  color: var(--color-neutral-700);
  display: inline-flex;
  font-size: 12px;
  gap: 4px;
  padding: 2px 10px;
  white-space: nowrap;
}

.dash-config__chip--ok {
  background: var(--color-success-50, var(--color-neutral-100));
  color: var(--color-success-700, var(--color-neutral-700));
}

.dash-config__chip--danger {
  background: var(--color-danger-50, var(--color-neutral-100));
  color: var(--color-danger-700, var(--color-neutral-700));
}

.dash-config__icon {
  align-items: center;
  background: none;
  border: 0;
  border-radius: 6px;
  color: var(--color-neutral-500);
  cursor: pointer;
  display: inline-flex;
  height: 32px;
  justify-content: center;
  width: 32px;

  &:hover,
  &[aria-expanded="true"] {
    background: var(--color-neutral-100);
    color: var(--color-primary-500);
  }
}

/* narrow (a phone, a narrow blade): who sees it goes below the widget's name, so the pencil stays in reach */
@container dash-rules (max-width: 560px) {
  .dash-config__rules-head {
    display: none;
  }

  .dash-config__rule-row {
    grid-template-columns: minmax(0, 1fr) 36px;
  }

  .dash-config__rule-chips {
    grid-column: 1 / -1;
    grid-row: 2;
  }
}

.dash-config__editor {
  border-top: 1px dashed var(--color-neutral-200);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 12px 14px;
}

.dash-config__options {
  border: 0;
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  margin: 0;
  padding: 0;

  legend {
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 6px;
  }
}

.dash-config__option {
  align-items: flex-start;
  background: var(--color-neutral-0);
  border: 1px solid var(--color-neutral-200);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  font-size: 13px;
  gap: 8px;
  padding: 10px 12px;

  span {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  small {
    color: var(--color-neutral-500);
    font-size: 11px;
  }

  input {
    margin-top: 3px;
  }
}

.dash-config__option--on {
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 1px var(--color-primary-500);
}

.dash-config__roles {
  background: var(--color-neutral-0);
  border: 1px solid var(--color-neutral-200);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
}

.dash-config__roles-head {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.dash-config__search {
  border: 1px solid var(--color-neutral-300);
  border-radius: 6px;
  flex: 1;
  font-family: inherit;
  font-size: 13px;
  height: 32px;
  max-width: 320px;
  padding: 0 10px;
}

.dash-config__role-list {
  display: grid;
  gap: 2px 16px;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  max-height: 240px;
  overflow-y: auto;
}

.dash-config__role {
  align-items: center;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  font-size: 13px;
  gap: 8px;
  padding: 4px 6px;

  &:hover {
    background: var(--color-neutral-50);
  }

  small {
    color: var(--color-neutral-500);
    font-size: 11px;
    margin-left: auto;
  }
}

.dash-config__role--off {
  color: var(--color-neutral-400);
  cursor: default;
}

.dash-config__label {
  align-items: flex-start;
  cursor: pointer;
  display: flex;
  font-size: 13px;
  gap: 8px;
  margin-bottom: 12px;

  span {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  small {
    color: var(--color-neutral-500);
  }

  input {
    margin-top: 3px;
  }
}
</style>
