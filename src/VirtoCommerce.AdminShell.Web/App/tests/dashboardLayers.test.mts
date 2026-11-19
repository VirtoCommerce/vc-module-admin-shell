// The dashboard layers on the client (src/shell/dashboard/layers.ts). Runs on Node's own test runner: node --test tests/
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  diffLayout,
  fromStorage,
  hiddenIn,
  layoutIn,
  readEffective,
  roleCanSee,
  toPatch,
  toStorage,
  visibleWidgets,
  withDefaults,
} from "../src/shell/dashboard/layers.ts";

const alerts = { id: "shell-alerts", size: { width: 7, height: 5 }, position: { x: 0, y: 0 } };
const activity = { id: "shell-activity", size: { width: 5, height: 5 }, position: { x: 7, y: 0 } };
const sales = { id: "orders-sales", size: { width: 4, height: 5 }, position: { x: 0, y: 5 } };

test("nothing configured: every widget at its module's place", () => {
  assert.deepEqual(visibleWidgets([alerts, activity], readEffective(undefined)), [alerts, activity]);
});

test("hidden for everyone, by the roles or by the user: left out", () => {
  const dashboard = readEffective({ hidden: ["shell-alerts"], userHidden: ["orders-sales"] });
  assert.deepEqual(
    visibleWidgets([alerts, activity, sales], dashboard).map((w) => w.id),
    ["shell-activity"],
  );
});

test("the layout for everyone moves and resizes a widget, keeping what it doesn't name", () => {
  assert.deepEqual(withDefaults(alerts, { "shell-alerts": { width: 12, height: 4 } }), {
    ...alerts,
    size: { width: 12, height: 4 },
    position: { x: 0, y: 0 },
  });
});

test("the user's layout fills vc-shell's storage only for the widgets the user changed", () => {
  assert.deepEqual(toStorage([alerts, activity], { "shell-activity": { y: 7 } }), [
    { id: "shell-activity", x: 7, y: 7, w: 5, h: 5 },
  ]);
});

test("a stored layout that isn't one reads as none", () => {
  assert.deepEqual(fromStorage("{oops"), []);
  assert.deepEqual(fromStorage('{"a":1}'), []);
  assert.deepEqual(fromStorage('[{"id":"a","x":1}]'), []);
});

test("the diff keeps only what moved or changed size", () => {
  const placements = [
    { id: "shell-alerts", x: 0, y: 0, w: 7, h: 5 },
    { id: "shell-activity", x: 0, y: 5, w: 5, h: 5 },
    { id: "orders-sales", x: 0, y: 5, w: 6, h: 5 },
    { id: "not-installed", x: 1, y: 1, w: 1, h: 1 },
  ];
  assert.deepEqual(diffLayout(placements, [alerts, activity, sales]), {
    "shell-activity": { x: 0, y: 5 },
    "orders-sales": { width: 6, height: 5 },
  });
});

test("a layer from hidden widgets and a layout, and back", () => {
  const widgets = toPatch(["shell-alerts"], { "shell-alerts": { width: 12 }, "orders-sales": { x: 1, y: 2 } });
  assert.deepEqual(widgets, {
    "shell-alerts": { width: 12, hidden: true },
    "orders-sales": { x: 1, y: 2 },
  });
  assert.deepEqual(hiddenIn(widgets), ["shell-alerts"]);
  assert.deepEqual(layoutIn(widgets), { "shell-alerts": { width: 12 }, "orders-sales": { x: 1, y: 2 } });
});

test("a role sees a widget it has a permission of, or one that asks for none", () => {
  assert.equal(roleCanSee(undefined, []), true);
  assert.equal(roleCanSee(["platform:security:read"], ["platform:security:read"]), true);
  assert.equal(roleCanSee(["platform:security:read"], ["order:read"]), false);
});
