// The rules of the OAuth application form (src/modules/platform/composables/oauth-apps.ts).
// Runs on Node's own test runner, which strips the TypeScript types itself: node --test tests/
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  findApp,
  hasGrantType,
  otherPermissions,
  requiresPkce,
  resourcesOf,
  saveApp,
  setPermission,
  setPkce,
  setResources,
  uriProblem,
  type OAuthApp,
} from "../src/modules/platform/composables/oauth-apps.ts";

type Fetch = typeof globalThis.fetch;
const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

function serve(status: number, body?: unknown) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(body === undefined ? null : JSON.stringify(body), { status });
  }) as Fetch;
  return calls;
}

test("redirect URIs: absolute, without a fragment, HTTPS unless loopback", () => {
  assert.equal(uriProblem("https://claude.ai/api/mcp/auth_callback"), undefined);
  assert.equal(uriProblem("http://localhost:65111/callback"), undefined);
  assert.equal(uriProblem("http://127.0.0.1:33418"), undefined);
  assert.equal(uriProblem("http://[::1]/callback"), undefined);
  assert.equal(uriProblem("cursor://anysphere.cursor-retrieval/oauth/callback"), undefined);
  assert.equal(uriProblem("http://agent.example.com/callback"), "http");
  assert.equal(uriProblem("https://agent.example.com/callback#done"), "fragment");
  assert.equal(uriProblem("/callback"), "invalid");
  assert.equal(uriProblem("file:///c:/callback"), "invalid");
});

test("grant types and scopes are toggled without touching the other permissions", () => {
  const app: OAuthApp = { permissions: ["gt:client_credentials", "ept:token", "rsrc:https://p.example.com/admin/mcp"] };

  setPermission(app, "gt:authorization_code", true);
  setPermission(app, "gt:client_credentials", false);

  assert.deepEqual(app.permissions, ["ept:token", "rsrc:https://p.example.com/admin/mcp", "gt:authorization_code"]);
  assert.equal(hasGrantType(app), true);
  setPermission(app, "gt:authorization_code", false);
  assert.equal(hasGrantType(app), false);
});

test("resources are the rsrc: permissions, without duplicates", () => {
  const app: OAuthApp = { permissions: ["gt:refresh_token", "rsrc:https://a.example.com/mcp"] };

  setResources(app, [
    "https://a.example.com/mcp",
    " https://b.example.com/ucp/mcp ",
    "https://b.example.com/ucp/mcp",
    "",
  ]);

  assert.deepEqual(resourcesOf(app), ["https://a.example.com/mcp", "https://b.example.com/ucp/mcp"]);
  assert.ok(app.permissions!.includes("gt:refresh_token"));
});

test("other permissions are those the form doesn't edit or derive", () => {
  const app: OAuthApp = {
    permissions: [
      "gt:authorization_code",
      "scp:profile",
      "ept:authorization",
      "ept:token",
      "rst:code",
      "rsrc:https://a.example.com/mcp",
      "ept:introspection",
      "gt:urn:ietf:params:oauth:grant-type:device_code",
      "scp:custom",
    ],
  };

  assert.deepEqual(otherPermissions(app), [
    "ept:introspection",
    "gt:urn:ietf:params:oauth:grant-type:device_code",
    "scp:custom",
  ]);
});

test("PKCE is the ft:pkce requirement", () => {
  const app: OAuthApp = { requirements: ["ft:other"] };

  setPkce(app, true);
  assert.equal(requiresPkce(app), true);
  setPkce(app, false);
  assert.deepEqual(app.requirements, ["ft:other"]);
});

test("findApp reads the application by client id and answers undefined for an unknown one", async () => {
  const calls = serve(200, { clientId: "claude code" });
  assert.deepEqual(await findApp("claude code"), { clientId: "claude code" });
  assert.equal(calls[0].url, "/api/platform/oauthapps/claude%20code");

  serve(404);
  assert.equal(await findApp("missing"), undefined);
});

test("saveApp posts the application and throws with the platform's reasons", async () => {
  const calls = serve(200, { clientId: "agent" });
  await saveApp({ clientId: "agent", clientType: "public" });
  assert.equal(calls[0].init?.method, "POST");
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { clientId: "agent", clientType: "public" });

  serve(400, { succeeded: false, errors: ["A public client can't have a client secret."] });
  await assert.rejects(saveApp({ clientId: "agent" }), /public client can't have a client secret/);
});
