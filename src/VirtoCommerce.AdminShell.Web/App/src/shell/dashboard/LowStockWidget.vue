<!-- Low stock, in the design's Inventory Management slot (DashboardTables.jsx): the inventory records
     with the least stock on hand. The inventory API has no threshold filter, so it sorts by quantity. -->
<template>
  <DashboardWidgetCard
    :header="$t('SHELL.DASHBOARD.LOW_STOCK.TITLE')"
    icon="lucide-clipboard-check"
    :loading="loading"
  >
    <template #actions>
      <button
        type="button"
        class="dash-link-button"
        @click="openInventory"
      >
        {{ $t("SHELL.DASHBOARD.VIEW_ALL") }}
      </button>
    </template>
    <template #content>
      <div
        v-if="rows.length"
        class="dash-table"
      >
        <table>
          <thead>
            <tr>
              <th>{{ $t("SHELL.DASHBOARD.LOW_STOCK.NAME") }}</th>
              <th>{{ $t("SHELL.DASHBOARD.LOW_STOCK.SKU") }}</th>
              <th>{{ $t("SHELL.DASHBOARD.LOW_STOCK.LOCATION") }}</th>
              <th>{{ $t("SHELL.DASHBOARD.LOW_STOCK.STOCK") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rows"
              :key="row.key"
            >
              <td class="dash-table__strong">{{ row.name }}</td>
              <td class="dash-table__muted">{{ row.sku }}</td>
              <td class="dash-table__muted">{{ row.location }}</td>
              <td>
                <div
                  v-if="row.stock <= 0"
                  class="dash-inline"
                >
                  <VcStatus variant="danger">{{ $t("SHELL.DASHBOARD.LOW_STOCK.OUT") }}</VcStatus>
                </div>
                <div
                  v-else
                  class="dash-stock"
                  :class="{ 'dash-stock--low': row.low }"
                >
                  <span class="dash-stock__track"><span :style="{ width: `${row.fill}%` }" /></span>
                  {{ $t("SHELL.DASHBOARD.LOW_STOCK.LEFT", { count: row.stock }) }}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        v-else-if="!loading"
        class="dash-empty"
      >
        <VcIcon
          icon="lucide-boxes"
          size="xl"
        />
        {{ $t("SHELL.DASHBOARD.LOW_STOCK.EMPTY") }}
      </div>
    </template>
  </DashboardWidgetCard>
</template>

<script lang="ts" setup>
import { DashboardWidgetCard, useAsync } from "@vc-shell/framework";
import { VcIcon, VcStatus } from "@vc-shell/framework/ui";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { postJson } from "./api";

interface InventoryInfo {
  fulfillmentCenterId?: string;
  fulfillmentCenterName?: string;
  inStockQuantity?: number;
  reorderMinQuantity?: number;
}

interface ProductInventory {
  productId: string;
  /** null when the product no longer exists in the catalog */
  product?: { name?: string; code?: string } | null;
  inventory: InventoryInfo;
}

const router = useRouter();
const records = ref<ProductInventory[]>([]);

// the app's error handler shows a failure
const { loading, action: load } = useAsync(
  async () => {
    // the products come resolved on the server, so the widget needs inventory:read only (not catalog read)
    const result = await postJson<{ results: ProductInventory[] }>("/api/inventory/products/search", {
      sort: "inStockQuantity",
      take: 6,
    });
    records.value = result.results ?? [];
  },
  { notify: false },
);
onMounted(load);

// the bar fills against twice the reorder point (or 200 units, the design's scale)
const rows = computed(() =>
  records.value.map(({ productId, product, inventory: x }) => {
    const stock = x.inStockQuantity ?? 0;
    const scale = Math.max(200, (x.reorderMinQuantity ?? 0) * 2);
    return {
      key: `${productId}:${x.fulfillmentCenterId}`,
      name: product?.name ?? productId,
      sku: product?.code ?? "",
      location: x.fulfillmentCenterName ?? "",
      stock,
      low: stock <= (x.reorderMinQuantity ?? 0),
      fill: Math.max(8, Math.min(100, (stock / scale) * 100)),
    };
  }),
);

const openInventory = () => router.push({ path: "/inventory" });
</script>
