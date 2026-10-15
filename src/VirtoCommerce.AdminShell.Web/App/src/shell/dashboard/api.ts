// Platform and module endpoints used by the host's dashboard widgets (same-origin, cookie auth).
import { DiagnosticsClient, type SystemInfo } from "@vc-shell/framework";
import { request } from "../../api/http";

export type { SystemInfo };

export const postJson = <T>(url: string, body: unknown) => request<T>("POST", url, body);

let systemInfoRequest: Promise<SystemInfo> | undefined;

/** The platform's build, license and installed modules, once per page load. */
export function systemInfo(): Promise<SystemInfo> {
  systemInfoRequest ??= new DiagnosticsClient().getSystemInfo();
  systemInfoRequest.catch(() => (systemInfoRequest = undefined));
  return systemInfoRequest;
}

export const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

/**
 * A date as the platform's search criteria take it: UTC without the "Z". ASP.NET would bind a "Z" date into server-local
 * time, moving it by the server's UTC offset (porting guide, gotcha 6).
 */
export const criteriaDate = (date: Date) => date.toISOString().replace("Z", "");

/** "Oct 12, 4:15 PM" (the design's alert/announcement timestamp). */
export const formatWhen = (value?: string | Date) =>
  value ? new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
