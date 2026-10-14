<template>
  <VcApp
    :is-ready="isReady"
    title="Virto Commerce"
    :version="version"
    :avatar="initialsAvatar"
  >
    <template #layout="{ isMobile }">
      <ShellLayout
        :mobile="isMobile"
        :avatar="initialsAvatar"
      />
    </template>
    <!-- vc-shell's workspace plus the header above the blades -->
    <template #workspace="{ isAuthenticated }">
      <main
        v-if="isAuthenticated"
        class="vc-app__workspace as-workspace"
        :class="{ 'as-workspace--stacked': stacked }"
        tabindex="-1"
      >
        <ShellHeader v-if="!isMobile" />
        <VcBladeNavigation />
      </main>
    </template>
  </VcApp>
  <LegacyHost />
</template>

<script lang="ts" setup>
import { ModulesReadyKey, VcBladeNavigation, useBladeStack, useResponsive, useUser } from "@vc-shell/framework";
import type { BladeDescriptor } from "@vc-shell/framework";
import { VcApp } from "@vc-shell/framework/ui";
import { computed, inject, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { requestedPath } from "../shell/deepLink";
import LegacyHost from "../shell/LegacyHost.vue";
import ShellHeader from "../shell/ShellHeader.vue";
import ShellLayout from "../shell/ShellLayout.vue";
import { registerModuleWidgets } from "../shell/dashboard";
import { systemInfo } from "../shell/dashboard/api";
import { useThemeMode } from "../shell/themeMode";

// system / light / dark, chosen in the avatar's menu
useThemeMode();

const version = import.meta.env.PACKAGE_VERSION;

const { isAuthenticated, user } = useUser();
const { isMobile } = useResponsive();

// the user's initials on the logo's amber, used when the user has no picture
const initialsAvatar = computed(() => {
  const name = (user.value as { fullName?: string } | undefined)?.fullName || user.value?.userName || "";
  const initials = name
    .split(/[\s._@-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0].toUpperCase())
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><circle cx="18" cy="18" r="18" fill="#FFB224"/><text x="18" y="22.5" text-anchor="middle" font-family="Plus Jakarta Sans,Segoe UI,Arial,sans-serif" font-size="13" font-weight="700" fill="#1A1206">${initials}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
});
// the session may finish loading after mount
const isReady = computed(() => isAuthenticated.value);

// the current blade gets the accent edge only while another blade is beside it
const { blades } = useBladeStack();
const stacked = computed(() => !isMobile.value && blades.value.filter((b: BladeDescriptor) => b.visible).length > 1);

// the installed modules decide which module-backed dashboard widgets the host adds (once: both calls are once-only)
watch(
  isReady,
  async (ready) => {
    if (!ready) return;
    const { installedModules } = await systemInfo();
    registerModuleWidgets((installedModules ?? []).map((m) => m.id!));
  },
  { immediate: true },
);

// re-open a deep link into a module route (e.g. #/orders) once the modules have registered their routes
const router = useRouter();
const modulesReady = inject(ModulesReadyKey, ref(true));
let deepLinkApplied = requestedPath === "/";
watch(
  modulesReady,
  (ready) => {
    if (ready && !deepLinkApplied) {
      deepLinkApplied = true;
      if (router.currentRoute.value.fullPath !== requestedPath) {
        router.replace(requestedPath);
      }
    }
  },
  { immediate: true },
);
</script>

<style lang="scss">
@use "./../styles/index.scss";
</style>
