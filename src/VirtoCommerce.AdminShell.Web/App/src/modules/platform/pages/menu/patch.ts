// The menu patch the editor works on (the global patch, AdminShell.Menu.Global): what the editor and its JSON blade share.
import type { MenuPatch } from "../../../../api/adminMenu";

export const emptyPatch = (): MenuPatch => ({ sections: {}, items: {}, addSections: [], addItems: [] });

/** the patch without empty entries, so an undone change leaves no trace and "unsaved" compares what matters */
export function clean(patch: MenuPatch): MenuPatch {
  const prune = <T extends object>(entries: Record<string, T>) =>
    Object.fromEntries(
      Object.entries(entries ?? {})
        .map(([id, value]) => [
          id,
          Object.fromEntries(Object.entries(value ?? {}).filter(([, v]) => v !== undefined && v !== null)),
        ])
        .filter(([, value]) => Object.keys(value as object).length),
    ) as Record<string, T>;
  return {
    sections: prune(patch.sections),
    items: prune(patch.items),
    addSections: patch.addSections ?? [],
    addItems: patch.addItems ?? [],
  };
}

/** the patch as the JSON document the editor shows, downloads and reads back */
export const patchDocument = (patch: MenuPatch) => JSON.stringify(clean(patch), null, 2);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

/**
 * A JSON document as a patch. `error` is JSON.parse's message for text that isn't JSON, and "shape" for JSON that isn't
 * a patch: an object whose sections and items are objects and whose addSections and addItems list entries with an id.
 */
export function parsePatch(text: string): { patch: MenuPatch } | { error: string } {
  let value: unknown;
  try {
    value = JSON.parse(text.trim() || "{}");
  } catch (error) {
    return { error: (error as Error).message };
  }
  if (!isRecord(value)) return { error: "shape" };
  const { sections = {}, items = {}, addSections = [], addItems = [] } = value;
  const entries = (list: unknown) => Array.isArray(list) && list.every((x) => isRecord(x) && typeof x.id === "string");
  if (!isRecord(sections) || !isRecord(items) || !entries(addSections) || !entries(addItems)) {
    return { error: "shape" };
  }
  return { patch: clean({ sections, items, addSections, addItems } as MenuPatch) };
}
