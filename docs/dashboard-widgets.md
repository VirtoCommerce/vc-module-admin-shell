# Dashboard Widgets — Developer Guide

## Overview

The Admin Shell's home page is a dashboard of widgets on a 12-column grid. Users drag, resize and reset them; the layout is saved per browser. The shell adds the platform's widgets (alerts, recent activity, sign-ins); each module adds its own from its plugin with vc-shell's `registerDashboardWidget`. Today Orders adds sales, recent orders, orders to process, payments and fulfilment, Inventory adds *Low stock*, and Cart adds *Currently in carts*.

Source: `src/VirtoCommerce.AdminShell.Web/App/src/pages/Dashboard.vue` (the page), `src/shell/dashboard/` (the host's widgets and the planned layout), `src/styles/custom.scss` (`.dash-*` classes). Example plugin widget: `vc-module-inventory/src/VirtoCommerce.InventoryModule.Web/vue/src/modules/dashboard/`.

## Quick start

```ts
// src/modules/dashboard/index.ts — imported from the plugin's entry: import "./dashboard";
import { registerDashboardWidget } from "@vc-shell/framework";
import { markRaw } from "vue";
import LowStockWidget from "./LowStockWidget.vue";

registerDashboardWidget({
  id: "inventory-low-stock",          // unique, prefixed with the module
  name: "Low stock",                  // shown in vc-shell's widget lists
  component: markRaw(LowStockWidget),
  size: { width: 8, height: 6 },      // grid cells: 12 columns, rows of 80 px
  position: { x: 0, y: 16 },          // see "Positions"
  permissions: ["inventory:read"],    // hidden from users without it
});
```

```vue
<!-- LowStockWidget.vue -->
<template>
  <DashboardWidgetCard :header="$t('INVENTORY.DASHBOARD.LOW_STOCK.TITLE')" icon="lucide-clipboard-check" :loading="loading">
    <template #actions>
      <button type="button" class="dash-link-button" @click="openList">{{ $t("INVENTORY.DASHBOARD.VIEW_ALL") }}</button>
    </template>
    <template #content>
      <div v-if="rows.length" class="dash-table">
        <table>…</table>
      </div>
      <div v-else-if="!loading" class="dash-empty">
        <VcIcon icon="lucide-boxes" size="xl" />
        {{ $t("INVENTORY.DASHBOARD.LOW_STOCK.EMPTY") }}
      </div>
    </template>
  </DashboardWidgetCard>
</template>

<script lang="ts" setup>
import { DashboardWidgetCard, useAsync, useBlade } from "@vc-shell/framework";
import { VcIcon } from "@vc-shell/framework/ui";
import { onMounted } from "vue";

const { openBlade } = useBlade();
const { loading, action: load } = useAsync(async () => { /* fetch with the module's API client */ }, { notify: false });
onMounted(load);

// "View all": the module's workspace, as the menu opens it
const openList = () => openBlade({ name: "InventoryFulfillmentCenterList", isWorkspace: true });
</script>
```

Register widgets **at import** of the plugin's entry (not in a component), so they exist when the dashboard is built.

## Widget reference (`DashboardWidget`)

| Property | Type | Description |
|---|---|---|
| `id` | string | Required, unique. Prefix with the module (`orders-recent`). Saved layouts refer to it: changing it puts the widget back at its default position for everyone. |
| `name` | string | Required. A readable name. |
| `component` | Component | Required. Wrap with `markRaw`. |
| `size` | `{ width, height }` | Required. Grid cells; `width` out of 12, `height` in rows of 80 px. |
| `position` | `{ x, y }` | Default position. See below. |
| `permissions` | string[] | Checked with vc-shell's `hasAccess`; users without them don't see the widget. Give the one permission the data needs (`inventory:read`). |
| `props` | object | Props passed to the component. |

### `DashboardWidgetCard`

The card every widget uses: `header` (text), `icon` (`lucide-*`), `loading` (spinner over the content); slots `#actions` (top right, e.g. *View all*, a period select) and `#content`.

## Positions

vc-shell honours declared positions only when **every** widget declares one; otherwise it packs widgets automatically. Always declare `position`, and pick a free spot in the planned layout (`src/shell/dashboard/index.ts`):

```
y0   alerts (7)          | activity (5)                       [shell]
y5   total sales (4)     | sales trends (8)                   [orders]
y10  recent orders (8)   | currently in carts (4)             [orders | cart]
y16  low stock (8)       | orders to process (4)              [inventory | orders]
y22  payments (5) | sign-ins (4) | fulfillment (3)            [orders | shell | orders]
```

Add a new row below the last one (y27 and down) rather than squeezing into a row; update the comment in `src/shell/dashboard/index.ts` when you take a spot.

How the layout behaves:

- **Saved layout wins.** After the user moves or resizes a widget, the layout (`{ id, x, y, w, h }` per widget) is saved in `localStorage["vc-dashboard-layout"]` and restored on the next visit. A widget that isn't in the saved layout (new module, new id) goes to its declared position.
- **Closing up.** After the user's own move, the widgets close up in reading order, so no holes stay.
- **Reset layout** (top right) puts every widget back at its declared position.
- **Phones:** widgets are stacked full width in registration order (the host's first, then the plugins' as they load), not in grid order.

## Shared styles (`.dash-*`)

Use these classes for a widget that looks like the others in both themes (defined in `src/styles/custom.scss`):

| Class | For |
|---|---|
| `.dash-link-button` | The *View all* link in `#actions`. |
| `.dash-select` | A small select in `#actions` (period). |
| `.dash-table` | A full-bleed table: `tr.dash-table__row--link` (clickable row), `.dash-table__num` (right-aligned numbers), `.dash-table__strong`, `.dash-table__muted`. |
| `.dash-link` | A link-coloured value (order number). |
| `.dash-empty` | The empty state: icon and text centred in the card. |
| `.dash-inline` | Lets a block component (`VcStatus`) size to its content in a cell. |
| `.dash-metrics`, `.dash-metric` (`__icon--blue\|amber\|green`, `__label`, `__value`, `__line`), `.dash-delta` (`--down`) | Key figures with a change indicator. |
| `.dash-feed` (`__item`, `__dot`, `__title`, `__text`, `__meta`) | An activity list. |
| `.dash-alerts`, `.dash-alert` (`--success\|--danger`), `.dash-dismiss` | Alerts with a dismiss button. |
| `.dash-donut` (`__chart`, `__center`, `__total`, `__legend`, …) | A donut with a legend. |
| `.dash-bars` (`__bar`, `__track`, `__fill`, `__value`, `__chip`, `__legend`) | Vertical percentage bars. |
| `.dash-count` | A count pill next to the actions. |

Styles that only one widget needs go into the widget's own `<style scoped>`. Use the design tokens (`--color-neutral-600`, `--bg-*`, …) rather than fixed colours.

## Guidelines

- One request per widget, small `take`; a dashboard opens many widgets at once. Use `useAsync(…, { notify: false })`: the app's error handler shows a failure once.
- Open the module's screens from the widget the way the menu does (`openBlade({ name, isWorkspace: true })`, then the detail blade), so the blade stack is the same.
- Keep content to what fits the card at its size: one line per row, full text in `title`. Check at phone width, where the card is narrower; a container query (`container-type: inline-size`) lets the widget adapt to its own width.
- A widget belongs to the module whose data it shows, in that module's plugin, so it comes and goes with the module. A module without screens can have a plugin just for its widgets (Cart's plugin brings only *Currently in carts*).

## Testing

- The widget shows for a user with the permission and not for one without.
- Clear `localStorage["vc-dashboard-layout"]` (a first visit): the widget is at its declared position and doesn't push others.
- Move a widget, reload (the layout is kept), then *Reset layout* (all back to the defaults).
- Light and dark themes; a phone-sized window.
