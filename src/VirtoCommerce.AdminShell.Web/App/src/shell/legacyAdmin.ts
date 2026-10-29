/**
 * Where the AngularJS admin opens. It is the platform's "platform" app (module VirtoCommerce.AdminAngularJs): at the
 * site root when it owns it, otherwise at /apps/platform/ (VirtoCommerce:PlatformUI:RootApp). The platform tells
 * where in its UI context; platforms from before the AngularJS admin left them have no admin UI list there and always
 * serve the AngularJS admin at the site root.
 */

interface AdminUI {
  id: string;
  url: string;
}

interface UIContext {
  adminUIs?: AdminUI[];
}

const ANGULARJS_APP_ID = "platform";

let baseUrl: Promise<string | null> | undefined;

/**
 * The AngularJS admin's page ("/" or "/apps/platform/"), or null when no AngularJS admin is installed. The answer is kept
 * for the page's life; a failed request is not, so the next caller asks again.
 */
export function legacyAdminBaseUrl(): Promise<string | null> {
  baseUrl ??= fetch("/api/platform/common/ui/context", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  }).then(async (response) => {
    // a platform from before the AngularJS admin left it has no such endpoint, and serves the admin at the root
    if (response.status === 404) return "/";
    if (!response.ok) throw new Error(`UI context: HTTP ${response.status}`);
    const context = (await response.json()) as UIContext;
    if (!context.adminUIs) return "/";
    return context.adminUIs.find((x) => x.id === ANGULARJS_APP_ID)?.url ?? null;
  });
  const request = baseUrl;
  return request.catch(() => {
    // not known this time: the site root, as before; the next caller asks again (unless one already did)
    if (baseUrl === request) baseUrl = undefined;
    return "/";
  });
}

/** The AngularJS admin embedded (EmbeddedMode, read from the real query string), opened on an AngularJS state url */
export function legacyAdminSrc(base: string, url = "/workspace"): string {
  return `${base}?EmbeddedMode=true#!${url}`;
}
