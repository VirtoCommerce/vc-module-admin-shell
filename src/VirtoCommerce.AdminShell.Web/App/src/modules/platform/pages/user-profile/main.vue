<template>
  <VcBlade
    :title="$t('PLATFORM.PROFILE.TITLE')"
    :subtitle="$t('PLATFORM.PROFILE.SUBTITLE')"
    :loading="loading"
    :toolbar-items="toolbar"
    width="50%"
  >
    <VcContainer>
      <VcForm
        v-if="profile"
        class="platform-form"
      >
        <!-- who you are: the account (Security > Users holds the rest of it) -->
        <h3 class="platform-profile__heading">{{ $t("PLATFORM.PROFILE.ACCOUNT") }}</h3>
        <VcInput
          :model-value="account.userName"
          :label="$t('PLATFORM.PROFILE.USER_NAME')"
          disabled
        />
        <VcRow class="tw-gap-4">
          <VcCol>
            <VcInput
              v-model="account.email"
              type="email"
              :label="$t('PLATFORM.PROFILE.EMAIL')"
              :disabled="!canEditAccount"
              :error-message="emailError"
              @blur="saveAccount()"
            />
          </VcCol>
          <VcCol>
            <VcInput
              v-model="account.phoneNumber"
              type="tel"
              :label="$t('PLATFORM.PROFILE.PHONE')"
              :disabled="!canEditAccount"
              @blur="saveAccount()"
            />
          </VcCol>
        </VcRow>
        <p class="platform-note">
          <template v-if="account.memberId">
            {{ $t("PLATFORM.PROFILE.NAME_FROM_CONTACT") }}
            <a
              href="#"
              @click.prevent="openContact"
              >{{ $t("PLATFORM.PROFILE.OPEN_CONTACT") }}</a
            >
          </template>
          <template v-else>{{ $t("PLATFORM.PROFILE.NO_CONTACT") }}</template>
          <template v-if="!canEditAccount"> {{ $t("PLATFORM.PROFILE.ACCOUNT_READ_ONLY") }}</template>
        </p>

        <h3 class="platform-profile__heading">{{ $t("PLATFORM.PROFILE.PREFERENCES") }}</h3>
        <VcSelect
          v-model="values.Language"
          :label="$t('PLATFORM.PROFILE.LANGUAGE')"
          :options="languages"
          searchable
        />
        <!-- the Admin Shell's look, as in the avatar's menu (both keep it in the user's profile, shell/themeMode.ts) -->
        <VcRow class="tw-gap-4">
          <VcCol>
            <VcSelect
              v-model="themeMode"
              :label="$t('SHELL.USER_MENU.THEME')"
              :options="appearances"
              :clearable="false"
            />
          </VcCol>
          <VcCol>
            <VcSelect
              v-model="colorTheme"
              :label="$t('SHELL.USER_MENU.COLOR_THEME')"
              :options="colorThemes"
              :clearable="false"
            >
              <template #selected-item="{ opt }">
                <span class="platform-profile__theme">
                  <span
                    class="as-um__swatch"
                    :class="`as-um__swatch--${opt.id}`"
                    aria-hidden="true"
                  />
                  {{ opt.title }}
                </span>
              </template>
              <template #option="{ opt }">
                <span class="platform-profile__theme">
                  <span
                    class="as-um__swatch"
                    :class="`as-um__swatch--${opt.id}`"
                    aria-hidden="true"
                  />
                  {{ opt.title }}
                </span>
              </template>
            </VcSelect>
          </VcCol>
        </VcRow>
        <VcSelect
          v-model="values.RegionalFormat"
          :label="$t('PLATFORM.PROFILE.REGIONAL_FORMAT')"
          :options="regionalFormats"
          :clearable="false"
          searchable
        />
        <VcSelect
          v-model="values.TimeZone"
          :label="$t('PLATFORM.PROFILE.TIME_ZONE')"
          :placeholder="$t('PLATFORM.PROFILE.TIME_ZONE_AUTO', { zone: browserZone })"
          :options="timeZones()"
          searchable
        />
        <VcSwitch
          v-model="values.UseTimeAgo as boolean"
          :label="$t('PLATFORM.PROFILE.USE_TIME_AGO')"
          :hint="$t('PLATFORM.PROFILE.USE_TIME_AGO_HINT')"
        />
        <VcRow class="tw-gap-4">
          <VcCol>
            <VcInput
              v-model="values.FullDateThreshold as number"
              type="integer"
              :label="$t('PLATFORM.PROFILE.THRESHOLD')"
              :disabled="!thresholdEnabled"
              :required="thresholdEnabled"
              :error-message="thresholdError"
            />
          </VcCol>
          <VcCol>
            <VcSelect
              v-model="values.FullDateThresholdUnit"
              :label="$t('PLATFORM.PROFILE.THRESHOLD_UNIT')"
              :options="units"
              :clearable="false"
              :disabled="!values.UseTimeAgo"
            />
          </VcCol>
        </VcRow>
      </VcForm>
    </VcContainer>
  </VcBlade>
</template>

<script setup lang="ts">
import {
  ChangePassword,
  SecurityClient,
  defineBladeContext,
  useLoading,
  usePermissions,
  usePopup,
  useApiClient,
  useAsync,
  useFunctions,
  useLanguages,
  useUser,
  type ApplicationUser,
  type IBladeToolbar,
  type ObjectSettingEntry,
  type UserDetail,
} from "@vc-shell/framework";
import { VcBlade, VcCol, VcContainer, VcForm, VcInput, VcRow, VcSelect, VcSwitch } from "@vc-shell/framework/ui";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { api } from "../../api";
import { ensureSucceeded } from "../../composables/security";
import { COLOR_THEMES, colorTheme, themeMode } from "../../../../shell/themeMode";
import { browserZone, languageName, timeZones } from "./intl";

defineBlade({
  url: "/user-profile",
  name: "PlatformUserProfile",
  isWorkspace: true,
});

interface Profile {
  id: string;
  memberId?: string;
  typeName: string;
  settings: ObjectSettingEntry[];
}

const PREFIX = "VirtoCommerce.Platform.UI.";
const FIELDS = ["Language", "RegionalFormat", "TimeZone", "UseTimeAgo", "FullDateThreshold", "FullDateThresholdUnit"] as const;
type Field = (typeof FIELDS)[number];

const { t, availableLocales } = useI18n({ useScope: "global" });
const { currentLocale, setLocale } = useLanguages();
const { debounce } = useFunctions();
const { getApiClient: securityClient } = useApiClient(SecurityClient);
const { user } = useUser();

// the current user, for widgets other modules add to this blade (legacy 'userProfileDetail'; targetBlades: ["PlatformUserProfile"])
const item = ref<UserDetail>({});
defineBladeContext({ item });

// the profile saves as you go; the toolbar has the account's other own action (the avatar menu links here)
const { open: changePassword } = usePopup({ component: ChangePassword });
const toolbar = ref<IBladeToolbar[]>([
  { id: "changePassword", title: t("SHELL.ACCOUNT.CHANGE_PASSWORD"), icon: "lucide-key-round", clickHandler: () => changePassword() },
]);

const profile = ref<Profile>();
const values = ref<Partial<Record<Field, unknown>>>({});
const languages = ref<{ id: string; title: string }[]>([]);
const regionalFormats = ref<{ id: string; title: string }[]>([]);
let saved = "";

// the look: saved to the profile by shell/themeMode.ts as soon as it changes, like the avatar's menu does
const appearances = computed(() => [
  { id: "system", title: t("SHELL.USER_MENU.THEME_SYSTEM") },
  { id: "light", title: t("CORE.THEMES.LIGHT") },
  { id: "dark", title: t("CORE.THEMES.DARK") },
]);
const colorThemes = computed(() =>
  COLOR_THEMES.map((id) => ({ id, title: t(`SHELL.USER_MENU.COLOR_THEMES.${id.toUpperCase()}`) })),
);

const units = computed(() =>
  ["Never", "Seconds", "Minutes", "Hours", "Days", "Weeks", "Months", "Quarters", "Years"].map((x) => ({
    id: x,
    title: t(`PLATFORM.PROFILE.UNITS.${x.toUpperCase()}`),
  })),
);

const thresholdEnabled = computed(() => !!values.value.UseTimeAgo && (values.value.FullDateThresholdUnit ?? "Never") !== "Never");
// a threshold that is not a number (empty, text) is as invalid as one below 1
const thresholdInvalid = (value: unknown) => {
  const threshold = Number(value);
  return Number.isNaN(threshold) || threshold < 1;
};
const thresholdError = computed(() =>
  thresholdEnabled.value && thresholdInvalid(values.value.FullDateThreshold) ? t("PLATFORM.PROFILE.THRESHOLD_INVALID") : undefined,
);

// the account record (email, phone, linked contact); editing it takes the security update permission, as on Security > Users
const { hasAccess } = usePermissions();
const router = useRouter();
const account = ref<ApplicationUser>({} as ApplicationUser);
let savedAccount = "";
const canEditAccount = computed(() => !!account.value.id && hasAccess("platform:security:update"));
// an account keeps an email (password resets go to it): empty is an error too, and nothing invalid is saved
const emailError = computed(() =>
  canEditAccount.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.value.email ?? "") ? t("PLATFORM.PROFILE.EMAIL_INVALID") : undefined,
);
const accountSnapshot = () => JSON.stringify([account.value.email ?? "", account.value.phoneNumber ?? ""]);

const { loading: accountSaving, action: saveAccount } = useAsync(async () => {
  if (!canEditAccount.value || emailError.value || accountSnapshot() === savedAccount) return;
  ensureSucceeded(await (await securityClient()).update(account.value));
  savedAccount = accountSnapshot();
});
// saved on leaving the field (not while typing, which would store half an address)

const openContact = () => router.push(`/customers/customer-contact/${account.value.memberId}`);

const { loading: loadLoading, action: load } = useAsync(async () => {
  // the full record needs security read access, and its lookup can fail (an external account): then the account
  // shows what the session knows, read-only, and the rest of the profile still loads
  const me: UserDetail = user.value ?? {};
  const known = { userName: me.userName, memberId: me.memberId } as ApplicationUser;
  const [result, locales, formats, record] = await Promise.all([
    api<Profile>("GET", "/api/platform/profiles/currentuser"),
    api<string[]>("GET", "/api/platform/localization/locales"),
    api<string[]>("GET", "/api/platform/localization/regionalformats"),
    hasAccess("platform:security:query") && me.userName
      ? securityClient()
          .then((c) => c.getUserByName(me.userName!))
          .catch(() => undefined)
      : undefined,
  ]);
  item.value = me;
  account.value = record ?? known;
  savedAccount = accountSnapshot();
  profile.value = result;
  languages.value = (locales ?? []).map((code) => ({ id: code, title: languageName(code) }));
  regionalFormats.value = (formats ?? []).map((code) => ({ id: code, title: `${languageName(code, "en")} (${code})` }));
  values.value = Object.fromEntries(
    FIELDS.map((f) => {
      const entry = result.settings.find((s) => s.name === PREFIX + f);
      return [f, entry?.value ?? entry?.defaultValue ?? undefined];
    }),
  );
  saved = JSON.stringify(values.value);
});

// legacy saves every change immediately: the whole profile goes back with the updated setting values
const { loading: saveLoading, action: save } = useAsync(async () => {
  const snapshot = JSON.stringify(values.value);
  if (!profile.value || thresholdError.value || snapshot === saved) return;
  // only the fields the user changed: untouched ones keep their stored value (null = platform default)
  const previous = JSON.parse(saved) as Partial<Record<Field, unknown>>;
  for (const f of FIELDS) {
    const entry = profile.value.settings.find((s) => s.name === PREFIX + f);
    if (entry && JSON.stringify(values.value[f] ?? null) !== JSON.stringify(previous[f] ?? null)) {
      entry.value = values.value[f] === "" ? null : values.value[f];
    }
  }
  // only this blade's settings go back: the profile carries others (the look, saved as it changes) that this copy of it
  // may hold older values of
  const own = profile.value.settings.filter((s) => FIELDS.some((f) => s.name === PREFIX + f));
  await api("POST", "/api/platform/profiles/currentuser", { ...profile.value, settings: own });
  saved = snapshot;
});

const loading = useLoading(loadLoading, saveLoading, accountSaving);

watch(values, debounce(() => save(), 400), { deep: true });

// the language is the shell's too: chosen here it applies at once when the shell has it (the platform's list is longer),
// and one chosen in the avatar's menu shows here
watch(
  () => values.value.Language,
  (lang) => {
    if (typeof lang === "string" && lang !== currentLocale.value && availableLocales.includes(lang)) setLocale(lang);
  },
);
watch(currentLocale, (lang) => {
  if (profile.value && lang && values.value.Language !== lang) values.value.Language = lang;
});

load();
</script>

<style lang="scss">
.platform-profile__theme {
  align-items: center;
  display: inline-flex;
  gap: 8px;
}

.platform-profile__heading {
  color: var(--color-neutral-900);
  font-size: 15px;
  font-weight: 700;
  margin: 4px 0 -6px;
}
</style>
