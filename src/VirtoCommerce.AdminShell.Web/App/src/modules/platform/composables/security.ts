import { ref, type Ref } from "vue";
import { SecurityClient, useApiClient, useLatestRequest, type Permission, type Role } from "@vc-shell/framework";
import { api, platformTranslations, settingValues } from "../api";

export interface Option {
  id: string;
  title: string;
}

const toOptions = (values?: unknown[] | null): Option[] => (values ?? []).map((x) => ({ id: String(x), title: String(x) }));

/** Throws the identity errors of a SecurityResult / IdentityResult that didn't succeed. */
export function ensureSucceeded(result?: { succeeded?: boolean; errors?: (string | { description?: string })[] }) {
  if (result && result.succeeded === false) {
    throw new Error((result.errors ?? []).map((e) => (typeof e === "string" ? e : e.description)).join("\n") || "Failed");
  }
}

/** The password policy check legacy runs while typing (validateuserpassword); a newer check wins over a slower older one. */
export function usePasswordCheck(userName: () => string | undefined, password: Ref<string>) {
  const { getApiClient } = useApiClient(SecurityClient);
  const latest = useLatestRequest();
  const errors = ref<string>();

  async function check() {
    if (!password.value) {
      latest.invalidate();
      errors.value = undefined;
      return;
    }
    const client = await getApiClient();
    const result = await latest.latest(client.validateUserPassword({ userName: userName(), newPassword: password.value }));
    if (result) errors.value = result.succeeded ? undefined : (result.errors ?? []).map((e) => e.description).join(" ");
  }

  return { errors, check };
}

export type CatalogPermission = Permission & { description: string };

let permissionCatalog: Promise<CatalogPermission[]> | undefined;

/** The registered permissions with their descriptions (platform translations); they change only with a restart, so loaded once. */
export function registeredPermissions(client: SecurityClient): Promise<CatalogPermission[]> {
  permissionCatalog ??= Promise.all([client.getAllRegisteredPermissions(), platformTranslations()]).then(([all, translations]) => {
    const descriptions = (translations.permissions ?? {}) as Record<string, string>;
    return (all ?? []).map((p) => ({ ...p, description: descriptions[p.name!] ?? "" }));
  });
  permissionCatalog.catch(() => (permissionCatalog = undefined));
  return permissionCatalog;
}

/** Account types, statuses and roles for the user list filters and the user form (legacy reads the same settings). */
export function useSecurityLookups() {
  const { getApiClient: security } = useApiClient(SecurityClient);

  const accountTypes = ref<Option[]>([]);
  const accountStatuses = ref<Option[]>([]);
  const defaultAccountType = ref<string>();
  const defaultAccountStatus = ref<string>();
  const roles = ref<Role[]>([]);

  async function load() {
    const securityClient = await security();
    const [types, statuses, defaultType, defaultStatus, roleResult] = await Promise.all([
      settingValues("VirtoCommerce.Platform.Security.AccountTypes"),
      settingValues("VirtoCommerce.Other.AccountStatuses"),
      // defaults to the account types' own default, which legacy read
      settingValues("VirtoCommerce.Platform.Security.DefaultAccountType"),
      settingValues("VirtoCommerce.Platform.Security.DefaultAccountStatus"),
      // legacy asks for takeCount (ignored, so it only ever shows 20 roles); take is the real field
      securityClient.searchRoles({ take: 1000, sort: "name:asc" }),
    ]);
    accountTypes.value = toOptions(types);
    accountStatuses.value = toOptions(statuses);
    defaultAccountType.value = defaultType?.[0] != null ? String(defaultType[0]) : undefined;
    defaultAccountStatus.value = defaultStatus?.[0] != null ? String(defaultStatus[0]) : undefined;
    roles.value = roleResult.results ?? [];
  }

  return { accountTypes, accountStatuses, defaultAccountType, defaultAccountStatus, roles, load };
}

// ---- sign-in log (not in the framework's platform client) ----

export interface UserSignInLog {
  id: string;
  createdDate: string;
  userName?: string;
  userId?: string;
  succeeded: boolean;
  failureReason?: string;
  signInType?: string;
  provider?: string;
  operatorUserId?: string;
  operatorUserName?: string;
  ipAddress?: string;
  host?: string;
  userAgent?: string;
  clientId?: string;
  sessionId?: string;
  storeId?: string;
  storeName?: string;
  memberId?: string;
  organizationId?: string;
  organizationName?: string;
}

export interface SignInLogCriteria {
  keyword?: string;
  userId?: string;
  succeeded?: boolean;
  signInTypes?: string[];
  failureReasons?: string[];
  ipAddress?: string;
  storeId?: string;
  withoutStore?: boolean;
  startDate?: string;
  endDate?: string;
  sort?: string;
  skip?: number;
  take?: number;
}

export interface KeyCount {
  key: string;
  count: number;
}

export interface SignInLogStats {
  recordingEnabled: boolean;
  totalCount: number;
  failedCount: number;
  distinctUserCount: number;
  impersonationCount: number;
  previousTotalCount?: number | null;
  previousFailedCount?: number | null;
  previousDistinctUserCount?: number | null;
  previousImpersonationCount?: number | null;
  topFailedIpAddresses: KeyCount[];
  topFailedUserNames: KeyCount[];
  failureReasonBreakdown: KeyCount[];
  signInsByOrganization: KeyCount[];
  signInsByStore: KeyCount[];
}

export const signInLogApi = {
  search: (criteria: SignInLogCriteria) =>
    api<{ totalCount: number; results: UserSignInLog[] }>("POST", "/api/platform/security/sign-in-log/search", criteria),
  stats: (criteria: SignInLogCriteria) => api<SignInLogStats>("POST", "/api/platform/security/sign-in-log/stats", criteria),
};
