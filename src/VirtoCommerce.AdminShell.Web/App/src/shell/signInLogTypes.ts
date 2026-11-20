/**
 * Sign-in types for the sign-in log's Type filter and column, as the AngularJS admin's platformWebApp.signInLogTypes
 * registry: the platform's own types (SignInType in VirtoCommerce.Platform.Core), the types of the modules the shell
 * knows (shown only while the module is installed), and what a module's plugin adds through the app it is installed
 * into: app.config.globalProperties.$signInLogTypes.register({ value: "Punchout", label: "PUNCHOUT.SIGN_IN_TYPE" }),
 * or inject(SIGN_IN_LOG_TYPES_KEY). A type the log holds that nobody registered still shows, by its value.
 */
import { shallowRef, type App } from "vue";

export interface SignInLogType {
  /** What the log stores: UserSignInLog.SignInType ("Password", "Passkey") */
  value: string;
  /** A translation key or text */
  label: string;
  /** The module that writes it: the type is offered only while that module is installed */
  moduleId?: string;
}

const T = "PLATFORM.SECURITY.SIGNIN.TYPES.";

/** The platform's types, then the ones of the platform's own sign-in modules (their ModuleConstants.SignInType) */
export const KNOWN_SIGN_IN_TYPES: SignInLogType[] = [
  { value: "Password", label: `${T}PASSWORD` },
  { value: "External", label: `${T}EXTERNAL` },
  { value: "Impersonation", label: `${T}IMPERSONATION` },
  { value: "ImpersonationRevert", label: `${T}IMPERSONATION_REVERT` },
  { value: "ClientCredentials", label: `${T}CLIENT_CREDENTIALS` },
  { value: "Logout", label: `${T}LOGOUT` },
  { value: "Passkey", label: `${T}PASSKEY`, moduleId: "VirtoCommerce.Passkeys" },
  { value: "OTP", label: `${T}OTP`, moduleId: "VirtoCommerce.OTP" },
  { value: "MFA", label: `${T}MFA`, moduleId: "VirtoCommerce.MFA" },
];

/**
 * The types to offer: the known and registered ones whose module is installed (a registered type replaces a known one
 * of the same value), in that order
 */
export function availableSignInTypes(registered: SignInLogType[], isInstalled: (moduleId: string) => boolean) {
  const byValue = new Map<string, SignInLogType>();
  for (const type of [...KNOWN_SIGN_IN_TYPES, ...registered]) byValue.set(type.value.toLowerCase(), type);
  return [...byValue.values()].filter((type) => !type.moduleId || isInstalled(type.moduleId));
}

/** A type's label: its registered one, else the value as the log stores it */
export function signInTypeLabel(value: string | undefined, types: SignInLogType[]) {
  if (!value) return { label: "", known: false };
  const type = types.find((x) => x.value.toLowerCase() === value.toLowerCase());
  return type ? { label: type.label, known: true } : { label: value, known: false };
}

export interface SignInLogTypes {
  /** Adds a type, or replaces the one with the same value */
  register: (type: SignInLogType) => void;
  /** The registered types (the shell's known ones are not in it) */
  getTypes: () => SignInLogType[];
}

/** The injection key module plugins use: inject(SIGN_IN_LOG_TYPES_KEY) */
export const SIGN_IN_LOG_TYPES_KEY = "adminShell.signInLogTypes";

declare module "vue" {
  interface ComponentCustomProperties {
    $signInLogTypes: SignInLogTypes;
  }
}

/** The types plugins registered, reactive: a plugin that loads later still reaches an open sign-in log */
export const registeredSignInTypes = shallowRef<SignInLogType[]>([]);

export const signInLogTypes: SignInLogTypes = {
  register(type) {
    const others = registeredSignInTypes.value.filter((x) => x.value.toLowerCase() !== type.value.toLowerCase());
    registeredSignInTypes.value = [...others, type];
  },
  getTypes: () => registeredSignInTypes.value,
};

/** Makes the registry available to module plugins; called once from main.ts */
export function installSignInLogTypes(app: App) {
  app.provide(SIGN_IN_LOG_TYPES_KEY, signInLogTypes);
  app.config.globalProperties.$signInLogTypes = signInLogTypes;
}
