// The host's dashboard widgets. Module plugins register theirs the same way (e.g. Orders: sales, orders, payments).
// Every widget declares a position (the grid only honours declared positions when all have one);
// rows follow the design's Dashboard.jsx:
//   y0  alerts (7) | activity (5)          y5  total sales (4) | sales trends (8)        [orders]
//   y10 recent orders (8) | carts (4) [cart]   y16 low stock (8) [inventory] | orders to process (4)
//   y22 payments (5) | sign-ins (4) | fulfillment (3)
import { registerDashboardWidget } from "@vc-shell/framework";
import { markRaw } from "vue";
import ActivityWidget from "./ActivityWidget.vue";
import AlertsWidget from "./AlertsWidget.vue";
import SignInsWidget from "./SignInsWidget.vue";

registerDashboardWidget({
  id: "shell-alerts",
  name: "Alerts and notifications",
  component: markRaw(AlertsWidget),
  size: { width: 7, height: 5 },
  position: { x: 0, y: 0 },
});

registerDashboardWidget({
  id: "shell-activity",
  name: "Recent activity",
  component: markRaw(ActivityWidget),
  size: { width: 5, height: 5 },
  position: { x: 7, y: 0 },
  // the change log spans every object type and user, and its endpoint asks for no permission:
  // shown to those who may audit accounts (legacy shows it only in the user details)
  permissions: ["platform:security:read"],
});

registerDashboardWidget({
  id: "shell-sign-ins",
  name: "Sign-in activity",
  component: markRaw(SignInsWidget),
  size: { width: 4, height: 5 },
  position: { x: 5, y: 22 },
  permissions: ["platform:security:sign_in_log:read"],
});
