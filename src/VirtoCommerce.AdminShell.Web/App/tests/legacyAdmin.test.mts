// Where the shell finds the AngularJS admin (src/shell/legacyAdmin.ts).
// Runs on Node's own test runner, which strips the TypeScript types itself: node --test tests/
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

type Fetch = typeof globalThis.fetch;
const realFetch = globalThis.fetch;
let loads = 0;

/** a fresh copy of the module: its answer is kept per page, so each test starts from an empty cache */
async function load() {
  return (await import(`../src/shell/legacyAdmin.ts?copy=${++loads}`)) as typeof import("../src/shell/legacyAdmin.ts");
}

/** answers ui/context requests in turn and counts them */
function serve(...responses: Array<{ status: number; body?: unknown } | Error>) {
  const calls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    calls.push(String(url));
    const next = responses[Math.min(calls.length, responses.length) - 1];
    if (next instanceof Error) throw next;
    return new Response(next.body === undefined ? null : JSON.stringify(next.body), { status: next.status });
  }) as Fetch;
  return calls;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

test("the AngularJS admin owns the site root: its page is /", async () => {
  serve({
    status: 200,
    body: {
      adminUIs: [
        { id: "platform", url: "/" },
        { id: "admin-shell", url: "/apps/admin-shell/" },
      ],
    },
  });
  const { legacyAdminBaseUrl } = await load();

  assert.equal(await legacyAdminBaseUrl(), "/");
});

test("the shell owns the site root: the AngularJS admin is at /apps/platform/", async () => {
  serve({
    status: 200,
    body: {
      adminUIs: [
        { id: "admin-shell", url: "/" },
        { id: "platform", url: "/apps/platform/" },
      ],
    },
  });
  const { legacyAdminBaseUrl } = await load();

  assert.equal(await legacyAdminBaseUrl(), "/apps/platform/");
});

test("no AngularJS admin installed: null", async () => {
  serve({ status: 200, body: { adminUIs: [{ id: "admin-shell", url: "/" }] } });
  const { legacyAdminBaseUrl } = await load();

  assert.equal(await legacyAdminBaseUrl(), null);
});

test("a platform without the admin UI list serves the AngularJS admin at the root", async () => {
  serve({ status: 404 });
  const { legacyAdminBaseUrl } = await load();

  assert.equal(await legacyAdminBaseUrl(), "/");
});

test("a context without adminUIs (an older platform's shape) means the root", async () => {
  serve({ status: 200, body: { platformVersion: "3.1092.0" } });
  const { legacyAdminBaseUrl } = await load();

  assert.equal(await legacyAdminBaseUrl(), "/");
});

test("the answer is asked once per page", async () => {
  const calls = serve({ status: 200, body: { adminUIs: [{ id: "platform", url: "/apps/platform/" }] } });
  const { legacyAdminBaseUrl } = await load();

  await Promise.all([legacyAdminBaseUrl(), legacyAdminBaseUrl()]);
  await legacyAdminBaseUrl();

  assert.deepEqual(calls, ["/api/platform/common/ui/context"]);
});

test("a server error gives the root this time and is asked again next time", async () => {
  const calls = serve(
    { status: 503 },
    { status: 200, body: { adminUIs: [{ id: "platform", url: "/apps/platform/" }] } },
  );
  const { legacyAdminBaseUrl } = await load();

  assert.equal(await legacyAdminBaseUrl(), "/");
  assert.equal(await legacyAdminBaseUrl(), "/apps/platform/");
  assert.equal(calls.length, 2);
});

test("a network failure gives the root this time and is asked again next time", async () => {
  const calls = serve(new TypeError("Failed to fetch"), { status: 200, body: { adminUIs: [] } });
  const { legacyAdminBaseUrl } = await load();

  assert.equal(await legacyAdminBaseUrl(), "/");
  assert.equal(await legacyAdminBaseUrl(), null);
  assert.equal(calls.length, 2);
});

test("the embedded admin opens on a state url, in EmbeddedMode", async () => {
  const { legacyAdminSrc } = await load();

  assert.equal(
    legacyAdminSrc("/apps/platform/", "/workspace/store"),
    "/apps/platform/?EmbeddedMode=true#!/workspace/store",
  );
  assert.equal(legacyAdminSrc("/"), "/?EmbeddedMode=true#!/workspace");
});
