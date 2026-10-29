<template>
  <AuthShell>
    <h1 class="as-auth__title">{{ $t("LOGIN.TITLE") }}</h1>
    <p class="as-auth__subtitle">{{ $t("SHELL.LOGIN.SUBTITLE", { name: companyName }) }}</p>

    <div
      v-if="error"
      class="as-auth__error"
      role="alert"
    >
      {{ error }}
    </div>

    <!-- the platform's external sign-in providers (Google, Microsoft Entra ID, OpenID Connect), when configured -->
    <template v-if="providers.length || methodButtons.length">
      <div class="as-auth__providers">
        <!-- sign-in methods modules add (a passkey): shown once the module's plugin gives the method a signIn -->
        <button
          v-for="button in methodButtons"
          :key="button.name"
          type="button"
          class="as-auth__provider"
          :disabled="busy"
          @click="signInWithMethod(button.name)"
        >
          <VcIcon
            v-if="methodBusy === button.name"
            icon="lucide-loader-circle"
            size="m"
            class="as-auth__spin"
          />
          <VcIcon
            v-else-if="button.icon"
            :icon="button.icon"
            size="m"
          />
          <img
            v-else-if="button.logo"
            :src="button.logo"
            alt=""
          />
          <VcIcon
            v-else
            icon="lucide-key-round"
            size="m"
          />
          {{ button.label }}
        </button>
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
      <div
        v-if="passwordEnabled"
        class="as-auth__divider"
      >
        {{ $t("SHELL.LOGIN.OR") }}
      </div>
    </template>

    <!-- Laid out on a grid so the tab order can differ from the look: email, password, Sign in, then "Forgot password?"
         (shown on the password label row) and the show-password eye (shown inside the field). -->
    <!-- as the AngularJS sign-in: no form when the platform has password sign-in turned off -->
    <form
      v-if="passwordEnabled"
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
import { rootedUrl } from "../utils/url";
import { companyName } from "../shell/branding";
import { goAfterSignIn, takeRedirectTarget } from "../shell/signIn";
import { loadSignInMethods, signInMethods, SignInError, type SignInMethod } from "../shell/signInMethods";

interface Provider {
  type: string;
  label: string;
  brand?: "google" | "microsoft";
  logo?: string;
}

const { t } = useI18n({ useScope: "global" });
const router = useRouter();
const { signIn, loading, user, loadUser } = useUserManagement();

const form = reactive({ username: "", password: "" });
const showPassword = ref(false);
const error = ref("");
const redirecting = ref(false);
// the module sign-in method in progress (its button shows a spinner)
const methodBusy = ref<string>();
const busy = computed(() => loading.value || redirecting.value || !!methodBusy.value);

const providerInfos = ref<ExternalSignInProviderInfo[]>([]);
const methods = ref<SignInMethod[]>([]);
onMounted(async () => {
  const [infos, list] = await Promise.all([
    // no providers: the password form still works
    new ExternalSignInClient().getExternalLoginProviders().catch(() => undefined),
    // a platform without sign-in methods: only the providers and the password
    loadSignInMethods().catch(() => undefined),
  ]);
  providerInfos.value = infos ?? [];
  methods.value = list ?? [];
});

// the password form, unless the platform lists sign-in methods without the password (password sign-in turned off)
const passwordEnabled = computed(() => !methods.value.length || methods.value.some((m) => m.kind === "Password"));

// The platform's own kinds keep their buttons (the providers above, the password form); a module's method gets one when
// its plugin has said how to sign in with it in this browser (a passkey needs WebAuthn)
const methodButtons = computed(() =>
  [...methods.value]
    .filter((m) => m.kind !== "Password" && m.kind !== "External" && signInMethods.get(m.name)?.signIn)
    .map((m) => {
      const extension = signInMethods.get(m.name)!;
      const title = extension.title?.() ?? m.displayName ?? m.name;
      return {
        name: m.name,
        icon: extension.icon,
        logo: rootedUrl(m.logoUrl),
        label: extension.signInTitle?.() ?? t("SHELL.LOGIN.CONTINUE_WITH", { name: title }),
      };
    }),
);

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

// The plugin talks to the browser and signs in with a cookie (signInMethods.signIn); the shell then opens the session as
// after a password. A cancelled prompt resolves false and shows nothing.
async function signInWithMethod(name: string) {
  const extension = signInMethods.get(name);
  if (!extension?.signIn || busy.value) return;
  error.value = "";
  methodBusy.value = name;
  try {
    if ((await extension.signIn()) === false) return;
    await goAfterSignIn(router, await loadUser());
  } catch (e) {
    error.value = methodSignInError(e);
  } finally {
    methodBusy.value = undefined;
  }
}

function methodSignInError(e: unknown) {
  if (e instanceof SignInError) {
    if (e.code === "user_is_locked_out" || e.code === "user_is_temporary_locked_out")
      return t("SHELL.LOGIN.ERRORS.LOCKED_OUT");
    if (e.code === "sign_in_not_allowed") return t("SHELL.LOGIN.ERRORS.NOT_ALLOWED");
    // the platform asks this method for a second factor, which only the password's code step can give
    if (e.code === "two_factor_required" || e.code === "two_factor_unavailable")
      return t("SHELL.LOGIN.ERRORS.METHOD_NEEDS_PASSWORD");
    if (e.status === 400) return t("SHELL.LOGIN.ERRORS.METHOD_FAILED");
    return t("LOGIN.ERRORS.AUTH_WITH_CODE", { code: e.status });
  }
  // the plugin's own message (a browser refusal it explains)
  return e instanceof Error && e.message ? e.message : t("SHELL.LOGIN.ERRORS.METHOD_FAILED");
}

async function signInWithPassword() {
  error.value = "";
  const result = (await signIn(form.username.trim(), form.password)) as SignInResult & {
    status?: number;
    error?: string;
  };

  if (result.succeeded) {
    await goAfterSignIn(router, user.value);
    return;
  }
  // the password is right and the platform asks for a second factor (vc-module-mfa): the code step finishes the sign-in
  if (result.requiresTwoFactor) {
    await router.push({ name: "TwoFactorSignIn" });
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
