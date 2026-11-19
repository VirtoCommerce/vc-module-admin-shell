<template>
  <VcBlade
    :title="$t('PLATFORM.DASHBOARD.TITLE')"
    :toolbar-items="toolbar"
    :loading="loading"
    :modified="dirty"
    width="100%"
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

        <!-- rules: which widget is hidden from whom (everyone, a role; more kinds can follow) -->
        <section v-if="tab === 'rules'">
          <p class="dash-config__hint">{{ $t("PLATFORM.DASHBOARD.RULES_HINT") }}</p>
          <div class="dash-config__actions">
            <button
              type="button"
              class="dash-config__button dash-config__button--primary"
              :aria-expanded="adding"
              @click="startAdding"
            >
              {{ $t("PLATFORM.DASHBOARD.ADD_RULE") }}
            </button>
          </div>

          <form
            v-if="adding"
            class="dash-config__form"
            @submit.prevent="addRule"
          >
            <label class="dash-config__field">
              <span>{{ $t("PLATFORM.DASHBOARD.WIDGET") }}</span>
              <select v-model="draft.widgetId">
                <option
                  value=""
                  disabled
                >
                  {{ $t("PLATFORM.DASHBOARD.PICK_WIDGET") }}
                </option>
                <option
                  v-for="widget in widgetRows"
                  :key="widget.id"
                  :value="widget.id"
                >
                  {{ widget.label }}
                </option>
              </select>
              <small v-if="draftWidget">{{ draftWidget.permission }}</small>
            </label>
            <label class="dash-config__field">
              <span>{{ $t("PLATFORM.DASHBOARD.HIDE_FOR") }}</span>
              <select v-model="draft.scope">
                <option value="everyone">{{ $t("PLATFORM.DASHBOARD.EVERYONE") }}</option>
                <optgroup :label="$t('PLATFORM.DASHBOARD.ROLES')">
                  <option
                    v-for="role in roles"
                    :key="role.id"
                    :value="`role:${role.id}`"
                  >
                    {{ role.name }}
                  </option>
                </optgroup>
              </select>
            </label>
            <p
              v-if="draftProblem"
              class="dash-config__note"
            >
              {{ draftProblem }}
            </p>
            <div class="dash-config__actions">
              <button
                type="submit"
                class="dash-config__button dash-config__button--primary"
                :disabled="!draft.widgetId || !!draftProblem"
              >
                {{ $t("PLATFORM.DASHBOARD.ADD") }}
              </button>
              <button
                type="button"
                class="dash-config__button"
                @click="adding = false"
              >
                {{ $t("PLATFORM.DASHBOARD.CANCEL") }}
              </button>
            </div>
          </form>

          <table
            v-if="sortedRules.length"
            class="dash-config__table"
          >
            <thead>
              <tr>
                <th>{{ $t("PLATFORM.DASHBOARD.WIDGET") }}</th>
                <th>{{ $t("PLATFORM.DASHBOARD.HIDDEN_FOR") }}</th>
                <th>{{ $t("PLATFORM.DASHBOARD.PERMISSION") }}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="rule in sortedRules"
                :key="ruleKey(rule)"
              >
                <td>{{ rule.widgetLabel }}</td>
                <td>
                  <span
                    class="dash-config__chip"
                    :class="{ 'dash-config__chip--everyone': rule.scope.type === 'everyone' }"
                  >
                    {{ rule.scopeLabel }}
                  </span>
                </td>
                <td class="dash-config__muted">{{ rule.permission }}</td>
                <td class="dash-config__cell-action">
                  <button
                    type="button"
                    class="dash-config__icon"
                    :title="$t('PLATFORM.DASHBOARD.REMOVE_RULE')"
                    :aria-label="$t('PLATFORM.DASHBOARD.REMOVE_RULE')"
                    @click="removeRule(rule)"
                  >
                    <VcIcon
                      icon="lucide-trash-2"
                      size="s"
                    />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <p
            v-else
            class="dash-config__empty"
          >
            {{ $t("PLATFORM.DASHBOARD.NO_RULES") }}
          </p>
        </section>

        <!-- the layout for everyone, set on Home itself, and what users may change in theirs -->
        <section v-if="tab === 'layout'">
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
          <h3 class="dash-config__subtitle">{{ $t("PLATFORM.DASHBOARD.TAB_PERSONALIZATION") }}</h3>
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
        </section>

        <!-- the layer for everyone as JSON, for a backup or another environment -->
        <section v-if="tab === 'json'">
          <p class="dash-config__hint">{{ $t("PLATFORM.DASHBOARD.JSON_HINT") }}</p>
          <textarea
            v-model="jsonText"
            class="dash-config__json"
            spellcheck="false"
            :aria-invalid="!!jsonError"
          />
          <p
            v-if="jsonError"
            class="dash-config__error"
          >
            {{ jsonError }}
          </p>
          <div class="dash-config__actions">
            <button
              type="button"
              class="dash-config__button dash-config__button--primary"
              :disabled="!!jsonError"
              @click="applyJson"
            >
              {{ $t("PLATFORM.DASHBOARD.APPLY_JSON") }}
            </button>
          </div>
        </section>
      </div>
    </div>
  </VcBlade>
</template>

<script lang="ts" setup>
import {
  notification,
  SecurityClient,
  useApiClient,
  useBladeStack,
  useDashboard,
  usePopup,
  type IBladeToolbar,
} from "@vc-shell/framework";
import { VcBlade, VcIcon } from "@vc-shell/framework/ui";
import { computed, ref, watch } from "vue";
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
} from "../../../../shell/dashboard/layers";
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
const { closeBlade } = useBladeStack();
const { getApiClient } = useApiClient(SecurityClient);
const registry = useDashboard();

type Tab = "rules" | "layout" | "json";
const tab = ref<Tab>("rules");
const tabs = computed<{ id: Tab; title: string }[]>(() => [
  { id: "rules", title: t("PLATFORM.DASHBOARD.TAB_RULES") },
  { id: "layout", title: t("PLATFORM.DASHBOARD.TAB_LAYOUT") },
  { id: "json", title: t("PLATFORM.SETTINGS.LIST.EDIT_JSON") },
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
const rolePermissions = new Map<string, string[]>();
const rules = ref<Rule[]>([]);
const savedRules = ref("");
// the rules as loaded, to see which layers changed
const savedRulesList = ref<Rule[]>([]);

const scopeKey = (scope: RuleScope) => (scope.type === "everyone" ? "everyone" : `role:${scope.roleId}`);
const ruleKey = (rule: Rule) => `${rule.widgetId}|${scopeKey(rule.scope)}`;
const rulesKey = (list: Rule[]) => list.map(ruleKey).sort().join();

function labelOf(name: string, id: string) {
  return name ? (te(name) ? t(name) : name) : id;
}
// every widget installed here (the administrator's permissions allow them all), with the permission it needs
const widgetRows = computed(() =>
  registry
    .getWidgets()
    .map((w) => ({
      id: w.id,
      label: labelOf(w.name, w.id),
      permissions: w.permissions,
      permission: w.permissions?.length
        ? t("SHELL.DASHBOARD.PERMISSION", { permission: w.permissions.join(", ") })
        : t("SHELL.DASHBOARD.NO_PERMISSION"),
    }))
    .sort((a, b) => a.label.localeCompare(b.label)),
);
const widgetById = computed(() => new Map(widgetRows.value.map((w) => [w.id, w])));

function scopeLabel(scope: RuleScope) {
  if (scope.type === "everyone") return t("PLATFORM.DASHBOARD.EVERYONE");
  const name = roles.value.find((r) => r.id === scope.roleId)?.name ?? scope.roleId;
  return t("PLATFORM.DASHBOARD.ROLE_SCOPE", { name });
}
// everyone first, then by widget; a widget that isn't installed here shows by its id
const sortedRules = computed(() =>
  rules.value
    .map((rule) => {
      const widget = widgetById.value.get(rule.widgetId);
      return {
        ...rule,
        widgetLabel: widget?.label ?? rule.widgetId,
        permission: widget?.permission ?? t("PLATFORM.DASHBOARD.NOT_INSTALLED"),
        scopeLabel: scopeLabel(rule.scope),
      };
    })
    .sort(
      (a, b) =>
        Number(b.scope.type === "everyone") - Number(a.scope.type === "everyone") ||
        a.widgetLabel.localeCompare(b.widgetLabel) ||
        a.scopeLabel.localeCompare(b.scopeLabel),
    ),
);

// the new rule's form
const adding = ref(false);
const draft = ref({ widgetId: "", scope: "everyone" });
const draftWidget = computed(() => widgetById.value.get(draft.value.widgetId));
const draftScope = computed<RuleScope>(() =>
  draft.value.scope === "everyone" ? { type: "everyone" } : { type: "role", roleId: draft.value.scope.slice(5) },
);
const draftPermissions = ref<string[] | undefined>();
watch(
  () => draft.value.scope,
  async (value) => {
    draftPermissions.value = undefined;
    if (!value.startsWith("role:")) return;
    draftPermissions.value = await permissionsOf(value.slice(5));
  },
);
// a rule that is there already, or a role that can't see the widget anyway, isn't added
const draftProblem = computed(() => {
  if (!draft.value.widgetId) return "";
  const rule = { widgetId: draft.value.widgetId, scope: draftScope.value };
  if (rules.value.some((r) => ruleKey(r) === ruleKey(rule))) return t("PLATFORM.DASHBOARD.RULE_EXISTS");
  if (
    rule.scope.type === "role" &&
    draftPermissions.value &&
    !roleCanSee(draftWidget.value?.permissions, draftPermissions.value)
  )
    return t("PLATFORM.DASHBOARD.ROLE_LACKS");
  return "";
});
async function permissionsOf(roleId: string) {
  if (!rolePermissions.has(roleId)) {
    const name = roles.value.find((r) => r.id === roleId)?.name ?? roleId;
    const role = await (await getApiClient()).getRole(name);
    rolePermissions.set(roleId, (role.permissions ?? []).map((p) => p.name!).filter(Boolean));
  }
  return rolePermissions.get(roleId)!;
}
function startAdding() {
  draft.value = { widgetId: "", scope: "everyone" };
  adding.value = !adding.value;
}
function addRule() {
  if (!draft.value.widgetId || draftProblem.value) return;
  rules.value = [...rules.value, { widgetId: draft.value.widgetId, scope: draftScope.value }];
  adding.value = false;
}
function removeRule(rule: Rule) {
  rules.value = rules.value.filter((r) => ruleKey(r) !== ruleKey(rule));
}

/* ---- the layout for everyone and what users may change ---- */

const placedCount = computed(() => Object.keys(layoutIn(global.value.widgets)).length);
const personalization = ref<DashboardPersonalization>({ allowMove: true, allowResize: true });
const savedPersonalization = ref("");
const personalizationItems = computed<{ key: keyof DashboardPersonalization; title: string; hint: string }[]>(() => [
  { key: "allowMove", title: t("PLATFORM.DASHBOARD.ALLOW_MOVE"), hint: t("PLATFORM.DASHBOARD.ALLOW_MOVE_HINT") },
  { key: "allowResize", title: t("PLATFORM.DASHBOARD.ALLOW_RESIZE"), hint: t("PLATFORM.DASHBOARD.ALLOW_RESIZE_HINT") },
]);

const dirty = computed(
  () =>
    rulesKey(rules.value) !== savedRules.value || JSON.stringify(personalization.value) !== savedPersonalization.value,
);
useLeaveGuard(dirty, "/dashboard-configurator", () => t("PLATFORM.COMMON.CLOSE_CONFIRMATION"));

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const [patch, value, found] = await Promise.all([
      adminDashboardApi.getGlobal(),
      adminDashboardApi.getPersonalization(),
      (await getApiClient()).searchRoles({ sort: "name:asc", take: 1000 }),
    ]);
    global.value = patch ?? {};
    roles.value = (found.results ?? []).map((r) => ({ id: r.id!, name: r.name ?? r.id! }));
    const rolePatches = await Promise.all(roles.value.map((r) => adminDashboardApi.getRole(r.id)));
    rules.value = [
      ...hiddenIn(global.value.widgets).map((widgetId): Rule => ({ widgetId, scope: { type: "everyone" } })),
      ...roles.value.flatMap((role, i) =>
        hiddenIn(rolePatches[i]?.widgets).map((widgetId): Rule => ({
          widgetId,
          scope: { type: "role", roleId: role.id },
        })),
      ),
    ];
    savedRules.value = rulesKey(rules.value);
    savedRulesList.value = [...rules.value];
    personalization.value = { allowMove: value?.allowMove ?? true, allowResize: value?.allowResize ?? true };
    savedPersonalization.value = JSON.stringify(personalization.value);
    jsonText.value = JSON.stringify(global.value, null, 2);
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
    const before = hiddenBy(savedRulesList.value);
    const after = hiddenBy(rules.value);
    const same = (a: string[] = [], b: string[] = []) => [...a].sort().join() === [...b].sort().join();
    for (const key of new Set([...before.keys(), ...after.keys()])) {
      if (same(before.get(key), after.get(key))) continue;
      const hidden = after.get(key) ?? [];
      if (key === "everyone") {
        // the places and sizes set on Home stay as they are
        await adminDashboardApi.saveGlobal({ widgets: toPatch(hidden, layoutIn(global.value.widgets)) });
      } else {
        await adminDashboardApi.saveRole(key.slice(5), { widgets: toPatch(hidden, {}) });
      }
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
  rules.value = [...savedRulesList.value];
  personalization.value = JSON.parse(savedPersonalization.value);
  adding.value = false;
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

/* ---- JSON ---- */

const jsonText = ref("");
const jsonError = computed(() => {
  try {
    const value = JSON.parse(jsonText.value);
    if (!value || typeof value !== "object" || Array.isArray(value)) return t("PLATFORM.DASHBOARD.JSON_OBJECT");
    if (value.widgets !== undefined && (typeof value.widgets !== "object" || Array.isArray(value.widgets)))
      return t("PLATFORM.DASHBOARD.JSON_WIDGETS");
    return "";
  } catch (e) {
    return String((e as Error).message ?? e);
  }
});
async function applyJson() {
  if (!(await showConfirmation(t("PLATFORM.DASHBOARD.JSON_CONFIRM")))) return;
  try {
    await adminDashboardApi.saveGlobal(JSON.parse(jsonText.value));
    notification.success(t("PLATFORM.COMMON.SAVED"));
    await load();
  } catch (e) {
    error.value = String((e as Error).message ?? e);
  }
}
watch(tab, (value) => {
  if (value === "json") jsonText.value = JSON.stringify(global.value, null, 2);
});

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
.dash-config__meta,
.dash-config__empty {
  color: var(--color-neutral-600);
  font-size: 13px;
  margin: 0 0 12px;
  max-width: 820px;
}

.dash-config__meta {
  font-size: 12px;
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

.dash-config__note {
  color: var(--color-warning-700, var(--color-neutral-700));
  font-size: 12px;
  margin: 0;
  width: 100%;
}

.dash-config__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
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

.dash-config__form {
  align-items: flex-end;
  background: var(--color-neutral-50);
  border: 1px solid var(--color-neutral-200);
  border-radius: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
  margin-bottom: 16px;
  max-width: 820px;
  padding: 12px 16px;

  .dash-config__actions {
    margin: 0;
  }
}

.dash-config__field {
  display: flex;
  flex: 1 1 240px;
  flex-direction: column;
  font-size: 13px;
  gap: 4px;

  select {
    background: var(--color-neutral-0);
    border: 1px solid var(--color-neutral-300);
    border-radius: 6px;
    font-family: inherit;
    font-size: 13px;
    height: 36px;
    padding: 0 8px;
  }

  small {
    color: var(--color-neutral-500);
    font-size: 11px;
  }
}

.dash-config__table {
  border: 1px solid var(--color-neutral-200);
  border-collapse: separate;
  border-radius: 8px;
  border-spacing: 0;
  font-size: 13px;
  max-width: 820px;
  width: 100%;

  th {
    background: var(--color-neutral-50);
    color: var(--color-neutral-600);
    font-weight: 600;
    padding: 8px 12px;
    text-align: start;
  }

  td {
    border-top: 1px solid var(--color-neutral-100);
    padding: 8px 12px;
  }
}

.dash-config__muted {
  color: var(--color-neutral-500);
  font-size: 12px;
}

.dash-config__cell-action {
  text-align: end;
  width: 40px;
}

.dash-config__icon {
  background: none;
  border: 0;
  border-radius: 6px;
  color: var(--color-neutral-500);
  cursor: pointer;
  display: inline-flex;
  padding: 4px;

  &:hover {
    background: var(--color-neutral-100);
    color: var(--color-danger-500);
  }
}

.dash-config__chip {
  background: var(--color-neutral-100);
  border-radius: 999px;
  color: var(--color-neutral-700);
  font-size: 12px;
  padding: 2px 10px;
  white-space: nowrap;
}

.dash-config__chip--everyone {
  background: var(--color-primary-50);
  color: var(--color-primary-700);
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

.dash-config__json {
  border: 1px solid var(--color-neutral-300);
  border-radius: 6px;
  font-family: ui-monospace, monospace;
  font-size: 12px;
  height: 360px;
  margin-bottom: 8px;
  max-width: 820px;
  padding: 8px;
  width: 100%;
}
</style>
