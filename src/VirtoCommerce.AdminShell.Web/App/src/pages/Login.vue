<template>
  <AuthShell>
    <h1 class="as-auth__title">{{ $t("LOGIN.TITLE") }}</h1>
    <p class="as-auth__subtitle">{{ $t("SHELL.LOGIN.SUBTITLE") }}</p>

    <div
      v-if="error"
      class="as-auth__error"
      role="alert"
    >
      {{ error }}
    </div>

    <!-- the platform's external sign-in providers (Google, Microsoft Entra ID, OpenID Connect), when configured -->
    <template v-if="providers.length">
      <div class="as-auth__providers">
        <button
          v-for="provider in providers"
          :key="provider.type"
          type="button"
          class="as-auth__provider"
          :disabled="busy"
          @click="signInWith(provider.type)"
        >
          <svg
            v-if="provider.brand === 'google'"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <svg
            v-else-if="provider.brand === 'microsoft'"
            viewBox="0 0 21 21"
            aria-hidden="true"
          >
            <rect
              x="1"
              y="1"
              width="9"
              height="9"
              fill="#f25022"
            />
            <rect
              x="1"
              y="11"
              width="9"
              height="9"
              fill="#00a4ef"
            />
            <rect
              x="11"
              y="1"
              width="9"
              height="9"
              fill="#7fba00"
            />
            <rect
              x="11"
              y="11"
              width="9"
              height="9"
              fill="#ffb900"
            />
          </svg>
          <img
            v-else-if="provider.logo"
            :src="provider.logo"
            alt=""
          />
          <VcIcon
            v-else
            icon="lucide-key-round"
            size="m"
          />
          {{ provider.label }}
        </button>
      </div>
      <div class="as-auth__divider">{{ $t("SHELL.LOGIN.OR") }}</div>
    </template>

    <!-- Laid out on a grid so the tab order can differ from the look: email, password, Sign in, then "Forgot password?"
         (shown on the password label row) and the show-password eye (shown inside the field). -->
    <form
      class="as-auth__form"
      @submit.prevent="signInWithPassword"
    >
      <div class="as-auth__login">
        <label
          for="as-login"
          class="as-auth__label"
          >{{ $t("SHELL.LOGIN.LOGIN") }}</label
        >
        <input
          id="as-login"
          v-model="form.username"
          class="as-auth__input"
          type="text"
          name="username"
          autocomplete="username"
          autocapitalize="off"
          spellcheck="false"
          required
          :placeholder="$t('SHELL.LOGIN.LOGIN_PLACEHOLDER')"
        />
      </div>

      <label
        for="as-password"
        class="as-auth__label as-auth__password-label"
        >{{ $t("LOGIN.FIELDS.PASSWORD.LABEL") }}</label
      >
      <input
        id="as-password"
        v-model="form.password"
        class="as-auth__input as-auth__input--password as-auth__password"
        :type="showPassword ? 'text' : 'password'"
        name="password"
        autocomplete="current-password"
        required
        :placeholder="$t('LOGIN.FIELDS.PASSWORD.PLACEHOLDER')"
      />

      <button
        type="submit"
        class="as-auth__submit"
        :disabled="busy"
      >
        <VcIcon
          :icon="loading ? 'lucide-loader-circle' : 'lucide-log-in'"
          size="s"
          :class="{ 'as-auth__spin': loading }"
        />
        {{ $t(loading ? "SHELL.LOGIN.SIGNING_IN" : "LOGIN.BUTTON") }}
      </button>

      <RouterLink
        :to="{ name: 'ForgotPassword' }"
        class="as-auth__link as-auth__forgot"
      >
        {{ $t("LOGIN.FORGOT_PASSWORD_BUTTON") }}
      </RouterLink>

      <button
        type="button"
        class="as-auth__eye"
        :aria-label="$t(showPassword ? 'COMPONENTS.CONTROLS.HIDE_PASSWORD' : 'COMPONENTS.CONTROLS.SHOW_PASSWORD')"
        :aria-pressed="showPassword"
        @click="showPassword = !showPassword"
      >
        <VcIcon
          :icon="showPassword ? 'lucide-eye-off' : 'lucide-eye'"
          size="m"
        />
      </button>
    </form>

    <!-- modules can add to the sign-in page here, as on vc-shell's own -->
    <ExtensionPoint name="auth:after-form" />
  </AuthShell>
</template>

<script lang="ts" setup>
import { ExternalSignInClient, useUserManagement } from "@vc-shell/framework";
import type { ExternalSignInProviderInfo, SignInResult } from "@vc-shell/framework";
import { ExtensionPoint } from "@vc-shell/framework/extensions";
import { VcIcon } from "@vc-shell/framework/ui";
import { computed, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import AuthShell from "./AuthShell.vue";

interface Provider {
  type: string;
  label: string;
  brand?: "google" | "microsoft";
  logo?: string;
}

const { t } = useI18n({ useScope: "global" });
const router = useRouter();
const { signIn, loading, user } = useUserManagement();

const form = reactive({ username: "", password: "" });
const showPassword = ref(false);
const error = ref("");
const redirecting = ref(false);
const busy = computed(() => loading.value || redirecting.value);

const providerInfos = ref<ExternalSignInProviderInfo[]>([]);
onMounted(async () => {
  try {
    providerInfos.value = (await new ExternalSignInClient().getExternalLoginProviders()) ?? [];
  } catch {
    // no providers: the password form still works
  }
});

// Each module names its provider ("GoogleSSO" / "Google", "AzureAD" / "Microsoft Entra ID", "oidc" / "OpenID Connect")
// and the captions are configurable, so the brand is read from both. A provider we don't know keeps its own caption.
const providers = computed<Provider[]>(() =>
  providerInfos.value
    .filter((x) => x.authenticationType)
    .map((x) => {
      const type = x.authenticationType!;
      const name = x.displayName ?? "";
      if (/google/i.test(`${type} ${name}`)) {
        return { type, brand: "google", label: t("SHELL.LOGIN.CONTINUE_WITH", { name: "Google" }) };
      }
      if (/microsoft|azure|entra|\baad\b/i.test(`${type} ${name}`)) {
        return { type, brand: "microsoft", label: t("SHELL.LOGIN.CONTINUE_WITH", { name: "Microsoft" }) };
      }
      const generic = !name || /openid|oidc/i.test(name);
      return {
        type,
        logo: rootedUrl(x.logoUrl),
        label: generic ? t("SHELL.LOGIN.CONTINUE_WITH_SSO") : t("SHELL.LOGIN.CONTINUE_WITH", { name }),
      };
    }),
);

// module logos come relative to the site root ("Modules/$(VirtoCommerce.OpenIdConnectModule)/..."); this page is under /apps/
function rootedUrl(url?: string) {
  return !url || url.startsWith("/") || url.includes("://") ? url : `/${url}`;
}

// where an expired session or a deep link left off; same-site paths only. Read once, so a later sign-in can't land there.
function takeRedirectTarget() {
  const target = localStorage.getItem("redirectAfterLogin")?.trim();
  localStorage.removeItem("redirectAfterLogin");
  return target?.startsWith("/") && !target.startsWith("//") ? target : "/";
}

function signInWith(authenticationType: string) {
  // the same as vc-shell's own: sign-out reads this key to sign out of the provider as well
  localStorage.setItem("externalSignIn", JSON.stringify({ providerType: authenticationType }));
  const url = new URL("/externalsignin", window.location.origin);
  url.searchParams.set("authenticationType", authenticationType);
  // the app's hash route rides along in the return url ("/apps/admin-shell/" + "#/legacy?url=...")
  url.searchParams.set("returnUrl", window.location.pathname + router.resolve(takeRedirectTarget()).href);
  redirecting.value = true;
  window.location.assign(url);
}

async function signInWithPassword() {
  error.value = "";
  const result = (await signIn(form.username.trim(), form.password)) as SignInResult & { status?: number; error?: string };

  if (result.succeeded) {
    if (user.value?.passwordExpired) {
      await router.push({ name: "ChangePassword" });
      return;
    }
    await router.push(takeRedirectTarget());
    return;
  }

  error.value = signInError(result);
  form.password = "";
}

function signInError(result: SignInResult & { status?: number; error?: string }) {
  if (result.isLockedOut) return t("SHELL.LOGIN.ERRORS.LOCKED_OUT");
  if (result.isNotAllowed) return t("SHELL.LOGIN.ERRORS.NOT_ALLOWED");
  if (result.status === 401) return t("LOGIN.ERRORS.INVALID_CREDENTIALS");
  if (result.status) return t("LOGIN.ERRORS.AUTH_WITH_CODE", { code: result.status });
  if (result.error) return t("LOGIN.ERRORS.AUTH_GENERIC", { detail: result.error });
  return t("LOGIN.ERRORS.INVALID_CREDENTIALS");
}
</script>
