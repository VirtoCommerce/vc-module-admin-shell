/**
 * Modules that failed to start, for the notice above the screens (ModuleErrorsNotice.vue). The Modules counters fill
 * the list (modules/platform/counters.ts) when they read the module catalog: on sign-in and every minute, for users with
 * platform:module:access only. Hiding the notice lasts until the page reloads, the next sign-in or another module fails.
 */
import { ref, shallowRef } from "vue";

export interface FailedModule {
  id: string;
  title: string;
  version?: string;
  errors: string[];
}

export const failedModules = shallowRef<FailedModule[]>([]);

/** The failures a notice stands for: the same modules failing again keep a hidden notice hidden, a new one shows it */
export const failureKey = (modules: FailedModule[]) =>
  modules
    .map((m) => m.id)
    .sort((a, b) => a.localeCompare(b))
    .join(",");

/** The first line of a module's error, which says what went wrong (the rest is the stack trace) */
export const firstLine = (error?: string) => (error ?? "").split(/\r?\n/)[0].trim();

/** "System Operations: Method not found…", or "System Operations, Catalog and 2 more" for several */
export function failureSummary(modules: FailedModule[], more: (count: number) => string) {
  if (modules.length === 1) {
    const reason = firstLine(modules[0].errors[0]);
    return reason ? `${modules[0].title}: ${reason}` : modules[0].title;
  }
  const shown = modules.slice(0, 2).map((m) => m.title);
  return modules.length > 2 ? `${shown.join(", ")} ${more(modules.length - 2)}` : shown.join(", ");
}

/** What the copy button puts on the clipboard: the notice's title, then each module with its full errors */
export function failureReport(modules: FailedModule[], title: string) {
  const parts = modules.map((m) =>
    [`${m.title} (${[m.id, m.version].filter(Boolean).join(" ")})`, ...m.errors.map((e) => e.trim())].join("\n"),
  );
  return [title, ...parts].join("\n\n");
}

/**
 * The failures the user hid. Kept in memory only, on purpose: a failed module matters, so a reload (F5), another tab and
 * a new sign-in show the notice again; hiding only clears it out of the way while working on this page
 */
export const hiddenFailures = ref<string>();

/** A new sign-in shows the notice again */
export function forgetHidden() {
  hiddenFailures.value = undefined;
}
