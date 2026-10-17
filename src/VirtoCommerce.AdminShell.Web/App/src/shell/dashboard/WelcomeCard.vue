<!-- Home's welcome card (white-labeling, AdminShell.Home.Welcome): the company's message above the widgets — a title,
     a text, an image and links. Each user can dismiss it; it comes back when the message changes. -->
<template>
  <section
    v-if="welcome && !dismissed"
    class="as-welcome"
    :class="{ 'as-welcome--image': !!image }"
    :aria-label="title || $t('SHELL.DASHBOARD.WELCOME.TITLE')"
  >
    <img
      v-if="image"
      class="as-welcome__image"
      :src="image"
      alt=""
    />
    <div class="as-welcome__copy">
      <h2
        v-if="title"
        class="as-welcome__title"
      >
        {{ title }}
      </h2>
      <p
        v-if="body"
        class="as-welcome__body"
      >
        {{ body }}
      </p>
      <div
        v-if="links.length"
        class="as-welcome__links"
      >
        <a
          v-for="(link, i) in links"
          :key="link.url"
          class="as-welcome__link"
          :class="{ 'as-welcome__link--primary': i === 0 }"
          :href="link.url"
          :target="link.external ? '_blank' : undefined"
          :rel="link.external ? 'noopener' : undefined"
        >
          {{ link.text }}
          <VcIcon
            v-if="link.external"
            icon="lucide-arrow-up-right"
            size="xs"
          />
        </a>
      </div>
    </div>
    <button
      type="button"
      class="as-welcome__dismiss"
      :title="$t('SHELL.DASHBOARD.DISMISS')"
      :aria-label="$t('SHELL.DASHBOARD.DISMISS')"
      @click="dismiss"
    >
      <VcIcon
        icon="lucide-x"
        size="s"
      />
    </button>
  </section>
</template>

<script lang="ts" setup>
import { useTheme } from "@vc-shell/framework";
import { VcIcon } from "@vc-shell/framework/ui";
import { useStorage } from "@vueuse/core";
import { computed } from "vue";
import { branding, brandText, safeUrl } from "../branding";

const { currentThemeKey } = useTheme();

const welcome = computed(() => branding.value.home.welcome);
const title = computed(() => brandText(welcome.value?.title));
const body = computed(() => brandText(welcome.value?.body));
const image = computed(() =>
  safeUrl(currentThemeKey.value === "dark" ? welcome.value?.imageDark || welcome.value?.image : welcome.value?.image),
);
const links = computed(() =>
  (welcome.value?.links ?? [])
    .map((link) => ({ url: safeUrl(link?.url), text: brandText(link?.text) }))
    .filter((link): link is { url: string; text: string } => !!link.url)
    .map((link) => ({ ...link, text: link.text || link.url, external: !link.url.startsWith("/") })),
);

// dismissed in this browser until the message changes: the dismissal remembers what it hid
const signature = computed(() => JSON.stringify(welcome.value ?? null));
const dismissedSignature = useStorage("adminShell.welcomeDismissed", "", undefined, { writeDefaults: false });
const dismissed = computed(() => dismissedSignature.value === signature.value);
const dismiss = () => (dismissedSignature.value = signature.value);
</script>

<style lang="scss">
.as-welcome {
  align-items: center;
  background: var(--color-neutral-0);
  border: 1px solid var(--color-neutral-200);
  border-radius: 6px;
  box-shadow: var(--dashboard-widget-card-shadow);
  display: flex;
  gap: 20px;
  margin: 24px 24px 0;
  overflow: hidden;
  padding: 20px 52px 20px 24px;
  position: relative;
}

// a thin bar of the theme's primary: the company's message, not a widget
.as-welcome::before {
  background: var(--color-primary-500);
  bottom: 0;
  content: "";
  left: 0;
  position: absolute;
  top: 0;
  width: 4px;
}

.as-welcome__image {
  border-radius: 6px;
  flex: none;
  height: 96px;
  object-fit: cover;
  width: 160px;
}

.as-welcome__copy {
  min-width: 0;
}

.as-welcome__title {
  color: var(--color-neutral-900);
  font-size: 18px;
  font-weight: 700;
  line-height: 24px;
  margin: 0;
}

.as-welcome__body {
  color: var(--color-neutral-600);
  font-size: 14px;
  line-height: 1.5;
  margin: 6px 0 0;
  max-width: 80ch;
  white-space: pre-line;
}

.as-welcome__links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.as-welcome__link {
  align-items: center;
  border: 1px solid var(--color-neutral-300);
  border-radius: 6px;
  color: var(--color-neutral-800);
  display: inline-flex;
  font-size: 13px;
  font-weight: 500;
  gap: 4px;
  height: 32px;
  padding: 0 12px;
  text-decoration: none;

  &:hover {
    border-color: var(--color-primary-500);
    color: var(--color-primary-500);
  }

  &--primary,
  &--primary:hover {
    background: var(--color-primary-500);
    border-color: var(--color-primary-500);
    color: var(--fg-on-primary, #ffffff);
  }

  &--primary:hover {
    background: var(--color-primary-600);
  }
}

.as-welcome__dismiss {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: 6px;
  color: var(--color-neutral-500);
  cursor: pointer;
  display: flex;
  height: 28px;
  justify-content: center;
  position: absolute;
  right: 12px;
  top: 12px;
  width: 28px;

  &:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-900);
  }
}

// a phone: the image above the words
@media (max-width: 640px) {
  .as-welcome {
    align-items: stretch;
    flex-direction: column;
    gap: 14px;
    // in line with the widgets (the grid's 14px margin and 10px item gap)
    margin: 16px 24px 0;
    padding: 16px 44px 16px 18px;
  }

  .as-welcome__image {
    height: 120px;
    width: 100%;
  }
}
</style>
