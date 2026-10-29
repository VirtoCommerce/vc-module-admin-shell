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

/** The AngularJS admin's page ("/" or "/apps/platform/"), or null when no AngularJS admin is installed */
export function legacyAdminBaseUrl(): Promise<string | null> {
  baseUrl ??= fetch("/api/platform/common/ui/context", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  })
    .then((response) => (response.ok ? (response.json() as Promise<UIContext>) : undefined))
    .then((context) => {
      if (!context?.adminUIs) return "/";
      return context.adminUIs.find((x) => x.id === ANGULARJS_APP_ID)?.url ?? null;
    })
    .catch(() => "/");
  return baseUrl;
}

/** The AngularJS admin embedded (EmbeddedMode, read from the real query string), opened on an AngularJS state url */
export function legacyAdminSrc(base: string, url = "/workspace"): string {
  return `${base}?EmbeddedMode=true#!${url}`;
}
