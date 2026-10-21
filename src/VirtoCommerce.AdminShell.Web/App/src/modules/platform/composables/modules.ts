import { ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  ModulesClient,
  useApiClient,
  useBlade,
  usePopup,
  type ModuleDescriptor,
  type ModuleIdentity,
  type ModulePushNotification,
} from "@vc-shell/framework";

/** One row per module id: the installed version (or the latest available), as the legacy moduleHelper builds it. */
export interface ModuleRow extends ModuleDescriptor {
  id: string;
  /** latest version when the installed one is older (legacy $alternativeVersion) */
  latestVersion?: string;
  /** installed version when this row is an available version of an installed module (legacy $installedVersion) */
  installedVersionText?: string;
  hasUpdate: boolean;
  hasErrors: boolean;
  isOfficial: boolean;
  versions: ModuleDescriptor[];
}

export type ModuleAction = "install" | "update" | "uninstall";

const rows = ref<ModuleRow[]>([]);

const compareVersions = (a = "", b = "") => a.localeCompare(b, undefined, { numeric: true });
export const versionText = (v?: ModuleIdentity["version"]) => {
  if (!v) return "";
  const core = [v.major, v.minor, v.patch].join(".");
  return v.prerelease ? `${core}-${v.prerelease}` : core;
};

export function buildRows(modules: ModuleDescriptor[]): ModuleRow[] {
  const byId = new Map<string, ModuleDescriptor[]>();
  for (const m of modules) byId.set(m.id!, [...(byId.get(m.id!) ?? []), m]);
  return [...byId.entries()]
    .map(([id, versions]) => {
      versions.sort((a, b) => compareVersions(a.version, b.version));
      const latest = versions[versions.length - 1];
      const installed = versions.find((v) => v.isInstalled);
      const row = installed ?? latest;
      const latestVersion = installed && installed !== latest ? latest.version : undefined;
      return {
        ...row,
        id,
        versions,
        latestVersion,
        installedVersionText: installed && row !== installed ? installed.version : undefined,
        hasUpdate: !!latestVersion,
        hasErrors: !!row.validationErrors?.length,
        isOfficial: !!row.owners?.includes("Virto Commerce"),
      };
    })
    .sort((a, b) => (a.title ?? a.id).localeCompare(b.title ?? b.id));
}

export function useModules() {
  const { t } = useI18n({ useScope: "global" });
  const { getApiClient } = useApiClient(ModulesClient);
  const { showConfirmation } = usePopup();
  const { openBlade } = useBlade();

  async function load(rescan = false) {
    const client = await getApiClient();
    if (rescan) await client.reloadModules(); // legacy Refresh re-scans the module catalog first
    rows.value = buildRows((await client.getModules()) ?? []);
  }

  /**
   * Legacy moduleHelper.performAction: resolve dependencies, confirm with the full list, then start the job and show its progress.
   * Mutating — never run during automated verification.
   */
  async function perform(action: ModuleAction, selected: ModuleRow[]) {
    const client = await getApiClient();
    const targets: ModuleDescriptor[] = selected.map((row) =>
      action === "update" ? row.versions[row.versions.length - 1] : row,
    );
    const dependencies =
      action === "uninstall" ? await client.getDependingModules(targets) : await client.getMissingDependencies(targets);
    const extra = (dependencies ?? []).filter((d) => !targets.some((x) => x.id === d.id));
    const list = targets
      .map((m) => (action === "update" ? `${m.title ?? m.id} ${rows.value.find((r) => r.id === m.id)?.version} ⇒ ${m.version}` : `${m.title ?? m.id} ${m.version}`))
      .join(", ");
    const message = t(`PLATFORM.MODULES.CONFIRM.${action.toUpperCase()}`, { list }) +
      (extra.length ? " " + t("PLATFORM.MODULES.CONFIRM.DEPENDENCIES", { list: extra.map((m) => `${m.title ?? m.id} ${m.version}`).join(", ") }) : "");
    if (!(await showConfirmation(message))) return;

    const requests = [...targets, ...extra]
      .sort((a, b) => a.id!.localeCompare(b.id!))
      .map((m) => ({ id: m.id, version: m.version }));
    let notification: ModulePushNotification;
    if (action === "install") notification = await client.installModuleRequests(requests);
    else if (action === "update") notification = await client.updateModuleRequests(requests);
    else notification = await client.uninstallModuleRequests(requests);
    await openBlade({ name: "PlatformModulesProgress", param: notification.id, options: { notification } });
  }

  return { rows, load, perform };
}
