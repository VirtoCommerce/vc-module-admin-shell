import "./shell/deepLink";
// the host's dashboard widgets (module plugins add theirs when they load)
import "./shell/dashboard";
import VirtoShellFramework, { notification, useUser, useLanguages } from "@vc-shell/framework";
import { registerRemoteModules } from "@vc-shell/mf-host";
import { createApp } from "vue";
import { router } from "./router";
import * as locales from "./locales";
// vc-shell's texts in the languages it doesn't ship (docs/localization.md)
import * as frameworkLocales from "./locales/framework";
import { translateFrameworkDefaults } from "./locales/framework/defaults";
import { syncDocumentDirection } from "./locales/direction";
import { RouterView } from "vue-router";
// the platform's own screens (Settings, Security, Modules, ...) ship with the host
import PlatformModule from "./modules/platform";
// global search: module plugins register their providers through the app ($globalSearch)
import { installGlobalSearch } from "./shell/search";
// menu counters: module plugins register the counts on their menu items through the app ($menuCounters)
import { installMenuCounters } from "./shell/menuCounters";
// installed modules ($modules.isInstalled, for optional dependencies) and shared widgets ($sharedWidgets)
import { installModules } from "./shell/modules";
import { installSharedWidgets } from "./shell/sharedWidgets";
// white-labeling: the brand, the sign-in page, Home's welcome card, the theme files
import { loadBranding } from "./shell/branding";

import "@vc-shell/framework/dist/index.css";

async function startApp() {
  const { loadUser } = useUser();

  // the installation's brand (name, logos, themes) beside the user: the sign-in page shows it too
  await Promise.all([
    loadUser().catch((e) => console.log(e)),
    loadBranding(),
  ]);

  const { currentLocale, setLocale } = useLanguages();

  const app = createApp(RouterView);

  app.use(VirtoShellFramework, {
    router,
    i18n: {
      locale: import.meta.env.APP_I18N_LOCALE,
      fallbackLocale: import.meta.env.APP_I18N_FALLBACK_LOCALE,
    },
  });

  app.use(PlatformModule);

  installGlobalSearch(app);
  installMenuCounters(app);
  installModules(app);
  installSharedWidgets(app);

  app.use(router);

  // vc-shell's texts first, then the shell's own (a key in both is the shell's)
  [frameworkLocales, locales].forEach((source) =>
    Object.entries(source).forEach(([key, message]) => {
      app.config.globalProperties.$mergeLocaleMessage(key, message);
    }),
  );

  translateFrameworkDefaults(app);

  setLocale(currentLocale.value);
  syncDocumentDirection(currentLocale);

  app.config.errorHandler = (err: unknown) => {
    notification.error((err as Error).toString(), {
      timeout: 5000,
    });
  };

  // Register remote modules BEFORE mount so the provide/inject keys
  // (ModulesReadyKey, ModulesLoadErrorKey) are available to mounted components.
  // Fire-and-forget — sets modulesReady/modulesLoadError when complete.
  registerRemoteModules(app, { router, appName: "admin-shell" });

  await router.isReady();

  app.mount("#app");
}

startApp();
