// The notice about modules that failed to start (src/shell/moduleErrors.ts).
// Runs on Node's own test runner, which strips the TypeScript types itself: node --test tests/
import assert from "node:assert/strict";
import { test } from "node:test";
import { failureKey, failureReport, failureSummary, firstLine } from "../src/shell/moduleErrors.ts";

const more = (count: number) => `and ${count} more`;
const systemOperations = {
  id: "VirtoCommerce.SystemOperations",
  title: "System Operations",
  errors: ["System.MissingMethodException: Method not found: 'X'.\r\n   at Y.Z()\r\n   at A.B()"],
};

test("one failed module: its title and what went wrong, without the stack trace", () => {
  assert.equal(
    failureSummary([systemOperations], more),
    "System Operations: System.MissingMethodException: Method not found: 'X'.",
  );
});

test("a failed module without an error text: its title", () => {
  assert.equal(failureSummary([{ id: "a", title: "Catalog", errors: [] }], more), "Catalog");
});

test("several failed modules: the first two titles and how many more", () => {
  const modules = ["Catalog", "Orders", "Store", "Pricing"].map((title) => ({ id: title, title, errors: ["x"] }));
  assert.equal(failureSummary(modules.slice(0, 2), more), "Catalog, Orders");
  assert.equal(failureSummary(modules, more), "Catalog, Orders and 2 more");
});

test("the same modules failing are the same failure, in any order; another module is a new one", () => {
  const a = { id: "A", title: "A", errors: [] };
  const b = { id: "B", title: "B", errors: [] };
  assert.equal(failureKey([a, b]), failureKey([b, a]));
  assert.notEqual(failureKey([a]), failureKey([a, b]));
});

test("the copied details: the title, then each module with its id, version and full errors", () => {
  const catalog = { id: "VirtoCommerce.Catalog", title: "Catalog", version: "3.1052.0", errors: [" A\n at B ", "C"] };
  const noVersion = { id: "X", title: "X module", errors: [] };
  assert.equal(
    failureReport([catalog, noVersion], "2 modules failed to start"),
    "2 modules failed to start\n\nCatalog (VirtoCommerce.Catalog 3.1052.0)\nA\n at B\nC\n\nX module (X)",
  );
});

test("the first line of an error", () => {
  assert.equal(firstLine("one\ntwo"), "one");
  assert.equal(firstLine(undefined), "");
});
