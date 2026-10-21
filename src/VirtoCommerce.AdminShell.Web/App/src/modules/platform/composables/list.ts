import { useDataTablePagination, useFunctions } from "@vc-shell/framework";
import { ref, watch, type WatchSource } from "vue";

/** Rows per page of the platform screens' lists */
export const PAGE_SIZE = 20;

/**
 * A searchable, paged list: its keyword, total and pagination (the URL keeps the page). A new keyword, or a change of
 * `resetOn` (the filters), goes back to the first page; the keyword, the page, `resetOn` and `reloadOn` (the sort) load
 * the list again 300 ms after the last change. `load` reads `keyword`, `pagination.skip` and PAGE_SIZE and sets `totalCount`.
 */
export function useSearchableList(options: {
  stateKey: string;
  load: () => unknown;
  /** the keyword it opens with (global search's "Show all") */
  keyword?: string;
  resetOn?: WatchSource[];
  reloadOn?: WatchSource[];
}) {
  const { debounce } = useFunctions();
  const keyword = ref(options.keyword ?? "");
  const totalCount = ref(0);
  const pagination = useDataTablePagination({ stateKey: options.stateKey, pageSize: PAGE_SIZE, totalCount });
  const resetOn = options.resetOn ?? [];

  watch([keyword, ...resetOn], () => pagination.setPage(1));
  watch(
    [keyword, ...resetOn, ...(options.reloadOn ?? []), () => pagination.skip],
    debounce(() => options.load(), 300),
  );

  return { keyword, totalCount, pagination };
}
