// Client for the Admin Shell dashboard API: the widgets each role's users don't need (VirtoCommerce.AdminShell module).
import { request } from "./http";

/** Widget ids, as registered with registerDashboardWidget ("shell-alerts", a module's widget id) */
export interface DashboardWidgets {
  hiddenWidgets: string[];
}

const base = "/api/admin-shell/dashboard";

export const adminDashboardApi = {
  /** the widgets the current user's dashboard leaves out: those every one of the user's roles hides */
  getMine: () => request<DashboardWidgets>("GET", base),
  /** a role's list (platform:security:read) */
  getRole: (roleId: string) => request<DashboardWidgets>("GET", `${base}/roles/${encodeURIComponent(roleId)}`),
  /** replaces a role's list (platform:security:update); an empty list shows every widget */
  saveRole: (roleId: string, value: DashboardWidgets) =>
    request<void>("PUT", `${base}/roles/${encodeURIComponent(roleId)}`, value),
};
