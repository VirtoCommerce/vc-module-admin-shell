/**
 * Where a finished sign-in goes, shared by the password form (pages/Login.vue) and the code step that follows it when
 * the platform asks for a second factor (pages/TwoFactorSignIn.vue).
 */
import type { UserDetail } from "@vc-shell/framework";
import type { Router } from "vue-router";
import { canAccessAdminUI } from "./adminUIAccess";

// the sign-in pages themselves, which a finished sign-in must not land on again
const SIGN_IN_PATHS = ["/login", "/sign-in-code"];

// where an expired session or a deep link left off; same-site paths only. Read once, so a later sign-in can't land there.
export function takeRedirectTarget() {
  const target = localStorage.getItem("redirectAfterLogin")?.trim();
  localStorage.removeItem("redirectAfterLogin");
  if (!target?.startsWith("/") || target.startsWith("//")) return "/";
  return SIGN_IN_PATHS.includes(target.split(/[?#]/)[0]) ? "/" : target;
}

export async function goAfterSignIn(router: Router, user: UserDetail | undefined) {
  // as the AngularJS admin: a user the platform keeps out of the admin UI isn't sent through a password change first
  if (!canAccessAdminUI(user)) {
    await router.push({ name: "AccessDenied" });
    return;
  }
  if (user?.passwordExpired) {
    await router.push({ name: "ChangePassword" });
    return;
  }
  await router.push(takeRedirectTarget());
}
