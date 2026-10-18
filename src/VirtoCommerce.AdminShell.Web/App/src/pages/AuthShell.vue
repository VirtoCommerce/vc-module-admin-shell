<template>
  <!-- The page around every sign-in screen: logo, language and theme switch on top, the form in a 400px column, a small footer.
       vc-shell's own auth pages (forgot/reset password, invite, change password) render inside it too: the styles below
       flatten their card so they read like the sign-in form. -->
  <div class="as-auth">
    <div class="as-auth__pane">
      <header class="as-auth__header">
        <img
          class="as-auth__logo"
          :class="{ 'as-auth__logo--brand': !!brandLogo(isDark) }"
          :src="logo"
          :alt="companyName"
        />
        <div class="as-auth__tools">
          <!-- the language for these pages; once signed in, the profile's language applies if the user has one -->
          <MenuSelect
            v-if="languages.length > 1"
            class="as-auth__language"
            :model-value="currentLocale"
            :options="languages"
            :label="$t('SHELL.USER_MENU.LANGUAGE')"
            icon="lucide-globe"
            @update:model-value="setLocale"
          />
          <button
            type="button"
            class="as-auth__theme"
            :title="themeLabel"
            :aria-label="themeLabel"
            @click="toggleTheme"
          >
            <VcIcon
              :icon="isDark ? 'lucide-sun' : 'lucide-moon'"
              size="m"
            />
          </button>
        </div>
      </header>

      <main class="as-auth__main">
        <div class="as-auth__column">
          <slot />
        </div>
      </main>

      <footer class="as-auth__footer">
        <span>© {{ year }} {{ companyName }}</span>
        <nav
          v-if="links.length"
          class="as-auth__links"
        >
          <a
            v-for="link in links"
            :key="link.key"
            :href="link.url"
            target="_blank"
            rel="noopener"
          >
            {{ link.text }}
          </a>
        </nav>
      </footer>
    </div>

    <!-- Virto's slides, the company's own (white-labeling), or only the form -->
    <AuthSlides v-if="branding.signIn.showcase === 'custom' && branding.signIn.slides.length" />
    <AuthShowcase v-else-if="branding.signIn.showcase !== 'none'" />
  </div>
</template>

<script lang="ts" setup>
import { useLanguages, useTheme } from "@vc-shell/framework";
import { VcIcon } from "@vc-shell/framework/ui";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { brandLogo, branding, companyName, safeUrl } from "../shell/branding";
import { useLanguageOptions } from "../shell/languages";
import MenuSelect from "../shell/MenuSelect.vue";
import { themeMode, useThemeMode } from "../shell/themeMode";
import AuthShowcase from "./AuthShowcase.vue";
import AuthSlides from "./AuthSlides.vue";
import logoLight from "/assets/logo-shell.svg";
import logoDark from "/assets/logo-shell-dark.svg";

// these pages sit outside App.vue, which starts the theme mode for the signed-in shell
useThemeMode();

const { t } = useI18n({ useScope: "global" });
const { currentThemeKey } = useTheme();
const { currentLocale, setLocale } = useLanguages();
const languages = useLanguageOptions();

const isDark = computed(() => currentThemeKey.value === "dark");
// the company's logo (AdminShell.Branding.LogoUrl / LogoDarkUrl), else Virto's wordmark for the theme; the platform's UI
// customization logo (by default its small grey mark) is one image for both themes, so it isn't used here
const logo = computed(() => brandLogo(isDark.value) ?? (isDark.value ? logoDark : logoLight));

// Help, Support, Privacy, Terms: the ones the installation gives (AdminShell.Branding.*Url)
const links = computed(() =>
  (["help", "support", "privacy", "terms"] as const)
    .map((key) => ({ key, url: safeUrl(branding.value.links[key]), text: t(`SHELL.AUTH.LINKS.${key.toUpperCase()}`) }))
    .filter((x) => x.url),
);
const themeLabel = computed(() => t(isDark.value ? "SHELL.AUTH.LIGHT_THEME" : "SHELL.AUTH.DARK_THEME"));
const year = new Date().getFullYear();

function toggleTheme() {
  themeMode.value = isDark.value ? "light" : "dark";
}
</script>

<style lang="scss">
// Sizes follow Buyer24's AuthShell: 44px controls, 12px radius, a 400px column, 28px heading.
.as-auth {
  --as-auth-on-primary: #ffffff;

  background: var(--color-neutral-0);
  color: var(--color-neutral-900);
  display: flex;
  font-family: inherit;
  min-height: 100dvh;
}

.as-auth__pane {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

// with the showcase beside it the page is exactly one screen; a form taller than that scrolls in its own pane
@media (min-width: 1024px) {
  .as-auth {
    height: 100dvh;
    overflow: hidden;
  }

  .as-auth__pane {
    overflow-y: auto;
  }
}

:root[data-theme="dark"] .as-auth {
  // the dark primary is amber: dark text on it
  --as-auth-on-primary: var(--color-neutral-0);
}

.as-auth__header {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  padding: 28px 48px 0;
}

// the wordmark is two lines, so it needs more height than a one-line logo to read at the same size
.as-auth__logo {
  display: block;
  height: 40px;
  width: auto;
}

// a company's logo: its own proportions, within the header
.as-auth__logo--brand {
  max-height: 48px;
  max-width: min(240px, 60vw);
  object-fit: contain;
}

.as-auth__links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}

.as-auth__tools {
  align-items: center;
  display: flex;
  gap: 4px;
  margin-right: -8px;
}

// the language: a quiet field like the theme switch beside it, the select's border only on hover and focus
.as-auth__language .as-um__select {
  background: transparent;
  border-color: transparent;
  border-radius: 10px;
  color: var(--color-neutral-600);
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  height: 36px;
  padding: 0 28px 0 10px;
  width: auto;

  .vc-icon {
    color: var(--color-neutral-500);
  }

  &:hover {
    background: var(--color-neutral-100);
    border-color: transparent;
    color: var(--color-neutral-800);
  }

  // the ring for the keyboard only, like the theme switch (the field takes the focus back after a pick)
  &:focus-within:not(:focus-visible) {
    border-color: transparent;
    box-shadow: none;
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary-500);
    outline-offset: 2px;
  }
}

.as-auth__theme {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: 10px;
  color: var(--color-neutral-500);
  cursor: pointer;
  display: flex;
  height: 36px;
  justify-content: center;
  width: 36px;

  &:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary-500);
    outline-offset: 2px;
  }
}

.as-auth__main {
  align-items: center;
  display: flex;
  flex: 1;
  justify-content: center;
  padding: 32px;
}

.as-auth__column {
  max-width: 400px;
  width: 100%;
}

.as-auth__footer {
  align-items: center;
  color: var(--color-neutral-400);
  display: flex;
  flex-wrap: wrap;
  font-size: 12px;
  gap: 8px 16px;
  justify-content: space-between;
  padding: 0 48px 24px;

  a {
    color: inherit;
    text-decoration: none;

    &:hover {
      color: var(--color-neutral-600);
    }
  }
}

@media (max-width: 640px) {
  .as-auth__header {
    padding: 20px 20px 0;
  }

  .as-auth__logo {
    height: 32px;
  }

  .as-auth__main {
    align-items: flex-start;
    padding: 32px 20px;
  }

  .as-auth__footer {
    padding: 0 20px 24px;
  }
}

/* ---- heading, alerts, fields and buttons shared by the sign-in form ---- */
.as-auth__title {
  color: var(--color-neutral-900);
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.25;
  margin: 0;
}

.as-auth__subtitle {
  color: var(--color-neutral-500);
  font-size: 15px;
  line-height: 1.5;
  margin: 8px 0 32px;
}

.as-auth__error {
  background: var(--color-danger-50);
  border: 1px solid var(--color-danger-200);
  border-radius: 12px;
  color: var(--color-danger-800);
  font-size: 14px;
  line-height: 1.45;
  margin-bottom: 20px;
  padding: 12px;
}

.as-auth__providers {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.as-auth__provider,
.as-auth__submit {
  align-items: center;
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  font-family: inherit;
  font-size: 14px;
  height: 44px;
  justify-content: center;
  transition:
    background-color 0.15s,
    border-color 0.15s;
  width: 100%;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
}

.as-auth__provider {
  background: var(--color-neutral-0);
  border: 1px solid var(--color-neutral-300);
  box-shadow: 0 1px 2px rgb(0 0 0 / 5%);
  color: var(--color-neutral-800);
  font-weight: 500;
  gap: 10px;

  &:hover:not(:disabled) {
    background: var(--color-neutral-50);
  }

  &:focus-visible {
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-primary-500) 15%, transparent);
    outline: none;
  }

  svg,
  img {
    flex-shrink: 0;
    height: 20px;
    width: 20px;
  }

  img {
    object-fit: contain;
  }
}

.as-auth__divider {
  align-items: center;
  color: var(--color-neutral-400);
  display: flex;
  font-size: 12px;
  gap: 12px;
  margin: 24px 0;

  &::before,
  &::after {
    background: var(--color-neutral-200);
    content: "";
    flex: 1;
    height: 1px;
  }
}

// the sign-in form's grid: the cells give the look, the markup order gives the tab order (see Login.vue)
.as-auth__form {
  align-items: baseline;
  display: grid;
  grid-template-areas:
    "login login"
    "password-label forgot"
    "password password"
    "submit submit";
  grid-template-columns: 1fr auto;
}

.as-auth__login {
  grid-area: login;
  margin-bottom: 20px;
}

.as-auth__password-label {
  grid-area: password-label;
}

.as-auth__forgot {
  grid-area: forgot;
  justify-self: end;
}

.as-auth__password {
  grid-area: password;
}

.as-auth__form .as-auth__submit {
  grid-area: submit;
  margin-top: 28px;
}

// over the right end of the password field: the same cell, on top
.as-auth__form .as-auth__eye {
  align-self: center;
  grid-area: password;
  justify-self: end;
  margin-right: 6px;
}

.as-auth__label {
  color: var(--color-neutral-700);
  display: block;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  margin-bottom: 6px;
}

.as-auth__link {
  color: var(--color-primary-600);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;

  &:hover {
    color: var(--color-primary-700);
  }
}

.as-auth__input {
  background: var(--color-neutral-0);
  border: 1px solid var(--color-neutral-300);
  border-radius: 12px;
  box-shadow: 0 1px 2px rgb(0 0 0 / 5%);
  box-sizing: border-box;
  color: var(--color-neutral-900);
  font-family: inherit;
  font-size: 14px;
  height: 44px;
  padding: 0 14px;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
  width: 100%;

  &::placeholder {
    color: var(--color-neutral-400);
  }

  &:focus {
    border-color: var(--color-primary-500);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-primary-500) 15%, transparent);
    outline: none;
  }

  &--password {
    padding-right: 44px;
  }
}

.as-auth__eye {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: 8px;
  color: var(--color-neutral-400);
  cursor: pointer;
  display: flex;
  height: 32px;
  justify-content: center;
  width: 32px;

  &:hover {
    color: var(--color-neutral-700);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary-500);
    outline-offset: 1px;
  }
}

.as-auth__submit {
  background: var(--color-primary-600);
  border: 0;
  box-shadow: 0 1px 2px rgb(0 0 0 / 5%);
  color: var(--as-auth-on-primary);
  font-weight: 600;
  gap: 8px;

  &:hover:not(:disabled) {
    background: var(--color-primary-700);
  }

  &:focus-visible {
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-primary-500) 25%, transparent);
    outline: none;
  }
}

.as-auth__spin {
  animation: as-auth-spin 0.8s linear infinite;
}

@keyframes as-auth-spin {
  to {
    transform: rotate(360deg);
  }
}

/* ---- vc-shell's auth pages inside the shell: no background, logo or card, the heading like the sign-in form ---- */
.as-auth .vc-auth-layout {
  background: none !important;
  display: block;
  min-height: 0;
  padding: 0;
}

.as-auth .vc-auth-layout__logo-wrapper,
.as-auth .vc-auth-layout__version {
  display: none;
}

.as-auth .vc-auth-layout__card {
  background: transparent;
  border: 0;
  box-shadow: none;
  max-width: none;
  padding: 0;
  width: 100%;
}

.as-auth .vc-auth-layout__header {
  margin-bottom: 32px;
  text-align: left;
}

.as-auth .vc-auth-layout__title {
  color: var(--color-neutral-900);
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.25;
}

.as-auth .vc-auth-layout__subtitle {
  color: var(--color-neutral-500);
  font-size: 15px;
  margin-top: 8px;
}

.as-auth .vc-auth-layout .vc-input__field-wrapper {
  border-radius: 12px;
  min-height: 44px;
}

.as-auth .vc-auth-layout .vc-button {
  border-radius: 12px;
  min-height: 44px;
}
</style>
