<template>
  <AuthShell>
    <h1
      class="as-auth__title"
      :class="{ 'as-mfa__title--final': finalError }"
    >
      {{ $t("SHELL.MFA.TITLE") }}
    </h1>
    <p
      v-if="!finalError"
      class="as-auth__subtitle"
    >
      <!-- the masked address keeps its own direction inside a right-to-left sentence -->
      <i18n-t
        v-if="destination"
        keypath="SHELL.MFA.SUBTITLE"
        scope="global"
      >
        <template #destination>
          <bdi>{{ destination }}</bdi>
        </template>
      </i18n-t>
      <template v-else>{{ $t("SHELL.MFA.SUBTITLE_EMAIL") }}</template>
    </p>

    <div
      v-if="error"
      class="as-auth__error"
      role="alert"
    >
      {{ error }}
    </div>
    <div
      v-if="notice"
      class="as-auth__notice"
      aria-live="polite"
    >
      {{ notice }}
    </div>

    <form
      v-if="!finalError"
      class="as-mfa__form"
      novalidate
      @submit.prevent="verify"
    >
      <label
        for="as-mfa-code"
        class="as-auth__label"
        >{{ $t("SHELL.MFA.CODE") }}</label
      >
      <input
        id="as-mfa-code"
        ref="codeInput"
        v-model="code"
        class="as-auth__input as-mfa__code"
        type="text"
        name="code"
        inputmode="numeric"
        autocomplete="one-time-code"
        maxlength="6"
        dir="ltr"
        required
        :disabled="busy"
        :placeholder="$t('SHELL.MFA.CODE_PLACEHOLDER')"
        @input="code = code.replace(/\D/g, '')"
      />

      <button
        type="submit"
        class="as-auth__submit as-mfa__submit"
        :disabled="busy || !codeComplete"
      >
        <VcIcon
          :icon="verifying ? 'lucide-loader-circle' : 'lucide-log-in'"
          size="s"
          :class="{ 'as-auth__spin': verifying }"
        />
        {{ $t(verifying ? "SHELL.LOGIN.SIGNING_IN" : "LOGIN.BUTTON") }}
      </button>
    </form>

    <div class="as-mfa__links">
      <template v-if="!finalError">
        <span
          v-if="resendSecondsLeft"
          class="as-mfa__countdown"
        >
          {{ $t("SHELL.MFA.RESEND_COUNTDOWN", { seconds: resendSecondsLeft }) }}
        </span>
        <button
          v-else
          type="button"
          class="as-auth__link as-mfa__link"
          :disabled="busy"
          @click="sendCode(true)"
        >
          {{ $t("SHELL.MFA.RESEND") }}
        </button>
      </template>
      <RouterLink
        :to="{ name: 'Login' }"
        class="as-auth__link"
      >
        {{ $t("SHELL.MFA.BACK") }}
      </RouterLink>
    </div>
  </AuthShell>
</template>

<script lang="ts" setup>
// The second step of a password sign-in when the platform asks for one (vc-module-mfa): the platform's sign-in answers
// requiresTwoFactor and keeps the user in its two-factor cookie, and this page sends and checks the code through the
// module's api/mfa/signin, as the module's own code screen does in the AngularJS admin
import { useUser } from "@vc-shell/framework";
import { VcIcon } from "@vc-shell/framework/ui";
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import AuthShell from "./AuthShell.vue";
import { goAfterSignIn } from "../shell/signIn";

interface MfaError {
  code?: string;
}

interface MfaSendCodeResult {
  succeeded?: boolean;
  error?: MfaError;
  provider?: string;
  providers?: { name?: string; destination?: string }[];
  resendSecondsRemaining?: number;
}

interface MfaSignInResult {
  succeeded?: boolean;
  error?: MfaError;
}

// the module's error codes that have a message of their own; any other is a generic sign-in failure
const KNOWN_ERRORS = [
  "invalid_code",
  "invalid_two_factor_token",
  "code_attempts_exceeded",
  "user_is_locked_out",
  "user_is_temporary_locked_out",
  "sign_in_not_allowed",
  "lockout_disabled",
  "mfa_provider_not_available",
];

const { t } = useI18n({ useScope: "global" });
const router = useRouter();
const { loadUser } = useUser();

const code = ref("");
const codeInput = ref<HTMLInputElement>();
const provider = ref<string>();
const destination = ref<string>();
const error = ref("");
const notice = ref("");
// a failure the code can't fix (an expired step, a locked account): only "Back to sign in" is left
const finalError = ref(false);
const sending = ref(false);
const verifying = ref(false);
const busy = computed(() => sending.value || verifying.value);
const codeComplete = computed(() => /^\d{6}$/.test(code.value));

const resendSecondsLeft = ref(0);
let resendDeadline = 0;
let resendTimer: ReturnType<typeof setInterval> | undefined;

async function post<T>(url: string, body: object): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw response;
  return (await response.json()) as T;
}

async function sendCode(isResend: boolean) {
  if (busy.value || (isResend && resendSecondsLeft.value > 0)) return;
  error.value = "";
  notice.value = "";
  sending.value = true;
  try {
    const result = await post<MfaSendCodeResult>("/api/mfa/signin/send", { provider: provider.value });
    startResendCountdown(result.resendSecondsRemaining);
    // a code sent a moment ago still works: the page only waits before offering another
    const tooSoon = !result.succeeded && result.error?.code === "resend_too_soon";
    if (!result.succeeded && !tooSoon) {
      showError(result.error);
      return;
    }
    provider.value = result.provider;
    destination.value = result.providers?.find((x) => x.name === result.provider)?.destination;
    if (isResend && result.succeeded) {
      code.value = "";
      notice.value = t("SHELL.MFA.CODE_RESENT");
    }
  } catch (response) {
    showTechnicalError(response);
  } finally {
    sending.value = false;
  }
  focusCode();
}

async function verify() {
  if (busy.value || !codeComplete.value) return;
  error.value = "";
  notice.value = "";
  verifying.value = true;
  try {
    const result = await post<MfaSignInResult>("/api/mfa/signin/verify", {
      code: code.value,
      provider: provider.value,
      // the password form has no "remember me": a session cookie, as there
      rememberMe: false,
    });
    if (result.succeeded) {
      // signed in with the platform's cookie, as the password form is; the shell takes the user from there
      await goAfterSignIn(router, await loadUser());
      return;
    }
    code.value = "";
    showError(result.error);
  } catch (response) {
    showTechnicalError(response);
  } finally {
    verifying.value = false;
  }
  focusCode();
}

function showError(mfaError: MfaError | undefined) {
  const errorCode = mfaError?.code;
  finalError.value = errorCode !== "invalid_code";
  error.value =
    errorCode && KNOWN_ERRORS.includes(errorCode)
      ? t(`SHELL.MFA.ERRORS.${errorCode.toUpperCase()}`)
      : t("LOGIN.ERRORS.INVALID_CREDENTIALS");
}

function showTechnicalError(response: unknown) {
  const status = (response as Response | undefined)?.status;
  // no MFA module to send the code: the platform asked for a second factor nobody can give, as the AngularJS admin says
  finalError.value = status === 404;
  error.value =
    status === 404
      ? t("SHELL.MFA.ERRORS.UNAVAILABLE")
      : status
        ? t("LOGIN.ERRORS.AUTH_WITH_CODE", { code: status })
        : t("LOGIN.ERRORS.AUTH_GENERIC", { detail: String(response) });
}

function focusCode() {
  nextTick(() => codeInput.value?.focus());
}

function startResendCountdown(seconds: number | undefined) {
  if (!seconds) return;
  resendDeadline = Date.now() + seconds * 1000;
  updateResendCountdown();
  resendTimer ??= setInterval(updateResendCountdown, 1000);
}

function updateResendCountdown() {
  resendSecondsLeft.value = Math.max(0, Math.ceil((resendDeadline - Date.now()) / 1000));
  if (!resendSecondsLeft.value && resendTimer) {
    clearInterval(resendTimer);
    resendTimer = undefined;
  }
}

onMounted(() => sendCode(false));
onBeforeUnmount(() => clearInterval(resendTimer));
</script>

<style lang="scss">
.as-auth__notice {
  background: var(--color-success-50);
  border: 1px solid var(--color-success-200);
  border-radius: 12px;
  color: var(--color-success-800);
  font-size: 14px;
  line-height: 1.45;
  margin-bottom: 20px;
  padding: 12px;
}

// no "we sent a code" once the code can't help: the error sits under the heading
.as-mfa__title--final {
  margin-bottom: 24px;
}

// the digits spaced out once typed; the placeholder stays as written
.as-mfa__code:not(:placeholder-shown) {
  font-size: 18px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.3em;
}

.as-mfa__submit {
  margin-top: 28px;
}

.as-mfa__links {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
  justify-content: space-between;
  margin-top: 24px;
}

.as-mfa__link {
  background: none;
  border: 0;
  font-family: inherit;
  padding: 0;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
}

.as-mfa__countdown {
  color: var(--color-neutral-500);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
</style>
