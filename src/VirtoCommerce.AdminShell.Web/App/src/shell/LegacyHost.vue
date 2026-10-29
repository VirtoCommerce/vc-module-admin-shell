<template>
  <!--
    One persistent AngularJS admin (embedded mode) shared by every legacy menu item.
    It stays loaded when hidden, so moving between legacy sections only changes its hash instead of reloading AngularJS.
    It is positioned over the workspace area rather than rendered inside it, because the workspace RouterView
    unmounts route components on navigation.
  -->
  <iframe
    v-if="started"
    ref="frame"
    class="legacy-host"
    :class="{ 'legacy-host--hidden': !active }"
    :style="rectStyle"
    :src="initialSrc"
    title="Virto Commerce"
  />
  <div
    v-else-if="missing && active"
    class="legacy-host legacy-host--missing"
    :style="rectStyle"
  >
    {{ t("SHELL.NAV.CLASSIC_ADMIN_MISSING") }}
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { legacyAdminBaseUrl, legacyAdminSrc } from "./legacyAdmin";

const route = useRoute();
const frame = ref<HTMLIFrameElement>();
const { t } = useI18n({ useScope: "global" });
const started = ref(false);
// no AngularJS admin installed: its screens can't open
const missing = ref(false);
const initialSrc = ref("");
const rect = ref({ top: 0, left: 0, width: 0, height: 0 });

const active = computed(() => route.name === "Legacy");
const legacyUrl = computed(() => String(route.query.url ?? "/workspace"));

const rectStyle = computed(() => ({
  top: `${rect.value.top}px`,
  left: `${rect.value.left}px`,
  width: `${rect.value.width}px`,
  height: `${rect.value.height}px`,
}));

function navigate(url: string) {
  const win = frame.value?.contentWindow as (Window & { angular?: any }) | null | undefined;
  if (!win) {
    return;
  }
  const hash = `#!${url}`;
  if (win.location.hash === hash) {
    // same state again: reopen it from its root blade
    try {
      win.angular?.element(win.document.body).injector()?.get("$state").reload();
    } catch {
      // AngularJS not ready yet: nothing to reset
    }
  } else {
    win.location.hash = hash;
  }
}

// follow the workspace area (it changes with the sidebar pin state and window size)
let observer: ResizeObserver | undefined;
let observed: Element | null = null;

function measure() {
  if (!observed) {
    return;
  }
  const r = observed.getBoundingClientRect();
  rect.value = { top: r.top, left: r.left, width: r.width, height: r.height };
}

function trackWorkspace() {
  // the blade area, under the header
  const workspace = document.querySelector(".vc-app__workspace .vc-blade-navigation");
  if (!workspace) {
    // not rendered yet (signing in); try again on the next frame
    requestAnimationFrame(() => active.value && trackWorkspace());
    return;
  }
  if (workspace !== observed) {
    observer?.disconnect();
    observer = new ResizeObserver(measure);
    observer.observe(workspace);
    observed = workspace;
  }
  measure();
}

let starting = false;

async function start() {
  if (starting) {
    return;
  }
  starting = true;
  const base = await legacyAdminBaseUrl();
  if (base === null) {
    missing.value = true;
    return;
  }
  // AngularJS reads EmbeddedMode from the real query string, which survives in-app navigation;
  // the state asked for while the base url was fetched is the one to open
  initialSrc.value = legacyAdminSrc(base, legacyUrl.value);
  started.value = true;
}

watch(
  [active, legacyUrl],
  ([isActive, url]) => {
    if (!isActive) {
      return;
    }
    trackWorkspace();
    if (!started.value) {
      void start();
    } else {
      navigate(url);
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => observer?.disconnect());
</script>

<style lang="scss">
.legacy-host {
  border: 0;
  background: var(--additional-50);
  position: fixed;
  z-index: 1;

  &--hidden {
    visibility: hidden;
    pointer-events: none;
  }

  &--missing {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    text-align: center;
    color: var(--neutrals-500);
  }
}
</style>
