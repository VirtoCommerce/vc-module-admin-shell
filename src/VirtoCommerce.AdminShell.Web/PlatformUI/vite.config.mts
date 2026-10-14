import path from "node:path";
import { getDynamicModuleConfiguration } from "@vc-shell/mf-module";

// Builds the platform's own admin screens (Settings, Security, Modules, Dynamic properties, Developer tools,
// User profile) as a Module Federation remote of the Admin Shell host.
// Output: <AdminShell.Web>/plugins/admin-shell/ (remoteEntry.js + public/plugin.json with the menu contributions),
// served by the platform at /modules/$(VirtoCommerce.AdminShell)/plugins/admin-shell/.
const base = "/modules/$(VirtoCommerce.AdminShell)/plugins/admin-shell/";
process.env.APP_BASE_PATH = base;

export default getDynamicModuleConfiguration({
  appId: "admin-shell",
  moduleRoot: path.resolve(__dirname, ".."),
  entry: "./src/modules/index.ts",
  remoteName: "platform_admin",
  base,
});
