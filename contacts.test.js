const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { createStore } = require("./server");
const { validate } = require("./contacts-model");
const { DatabaseSync } = require("node:sqlite");

test("Contact validation accepts optional email and normalizes Vietnamese phones", () => {
  assert.deepEqual(validate({ name: " Khách thử ", phone: "0901 234 567", email: " " }), { name: "Khách thử", phone: "0901234567", email: "" });
  assert.equal(validate({ name: "A", phone: "+84 901-234-567", email: "test@example.com" }).phone, "+84901234567");
  for (const contact of [null, {}, { name: " ", phone: "0901234567" }, { name: "A", phone: "abcdefgh" },
    { name: "A", phone: "0901234567", email: "not-an-email" }, { name: "A".repeat(101), phone: "0901234567" },
    { name: "A\nB", phone: "0901234567" }]) assert.throws(() => validate(contact), TypeError);
});

test("Contacts API saves persistently, protects admin list, paginates and deduplicates retries", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "rice-contacts-test-"));
  const databasePath = path.join(directory, "test.sqlite");
  const password = "contacts-test-password-only";
  let server;
  let origin;
  const start = async () => {
    server = createStore({ databasePath, password });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
  };
  const stop = async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    server = null;
  };
  const submit = (body, customOrigin = origin) => fetch(origin + "/api/contacts", {
    method: "POST", headers: { Origin: customOrigin, "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  async function login() {
    const response = await fetch(origin + "/api/admin/login", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ username: "Manh Trinh", password }) });
    return response.headers.get("set-cookie").split(";")[0];
  }
  try {
    await start();
    assert.equal((await fetch(origin + "/api/admin/contacts")).status, 401);
    assert.equal((await fetch(origin + "/api/contacts")).status, 404);
    const body = { requestId: crypto.randomUUID(), name: "Khách thử", phone: "0901 234 567", email: "" };
    assert.equal((await submit(body, "https://untrusted.example")).status, 403);
    assert.equal((await submit({ ...body, phone: "invalid" })).status, 400);
    assert.equal((await submit({ ...body, requestId: "invalid" })).status, 400);
    const response = await submit(body);
    assert.equal(response.status, 201);
    const saved = await response.json();
    const retry = await submit(body);
    assert.equal(retry.status, 200);
    assert.deepEqual(await retry.json(), saved);
    assert.equal((await submit({ ...body, name: "Khác" })).status, 409);
    const cookie = await login();
    const listing = await (await fetch(origin + "/api/admin/contacts", { headers: { Cookie: cookie } })).json();
    assert.equal(listing.count, 1);
    assert.equal(listing.contacts[0].phone, "0901234567");
    assert.equal(listing.contacts[0].email, "");
    assert.equal(listing.contacts[0].id, saved.id);
    assert.equal((await fetch(origin + "/api/admin/contacts?page=0", { headers: { Cookie: cookie } })).status, 400);
    await stop();
    const db = new DatabaseSync(databasePath);
    const insert = db.prepare("INSERT INTO contacts VALUES (?, ?, ?, ?, ?, ?, ?)");
    for (let i = 0; i < 26; i++) insert.run(crypto.randomUUID(), crypto.randomUUID(), "test", `2030-01-01T00:00:${String(i).padStart(2, "0")}.000Z`, `Khách ${i}`, "0901234567", "test@example.com");
    db.close();
    await start();
    const newCookie = await login();
    const get = async page => (await fetch(origin + `/api/admin/contacts?page=${page}`, { headers: { Cookie: newCookie } })).json();
    const first = await get(1), second = await get(2);
    assert.equal(first.count, 27);
    assert.equal(first.contacts.length, 25);
    assert.equal(second.contacts.length, 2);
    assert.equal(first.contacts[0].name, "Khách 25");
    assert.equal(second.contacts[1].id, saved.id);
    assert.equal(first.contacts.some(contact => "payload_hash" in contact || "request_id" in contact), false);
    for (let i = 0; i < 10; i++) assert.equal((await submit({ ...body, requestId: crypto.randomUUID() })).status, 201);
    assert.equal((await submit({ ...body, requestId: crypto.randomUUID() })).status, 429);
  } finally {
    if (server) await stop();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
