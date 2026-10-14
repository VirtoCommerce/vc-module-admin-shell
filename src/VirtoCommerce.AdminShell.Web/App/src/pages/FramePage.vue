<template>
  <!-- An app (/apps/{id}) shown in the workspace as one full-width blade. Legacy AngularJS screens use LegacyHost instead. -->
  <section
    v-if="src"
    class="as-frame"
    :aria-label="title"
  >
    <div class="as-frame__head">
      <div class="as-frame__titles">
        <span
          v-if="kicker"
          class="as-frame__kicker"
          >{{ kicker }}</span
        >
        <h1 class="as-frame__title">{{ title }}</h1>
      </div>
      <button
        type="button"
        class="as-frame__tool"
        @click="nonce++"
      >
        <VcIcon icon="lucide-refresh-cw" />
        {{ $t("SHELL.FRAME.REFRESH") }}
      </button>
      <a
        class="as-frame__tool"
        :href="tabUrl"
        target="_blank"
        rel="noopener"
      >
        <VcIcon icon="lucide-external-link" />
        {{ $t("SHELL.FRAME.NEW_TAB") }}
      </a>
    </div>
    <iframe
      :key="src + nonce"
      ref="frame"
      class="frame-page"
      :src="src"
      :title="title"
      @load="fitEmbedded()"
    />
  </section>
  <div
    v-else
    class="frame-page"
  />
</template>

<script setup lang="ts">
import { VcIcon } from "@vc-shell/framework/ui";
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useAdminMenu } from "../composables/useAdminMenu";

const route = useRoute();
const { active, activeTitle } = useAdminMenu();
const nonce = ref(0);
const frame = ref<HTMLIFrameElement>();

const appPath = computed(() => String(route.query.path ?? ""));

// the app on its own, with its own navigation
const tabUrl = computed(() => `/apps/${encodeURIComponent(String(route.params.appId))}/#${appPath.value}`);

// Legacy: the persistent LegacyHost iframe is shown over this empty page
const src = computed(() => (route.name === "EmbeddedApp" ? `${tabUrl.value}?EmbeddedMode=true` : ""));

// the menu item open here: its section names the blade, its children (if any) replace the app's own navigation
const kicker = computed(() => active.value?.section.title);
const title = computed(() => activeTitle.value || String(route.params.appId ?? ""));
const navigatesFromMenu = computed(() => !!active.value?.item.children?.length);

// ponytail: an app with its pages in this menu (News) gets its own sidebar hidden from outside (same origin);
// drop once the app is a module of this shell
function fitEmbedded() {
  if (!navigatesFromMenu.value) return;
  try {
    const doc = frame.value?.contentDocument;
    if (!doc?.head || doc.getElementById("as-embedded")) return;
    const style = doc.createElement("style");
    style.id = "as-embedded";
    style.textContent = ".desktop-layout,.desktop-layout__spacer{display:none!important}";
    doc.head.append(style);
  } catch {
    // another origin: leave it as it is
  }
}
// a cold deep link can load the frame before the menu; fit it once the menu says the app navigates from it
watch(navigatesFromMenu, () => fitEmbedded());
</script>
