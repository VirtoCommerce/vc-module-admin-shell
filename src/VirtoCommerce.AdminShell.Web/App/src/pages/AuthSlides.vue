<template>
  <!-- The panel beside the sign-in form with the company's own slides (white-labeling, AdminShell.SignIn.Slides) in
       place of Virto's: chip, headline, text and points over an image, or an image alone. It has the showcase's layout
       (AuthShowcase.vue's styles) and the theme's colors. From 1024px, as the showcase. -->
  <aside
    class="as-show as-slides"
    :aria-label="$t('SHELL.AUTH.SLIDES_LABEL', { name: companyName })"
    @mouseenter="stop"
    @mouseleave="start"
    @focusin="stop"
    @focusout="start"
  >
    <div class="as-show__slides">
      <section
        v-for="(slide, index) in slides"
        :key="index"
        class="as-show__slide"
        :class="{ 'as-show__slide--active': index === current, 'as-slides__slide--image': isImageOnly(slide) }"
        :aria-hidden="index !== current"
        :inert="index !== current || undefined"
      >
        <div
          v-if="!isImageOnly(slide)"
          class="as-show__copy as-slides__copy"
        >
          <span
            v-if="brandText(slide.chip)"
            class="as-show__chip"
          >
            <img
              v-if="mark"
              :src="mark"
              alt=""
            />
            {{ brandText(slide.chip) }}
          </span>
          <h2
            v-if="brandText(slide.title)"
            class="as-show__title"
          >
            {{ brandText(slide.title) }}
          </h2>
          <p
            v-if="brandText(slide.body)"
            class="as-show__body"
          >
            {{ brandText(slide.body) }}
          </p>
          <ul
            v-if="slide.points?.length"
            class="as-show__points"
          >
            <li
              v-for="(point, n) in slide.points"
              :key="n"
            >
              <VcIcon
                icon="lucide-check"
                size="s"
              />
              {{ brandText(point) }}
            </li>
          </ul>
        </div>
        <div
          v-if="imageOf(slide)"
          class="as-slides__media"
        >
          <img
            :src="imageOf(slide)"
            :alt="brandText(slide.alt)"
            loading="lazy"
          />
        </div>
      </section>
    </div>

    <div
      v-if="slides.length > 1 || currentLink"
      class="as-show__footer"
    >
      <div class="as-show__dots">
        <template v-if="slides.length > 1">
          <button
            v-for="(slide, index) in slides"
            :key="index"
            type="button"
            class="as-show__dot"
            :class="{ 'as-show__dot--active': index === current }"
            :aria-label="$t('SHELL.AUTH.SHOWCASE.GO_TO', { name: brandText(slide.chip) || brandText(slide.title) || index + 1 })"
            :aria-current="index === current"
            @click="current = index"
          />
        </template>
      </div>
      <a
        v-if="currentLink"
        class="as-show__more"
        :href="currentLink.url"
        target="_blank"
        rel="noopener"
      >
        {{ currentLink.text }}
        <VcIcon
          icon="lucide-arrow-up-right"
          size="xs"
        />
      </a>
    </div>
  </aside>
</template>

<script lang="ts" setup>
import { useTheme } from "@vc-shell/framework";
import { VcIcon } from "@vc-shell/framework/ui";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { brandMark, branding, brandText, companyName, safeUrl, type BrandSlide } from "../shell/branding";

const { currentThemeKey } = useTheme();

const slides = computed(() => branding.value.signIn.slides);
const mark = computed(() => brandMark());
const current = ref(0);

const imageOf = (slide: BrandSlide) =>
  safeUrl(currentThemeKey.value === "dark" ? slide.imageDark || slide.image : slide.image);
// an image without words fills the panel
const isImageOnly = (slide: BrandSlide) =>
  !!imageOf(slide) && !brandText(slide.title) && !brandText(slide.body) && !slide.points?.length && !brandText(slide.chip);

const currentLink = computed(() => {
  const link = slides.value[current.value]?.link;
  const url = safeUrl(link?.url);
  return url ? { url, text: brandText(link?.text) || url } : undefined;
});

/* ---- a new slide every 7 s, paused while pointed at or focused, still for reduced motion (as the showcase) ---- */
const SLIDE_MS = 7000;
let timer: ReturnType<typeof setInterval> | undefined;

function stop() {
  clearInterval(timer);
  timer = undefined;
}

function start() {
  stop();
  if (slides.value.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  timer = setInterval(() => (current.value = (current.value + 1) % slides.value.length), SLIDE_MS);
}

onMounted(start);
onBeforeUnmount(stop);
</script>

<style lang="scss">
// the showcase's panel in the theme's colors: a deep shade of the primary, its glow, the primary as the accent
.as-slides {
  --as-show-bg: color-mix(in srgb, var(--color-primary-500) 22%, #0b0e14);
  --as-show-glow-1: color-mix(in srgb, var(--color-primary-500) 34%, transparent);
  --as-show-glow-2: color-mix(in srgb, var(--color-primary-300) 14%, transparent);
  --as-show-accent: color-mix(in srgb, var(--color-primary-500) 55%, #ffffff);
  --as-show-chip: color-mix(in srgb, var(--color-primary-500) 30%, #ffffff);
}

:root[data-theme="dark"] .as-slides {
  --as-show-bg: color-mix(in srgb, var(--color-primary-500) 10%, #07090d);
  --as-show-accent: var(--color-primary-500);
}

.as-slides__copy {
  min-height: 0;
}

// an image under the words, or alone filling the panel
.as-slides__media {
  display: flex;
  flex: 1;
  min-height: 0;
  padding: 32px 48px 0;

  img {
    border-radius: 16px 16px 0 0;
    box-shadow: 0 30px 80px -20px rgb(0 0 0 / 60%);
    display: block;
    height: 100%;
    max-width: 100%;
    object-fit: cover;
    object-position: top left;
    width: 100%;
  }
}

.as-slides__slide--image .as-slides__media {
  padding: 0;

  img {
    border-radius: 0;
    box-shadow: none;
    object-position: center;
  }
}

// the image alone runs under the slides' top padding too
.as-slides .as-show__slides:has(.as-slides__slide--image.as-show__slide--active) {
  padding-top: 0;
}

@media (min-width: 1280px) {
  .as-slides__media {
    padding: 40px 64px 0;
  }
}
</style>
