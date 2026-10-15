/**
 * The shell's own providers (order 10-50): the menu, the apps of the apps menu, global settings, users and roles.
 * Same set as the AngularJS admin's built-in providers; the menu here is the shell's effective menu, so the apps that
 * have a place in it (Tasks, News, …) are found as menu items.
 */
import { shallowRef, type Ref } from "vue";
import type { EffectiveMenu, MenuItem } from "../../../api/adminMenu";
import {
  groupPath,
  settingTitle,
  useSettingsStore,
  type SettingSchema,
} from "../../../modules/platform/composables/settings";
import { globalSearch, type SearchItem } from "../globalSearch";
import { openBlade } from "../navigation";
import { searchApi } from "./api";

const MENU_ICON = "lucide-panel-left";

export function registerPlatformProviders(options: {
  menu: Ref<EffectiveMenu>;
  openMenuItem: (item: MenuItem) => unknown;
}) {
  const { menu, openMenuItem } = options;

  // Menu: every item of the user's menu (the server has left out what the user may not open); its place is the
  // description. Pinned and hidden items are found too: hiding an item tidies the panel, it doesn't make it unreachable.
  function menuEntries() {
    const entries: { item: MenuItem; where: string }[] = [];
    for (const section of menu.value.sections) {
      for (const item of section.items) {
        if (item.target) entries.push({ item, where: [section.title, item.group].filter(Boolean).join(" › ") });
        for (const child of item.children ?? []) {
          if (child.target) entries.push({ item: child, where: `${section.title} › ${item.title}` });
        }
      }
    }
    return entries;
  }

  globalSearch.registerProvider({
    id: "shell.menu",
    title: "SHELL.SEARCH.GROUPS.MENU",
    icon: "lucide-layout-list",
    order: 10,
    aliases: ["menu", "page", "pages"],
    isAvailable: () => menu.value.sections.length > 0,
    search: (query, context) =>
      globalSearch
        .rankItems(menuEntries(), query, (x) => [x.item.title, x.where, x.item.id], context.take)
        .map(({ item, where }) => ({
          id: item.id,
          title: item.title,
          description: where,
          icon: item.iconUrl ? undefined : (item.icon ?? MENU_ICON),
          iconUrl: item.iconUrl,
          external: item.target?.type === "url",
          execute: () => openMenuItem(item),
        })),
  });

  // Apps: the applications of the apps menu (AppMenu placement) the user may open; they open in a tab of their own.
  // MainMenu apps are embedded in the shell and found under Menu.
  interface AppDescriptor {
    id: string;
    title?: string;
    description?: string;
    iconUrl?: string;
    relativeUrl?: string;
    permission?: string;
    placement?: string | number;
    supportEmbeddedMode?: boolean;
  }
  let apps: Promise<AppDescriptor[]> | undefined;
  const isAppMenu = (app: AppDescriptor) => {
    const placement = app.placement ?? (app.supportEmbeddedMode ? "MainMenu" : "AppMenu");
    return placement === "AppMenu" || placement === 0;
  };
  const loadApps = () =>
    (apps ??= searchApi<AppDescriptor[]>("GET", "/api/platform/apps").then(
      (list) => (list ?? []).filter((app) => app.id !== "platform" && app.id !== "admin-shell" && isAppMenu(app)),
      (error) => {
        apps = undefined;
        throw error;
      },
    ));
  // the list is loaded up front, so the provider can say whether there is anything to find (and the chip can show)
  const appList = shallowRef<AppDescriptor[]>();
  loadApps().then(
    (list) => (appList.value = list),
    () => undefined,
  );
  // an app the menu already has (Builder.io, Application Insights) is found there, under Menu
  const appsToFind = (list: AppDescriptor[]) => {
    const inMenu = new Set(menuEntries().flatMap(({ item }) => appIdOf(item.target) ?? []));
    return list.filter((app) => !inMenu.has(app.id) && globalSearch.hasPermission(app.permission));
  };

  globalSearch.registerProvider({
    id: "platform.apps",
    title: "SHELL.SEARCH.GROUPS.APPS",
    icon: "lucide-layout-grid",
    order: 20,
    aliases: ["app", "apps"],
    isAvailable: () => !appList.value || appsToFind(appList.value).length > 0,
    search: async (query, context) => {
      const list = appsToFind(await loadApps());
      return globalSearch
        .rankItems(list, query, (app) => [app.title, app.description, app.id], context.take)
        .map((app): SearchItem => ({
          id: app.id,
          title: app.title ?? app.id,
          description: app.description ?? "",
          icon: app.iconUrl ? undefined : "lucide-layout-grid",
          iconUrl: rooted(app.iconUrl),
          permission: app.permission,
          external: true,
          execute: () => window.open(rooted(app.relativeUrl) ?? `/apps/${app.id}/`, "_blank", "noopener"),
        }));
    },
  });

  // Settings: the global settings schema, loaded once (the Settings screen shares it), filtered here; a result opens
  // the setting's group and points at the setting
  const store = useSettingsStore();
  let loading: Promise<void> | undefined;
  const loadSettings = () =>
    store.loaded.value
      ? Promise.resolve()
      : (loading ??= store.load().catch((error) => {
          loading = undefined;
          throw error;
        }));

  globalSearch.registerProvider({
    id: "platform.settings",
    title: "SHELL.SEARCH.GROUPS.SETTINGS",
    icon: "lucide-sliders-horizontal",
    order: 30,
    minLength: 2,
    aliases: ["setting", "settings"],
    permission: "platform:setting:access",
    search: async (query, context) => {
      await loadSettings();
      // a setting without a translated title or display name reads as its humanized name, not the full dotted one
      const settings = store.schema.value.map((s) => {
        const title = settingTitle(s);
        return { setting: s, title: title && title !== s.name ? title : humanize(s.name) };
      });
      return globalSearch
        .rankItems(settings, query, (x) => [x.title, x.setting.groupName, x.setting.name], context.take)
        .map(({ setting, title }) => ({
          id: setting.name,
          title,
          description: groupPath(setting).join(" › "),
          icon: "lucide-sliders-horizontal",
          execute: () => openSetting(setting),
        }));
    },
  });

  // Users and roles: the security API, ranked here (the API returns its own order)
  interface User {
    id: string;
    userName: string;
    email?: string;
    userType?: string;
    isAdministrator?: boolean;
    lockoutEnd?: string;
    status?: string;
  }
  interface Role {
    id: string;
    name: string;
    description?: string;
  }

  const openUsers = (keyword?: string, user?: User) =>
    openBlade({
      route: "/security",
      workspace: "PlatformSecurity",
      blades: [
        { name: "PlatformSecurityUsers", options: keyword ? { keyword } : undefined },
        ...(user ? [{ name: "PlatformSecurityUserDetails", param: user.id }] : []),
      ],
    });
  const openRoles = (keyword?: string, role?: Role) =>
    openBlade({
      route: "/security",
      workspace: "PlatformSecurity",
      blades: [
        { name: "PlatformSecurityRoles", options: keyword ? { keyword } : undefined },
        ...(role ? [{ name: "PlatformSecurityRoleDetails", param: role.name }] : []),
      ],
    });

  const locked = (user: User) => !!user.lockoutEnd && new Date(user.lockoutEnd).getTime() > Date.now();

  globalSearch.registerProvider({
    id: "platform.security.users",
    title: "SHELL.SEARCH.GROUPS.USERS",
    icon: "lucide-users",
    order: 40,
    minLength: 2,
    delay: 200,
    aliases: ["user", "users"],
    permission: "platform:security:read",
    isAvailable: () => globalSearch.hasPermission("platform:security:access"),
    match: /^[^\s@]+@[^\s@]+$/,
    search: async (query, context) => {
      const result = await searchApi<{ totalCount: number; results: User[] }>(
        "POST",
        "/api/platform/security/users/search",
        { keyword: query, take: context.take, skip: 0 },
        context.signal,
      );
      const users = reorder(result.results ?? [], query, (u) => [u.userName, u.email]);
      return {
        total: result.totalCount,
        showAll: () => openUsers(query),
        items: users.map((user) => ({
          id: user.id,
          title: user.userName,
          description: [user.email, user.userType].filter(Boolean).join(" · "),
          icon: "lucide-user",
          badge: locked(user)
            ? globalSearch.translate("SHELL.SEARCH.BADGES.LOCKED")
            : user.isAdministrator
              ? globalSearch.translate("SHELL.SEARCH.BADGES.ADMIN")
              : undefined,
          execute: () => openUsers(undefined, user),
        })),
      };
    },
  });

  globalSearch.registerProvider({
    id: "platform.security.roles",
    title: "SHELL.SEARCH.GROUPS.ROLES",
    icon: "lucide-shield",
    order: 50,
    minLength: 2,
    delay: 200,
    aliases: ["role", "roles"],
    permission: "platform:security:read",
    isAvailable: () => globalSearch.hasPermission("platform:security:access"),
    search: async (query, context) => {
      const result = await searchApi<{ totalCount: number; results: Role[] }>(
        "POST",
        "/api/platform/security/roles/search",
        { keyword: query, take: context.take, skip: 0 },
        context.signal,
      );
      const roles = reorder(result.results ?? [], query, (r) => [r.name, r.description]);
      return {
        total: result.totalCount,
        showAll: () => openRoles(query),
        items: roles.map((role) => ({
          id: role.id,
          title: role.name,
          description: role.description ?? "",
          icon: "lucide-shield",
          execute: () => openRoles(undefined, role),
        })),
      };
    },
  });
}

// the platform app a menu target opens: embedded (app) or in a tab of its own (url /apps/{id}/)
function appIdOf(target?: MenuItem["target"]) {
  if (target?.type === "app") return target.appId;
  return target?.type === "url" ? /^\/apps\/([^/]+)/.exec(target.url ?? "")?.[1] : undefined;
}

/** Server results ranked by the query first (rankItems), then the rest in the server's order */
export function reorder<T>(items: T[], query: string, fields: (item: T) => unknown[]): T[] {
  const ranked = globalSearch.rankItems(items, query, fields, items.length);
  return [...ranked, ...items.filter((x) => !ranked.includes(x))];
}

function openSetting(setting: SettingSchema) {
  return openBlade({
    route: "/settings",
    workspace: "PlatformSettings",
    blades: [
      {
        name: "PlatformSettingsGroup",
        param: groupPath(setting).join("|"),
        options: { focus: setting.name, includeTenant: !!setting.assignedToTenants?.length },
      },
    ],
  });
}

// "VirtoCommerce.Search.IndexingJobs.ScanInterval" -> "Scan interval" (settings without a translated title)
function humanize(name: string) {
  const last = (name || "").split(".").pop() ?? "";
  const words = last
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// a manifest's url may be relative to the site root ("Modules/$(VirtoCommerce.News)/..."); this page is under /apps/admin-shell/
function rooted(url?: string) {
  if (!url) return url;
  return url.startsWith("/") || url.includes("://") ? url : `/${url}`;
}
