<template>
  <!-- Above the screens, on every screen (the AngularJS admin's "modules are loaded with errors" banner): a module that
       failed to start takes its screens and API with it, so the notice stays until hidden or the module is fixed -->
  <div
    v-if="shown"
    class="as-module-errors"
    role="alert"
  >
    <span class="as-module-errors__icon">
      <VcIcon
        icon="lucide-triangle-alert"
        size="s"
      />
    </span>
    <div class="as-module-errors__text">
      <div>
        <strong>{{ $t("SHELL.MODULE_ERRORS.TITLE", { count }, count) }}</strong>
        — {{ $t("SHELL.MODULE_ERRORS.MESSAGE", count) }}
      </div>
      <div
        class="as-module-errors__detail"
        :title="summary"
      >
        {{ summary }}
      </div>
    </div>
    <!-- the message and every module's full error, for a ticket or a chat with support -->
    <button
      type="button"
      class="as-module-errors__tool"
      :aria-label="copied ? $t('SHELL.MODULE_ERRORS.COPIED') : $t('SHELL.MODULE_ERRORS.COPY')"
      :title="copied ? $t('SHELL.MODULE_ERRORS.COPIED') : $t('SHELL.MODULE_ERRORS.COPY')"
      @click="copyDetails"
    >
      <VcIcon
        :icon="copied ? 'lucide-check' : 'lucide-copy'"
        size="s"
      />
    </button>
    <span
      class="tw-sr-only"
      aria-live="polite"
      >{{ copied ? $t("SHELL.MODULE_ERRORS.COPIED") : "" }}</span
    >
    <VcButton
      class="as-module-errors__show"
      variant="danger"
      size="sm"
      @click="showFailed"
    >
      {{ $t("SHELL.MODULE_ERRORS.SHOW") }}
    </VcButton>
    <button
      type="button"
      class="as-module-errors__tool"
      :aria-label="$t('SHELL.MODULE_ERRORS.HIDE')"
      :title="$t('SHELL.MODULE_ERRORS.HIDE')"
      @click="hideNotice"
    >
      <VcIcon
        icon="lucide-x"
        size="s"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import { usePermissions } from "@vc-shell/framework";
import { VcButton, VcIcon } from "@vc-shell/framework/ui";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { failedModules, failureKey, failureReport, failureSummary, hiddenFailures } from "./moduleErrors";

const { t } = useI18n({ useScope: "global" });
const router = useRouter();
const { hasAccess } = usePermissions();

const count = computed(() => failedModules.value.length);
const key = computed(() => failureKey(failedModules.value));
// hidden for this page only (moduleErrors.ts): a reload shows it again
const hidden = computed(() => !!key.value && hiddenFailures.value === key.value);

// the list is read for users who may see modules only; the check also keeps a previous user's list from showing
const shown = computed(() => count.value > 0 && hasAccess("platform:module:access") && !hidden.value);
const summary = computed(() => failureSummary(failedModules.value, (n) => t("SHELL.MODULE_ERRORS.MORE", { count: n })));

function showFailed() {
  router.push({ path: "/modules", query: { view: "failed" } });
}

const copied = ref(false);
let copiedTimer: ReturnType<typeof setTimeout> | undefined;

async function copyDetails() {
  const title = t("SHELL.MODULE_ERRORS.TITLE", { count: count.value }, count.value);
  const text = failureReport(failedModules.value, title);
  // the admin runs on https (or localhost), where the clipboard is there; a refused permission copies nothing, and the
  // button then doesn't claim it did
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    return;
  }
  copied.value = true;
  clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => (copied.value = false), 2000);
}

function hideNotice() {
  hiddenFailures.value = key.value;
}
</script>

<style lang="scss">
.as-module-errors {
  align-items: center;
  background: var(--danger-50);
  border: 1px solid var(--danger-100);
  border-radius: 12px;
  box-sizing: border-box;
  color: var(--danger-800, var(--danger-700));
  display: flex;
  flex: none;
  gap: 12px;
  margin: 8px 8px 0;
  padding: 10px 12px 10px 14px;

  &__icon {
    align-items: center;
    background: var(--danger-100);
    border-radius: 50%;
    color: var(--danger-600);
    display: grid;
    flex: none;
    height: 28px;
    place-items: center;
    width: 28px;
  }

  &__text {
    flex: 1;
    font-size: 14px;
    line-height: 1.4;
    min-width: 0;
  }

  &__detail {
    font-size: 12px;
    opacity: 0.85;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__show {
    flex: none;
  }

  &__tool {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: 8px;
    color: inherit;
    cursor: pointer;
    display: grid;
    flex: none;
    height: 32px;
    place-items: center;
    width: 32px;

    &:hover {
      background: var(--danger-100);
    }

    &:focus-visible {
      outline: 2px solid var(--danger-600);
      outline-offset: 2px;
    }
  }
}

/* desktop: over the environment ribbon in the top right corner (z-index 1100), the failure matters more; still under
   popups and dropdowns (2000 and up). Phones keep the ribbon in the top bar and their menu drawer (1000) over this */
.vc-app:not(.vc-app--mobile) .as-module-errors {
  position: relative;
  z-index: 1101;
}

/* phones: the text over the full width, the button under it */
.vc-app--mobile .as-module-errors {
  flex-wrap: wrap;
  gap: 8px 12px;

  .as-module-errors__text {
    flex-basis: calc(100% - 128px); /* the icon, Copy and Hide stay on the first line */
  }

  .as-module-errors__show {
    flex: 1;
    order: 1;
  }
}
</style>
