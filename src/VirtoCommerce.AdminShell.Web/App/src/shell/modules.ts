/**
 * The installed modules, for plugins that use another module only when it is installed: a module listed as an optional
 * dependency in module.manifest (<dependency id="..." optional="true" />) may be missing, so its picker, link or widget
 * shows only when it is there. Plugins reach it through the app (they can't import the host's code):
 * app.config.globalProperties.$modules, or inject(MODULES_KEY). See docs/plugins.md, "Using other modules".
 *
 * The list comes from the platform's system info (installed modules, any signed-in user), read once per page.
 * For testing a plugin without a module, this browser can treat modules as missing:
 * localStorage "adminShell.debug.missingModules" = "VirtoCommerce.Customer,VirtoCommerce.Inventory".
 */
import { useUser } from "@vc-shell/framework";
import { effectScope, readonly, shallowRef, watch, type App, type Ref } from "vue";
import { systemInfo } from "./dashboard/api";

export interface InstalledModules {
  /**
   * Whether a module is installed: false until the list has loaded, then reactive, so a template can show a control
   * with v-if="$modules.isInstalled('VirtoCommerce.Inventory')" and it appears once the answer is known
   */
  isInstalled: (moduleId: string) => boolean;
  /** The same, waiting for the list: for code that decides before calling another module's API */
  whenInstalled: (moduleId: string) => Promise<boolean>;
  /** The installed version, or undefined */
  version: (moduleId: string) => string | undefined;
  /** The installed module ids (lowercase), reactive; empty until loaded */
  installed: Readonly<Ref<ReadonlySet<string>>>;
}

/** The injection key module plugins use: inject(MODULES_KEY) */
export const MODULES_KEY = "adminShell.modules";

declare module "vue" {
  interface ComponentCustomProperties {
    $modules: InstalledModules;
  }
}

export const MISSING_MODULES_KEY = "adminShell.debug.missingModules";

const versions = shallowRef(new Map<string, string>());
const installed = shallowRef<ReadonlySet<string>>(new Set());
let loading: Promise<void> | undefined;

/** Modules this browser treats as missing (testing), lowercase */
function missingForTesting(): Set<string> {
  try {
    const value = localStorage.getItem(MISSING_MODULES_KEY) ?? "";
    return new Set(value.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean));
  } catch {
    return new Set();
  }
}

function load(): Promise<void> {
  loading ??= systemInfo()
    .then((info) => {
      const missing = missingForTesting();
      if (missing.size) {
        console.warn(`[admin-shell] treating modules as not installed (${MISSING_MODULES_KEY}): ${[...missing].join(", ")}`);
      }
      const next = new Map<string, string>();
      for (const module of info.installedModules ?? []) {
        const id = module.id?.toLowerCase();
        if (id && !missing.has(id)) next.set(id, module.version ?? "");
      }
      versions.value = next;
      installed.value = new Set(next.keys());
    })
    .catch(() => {
      // not signed in yet, or the platform didn't answer: asked again on the next check
      loading = undefined;
    });
  return loading;
}

export const modules: InstalledModules = {
  isInstalled(moduleId) {
    void load();
    return installed.value.has(moduleId.toLowerCase());
  },
  async whenInstalled(moduleId) {
    await load();
    return installed.value.has(moduleId.toLowerCase());
  },
  version(moduleId) {
    void load();
    return versions.value.get(moduleId.toLowerCase()) || undefined;
  },
  installed: readonly(installed) as Readonly<Ref<ReadonlySet<string>>>,
};

/** Makes the installed modules available to module plugins; called once from main.ts */
export function installModules(app: App) {
  app.provide(MODULES_KEY, modules);
  app.config.globalProperties.$modules = modules;

  // another user may see another platform after signing out and in (an account on another environment): read again
  effectScope(true).run(() => {
    const { user } = useUser();
    watch(
      () => user.value?.id,
      (id, previous) => {
        if (id === previous) return;
        loading = undefined;
        if (id) void load();
      },
      { immediate: true },
    );
  });
}
