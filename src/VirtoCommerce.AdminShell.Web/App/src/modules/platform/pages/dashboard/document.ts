// The Dashboard Editor's settings as one JSON document (Edit as JSON): to back up, restore or move between
// environments. Roles are named, not by id, since ids differ between environments.
import type { DashboardPatch, DashboardPersonalization } from "../../../../shell/dashboard/layers";

export interface DashboardDocument {
  /** the layer for everyone: widgets hidden from everyone, places and sizes */
  everyone?: DashboardPatch;
  /** the widgets each role's users don't see, by role name */
  roles?: Record<string, string[]>;
  personalization?: Partial<DashboardPersonalization>;
}

export function documentText(doc: DashboardDocument) {
  return JSON.stringify(doc, null, 2);
}

/** The document a text holds, or why it isn't one */
export function parseDocument(text: string): { doc: DashboardDocument } | { error: string } {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (e) {
    return { error: String((e as Error).message ?? e) };
  }
  const isObject = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
  if (!isObject(value)) return { error: "shape" };
  const { everyone, roles, personalization } = value;
  if (
    everyone !== undefined &&
    (!isObject(everyone) || (everyone.widgets !== undefined && !isObject(everyone.widgets)))
  )
    return { error: "shape" };
  if (
    roles !== undefined &&
    (!isObject(roles) ||
      Object.values(roles).some((ids) => !Array.isArray(ids) || ids.some((id) => typeof id !== "string")))
  )
    return { error: "shape" };
  if (personalization !== undefined && !isObject(personalization)) return { error: "shape" };
  return { doc: value as DashboardDocument };
}
