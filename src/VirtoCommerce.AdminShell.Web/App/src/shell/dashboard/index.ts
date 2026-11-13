// The host's dashboard widgets. Module plugins register theirs the same way (e.g. Orders: sales, orders, payments).
// Every widget declares a position (the grid only honours declared positions when all have one); the grid is 12
// columns of 80px rows and moves widgets up into the room left by the ones a user may not see.
//   y0  alerts (12, 4 rows: at most about half a screen; the list scrolls inside)
//   y4  activity (8) | sign-ins (4): the audit widgets, for users who may read accounts and the sign-in log
// Module widgets declare their own rows below (Orders from y5: sales, recent orders, payments...); the grid keeps
// their order and moves them under these two rows.
import { registerDashboardWidget } from "@vc-shell/framework";
import { markRaw } from "vue";
import ActivityWidget from "./ActivityWidget.vue";
import AlertsWidget from "./AlertsWidget.vue";
import SignInsWidget from "./SignInsWidget.vue";

// The grid saves each user's arrangement (positions and sizes) in this browser. When the default arrangement
// changes, the saved one is dropped once, so everyone gets the new defaults instead of the old sizes.
const LAYOUT_KEY = "vc-dashboard-layout";
const LAYOUT_VERSION_KEY = "vc-dashboard-layout-version";
const LAYOUT_VERSION = "4";
try {
  if (localStorage.getItem(LAYOUT_VERSION_KEY) !== LAYOUT_VERSION) {
    localStorage.removeItem(LAYOUT_KEY);
    localStorage.setItem(LAYOUT_VERSION_KEY, LAYOUT_VERSION);
  }
} catch {
  // storage unavailable (private mode): the grid uses the defaults anyway
}

registerDashboardWidget({
  id: "shell-alerts",
  name: "Alerts and notifications",
  component: markRaw(AlertsWidget),
  size: { width: 12, height: 4 },
  position: { x: 0, y: 0 },
});

registerDashboardWidget({
  id: "shell-activity",
  name: "Recent activity",
  component: markRaw(ActivityWidget),
  size: { width: 8, height: 5 },
  position: { x: 0, y: 4 },
  // the change log spans every object type and user, and its endpoint asks for no permission:
  // shown to those who may audit accounts (legacy shows it only in the user details)
  permissions: ["platform:security:read"],
});

registerDashboardWidget({
  id: "shell-sign-ins",
  name: "Sign-in activity",
  component: markRaw(SignInsWidget),
  size: { width: 4, height: 5 },
  position: { x: 8, y: 4 },
  permissions: ["platform:security:sign_in_log:read"],
});
