/**
 * Sign-in methods: the ways a user signs in (the password, external providers, methods modules add such as passkeys) and
 * the user's keys for each. The platform lists them (api/platform/security/sign-in-methods, vc-platform#3144); a module's
 * plugin adds the browser side of its method, as AngularJS modules do with signInMethodService.extendSignInMethod: how to
 * sign in with it on the sign-in page and how to add a key in the profile. The sign-in page shows a method's button once
 * a plugin gives it a signIn; the profile's sign-in methods blade lists every method with the user's keys.
 * Plugins reach it through the app: app.config.globalProperties.$signInMethods, or inject(SIGN_IN_METHODS_KEY).
 * See docs/sign-in-page.md, "Sign-in methods".
 */
import { shallowRef, type App } from "vue";

export interface SignInKey {
  id: string;
  name?: string;
  createdDate?: string;
  modifiedDate?: string;
  /** The method's own state of the key, e.g. a passkey's "BackedUp" */
  state?: string;
}

export interface SignInMethod {
  /** "Password", "External", or a module's own kind */
  kind: string;
  /** The method's id: "Password", "Passkey", an external provider's authentication type */
  name: string;
  displayName?: string;
  logoUrl?: string;
  priority?: number;
  canCreateKey?: boolean;
  canRenameKey?: boolean;
  canDeleteKey?: boolean;
  /** Only in the current user's list */
  keys?: SignInKey[];
}

/** What a module's plugin adds to its method; every member is optional */
export interface SignInMethodExtension {
  /** The method's title, in the UI's language: "Passkeys" (else the platform's display name) */
  title?: () => string;
  /** The sign-in button's caption: "Sign in with a passkey" */
  signInTitle?: () => string;
  /** A Lucide icon for the method and its keys ("lucide-fingerprint"); else the platform's logo, else a key */
  icon?: string;
  /**
   * Signs in on the sign-in page, usually through signIn(parameters) below. Resolves false when the user cancelled
   * (nothing is shown); throws to show an error. The shell then opens the session as after a password.
   */
  signIn?: () => Promise<boolean | void>;
  /** Adds a key for the current user (the profile's "Add"). Resolves false when the user cancelled; throws to show an error */
  createKey?: () => Promise<boolean | void>;
  /** The "Add" button's caption: "Add a passkey" */
  createKeyTitle?: () => string;
  /** One line about a key under its name ("Backed up"); the shell adds the dates */
  describeKey?: (key: SignInKey) => string | undefined;
  /** A Lucide icon for a key ("lucide-cloud" for a synced passkey) */
  keyIcon?: (key: SignInKey) => string | undefined;
}

/** A failed sign-in: the HTTP status and the platform's error code ("user_is_locked_out", "login_failed") */
export class SignInError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
    description?: string,
  ) {
    super(description || code || `HTTP ${status}`);
  }
}

export interface SignInMethods {
  /** Adds the browser side of a method; extending the same name again replaces it */
  extend: (name: string, extension: SignInMethodExtension) => void;
  /** A method's extension (reactive) */
  get: (name: string) => SignInMethodExtension | undefined;
  /**
   * Signs in with a cookie through any grant type of the token endpoint (POST api/platform/security/sign-in), e.g.
   * { grant_type: "passkey", credential }. Throws a SignInError when the platform refuses.
   */
  signIn: (parameters: Record<string, string>) => Promise<void>;
}

/** The injection key module plugins use: inject(SIGN_IN_METHODS_KEY) */
export const SIGN_IN_METHODS_KEY = "adminShell.signInMethods";

declare module "vue" {
  interface ComponentCustomProperties {
    $signInMethods: SignInMethods;
  }
}

const extensions = shallowRef(new Map<string, SignInMethodExtension>());

export const signInMethods: SignInMethods = {
  extend(name, extension) {
    extensions.value = new Map(extensions.value).set(name, extension);
  },
  get: (name) => extensions.value.get(name),
  async signIn(parameters) {
    const response = await fetch("/api/platform/security/sign-in", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(parameters),
    });
    if (response.ok) return;
    const body = (await response.json().catch(() => undefined)) as
      { code?: string; error?: string; description?: string; error_description?: string } | undefined;
    throw new SignInError(response.status, body?.code ?? body?.error, body?.description ?? body?.error_description);
  },
};

async function getJson<T>(url: string): Promise<T | undefined> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  // a platform without sign-in methods (before 3.1091) answers 404: the shell then keeps its own sign-in buttons
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return (await response.json()) as T;
}

/** The methods the installation offers (anonymous), or undefined on a platform without sign-in methods */
export const loadSignInMethods = () => getJson<SignInMethod[]>("/api/platform/security/sign-in-methods");

/** The current user's methods with their keys, or undefined on a platform without sign-in methods */
export const loadUserSignInMethods = () =>
  getJson<SignInMethod[]>("/api/platform/security/currentuser/sign-in-methods");

const keyUrl = (method: SignInMethod, key: SignInKey) =>
  `/api/platform/security/currentuser/sign-in-methods/${encodeURIComponent(method.name)}/keys/${encodeURIComponent(key.id)}`;

/** The identity errors of a refused rename or delete ("You can't delete your only sign-in key") */
async function ensureOk(response: Response) {
  if (response.ok) return;
  const body = (await response.json().catch(() => undefined)) as { errors?: { description?: string }[] } | undefined;
  const message = body?.errors
    ?.map((e) => e.description)
    .filter(Boolean)
    .join("\n");
  throw new Error(message || `${response.status} ${response.statusText}`);
}

export async function renameSignInKey(method: SignInMethod, key: SignInKey, name: string) {
  await ensureOk(
    await fetch(keyUrl(method, key), {
      method: "PUT",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
  );
}

export async function deleteSignInKey(method: SignInMethod, key: SignInKey) {
  await ensureOk(await fetch(keyUrl(method, key), { method: "DELETE", headers: { Accept: "application/json" } }));
}

/** Makes sign-in methods available to module plugins; called once from main.ts */
export function installSignInMethods(app: App) {
  app.provide(SIGN_IN_METHODS_KEY, signInMethods);
  app.config.globalProperties.$signInMethods = signInMethods;
}
