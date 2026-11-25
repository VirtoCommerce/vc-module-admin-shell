// Which broadcast notifications the shell shows (src/shell/broadcastFilter.ts).
// Runs on Node's own test runner, which strips the TypeScript types itself: node --test tests/
import assert from "node:assert/strict";
import { test } from "node:test";
import { isOwnBroadcast } from "../src/shell/broadcastFilter.ts";

test("a broadcast created by another user is dropped", () => {
  assert.equal(isOwnBroadcast({ creator: "bob" }, "alice"), false);
});

test("a broadcast created by the current user is kept", () => {
  assert.equal(isOwnBroadcast({ creator: "alice" }, "alice"), true);
});

test("a broadcast of the system, a job nobody enqueued, is dropped", () => {
  assert.equal(isOwnBroadcast({ creator: "system" }, "alice"), false);
});

test("a broadcast without a creator is dropped", () => {
  assert.equal(isOwnBroadcast({}, "alice"), false);
  assert.equal(isOwnBroadcast({ creator: "" }, "alice"), false);
});

test("the user name is not known yet: every broadcast is dropped, even one without a creator", () => {
  assert.equal(isOwnBroadcast({ creator: "alice" }, undefined), false);
  assert.equal(isOwnBroadcast({ creator: "alice" }, ""), false);
  assert.equal(isOwnBroadcast({}, undefined), false);
  assert.equal(isOwnBroadcast({ creator: "" }, ""), false);
});

test("the comparison ignores case: the platform matches user names that way", () => {
  assert.equal(isOwnBroadcast({ creator: "Alice" }, "alice"), true);
  assert.equal(isOwnBroadcast({ creator: "alice" }, "ALICE"), true);
});
