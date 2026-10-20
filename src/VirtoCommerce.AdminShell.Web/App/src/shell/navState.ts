import { useStorage } from "@vueuse/core";
import { ref } from "vue";
import { railLabelOf } from "./menuTitles";

// Shared by the rail, the header and the phone drawer: which section's panel shows and whether the panel is open.
// The open state is a per-browser convenience; a default is not stored, so changing it later reaches everyone who never chose.
export const panelOpen = useStorage("adminShell.panelOpen", true, undefined, { writeDefaults: false });

/** The section whose items the panel lists; follows the open screen until the user picks another rail button */
export const panelSection = ref<string>();

/** Folded group headings ("sectionId:title", Pinned is ":pinned"), a per-browser convenience like the panel state */
export const foldedGroups = useStorage<Record<string, boolean>>("adminShell.foldedGroups", {}, undefined, {
  writeDefaults: false,
});

export const toggleFolded = (key: string) => (foldedGroups.value = { ...foldedGroups.value, [key]: !foldedGroups.value[key] });

/** Phones: the menu drawer */
export const drawerOpen = ref(false);

/** Phones: the full-screen search sheet */
export const searchSheetOpen = ref(false);

/** A section's rail label: the menu's short one where the title's first word doesn't do (MENU.RAIL.configuration is
 * "Settings"), else the first word of its title in the user's language; the panel shows the full title */
export const railLabel = (section: { id: string; title: string }) => railLabelOf(section);

/**
 * A section's headed groups, in the section's order, each with its items in the menu's order (the server sets an
 * item's group, see default-menu.json "groups"); items without one go to an untitled group at the end, so a new
 * module's screen still shows. A section without groups is one untitled list.
 */
export function groupItems<T extends { group?: string }>(section?: { items: T[]; groups: { title: string }[] }) {
  if (!section) return [];
  const titles = section.groups.map((group) => group.title);
  const groups = titles
    .map((title) => ({ title, items: section.items.filter((item) => item.group === title) }))
    .filter((group) => group.items.length);
  const rest = section.items.filter((item) => !item.group || !titles.includes(item.group));
  return rest.length ? [...groups, { title: "", items: rest }] : groups;
}
