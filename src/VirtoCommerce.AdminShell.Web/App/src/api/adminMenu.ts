// Client for the Admin Shell menu API (VirtoCommerce.AdminShell module).
// Same-origin requests carry the platform auth cookie, like the rest of vc-shell's API calls.

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
  target?: MenuTarget;
  children: MenuItem[];
}

export interface MenuSection {
  id: string;
  title: string;
  icon?: string;
  priority: number;
  items: MenuItem[];
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

/** A same-origin JSON request (the dashboard widgets use it too) */
export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", Accept: "application/json", ...init?.headers },
  });
  if (!response.ok) {
    throw new Error(`${init?.method ?? "GET"} ${url} failed: ${response.status}`);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export const adminMenuApi = {
  getMenu: () => request<EffectiveMenu>(base),
  getPrefs: () => request<UserMenuPrefs>(`${base}/me/prefs`),
  savePrefs: (prefs: UserMenuPrefs) => request<void>(`${base}/me/prefs`, { method: "PUT", body: JSON.stringify(prefs) }),
  addRecent: (itemId: string) => request<void>(`${base}/me/recent/${encodeURIComponent(itemId)}`, { method: "POST" }),
};
