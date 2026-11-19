import type { GlobalFilterConfig, SearchBarField } from "@vc-shell/framework";

/**
 * A table's filters for its search bar. VcDataTable hands its global filters to the bar as they are, but still types them
 * as the older filters, without toggles.
 * ponytail: drop once VcDataTable's globalFilters takes SearchBarField[].
 */
export const tableFilters = (fields: SearchBarField[]) => fields as GlobalFilterConfig[];

/**
 * A date range filter's days as the instants a search takes: from the start of the first day to the end of the last, in
 * the user's time zone. The bar sends whole days ("2026-11-10"), which `new Date` would read as UTC midnight, cutting
 * the last day off.
 */
export function dayRange(start?: unknown, end?: unknown) {
  const day = (x: unknown, endOfDay: boolean) => {
    if (typeof x !== "string" || !x) return undefined;
    const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(x);
    if (!ymd) return new Date(x);
    const [y, m, d] = ymd.slice(1).map(Number);
    return endOfDay ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d);
  };
  return { from: day(start, false), to: day(end, true) };
}
