import { useStorage } from "@vueuse/core";
import { ref } from "vue";

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

/** Short rail labels where the section title's first word doesn't do; the panel shows the full title */
const RAIL_LABELS: Record<string, string> = {
  configuration: "Settings",
};

export const railLabel = (section: { id: string; title: string }) =>
  RAIL_LABELS[section.id] ?? section.title.split(/[\s&]+/)[0];

/**
 * Headed groups for a section with many items (by menu item id, in this order: a module's Vue screen, then the legacy
 * item it replaces); an item not listed goes to an untitled group at the end, so a new module's screen still shows.
 * ponytail: kept here until the menu model carries a group per item (default-menu.json / plugin.json)
 */
const SECTION_GROUPS: Record<string, { title: string; ids: string[] }[]> = {
  configuration: [
    { title: "Store", ids: ["stores", "legacy.stores", "nativePaymentMethods"] },
    {
      title: "Platform",
      ids: [
        "platform.settings",
        "legacy.settings",
        "platform.modules",
        "legacy.modules",
        "platform.dynamicProperties",
        "legacy.dynamicProperties",
        "state-machines",
        "webhooks",
        "platform.license",
      ],
    },
    { title: "Search & catalog", ids: ["search-index", "legacy.searchIndex", "channels", "legacy.channels"] },
    { title: "Security", ids: ["platform.security", "legacy.security", "audit-log"] },
    {
      title: "Data",
      ids: ["backup-restore", "legacy.exportImport", "generic-export", "legacy.genericExport", "environments-compare", "sql-queries"],
    },
    { title: "Monitoring & tools", ids: ["platform.developerTools", "legacy.developerTools", "appinsights"] },
  ],
};

export function groupItems<T extends { id: string }>(section?: { id: string; items: T[] }) {
  if (!section) return [];
  const plan = SECTION_GROUPS[section.id];
  if (!plan) return [{ title: "", items: section.items }];
  const byId = new Map(section.items.map((item) => [item.id, item]));
  const groups = plan
    .map((group) => ({ title: group.title, items: group.ids.map((id) => byId.get(id)).filter((x): x is T => !!x) }))
    .filter((group) => group.items.length);
  const listed = new Set(plan.flatMap((group) => group.ids));
  const rest = section.items.filter((item) => !listed.has(item.id));
  return rest.length ? [...groups, { title: "", items: rest }] : groups;
}
