import { watch, type Ref } from "vue";

/** Languages written right to left: the page turns around for them (dir="rtl" on <html>) */
export const RTL_LANGUAGES = ["ar", "he", "fa", "ur"];

export const isRtl = (locale: string) => RTL_LANGUAGES.includes(locale.split("-")[0].toLowerCase());

/** Keeps <html dir> with the UI language (vc-shell keeps <html lang>): an RTL language lays the page out right to left */
export function syncDocumentDirection(locale: Ref<string>) {
  watch(locale, (current) => (document.documentElement.dir = isRtl(current || "en") ? "rtl" : "ltr"), { immediate: true });
}
