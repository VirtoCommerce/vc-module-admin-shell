// The sign-in log's types (src/shell/signInLogTypes.ts).
// Runs on Node's own test runner, which strips the TypeScript types itself: node --test tests/
import assert from "node:assert/strict";
import { test } from "node:test";
import { availableSignInTypes, signInTypeLabel } from "../src/shell/signInLogTypes.ts";

const values = (types: { value: string }[]) => types.map((x) => x.value);
const installed =
  (...ids: string[]) =>
  (id: string) =>
    ids.includes(id);

test("the platform's types are always offered, a module's only while it is installed", () => {
  const none = values(availableSignInTypes([], installed()));
  assert.deepEqual(none, [
    "Password",
    "External",
    "Impersonation",
    "ImpersonationRevert",
    "ClientCredentials",
    "Logout",
  ]);
  const withModules = values(availableSignInTypes([], installed("VirtoCommerce.Passkeys", "VirtoCommerce.MFA")));
  assert.ok(withModules.includes("Passkey") && withModules.includes("MFA"));
  assert.ok(!withModules.includes("OTP"));
});

test("a plugin adds its own type, and can relabel a known one", () => {
  const types = availableSignInTypes(
    [
      { value: "Punchout", label: "PUNCHOUT.TYPE", moduleId: "VirtoCommerce.Punchout" },
      { value: "password", label: "Own password label" },
    ],
    installed("VirtoCommerce.Punchout"),
  );
  assert.ok(values(types).includes("Punchout"));
  assert.equal(types.find((x) => x.value.toLowerCase() === "password")?.label, "Own password label");
  assert.equal(values(types).filter((x) => x.toLowerCase() === "password").length, 1);
});

test("a type nobody registered shows by its value", () => {
  const types = availableSignInTypes([], installed());
  assert.deepEqual(signInTypeLabel("Password", types), {
    label: "PLATFORM.SECURITY.SIGNIN.TYPES.PASSWORD",
    known: true,
  });
  assert.deepEqual(signInTypeLabel("Saml", types), { label: "Saml", known: false });
  assert.deepEqual(signInTypeLabel(undefined, types), { label: "", known: false });
});
