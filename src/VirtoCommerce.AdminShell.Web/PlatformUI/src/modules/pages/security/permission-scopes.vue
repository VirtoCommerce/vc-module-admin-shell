<template>
  <VcBlade
    :title="$t('PLATFORM.SECURITY.ROLE.SCOPES')"
    :subtitle="param"
    :toolbar-items="toolbar"
    :loading="loading"
    width="40%"
  >
    <VcContainer>
      <VcForm class="platform-form">
        <p class="platform-note">{{ $t("PLATFORM.SECURITY.ROLE.SCOPES_HINT") }}</p>
        <template
          v-for="scope in available"
          :key="scope.type"
        >
          <VcSwitch
            v-if="kind(scope.type!) === 'toggle'"
            v-model="toggles[scope.type!]"
            :label="label(scope.type!)"
          />
          <VcSelect
            v-else-if="kind(scope.type!) === 'picker'"
            v-model="values[scope.type!]"
            :label="label(scope.type!)"
            :options="options[scope.type!] ?? []"
            option-value="id"
            option-label="name"
            multiple
            searchable
          />
          <VcMultivalue
            v-else
            v-model="chips[scope.type!]"
            option-value="id"
            option-label="id"
            :label="label(scope.type!)"
            :hint="$t('PLATFORM.SECURITY.ROLE.SCOPE_TEXT_HINT')"
            :placeholder="$t('PLATFORM.SECURITY.ROLE.SCOPE_TEXT_PLACEHOLDER')"
          />
        </template>
      </VcForm>
    </VcContainer>
  </VcBlade>
</template>

<script setup lang="ts">
// Generic permission scope editor (legacy permission-scopes blade + the scope types modules register with
// permissionScopeResolver): toggles for value-less scopes, list pickers for store / catalog / fulfillment center /
// organization scopes, and free-text values for any other type (e.g. CatalogSelectedCategoryScope: category ids).
import { useAsync, useBlade, type IBladeToolbar, type PermissionScope } from "@vc-shell/framework";
import { VcBlade, VcContainer, VcForm, VcMultivalue, VcSelect, VcSwitch } from "@vc-shell/framework/ui";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { api } from "../../api";

defineBlade({
  url: "/scopes",
  name: "PlatformSecurityPermissionScopes",
  permissions: ["platform:security:update"],
});

interface NamedEntity {
  id: string;
  name: string;
}

const { t } = useI18n({ useScope: "global" });
const { param, options: bladeOptions, callParent, closeSelf } = useBlade<{ available: PermissionScope[]; assigned: PermissionScope[] }>();

const search = (url: string, body: Record<string, unknown> = {}) => () =>
  api<{ results?: NamedEntity[] }>("POST", url, { take: 1000, sort: "name", ...body }).then((r) => r.results ?? []);

// value-less scopes (registered without a selectFn in the legacy UI; the Task ones by TaskManagement)
const TOGGLES = new Set([
  "OnlyOrderResponsibleScope",
  "AssociatedOrganizationsOnlyScope",
  "TaskToMeScope",
  "TaskToMyOrganizationScope",
]);

function pickerFor(type: string): (() => Promise<NamedEntity[]>) | undefined {
  if (/Category/i.test(type)) return undefined; // legacy category-tree picker: entered as category ids
  if (/Store/i.test(type)) return search("/api/stores/search");
  if (/Catalog/i.test(type)) return search("/api/catalog/catalogs/search");
  if (/FulfillmentCenter/i.test(type)) return search("/api/inventory/fulfillmentcenters/search");
  if (/Organization/i.test(type)) return search("/api/members/search", { memberType: "Organization" });
  return undefined;
}

const kind = (type: string) => {
  if (TOGGLES.has(type) || /OnlyScope$/.test(type)) return "toggle";
  return pickerFor(type) ? "picker" : "text";
};

const available = computed(() => bladeOptions.value?.available ?? []);
const options = ref<Record<string, NamedEntity[]>>({});
const values = ref<Record<string, string[]>>({});
const chips = ref<Record<string, { id: string }[]>>({});
const toggles = ref<Record<string, boolean>>({});

// "OrderSelectedStoreScope" -> "Order Selected Store Scope"
const label = (type: string) => type.replace(/([a-z])([A-Z])/g, "$1 $2");

const { loading, action: load } = useAsync(async () => {
  const assigned = bladeOptions.value?.assigned ?? [];
  await Promise.all(
    available.value.map(async (scope) => {
      const type = scope.type!;
      const mine = assigned.filter((a) => a.type === type);
      const k = kind(type);
      if (k === "toggle") toggles.value[type] = mine.length > 0;
      else if (k === "text") chips.value[type] = mine.filter((a) => a.scope).map((a) => ({ id: a.scope! }));
      else {
        values.value[type] = mine.map((a) => a.scope!).filter(Boolean);
        options.value[type] = await pickerFor(type)!().catch(() => []);
      }
    }),
  );
});

function collect(): PermissionScope[] {
  const scopes: PermissionScope[] = [];
  for (const scope of available.value) {
    const type = scope.type!;
    const k = kind(type);
    if (k === "toggle") {
      if (toggles.value[type]) scopes.push({ ...scope });
      continue;
    }
    const ids = k === "picker" ? values.value[type] ?? [] : (chips.value[type] ?? []).map((c) => String(c.id).trim()).filter(Boolean);
    for (const id of ids) {
      scopes.push({ ...scope, scope: id, label: options.value[type]?.find((x) => x.id === id)?.name ?? id });
    }
  }
  return scopes;
}

const toolbar = ref<IBladeToolbar[]>([
  {
    id: "ok",
    title: t("PLATFORM.SECURITY.ROLE.APPLY"),
    icon: "lucide-check",
    async clickHandler() {
      await callParent("setScopes", { name: param.value, scopes: collect() });
      await closeSelf();
    },
  },
]);

load();
</script>
