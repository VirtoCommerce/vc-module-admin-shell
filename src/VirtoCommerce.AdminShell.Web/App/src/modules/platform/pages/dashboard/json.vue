<template>
  <VcBlade
    :title="$t('PLATFORM.DASHBOARD.JSON_TITLE')"
    :subtitle="$t('PLATFORM.DASHBOARD.TITLE')"
    :toolbar-items="toolbar"
    :modified="form.isModified.value"
    width="50%"
  >
    <VcContainer>
      <VcForm class="platform-form dashboard-json">
        <p class="platform-note">{{ $t("PLATFORM.DASHBOARD.JSON_HINT") }}</p>
        <VcTextarea
          v-model="text"
          class="platform-code platform-code--tall"
          maxlength="5000000"
          :label="$t('PLATFORM.DASHBOARD.JSON_LABEL')"
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
import { usePlatformBladeForm } from "../../composables/blade";
import { documentText, parseDocument, type DashboardDocument } from "./document";

/**
 * The Dashboard Editor's settings as a JSON document, as the Menu Editor's: Apply hands it to the editor, which shows
 * the result before Save stores it.
 */
defineBlade({
  url: "/dashboard-configurator-json",
  name: "PlatformDashboardEditorJson",
  permissions: ["admin-shell:dashboard:manage"],
});

const { t } = useI18n({ useScope: "global" });
const { callParent } = useBlade();

const text = ref("");
let fileInput: HTMLInputElement | undefined;
const setFileInput = (el: unknown) => {
  fileInput = el as HTMLInputElement;
};

const parsed = computed(() => parseDocument(text.value));
const applyError = ref("");
const error = computed(() => {
  const result = parsed.value;
  if ("error" in result) {
    const message = result.error === "shape" ? t("PLATFORM.DASHBOARD.JSON_SHAPE") : result.error;
    return t("PLATFORM.MENU_EDITOR.JSON.INVALID", { error: message });
  }
  return applyError.value || undefined;
});

const form = usePlatformBladeForm({ data: text, canSaveOverride: computed(() => !error.value) });

/** the document of the editor's settings now (its unsaved changes too) */
async function load() {
  text.value = documentText(await callParent<DashboardDocument>("getDocument"));
  applyError.value = "";
  form.setBaseline();
}

async function apply() {
  const result = parsed.value;
  if (!("doc" in result)) return;
  try {
    await callParent("applyDocument", result.doc);
  } catch (e) {
    applyError.value = String((e as Error).message ?? e);
    return;
  }
  await load();
  notification.success(t("PLATFORM.MENU_EDITOR.JSON.APPLIED"));
}

function format() {
  text.value = JSON.stringify(JSON.parse(text.value), null, 2);
}

function download() {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([`${text.value.trim()}\n`], { type: "application/json" }));
  link.download = `admin-shell-dashboard-${new Date().toISOString().slice(0, 10)}.json`;
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
    disabled: !form.isModified.value || "error" in parsed.value,
    clickHandler: () => apply(),
  },
  {
    id: "discard",
    title: t("PLATFORM.MENU_EDITOR.JSON.RESET"),
    icon: "lucide-undo-2",
    disabled: !form.isModified.value,
    clickHandler: () => load(),
  },
  {
    id: "format",
    title: t("PLATFORM.SETTINGS.GROUP.FORMAT_JSON"),
    icon: "lucide-braces",
    disabled: "error" in parsed.value || !text.value.trim(),
    clickHandler: () => format(),
  },
  {
    id: "download",
    title: t("PLATFORM.MENU_EDITOR.JSON.DOWNLOAD"),
    icon: "lucide-download",
    disabled: "error" in parsed.value,
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
.dashboard-json textarea {
  direction: ltr;
  text-align: left;
}
</style>
