<template>
  <VcBlade
    :title="$t('PLATFORM.DEVTOOLS.TITLE')"
    :toolbar-items="toolbar"
    :loading="loading"
    width="100%"
  >
    <div class="platform-devtools">
      <nav class="platform-devtools__tabs">
        <a
          v-for="tool in tools"
          :key="tool.name"
          class="platform-devtools__tab"
          :class="{ 'platform-devtools__tab--active': tool.name === current?.name }"
          :href="tool.url"
          :target="tool.isExternal ? '_blank' : undefined"
          :rel="tool.isExternal ? 'noopener' : undefined"
          @click="select($event, tool)"
        >
          {{ tool.name }}
          <VcIcon
            v-if="tool.isExternal"
            icon="lucide-external-link"
            size="xs"
          />
        </a>
      </nav>
      <div
        v-if="current"
        class="platform-devtools__content"
      >
        <pre
          v-if="json !== undefined"
          class="platform-devtools__json"
          >{{ json }}</pre
        >
        <iframe
          v-else-if="!probing"
          :key="frameKey"
          class="platform-devtools__frame"
          :src="current.url"
          :title="current.name"
        ></iframe>
      </div>
      <p
        v-else-if="!loading"
        class="platform-note platform-devtools__empty"
      >
        {{ $t("PLATFORM.DEVTOOLS.EMPTY") }}
      </p>
    </div>
  </VcBlade>
</template>

<script setup lang="ts">
import { DeveloperToolsClient, useApiClient, useAsync, type DeveloperToolDescriptor, type IBladeToolbar } from "@vc-shell/framework";
import { VcBlade, VcIcon } from "@vc-shell/framework/ui";
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { refreshItem } from "../../composables/blade";

defineBlade({
  url: "/developer-tools",
  name: "PlatformDeveloperTools",
  isWorkspace: true,
  permissions: ["platform:developer-tools:access"],
});

const { t } = useI18n({ useScope: "global" });
const { getApiClient } = useApiClient(DeveloperToolsClient);

const tools = ref<DeveloperToolDescriptor[]>([]);
const current = ref<DeveloperToolDescriptor>();
const frameKey = ref(0);
/** formatted body when the tool answers with JSON (Health), shown as a code block instead of the browser's raw JSON view */
const json = ref<string>();
// the frame loads only after the probe: both requests set Hangfire's antiforgery cookie, and a late probe response
// would replace the one the frame's page was rendered with (its stats polling then gets 403)
const probing = ref(false);

async function show(tool: DeveloperToolDescriptor) {
  current.value = tool;
  json.value = undefined;
  frameKey.value++;
  probing.value = true;
  try {
    const response = await fetch(tool.url!, { headers: { Accept: "application/json" } });
    if (current.value === tool && response.headers.get("content-type")?.includes("json")) {
      json.value = JSON.stringify(await response.json(), null, 2);
    }
  } catch {
    // not JSON / not reachable: the frame shows whatever the tool serves
  } finally {
    if (current.value === tool) probing.value = false;
  }
}

// tools are registered server-side (filtered by permission, sorted); internal ones open in the frame, external in a new tab
const { loading, action: load } = useAsync(async () => {
  tools.value = (await (await getApiClient()).getDeveloperTools()) ?? [];
  const first = current.value ?? tools.value.find((x) => !x.isExternal);
  if (first) await show(first);
});

function select(event: MouseEvent, tool: DeveloperToolDescriptor) {
  if (tool.isExternal) return;
  event.preventDefault();
  show(tool);
}

const toolbar = ref<IBladeToolbar[]>([
  refreshItem(() => current.value && show(current.value)),
  {
    id: "open",
    title: t("PLATFORM.DEVTOOLS.OPEN_IN_TAB"),
    icon: "lucide-external-link",
    clickHandler: () => current.value && window.open(current.value.url, "_blank", "noopener"),
  },
]);

load();
</script>

<style lang="scss">
.platform-devtools {
  display: flex;
  flex-direction: column;
  height: 100%;
  &__tabs {
    display: flex;
    gap: 4px;
    padding: 12px 22px 0;
    border-bottom: 1px solid var(--color-neutral-200);
  }
  &__tab {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    font-size: 14px;
    color: var(--color-neutral-600);
    text-decoration: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    &:hover {
      color: var(--color-neutral-900);
    }
    &--active {
      color: var(--color-primary-600);
      border-bottom-color: var(--color-primary-500);
      font-weight: 500;
    }
  }
  &__content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 20px 22px;
  }
  &__frame {
    flex: 1;
    width: 100%;
    min-height: 0;
    border: 1px solid var(--color-neutral-200);
    border-radius: 6px;
  }
  &__json {
    flex: 1;
    margin: 0;
    overflow: auto;
    padding: 16px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 13px;
    line-height: 1.5;
    color: var(--color-neutral-800);
    background: var(--color-secondary-50);
    border: 1px solid var(--color-neutral-200);
    border-radius: 6px;
  }
  &__empty {
    padding: 22px;
  }
}
</style>
