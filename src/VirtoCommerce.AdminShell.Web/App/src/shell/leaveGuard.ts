import { usePopup } from "@vc-shell/framework";
import { onBeforeUnmount, type Ref } from "vue";
import type { Router } from "vue-router";

/**
 * Asks before unsaved changes on a workspace screen are lost:
 * - leaving the screen in the shell (a menu item, search, a link, back): a confirmation, and staying if declined;
 * - closing or reloading the browser tab or window: the browser's own "leave site?" prompt.
 * vc-shell's blade form asks only when the blade itself is closed; switching screens is a route change, and vc-shell's
 * own router guard opens the next workspace in place of this one without asking it. So the question is asked by a
 * guard that runs before vc-shell's (installLeaveGuards, before the framework is installed), for the screens that
 * signed up (useLeaveGuard).
 * Moving inside the screen is not leaving it: its child blades (`/settings/dictionary`) and its own query
 * (`?group=`) keep the path. Signing out (the login page) isn't asked about here either.
 */

interface LeaveGuard {
  dirty: Ref<boolean>;
  onScreen: (path: string) => boolean;
  ask: () => Promise<boolean>;
}

const guards = new Set<LeaveGuard>();

/** Called once, before vc-shell is installed: vue-router runs guards in the order they were added */
export function installLeaveGuards(router: Router) {
  router.beforeEach(async (to, from) => {
    if (to.name === "Login") return true;
    for (const guard of guards) {
      if (guard.dirty.value && guard.onScreen(from.path) && !guard.onScreen(to.path) && !(await guard.ask()))
        return false;
    }
    return true;
  });
}

/**
 * @param dirty whether the screen holds changes that aren't saved
 * @param basePath the screen's route (its defineBlade url, e.g. "/settings")
 * @param message the question, in the user's language
 */
export function useLeaveGuard(dirty: Ref<boolean>, basePath: string, message: () => string) {
  const { showConfirmation } = usePopup();

  const guard: LeaveGuard = {
    dirty,
    onScreen: (path) => path === basePath || path.startsWith(`${basePath}/`),
    ask: async () => (await showConfirmation(message())) === true,
  };
  guards.add(guard);

  const onUnload = (event: BeforeUnloadEvent) => {
    if (!dirty.value) return;
    // the browser's own "leave site?" prompt (Chrome and Edge 119+, Firefox, Safari); the deprecated returnValue isn't needed
    event.preventDefault();
  };
  window.addEventListener("beforeunload", onUnload);

  onBeforeUnmount(() => {
    guards.delete(guard);
    window.removeEventListener("beforeunload", onUnload);
  });
}
