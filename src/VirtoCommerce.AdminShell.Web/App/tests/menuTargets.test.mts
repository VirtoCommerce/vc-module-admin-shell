// Which menu item a classic (AngularJS) screen belongs to (src/shell/menuTargets.ts).
// Runs on Node's own test runner, which strips the TypeScript types itself: node --test tests/
import assert from "node:assert/strict";
import { test } from "node:test";
import { opensLegacy } from "../src/shell/menuTargets.ts";

test("an item opening a classic screen owns it", () => {
  const subscriptions = { target: { type: "legacy" as const, legacyUrl: "/workspace/subscriptions" } };
  assert.equal(opensLegacy(subscriptions, "/workspace/subscriptions"), true);
  assert.equal(opensLegacy(subscriptions, "/workspace/orders"), false);
});

test("an item whose Vue screen replaced a classic one still owns the classic screen", () => {
  const orders = {
    target: { type: "vue" as const, route: "/orders" },
    fallback: { type: "legacy" as const, legacyUrl: "/workspace/orders" },
  };
  assert.equal(opensLegacy(orders, "/workspace/orders"), true);
});

test("case and a trailing slash don't make another screen", () => {
  const inventory = { target: { type: "legacy" as const, legacyUrl: "/workspace/Inventory" } };
  assert.equal(opensLegacy(inventory, "/workspace/inventory/"), true);
});

test("an item without a classic screen owns none", () => {
  assert.equal(opensLegacy({ target: { type: "vue" as const, route: "/modules" } }, "/workspace"), false);
  assert.equal(opensLegacy({}, ""), false);
});
