/**
 * Global search: a registry of search providers queried from the header search box (Ctrl+K / ⌘K) and the phone's
 * search sheet. The shell does not know what a module can find: each module registers its providers, and the box shows
 * the answers of all of them grouped by provider. The same design as the AngularJS admin's globalSearchService
 * (vc-platform docs/developer-guide/global-search.md); this repo's docs/global-search.md is the guide for the shell.
 *
 *   globalSearch.registerProvider({
 *     id: "orders",                          // unique id; registering it again replaces the provider
 *     title: "ORDERS.SEARCH.GROUP_TITLE",    // group title (translation key or text); its translation is an alias too
 *     order: 100,                            // group position, lower first (shell: 10-50, modules: 100+)
 *     permission: "order:read",              // provider skipped without it (string or array: any of)
 *     isAvailable: () => true,               // extra check: false when the user has nothing to find here
 *     minLength: 2,                          // shortest query the provider answers (default 1)
 *     delay: 250,                            // extra wait after the debounce, for providers that call an API
 *     aliases: ["order", "orders"],          // "order: CO123" searches this provider only
 *     match: /^CO\d{3,}/i,                   // a query like this puts the group first
 *     search: (query, context) => fetch(..., { signal: context.signal }).then(...),
 *   });
 */
import { shallowRef } from "vue";
import { goTo, openBlade, openLegacy, waitFor } from "./navigation";

export type Permission = string | string[] | undefined;

export interface SearchContext {
  /** How many items to return: 8, or 20 when the user scoped the search with an alias */
  take: number;
  /** Aborted when the search is superseded (the user typed on): pass it to fetch */
  signal: AbortSignal;
  /** The user typed this provider's alias, so its group is the only one shown */
  scoped: boolean;
}

export interface SearchItem {
  id: string;
  /** First line; the query words are highlighted */
  title: string;
  /** Second line (customer · store, email · type, …) */
  description?: string;
  /** A vc-shell icon name (lucide-*, fas fa-*, material-*) */
  icon?: string;
  /** An image instead of the icon, e.g. a product thumbnail */
  iconUrl?: string;
  /** A short status pill on the right (New, Paid) */
  badge?: string;
  /** A short right-aligned value (120.50 USD, a date) */
  meta?: string;
  /** The item is dropped unless the user has it */
  permission?: Permission;
  /** Shows an external-link mark (results that open a tab of their own) */
  external?: boolean;
  /** Runs on click or Enter; the search box closes first */
  execute: () => unknown;
}

export interface SearchAnswer {
  items: SearchItem[];
  /** How many the server found: with showAll, adds a "Show all {total}" row when there are more than shown */
  total?: number;
  showAll?: () => unknown;
}

export type SearchResult = SearchItem[] | SearchAnswer | null | undefined;

export interface SearchProvider {
  id: string;
  title: string;
  /** An icon for the group in the box's "Search in" list (a vc-shell icon name) */
  icon?: string;
  order?: number;
  permission?: Permission;
  isAvailable?: () => boolean;
  minLength?: number;
  delay?: number;
  aliases?: string[];
  match?: RegExp | ((query: string) => boolean);
  search: (query: string, context: SearchContext) => SearchResult | Promise<SearchResult>;
}

export type GroupStatus = "pending" | "done" | "error";

export interface SearchGroup {
  provider: SearchProvider;
  title: string;
  status: GroupStatus;
  items: SearchItem[];
  total: number | null;
  showAll: (() => unknown) | null;
}

export interface SearchRun extends Promise<SearchGroup[]> {
  cancel: () => void;
}

const DEFAULT_TAKE = 8;
const SCOPED_TAKE = 20;
const PROVIDER_TIMEOUT = 8000;

// the providers, in display order; a ref so the box and its "Search in" list follow registrations (module plugins
// register theirs when they load, after the box is on screen)
const providers = shallowRef<SearchProvider[]>([]);

// bound by the shell once the user and i18n are there (configureGlobalSearch); until then everything is allowed
let permissionCheck: (permission: string[]) => boolean = () => true;
let translator: (keyOrText: string) => string = (x) => x;

export function configureGlobalSearch(options: {
  hasPermission: (permission: string[]) => boolean;
  translate: (keyOrText: string) => string;
}) {
  permissionCheck = options.hasPermission;
  translator = options.translate;
}

function hasPermission(permission: Permission): boolean {
  if (!permission || (Array.isArray(permission) && !permission.length)) return true;
  const list = Array.isArray(permission) ? permission : [permission];
  return list.some((p) => permissionCheck([p]));
}

function translate(keyOrText?: string): string {
  if (!keyOrText) return "";
  return translator(keyOrText) || keyOrText;
}

// A provider takes part when the user has its permission and it reports something to search
function isUsable(provider: SearchProvider) {
  try {
    return hasPermission(provider.permission) && (!provider.isAvailable || provider.isAvailable());
  } catch {
    return false;
  }
}

const SEPARATOR = /[\s\-_./>|·:@]/;

// Match score of a text against the query words: every word must be found.
// Whole-text prefix > word prefix > substring.
function scoreText(text: unknown, words: string[]): number {
  if (text === null || text === undefined || text === "") return 0;
  const value = String(text).toLowerCase();
  let total = 0;
  for (const word of words) {
    const index = value.indexOf(word);
    if (index < 0) return 0;
    if (index === 0) total += 3;
    else if (SEPARATOR.test(value.charAt(index - 1))) total += 2;
    else total += 1;
  }
  return total;
}

const wordsOf = (query: string) => query.toLowerCase().split(/\s+/).filter(Boolean);

/**
 * Filters and orders client-side items: every query word must appear; whole-text prefix beats word prefix beats
 * substring; earlier fields weigh more. fields(item) returns the searchable texts, most important first. Also useful to
 * re-order API results that come back in the server's own order.
 */
function rankItems<T>(items: readonly T[], query: string, fields: (item: T) => unknown[], take = DEFAULT_TAKE): T[] {
  const words = wordsOf(query);
  if (!words.length) return [];
  const ranked: { item: T; score: number; index: number }[] = [];
  items.forEach((item, index) => {
    const texts = fields(item);
    let best = 0;
    // all words in one field, or spread over the fields
    texts.forEach((text, i) => {
      const score = scoreText(text, words);
      if (score) best = Math.max(best, score * (texts.length - i));
    });
    if (!best && scoreText(texts.filter((x) => x !== null && x !== undefined).join(" "), words)) best = 1;
    if (best) ranked.push({ item, score: best, index });
  });
  // equal scores keep the source order (a server's relevance, a menu's order)
  ranked.sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked.slice(0, take).map((x) => x.item);
}

// The words that scope a search to one provider ("orders: CO123"): its aliases and its translated title
function aliasesOf(provider: SearchProvider) {
  return [...(provider.aliases ?? []), translate(provider.title)].filter(Boolean).map((x) => x.toLowerCase());
}

/** "alias: text" → { text, scope: [providers] } when the alias belongs to a provider; the plain query otherwise */
function parseQuery(query: string): { text: string; scope: SearchProvider[] | null; alias?: string } {
  const text = (query ?? "").trim();
  const parts = /^([^:\s][^:]{0,40}?)\s*:\s*(.*)$/.exec(text);
  if (parts) {
    const alias = parts[1].toLowerCase();
    const scope = providers.value.filter((p) => aliasesOf(p).includes(alias));
    if (scope.length) return { text: parts[2].trim(), scope, alias: parts[1] };
  }
  return { text, scope: null };
}

function matchesPattern(provider: SearchProvider, text: string) {
  if (!provider.match) return false;
  try {
    return typeof provider.match === "function" ? !!provider.match(text) : provider.match.test(text);
  } catch {
    return false;
  }
}

// A provider answer: an array of items or { items, total, showAll }
function normalize(answer: SearchResult, take: number) {
  const result: SearchAnswer = Array.isArray(answer) || !answer ? { items: answer ?? [] } : answer;
  const items = (result.items ?? []).filter((item) => item && hasPermission(item.permission));
  return {
    items: items.slice(0, take),
    total: typeof result.total === "number" ? result.total : null,
    showAll: typeof result.showAll === "function" ? result.showAll : null,
  };
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (!ms) return resolve();
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });

/**
 * Runs every usable provider. Groups are reported through onGroup(groups) as each provider answers, in display order;
 * a group that timed out is reported again if its answer still comes while the search is current.
 * The promise resolves with the groups that found something once all are done. only: the ids of the providers to ask
 * (a retry of one group); all of them otherwise. A provider that fails or takes longer
 * than 8 seconds ends as "error" instead of failing the whole search. run.cancel() stops it: pending delays are
 * dropped, the providers' signal aborts, late answers are ignored.
 */
function search(
  query: string,
  options: { onGroup?: (groups: SearchGroup[]) => void; take?: number; only?: string[] } = {},
): SearchRun {
  const parsed = parseQuery(query);
  const text = parsed.text;
  const controller = new AbortController();
  const context: SearchContext = {
    take: options.take ?? (parsed.scope ? SCOPED_TAKE : DEFAULT_TAKE),
    signal: controller.signal,
    scoped: !!parsed.scope,
  };

  let usable = (parsed.scope ?? providers.value).filter(
    (p) => text.length >= (p.minLength ?? 1) && isUsable(p) && (!options.only || options.only.includes(p.id)),
  );
  // providers whose pattern matches the query come first; the rest keep their order
  const matched = usable.filter((p) => matchesPattern(p, text));
  usable = [...matched, ...usable.filter((p) => !matched.includes(p))];

  const groups: SearchGroup[] = usable.map((provider) => ({
    provider,
    title: translate(provider.title),
    status: "pending",
    items: [],
    total: null,
    showAll: null,
  }));
  const report = () => {
    if (!controller.signal.aborted) options.onGroup?.(groups.map((g) => ({ ...g })));
  };

  const calls = groups.map(async (group) => {
    const provider = group.provider;
    await sleep(provider.delay ?? 0, controller.signal);
    if (controller.signal.aborted) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<{ status: GroupStatus; timedOut: true }>((resolve) => {
      timer = setTimeout(() => resolve({ status: "error", timedOut: true }), PROVIDER_TIMEOUT);
    });
    const answer = Promise.resolve()
      .then(() => provider.search(text, context))
      .then((found) => ({ status: "done" as GroupStatus, ...normalize(found, context.take) }))
      .catch((error) => {
        if (!controller.signal.aborted) console.warn(`[global-search] provider "${provider.id}" failed`, error);
        return { status: "error" as GroupStatus };
      });
    const result = await Promise.race([answer, timeout]);
    clearTimeout(timer);
    if (controller.signal.aborted) return;
    const { timedOut, ...state } = { timedOut: false, ...result };
    Object.assign(group, state);
    report();
    // a group that took too long shows as failed, but its answer still counts while the search is the current one
    // (a server can be slow once, e.g. on the first request after idle); a superseded search ignores it
    if (timedOut) {
      answer.then((late) => {
        if (controller.signal.aborted || late.status !== "done") return;
        Object.assign(group, late);
        report();
      });
    }
  });

  report();
  const promise = Promise.all(calls).then(() =>
    groups.filter((g) => g.status === "done" && g.items.length),
  ) as SearchRun;
  promise.cancel = () => controller.abort();
  return promise;
}

function registerProvider(provider: SearchProvider) {
  if (!provider?.id || typeof provider.search !== "function") {
    throw new Error("A search provider needs an id and a search function");
  }
  providers.value = [...providers.value.filter((p) => p.id !== provider.id), provider].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );
}

function unregisterProvider(id: string) {
  providers.value = providers.value.filter((p) => p.id !== id);
}

export const globalSearch = {
  registerProvider,
  unregisterProvider,
  /** The registered providers, in order */
  getProviders: () => providers.value.slice(),
  /** The providers the current user can search, in order (the box's "Search in" list) */
  usableProviders: () => providers.value.filter(isUsable),
  /** true when at least one provider is usable for the current user; the search box is hidden otherwise */
  isAvailable: () => providers.value.some(isUsable),
  aliasesOf,
  search,
  rankItems,
  hasPermission,
  translate,
  parseQuery,
  // opening a result (navigation.ts), here for module plugins, which can't import the shell's code: a Vue screen
  // (openBlade), an AngularJS one in the embedded admin (openLegacy), any shell route (goTo)
  openBlade,
  openLegacy,
  goTo,
  waitFor,
};

export type GlobalSearch = typeof globalSearch;

/** Splits a text into parts with the query words marked, for highlighting without v-html */
export function highlight(text: string | undefined, query: string): { text: string; mark: boolean }[] {
  const value = text ?? "";
  const words = wordsOf(query).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length || !value) return [{ text: value, mark: false }];
  // a split on a capturing group puts the matches at the odd places
  return value
    .split(new RegExp(`(${words.join("|")})`, "i"))
    .map((part, index) => ({ text: part, mark: index % 2 === 1 }))
    .filter((part) => part.text !== "");
}
