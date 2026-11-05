// OAuth applications: the permissions the screen edits, the rules of redirect URIs and the platform's resources
// (api/platform/oauthapps). The server derives the endpoint permissions from the grant types on save.
// Only types are imported, so the rules run on Node's test runner too (tests/oauthApps.test.mts).
import type { OpenIddictApplicationDescriptor } from "@vc-shell/framework";

// the generated type marks the collections readonly; they are plain arrays on the wire
export type OAuthApp = Omit<
  OpenIddictApplicationDescriptor,
  "redirectUris" | "postLogoutRedirectUris" | "permissions" | "requirements"
> & {
  redirectUris?: string[];
  postLogoutRedirectUris?: string[];
  permissions?: string[];
  requirements?: string[];
  applicationType?: string;
  consentType?: string;
};

export interface OAuthResource {
  uri: string;
  title?: string;
  kind?: string;
  description?: string;
  /** listed in Authorization:Resources: tokens are issued for it */
  isRegistered: boolean;
}

export const PKCE = "ft:pkce";
export const RESOURCE_PREFIX = "rsrc:";
export const CLIENT_CREDENTIALS = "gt:client_credentials";
export const AUTHORIZATION_CODE = "gt:authorization_code";

export const CLIENT_TYPES = ["public", "confidential"] as const;
export const APPLICATION_TYPES = ["web", "native"] as const;
export const CONSENT_TYPES = ["explicit", "implicit", "systematic"] as const;
export const GRANT_TYPES = [AUTHORIZATION_CODE, "gt:refresh_token", CLIENT_CREDENTIALS, "gt:password"] as const;
export const SCOPES = ["scp:email", "scp:profile", "scp:roles"] as const;

// set by the server from the grant types, not edited
const DERIVED = ["ept:authorization", "ept:end_session", "ept:token", "rst:code"];
const EDITED = new Set<string>([...GRANT_TYPES, ...SCOPES]);

export const hasPermission = (app: OAuthApp, permission: string) => (app.permissions ?? []).includes(permission);

export function setPermission(app: OAuthApp, permission: string, on: boolean) {
  const rest = (app.permissions ?? []).filter((x) => x !== permission);
  app.permissions = on ? [...rest, permission] : rest;
}

export const hasGrantType = (app: OAuthApp) => (app.permissions ?? []).some((x) => x.startsWith("gt:"));

export const resourcesOf = (app: OAuthApp) =>
  (app.permissions ?? []).filter((x) => x.startsWith(RESOURCE_PREFIX)).map((x) => x.slice(RESOURCE_PREFIX.length));

export function setResources(app: OAuthApp, uris: string[]) {
  const unique = [...new Set(uris.map((x) => x.trim()).filter(Boolean))];
  app.permissions = [
    ...(app.permissions ?? []).filter((x) => !x.startsWith(RESOURCE_PREFIX)),
    ...unique.map((x) => RESOURCE_PREFIX + x),
  ];
}

/** Permissions the screen doesn't edit (other endpoints, grant types, scopes), kept as they are */
export const otherPermissions = (app: OAuthApp) =>
  (app.permissions ?? []).filter((x) => !EDITED.has(x) && !DERIVED.includes(x) && !x.startsWith(RESOURCE_PREFIX));

export const requiresPkce = (app: OAuthApp) => (app.requirements ?? []).includes(PKCE);

export function setPkce(app: OAuthApp, on: boolean) {
  const rest = (app.requirements ?? []).filter((x) => x !== PKCE);
  app.requirements = on ? [...rest, PKCE] : rest;
}

const isLoopback = (host: string) =>
  host === "localhost" || host === "[::1]" || /^127(\.\d{1,3}){3}$/.test(host) || host.endsWith(".localhost");

export type UriProblem = "invalid" | "fragment" | "http";

/** Why a redirect URI can't be used: absolute, no fragment, HTTPS unless it is a loopback address (RFC 8252) */
export function uriProblem(uri: string): UriProblem | undefined {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return "invalid";
  }
  if (url.protocol === "file:") return "invalid";
  if (url.hash || uri.includes("#")) return "fragment";
  if (url.protocol === "http:" && !isLoopback(url.hostname)) return "http";
  return undefined;
}

/** The OAuth application with the client id, or undefined when there is none */
export async function findApp(clientId: string): Promise<OAuthApp | undefined> {
  const response = await fetch(`/api/platform/oauthapps/${encodeURIComponent(clientId)}`, {
    headers: { Accept: "application/json" },
  });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return (await response.json()) as OAuthApp;
}

/** Saves the application; a refusal throws with the server's reasons */
export async function saveApp(app: OAuthApp): Promise<OAuthApp> {
  const response = await fetch("/api/platform/oauthapps", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(app),
  });
  const text = await response.text();
  if (!response.ok) {
    let errors: string[] | undefined;
    try {
      errors = (JSON.parse(text) as { errors?: string[] }).errors;
    } catch {
      // not a SecurityResult
    }
    throw new Error(errors?.length ? errors.join(" ") : `${response.status} ${response.statusText}`);
  }
  return JSON.parse(text) as OAuthApp;
}

async function getList<T>(url: string): Promise<T[]> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return (await response.json()) as T[];
}

/** The resources applications can be allowed (MCP endpoints, Authorization:Resources), read again for each blade */
export const oauthResources = () =>
  getList<OAuthResource>("/api/platform/oauthapps/resources").catch(() => [] as OAuthResource[]);
