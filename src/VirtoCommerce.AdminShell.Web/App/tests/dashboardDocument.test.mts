// The Dashboard Editor's JSON document (src/modules/platform/pages/dashboard/document.ts). Node's test runner: node --test tests/
import assert from "node:assert/strict";
import { test } from "node:test";
import { documentText, parseDocument } from "../src/modules/platform/pages/dashboard/document.ts";

test("a document reads back as it was written", () => {
  const doc = {
    everyone: { widgets: { "shell-alerts": { hidden: true }, "orders-recent": { x: 0, y: 10, width: 12 } } },
    roles: { "Order manager": ["orders-to-process"] },
    personalization: { allowMove: true, allowResize: false },
  };
  assert.deepEqual(parseDocument(documentText(doc)), { doc });
});

test("an empty object is a document: no rules, the modules' layout", () => {
  assert.deepEqual(parseDocument("{}"), { doc: {} });
});

test("text that isn't JSON says why", () => {
  const result = parseDocument("{ oops");
  assert.ok("error" in result && result.error !== "shape");
});

test("the wrong shape is refused", () => {
  for (const text of [
    "[]",
    "42",
    '{"everyone": []}',
    '{"everyone": {"widgets": []}}',
    '{"roles": {"Order manager": "orders-recent"}}',
    '{"roles": {"Order manager": [1]}}',
    '{"personalization": true}',
  ]) {
    assert.deepEqual(parseDocument(text), { error: "shape" }, text);
  }
});
