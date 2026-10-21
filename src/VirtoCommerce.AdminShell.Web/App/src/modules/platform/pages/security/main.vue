<template>
  <VcBlade
    :title="$t('PLATFORM.SECURITY.TITLE')"
    width="30%"
  >
    <VcDataTable
      :items="sections"
      :active-item-id="active"
      :state-key="'PLATFORM_SECURITY'"
      @row-click="(e: { data: Section }) => open(e.data)"
    >
      <VcColumn
        id="title"
        :title="$t('PLATFORM.SECURITY.SECTION')"
      >
        <template #body="{ data }">
          <span class="platform-nav-row">
            <VcIcon
              :icon="data.icon"
              size="s"
            />
            {{ data.title }}
          </span>
        </template>
      </VcColumn>
    </VcDataTable>
  </VcBlade>
</template>

<script setup lang="ts">
import { useBlade, usePermissions } from "@vc-shell/framework";
import { VcBlade, VcColumn, VcDataTable, VcIcon } from "@vc-shell/framework/ui";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

defineBlade({
  url: "/security",
  name: "PlatformSecurity",
  isWorkspace: true,
  permissions: ["platform:security:access"],
});

interface Section {
  id: string;
  title: string;
  icon: string;
  blade: string;
  permission?: string;
}

const { t } = useI18n({ useScope: "global" });
const { openBlade } = useBlade();
const { hasAccess } = usePermissions();
const active = ref<string>();

const sections = computed<Section[]>(() =>
  [
    { id: "users", title: t("PLATFORM.SECURITY.USERS.TITLE"), icon: "lucide-users", blade: "PlatformSecurityUsers" },
    { id: "roles", title: t("PLATFORM.SECURITY.ROLES.TITLE"), icon: "lucide-shield", blade: "PlatformSecurityRoles" },
    {
      id: "oauth",
      title: t("PLATFORM.SECURITY.OAUTH.TITLE"),
      icon: "lucide-app-window",
      blade: "PlatformSecurityOAuthApps",
      permission: "platform:security:oauth_applications:read",
    },
    {
      id: "signin",
      title: t("PLATFORM.SECURITY.SIGNIN.TITLE"),
      icon: "lucide-log-in",
      blade: "PlatformSecuritySignInLog",
      permission: "platform:security:sign_in_log:read",
    },
  ].filter((x) => hasAccess(x.permission)),
);

function open(section: Section) {
  active.value = section.id;
  openBlade({ name: section.blade, onClose: () => (active.value = undefined) });
}
</script>

