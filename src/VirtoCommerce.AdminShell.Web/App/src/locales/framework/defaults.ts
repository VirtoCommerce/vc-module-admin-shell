import type { App, ComponentInternalInstance } from "vue";

/**
 * vc-shell texts that ignore the user's language: component props whose defaults are fixed English, such as the table
 * search's "Search...", the phone table's "More", "Actions" and "Cancel", or the date picker's labels. A screen that
 * doesn't pass its own text shows English, the shell's screens and the module plugins' alike (they share vc-shell).
 * Each such default becomes a text in the user's language: vc-shell's own where it has one, the shell's otherwise
 * (SHELL.FRAMEWORK). Some of these components aren't exported, so they are found by name when one is created.
 * Remove an entry when vc-shell translates that default itself.
 */
type Default = string | (() => unknown);

const DATE_PICKER = "SHELL.FRAMEWORK.DATE_PICKER";
const TABLE = "COMPONENTS.ORGANISMS.VC_TABLE";

function datePickerLabels(t: (key: string, values?: Record<string, unknown>) => string) {
  const unit = (name: string) => t(`${DATE_PICKER}.UNITS.${name}`);
  return {
    toggleOverlay: t(`${DATE_PICKER}.TOGGLE_OVERLAY`),
    menu: t(`${DATE_PICKER}.MENU`),
    input: t(`${DATE_PICKER}.INPUT`),
    openTimePicker: t(`${DATE_PICKER}.OPEN_TIME_PICKER`),
    closeTimePicker: t(`${DATE_PICKER}.CLOSE_TIME_PICKER`),
    incrementValue: (name: string) => t(`${DATE_PICKER}.INCREMENT`, { unit: unit(name) }),
    decrementValue: (name: string) => t(`${DATE_PICKER}.DECREMENT`, { unit: unit(name) }),
    openTpOverlay: (name: string) => t(`${DATE_PICKER}.OPEN_TIME_OVERLAY`, { unit: unit(name) }),
    amPmButton: t(`${DATE_PICKER}.AM_PM`),
    openYearsOverlay: t(`${DATE_PICKER}.OPEN_YEARS`),
    openMonthsOverlay: t(`${DATE_PICKER}.OPEN_MONTHS`),
    nextMonth: t(`${DATE_PICKER}.NEXT_MONTH`),
    prevMonth: t(`${DATE_PICKER}.PREV_MONTH`),
    nextYear: t(`${DATE_PICKER}.NEXT_YEAR`),
    prevYear: t(`${DATE_PICKER}.PREV_YEAR`),
    clearInput: t(`${DATE_PICKER}.CLEAR`),
    calendarIcon: t(`${DATE_PICKER}.CALENDAR_ICON`),
    timePicker: t(`${DATE_PICKER}.TIME_PICKER`),
    monthPicker: () => t(`${DATE_PICKER}.MONTH_PICKER`),
    yearPicker: () => t(`${DATE_PICKER}.YEAR_PICKER`),
    timeOverlay: (name: string) => t(`${DATE_PICKER}.TIME_OVERLAY`, { unit: unit(name) }),
  };
}

export function translateFrameworkDefaults(app: App) {
  const t = app.config.globalProperties.$t as (key: string, values?: Record<string, unknown>) => string;
  // component name -> prop -> a text key, or a function giving the value
  const defaults: Record<string, Record<string, Default>> = {
    VcDataTable: { searchPlaceholder: `${TABLE}.SEARCH` },
    TableSearchHeader: { placeholder: `${TABLE}.SEARCH` },
    TableCheckbox: { ariaLabel: `${TABLE}.SELECT_ROW` },
    DataTableMobileView: {
      emptyText: `${TABLE}.EMPTY_TITLE`,
      moreLabel: `${TABLE}.MORE`,
      actionSheetTitle: `${TABLE}.ACTIONS`,
      cancelLabel: "COMPONENTS.ORGANISMS.VC_POPUP.CANCEL",
    },
    DataTableMobileCard: {
      moreLabel: `${TABLE}.MORE`,
      actionSheetTitle: `${TABLE}.ACTIONS`,
      cancelLabel: "COMPONENTS.ORGANISMS.VC_POPUP.CANCEL",
      expandLabel: `${TABLE}.EXPAND_ROW`,
    },
    MobileActionSheet: { cancelLabel: "COMPONENTS.ORGANISMS.VC_POPUP.CANCEL" },
    "vc-skeleton": { ariaLabel: `${TABLE}.LOADING` },
    "vc-progress": { ariaLabel: "SHELL.FRAMEWORK.PROGRESS" },
    "vc-sidebar": { closeAriaLabel: "SHELL.FRAMEWORK.CLOSE_SIDEBAR" },
    GridstackDashboard: { ariaLabel: "SHELL.FRAMEWORK.DASHBOARD_GRID" },
    "vc-date-picker": { datePickerOptions: () => ({ ariaLabels: datePickerLabels(t) }) },
  };
  const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());

  app.mixin({
    beforeCreate() {
      const instance = (this as { $: ComponentInternalInstance }).$;
      const own = defaults[(instance.type as { __name?: string }).__name ?? ""];
      if (!own) return;
      // the component's prop options, shared by all its instances: the next ones get the text as their default
      const options = (instance as unknown as { propsOptions: [Record<string, { default?: unknown }> | undefined] })
        .propsOptions[0];
      const passed = instance.vnode.props ?? {};
      for (const [prop, value] of Object.entries(own)) {
        const option = options?.[prop];
        if (!option) continue;
        const make = typeof value === "function" ? value : () => t(value);
        option.default = make;
        // this one's props are already set: give it the text unless its parent passed one
        if (passed[prop] === undefined && passed[kebab(prop)] === undefined) {
          (instance.props as Record<string, unknown>)[prop] = make();
        }
      }
    },
  });
}
