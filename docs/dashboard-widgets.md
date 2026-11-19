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

- **The layers decide** which widgets show, where and how big (see *Layers* below). A widget no layer names takes its declared position and size, so a new module's widget shows up on its own.
- **The user's layout is kept on the server** (`AdminShell.Dashboard.User`), so it is the same in every browser. vc-shell's grid still reads and writes `localStorage["vc-dashboard-layout"]`; Home fills it from the server before the grid starts and saves the grid's changes back.
- **Closing up.** After the user's own move, the widgets close up in reading order, so no holes stay.
- **Reset layout** (top right) puts every widget back at its place for everyone, and keeps the widgets the user hid.
- **Phones:** widgets are stacked full width in registration order (the host's first, then the plugins' as they load), not in grid order.

## Layers

The dashboard is composed like the menu ([menu-layers.md](menu-layers.md)). Each layer names widgets by id and only what it changes:

```
widgets the modules register ──► for everyone ──► roles ──► the user's own ──► the widgets' permissions ──► Home
(id, size, position,             (hide; place    (hide)    (hide, place,      (checked by vc-shell: a widget
 permissions)                     and size)                  size)              the user may not see never shows)
```

| Layer | Platform setting | Who changes it | API (`/api/admin-shell/dashboard`) |
|---|---|---|---|
| For everyone | `AdminShell.Dashboard.Global` | `admin-shell:dashboard:manage`: *Customize for everyone* on Home, the configurator | `GET` / `PUT /global` (`?resetUserLayouts=true`) |
| Role | `AdminShell.Dashboard.Role` (tenant `Role`) | `admin-shell:dashboard:manage`: the configurator's *Roles* | `GET` / `PUT /roles/{roleId}` (404 for a role that doesn't exist) |
| User | `AdminShell.Dashboard.User` (tenant `UserProfile`, hidden) | the user, on Home | `GET` / `PUT /me` |
| What users may change | `AdminShell.Dashboard.AllowHide`, `.AllowMove`, `.AllowResize` | the configurator's *Personalization* | `GET` / `PUT /personalization` |

`GET /api/admin-shell/dashboard` returns the user's dashboard with the layers composed.

A layer's value, e.g. the one for everyone:

```json
{
  "widgets": {
    "shell-alerts": { "x": 0, "y": 0, "width": 12, "height": 4 },
    "shell-sign-ins": { "hidden": true }
  },
  "layoutVersion": 2
}
```

Rules:

- **Permissions first, unchanged.** A widget shows only to users with its `permissions`; no layer can show it to others. Hiding is not security: the widget's data stays protected by its endpoints.
- **For everyone** hides a widget from every user, administrators too, and sets places and sizes. It is what every user starts from.
- **Roles:** a widget is hidden only when **every** one of the user's roles hides it, as for menu items. Administrators and users without roles get nothing hidden by roles. A role's earlier format, `{"hiddenWidgets": [...]}`, still reads.
- **The user** hides widgets (*Widgets* on Home) and moves and resizes them, as far as the personalization settings allow. Turning a setting off deletes nothing: the user's choice applies again when it is on.
- **Reset users' layouts** (when saving for everyone, or in the configurator) raises `layoutVersion`; a user's places and sizes made under an older version are dropped at the next visit. The widgets users hid stay hidden.
- **Diff only.** Saving for everyone keeps only what differs from the modules' own place and size, and a user's layer only what differs from the layout for everyone, so a later change of a default reaches the widgets nobody placed. Ids of widgets that aren't installed are kept and do nothing.
- A value that doesn't read as a layer (edited by hand, with a typo) counts as empty: everyone then sees every widget their permissions allow. A `PUT` whose body doesn't bind is refused with 400 and the layer is kept.

### Customize for everyone (Home)

Users with `admin-shell:dashboard:manage` see *Customize for everyone* on Home. It shows every installed widget at its place for everyone, to move and resize; *Widgets* hides or shows a widget for everyone, with the permission each needs. *Modules' layout* goes back to the modules' own places and sizes. *Save for everyone* stores the layer; *Reset users' own layouts* also drops every user's places and sizes. *Cancel* leaves without saving.

### The configurator (Configuration › Monitoring & Tools › Admin Shell Dashboard Configurator)

Route `/dashboard-configurator`, permission `admin-shell:dashboard:manage`.

| Tab | What it does |
|---|---|
| For everyone | Hide or show each widget for everyone, with the permission it needs; *Customize the layout on Home*; *Reset users' layouts*. |
| Roles | Pick a role and hide the widgets its users don't need. A widget the role has no permission for is shown as such and can't be changed: the role doesn't see it anyway. |
| Personalization | Whether users may hide, move and resize widgets. |
| Edit as JSON | The layer for everyone as JSON, to copy for a backup or another environment, or to paste and save. |

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
- Move a widget, reload (the layout is kept, in another browser too), then *Reset layout* (all back to the defaults).
- Hide the widget for a role and sign in as a user with only that role: it is gone, and the others close up.
- Light and dark themes; a phone-sized window.
