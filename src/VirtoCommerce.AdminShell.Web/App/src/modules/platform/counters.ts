/**
 * The Modules menu item's counters (default-menu.json: Modules with Browse, Installed, Updates, Failed): modules that
 * failed to start and updates waiting, as badges on Modules, Failed and Updates, and how many modules there are and are
 * installed, as muted totals. One read of the module catalog serves the counts of a refresh.
 */
import type { ModuleDescriptor } from "@vc-shell/framework";
import { request } from "../../api/http";
import { menuCounters } from "../../shell/menuCounters";
import { failedModules } from "../../shell/moduleErrors";
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

/** The modules that failed to start, kept for the shell's notice (moduleErrors.ts) */
function failed(list: ModuleRow[]) {
  const modules = list.filter((m) => m.hasErrors);
  failedModules.value = modules.map((m) => ({
    id: m.id,
    title: m.title || m.id,
    version: m.version,
    errors: m.validationErrors ?? [],
  }));
  return modules.length;
}

export function registerModuleCounters() {
  menuCounters.register({
    itemId: "platform.modules",
    hint: "SHELL.BADGES.MODULES_ATTENTION",
    permission: PERMISSION,
    count: async ({ signal }) => {
      const list = await rows(signal);
      return failed(list) + updates(list);
    },
  });
  menuCounters.register({
    itemId: "platform.modules.failed",
    hint: "SHELL.BADGES.MODULES_FAILED",
    permission: PERMISSION,
    // Failed shows only while a module failed to start
    hideWhenZero: true,
    count: async ({ signal }) => failed(await rows(signal)),
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
