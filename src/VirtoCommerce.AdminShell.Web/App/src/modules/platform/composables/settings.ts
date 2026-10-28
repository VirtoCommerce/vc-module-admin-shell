import type { ObjectSettingEntry } from "@vc-shell/framework";
import { computed, ref, type Ref } from "vue";
import { api, currentLocale, platformTranslations } from "../api";

/** Global settings schema entry (SettingsV2Controller); valueType is a string because the framework enum lacks Cron. */
export interface SettingSchema {
  name: string;
  displayName?: string | null;
  groupName?: string | null;
  moduleId?: string | null;
  valueType: string;
  defaultValue?: unknown;
  allowedValues?: unknown[] | null;
  isRequired?: boolean;
  isReadOnly?: boolean;
  isDictionary?: boolean;
  isLocalizable?: boolean;
  restartRequired?: boolean;
  assignedToTenants?: string[] | null;
}

export type SettingValues = Record<string, unknown>;

// the global settings: one shared store, the workspace list, group blades and the dictionary editor all read the same baseline
const schema = ref<SettingSchema[]>([]);
const stored = ref<SettingValues>({});
const translations = ref<Record<string, unknown>>({});

export const isEmpty = (x: unknown) => x === null || x === undefined || x === "";
const lf = (x: unknown) => String(x ?? "").replace(/\r\n/g, "\n");

/** Value equality as the legacy blade compares it: '' == null, Json compared with normalized line breaks. */
export function sameValue(a: unknown, b: unknown, valueType: string): boolean {
  if (isEmpty(a) && isEmpty(b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
  if (isEmpty(a) || isEmpty(b)) return false;
  if (valueType === "Json") return lf(a) === lf(b);
  if (valueType === "DateTime") return new Date(a as string).getTime() === new Date(b as string).getTime();
  return String(a) === String(b);
}

/** Editor value for a stored value (Json gets LF line breaks so a textarea round-trip doesn't count as a change). */
export const toEditor = (value: unknown, valueType: string) =>
  valueType === "Json" && !isEmpty(value) ? lf(value) : value;

/**
 * The v2 values endpoint lets Json.NET parse an ISO "…T…Z" string into a date, stringifies it without zone and fraction and
 * re-reads it as server-local time: the stored instant moves by the server's UTC offset. "2026-10-13 04:50:13.1680059Z"
 * (space instead of T) stays a string and is stored exactly.
 * ponytail: the platform after 3.1079.0 keeps date text as sent (SettingValues); drop this once module.manifest requires it.
 */
function dateWire(value: unknown) {
  const raw = value instanceof Date ? value.toISOString() : value;
  return typeof raw === "string" && /^\d{4}-\d{2}-\d{2}T/.test(raw) ? raw.replace("T", " ") : raw;
}

/** The document the export downloads and the JSON editor shows: modified settings only. */
export const exportDocument = (settings: SettingValues) => ({
  version: "1.0",
  exportedAt: new Date().toISOString(),
  scope: "global",
  settings,
});

/** The settings of an imported document; a bare { name: value } map is taken as it is. */
export const settingsOf = (doc: { settings?: unknown } | null): SettingValues =>
  doc?.settings && typeof doc.settings === "object" ? (doc.settings as SettingValues) : (doc as SettingValues);

/** "Catalog|Search" -> ["Catalog", "Search"]; settings without a group live under "General". */
export const groupPath = (s: SettingSchema) => (s.groupName || "General").split("|").map((x) => x.trim());

/** The tree node of a setting's group: "Catalog|Search" */
export const groupId = (s: SettingSchema) => groupPath(s).join("|");

/** A setting the Settings blade is asked to show (global search); the blade picks it up once it is open */
export const settingFocus = ref<{ name: string; at: number }>();
export const focusSetting = (name: string) => (settingFocus.value = { name, at: Date.now() });

// legacy labels come from the platform translations: settings.<Name.With.Dots>.title / .description (nested by dots)
function resolve(node: unknown, parts: string[]): unknown {
  if (!parts.length) return node;
  if (!node || typeof node !== "object") return undefined;
  for (let k = parts.length; k > 0; k--) {
    const key = parts.slice(0, k).join(".");
    if (key in (node as Record<string, unknown>)) {
      const found = resolve((node as Record<string, unknown>)[key], parts.slice(k));
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function text(name: string, kind: "title" | "description") {
  const value = resolve(translations.value.settings, [...name.split("."), kind]);
  return typeof value === "string" ? value : undefined;
}

export const settingTitle = (s: SettingSchema) => text(s.name, "title") || s.displayName || s.name;
export const settingDescription = (s: SettingSchema) => text(s.name, "description");

/**
 * Where a settings blade reads and saves, as the AngularJS unified settings blade's data sources:
 * - global: the platform's global settings (the Settings workspace);
 * - tenant ("disconnected"): one object's settings, e.g. a store's, read and saved by the blade itself through the v2
 *   tenant API (needs platform:setting:query / platform:setting:update);
 * - entity ("connected"): the settings an entity carries (Store.settings, ObjectSettingEntry[]); the blade that opened it
 *   gives them and takes the changed values back, and its entity saves them (no settings permission needed).
 */
export type SettingsScope =
  | { kind: "global" }
  | { kind: "tenant"; tenantType: string; tenantId: string }
  | {
      kind: "entity";
      tenantType: string;
      read: () => Promise<ObjectSettingEntry[]>;
      write: (values: SettingValues) => Promise<unknown>;
    };

/** An entity's setting (with its own metadata) as the blade's schema entry */
function schemaOf(entry: ObjectSettingEntry, tenantType: string): SettingSchema {
  return {
    name: entry.name!,
    displayName: entry.displayName,
    groupName: entry.groupName,
    moduleId: entry.moduleId,
    valueType: String(entry.valueType ?? "ShortText"),
    defaultValue: entry.defaultValue,
    allowedValues: entry.allowedValues,
    isRequired: entry.isRequired,
    isReadOnly: entry.isReadOnly,
    isDictionary: entry.isDictionary,
    isLocalizable: entry.isLocalizable,
    restartRequired: entry.restartRequired,
    assignedToTenants: [tenantType],
  };
}

function storeFor(scope: SettingsScope, schema: Ref<SettingSchema[]>, stored: Ref<SettingValues>) {
  const base =
    scope.kind === "tenant"
      ? `/api/platform/settings/v2/tenant/${encodeURIComponent(scope.tenantType)}`
      : "/api/platform/settings/v2/global";
  const valuesUrl = scope.kind === "tenant" ? `${base}/${encodeURIComponent(scope.tenantId)}/values` : `${base}/values`;

  async function load(locale = currentLocale()) {
    if (scope.kind === "entity") {
      const [entries, localization] = await Promise.all([scope.read(), platformTranslations(locale)]);
      const visible = (entries ?? []).filter((x) => x.name && !x.isHidden);
      schema.value = visible.map((x) => schemaOf(x, scope.tenantType));
      // as the AngularJS entity blade: a setting without a value of its own shows its default
      stored.value = Object.fromEntries(
        visible.map((x) => [x.name!, x.value ?? (x.isDictionary ? x.allowedValues : x.defaultValue)]),
      );
      translations.value = localization ?? {};
      return;
    }
    const [schemaResult, values, localization] = await Promise.all([
      api<SettingSchema[]>("GET", `${base}/schema`),
      api<SettingValues>("GET", valuesUrl),
      platformTranslations(locale),
    ]);
    schema.value = schemaResult ?? [];
    stored.value = values ?? {};
    translations.value = localization ?? {};
  }

  /** Saves only the given values (the caller passes the changed ones); replaceAll resets every modified setting not in the body. */
  async function save(values: SettingValues, replaceAll = false) {
    if (!Object.keys(values).length && !replaceAll) return; // an empty body is a 400
    if (scope.kind === "entity") {
      await scope.write(values);
      return;
    }
    const dates = new Set(schema.value.filter((s) => s.valueType === "DateTime").map((s) => s.name));
    const body = Object.fromEntries(
      Object.entries(values).map(([name, value]) => [name, dates.has(name) ? dateWire(value) : value]),
    );
    await api("POST", `${valuesUrl}?replaceAll=${replaceAll}`, body);
  }

  const exportModified = () => api<SettingValues>("GET", `${valuesUrl}?modifiedOnly=true`);

  const isModified = (s: SettingSchema) =>
    !sameValue(stored.value[s.name], s.isDictionary ? s.allowedValues : s.defaultValue, s.valueType);

  return {
    schema,
    stored,
    load,
    save,
    exportModified,
    isModified,
    loaded: computed(() => schema.value.length > 0),
  };
}

/**
 * The settings a blade edits. Global: one shared store (the workspace list, group blades and the dictionary editor read
 * the same baseline). An object's or entity's settings: a store of their own for the blade that edits them.
 */
export function useSettingsStore(scope: SettingsScope = { kind: "global" }) {
  if (scope.kind === "global") return storeFor(scope, schema, stored);
  return storeFor(scope, ref<SettingSchema[]>([]), ref<SettingValues>({}));
}
