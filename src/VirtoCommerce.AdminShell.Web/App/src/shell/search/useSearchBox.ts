import { notification } from "@vc-shell/framework";
import { computed, onBeforeUnmount, ref, shallowRef } from "vue";
import { globalSearch, type SearchGroup, type SearchItem, type SearchProvider, type SearchRun } from "./globalSearch";

const DEBOUNCE = 150;

/** A row the arrow keys move through: an item, or a group's "Show all" row */
export interface SearchEntry {
  key: string;
  group: SearchGroup;
  item?: SearchItem;
  showAll?: boolean;
}

/**
 * One search box's state, shared by the header's dropdown and the phone's sheet: the query, the groups as they arrive,
 * the highlighted row and the keys. The highlighted row is kept by key, so it stays on the same item while later groups
 * arrive; a group keeps its place (provider order), so the list doesn't jump.
 */
/** Why the box closes: Escape (the user stays where they were) or a result chosen (the shell moves on) */
export type SearchCloseReason = "escape" | "select";

export function useSearchBox(options: { onClose?: (reason: SearchCloseReason) => void } = {}) {
  const query = ref("");
  const groups = shallowRef<SearchGroup[]>([]);
  const loading = ref(false);
  const activeKey = ref<string>();
  // the query the shown groups answer (highlighting uses it, without the alias)
  const answered = ref("");

  // the search on screen, until the next one or a cancel (a group that timed out can still answer late)
  let current: SearchRun | undefined;
  // retries of single groups; a new search drops them
  let retries: SearchRun[] = [];
  let debounce: ReturnType<typeof setTimeout> | undefined;

  const parsed = computed(() => globalSearch.parseQuery(query.value));
  /** The providers the user can search, for the "Search in" list */
  const scopes = computed(() => globalSearch.usableProviders());
  /** The group the query is scoped to ("orders: …"), if any */
  const scope = computed(() => (parsed.value.scope?.length === 1 ? parsed.value.scope[0] : undefined));

  const entries = computed<SearchEntry[]>(() =>
    groups.value.flatMap((group) => [
      ...group.items.map((item) => ({ key: `${group.provider.id}\u0000${item.id}`, group, item })),
      ...(hasShowAll(group) ? [{ key: `${group.provider.id}\u0000*`, group, showAll: true }] : []),
    ]),
  );
  const active = computed(() => entries.value.find((x) => x.key === activeKey.value));

  const hasShowAll = (group: SearchGroup) =>
    group.status === "done" && !!group.showAll && group.total !== null && group.total > group.items.length;

  // shown: pending and failed groups keep their place, empty finished ones are left out
  function apply(next: SearchGroup[]) {
    groups.value = next.filter((g) => g.status !== "done" || g.items.length);
    loading.value = next.some((g) => g.status === "pending");
    if (!entries.value.some((x) => x.key === activeKey.value)) activeKey.value = entries.value[0]?.key;
  }

  function cancel() {
    clearTimeout(debounce);
    current?.cancel();
    current = undefined;
    retries.forEach((x) => x.cancel());
    retries = [];
  }

  function run() {
    cancel();
    const text = query.value.trim();
    activeKey.value = undefined;
    answered.value = parsed.value.text;
    if (!text || (parsed.value.scope && !parsed.value.text)) {
      groups.value = [];
      loading.value = false;
      return;
    }
    loading.value = true;
    // the first report comes before search() returns (the groups, all pending, and what client-side providers found)
    let request: SearchRun | undefined = undefined;
    request = globalSearch.search(text, {
      onGroup: (next) => {
        if (!request || current === request) apply(next);
      },
    });
    current = request;
    request.finally(() => {
      if (current === request) loading.value = false;
    });
  }

  /** Asks a failed group's provider again; the other groups stay as they are */
  function retry(group: SearchGroup) {
    const id = group.provider.id;
    const merge = (next?: SearchGroup) =>
      apply(groups.value.map((g) => (g.provider.id === id ? (next ?? { ...g, status: "error" }) : g)));
    merge({ ...group, status: "pending" });
    let request: SearchRun | undefined = undefined;
    request = globalSearch.search(query.value.trim(), {
      only: [id],
      onGroup: (next) => {
        if (!request || retries.includes(request)) merge(next[0]);
      },
    });
    retries.push(request);
  }

  /** The input changed: search after a short pause in typing */
  function onInput() {
    clearTimeout(debounce);
    debounce = setTimeout(run, DEBOUNCE);
  }

  function clear() {
    query.value = "";
    run();
  }

  async function select(entry?: SearchEntry) {
    if (!entry) return;
    cancel();
    query.value = "";
    groups.value = [];
    loading.value = false;
    options.onClose?.("select");
    try {
      await (entry.showAll ? entry.group.showAll?.() : entry.item?.execute());
    } catch (error) {
      notification.error(globalSearch.translate("SHELL.SEARCH.OPEN_FAILED"), { timeout: 5000 });
      console.warn("[global-search] opening a result failed", error);
    }
  }

  function move(step: number) {
    const list = entries.value;
    if (!list.length) return;
    const index = list.findIndex((x) => x.key === activeKey.value);
    activeKey.value = list[(index + step + list.length) % list.length].key;
  }

  /** Highlights a row (the pointer moved onto it) */
  function setActive(key: string) {
    if (activeKey.value !== key) activeKey.value = key;
  }

  /** "orders: " in the box: the next words search that group only */
  function scopeTo(provider: SearchProvider) {
    const alias = provider.aliases?.[0] ?? globalSearch.translate(provider.title);
    query.value = `${alias}: ${parsed.value.scope ? parsed.value.text : query.value.trim()}`.replace(/\s+$/, " ");
    run();
  }

  /** Leaves the scope, keeping the words */
  function unscope() {
    query.value = parsed.value.text;
    run();
  }

  /** Keys of the input: arrows move, Enter opens, Escape clears then closes. Returns true when it handled the key. */
  function onKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(1);
        return true;
      case "ArrowUp":
        event.preventDefault();
        move(-1);
        return true;
      case "Enter":
        event.preventDefault();
        select(active.value);
        return true;
      case "Escape":
        event.preventDefault();
        if (query.value) clear();
        else options.onClose?.("escape");
        return true;
      default:
        return false;
    }
  }

  onBeforeUnmount(cancel);

  return {
    query,
    groups,
    loading,
    answered,
    entries,
    activeKey,
    active,
    parsed,
    scope,
    scopes,
    hasShowAll,
    onInput,
    onKeydown,
    clear,
    select,
    move,
    setActive,
    retry,
    scopeTo,
    unscope,
    run,
  };
}

export type SearchBox = ReturnType<typeof useSearchBox>;
