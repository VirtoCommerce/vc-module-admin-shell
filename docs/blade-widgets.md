# Blade Widgets — Developer Guide

## Overview

A module can add a widget to **another module's blade**, the way AngularJS modules added widgets to `itemDetail` or `customerDetail1`: the Inventory module shows a product's stock on the Catalog product blade, Orders shows a contact's orders on the Customer blades. The blade doesn't know the widget; the widget reads the blade's item through vc-shell's blade context.

This is vc-shell's `registerExternalWidget`, used from Admin Shell plugins. Both sides are vc-shell features; the Admin Shell's part is that its platform blades publish their item, so modules can extend them too.

```
blade (owner module)                         widget (another module's plugin)
defineBladeContext({ item })  ─────────────► injectBladeContext().value.item
"CatalogProductDetails"                      registerExternalWidget({ targetBlades: ["CatalogProductDetails"] })
   toolbar widgets area ◄──────────────────── <VcWidget icon title value @click="openBlade(…)" />
```

## Quick start

Register the widget in the plugin's entry (`src/modules/index.ts`):

```ts
import { registerExternalWidget } from "@vc-shell/framework";
import { markRaw } from "vue";
import ProductInventoryWidget from "./components/ProductInventoryWidget.vue";

registerExternalWidget({
  id: "InventoryProductStock",               // unique, prefixed with the module
  title: "Inventory",
  component: markRaw(ProductInventoryWidget),
  targetBlades: ["CatalogProductDetails"],   // blade names
  isVisible: (blade) => !!blade?.param,      // nothing to show for an unsaved product
});
```

The widget reads the blade's item and opens its own blade:

```vue
<template>
  <VcWidget
    v-if="hasAccess('inventory:update')"
    icon="lucide-boxes"
    :title="$t('INVENTORY.WIDGETS.INVENTORY')"
    :value="label"
    :disabled="!product?.id"
    @click="open"
  />
</template>

<script setup lang="ts">
import { injectBladeContext, useBlade, usePermissions } from "@vc-shell/framework";
import { VcWidget } from "@vc-shell/framework/ui";
import { computed, ref, watch } from "vue";

const ctx = injectBladeContext();  // what the blade published with defineBladeContext
const product = computed(() => ctx.value.item as { id?: string; name?: string } | undefined);
const { openBlade } = useBlade();
const { hasAccess } = usePermissions();
const label = ref("…");

watch(() => product.value?.id, async (id) => { if (id) label.value = await totalInStock(id); }, { immediate: true });

// opens as a child of the product blade
const open = () => openBlade({ name: "InventoryProductStock", options: { productId: product.value?.id, productName: product.value?.name } });
</script>
```

## Reference

### `registerExternalWidget(widget)`

| Property | Type | Description |
|---|---|---|
| `id` | string | Required, unique. Prefix with the module. |
| `component` | Component | Required. Usually a `VcWidget`. Wrap with `markRaw`. |
| `targetBlades` | string[] | Blade names (`defineBlade({ name })`) to show on. |
| `title` | string | Title in the widgets' overflow list. |
| `isVisible` | boolean \| ref \| `(blade) => boolean` | Hide the widget, e.g. on a new item (`blade.param` is empty). |

### Blade context

| Side | API | Description |
|---|---|---|
| Blade (owner) | `defineBladeContext({ item })` | Publishes the blade's data (a ref or computed) to the widgets on it. |
| Widget | `injectBladeContext()` | A computed with what the blade published: `ctx.value.item`. |

### Blades of the Admin Shell that publish their item

| Blade name | Screen | `item` | AngularJS counterpart |
|---|---|---|---|
| `PlatformModuleDetails` | Modules → a module | the module | `moduleDetail` widgets (e.g. Core's currencies) |
| `PlatformSecurityUserDetails` | Security → a user | the user | the account blade's widgets |
| `PlatformUserProfile` | the user's profile | the current user | `userProfileDetail` widgets |

Modules' blades publish theirs the same way: `CatalogProductDetails` (the product), `StoreDetails` (the store), `CustomerContactDetails` and `CustomerOrganizationDetails` (the member). Each module documents what its blades publish.

### Widgets of the blade's own module

A blade's own widgets don't need the registry: the blade declares them with `useBladeWidgets([...])` (headless widgets: `icon`, `title`, `badge`, `loading`, `onClick`, `onRefresh`), as the Security user blade and the dynamic property blade do.

## Guidelines

- Check permissions inside the widget (`usePermissions().hasAccess`); the blade's permission isn't yours.
- Keep the widget cheap: one count or one value, loaded when the item's id changes; open details in your own blade.
- Open your blade with `openBlade` from the widget, so it becomes a child of the blade the widget is on and closes with it.
- Don't rely on fields the blade doesn't publish; ask the owner module to add them to its blade context.

## Testing

- Open the target blade for an existing item: the widget shows its value and opens its blade as a child.
- A new (unsaved) item: the widget is hidden or disabled.
- A user without the widget's permission doesn't see it.
