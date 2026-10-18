/**
 * The Modules menu item's counters (default-menu.json: Modules with Browse, Installed, Updates): updates waiting, as a
 * badge on Modules and on Updates, and how many modules there are and are installed, as muted totals. One read of the
 * module catalog serves the four counts of a refresh.
 */
import type { ModuleDescriptor } from "@vc-shell/framework";
import { request } from "../../api/http";
import { menuCounters } from "../../shell/menuCounters";
import { buildRows, type ModuleRow } from "./composables/modules";

const PERMISSION = "platform:module:access";

let cached: { at: number; rows: Promise<ModuleRow[]> } | undefined;

// the counters of one refresh ask at the same moment: they share the answer for a few seconds
function rows(signal: AbortSignal) {
  if (!cached || Date.now() - cached.at > 5000) {
    const answer = request<ModuleDescriptor[]>("GET", "/api/platform/modules", undefined, signal).then((x) =>
      buildRows(x ?? []),
    );
    cached = { at: Date.now(), rows: answer };
    answer.catch(() => (cached = undefined));
  }
  return cached.rows;
}

const updates = (list: ModuleRow[]) => list.filter((m) => m.isInstalled && m.hasUpdate).length;

export function registerModuleCounters() {
  menuCounters.register({
    itemId: "platform.modules",
    hint: "SHELL.BADGES.MODULE_UPDATES",
    permission: PERMISSION,
    count: async ({ signal }) => updates(await rows(signal)),
  });
  menuCounters.register({
    itemId: "platform.modules.updates",
    hint: "SHELL.BADGES.MODULE_UPDATES",
    permission: PERMISSION,
    count: async ({ signal }) => updates(await rows(signal)),
  });
  menuCounters.register({
    itemId: "platform.modules.installed",
    hint: "SHELL.BADGES.MODULES_INSTALLED",
    permission: PERMISSION,
    tone: "total",
    count: async ({ signal }) => (await rows(signal)).filter((m) => m.isInstalled).length,
  });
  menuCounters.register({
    itemId: "platform.modules.browse",
    hint: "SHELL.BADGES.MODULES_AVAILABLE",
    permission: PERMISSION,
    tone: "total",
    count: async ({ signal }) => (await rows(signal)).length,
  });
}
