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

        <!-- for everyone: the widgets hidden from everyone, the layout on Home, the users' layouts -->
        <section v-if="tab === 'everyone'">
          <p class="dash-config__hint">{{ $t("PLATFORM.DASHBOARD.EVERYONE_HINT") }}</p>
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
          <ul class="dash-config__list">
            <li
              v-for="widget in widgetRows"
              :key="widget.id"
              class="dash-config__row"
            >
              <label class="dash-config__label">
                <input
                  type="checkbox"
                  :checked="!globalHidden.includes(widget.id)"
                  @change="setHidden(globalHidden, widget.id, !($event.target as HTMLInputElement).checked)"
                />
                <span>{{ widget.label }}</span>
              </label>
              <span class="dash-config__permission">{{ widget.permission }}</span>
              <span
                v-if="globalHidden.includes(widget.id)"
                class="dash-config__chip"
              >
                {{ $t("PLATFORM.DASHBOARD.HIDDEN_FOR_EVERYONE") }}
              </span>
            </li>
          </ul>
        </section>

        <!-- per role: the widgets the role's users don't need; a widget the role has no permission for it can't see anyway -->
        <section v-if="tab === 'roles'">
          <p class="dash-config__hint">{{ $t("PLATFORM.DASHBOARD.ROLES_HINT") }}</p>
          <label class="dash-config__field">
            <span>{{ $t("PLATFORM.DASHBOARD.ROLE") }}</span>
            <select
              :value="roleId"
              @change="selectRole(($event.target as HTMLSelectElement).value)"
            >
              <option
                value=""
                disabled
              >
                {{ $t("PLATFORM.DASHBOARD.PICK_ROLE") }}
              </option>
              <option
                v-for="role in roles"
                :key="role.id"
                :value="role.id"
              >
                {{ role.name }}
              </option>
            </select>
          </label>
          <ul
            v-if="roleId"
            class="dash-config__list"
          >
            <li
              v-for="widget in widgetRows"
              :key="widget.id"
              class="dash-config__row"
              :class="{ 'dash-config__row--off': !roleCanSee(widget.permissions, rolePermissions) }"
            >
              <label class="dash-config__label">
                <input
                  type="checkbox"
                  :checked="!roleHidden.includes(widget.id) && roleCanSee(widget.permissions, rolePermissions)"
                  :disabled="!roleCanSee(widget.permissions, rolePermissions) || globalHidden.includes(widget.id)"
                  @change="setHidden(roleHidden, widget.id, !($event.target as HTMLInputElement).checked)"
                />
                <span>{{ widget.label }}</span>
              </label>
              <span class="dash-config__permission">{{ widget.permission }}</span>
              <span
                v-if="!roleCanSee(widget.permissions, rolePermissions)"
                class="dash-config__chip"
              >
                {{ $t("PLATFORM.DASHBOARD.ROLE_LACKS") }}
              </span>
              <span
                v-else-if="globalHidden.includes(widget.id)"
                class="dash-config__chip"
              >
                {{ $t("PLATFORM.DASHBOARD.HIDDEN_FOR_EVERYONE") }}
              </span>
            </li>
          </ul>
        </section>

        <!-- what users may change on their own Home -->
        <section v-if="tab === 'personalization'">
          <p class="dash-config__hint">{{ $t("PLATFORM.DASHBOARD.PERSONALIZATION_HINT") }}</p>
          <label
            v-for="item in personalizationItems"
            :key="item.key"
            class="dash-config__label dash-config__label--block"
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
import { VcBlade } from "@vc-shell/framework/ui";
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

type Tab = "everyone" | "roles" | "personalization" | "json";
const tab = ref<Tab>("everyone");
const tabs = computed<{ id: Tab; title: string }[]>(() => [
  { id: "everyone", title: t("PLATFORM.DASHBOARD.TAB_EVERYONE") },
  { id: "roles", title: t("PLATFORM.DASHBOARD.TAB_ROLES") },
  { id: "personalization", title: t("PLATFORM.DASHBOARD.TAB_PERSONALIZATION") },
  { id: "json", title: t("PLATFORM.SETTINGS.LIST.EDIT_JSON") },
]);

const loading = ref(false);
const error = ref("");

// the layer for everyone: its hidden widgets are edited here, its places and sizes on Home
const global = ref<DashboardPatch>({});
const globalHidden = ref<string[]>([]);
const savedGlobalHidden = ref<string[]>([]);
const placedCount = computed(() => Object.keys(layoutIn(global.value.widgets)).length);

const roles = ref<{ id: string; name: string }[]>([]);
const roleId = ref("");
const rolePermissions = ref<string[]>([]);
const roleHidden = ref<string[]>([]);
const savedRoleHidden = ref<string[]>([]);

const personalization = ref<DashboardPersonalization>({ allowHide: true, allowMove: true, allowResize: true });
const savedPersonalization = ref("");

const same = (a: string[], b: string[]) => [...a].sort().join() === [...b].sort().join();
const dirty = computed(
  () =>
    !same(globalHidden.value, savedGlobalHidden.value) ||
    (!!roleId.value && !same(roleHidden.value, savedRoleHidden.value)) ||
    JSON.stringify(personalization.value) !== savedPersonalization.value,
);
useLeaveGuard(dirty, "/dashboard-configurator", () => t("PLATFORM.COMMON.CLOSE_CONFIRMATION"));

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

const personalizationItems = computed<{ key: keyof DashboardPersonalization; title: string; hint: string }[]>(() => [
  { key: "allowHide", title: t("PLATFORM.DASHBOARD.ALLOW_HIDE"), hint: t("PLATFORM.DASHBOARD.ALLOW_HIDE_HINT") },
  { key: "allowMove", title: t("PLATFORM.DASHBOARD.ALLOW_MOVE"), hint: t("PLATFORM.DASHBOARD.ALLOW_MOVE_HINT") },
  { key: "allowResize", title: t("PLATFORM.DASHBOARD.ALLOW_RESIZE"), hint: t("PLATFORM.DASHBOARD.ALLOW_RESIZE_HINT") },
]);

function setHidden(list: string[], id: string, hidden: boolean) {
  const target = list === globalHidden.value ? globalHidden : roleHidden;
  target.value = hidden ? [...target.value.filter((x) => x !== id), id] : target.value.filter((x) => x !== id);
}

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
    globalHidden.value = hiddenIn(global.value.widgets);
    savedGlobalHidden.value = [...globalHidden.value];
    personalization.value = {
      allowHide: value?.allowHide ?? true,
      allowMove: value?.allowMove ?? true,
      allowResize: value?.allowResize ?? true,
    };
    savedPersonalization.value = JSON.stringify(personalization.value);
    roles.value = (found.results ?? []).map((r) => ({ id: r.id!, name: r.name ?? r.id! }));
    jsonText.value = JSON.stringify(global.value, null, 2);
    if (roleId.value) await selectRole(roleId.value, true);
  } catch (e) {
    error.value = String((e as Error).message ?? e);
  } finally {
    loading.value = false;
  }
}

async function selectRole(id: string, force = false) {
  if (!force && id === roleId.value) return;
  if (!force && roleId.value && !same(roleHidden.value, savedRoleHidden.value)) {
    if (!(await showConfirmation(t("PLATFORM.COMMON.CLOSE_CONFIRMATION")))) return;
  }
  roleId.value = id;
  try {
    const name = roles.value.find((r) => r.id === id)?.name ?? id;
    const [patch, role] = await Promise.all([adminDashboardApi.getRole(id), (await getApiClient()).getRole(name)]);
    rolePermissions.value = (role.permissions ?? []).map((p) => p.name!).filter(Boolean);
    roleHidden.value = hiddenIn(patch?.widgets);
    savedRoleHidden.value = [...roleHidden.value];
  } catch (e) {
    error.value = String((e as Error).message ?? e);
  }
}

async function save() {
  loading.value = true;
  error.value = "";
  try {
    if (!same(globalHidden.value, savedGlobalHidden.value)) {
      // the places and sizes set on Home stay as they are
      await adminDashboardApi.saveGlobal({ widgets: toPatch(globalHidden.value, layoutIn(global.value.widgets)) });
    }
    if (roleId.value && !same(roleHidden.value, savedRoleHidden.value)) {
      await adminDashboardApi.saveRole(roleId.value, { widgets: toPatch(roleHidden.value, {}) });
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
  globalHidden.value = [...savedGlobalHidden.value];
  roleHidden.value = [...savedRoleHidden.value];
  personalization.value = JSON.parse(savedPersonalization.value);
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
.dash-config__meta {
  color: var(--color-neutral-600);
  font-size: 13px;
  margin: 0 0 12px;
  max-width: 760px;
}

.dash-config__meta {
  font-size: 12px;
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

.dash-config__list {
  border: 1px solid var(--color-neutral-200);
  border-radius: 8px;
  list-style: none;
  margin: 0;
  max-width: 760px;
  padding: 0;
}

.dash-config__row {
  align-items: center;
  border-bottom: 1px solid var(--color-neutral-100);
  display: flex;
  flex-wrap: wrap;
  font-size: 13px;
  gap: 4px 12px;
  padding: 8px 12px;

  &:last-child {
    border-bottom: 0;
  }
}

.dash-config__row--off {
  color: var(--color-neutral-500);
}

.dash-config__label {
  align-items: center;
  cursor: pointer;
  display: flex;
  flex: 1 1 220px;
  gap: 8px;
  font-size: 13px;
}

.dash-config__label--block {
  align-items: flex-start;
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

.dash-config__permission {
  color: var(--color-neutral-500);
  font-size: 12px;
}

.dash-config__chip {
  background: var(--color-neutral-100);
  border-radius: 999px;
  color: var(--color-neutral-700);
  font-size: 11px;
  padding: 2px 8px;
}

.dash-config__field {
  display: flex;
  flex-direction: column;
  font-size: 13px;
  gap: 4px;
  margin-bottom: 12px;
  max-width: 360px;

  select {
    border: 1px solid var(--color-neutral-300);
    border-radius: 6px;
    font-family: inherit;
    font-size: 13px;
    height: 36px;
    padding: 0 8px;
  }
}

.dash-config__json {
  border: 1px solid var(--color-neutral-300);
  border-radius: 6px;
  font-family: ui-monospace, monospace;
  font-size: 12px;
  height: 360px;
  margin-bottom: 8px;
  max-width: 760px;
  padding: 8px;
  width: 100%;
}
</style>
