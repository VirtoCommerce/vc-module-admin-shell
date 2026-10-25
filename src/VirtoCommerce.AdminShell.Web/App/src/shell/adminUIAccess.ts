import { useUser } from "@vc-shell/framework";
import type { Router } from "vue-router";

/**
 * Who may enter the admin UI is the platform's: VirtoCommerce:PlatformUI:Access (administrators, required permissions,
 * account types, permission masks) is evaluated on the server and comes as `canAccessAdminUI` on the current user,
 * as for the AngularJS admin. A user it denies sees the access-denied page instead of the shell, before any screen
 * (or a password change) opens; their permissions still work through the API.
 */

/** False only when the platform said no; a user not loaded yet (signed out) is the sign-in page's */
export function canAccessAdminUI(user: unknown) {
  return (user as { canAccessAdminUI?: boolean } | undefined)?.canAccessAdminUI !== false;
}

/** Called once, before vc-shell is installed: its guards open the screen a route asks for */
export function installAdminUIAccessGuard(router: Router) {
  const { user } = useUser();
  router.beforeEach((to) => {
    const denied = !!user.value?.userName && !canAccessAdminUI(user.value);
    if (denied && to.matched.some((record) => record.meta?.root)) return { name: "AccessDenied" };
    if (!denied && to.name === "AccessDenied") return { path: "/" };
    return true;
  });
}
