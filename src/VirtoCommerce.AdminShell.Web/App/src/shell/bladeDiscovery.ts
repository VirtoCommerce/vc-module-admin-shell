import { ModulesReadyKey, i18n, useMenuService } from "@vc-shell/framework";
import { computed, getCurrentInstance, inject, ref, watch, type ComputedRef } from "vue";
import type { MenuItem } from "../api/adminMenu";

/**
 * Root blade discovery: every workspace blade the host and the loaded plugins registered is a screen people should be able
 * to reach. The ones no menu entry opens are sent with the menu request, and the server lists them in More (with their
 * plugin's menuItem title and icon when it has one), so nothing installed is missing from the menu; the menu editor can
 * then place them like any item. See docs/menu-layers.md, "Discovered blades".
 */

/** vc-shell's blade registry entry (BladeRegistry is provided by the framework but not exported) */
interface BladeRegistration {
  route?: string;
  isWorkspace?: boolean;
  routable?: boolean;
  permissions?: string | string[];
}
interface BladeRegistry {
  registeredBladesMap: ComputedRef<ReadonlyMap<string, BladeRegistration>>;
}

/** the host's workspace blades that have their own way in: the profile is the avatar menu's, the rest are steps of a screen */
const NOT_IN_MENU = new Set(["/user-profile", "/modules-advanced", "/module-progress"]);

// "PlatformSecuritySignInLog" -> "Platform Security Sign In Log", the title of a blade that has no menuItem
const humanize = (name: string) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .trim();

const normalize = (route: string) => (route.startsWith("/") ? route : `/${route}`);

/** The id a discovered blade has in the menu, in patches and in pins: stable as long as the blade keeps its name */
export const discoveredId = (bladeName: string) => `blade.${bladeName}`;

function registryOf(): BladeRegistry | undefined {
  const provides = getCurrentInstance()?.appContext.provides as Record<symbol, unknown> | undefined;
  if (!provides) return undefined;
  const key = Object.getOwnPropertySymbols(provides).find((symbol) => symbol.description === "BladeRegistry");
  return key ? (provides[key] as BladeRegistry) : undefined;
}

/**
 * The workspace blades as menu items, once the plugins have loaded; `found` is called with each new list. Call from a
 * component's setup (the shell layout), where the framework's registries can be reached.
 */
export function useBladeDiscovery(found: (items: MenuItem[]) => void) {
  const registry = registryOf();
  const { menuItems } = useMenuService();
  const modulesReady = inject(ModulesReadyKey, ref(true));

  const items = computed<MenuItem[]>(() => {
    // a plugin's defineBlade({ menuItem }) title and icon, by blade name (vc-shell keeps them in its own menu service)
    const declared = new Map(menuItems.value.filter((x) => x.routeId).map((x) => [x.routeId as string, x]));
    const blades = registry ? [...registry.registeredBladesMap.value.entries()] : [];
    const list = blades.length
      ? blades
          .filter(([, blade]) => blade.isWorkspace && blade.routable !== false && blade.route)
          .map(([name, blade]) => ({ name, route: normalize(blade.route as string), permissions: blade.permissions }))
      : // no registry to read: the blades vc-shell lists in its own menu
        menuItems.value
          .filter((x) => x.routeId && x.url)
          .map((x) => ({ name: x.routeId as string, route: normalize(x.url as string), permissions: x.permissions }));

    return list
      .filter((blade) => !NOT_IN_MENU.has(blade.route))
      .map(({ name, route, permissions }) => {
        const menuItem = declared.get(name);
        const key = menuItem?.title;
        const hasKey = !!key && (i18n.global.te(key) || i18n.global.te(key, "en"));
        return {
          id: discoveredId(name),
          title: hasKey ? String(i18n.global.t(key as string, {}, { locale: "en" })) : (key ?? humanize(name)),
          titleKey: hasKey ? key : undefined,
          icon: menuItem?.icon || "lucide-square-dashed",
          permission: Array.isArray(permissions) ? permissions[0] : permissions,
          priority: menuItem?.priority ?? 0,
          target: { type: "vue" as const, route },
          children: [],
        };
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  });

  watch(
    [() => modulesReady.value, items],
    ([ready, list]) => {
      if (ready) found(list);
    },
    { immediate: true },
  );
}
