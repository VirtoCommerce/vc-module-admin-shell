// The dashboard layers on the client (docs/dashboard-widgets.md, "Layers"): the widgets the modules register → the
// layout for everyone → the roles' hidden widgets → the user's own places and sizes. The server composes the layers into the user's
// dashboard; this file applies it to the registered widgets and turns the grid's layout back into a layer. No Vue here,
// so Node's test runner covers it (tests/dashboardLayers.test.mts).

/** A widget's place and size in grid cells; a layer names only what it changes */
export interface WidgetLayout {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface WidgetPatch extends WidgetLayout {
  hidden?: boolean;
}

/** A layer: for everyone (with the layout version) or a role's, by widget id */
export interface DashboardPatch {
  widgets?: Record<string, WidgetPatch>;
  layoutVersion?: number;
}

/** The user's own layer: places and sizes (users don't hide widgets), made under a layout version */
export interface UserDashboardPrefs {
  widgets?: Record<string, WidgetPatch>;
  layoutVersion?: number;
}

export interface DashboardPersonalization {
  allowMove: boolean;
  allowResize: boolean;
}

/** The current user's dashboard, as the server composes it */
export interface EffectiveDashboard {
  defaults: Record<string, WidgetLayout>;
  hidden: string[];
  layout: Record<string, WidgetLayout>;
  personalization: DashboardPersonalization;
  layoutVersion: number;
  canManage: boolean;
}

/** What the grid needs of a registered widget */
export interface WidgetLike {
  id: string;
  size: { width: number; height: number };
  position?: { x: number; y: number };
}

/** vc-shell's saved layout entry (localStorage "vc-dashboard-layout") */
export interface StoredPlacement {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const LAYOUT_STORAGE_KEY = "vc-dashboard-layout";

/** Every widget shown, nothing changed: the dashboard when the user's can't be read */
export const OPEN_DASHBOARD: EffectiveDashboard = {
  defaults: {},
  hidden: [],
  layout: {},
  personalization: { allowMove: true, allowResize: true },
  layoutVersion: 0,
  canManage: false,
};

/** The server's answer with every field there: a missing one reads as nothing changed */
export function readEffective(value: Partial<EffectiveDashboard> | undefined | null): EffectiveDashboard {
  return {
    defaults: value?.defaults ?? {},
    hidden: value?.hidden ?? [],
    layout: value?.layout ?? {},
    personalization: { ...OPEN_DASHBOARD.personalization, ...value?.personalization },
    layoutVersion: value?.layoutVersion ?? 0,
    canManage: !!value?.canManage,
  };
}

/** A widget with the layout for everyone over its module's: its place and size when no user has moved it */
export function withDefaults<T extends WidgetLike>(widget: T, defaults: Record<string, WidgetLayout>): T {
  const layout = defaults[widget.id];
  if (!layout) return widget;
  return {
    ...widget,
    size: { width: layout.width ?? widget.size.width, height: layout.height ?? widget.size.height },
    position: { x: layout.x ?? widget.position?.x ?? 0, y: layout.y ?? widget.position?.y ?? 0 },
  };
}

/** The widgets the user sees: the registered ones (already filtered by permissions) less the hidden, at their defaults */
export function visibleWidgets<T extends WidgetLike>(widgets: T[], dashboard: EffectiveDashboard): T[] {
  const hidden = new Set(dashboard.hidden);
  return widgets.filter((w) => !hidden.has(w.id)).map((w) => withDefaults(w, dashboard.defaults));
}

/**
 * The user's layout as vc-shell keeps it: an entry for each widget the user moved or resized, completed from the widget's
 * defaults. A widget without one takes its default place, so a new module's widget shows where its module put it.
 */
export function toStorage(widgets: WidgetLike[], layout: Record<string, WidgetLayout>): StoredPlacement[] {
  return widgets
    .filter((w) => layout[w.id])
    .map((w) => {
      const own = layout[w.id];
      return {
        id: w.id,
        x: own.x ?? w.position?.x ?? 0,
        y: own.y ?? w.position?.y ?? 0,
        w: own.width ?? w.size.width,
        h: own.height ?? w.size.height,
      };
    });
}

/** vc-shell's saved layout read back; anything else reads as none */
export function fromStorage(json: string | null | undefined): StoredPlacement[] {
  try {
    const value: unknown = json ? JSON.parse(json) : [];
    if (!Array.isArray(value)) return [];
    return value.filter(
      (x): x is StoredPlacement =>
        !!x && typeof x.id === "string" && [x.x, x.y, x.w, x.h].every((n) => typeof n === "number"),
    );
  } catch {
    return [];
  }
}

/**
 * The grid's layout as a layer: for each widget, only the place and size that differ from what it would have anyway
 * (the base: its module's, or the layout for everyone under the user's). A widget left where it was stays out of the
 * layer, so a later change of its default reaches it.
 */
export function diffLayout(placements: StoredPlacement[], base: WidgetLike[]): Record<string, WidgetLayout> {
  const byId = new Map(base.map((w) => [w.id, w]));
  const result: Record<string, WidgetLayout> = {};
  for (const p of placements) {
    const w = byId.get(p.id);
    if (!w) continue;
    const change: WidgetLayout = {};
    if (p.x !== (w.position?.x ?? 0) || p.y !== (w.position?.y ?? 0)) Object.assign(change, { x: p.x, y: p.y });
    if (p.w !== w.size.width || p.h !== w.size.height) Object.assign(change, { width: p.w, height: p.h });
    if (Object.keys(change).length) result[p.id] = change;
  }
  return result;
}

/** A layer from its hidden widgets and its places and sizes */
export function toPatch(hidden: Iterable<string>, layout: Record<string, WidgetLayout>): Record<string, WidgetPatch> {
  const widgets: Record<string, WidgetPatch> = {};
  for (const [id, change] of Object.entries(layout)) widgets[id] = { ...change };
  for (const id of hidden) widgets[id] = { ...widgets[id], hidden: true };
  return widgets;
}

/** The ids a layer hides */
export function hiddenIn(widgets: Record<string, WidgetPatch> | undefined): string[] {
  return Object.entries(widgets ?? {})
    .filter(([, w]) => w?.hidden)
    .map(([id]) => id);
}

/** The places and sizes a layer sets */
export function layoutIn(widgets: Record<string, WidgetPatch> | undefined): Record<string, WidgetLayout> {
  const result: Record<string, WidgetLayout> = {};
  for (const [id, w] of Object.entries(widgets ?? {})) {
    const layout: WidgetLayout = { x: w?.x, y: w?.y, width: w?.width, height: w?.height };
    for (const key of Object.keys(layout) as (keyof WidgetLayout)[]) if (layout[key] == null) delete layout[key];
    if (Object.keys(layout).length) result[id] = layout;
  }
  return result;
}

/** Whether a role can see a widget at all: it has the widget's permissions (any of them), or the widget asks for none */
export function roleCanSee(widgetPermissions: string[] | undefined, rolePermissions: string[]): boolean {
  if (!widgetPermissions?.length) return true;
  const held = new Set(rolePermissions);
  return widgetPermissions.some((p) => held.has(p));
}
