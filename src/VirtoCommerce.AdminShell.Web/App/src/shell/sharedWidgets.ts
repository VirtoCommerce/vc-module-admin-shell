/**
 * Shared widgets: one module's plugin provides a widget, another places it on its own blades. It keeps placement with the
 * module that owns the blade, as AngularJS did (Catalog put Search's Index widget on its product blade, with Search's
 * controller): a module never registers widgets on blades of modules that depend on it. Plugins load in any order, and
 * the provider may not be installed: a placed widget shows once it is provided, and never if it isn't.
 * Plugins reach it through the app: app.config.globalProperties.$sharedWidgets, or inject(SHARED_WIDGETS_KEY).
 * See docs/blade-widgets.md, "Shared widgets".
 */
import { registerExternalWidget } from "@vc-shell/framework";
import { defineComponent, h, markRaw, shallowRef, unref, type App, type Component, type Ref } from "vue";

type BladeDescriptor = Parameters<Exclude<Parameters<typeof registerExternalWidget>[0]["isVisible"], boolean | Ref<boolean> | undefined>>[0];

export interface SharedWidgetPlacement {
  /** The placement's own id, unique and prefixed with the placing module: "CatalogProductIndex" */
  id: string;
  /** The provided widget: "search.index" */
  widget: string;
  /** The placing module's own blades (defineBlade name) */
  targetBlades: string[];
  /** Title in the widgets' overflow list */
  title?: string;
  /** Props for the provided widget, e.g. { documentType: "Product" } */
  props?: Record<string, unknown>;
  /** Hide it on some blades, e.g. a new item: (blade) => !!blade?.param; it is also hidden until the widget is provided */
  isVisible?: boolean | Ref<boolean> | ((blade?: BladeDescriptor) => boolean);
}

export interface SharedWidgets {
  /** Offers a widget for other modules to place: "search.index". Providing the same id again replaces it */
  provide: (id: string, component: Component) => void;
  /** Places a provided widget on the placing module's own blades; works before the widget is provided */
  place: (placement: SharedWidgetPlacement) => void;
  /** Whether a widget is provided (reactive) */
  isProvided: (id: string) => boolean;
}

/** The injection key module plugins use: inject(SHARED_WIDGETS_KEY) */
export const SHARED_WIDGETS_KEY = "adminShell.sharedWidgets";

declare module "vue" {
  interface ComponentCustomProperties {
    $sharedWidgets: SharedWidgets;
  }
}

const provided = shallowRef(new Map<string, Component>());

export const sharedWidgets: SharedWidgets = {
  provide(id, component) {
    provided.value = new Map(provided.value).set(id, markRaw(component));
  },
  place({ id, widget, targetBlades, title, props, isVisible }) {
    registerExternalWidget({
      id,
      title,
      targetBlades,
      // the provided component, with the placement's props and whatever the blade passes; nothing until it is provided
      component: markRaw(
        defineComponent({
          name: `SharedWidget_${id}`,
          inheritAttrs: false,
          setup: (_, { attrs }) => () => {
            const component = provided.value.get(widget);
            return component ? h(component, { ...props, ...attrs }) : null;
          },
        }),
      ),
      // the overflow list shouldn't offer a widget that isn't there
      isVisible: (blade) => {
        if (!provided.value.has(widget)) return false;
        return typeof isVisible === "function" ? isVisible(blade) : (unref(isVisible) ?? true);
      },
    });
  },
  isProvided: (id) => provided.value.has(id),
};

/** Makes shared widgets available to module plugins; called once from main.ts */
export function installSharedWidgets(app: App) {
  app.provide(SHARED_WIDGETS_KEY, sharedWidgets);
  app.config.globalProperties.$sharedWidgets = sharedWidgets;
}
