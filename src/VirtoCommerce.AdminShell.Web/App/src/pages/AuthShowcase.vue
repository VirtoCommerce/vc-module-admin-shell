<template>
  <!-- The panel beside the sign-in form, from 1024px: slides about Virto Commerce in Buyer24's layout (chip, headline,
       points, then the product in a window that runs off the corner), changing every few seconds, with dots to pick one.
       The product views are drawn with the shell's own colors and made-up sample data, so they follow the theme and never
       show real data. -->
  <aside
    class="as-show"
    :aria-label="$t('SHELL.AUTH.SHOWCASE.LABEL')"
    @mouseenter="stop"
    @mouseleave="start"
    @focusin="stop"
    @focusout="start"
  >
    <div class="as-show__slides">
      <section
        v-for="(slide, index) in slides"
        :key="slide.id"
        class="as-show__slide"
        :class="{ 'as-show__slide--active': index === current }"
        :aria-hidden="index !== current"
        :inert="index !== current || undefined"
      >
        <div class="as-show__copy">
          <span class="as-show__chip">
            <img
              v-if="slide.id === 'PLATFORM'"
              :src="logoMark"
              alt=""
            />
            <VcIcon
              v-else
              :icon="slide.icon"
              size="xs"
            />
            {{ $t(`SHELL.AUTH.SHOWCASE.${slide.id}.CHIP`) }}
          </span>
          <h2 class="as-show__title">{{ $t(`SHELL.AUTH.SHOWCASE.${slide.id}.TITLE`) }}</h2>
          <p class="as-show__body">{{ $t(`SHELL.AUTH.SHOWCASE.${slide.id}.BODY`) }}</p>
          <ul class="as-show__points">
            <li
              v-for="n in 3"
              :key="n"
            >
              <VcIcon
                icon="lucide-check"
                size="s"
              />
              {{ $t(`SHELL.AUTH.SHOWCASE.${slide.id}.POINT_${n}`) }}
            </li>
          </ul>
        </div>

        <div
          class="as-show__window"
          aria-hidden="true"
        >
          <div class="as-show__chrome"><i /><i /><i /></div>

          <!-- APIs & AI agents: the storefront's GraphQL beside an agent's MCP tool call -->
          <div
            v-if="slide.view === 'api'"
            class="as-show__code"
          >
            <pre><span class="c">#  xAPI · storefront GraphQL</span>
<span class="k">query</span> <span class="f">Product</span>(<span class="v">$id</span>: <span class="t">String!</span>) {
  <span class="f">product</span>(id: <span class="v">$id</span>, storeId: <span class="s">"b2b-store"</span>,
          currencyCode: <span class="s">"USD"</span>) {
    name
    code
    price { actual { formattedAmount } }
    tierPrices { quantity price { formattedAmount } }
    availabilityData { availableQuantity }
  }
}</pre>
            <pre class="as-show__answer"><span class="c">// MCP · an AI agent calls a commerce tool</span>
<span class="p">{</span>
  <span class="a">"jsonrpc"</span>: <span class="s">"2.0"</span>,
  <span class="a">"method"</span>: <span class="s">"tools/call"</span>,
  <span class="a">"params"</span>: {
    <span class="a">"name"</span>: <span class="s">"create_quote_request"</span>,
    <span class="a">"arguments"</span>: {
      <span class="a">"storeId"</span>: <span class="s">"b2b-store"</span>,
      <span class="a">"items"</span>: [
        { <span class="a">"sku"</span>: <span class="s">"DX-400"</span>, <span class="a">"quantity"</span>: <span class="n">50</span> },
        { <span class="a">"sku"</span>: <span class="s">"HW-M8"</span>, <span class="a">"quantity"</span>: <span class="n">120</span> }
      ],
      <span class="a">"comment"</span>: <span class="s">"Need delivery before Nov 1"</span>
    }
  }
<span class="p">}</span></pre>
          </div>

          <div
            v-else
            class="as-show__app"
          >
            <div class="as-show__rail">
              <img
                :src="logoMark"
                alt=""
                class="as-show__mark"
              />
              <span
                v-for="tile in rail"
                :key="tile.icon"
                class="as-show__tile"
                :class="{ 'as-show__tile--active': tile.label === slide.rail }"
              >
                <VcIcon
                  :icon="tile.icon"
                  size="s"
                />
                {{ tile.label }}
              </span>
            </div>

            <div class="as-show__panel">
              <div class="as-show__panel-title">{{ menus[slide.view].title }}</div>
              <span
                v-for="item in menus[slide.view].items"
                :key="item.label"
                class="as-show__item"
                :class="{ 'as-show__item--active': item.active }"
              >
                <VcIcon
                  :icon="item.icon"
                  size="s"
                />
                {{ item.label }}
                <b v-if="item.badge">{{ item.badge }}</b>
              </span>
            </div>

            <div class="as-show__main">
              <!-- Platform: the orders list -->
              <div
                v-if="slide.view === 'orders'"
                class="as-show__blade"
              >
                <div class="as-show__blade-title">Customer orders</div>
                <div class="as-show__toolbar">
                  <span
                    v-for="tool in ['Refresh:lucide-refresh-cw', 'Add:lucide-plus', 'Export:lucide-download']"
                    :key="tool"
                  >
                    <VcIcon
                      :icon="tool.split(':')[1]"
                      size="xs"
                    />{{ tool.split(":")[0] }}
                  </span>
                </div>
                <div class="as-show__row as-show__row--head">
                  <span>Number</span><span>Customer</span><span>Total</span><span>Status</span>
                </div>
                <div
                  v-for="row in orders"
                  :key="row.number"
                  class="as-show__row"
                >
                  <span>{{ row.number }}</span>
                  <span>{{ row.customer }}</span>
                  <span>{{ row.total }}</span>
                  <span
                    class="as-show__status"
                    :class="`as-show__status--${row.tone}`"
                    >{{ row.status }}</span
                  >
                </div>
              </div>

              <!-- Catalog & pricing: products with their prices -->
              <div
                v-else-if="slide.view === 'catalog'"
                class="as-show__blade"
              >
                <div class="as-show__blade-title">Industrial tools <small>B2B catalog · 1,284 products</small></div>
                <div class="as-show__grid">
                  <div
                    v-for="product in products"
                    :key="product.code"
                    class="as-show__product"
                  >
                    <div
                      class="as-show__product-image"
                      :style="{ '--as-hue': product.hue }"
                    >
                      <VcIcon
                        :icon="product.icon"
                        size="xl"
                      />
                    </div>
                    <div class="as-show__product-name">{{ product.name }}</div>
                    <div class="as-show__product-code">{{ product.code }}</div>
                    <div class="as-show__product-price">
                      {{ product.price }} <small>{{ product.tier }}</small>
                    </div>
                  </div>
                </div>
              </div>

              <!-- B2B buying: a quote with tier prices and approval -->
              <div
                v-else
                class="as-show__blade"
              >
                <div class="as-show__blade-title">
                  Quote Q-261013-0042
                  <span class="as-show__status as-show__status--info">Proposal sent</span>
                </div>
                <div class="as-show__fields">
                  <div><small>Company</small>Northwind Traders</div>
                  <div><small>Buyer</small>Maria Anders · Purchasing</div>
                  <div><small>Contract</small>NW-2026 · Net 30</div>
                  <div><small>Expires</small>Oct 27, 2026</div>
                </div>
                <div class="as-show__row as-show__row--head as-show__row--quote">
                  <span>Item</span><span>Quantity</span><span>Proposed</span><span>Total</span>
                </div>
                <div
                  v-for="line in quote"
                  :key="line.item"
                  class="as-show__row as-show__row--quote"
                >
                  <span>{{ line.item }}</span>
                  <span>{{ line.qty }}</span>
                  <span>{{ line.price }}</span>
                  <span>{{ line.total }}</span>
                </div>
                <div class="as-show__totals">
                  <span>Subtotal <b>$18,945.00</b></span>
                  <span>Contract discount <b>−$1,515.60</b></span>
                  <span class="as-show__grand">Total <b>$17,429.40</b></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <div class="as-show__footer">
      <div class="as-show__dots">
        <button
          v-for="(slide, index) in slides"
          :key="slide.id"
          type="button"
          class="as-show__dot"
          :class="{ 'as-show__dot--active': index === current }"
          :aria-label="$t('SHELL.AUTH.SHOWCASE.GO_TO', { name: $t(`SHELL.AUTH.SHOWCASE.${slide.id}.CHIP`) })"
          :aria-current="index === current"
          @click="go(index)"
        />
      </div>
      <a
        class="as-show__more"
        href="https://virtocommerce.com"
        target="_blank"
        rel="noopener"
      >
        {{ $t("SHELL.AUTH.SHOWCASE.MORE") }}
        <VcIcon
          icon="lucide-arrow-up-right"
          size="xs"
        />
      </a>
    </div>
  </aside>
</template>

<script lang="ts" setup>
import { VcIcon } from "@vc-shell/framework/ui";
import { onBeforeUnmount, onMounted, ref } from "vue";
import logoMark from "/assets/logo-mark.svg";

type View = "orders" | "catalog" | "quote" | "api";

const slides: { id: string; icon: string; view: View; rail?: string }[] = [
  { id: "PLATFORM", icon: "", view: "orders", rail: "Orders" },
  { id: "CATALOG", icon: "lucide-package", view: "catalog", rail: "Products" },
  { id: "B2B", icon: "lucide-building-2", view: "quote", rail: "Orders" },
  { id: "API", icon: "lucide-bot", view: "api" },
];

/* ---- the slider: a new slide every 7 s, paused while pointed at or focused, still for reduced motion ---- */
const SLIDE_MS = 7000;
const current = ref(0);
let timer: ReturnType<typeof setInterval> | undefined;

function stop() {
  clearInterval(timer);
  timer = undefined;
}

function start() {
  stop();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  timer = setInterval(() => (current.value = (current.value + 1) % slides.length), SLIDE_MS);
}

function go(index: number) {
  current.value = index;
}

onMounted(start);
onBeforeUnmount(stop);

/* ---- sample data for the drawings; the company names are the usual placeholder ones ---- */
const rail = [
  { icon: "lucide-house", label: "Home" },
  { icon: "lucide-package", label: "Products" },
  { icon: "lucide-shopping-cart", label: "Orders" },
  { icon: "lucide-megaphone", label: "Marketing" },
  { icon: "lucide-chart-column", label: "Insights" },
  { icon: "lucide-settings", label: "Settings" },
];

const menus: Record<Exclude<View, "api">, { title: string; items: { icon: string; label: string; badge?: string; active?: boolean }[] }> = {
  orders: {
    title: "Orders & Customers",
    items: [
      { icon: "lucide-file-text", label: "Orders", badge: "37", active: true },
      { icon: "lucide-undo-2", label: "Returns" },
      { icon: "lucide-contact", label: "Contacts" },
      { icon: "lucide-repeat", label: "Subscriptions" },
      { icon: "lucide-file-signature", label: "Contracts" },
      { icon: "lucide-file-question", label: "Quotes" },
    ],
  },
  catalog: {
    title: "Products",
    items: [
      { icon: "lucide-folder", label: "Catalogs", active: true },
      { icon: "lucide-circle-dollar-sign", label: "Pricing" },
      { icon: "lucide-warehouse", label: "Inventory" },
      { icon: "lucide-ruler", label: "Units of measure" },
      { icon: "lucide-image", label: "Assets" },
    ],
  },
  quote: {
    title: "Orders & Customers",
    items: [
      { icon: "lucide-file-text", label: "Orders", badge: "37" },
      { icon: "lucide-contact", label: "Contacts" },
      { icon: "lucide-file-signature", label: "Contracts" },
      { icon: "lucide-file-question", label: "Quotes", badge: "4", active: true },
      { icon: "lucide-repeat", label: "Subscriptions" },
    ],
  },
};

const orders = [
  { number: "CO-261013-0142", customer: "Acme Supply Co.", total: "$12,480.00", status: "Processing", tone: "info" },
  { number: "CO-261013-0141", customer: "Northwind Traders", total: "$3,215.50", status: "New", tone: "warning" },
  { number: "CO-261012-0139", customer: "Fabrikam, Inc.", total: "$867.20", status: "Completed", tone: "success" },
  { number: "CO-261012-0137", customer: "Contoso Ltd.", total: "$5,940.00", status: "Completed", tone: "success" },
  { number: "CO-261011-0133", customer: "Tailspin Toys", total: "$1,120.75", status: "Cancelled", tone: "danger" },
  { number: "CO-261011-0130", customer: "Wide World Importers", total: "$22,305.00", status: "Processing", tone: "info" },
  { number: "CO-261010-0127", customer: "Adventure Works", total: "$4,410.00", status: "Completed", tone: "success" },
];

const products = [
  { code: "DX-400", name: "Industrial drill DX-400", price: "$289.00", tier: "from $249 × 50", icon: "lucide-drill", hue: "200" },
  { code: "HW-M8", name: "Hex bolts M8, box of 500", price: "$42.50", tier: "from $36 × 20", icon: "lucide-bolt", hue: "38" },
  { code: "SG-120", name: "Safety goggles SG-120", price: "$12.90", tier: "from $9.80 × 100", icon: "lucide-glasses", hue: "150" },
  { code: "TM-55", name: "Tape measure 5 m", price: "$8.40", tier: "from $6.90 × 100", icon: "lucide-ruler", hue: "280" },
  { code: "WG-PRO", name: "Work gloves, pro grip", price: "$6.75", tier: "from $5.10 × 200", icon: "lucide-hand", hue: "12" },
  { code: "LV-60", name: "Spirit level 60 cm", price: "$24.00", tier: "from $19.50 × 25", icon: "lucide-move-horizontal", hue: "220" },
];

const quote = [
  { item: "Industrial drill DX-400", qty: "50", price: "$249.00", total: "$12,450.00" },
  { item: "Hex bolts M8, box of 500", qty: "120", price: "$36.00", total: "$4,320.00" },
  { item: "Safety goggles SG-120", qty: "150", price: "$9.80", total: "$1,470.00" },
  { item: "Work gloves, pro grip", qty: "140", price: "$5.05", total: "$705.00" },
];
</script>

<style lang="scss">
// The panel is dark in both themes, as Buyer24's is; its glows and accent follow the theme (Virto blue in light, the
// logo's amber in dark). Sizes are Buyer24's AuthShowcase.
.as-show {
  --as-show-bg: #0f1828;
  --as-show-glow-1: rgb(49 158 212 / 34%);
  --as-show-glow-2: rgb(255 178 36 / 12%);
  --as-show-accent: #5cbbe8;
  --as-show-chip: #c4e6f6;

  background-color: var(--as-show-bg);
  background-image:
    radial-gradient(120% 80% at 100% 0%, var(--as-show-glow-1) 0%, transparent 60%),
    radial-gradient(90% 70% at 0% 100%, var(--as-show-glow-2) 0%, transparent 55%);
  color: #f8fafc;
  display: none;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
  width: 52%;
}

:root[data-theme="dark"] .as-show {
  --as-show-bg: #0a0c10;
  --as-show-glow-1: rgb(255 178 36 / 16%);
  --as-show-glow-2: rgb(49 158 212 / 14%);
  --as-show-accent: #ffb224;
  --as-show-chip: #ffd892;
}

@media (min-width: 1024px) {
  .as-show {
    display: flex;
  }
}

.as-show__slides {
  display: grid;
  flex: 1;
  grid-template-rows: minmax(0, 1fr);
  min-height: 0;
  padding-top: 56px;
}

.as-show__slide {
  display: flex;
  flex-direction: column;
  grid-area: 1 / 1;
  min-height: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.7s ease;

  &--active {
    opacity: 1;
    pointer-events: auto;
  }
}

@media (min-width: 1280px) {
  .as-show {
    width: 56%;
  }

  .as-show__slides {
    padding-top: 64px;
  }

  .as-show__copy {
    padding: 0 64px;
  }

  .as-show__window {
    margin-left: 64px;
  }

  .as-show__footer {
    padding: 0 64px;
  }

  .as-show__title {
    font-size: 34px;
  }
}

// the same height on every slide (up to a 2-line headline and body), so the window doesn't jump as slides change
.as-show__copy {
  box-sizing: border-box;
  max-width: 640px;
  min-height: 280px;
  padding: 0 48px;
}

.as-show__chip {
  align-items: center;
  background: rgb(255 255 255 / 7%);
  border: 1px solid rgb(255 255 255 / 15%);
  border-radius: 999px;
  color: var(--as-show-chip);
  display: inline-flex;
  font-size: 12px;
  font-weight: 500;
  gap: 6px;
  padding: 4px 10px;

  img {
    height: 12px;
    width: auto;
  }
}

.as-show__title {
  color: #ffffff;
  font-size: 30px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.15;
  margin: 16px 0 0;
  text-wrap: balance;
}

.as-show__body {
  color: #cbd5e1;
  font-size: 15px;
  line-height: 1.6;
  margin: 12px 0 0;
}

.as-show__points {
  display: flex;
  flex-direction: column;
  gap: 8px;
  list-style: none;
  margin: 20px 0 0;
  padding: 0;

  li {
    align-items: flex-start;
    color: #e2e8f0;
    display: flex;
    font-size: 14px;
    gap: 10px;
    line-height: 20px;
  }

  .vc-icon {
    color: var(--as-show-accent);
    flex-shrink: 0;
    margin-top: 2px;
  }
}

/* ---- the bottom bar: slide dots and the link to the site ---- */
.as-show__footer {
  align-items: center;
  background: var(--as-show-bg);
  border-top: 1px solid rgb(255 255 255 / 8%);
  display: flex;
  flex-shrink: 0;
  height: 64px;
  justify-content: space-between;
  padding: 0 48px;
  position: relative;
  z-index: 1;
}

.as-show__dots {
  align-items: center;
  display: flex;
  gap: 8px;
}

.as-show__dot {
  background: rgb(255 255 255 / 25%);
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  height: 6px;
  padding: 0;
  transition:
    width 0.3s,
    background-color 0.3s;
  width: 6px;

  &:hover {
    background: rgb(255 255 255 / 50%);
  }

  &--active,
  &--active:hover {
    background: var(--as-show-accent);
    width: 24px;
  }

  &:focus-visible {
    outline: 2px solid var(--as-show-accent);
    outline-offset: 3px;
  }
}

.as-show__more {
  align-items: center;
  color: var(--as-show-accent);
  display: inline-flex;
  font-size: 13px;
  font-weight: 500;
  gap: 4px;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
}

/* ---- the product, in a window that runs off the corner ---- */
.as-show__window {
  background: var(--as-bg);
  border-left: 1px solid rgb(255 255 255 / 14%);
  border-top: 1px solid rgb(255 255 255 / 14%);
  border-top-left-radius: 16px;
  box-shadow: 0 30px 80px -20px rgb(0 0 0 / 60%);
  display: flex;
  flex: 1;
  flex-direction: column;
  margin: 40px 0 0 48px;
  min-height: 0;
  overflow: hidden;
}

.as-show__chrome {
  align-items: center;
  background: var(--as-rail);
  border-bottom: 1px solid rgb(255 255 255 / 8%);
  display: flex;
  flex-shrink: 0;
  gap: 6px;
  height: 32px;
  padding: 0 14px;

  i {
    background: rgb(255 255 255 / 18%);
    border-radius: 50%;
    height: 10px;
    width: 10px;
  }
}

.as-show__app {
  display: flex;
  flex: 1;
  min-height: 0;
}

.as-show__rail {
  align-items: center;
  background: var(--as-rail);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: 6px;
  padding: 12px 6px;
  width: 64px;
}

.as-show__mark {
  height: 22px;
  margin-bottom: 8px;
  width: auto;
}

.as-show__tile {
  align-items: center;
  border-radius: 10px;
  color: var(--as-rail-text);
  display: flex;
  flex-direction: column;
  font-size: 9.5px;
  font-weight: 500;
  gap: 3px;
  padding: 7px 0 6px;
  position: relative;
  width: 100%;

  &--active {
    background: var(--as-rail-active-bg);
    color: var(--as-rail-active);

    &::before {
      background: var(--as-rail-bar);
      border-radius: 0 3px 3px 0;
      bottom: 8px;
      content: "";
      left: -6px;
      position: absolute;
      top: 8px;
      width: 3px;
    }
  }
}

.as-show__panel {
  background: var(--as-panel);
  box-shadow: var(--as-panel-edge);
  color: var(--as-panel-text);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: 2px;
  padding: 16px 10px;
  width: 190px;
}

.as-show__panel-title {
  color: var(--color-neutral-900);
  font-size: 14px;
  font-weight: 700;
  margin: 0 6px 10px;
}

.as-show__item {
  align-items: center;
  border-radius: 8px;
  display: flex;
  font-size: 13px;
  gap: 9px;
  padding: 7px 8px;

  b {
    background: var(--color-primary-100);
    border-radius: 999px;
    color: var(--color-primary-700);
    font-size: 10px;
    font-weight: 600;
    margin-left: auto;
    padding: 1px 7px;
  }

  &--active {
    background: var(--as-nav-bg);
    box-shadow: var(--as-nav-ring);
    color: var(--as-nav-text);
    font-weight: 600;
  }
}

.as-show__main {
  flex: 1;
  min-width: 0;
  padding: 16px;
}

.as-show__blade {
  background: var(--color-neutral-0);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 8%);
  color: var(--color-neutral-700);
  height: 100%;
  overflow: hidden;
}

.as-show__blade-title {
  align-items: center;
  border-bottom: 1px solid var(--color-neutral-200);
  color: var(--color-neutral-900);
  display: flex;
  font-size: 16px;
  font-weight: 700;
  gap: 12px;
  padding: 16px 18px 12px;

  small {
    color: var(--color-neutral-500);
    font-size: 12px;
    font-weight: 400;
  }
}

.as-show__toolbar {
  border-bottom: 1px solid var(--color-neutral-200);
  display: flex;
  gap: 18px;
  padding: 8px 18px;

  span {
    align-items: center;
    color: var(--color-neutral-700);
    display: flex;
    font-size: 11px;
    gap: 5px;
  }
}

.as-show__row {
  align-items: center;
  border-bottom: 1px solid var(--color-neutral-100);
  display: grid;
  font-size: 12px;
  gap: 12px;
  grid-template-columns: 1.15fr 1.4fr 0.9fr 0.9fr;
  padding: 10px 18px;
  white-space: nowrap;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &--head {
    background: var(--color-primary-50);
    color: var(--color-neutral-900);
    font-weight: 600;
  }

  &--quote {
    grid-template-columns: 2fr 0.7fr 0.9fr 0.9fr;
  }
}

.as-show__status {
  align-items: center;
  border: 1px solid var(--color-neutral-300);
  border-radius: 999px;
  color: var(--color-neutral-700);
  display: inline-flex;
  font-size: 11px;
  font-weight: 500;
  gap: 5px;
  justify-self: start;
  padding: 1px 8px;

  &::before {
    border-radius: 50%;
    content: "";
    height: 6px;
    width: 6px;
  }

  &--info::before {
    background: var(--color-info-500);
  }

  &--warning::before {
    background: var(--color-warning-500);
  }

  &--success::before {
    background: var(--color-success-500);
  }

  &--danger::before {
    background: var(--color-danger-500);
  }
}

/* catalog: product cards with their tier price */
.as-show__grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding: 16px 18px;
}

.as-show__product {
  border: 1px solid var(--color-neutral-200);
  border-radius: 12px;
  font-size: 12px;
  padding: 10px;
}

.as-show__product-image {
  align-items: center;
  background: hsl(var(--as-hue) 70% 50% / 12%);
  border-radius: 8px;
  color: hsl(var(--as-hue) 60% 45%);
  display: flex;
  height: 84px;
  justify-content: center;
  margin-bottom: 10px;
}

.as-show__product-name {
  color: var(--color-neutral-900);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.as-show__product-code {
  color: var(--color-neutral-500);
  font-size: 11px;
  margin-top: 2px;
}

.as-show__product-price {
  color: var(--color-neutral-900);
  font-weight: 600;
  margin-top: 8px;

  small {
    color: var(--color-success-600);
    font-size: 11px;
    font-weight: 500;
    margin-left: 4px;
  }
}

/* quote: header fields, lines and totals */
.as-show__fields {
  display: grid;
  gap: 12px 24px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding: 14px 18px;

  div {
    color: var(--color-neutral-900);
    font-size: 12px;
  }

  small {
    color: var(--color-neutral-500);
    display: block;
    font-size: 11px;
    margin-bottom: 2px;
  }
}

.as-show__totals {
  align-items: flex-end;
  display: flex;
  flex-direction: column;
  font-size: 12px;
  gap: 6px;
  padding: 14px 18px;

  span {
    color: var(--color-neutral-500);
    display: flex;
    gap: 24px;
    justify-content: space-between;
    min-width: 220px;
  }

  b {
    color: var(--color-neutral-900);
    font-weight: 600;
  }
}

.as-show__grand {
  border-top: 1px solid var(--color-neutral-200);
  font-size: 14px;
  padding-top: 6px;
}

/* developers: a code editor */
.as-show__code {
  background: #0d1117;
  color: #c9d1d9;
  display: grid;
  flex: 1;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12.5px;
  grid-template-columns: 1fr 1fr;
  line-height: 1.7;
  min-height: 0;

  pre {
    margin: 0;
    overflow: hidden;
    padding: 18px 20px;
    white-space: pre;
  }

  .c {
    color: #8b949e;
  }

  .k {
    color: #ff7b72;
  }

  .f {
    color: #d2a8ff;
  }

  .v {
    color: #ffa657;
  }

  .t {
    color: #79c0ff;
  }

  .s {
    color: #a5d6ff;
  }

  .a {
    color: #7ee787;
  }

  .n {
    color: #79c0ff;
  }

  .p {
    color: #c9d1d9;
  }
}

.as-show__answer {
  border-left: 1px solid rgb(255 255 255 / 8%);
}
</style>
