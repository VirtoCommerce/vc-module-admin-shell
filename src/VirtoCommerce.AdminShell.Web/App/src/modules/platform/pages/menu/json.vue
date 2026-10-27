<template>
  <VcBlade
    :title="$t('PLATFORM.MENU_EDITOR.JSON.TITLE')"
    :subtitle="$t('PLATFORM.MENU_EDITOR.JSON.SUBTITLE')"
    :toolbar-items="toolbar"
    :modified="form.isModified.value"
    width="50%"
  >
    <VcContainer>
      <VcForm class="platform-form menu-json">
        <p class="platform-note">{{ $t("PLATFORM.MENU_EDITOR.JSON.INTRO") }}</p>
        <VcTextarea
          v-model="text"
          class="platform-code platform-code--tall"
          maxlength="5000000"
          :label="$t('PLATFORM.MENU_EDITOR.JSON.LABEL')"
          :error-message="error"
        />
      </VcForm>
    </VcContainer>
    <input
      :ref="(el) => setFileInput(el)"
      type="file"
      accept=".json,application/json"
      hidden
      @change="upload"
    />
  </VcBlade>
</template>

<script setup lang="ts">
import { notification, useBlade, type IBladeToolbar } from "@vc-shell/framework";
import { VcBlade, VcContainer, VcForm, VcTextarea } from "@vc-shell/framework/ui";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { MenuPatch } from "../../../../api/adminMenu";
import { usePlatformBladeForm } from "../../composables/blade";
import { parsePatch, patchDocument } from "./patch";

/**
 * The menu editor's changes as a JSON document, to back up, restore or move between environments. Apply hands the
 * document to the editor as the patch being edited, so its Menu tab shows the result before Save stores it.
 */
defineBlade({
  url: "/menu-editor-json",
  name: "PlatformMenuEditorJson",
  permissions: ["admin-shell:menu:manage"],
});

const { t } = useI18n({ useScope: "global" });
const { callParent } = useBlade();

const text = ref("");
let fileInput: HTMLInputElement | undefined;
const setFileInput = (el: unknown) => {
  fileInput = el as HTMLInputElement;
};

const parsed = computed(() => parsePatch(text.value));
const error = computed(() => {
  const result = parsed.value;
  if (!("error" in result)) return undefined;
  const message = result.error === "shape" ? t("PLATFORM.MENU_EDITOR.JSON.SHAPE") : result.error;
  return t("PLATFORM.MENU_EDITOR.JSON.INVALID", { error: message });
});

// "modified" is the document against the editor's patch: Apply makes them the same again
const form = usePlatformBladeForm({ data: text, canSaveOverride: computed(() => !error.value) });

/** the document of the patch the editor holds now (its unsaved changes too) */
async function load() {
  text.value = patchDocument(await callParent<MenuPatch>("getPatch"));
  form.setBaseline();
}

async function apply() {
  const result = parsed.value;
  if (!("patch" in result)) return;
  await callParent("applyPatch", result.patch);
  await load();
  notification.success(t("PLATFORM.MENU_EDITOR.JSON.APPLIED"));
}

function format() {
  text.value = JSON.stringify(JSON.parse(text.value), null, 2);
}

function download() {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([`${text.value.trim()}\n`], { type: "application/json" }));
  link.download = `admin-shell-menu-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function upload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (file) text.value = await file.text();
}

async function copy() {
  await navigator.clipboard.writeText(text.value);
  notification.success(t("PLATFORM.MENU_EDITOR.JSON.COPIED"));
}

const toolbar = computed<IBladeToolbar[]>(() => [
  {
    id: "apply",
    title: t("PLATFORM.MENU_EDITOR.JSON.APPLY"),
    icon: "lucide-check",
    disabled: !form.isModified.value || !!error.value,
    clickHandler: () => apply(),
  },
  {
    id: "discard",
    title: t("PLATFORM.MENU_EDITOR.JSON.RESET"),
    icon: "lucide-undo-2",
    disabled: !form.isModified.value,
    clickHandler: () => load(),
  },
  // as on the settings screen's JSON blade
  {
    id: "format",
    title: t("PLATFORM.SETTINGS.GROUP.FORMAT_JSON"),
    icon: "lucide-braces",
    disabled: !!error.value || !text.value.trim(),
    clickHandler: () => format(),
  },
  {
    id: "download",
    title: t("PLATFORM.MENU_EDITOR.JSON.DOWNLOAD"),
    icon: "lucide-download",
    disabled: !!error.value,
    clickHandler: () => download(),
  },
  {
    id: "upload",
    title: t("PLATFORM.MENU_EDITOR.JSON.UPLOAD"),
    icon: "lucide-upload",
    clickHandler: () => fileInput?.click(),
  },
  {
    id: "copy",
    title: t("PLATFORM.MENU_EDITOR.JSON.COPY"),
    icon: "lucide-copy",
    clickHandler: () => copy(),
  },
]);

load();
</script>

<style lang="scss">
// JSON reads left to right in every language
.menu-json textarea {
  direction: ltr;
  text-align: left;
}
</style>
