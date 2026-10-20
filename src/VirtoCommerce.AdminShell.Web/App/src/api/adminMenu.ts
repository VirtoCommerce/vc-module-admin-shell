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

/** Titles by language from a menu patch (the editor's renames): they win over the key; English is the fallback */
export type MenuTitles = Record<string, string>;

export interface MenuItem {
  id: string;
  title: string;
  /** translation key of the title: the menu locale files (MENU.ITEMS.{id} when not set), a plugin's texts or the platform's */
  titleKey?: string;
  titles?: MenuTitles;
  icon?: string;
  iconUrl?: string;
  permission?: string;
  priority: number;
  moduleId?: string;
  /** the panel group it shows under (one of its section's groups; "" or none: after the groups) */
  group?: string;
  target?: MenuTarget;
  /** the AngularJS screen an item opening its Vue route stands in for (the default menu sets it) */
  fallback?: MenuTarget;
  children: MenuItem[];
  /** "discovered": a workspace blade no menu entry opens (in More); "added": added by a patch */
  source?: "discovered" | "added";
  /** the editor only: hidden by the patch being edited */
  hidden?: boolean;
  /** a patch's addItems only: the section it goes to */
  sectionId?: string;
}

export interface MenuGroup {
  id?: string;
  title: string;
  titleKey?: string;
}

export interface MenuSection {
  id: string;
  title: string;
  titleKey?: string;
  titles?: MenuTitles;
  icon?: string;
  priority: number;
  permission?: string;
  items: MenuItem[];
  /** the panel's headed groups, in order (none: the panel is one list) */
  groups: MenuGroup[];
  /** "added": added by a patch */
  source?: "added";
  /** the editor only: hidden by the patch being edited */
  hidden?: boolean;
}

/** What users may change in their own menu (the SI's choice in Configuration › Menu) */
export interface MenuPersonalization {
  allowPin: boolean;
  allowHide: boolean;
  allowReorder: boolean;
}

export interface EffectiveMenu {
  sections: MenuSection[];
  pinned: MenuItem[];
  /** ranked by use: frequent and recent pages first, one-off pages fade out (pinned, hidden and Home's own left out) */
  recent: MenuItem[];
  hidden: string[];
  personalization?: MenuPersonalization;
}

export interface UserMenuPrefs {
  pinned: string[];
  hidden: string[];
  order: Record<string, string[]>;
}

export interface SectionPatch {
  title?: string;
  titles?: MenuTitles;
  icon?: string;
  priority?: number;
  hidden?: boolean;
}

export interface ItemPatch extends SectionPatch {
  sectionId?: string;
  group?: string;
}

/** A layer of changes on top of the default menu (the global patch the editor writes, or a role's) */
export interface MenuPatch {
  sections: Record<string, SectionPatch>;
  items: Record<string, ItemPatch>;
  addSections: MenuSection[];
  addItems: MenuItem[];
}

/** The default menu (or the editor's view of it) */
export interface MenuDocument {
  sections: MenuSection[];
}

const base = "/api/admin-shell/menu";

export const adminMenuApi = {
  /** the user's menu; `discovered`: workspace blades no menu entry opens, which the server puts in More */
  getMenu: (discovered: MenuItem[] = []) => request<EffectiveMenu>("POST", base, { discovered }),
  getPrefs: () => request<UserMenuPrefs>("GET", `${base}/me/prefs`),
  savePrefs: (prefs: UserMenuPrefs) => request<void>("PUT", `${base}/me/prefs`, prefs),
  addRecent: (itemId: string) => request<void>("POST", `${base}/me/recent/${encodeURIComponent(itemId)}`),

  /* ---- the menu editor (admin-shell:menu:manage) ---- */
  /** the default menu with `patch` (the stored global patch when left out), hidden entries marked instead of removed */
  getEditorMenu: (discovered: MenuItem[], patch?: MenuPatch) =>
    request<MenuDocument>("POST", `${base}/editor`, { discovered, patch }),
  /** the default menu as installed (before replacements and patches): every AngularJS screen it knows */
  getDefaultMenu: (discovered: MenuItem[]) => request<MenuDocument>("POST", `${base}/default`, { discovered }),
  getGlobalPatch: () => request<Partial<MenuPatch>>("GET", `${base}/global`),
  saveGlobalPatch: (patch: MenuPatch) => request<void>("PUT", `${base}/global`, patch),
  getPersonalization: () => request<MenuPersonalization>("GET", `${base}/personalization`),
  savePersonalization: (value: MenuPersonalization) => request<void>("PUT", `${base}/personalization`, value),
};
