<template>
  <AuthShell>
    <h1 class="as-auth__title">{{ $t("SHELL.ACCESS_DENIED.TITLE") }}</h1>
    <p class="as-auth__subtitle">{{ $t("SHELL.ACCESS_DENIED.MESSAGE", { name: companyName }) }}</p>

    <p
      v-if="user?.userName"
      class="as-auth__account"
    >
      {{ $t("SHELL.ACCESS_DENIED.SIGNED_IN_AS", { name: user.userName }) }}
    </p>

    <button
      type="button"
      class="as-auth__submit"
      :disabled="busy"
      @click="switchAccount"
    >
      <VcIcon
        :icon="busy ? 'lucide-loader-circle' : 'lucide-log-out'"
        size="s"
        :class="{ 'as-auth__spin': busy }"
      />
      {{ $t("SHELL.ACCESS_DENIED.SWITCH_ACCOUNT") }}
    </button>
  </AuthShell>
</template>

<script lang="ts" setup>
// The platform's PlatformUI:Access rules keep this user out of the admin UI (shell/adminUIAccess.ts); as the AngularJS
// admin's access-denied page, it offers signing in with another account
import { useUser } from "@vc-shell/framework";
import { VcIcon } from "@vc-shell/framework/ui";
import { ref } from "vue";
import { useRouter } from "vue-router";
import AuthShell from "./AuthShell.vue";
import { companyName } from "../shell/branding";

const router = useRouter();
const { user, signOut } = useUser();
const busy = ref(false);

async function switchAccount() {
  busy.value = true;
  try {
    await signOut();
    await router.push({ name: "Login" });
  } finally {
    busy.value = false;
  }
}
</script>

<style lang="scss">
.as-auth__account {
  color: var(--color-neutral-700);
  font-size: 14px;
  margin: -16px 0 24px;
  overflow-wrap: anywhere;
}
</style>
