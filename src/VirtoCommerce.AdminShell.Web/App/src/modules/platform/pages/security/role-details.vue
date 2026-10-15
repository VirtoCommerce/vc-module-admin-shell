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
  useBladeForm,
  useLoading,
  usePermissions,
  usePopup,
  type IBladeToolbar,
  type Permission,
  type PermissionScope,
  type Role,
} from "@vc-shell/framework";
import { VcBlade, VcCard, VcColumn, VcContainer, VcDataTable, VcForm, VcInput, VcTextarea } from "@vc-shell/framework/ui";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
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

const { t } = useI18n({ useScope: "global" });
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

const form = useBladeForm({
  data: item,
  canSaveOverride: computed(() => !!item.value.name && hasAccess(isNew.value ? "platform:security:create" : "platform:security:update")),
  closeConfirmMessage: computed(() => t("PLATFORM.COMMON.CLOSE_CONFIRMATION")),
});

const { loading: loadLoading, action: load } = useAsync(async () => {
  const client = await getApiClient();
  const [all, role] = await Promise.all([
    registeredPermissions(client),
    isNew.value ? { name: "", description: "", permissions: [] } : client.getRole(param.value!),
  ]);
  registered.value = all;
  item.value = role;
  item.value.permissions ??= [];
  selection.value = [];
  form.setBaseline();
});

const { loading: saveLoading, action: save } = useAsync(async () => {
  // PUT roles creates the role when it has no id
  ensureSucceeded(await (await getApiClient()).updateRole(item.value));
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
  {
    id: "save",
    title: isNew.value ? t("PLATFORM.COMMON.CREATE") : t("PLATFORM.COMMON.SAVE"),
    icon: "lucide-save",
    disabled: computed(() => !form.canSave.value),
    clickHandler: () => save(),
  },
  {
    id: "reset",
    title: t("PLATFORM.COMMON.RESET"),
    icon: "lucide-undo-2",
    disabled: computed(() => !form.isModified.value),
    clickHandler: () => load(),
  },
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
