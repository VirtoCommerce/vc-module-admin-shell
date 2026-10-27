/**
 * Global search in the shell: the provider registry (globalSearch), the platform's providers and the setup that binds
 * them to the signed-in user. Each module registers its own providers from its plugin, which reaches the registry through
 * the app it is installed into (it can't import the host's code): app.config.globalProperties.$globalSearch, or
 * inject(GLOBAL_SEARCH_KEY) in a component. The registry carries the shell's navigation helpers too (openBlade,
 * openLegacy), so a plugin can open its results, in a Vue screen or in an AngularJS one.
 */
import { usePermissions, useBladeStack } from "@vc-shell/framework";
import type { App } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useAdminMenu } from "../../composables/useAdminMenu";
import { configureGlobalSearch, globalSearch, type GlobalSearch } from "./globalSearch";
import { configureSearchNavigation } from "./navigation";
import { registerPlatformProviders } from "./providers/platform";

export { globalSearch, highlight } from "./globalSearch";
export type {
  GlobalSearch,
  Permission,
  SearchAnswer,
  SearchContext,
  SearchGroup,
  SearchItem,
  SearchProvider,
  SearchResult,
} from "./globalSearch";
export { openBlade, openLegacy, goTo, waitFor } from "./navigation";

/** The injection key module plugins use: inject(GLOBAL_SEARCH_KEY) */
export const GLOBAL_SEARCH_KEY = "adminShell.globalSearch";

declare module "vue" {
  interface ComponentCustomProperties {
    $globalSearch: GlobalSearch;
  }
}

/** Makes the registry available to module plugins; called once from main.ts, before the plugins load */
export function installGlobalSearch(app: App) {
  app.provide(GLOBAL_SEARCH_KEY, globalSearch);
  app.config.globalProperties.$globalSearch = globalSearch;
}

let registered = false;

/**
 * Binds the registry to the signed-in user (permissions, translations) and the shell's navigation, and registers the
 * built-in providers. Called once from the shell layout's setup, where the router, the blade stack and i18n are.
 */
export function useGlobalSearchSetup() {
  const router = useRouter();
  const bladeStack = useBladeStack();
  const { hasAccess } = usePermissions();
  const { t, te } = useI18n({ useScope: "global" });
  const { menu, open } = useAdminMenu();

  configureGlobalSearch({
    hasPermission: (permission) => hasAccess(permission),
    translate: (key) => (te(key) ? t(key) : key),
  });
  configureSearchNavigation({ router, bladeStack });

  if (registered) return;
  registered = true;
  // the platform's own; each module registers its providers from its plugin
  registerPlatformProviders({ menu, openMenuItem: open });
}
