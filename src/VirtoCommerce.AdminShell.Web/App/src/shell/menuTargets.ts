import type { MenuItem } from "../api/adminMenu";

/** "/workspace/Inventory/" and "/workspace/inventory" are one classic screen */
export const normalizeLegacyUrl = (url?: string | null) => (url ?? "").replace(/\/+$/, "").toLowerCase();

/**
 * Whether a menu item stands for the classic (AngularJS) screen at this address: the one it opens, or the one its
 * plugin's Vue screen took over (fallback), so a link or deep link to the classic screen still finds its section.
 */
export function opensLegacy(item: Pick<MenuItem, "target" | "fallback">, url?: string | null) {
  const address = normalizeLegacyUrl(url);
  if (!address) return false;
  return [item.target, item.fallback].some(
    (target) => target?.type === "legacy" && normalizeLegacyUrl(target.legacyUrl) === address,
  );
}
