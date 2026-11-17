<template>
  <VcBlade
    :title="isNew ? $t('PLATFORM.SECURITY.ROLE.NEW_TITLE') : item.name"
    :subtitle="$t('PLATFORM.SECURITY.ROLE.SUBTITLE')"
    :toolbar-items="toolbar"
    :loading="loading"
    :modified="form.isModified.value"
    width="60%"
  >
    <VcContainer>
      <VcForm class="platform-form">
        <VcInput
          v-model="item.name"
          :label="$t('PLATFORM.SECURITY.ROLES.NAME')"
          required
          :disabled="!isNew"
          :error-message="item.name ? undefined : $t('PLATFORM.COMMON.REQUIRED')"
        />
        <VcTextarea
          v-model="item.description"
          :label="$t('PLATFORM.SECURITY.ROLES.DESCRIPTION')"
        />
        <VcCard :header="$t('PLATFORM.SECURITY.ROLES.PERMISSIONS')">
          <VcDataTable
            v-model:selection="selection"
            v-model:search-value="keyword"
            selection-mode="multiple"
            :items="rows"
            :searchable="true"
            :state-key="'PLATFORM_ROLE_PERMISSIONS'"
            :empty-state="{ icon: 'lucide-shield', title: $t('PLATFORM.SECURITY.ROLE.NO_PERMISSIONS') }"
            @row-click="(e: { data: PermissionRow }) => openScopes(e.data)"
          >
            <VcColumn
              id="name"
              :title="$t('PLATFORM.SECURITY.ROLE.PERMISSION')"
              sortable
              always-visible
            />
            <VcColumn
              id="description"
              :title="$t('PLATFORM.SECURITY.ROLES.DESCRIPTION')"
            />
            <VcColumn
              id="groupName"
              :title="$t('PLATFORM.SECURITY.ROLE.GROUP')"
              sortable
            />
            <VcColumn
              id="scopes"
              :title="$t('PLATFORM.SECURITY.ROLE.SCOPES')"
            />
          </VcDataTable>
        </VcCard>
        <!-- the widgets the role's users see on Home (Admin Shell's dashboard setting of the role) -->
        <VcCard :header="$t('PLATFORM.SECURITY.ROLE.DASHBOARD')">
          <div class="role-dashboard">
            <p class="role-dashboard__hint">{{ $t("PLATFORM.SECURITY.ROLE.DASHBOARD_HINT") }}</p>
            <p
              v-if="!dashboardReadable"
              class="role-dashboard__hint"
            >
              {{ $t("PLATFORM.SECURITY.ROLE.DASHBOARD_UNAVAILABLE") }}
            </p>
            <VcSwitch
              v-for="widget in dashboardWidgets"
              :key="widget.id"
              :model-value="!hiddenWidgets.includes(widget.id)"
              :label="widget.label"
              :disabled="!canEditDashboard"
              @update:model-value="(shown?: boolean) => setShown(widget.id, !!shown)"
            />
          </div>
        </VcCard>
      </VcForm>
    </VcContainer>
  </VcBlade>
</template>

<script setup lang="ts">
import {
  SecurityClient,
  notification,
  useApiClient,
  useAsync,
  useBlade,
  useDashboard,
  useLoading,
  usePermissions,
  usePopup,
  type IBladeToolbar,
  type Permission,
  type PermissionScope,
  type Role,
} from "@vc-shell/framework";
import {
  VcBlade,
  VcCard,
  VcColumn,
  VcContainer,
  VcDataTable,
  VcForm,
  VcInput,
  VcSwitch,
  VcTextarea,
} from "@vc-shell/framework/ui";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { adminDashboardApi } from "../../../../api/adminDashboard";
import { saveResetItems, usePlatformBladeForm } from "../../composables/blade";
import { ensureSucceeded, registeredPermissions, type CatalogPermission } from "../../composables/security";

defineBlade({
  url: "/role",
  name: "PlatformSecurityRoleDetails",
  permissions: ["platform:security:access"],
});

interface PermissionRow {
  id: string;
  name: string;
  description: string;
  groupName: string;
  scopes: string;
}

const { t, te } = useI18n({ useScope: "global" });
const { param, openBlade, closeSelf, replaceWith, callParent, exposeToChildren } = useBlade();
const { hasAccess } = usePermissions();
const { showConfirmation } = usePopup();
const { getApiClient } = useApiClient(SecurityClient);

const isNew = computed(() => !param.value);
const item = ref<Role>({ permissions: [] });
const registered = ref<CatalogPermission[]>([]);
const selection = ref<PermissionRow[]>([]);
const keyword = ref("");

const registry = computed(() => new Map(registered.value.map((p) => [p.name!, p])));
// "—" for a permission without scopes; none assigned means all
function scopesText(p: Permission, known?: CatalogPermission) {
  if (!known?.availableScopes?.length) return "—";
  if (!p.assignedScopes?.length) return t("PLATFORM.SECURITY.ROLE.SCOPES_ALL");
  return p.assignedScopes.map((s) => s.label || s.scope || s.type).join(", ");
}
const rows = computed<PermissionRow[]>(() =>
  (item.value.permissions ?? [])
    .map((p) => {
      const known = registry.value.get(p.name!);
      return {
        id: p.name!,
        name: p.name!,
        description: known?.description ?? "",
        groupName: known?.groupName ?? p.groupName ?? "",
        scopes: scopesText(p, known),
      };
    })
    .filter((r) => !keyword.value || `${r.name} ${r.description} ${r.groupName}`.toLowerCase().includes(keyword.value.toLowerCase())),
);

// Dashboard: the widgets the role's users don't need. A user still sees a widget another of their roles shows (and an
// administrator sees all). The list shows the widgets installed here, and any hidden id this shell doesn't have.
const hiddenWidgets = ref<string[]>([]);
const savedHiddenWidgets = ref<string[]>([]);
// unreadable (no rights, an error): shown as all on, not editable and not saved, so a save can't wipe the role's list
const dashboardReadable = ref(true);
const dashboard = useDashboard();
const canEditDashboard = computed(
  () => dashboardReadable.value && hasAccess(isNew.value ? "platform:security:create" : "platform:security:update"),
);
const dashboardWidgets = computed(() => {
  const installed = dashboard.getWidgets().map((w) => ({ id: w.id, label: te(w.name) ? t(w.name) : w.name || w.id }));
  const known = new Set(installed.map((w) => w.id));
  const others = hiddenWidgets.value.filter((id) => !known.has(id)).map((id) => ({ id, label: id }));
  return [...installed, ...others].sort((a, b) => a.label.localeCompare(b.label));
});
function setShown(id: string, shown: boolean) {
  hiddenWidgets.value = shown ? hiddenWidgets.value.filter((x) => x !== id) : [...hiddenWidgets.value, id];
}

// the form tracks the role and its dashboard together: Save, Reset and the close confirmation cover both
const formState = computed({
  get: () => ({ role: item.value, hiddenWidgets: hiddenWidgets.value }),
  set: (value) => {
    item.value = value.role;
    hiddenWidgets.value = value.hiddenWidgets;
  },
});
const form = usePlatformBladeForm({
  data: formState,
  canSaveOverride: computed(() => !!item.value.name && hasAccess(isNew.value ? "platform:security:create" : "platform:security:update")),
});

async function loadDashboard(roleId?: string) {
  dashboardReadable.value = true;
  if (!roleId) return [];
  try {
    return (await adminDashboardApi.getRole(roleId)).hiddenWidgets ?? [];
  } catch {
    dashboardReadable.value = false;
    return [];
  }
}

const { loading: loadLoading, action: load } = useAsync(async () => {
  const client = await getApiClient();
  const [all, role] = await Promise.all([
    registeredPermissions(client),
    isNew.value ? { name: "", description: "", permissions: [] } : client.getRole(param.value!),
  ]);
  registered.value = all;
  item.value = role;
  item.value.permissions ??= [];
  hiddenWidgets.value = await loadDashboard(item.value.id);
  savedHiddenWidgets.value = [...hiddenWidgets.value];
  selection.value = [];
  form.setBaseline();
});

async function saveDashboard(roleId?: string) {
  const sorted = (ids: string[]) => [...ids].sort((a, b) => a.localeCompare(b)).join();
  const changed = sorted(hiddenWidgets.value) !== sorted(savedHiddenWidgets.value);
  if (!roleId || !changed || !canEditDashboard.value) return;
  await adminDashboardApi.saveRole(roleId, { hiddenWidgets: hiddenWidgets.value });
}

const { loading: saveLoading, action: save } = useAsync(async () => {
  const client = await getApiClient();
  // PUT roles creates the role when it has no id; a new role's id is read back for its dashboard
  ensureSucceeded(await client.updateRole(item.value));
  await saveDashboard(item.value.id ?? (await client.getRole(item.value.name!)).id);
  notification.success(t("PLATFORM.COMMON.SAVED"));
  await callParent("reload");
  if (isNew.value) {
    form.setBaseline();
    await replaceWith({ name: "PlatformSecurityRoleDetails", param: item.value.name });
    return;
  }
  await load();
});

const loading = useLoading(loadLoading, saveLoading);

function openScopes(row: PermissionRow) {
  const known = registry.value.get(row.name);
  if (!known?.availableScopes?.length) return;
  const assigned = item.value.permissions!.find((p) => p.name === row.name)!;
  openBlade({
    name: "PlatformSecurityPermissionScopes",
    param: row.name,
    options: { available: known.availableScopes, assigned: assigned.assignedScopes ?? [] },
  });
}

const toolbar = computed<IBladeToolbar[]>(() => [
  ...saveResetItems(form, { save: () => save(), reset: () => load(), isNew: isNew.value }),
  {
    id: "assign",
    title: t("PLATFORM.SECURITY.ROLE.ASSIGN"),
    icon: "lucide-plus",
    permissions: ["platform:security:update"],
    clickHandler: () =>
      openBlade({
        name: "PlatformSecurityPermissionPicker",
        options: { exclude: (item.value.permissions ?? []).map((p) => p.name) },
      }),
  },
  {
    id: "remove",
    title: t("PLATFORM.SECURITY.ROLE.REMOVE"),
    icon: "lucide-minus",
    permissions: ["platform:security:update"],
    disabled: computed(() => !selection.value.length),
    clickHandler: () => {
      const names = new Set(selection.value.map((r) => r.name));
      item.value.permissions = item.value.permissions!.filter((p) => !names.has(p.name!));
      selection.value = [];
    },
  },
  {
    id: "delete",
    title: t("PLATFORM.COMMON.DELETE"),
    icon: "lucide-trash-2",
    permissions: ["platform:security:delete"],
    isVisible: computed(() => !isNew.value),
    async clickHandler() {
      if (await showConfirmation(t("PLATFORM.SECURITY.ROLE.DELETE_CONFIRM", { name: item.value.name }))) {
        await (await getApiClient()).deleteRoles([item.value.id!]);
        form.setBaseline();
        await callParent("reload");
        await closeSelf();
      }
    },
  },
]);

exposeToChildren({
  addPermissions(permissions: Permission[]) {
    item.value.permissions = [
      ...(item.value.permissions ?? []),
      ...permissions.map((p) => ({ name: p.name, moduleId: p.moduleId, groupName: p.groupName, assignedScopes: [] })),
    ];
  },
  setScopes({ name, scopes }: { name: string; scopes: PermissionScope[] }) {
    const permission = item.value.permissions?.find((p) => p.name === name);
    if (permission) permission.assignedScopes = scopes;
  },
});

load();
</script>

<style lang="scss">
.role-dashboard {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}

.role-dashboard__hint {
  margin: 0;
  color: var(--as-muted);
  font-size: 13px;
}
</style>
