import * as blades from "./pages";
import * as locales from "./locales";
import { defineAppModule } from "@vc-shell/framework";
import "./styles.scss";
import { registerModuleCounters } from "./counters";

// the counters on the Modules menu item and its views
registerModuleCounters();

export default defineAppModule({
  blades,
  locales,
});

export * from "./pages";
