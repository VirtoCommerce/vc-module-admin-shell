<template>
  <SettingsList />
</template>

<script setup lang="ts">
// One object's settings (a store's, a catalog's) for module plugins, in the Settings blade's look: the same tree and
// editors, scoped by the options (connected: the entity's settings, saved with it; disconnected: the object's settings
// through the tenant API). The contract is in list.vue (ObjectSettingsOptions) and docs/object-settings.md.
import SettingsList from "./list.vue";

defineBlade({
  url: "/object-settings",
  name: "PlatformObjectSettings",
});
</script>
