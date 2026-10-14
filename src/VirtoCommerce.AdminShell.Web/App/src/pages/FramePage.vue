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
import { useMutationObserver } from "@vueuse/core";
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

function readableRules(sheet: CSSStyleSheet): CSSRule[] {
  try {
    return [...sheet.cssRules];
  } catch {
    return []; // a stylesheet from another origin
  }
}

/** The custom properties the app's stylesheets set on :root (the frame's own CSSStyleRule, so no instanceof) */
function rootVariables(doc: Document) {
  const roots = [...doc.styleSheets]
    .flatMap(readableRules)
    .filter((rule): rule is CSSStyleRule => "selectorText" in rule && String(rule.selectorText).startsWith(":root"));
  return new Set(roots.flatMap((rule) => [...rule.style].filter((name) => name.startsWith("--"))));
}

// The app's vc-shell colours (its :root variables) take this shell's values, so it matches in either theme
function themeBridge(doc: Document, host: CSSStyleDeclaration) {
  const colors = [...rootVariables(doc)].flatMap((name) => {
    const value = host.getPropertyValue(name).trim();
    return /^(#|rgb|hsl)/.test(value) ? [`${name}:${value}!important`] : [];
  });
  return `:root{${colors.join(";")}}`;
}

// ponytail: an app (Tasks, News) is fitted from outside (same origin): this shell's colours and theme, and, when its
// pages are in this menu, no sidebar of its own; drop once the app is a module of this shell
function fitEmbedded() {
  try {
    const doc = frame.value?.contentDocument;
    if (!doc?.head || !frame.value) return;
    const style = doc.getElementById("as-embedded") ?? doc.head.appendChild(doc.createElement("style"));
    style.id = "as-embedded";
    style.textContent =
      (navigatesFromMenu.value ? ".desktop-layout,.desktop-layout__spacer{display:none!important}" : "") +
      themeBridge(doc, getComputedStyle(frame.value));
    doc.documentElement.dataset.theme = document.documentElement.dataset.theme;
  } catch {
    // another origin: leave it as it is
  }
}
// a cold deep link can load the frame before the menu; fit it once the menu says the app navigates from it,
// and again once the theme has switched
watch(navigatesFromMenu, () => fitEmbedded());
useMutationObserver(document.documentElement, () => fitEmbedded(), { attributeFilter: ["data-theme"] });
</script>
