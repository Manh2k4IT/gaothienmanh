const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createStore } = require("./server");
const { defaults, migrate, validate, validImage } = require("./site-content-model");
const { DatabaseSync } = require("node:sqlite");

test("Header migration preserves custom content and seeds existing contact information once", () => {
  const old = defaults();
  delete old.header;
  old.footer.phone = "0909 111 222";
  old.footer.email = "custom@example.com";
  old.hero.title = "Tiêu đề đang lưu";
  const upgraded = validate(migrate(old));
  assert.equal(upgraded.header.phone, old.footer.phone);
  assert.equal(upgraded.header.email, old.footer.email);
  assert.equal(upgraded.hero.title, old.hero.title);
  assert.equal(old.header, undefined);
  assert.equal(migrate(upgraded), upgraded);
  upgraded.header.introHref = "javascript:alert(1)";
  assert.throws(() => validate(upgraded), TypeError);
});

test("Site content validates text, links and raster images without HTML interpretation", () => {
  const content = defaults();
  assert.deepEqual(validate(content), content);
  content.hero.title = "<img onerror=alert(1)>";
  assert.equal(validate(content).hero.title, content.hero.title);
  for (const href of ["javascript:alert(1)", "//external.example", "data:text/html,test"]) {
    content.hero.href = href;
    assert.throws(() => validate(content), TypeError);
  }
  for (const image of ["data:image/svg+xml;base64,PHN2Zz4=", "data:image/png;base64,YWJj", "javascript:alert(1)", "../logo.png"]) assert.equal(validImage(image), false);
  const png = "data:image/png;base64," + Buffer.from("\x89PNG\r\n\x1a\nhello", "latin1").toString("base64");
  assert.equal(validImage(png), true);
  assert.equal(validImage("data:image/png;base64," + "A".repeat(1400000)), false);
  assert.throws(() => validate({}), TypeError);
  const invalid = defaults();
  invalid.footer.phone = "not-a-phone";
  assert.throws(() => validate(invalid), TypeError);
  invalid.footer.phone = "0901 234 567";
  invalid.footer.email = "invalid";
  assert.throws(() => validate(invalid), TypeError);
});

test("Benefits migration preserves all saved sections and edits across repeated migrations", () => {
  const old = defaults();
  delete old.benefits;
  old.header.phone = "0909 111 222";
  old.hero.title = "Tiêu đề riêng";
  const upgraded = validate(migrate(old));
  assert.deepEqual(upgraded.benefits, defaults().benefits);
  assert.deepEqual(upgraded.header, old.header);
  assert.deepEqual(upgraded.hero, old.hero);
  upgraded.benefits.title0 = "Cam kết riêng";
  assert.equal(migrate(upgraded), upgraded);
  assert.equal(validate(upgraded).benefits.title0, "Cam kết riêng");
  upgraded.benefits.description1 = "";
  assert.throws(() => validate(upgraded), TypeError);
});

test("Site content API: authentication, same-origin, conflict, persistence and image publication", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "rice-content-test-"));
  const databasePath = path.join(directory, "test.sqlite");
  const password = "content-test-password-only";
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
  const save = (body, cookie = "", customOrigin = origin) => fetch(origin + "/api/admin/site-content", {
    method: "PUT", headers: { Origin: customOrigin, Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  try {
    await start();
    const initial = await (await fetch(origin + "/api/site-content")).json();
    assert.deepEqual(initial, { content: defaults(), version: 1 });
    assert.equal((await fetch(origin + "/api/admin/site-content")).status, 401);
    assert.equal((await save(initial)).status, 401);
    const login = await fetch(origin + "/api/admin/login", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    const cookie = login.headers.get("set-cookie").split(";")[0];
    initial.content.brand.name = "Cửa hàng mới";
    initial.content.brand.logo = "data:image/png;base64," + Buffer.from("\x89PNG\r\n\x1a\nhello", "latin1").toString("base64");
    assert.equal((await save(initial, cookie, "https://untrusted.example")).status, 403);
    const invalid = JSON.parse(JSON.stringify(initial));
    invalid.content.story.href = "javascript:alert(1)";
    assert.equal((await save(invalid, cookie)).status, 400);
    const response = await save(initial, cookie);
    assert.equal(response.status, 200);
    const saved = await response.json();
    assert.equal(saved.version, 2);
    assert.deepEqual(saved.content, initial.content);
    assert.equal((await save(initial, cookie)).status, 409);
    await stop();
    await start();
    assert.deepEqual(await (await fetch(origin + "/api/site-content")).json(), saved);
    await stop();
    const legacy = JSON.parse(JSON.stringify(saved));
    delete legacy.content.header;
    delete legacy.content.benefits;
    legacy.content.footer.phone = "0909 111 222";
    const db = new DatabaseSync(databasePath);
    db.prepare("UPDATE settings SET value = ? WHERE key = 'site-content'").run(JSON.stringify(legacy));
    db.close();
    await start();
    const upgraded = await (await fetch(origin + "/api/site-content")).json();
    assert.equal(upgraded.version, saved.version + 1);
    assert.equal(upgraded.content.header.phone, legacy.content.footer.phone);
    assert.deepEqual(upgraded.content.benefits, defaults().benefits);
    assert.equal(upgraded.content.brand.name, saved.content.brand.name);
    await stop();
    await start();
    assert.deepEqual(await (await fetch(origin + "/api/site-content")).json(), upgraded);
  } finally {
    if (server) await stop();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
