<template>
  <!-- the title in the user's language and, when that isn't English, in English: every other language falls back to it -->
  <form
    class="menu-editor__form menu-editor__rename"
    @submit.prevent="emit('apply', value, englishValue)"
  >
    <label class="menu-editor__field">
      <span>{{ $t("PLATFORM.MENU_EDITOR.RENAME.IN_LANGUAGE", { language }) }}</span>
      <input
        :id="`${uid}-value`"
        ref="first"
        v-model="value"
        :placeholder="$t('PLATFORM.MENU_EDITOR.RENAME.HINT')"
      />
    </label>
    <label
      v-if="english"
      class="menu-editor__field"
    >
      <span>{{ $t("PLATFORM.MENU_EDITOR.RENAME.IN_ENGLISH") }}</span>
      <input
        :id="`${uid}-english`"
        v-model="englishValue"
        dir="ltr"
        :placeholder="$t('PLATFORM.MENU_EDITOR.RENAME.HINT')"
      />
    </label>
    <button
      type="submit"
      class="menu-editor__button menu-editor__button--primary"
    >
      {{ $t("PLATFORM.MENU_EDITOR.RENAME.APPLY") }}
    </button>
    <button
      type="button"
      class="menu-editor__button"
      @click="emit('cancel')"
    >
      {{ $t("PLATFORM.MENU_EDITOR.RENAME.CANCEL") }}
    </button>
  </form>
</template>

<script setup lang="ts">
import { onMounted, ref, useId } from "vue";

const props = defineProps<{ language: string; english: boolean; value: string; englishValue: string }>();
const emit = defineEmits<{ (e: "apply", value: string, english: string): void; (e: "cancel"): void }>();

const uid = `menu-rename-${useId()}`;
const value = ref(props.value);
const englishValue = ref(props.englishValue);
const first = ref<HTMLInputElement>();
onMounted(() => first.value?.focus());
</script>
