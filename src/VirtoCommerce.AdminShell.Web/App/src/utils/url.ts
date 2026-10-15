/**
 * A URL from a module manifest or the platform, usable from the shell's pages (they live under /apps/admin-shell/): a
 * site-relative one ("Modules/$(VirtoCommerce.News)/Content/logo.svg") gets its leading "/"; an absolute one (a path,
 * //host, or a scheme such as https: or data:) stays as it is. No URL is undefined.
 */
export function rootedUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  return /^([a-z][a-z\d+.-]*:|\/)/i.test(url) ? url : `/${url}`;
}
