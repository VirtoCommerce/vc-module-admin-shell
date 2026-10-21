<template>
  <VcBlade
    :title="$t('PLATFORM.MODULES.ADVANCED.TITLE')"
    :subtitle="$t('PLATFORM.MODULES.ADVANCED.SUBTITLE')"
    :loading="loading"
    width="60%"
  >
    <!-- Modules · Advanced (legacy modules-main's "Advanced" node): install a module from a package file, as the AngularJS
         admin did: upload it (api/platform/modules/localstorage), review what it is, install it with what it needs. -->
    <VcContainer>
      <div class="pm-adv">
        <VcBanner
          v-if="error"
          variant="danger"
        >
          {{ error }}
        </VcBanner>

        <!-- 1. the package -->
        <section
          v-if="!module"
          class="pm-adv__drop"
          :class="{ 'pm-adv__drop--over': dragging, 'pm-adv__drop--busy': uploading }"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onDrop"
        >
          <VcIcon
            class="pm-adv__drop-icon"
            icon="lucide-package-plus"
            size="xxl"
          />
          <h3 class="pm-adv__heading">{{ $t("PLATFORM.MODULES.ADVANCED.DROP_TITLE") }}</h3>
          <p class="pm-adv__hint">{{ $t("PLATFORM.MODULES.ADVANCED.DROP_HINT") }}</p>
          <div
            v-if="uploading"
            class="pm-adv__progress"
          >
            <VcProgress :value="progress" />
            <span>{{ $t("PLATFORM.MODULES.ADVANCED.UPLOADING", { name: fileName, percent: progress }) }}</span>
          </div>
          <VcButton
            v-else
            icon="lucide-file-archive"
            @click="fileInput?.click()"
          >
            {{ $t("PLATFORM.MODULES.ADVANCED.CHOOSE") }}
          </VcButton>
          <input
            ref="fileInput"
            type="file"
            accept=".zip,application/zip"
            hidden
            @change="onPick"
          />
        </section>

        <!-- 2. what the package is, before installing it -->
        <section
          v-else
          class="pm-adv__module"
        >
          <header class="pm-adv__module-head">
            <img
              class="platform-module-icon"
              :src="rootedUrl(module.iconUrl) ?? '/images/module-logo.svg'"
              alt=""
            />
            <div>
              <h3 class="pm-adv__heading">{{ module.title || module.id }}</h3>
              <span class="pm-adv__meta">{{ module.id }} · {{ module.version }}</span>
            </div>
          </header>
          <p
            v-if="module.description"
            class="pm-adv__hint"
          >
            {{ module.description }}
          </p>

          <VcBanner
            v-if="installed"
            variant="warning"
          >
            {{ $t("PLATFORM.MODULES.ADVANCED.REPLACES", { version: installed.version }) }}
          </VcBanner>

          <dl class="pm-adv__facts">
            <dt>{{ $t("PLATFORM.MODULES.PLATFORM_VERSION") }}</dt>
            <dd>{{ module.platformVersion || "—" }}</dd>
            <dt>{{ $t("PLATFORM.MODULES.AUTHORS") }}</dt>
            <dd>{{ module.authors?.join(", ") || "—" }}</dd>
            <dt>{{ $t("PLATFORM.MODULES.DEPENDENCIES") }}</dt>
            <dd>
              <span v-if="!module.dependencies?.length">{{ $t("PLATFORM.MODULES.NO_DEPENDENCIES") }}</span>
              <ul
                v-else
                class="pm-adv__deps"
              >
                <li
                  v-for="dep in module.dependencies"
                  :key="dep.id"
                >
                  <VcIcon
                    :icon="isInstalled(dep.id) ? 'lucide-check' : 'lucide-plus'"
                    size="s"
                    :class="isInstalled(dep.id) ? 'pm-adv__ok' : 'pm-adv__add'"
                  />
                  <span>{{ dep.id }} {{ versionText(dep.version) }}</span>
                  <span
                    v-if="dep.optional"
                    class="pm-adv__meta"
                  >· {{ $t("PLATFORM.MODULES.OPTIONAL") }}</span>
                  <span
                    v-else-if="!isInstalled(dep.id)"
                    class="pm-adv__meta"
                  >· {{ $t("PLATFORM.MODULES.ADVANCED.WILL_INSTALL") }}</span>
                </li>
              </ul>
            </dd>
          </dl>

          <div class="pm-adv__actions">
            <VcButton
              icon="lucide-download"
              :disabled="installing"
              @click="install"
            >
              {{ $t("PLATFORM.MODULES.INSTALL") }}
            </VcButton>
            <VcButton
              variant="outline"
              :disabled="installing"
              @click="reset"
            >
              {{ $t("PLATFORM.MODULES.ADVANCED.ANOTHER") }}
            </VcButton>
          </div>
        </section>

        <p class="pm-adv__note">
          <VcIcon
            icon="lucide-info"
            size="s"
          />
          {{ $t("PLATFORM.MODULES.ADVANCED.NOTE") }}
        </p>
      </div>
    </VcContainer>
  </VcBlade>
</template>

<script setup lang="ts">
import { ModulesClient, useApiClient, useBlade, usePopup, type ModuleDescriptor } from "@vc-shell/framework";
import { VcBanner, VcBlade, VcButton, VcContainer, VcIcon, VcProgress } from "@vc-shell/framework/ui";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useModules, versionText } from "../../composables/modules";
import { rootedUrl } from "../../../../utils/url";

defineBlade({
  url: "/modules-advanced",
  name: "PlatformModulesAdvanced",
  isWorkspace: true,
  permissions: ["platform:module:manage"],
});

const { t } = useI18n({ useScope: "global" });
const { openBlade, exposeToChildren } = useBlade();
const { showConfirmation } = usePopup();
const { getApiClient } = useApiClient(ModulesClient);
const modules = useModules();

const fileInput = ref<HTMLInputElement>();
const module = ref<ModuleDescriptor>();
const fileName = ref("");
const progress = ref(0);
const uploading = ref(false);
const installing = ref(false);
const loading = ref(false);
const dragging = ref(false);
const error = ref<string>();

// what is installed now: a dependency already there, or the module itself (the package then replaces it)
modules.load().catch(() => undefined);
const isInstalled = (id?: string) => modules.rows.value.some((m) => m.id === id && m.isInstalled);
const installed = computed(() => modules.rows.value.find((m) => m.id === module.value?.id && m.isInstalled));

function onPick(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (file) upload(file);
}

function onDrop(event: DragEvent) {
  dragging.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file) upload(file);
}

/** Sends the package to the platform's module storage; the answer is the package's module, ready to install */
function upload(file: File) {
  error.value = undefined;
  if (!file.name.toLowerCase().endsWith(".zip")) {
    error.value = t("PLATFORM.MODULES.ADVANCED.NOT_ZIP");
    return;
  }
  fileName.value = file.name;
  progress.value = 0;
  uploading.value = true;
  // XMLHttpRequest for the upload's progress (a module package is tens of megabytes)
  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/platform/modules/localstorage");
  xhr.setRequestHeader("Accept", "application/json");
  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) progress.value = Math.round((e.loaded / e.total) * 100);
  };
  xhr.onload = () => {
    uploading.value = false;
    let answer: ModuleDescriptor | undefined;
    try {
      answer = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
    } catch {
      answer = undefined;
    }
    if (xhr.status >= 200 && xhr.status < 300 && answer?.id) module.value = answer;
    else error.value = t("PLATFORM.MODULES.ADVANCED.INVALID", { name: file.name, status: xhr.status });
  };
  xhr.onerror = () => {
    uploading.value = false;
    error.value = t("PLATFORM.MODULES.ADVANCED.FAILED", { name: file.name });
  };
  const body = new FormData();
  body.append("file", file, file.name);
  xhr.send(body);
}

/** Installs the package and the dependencies it needs, after confirming the list (legacy moduleHelper.performAction) */
async function install() {
  if (!module.value) return;
  error.value = undefined;
  installing.value = true;
  try {
    const client = await getApiClient();
    const missing = (await client.getMissingDependencies([module.value])) ?? [];
    const extra = missing.filter((m) => m.id !== module.value!.id);
    const list = `${module.value.title ?? module.value.id} ${module.value.version}`;
    const message =
      t("PLATFORM.MODULES.CONFIRM.INSTALL", { list }) +
      (extra.length
        ? " " + t("PLATFORM.MODULES.CONFIRM.DEPENDENCIES", { list: extra.map((m) => `${m.title ?? m.id} ${m.version}`).join(", ") })
        : "");
    if (!(await showConfirmation(message))) return;
    const notification = await client.installModules([module.value, ...extra]);
    await openBlade({ name: "PlatformModulesProgress", param: notification.id, options: { notification } });
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    installing.value = false;
  }
}

function reset() {
  module.value = undefined;
  error.value = undefined;
}

// the progress blade asks when its job has finished: what is installed now
exposeToChildren({ reload: () => modules.load().catch(() => undefined) });
</script>

<style lang="scss">
.pm-adv {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 720px;
  padding: 20px 22px 36px;

  &__drop {
    align-items: center;
    border: 2px dashed var(--color-neutral-300);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 40px 24px;
    text-align: center;
    transition:
      border-color 0.15s,
      background-color 0.15s;

    &--over {
      background: var(--color-primary-50);
      border-color: var(--color-primary-500);
    }
  }

  &__drop-icon {
    color: var(--color-primary-500);
  }

  &__heading {
    color: var(--color-neutral-900);
    font-size: 16px;
    font-weight: 700;
    margin: 0;
  }

  &__hint {
    color: var(--color-neutral-600);
    font-size: 14px;
    line-height: 1.5;
    margin: 0;
    max-width: 60ch;
  }

  &__progress {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: min(360px, 100%);
    color: var(--color-neutral-600);
    font-size: 13px;
  }

  &__module {
    border: 1px solid var(--color-neutral-200);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 20px;
  }

  &__module-head {
    align-items: center;
    display: flex;
    gap: 14px;
  }

  &__meta {
    color: var(--color-neutral-500);
    font-size: 13px;
  }

  &__facts {
    display: grid;
    gap: 8px 16px;
    grid-template-columns: max-content 1fr;
    margin: 0;

    dt {
      color: var(--color-neutral-500);
      font-size: 13px;
    }

    dd {
      color: var(--color-neutral-900);
      font-size: 14px;
      margin: 0;
      min-width: 0;
    }
  }

  &__deps {
    display: flex;
    flex-direction: column;
    gap: 4px;
    list-style: none;
    margin: 0;
    padding: 0;

    li {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
  }

  &__ok {
    color: var(--color-success-500);
  }

  &__add {
    color: var(--color-primary-500);
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  &__note {
    align-items: flex-start;
    color: var(--color-neutral-500);
    display: flex;
    font-size: 13px;
    gap: 6px;
    line-height: 1.5;
    margin: 0;
  }
}

// a phone: the facts one under the other
@media (max-width: 640px) {
  .pm-adv {
    padding: 16px;

    &__facts {
      grid-template-columns: 1fr;

      dd {
        margin-bottom: 6px;
      }
    }
  }
}
</style>
