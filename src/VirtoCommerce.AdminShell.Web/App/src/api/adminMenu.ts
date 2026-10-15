// Client for the Admin Shell menu API (VirtoCommerce.AdminShell module).
// Same-origin requests carry the platform auth cookie, like the rest of vc-shell's API calls.
import { request } from "./http";

export interface MenuTarget {
  type: "vue" | "legacy" | "app" | "url";
  route?: string;
  legacyUrl?: string;
  appId?: string;
  url?: string;
}

export interface MenuItem {
  id: string;
  title: string;
  icon?: string;
  iconUrl?: string;
  permission?: string;
  priority: number;
  moduleId?: string;
  /** the panel group it shows under (one of its section's groups) */
  group?: string;
  target?: MenuTarget;
  children: MenuItem[];
}

export interface MenuSection {
  id: string;
  title: string;
  icon?: string;
  priority: number;
  items: MenuItem[];
  /** the panel's headed groups, in order (none: the panel is one list) */
  groups: { title: string }[];
}

export interface EffectiveMenu {
  sections: MenuSection[];
  pinned: MenuItem[];
  /** ranked by use: frequent and recent pages first, one-off pages fade out (pinned, hidden and Home's own left out) */
  recent: MenuItem[];
  hidden: string[];
}

export interface UserMenuPrefs {
  pinned: string[];
  hidden: string[];
  order: Record<string, string[]>;
}

const base = "/api/admin-shell/menu";

export const adminMenuApi = {
  getMenu: () => request<EffectiveMenu>("GET", base),
  getPrefs: () => request<UserMenuPrefs>("GET", `${base}/me/prefs`),
  savePrefs: (prefs: UserMenuPrefs) => request<void>("PUT", `${base}/me/prefs`, prefs),
  addRecent: (itemId: string) => request<void>("POST", `${base}/me/recent/${encodeURIComponent(itemId)}`),
};
