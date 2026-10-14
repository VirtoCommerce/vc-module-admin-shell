<template>
  <VcBlade
    :title="$t('PLATFORM.LICENSE.TITLE')"
    :loading="loading"
    width="100%"
  >
    <div class="platform-license">
      <!-- the license this platform runs on -->
      <section
        class="platform-license__status"
        :class="`platform-license__status--${state}`"
      >
        <span class="platform-license__badge">
          <VcIcon
            :icon="state === 'active' ? 'lucide-badge-check' : state === 'expired' ? 'lucide-badge-alert' : 'lucide-scale'"
            size="l"
          />
        </span>
        <div class="platform-license__summary">
          <div class="platform-license__headline">
            <h2>{{ license ? $t("PLATFORM.LICENSE.TYPE_LICENSE", { type: license.type }) : $t("PLATFORM.LICENSE.COMMUNITY") }}</h2>
            <span class="platform-license__chip">{{ chip }}</span>
          </div>
          <!-- DO NOT CHANGE THE NOTICE BELOW: COPYRIGHT VIOLATION (kept from the platform's license screen) -->
          <p
            v-if="!license"
            class="platform-license__line"
          >
            {{ $t("PLATFORM.LICENSE.RUNNING_ON") }}
            <a
              href="https://virtocommerce.com/open-source-license"
              target="_blank"
              rel="noopener"
              >{{ $t("PLATFORM.LICENSE.OPEN_SOURCE") }}</a
            >
          </p>
          <dl
            v-else
            class="platform-license__facts"
          >
            <template
              v-for="fact in facts(license)"
              :key="fact.label"
            >
              <dt>{{ fact.label }}</dt>
              <dd>{{ fact.value }}</dd>
            </template>
          </dl>
        </div>
      </section>

      <!-- a new license: review what the code or file gave before it replaces the current one -->
      <VcCard
        v-if="preview"
        :header="$t('PLATFORM.LICENSE.REVIEW')"
        :variant="previewExpired ? 'danger' : 'default'"
      >
        <div class="platform-card-body">
          <dl class="platform-license__facts">
            <template
              v-for="fact in facts(preview)"
              :key="fact.label"
            >
              <dt>{{ fact.label }}</dt>
              <dd>{{ fact.value }}</dd>
            </template>
          </dl>
          <VcBanner
            v-if="error"
            variant="danger"
            icon="lucide-circle-alert"
          >
            {{ error }}
          </VcBanner>
          <div class="platform-license__actions">
            <VcButton
              :disabled="previewExpired || busy"
              :loading="busy"
              @click="confirm"
            >
              {{ $t("PLATFORM.LICENSE.ACTIVATE_LICENSE") }}
            </VcButton>
            <VcButton
              variant="outline"
              :disabled="busy"
              @click="discard"
            >
              {{ $t("PLATFORM.LICENSE.CANCEL") }}
            </VcButton>
          </div>
        </div>
      </VcCard>

      <VcCard
        v-else
        :header="license ? $t('PLATFORM.LICENSE.REPLACE') : $t('PLATFORM.LICENSE.ACTIVATE')"
      >
        <div class="platform-card-body">
          <ol class="platform-license__steps">
            <li>
              {{ $t("PLATFORM.LICENSE.STEP_1") }}
              <a
                href="https://virtocommerce.com/request-license"
                target="_blank"
                rel="noopener"
                >{{ $t("PLATFORM.LICENSE.REQUEST_FORM") }}
                <VcIcon
                  icon="lucide-external-link"
                  size="xs"
              /></a>
            </li>
            <li>{{ $t("PLATFORM.LICENSE.STEP_2") }}</li>
            <li>{{ $t("PLATFORM.LICENSE.STEP_3") }}</li>
            <li>{{ $t("PLATFORM.LICENSE.STEP_4") }}</li>
          </ol>

          <form
            class="platform-license__code"
            @submit.prevent
          >
            <VcInput
              v-model="code"
              class="platform-license__code-input"
              :label="$t('PLATFORM.LICENSE.CODE')"
              :placeholder="$t('PLATFORM.LICENSE.CODE_PLACEHOLDER')"
              :hint="$t('PLATFORM.LICENSE.CODE_HINT')"
              autocomplete="off"
            />
            <!-- VcButton cancels the native click, so the form never submits: the click (Enter too) activates -->
            <VcButton
              type="submit"
              :disabled="!code.trim() || busy"
              :loading="busy && mode === 'code'"
              @click="byCode"
            >
              {{ $t("PLATFORM.LICENSE.ACTIVATE_BUTTON") }}
            </VcButton>
          </form>

          <div class="platform-license__or">
            <span>{{ $t("PLATFORM.LICENSE.OR") }}</span>
          </div>

          <div class="platform-license__file">
            <div>
              <div class="platform-license__file-title">{{ $t("PLATFORM.LICENSE.FILE") }}</div>
              <p class="platform-note">{{ $t("PLATFORM.LICENSE.FILE_HINT") }}</p>
            </div>
            <input
              ref="fileInput"
              type="file"
              accept=".lic"
              hidden
              @change="byFile"
            />
            <VcButton
              variant="outline"
              icon="lucide-file-up"
              :disabled="busy"
              :loading="busy && mode === 'file'"
              @click="fileInput?.click()"
            >
              {{ fileName || $t("PLATFORM.LICENSE.CHOOSE_FILE") }}
            </VcButton>
          </div>

          <VcBanner
            v-if="error"
            variant="danger"
            icon="lucide-circle-alert"
          >
            {{ error }}
          </VcBanner>
        </div>
      </VcCard>
    </div>
  </VcBlade>
</template>

<script setup lang="ts">
import { DiagnosticsClient, useApiClient, useAsync, type License } from "@vc-shell/framework";
import { VcBanner, VcBlade, VcButton, VcCard, VcIcon, VcInput } from "@vc-shell/framework/ui";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { api } from "../../api";

defineBlade({
  url: "/license",
  name: "PlatformLicense",
  isWorkspace: true,
  // the licensing API asks for it
  permissions: ["platform:module:manage"],
});

const { t } = useI18n({ useScope: "global" });
const { getApiClient } = useApiClient(DiagnosticsClient);

const license = ref<License | null>(null);
const preview = ref<License | null>(null);
const code = ref("");
const fileName = ref("");
const fileInput = ref<HTMLInputElement>();
const error = ref("");
const busy = ref(false);
const mode = ref<"code" | "file">();

const isExpired = (l?: License | null) => !!l?.expirationDate && new Date(l.expirationDate).getTime() < Date.now();
const formatDate = (value?: Date | string) =>
  // the license's calendar date (UTC), not the day it is in this browser's zone
  value ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }) : "";

const state = computed(() => (!license.value ? "community" : isExpired(license.value) ? "expired" : "active"));
const chip = computed(() =>
  state.value === "community"
    ? t("PLATFORM.LICENSE.CHIP_COMMUNITY")
    : state.value === "expired"
      ? t("PLATFORM.LICENSE.CHIP_EXPIRED")
      : t("PLATFORM.LICENSE.CHIP_ACTIVE", { date: formatDate(license.value?.expirationDate) }),
);
const previewExpired = computed(() => isExpired(preview.value));

const facts = (l: License) =>
  [
    { label: t("PLATFORM.LICENSE.ISSUED_TO"), value: l.customerName },
    { label: t("PLATFORM.LICENSE.TYPE"), value: l.type },
    { label: t("PLATFORM.LICENSE.EXPIRATION"), value: formatDate(l.expirationDate) },
    { label: t("PLATFORM.LICENSE.EMAIL"), value: l.customerEmail },
  ].filter((x) => x.value);

const { loading, action: load } = useAsync(async () => {
  license.value = (await (await getApiClient()).getSystemInfo()).license ?? null;
});

// both activation calls answer with the license they read (nothing when the code or file is not valid)
function received(next: License | null | undefined) {
  if (!next) throw new Error("no license");
  preview.value = next;
  error.value = isExpired(next) ? t("PLATFORM.LICENSE.ERROR_EXPIRED") : "";
}

async function byCode() {
  if (!code.value.trim() || busy.value) return;
  await run("code", t("PLATFORM.LICENSE.ERROR_CODE"), async () =>
    received(await api<License | null>("POST", "/api/platform/licensing/activateByCode", code.value.trim())),
  );
}

async function byFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  fileName.value = file.name;
  if (!file.name.toLowerCase().endsWith(".lic")) {
    error.value = t("PLATFORM.LICENSE.ERROR_FILE_TYPE");
    return;
  }
  await run("file", t("PLATFORM.LICENSE.ERROR_FILE"), async () => {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/api/platform/licensing/activateByFile", { method: "POST", body });
    const text = response.ok ? await response.text() : "";
    received(text ? (JSON.parse(text) as License) : null);
  });
}

// a refused request (a malformed code answers 400 with JSON) or no license back reads as the activation failing, not as raw HTTP
async function run(how: "code" | "file", failed: string, work: () => Promise<void>) {
  busy.value = true;
  mode.value = how;
  error.value = "";
  try {
    await work();
  } catch {
    error.value = failed;
  } finally {
    busy.value = false;
  }
}

async function confirm() {
  busy.value = true;
  try {
    await api("POST", "/api/platform/licensing/activateLicense", preview.value);
    // the license is read once per page load across the admin (the avatar menu too), as on the platform's own screen
    window.location.reload();
  } catch (e) {
    error.value = (e as Error).message;
    busy.value = false;
  }
}

function discard() {
  preview.value = null;
  error.value = "";
  code.value = "";
  fileName.value = "";
}

load();
</script>

<style lang="scss">
.platform-license {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 760px;
  padding: 20px 22px 36px;

  &__status {
    align-items: flex-start;
    background: var(--color-neutral-0);
    border: 1px solid var(--color-neutral-200);
    border-radius: 12px;
    display: flex;
    gap: 16px;
    padding: 18px 20px;
  }

  &__badge {
    align-items: center;
    background: var(--color-secondary-100);
    border-radius: 12px;
    color: var(--color-secondary-700);
    display: flex;
    flex: none;
    height: 44px;
    justify-content: center;
    width: 44px;

    .platform-license__status--active & {
      background: var(--color-success-50);
      color: var(--color-success-600);
    }

    .platform-license__status--expired & {
      background: var(--color-danger-50);
      color: var(--color-danger-600);
    }
  }

  &__summary {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }

  &__headline {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;

    h2 {
      color: var(--color-neutral-900);
      font-size: 18px;
      font-weight: 700;
      line-height: 24px;
      margin: 0;
    }
  }

  &__chip {
    background: var(--color-neutral-100);
    border-radius: 999px;
    color: var(--color-neutral-600);
    font-size: 12px;
    font-weight: 600;
    line-height: 18px;
    padding: 2px 10px;

    .platform-license__status--active & {
      background: var(--color-success-50);
      color: var(--color-success-700);
    }

    .platform-license__status--expired & {
      background: var(--color-danger-50);
      color: var(--color-danger-700);
    }
  }

  &__line {
    color: var(--color-neutral-600);
    font-size: 14px;
    margin: 0;

    a {
      color: var(--color-primary-600);
      font-weight: 600;
    }
  }

  &__facts {
    display: grid;
    gap: 6px 20px;
    grid-template-columns: max-content minmax(0, 1fr);
    margin: 0;

    dt {
      color: var(--color-neutral-500);
      font-size: 13px;
    }

    dd {
      color: var(--color-neutral-900);
      font-size: 14px;
      font-weight: 500;
      margin: 0;
      overflow-wrap: anywhere;
    }
  }

  &__steps {
    color: var(--color-neutral-700);
    display: flex;
    flex-direction: column;
    font-size: 14px;
    gap: 6px;
    line-height: 20px;
    /* the host's Tailwind base drops list markers */
    list-style: decimal;
    margin: 0;
    padding-left: 20px;

    li::marker {
      color: var(--color-neutral-400);
      font-weight: 600;
    }

    a {
      align-items: center;
      color: var(--color-primary-600);
      display: inline-flex;
      font-weight: 600;
      gap: 4px;
    }
  }

  &__code {
    align-items: flex-start;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;

    /* the button sits on the input's line (under its label) */
    > .vc-button {
      margin-top: 22px;
    }
  }

  &__code-input {
    flex: 1 1 320px;
  }

  &__or {
    align-items: center;
    color: var(--color-neutral-400);
    display: flex;
    font-size: 12px;
    font-weight: 600;
    gap: 12px;
    text-transform: uppercase;

    &::before,
    &::after {
      background: var(--color-neutral-200);
      content: "";
      flex: 1;
      height: 1px;
    }
  }

  &__file {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: space-between;
  }

  &__file-title {
    color: var(--color-neutral-700);
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 2px;
  }

  &__actions {
    display: flex;
    gap: 10px;
  }
}
</style>
