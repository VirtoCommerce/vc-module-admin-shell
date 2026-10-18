<template>
  <!-- The avatar's menu: who is signed in, license, language, theme, account actions and the build -->
  <div class="as-um">
    <div class="as-um__who">
      <img
        class="as-um__avatar"
        :src="avatar"
        alt=""
      />
      <div class="as-um__names">
        <div class="as-um__name">{{ name }}</div>
        <div class="as-um__email">{{ email || role }}</div>
      </div>
    </div>

    <div class="as-um__group">
      <div class="as-um__row">
        <VcIcon
          class="as-um__icon"
          icon="lucide-badge-check"
        />
        <span class="as-um__label">{{ $t("SHELL.USER_MENU.LICENSE") }}</span>
        <span
          class="as-um__chip"
          :class="`as-um__chip--${license.state}`"
          :title="license.title"
          >{{ license.text }}</span
        >
        <!-- the platform's license screen (modules/platform) -->
        <button
          type="button"
          class="as-um__link"
          @click="openPage('/license')"
        >
          {{ license.state === "active" ? $t("SHELL.USER_MENU.LICENSE_DETAILS") : $t("SHELL.USER_MENU.LICENSE_ACTIVATE") }}
        </button>
      </div>
      <div class="as-um__row">
        <VcIcon
          class="as-um__icon"
          icon="lucide-languages"
        />
        <span class="as-um__label">{{ $t("SHELL.USER_MENU.LANGUAGE") }}</span>
        <MenuSelect
          :model-value="currentLocale"
          :options="languages"
          :label="$t('SHELL.USER_MENU.LANGUAGE')"
          icon="lucide-globe"
          @update:model-value="setLocale"
        />
      </div>
      <div class="as-um__row">
        <VcIcon
          class="as-um__icon"
          icon="lucide-sun-moon"
        />
        <span
          id="as-um-theme"
          class="as-um__label"
          >{{ $t("SHELL.USER_MENU.THEME") }}</span
        >
        <span
          class="as-um__seg"
          role="radiogroup"
          aria-labelledby="as-um-theme"
        >
          <button
            v-for="mode in modes"
            :key="mode.key"
            type="button"
            role="radio"
            class="as-um__seg-button"
            :class="{ 'as-um__seg-button--on': themeMode === mode.key }"
            :aria-checked="themeMode === mode.key"
            :aria-label="mode.label"
            :title="mode.label"
            @click="themeMode = mode.key"
          >
            <VcIcon :icon="mode.icon" />
          </button>
        </span>
      </div>
      <div
        v-if="themeChoice"
        class="as-um__row"
      >
        <VcIcon
          class="as-um__icon"
          icon="lucide-palette"
        />
        <span class="as-um__label">{{ $t("SHELL.USER_MENU.COLOR_THEME") }}</span>
        <MenuSelect
          v-model="colorTheme"
          :options="colorThemes"
          :label="$t('SHELL.USER_MENU.COLOR_THEME')"
        />
      </div>
    </div>

    <div class="as-um__group">
      <a
        v-for="link in helpLinks"
        :key="link.key"
        class="as-um__row as-um__row--action"
        :href="link.url"
        target="_blank"
        rel="noopener"
        @click="emit('close')"
      >
        <VcIcon
          class="as-um__icon"
          :icon="link.icon"
        />
        <span class="as-um__label">{{ $t(`SHELL.AUTH.LINKS.${link.key.toUpperCase()}`) }}</span>
      </a>
      <!-- the way out to the AngularJS admin while modules move over -->
      <a
        class="as-um__row as-um__row--action"
        href="/"
        target="_blank"
        rel="noopener"
        @click="emit('close')"
      >
        <VcIcon
          class="as-um__icon"
          icon="lucide-external-link"
        />
        <span class="as-um__label">{{ $t("SHELL.NAV.CLASSIC_ADMIN") }}</span>
      </a>
      <button
        type="button"
        class="as-um__row as-um__row--action"
        @click="openPage('/user-profile')"
      >
        <VcIcon
          class="as-um__icon"
          icon="lucide-circle-user-round"
        />
        <span class="as-um__label">{{ $t("SHELL.ACCOUNT.PROFILE") }}</span>
      </button>
      <button
        type="button"
        class="as-um__row as-um__row--action"
        @click="logOut"
      >
        <VcIcon
          class="as-um__icon"
          icon="lucide-log-out"
        />
        <span class="as-um__label">{{ $t("SHELL.USER_MENU.SIGN_OUT") }}</span>
      </button>
    </div>

    <div class="as-um__build">{{ buildLine }}</div>
  </div>
</template>

<script lang="ts">
// the signed-in user's email, fetched once per page (the menu's content mounts on every open)
const knownEmails = new Map<string, string | undefined>();
</script>

<script setup lang="ts">
import { SecurityClient, useApiClient, useBladeStack, useLanguages, useUser } from "@vc-shell/framework";
import { VcIcon } from "@vc-shell/framework/ui";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { systemInfo, type SystemInfo } from "./dashboard/api";
import { formatLicenseDate, isLicenseExpired } from "./license";
import MenuSelect, { type MenuSelectOption } from "./MenuSelect.vue";
import { useLanguageOptions } from "./languages";
import { branding, safeUrl } from "./branding";
import { colorTheme, colorThemeOptions, themeChoice, themeMode, type ThemeMode } from "./themeMode";

defineProps<{ avatar?: string }>();
const emit = defineEmits<{ (e: "close"): void }>();

const { t } = useI18n({ useScope: "global" });
const { user, signOut } = useUser();
const { currentLocale, setLocale } = useLanguages();
const { blades, closeBlade } = useBladeStack();
const router = useRouter();
const { getApiClient: securityClient } = useApiClient(SecurityClient);

// the platform's build and license (read once per page)
const info = ref<SystemInfo>();
onMounted(async () => {
  info.value = await systemInfo().catch(() => undefined);
});

const name = computed(() => (user.value as { fullName?: string } | undefined)?.fullName || user.value?.userName || "");
const role = computed(() => (user.value?.isAdministrator ? t("SHELL.USER.ROLE.ADMINISTRATOR") : ""));

// the current-user call carries no email; the user's record does (it needs security read access, else the role shows)
const email = ref<string | undefined>(knownEmails.get(user.value?.userName ?? ""));
onMounted(async () => {
  const userName = user.value?.userName;
  if (!userName || knownEmails.has(userName)) return;
  try {
    email.value = (await (await securityClient()).getUserByName(userName)).email || undefined;
  } catch {
    // no security read access: the role shows
  }
  knownEmails.set(userName, email.value);
});

const languages = useLanguageOptions();

// each theme with its mark: its main color in the light and in the dark appearance
const colorThemes = computed<MenuSelectOption[]>(() =>
  colorThemeOptions.value.map((theme) => ({
    value: theme.id,
    label: theme.name ?? t(`SHELL.USER_MENU.COLOR_THEMES.${theme.id.toUpperCase()}`),
    swatch: theme.swatchClass,
    swatchStyle: theme.swatchStyle,
  })),
);

// the installation's Help and Support (white-labeling); none without a link
const helpLinks = computed(() =>
  [
    { key: "help", icon: "lucide-circle-help", url: safeUrl(branding.value.links.help) },
    { key: "support", icon: "lucide-life-buoy", url: safeUrl(branding.value.links.support) },
  ].filter((x) => x.url),
);

const modes = computed<{ key: ThemeMode; icon: string; label: string }[]>(() => [
  { key: "system", icon: "lucide-monitor", label: t("SHELL.USER_MENU.THEME_SYSTEM") },
  { key: "light", icon: "lucide-sun", label: t("CORE.THEMES.LIGHT") },
  { key: "dark", icon: "lucide-moon", label: t("CORE.THEMES.DARK") },
]);

const license = computed(() => {
  const l = info.value?.license;
  if (!l) return { state: "none", text: t("SHELL.USER_MENU.LICENSE_NONE"), title: t("SHELL.USER_MENU.LICENSE_NONE_HINT") };
  const expired = isLicenseExpired(l);
  const date = formatLicenseDate(l.expirationDate, "short");
  return {
    state: expired ? "expired" : "active",
    text: expired ? t("SHELL.USER_MENU.LICENSE_EXPIRED") : [l.type, date && t("SHELL.USER_MENU.LICENSE_UNTIL", { date })].filter(Boolean).join(" · "),
    title: [l.customerName, l.customerEmail].filter(Boolean).join(", "),
  };
});

const buildLine = computed(() =>
  [info.value?.platformVersion && t("SHELL.USER_MENU.BUILD", { version: info.value.platformVersion }), info.value?.environmentName]
    .filter(Boolean)
    .join(" · "),
);

// the license screen, or the profile (language, regional format, time zone; Change password is on its toolbar)
function openPage(path: string) {
  emit("close");
  router.push({ path });
}

// as vc-shell's own sign-out: child blades close first and may keep unsaved work
async function logOut() {
  emit("close");
  while (blades.value.length > 1) {
    if (await closeBlade(blades.value[blades.value.length - 1].id)) return;
  }
  await signOut();
  router.push({ name: "Login" });
}
</script>
