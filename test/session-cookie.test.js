const test = require("node:test");
const assert = require("node:assert/strict");
const {
  readSessionToken,
  sessionCookie,
} = require("../src/security/session-cookie");

test("Hosting cookies distinguish root and tenant sessions regardless of cookie order", () => {
  for (const cookie of [
    "__session=web.root; __session=store.garden.customer",
    "__session=store.garden.customer; __session=web.root",
  ]) {
    const req = { headers: { cookie } };
    assert.equal(readSessionToken(req, "web", "conflora_session"), "root");
    assert.equal(
      readSessionToken(req, "store.garden", "store_session"),
      "customer",
    );
    assert.equal(
      readSessionToken(req, "store.pets", "store_session"),
      undefined,
    );
  }
});

test("existing direct Cloud Run cookies remain readable during migration", () => {
  const req = {
    headers: { cookie: "conflora_session=old; __session=web.new" },
  };
  assert.equal(readSessionToken(req, "web", "conflora_session"), "new");
  req.headers.cookie = "conflora_session=old";
  assert.equal(readSessionToken(req, "web", "conflora_session"), "old");
});

test("session cookies retain security flags and logout expires the same path", () => {
  const options = {
    scope: "store.garden",
    token: "value",
    path: "/api/stores/garden",
    maxAge: 43200,
  };
  assert.equal(
    sessionCookie({ secure: true }, options),
    "__session=store.garden.value; Path=/api/stores/garden; HttpOnly; SameSite=Strict; Max-Age=43200; Secure",
  );
  assert.equal(
    sessionCookie({ secure: true }, { ...options, token: "", maxAge: 0 }),
    "__session=; Path=/api/stores/garden; HttpOnly; SameSite=Strict; Max-Age=0; Secure",
  );
});
