// Client for the Admin Shell dashboard API: the layers for everyone, per role and per user (VirtoCommerce.AdminShell).
import type {
  DashboardPatch,
  DashboardPersonalization,
  EffectiveDashboard,
  UserDashboardPrefs,
} from "../shell/dashboard/layers";
import { request } from "./http";

const base = "/api/admin-shell/dashboard";

/** A role with the permissions it has and the widgets it hides */
export interface RoleDashboard {
  id: string;
  name: string;
  permissions: string[];
  dashboard?: DashboardPatch;
}

export const adminDashboardApi = {
  /** the current user's dashboard: the layers composed */
  getMine: () => request<EffectiveDashboard>("GET", base),
  /** the user's own layer */
  getPrefs: () => request<UserDashboardPrefs>("GET", `${base}/me`),
  savePrefs: (prefs: UserDashboardPrefs) => request<void>("PUT", `${base}/me`, prefs),
  /** the layer for everyone (admin-shell:dashboard:manage) */
  getGlobal: () => request<DashboardPatch>("GET", `${base}/global`),
  /** resetUserLayouts drops every user's own places and sizes */
  saveGlobal: (patch: DashboardPatch, resetUserLayouts = false) =>
    request<void>("PUT", `${base}/global${resetUserLayouts ? "?resetUserLayouts=true" : ""}`, patch),
  /** every role with its permissions and its layer: the Dashboard Editor's one request */
  getRoles: () => request<RoleDashboard[]>("GET", `${base}/roles`),
  getRole: (roleId: string) => request<DashboardPatch>("GET", `${base}/roles/${encodeURIComponent(roleId)}`),
  saveRole: (roleId: string, patch: DashboardPatch) =>
    request<void>("PUT", `${base}/roles/${encodeURIComponent(roleId)}`, patch),
  getPersonalization: () => request<DashboardPersonalization>("GET", `${base}/personalization`),
  savePersonalization: (value: DashboardPersonalization) => request<void>("PUT", `${base}/personalization`, value),
};
