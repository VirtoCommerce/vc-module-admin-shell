<template>
  <VcBlade
    :title="module?.title || param"
    :subtitle="module?.id"
    :toolbar-items="toolbar"
    :loading="loading"
    width="60%"
  >
    <VcContainer v-if="module">
      <VcForm class="platform-form">
        <div class="platform-module-head">
          <img
            class="platform-module-head__icon"
            :src="rootedUrl(module.iconUrl) ?? '/images/module-logo.svg'"
            alt=""
          />
          <div>
            <div class="platform-module-head__title">{{ module.title }}</div>
            <div class="platform-module-head__by">{{ (module.owners ?? []).join(", ") }}</div>
          </div>
          <div class="tw-inline-flex platform-badges">
            <VcStatus
              v-if="module.isOfficial"
              variant="info"
            >
              {{ $t("PLATFORM.MODULES.OFFICIAL") }}
            </VcStatus>
            <VcStatus :variant="module.isInstalled ? 'success' : 'info'">
              {{ module.isInstalled ? $t("PLATFORM.MODULES.INSTALLED") : $t("PLATFORM.MODULES.FILTERS.NOTINSTALLED") }}
            </VcStatus>
          </div>
        </div>
        <VcBanner
          v-if="module.validationErrors?.length"
          variant="danger"
        >
          {{ module.validationErrors.join(" ") }}
        </VcBanner>
        <VcRow class="tw-gap-4">
          <VcCol>
            <VcField
              :label="$t('PLATFORM.MODULES.VERSION')"
              :model-value="module.version"
            />
          </VcCol>
          <VcCol>
            <VcField
              :label="$t('PLATFORM.MODULES.LATEST')"
              :model-value="module.latestVersion || module.versions[module.versions.length - 1]?.version"
            />
          </VcCol>
          <VcCol>
            <VcField
              :label="$t('PLATFORM.MODULES.PLATFORM_VERSION')"
              :model-value="module.platformVersion"
            />
          </VcCol>
        </VcRow>
        <VcField
          :label="$t('PLATFORM.MODULES.DESCRIPTION')"
          :model-value="module.description || '—'"
        />
        <VcRow class="tw-gap-4">
          <VcCol>
            <VcField
              :label="$t('PLATFORM.MODULES.AUTHORS')"
              :model-value="(module.authors ?? []).join(', ') || '—'"
            />
          </VcCol>
          <VcCol>
            <VcField
              :label="$t('PLATFORM.MODULES.GROUPS')"
              :model-value="(module.groups ?? []).join(', ') || '—'"
            />
          </VcCol>
        </VcRow>
        <VcRow class="tw-gap-4">
          <VcCol>
            <VcField
              :label="$t('PLATFORM.MODULES.PROJECT')"
              :model-value="module.projectUrl || '—'"
              :type="module.projectUrl ? 'link' : 'text'"
            />
          </VcCol>
          <VcCol>
            <VcField
              :label="$t('PLATFORM.MODULES.LICENSE')"
              :model-value="module.licenseUrl || '—'"
              :type="module.licenseUrl ? 'link' : 'text'"
            />
          </VcCol>
        </VcRow>
        <VcField
          v-if="module.copyright"
          :label="$t('PLATFORM.MODULES.COPYRIGHT')"
          :model-value="module.copyright"
        />
        <VcCard :header="$t('PLATFORM.MODULES.DEPENDENCIES')">
          <VcDataTable
            v-if="dependencies.length"
            :items="dependencies"
            :state-key="'PLATFORM_MODULE_DEPENDENCIES'"
            :empty-state="{ icon: 'lucide-blocks', title: $t('PLATFORM.MODULES.NO_DEPENDENCIES') }"
            @row-click="(e: { data: Dependency }) => e.data.known && openModule(e.data.id)"
          >
            <VcColumn
              id="title"
              :title="$t('PLATFORM.MODULES.MODULE')"
            />
            <VcColumn
              id="version"
              :title="$t('PLATFORM.MODULES.VERSION')"
              width="140px"
            />
            <VcColumn
              id="optional"
              :title="$t('PLATFORM.MODULES.OPTIONAL')"
              width="120px"
            />
          </VcDataTable>
          <div
            v-else
            class="platform-card-body platform-note"
          >
            {{ $t("PLATFORM.MODULES.NO_DEPENDENCIES") }}
          </div>
        </VcCard>
        <VcCard
          v-if="module.releaseNotes"
          :header="$t('PLATFORM.MODULES.RELEASE_NOTES')"
        >
          <div class="platform-card-body platform-pre">{{ module.releaseNotes }}</div>
        </VcCard>
      </VcForm>
    </VcContainer>
  </VcBlade>
</template>

<script setup lang="ts">
import { defineBladeContext, useAsync, useBlade, type IBladeToolbar } from "@vc-shell/framework";
import {
  VcBanner,
  VcBlade,
  VcCard,
  VcCol,
  VcColumn,
  VcContainer,
  VcDataTable,
  VcField,
  VcForm,
  VcRow,
  VcStatus,
} from "@vc-shell/framework/ui";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useModules, versionText } from "../../composables/modules";
import { rootedUrl } from "../../../../utils/url";

defineBlade({
  url: "/module",
  name: "PlatformModuleDetails",
  permissions: ["platform:module:access"],
});

interface Dependency {
  id: string;
  title: string;
  version: string;
  optional: string;
  known: boolean;
}

const { t } = useI18n({ useScope: "global" });
const { param, openBlade, exposeToChildren } = useBlade();
const modules = useModules();

const module = computed(() => modules.rows.value.find((m) => m.id === param.value));
const dependencies = computed<Dependency[]>(() =>
  (module.value?.dependencies ?? []).map((d) => {
    const known = modules.rows.value.find((m) => m.id === d.id);
    return {
      id: d.id!,
      title: known?.title ?? d.id!,
      version: versionText(d.version),
      optional: d.optional ? t("PLATFORM.COMMON.YES") : t("PLATFORM.COMMON.NO"),
      known: !!known,
    };
  }),
);

const { loading, action: load } = useAsync(async () => {
  if (!modules.rows.value.length) await modules.load();
});

function openModule(id: string) {
  openBlade({ name: "PlatformModuleDetails", param: id });
}

const toolbar = computed<IBladeToolbar[]>(() => {
  const m = module.value;
  return [
    {
      id: "install",
      title: t("PLATFORM.MODULES.INSTALL"),
      icon: "lucide-download",
      permissions: ["platform:module:manage"],
      isVisible: !!m && !m.isInstalled,
      clickHandler: () => modules.perform("install", [m!]),
    },
    {
      id: "update",
      title: t("PLATFORM.MODULES.UPDATE_TO", { version: m?.latestVersion }),
      icon: "lucide-arrow-up-circle",
      permissions: ["platform:module:manage"],
      isVisible: !!m?.isInstalled && m.hasUpdate,
      clickHandler: () => modules.perform("update", [m!]),
    },
    {
      id: "uninstall",
      title: t("PLATFORM.MODULES.UNINSTALL"),
      icon: "lucide-trash-2",
      permissions: ["platform:module:manage"],
      isVisible: !!m?.isInstalled,
      disabled: m?.isRemovable === false,
      clickHandler: () => modules.perform("uninstall", [m!]),
    },
  ];
});

// the module, for widgets other modules add to this blade (legacy 'moduleDetail' widgets, e.g. Core's currencies;
// registerExternalWidget with targetBlades: ["PlatformModuleDetails"])
defineBladeContext({ item: module });

load();

// a child (the progress screen after install, update or uninstall) asks for fresh data: always read the modules again
exposeToChildren({ reload: () => modules.load() });
</script>

<style lang="scss">
.platform-module-head {
  display: flex;
  align-items: center;
  gap: 14px;
  &__icon {
    width: 48px;
    height: 48px;
    object-fit: contain;
  }
  &__title {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-neutral-900);
  }
  &__by {
    font-size: 13px;
    color: var(--color-neutral-500);
  }
  .platform-badges {
    margin-left: auto;
  }
}

</style>
