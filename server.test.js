const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { createStore } = require("./server");
const { defaultMenu, validateMenu, validLink, validateCategory, defaultCategory, syncCategoryLinks } = require("./menu-model");
const { validateCategories, slugify, filterProducts, href } = require("./categories-model");

test("Product categories: unique slugs, membership, limits and search within a category", () => {
  const products = [
    { id: "lai-1", name: "Gạo lài 1", origin: "An Giang" },
    { id: "lai-2", name: "Gạo lài 2", origin: "Long An" },
    { id: "st25", name: "Gạo ST25", origin: "Sóc Trăng" }
  ];
  const category = { id: "cat-1", name: " Gạo lài ", slug: "gao-lai", productIds: ["lai-1", "lai-2"] };
  assert.equal(slugify("Gạo lài Đặc biệt"), "gao-lai-dac-biet");
  assert.equal(validateCategories([category])[0].name, "Gạo lài");
  assert.equal(href(category), "gao.html?category=gao-lai");
  assert.deepEqual(filterProducts(products, category).map((item) => item.id), ["lai-1", "lai-2"]);
  assert.deepEqual(filterProducts(products, category, "LONG AN").map((item) => item.id), ["lai-2"]);
  assert.deepEqual(filterProducts(products, category, "ST25"), []);
  assert.deepEqual(filterProducts(products, { ...category, productIds: [] }), []);
  assert.deepEqual(filterProducts(products, null), products);
  assert.deepEqual(filterProducts(products, { ...category, productIds: ["deleted"] }), []);
  for (const items of [null, Array(101).fill(category), [category, { ...category, id: "cat-2" }],
    [category, { ...category, slug: "different" }], [{ ...category, name: "" }], [{ ...category, slug: "../gao" }],
    [{ ...category, productIds: ["lai-1", "lai-1"] }], [{ ...category, productIds: ["x".repeat(201)] }]]) {
    assert.throws(() => validateCategories(items), TypeError);
  }
});

test("Product categories API: authenticated writes, membership, stale edits, persistence and deletion", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "rice-categories-test-"));
  const databasePath = path.join(directory, "test.sqlite");
  const password = crypto.randomBytes(24).toString("hex");
  let server;
  let origin;
  const start = async () => {
    server = createStore({ databasePath, password });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
  };
  const stop = async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    server = null;
  };
  async function login() {
    const response = await fetch(origin + "/api/admin/login", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    return response.headers.get("set-cookie").split(";")[0];
  }
  async function save(body, cookie, customOrigin = origin) {
    return fetch(origin + "/api/admin/categories", { method: "PUT", headers: { Origin: customOrigin, "Content-Type": "application/json", Cookie: cookie || "" }, body: JSON.stringify(body) });
  }
  try {
    await start();
    assert.deepEqual(await (await fetch(origin + "/api/categories")).json(), { items: [], version: 1 });
    assert.equal((await fetch(origin + "/api/admin/categories")).status, 401);
    assert.equal((await save({ items: [], version: 1 })).status, 401);
    const cookie = await login();
    const products = (await (await fetch(origin + "/api/catalog")).json()).products;
    const items = [
      { id: "lai", name: "Gạo lài", slug: "gao-lai", productIds: [products[0].id, products[1].id] },
      { id: "premium", name: "Cao cấp", slug: "cao-cap", productIds: [products[1].id] }
    ];
    assert.equal((await save({ items, version: 1 }, cookie, "https://untrusted.example")).status, 403);
    assert.equal((await save({ items: [{ ...items[0], productIds: ["unknown"] }], version: 1 }, cookie)).status, 400);
    assert.equal((await save({ items: [items[0], { ...items[1], slug: "gao-lai" }], version: 1 }, cookie)).status, 400);
    assert.equal((await save({ items, version: 1 }, cookie)).status, 200);
    const menu = await (await fetch(origin + "/api/menu")).json();
    assert.deepEqual(menu.category.children.slice(-2), items.map((item) => ({ label: item.name, href: href(item) })));
    const editedCategory = { ...menu.category, children: menu.category.children.filter((child) => child.href !== href(items[0])) };
    assert.equal((await fetch(origin + "/api/admin/menu", { method: "PUT", headers: { Origin: origin, Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ ...menu, category: editedCategory }) })).status, 200);
    assert.equal((await save({ items: [], version: 1 }, cookie)).status, 409);
    assert.deepEqual(await (await fetch(origin + "/api/admin/categories", { headers: { Cookie: cookie } })).json(), { items, version: 2 });
    await stop();
    await start();
    assert.deepEqual(await (await fetch(origin + "/api/categories")).json(), { items, version: 2 });
    const menuAfterRestart = await (await fetch(origin + "/api/menu")).json();
    assert.deepEqual(menuAfterRestart.category, editedCategory);
    const secondCookie = await login();
    assert.equal((await save({ items: [], version: 2 }, secondCookie)).status, 200);
    assert.deepEqual(await (await fetch(origin + "/api/categories")).json(), { items: [], version: 3 });
    assert.ok(!(await (await fetch(origin + "/api/menu")).json()).category.children.some((child) => child.href.startsWith("gao.html?category=")));
    assert.deepEqual((await (await fetch(origin + "/api/catalog")).json()).products, products);
    assert.equal((await fetch(origin + "/admin-danh-muc.html")).status, 200);
  } finally {
    if (server) await stop();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("Menu model validates links, limits and one-level dropdowns", () => {
  assert.deepEqual(validateMenu(defaultMenu), defaultMenu);
  for (const href of ["gao.html", "/gao.html", "index.html#lien-he", "?category=gao", "#contact", "https://example.com/rice", "tel:+84901234567", "mailto:hello@example.com"]) assert.equal(validLink(href), true, href);
  for (const href of ["", "javascript:alert(1)", "data:text/html,test", "//example.com", "\\example.com", "https://user:pass@example.com", "a b.html", "a%0a.html", "a%5c.html"]) assert.equal(validLink(href), false, href);
  const item = { label: " Rice ", href: "gao.html", children: [{ label: "ST25", href: "chi-tiet-gao.html?id=gao-st25" }] };
  assert.equal(validateMenu([item])[0].label, "Rice");
  assert.deepEqual(validateMenu([]), []);
  assert.equal(validateCategory({ ...item, children: Array(100).fill(item.children[0]) }).children.length, 100);
  assert.throws(() => validateCategory({ ...item, children: Array(201).fill(item.children[0]) }), TypeError);
  assert.throws(() => validateCategory({ ...item, href: "javascript:alert(1)" }), TypeError);
  for (const items of [null, Array(13).fill(item), [{ ...item, children: Array(21).fill(item.children[0]) }], [{ ...item, children: [{ ...item.children[0], children: [] }] }], [{ ...item, label: "x".repeat(61) }], [{ ...item, href: "javascript:alert(1)" }]]) assert.throws(() => validateMenu(items), TypeError);
});

test("Menu category links migrate visible entries once and respect manual removal/order", () => {
  const original = { label: "Rice", href: "gao.html", children: [{ label: "Custom", href: "index.html#contact" }] };
  const categories = [{ id: "lai", name: "Lai", slug: "gao-lai" }];
  const migrated = syncCategoryLinks(original, categories, categories, true);
  assert.deepEqual(migrated.children, [{ label: "Lai", href: "gao.html?category=gao-lai" }, ...original.children]);
  assert.deepEqual(syncCategoryLinks(original, categories, categories), original);
  const renamed = [{ ...categories[0], name: "Lai new", slug: "gao-lai-new" }];
  assert.equal(syncCategoryLinks(migrated, categories, renamed).children[0].label, "Lai new");
  assert.equal(syncCategoryLinks(migrated, categories, renamed).children[0].href, "gao.html?category=gao-lai-new");
  assert.deepEqual(syncCategoryLinks(migrated, categories, []).children, original.children);
  assert.deepEqual(syncCategoryLinks(original, [], categories).children, [...original.children, { label: "Lai", href: "gao.html?category=gao-lai" }]);
});

test("Menu API saves, protects access, detects stale edits and persists after restart", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "rice-menu-test-"));
  const databasePath = path.join(directory, "menu.sqlite");
  const password = crypto.randomBytes(24).toString("hex");
  let server;
  let origin;
  const start = async () => {
    server = createStore({ databasePath, password });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
  };
  const stop = async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    server = null;
  };
  const items = [{ label: " Rice ", href: "gao.html", children: [{ label: "ST25", href: "chi-tiet-gao.html?id=gao-st25" }, { label: "Contact", href: "index.html#lien-he" }] }];
  try {
    await start();
    const original = await (await fetch(origin + "/api/menu")).json();
    const products = (await (await fetch(origin + "/api/catalog")).json()).products;
    assert.deepEqual(original, { items: defaultMenu, category: defaultCategory(products), version: 1 });
    assert.equal((await fetch(origin + "/api/admin/menu")).status, 401);
    const login = await fetch(origin + "/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify({ password }) });
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const save = (body, customOrigin = origin, auth = cookie) => fetch(origin + "/api/admin/menu", {
      method: "PUT", headers: { "Content-Type": "application/json", Origin: customOrigin, Cookie: auth }, body: JSON.stringify(body)
    });
    assert.equal((await save({ items, version: 1 }, origin, "")).status, 401);
    assert.equal((await save({ items, version: 1 }, "https://untrusted.example")).status, 403);
    assert.equal((await save({ items: [{ ...items[0], href: "javascript:alert(1)" }], version: 1 })).status, 400);
    assert.equal((await save({ items, category: { ...items[0], href: "javascript:alert(1)" }, version: 1 })).status, 400);
    const category = { label: " My rice ", href: "gao.html", children: [...items[0].children].reverse() };
    const saved = await save({ items, category, version: 1 });
    assert.equal(saved.status, 200);
    const result = await saved.json();
    assert.deepEqual(result, { items: validateMenu(items), category: validateCategory(category), version: 2 });
    assert.equal((await save({ items: [], version: 1 })).status, 409);
    assert.deepEqual(await (await fetch(origin + "/api/menu")).json(), result);
    assert.deepEqual(await (await fetch(origin + "/api/admin/menu", { headers: { Cookie: cookie } })).json(), result);
    await stop();
    await start();
    assert.deepEqual(await (await fetch(origin + "/api/menu")).json(), result);
    const secondLogin = await fetch(origin + "/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify({ password }) });
    assert.equal((await save({ items: [], version: 2 }, origin, secondLogin.headers.get("set-cookie").split(";")[0])).status, 200);
    assert.deepEqual(await (await fetch(origin + "/api/menu")).json(), { items: [], category: result.category, version: 3 });
  } finally {
    if (server) await stop();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("Existing menu migrates category without replacing saved main items", async () => {
  const { DatabaseSync } = require("node:sqlite");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "rice-menu-migration-"));
  const databasePath = path.join(directory, "test.sqlite");
  const db = new DatabaseSync(databasePath);
  const items = [{ label: "Custom", href: "gao.html", children: [] }];
  db.exec("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  db.prepare("INSERT INTO settings VALUES (?, ?)").run("menu", JSON.stringify({ items, version: 7 }));
  db.close();
  let server;
  try {
    server = createStore({ databasePath, password: crypto.randomBytes(24).toString("hex") });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const menu = await (await fetch(origin + "/api/menu")).json();
    assert.deepEqual(menu.items, items);
    assert.equal(menu.version, 8);
    assert.ok(menu.category.children.length > 0);
    assert.deepEqual(validateCategory(menu.category), menu.category);
  } finally {
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("Local admin opens without login, but public origin still requires authentication", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "rice-local-admin-test-"));
  const password = crypto.randomBytes(24).toString("hex");
  try {
    for (const publicOrigin of ["", "https://shop.example"]) {
      const server = createStore({ databasePath: path.join(directory, "test.sqlite"), password, allowLocalAdmin: true, publicOrigin });
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      const origin = `http://127.0.0.1:${server.address().port}`;
      try {
        const session = await fetch(origin + "/api/admin/session");
        assert.equal(session.status, publicOrigin ? 401 : 200);
        if (!publicOrigin) assert.equal((await session.json()).localMode, true);
        assert.equal((await fetch(origin + "/api/admin/orders")).status, publicOrigin ? 401 : 200);
        assert.equal((await fetch(origin + "/api/admin/catalog")).status, publicOrigin ? 401 : 200);
        assert.equal((await fetch(origin + "/api/admin/menu")).status, publicOrigin ? 401 : 200);
        assert.equal((await fetch(origin + "/api/admin/categories")).status, publicOrigin ? 401 : 200);
        const response = await fetch(origin + "/api/admin/catalog", {
          method: "PUT", headers: { "Content-Type": "application/json", Origin: "https://untrusted.example" }, body: "{}"
        });
        assert.equal(response.status, 403);
      } finally {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
      }
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("Order API: authoritative pricing, vouchers, customer validation, persistence and admin access", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "rice-order-test-"));
  const databasePath = path.join(directory, "test.sqlite");
  const password = crypto.randomBytes(24).toString("hex");
  let server;
  let origin;
  const start = async () => {
    server = createStore({ databasePath, password });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
  };
  const stop = async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  };
  async function api(route, { method = "GET", body, cookie, customOrigin } = {}) {
    const response = await fetch(origin + route, { method, headers: { "Content-Type": "application/json", Origin: customOrigin || origin, ...(cookie ? { Cookie: cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0] };
  }
  try {
    await start();
    assert.equal((await api("/api/admin/orders")).status, 401);
    assert.equal((await api("/api/admin/login", { method: "POST", body: { password: "invalid" } })).status, 401);
    const login = await api("/api/admin/login", { method: "POST", body: { password } });
    assert.equal(login.status, 200);
    const cookie = login.cookie;
    const products = (await api("/api/catalog")).body.products;
    products[0].stock = 5;
    const vouchers = [
      { code: "TEST10", type: "percent", value: 10, minimum: 50000, expires: "", active: true },
      { code: "FIXED", type: "fixed", value: 999999, minimum: 0, expires: "", active: true },
      { code: "EXPIRED", type: "percent", value: 10, minimum: 0, expires: "2020-01-01", active: true }
    ];
    assert.equal((await api("/api/admin/catalog", { method: "PUT", body: { products, vouchers }, cookie })).status, 200);
    assert.equal((await api("/api/admin/catalog", { method: "PUT", body: { products, vouchers: [...vouchers, vouchers[0]] }, cookie })).status, 400);
    assert.equal((await api("/api/admin/catalog", { cookie })).body.vouchers.length, 3);
    const items = [{ id: products[0].id, quantity: 2 }];
    const quoted = await api("/api/quote", { method: "POST", body: { items, voucher: "test10" } });
    assert.equal(quoted.body.subtotal, 64000);
    assert.equal(quoted.body.discount, 6400);
    assert.equal(quoted.body.total, 57600);
    assert.equal((await api("/api/quote", { method: "POST", body: { items, voucher: "FIXED" } })).body.total, 0);
    for (const body of [
      { items: [] }, { items: [{ id: "unknown", quantity: 1 }] },
      { items: [...items, ...items] }, { items: [{ id: products[0].id, quantity: 6 }] },
      { items: [{ id: products[0].id, quantity: 1 }], voucher: "TEST10" },
      { items, voucher: "EXPIRED" }, { items, voucher: "UNKNOWN" }
    ]) assert.ok((await api("/api/quote", { method: "POST", body })).status >= 400);
    const body = { requestId: crypto.randomUUID(), accepted: true, customer: { name: "Test Customer", phone: "0901234567", address: "123 Test Street, Test City", note: "<script>test</script>" }, items, voucher: "TEST10", expectedTotal: 57600 };
    assert.equal((await api("/api/orders", { method: "POST", body: { ...body, accepted: false } })).status, 400);
    assert.equal((await api("/api/orders", { method: "POST", body: { ...body, customer: { ...body.customer, phone: "bad" } } })).status, 400);
    assert.equal((await api("/api/orders", { method: "POST", body: { ...body, expectedTotal: 1 } })).status, 409);
    assert.equal((await api("/api/orders", { method: "POST", body, customOrigin: "https://attacker.invalid" })).status, 403);
    const order = await api("/api/orders", { method: "POST", body });
    assert.equal(order.status, 201);
    const retry = await api("/api/orders", { method: "POST", body });
    assert.equal(retry.body.id, order.body.id);
    assert.equal((await api("/api/orders", { method: "POST", body: { ...body, customer: { ...body.customer, name: "Different" } } })).status, 409);
    const orders = await api("/api/admin/orders", { cookie });
    assert.equal(orders.body.count, 1);
    assert.equal(orders.body.orders[0].customer.name, body.customer.name);
    assert.equal(orders.body.orders[0].items[0].price, 32000);
    assert.equal((await api(`/api/admin/orders/${order.body.id}`, { method: "PATCH", body: { status: "completed" } })).status, 401);
    assert.equal((await api(`/api/admin/orders/${order.body.id}`, { method: "PATCH", body: { status: "confirmed" }, cookie })).status, 200);
    assert.equal((await api(`/api/admin/orders/${order.body.id}`, { method: "PATCH", body: { status: "wrong" }, cookie })).status, 400);
    assert.equal((await api("/api/admin/orders?page=-1", { cookie })).status, 400);
    products[0].price = 40000;
    assert.equal((await api("/api/admin/catalog", { method: "PUT", body: { products, vouchers }, cookie })).status, 200);
    assert.equal((await api("/api/orders", { method: "POST", body: { ...body, requestId: crypto.randomUUID() } })).status, 409);
    assert.equal((await api("/api/quote", { method: "POST", body: { items, voucher: "TEST10" } })).body.total, 72000);
    products[0].stock = 0;
    assert.equal((await api("/api/admin/catalog", { method: "PUT", body: { products, vouchers }, cookie })).status, 200);
    assert.equal((await api("/api/quote", { method: "POST", body: { items } })).status, 409);
    for (const file of ["/server.js", "/server.test.js", "/data/store.sqlite", "/package.json", "/HUONG-DAN.txt"]) assert.equal((await fetch(origin + file)).status, 404);
    assert.equal((await fetch(origin + "/dat-hang.html")).status, 200);
    const oldArticle = await fetch(origin + "/bai-viet.html?slug=bi-quyet-nau-com-deo-thom&utm_source=test", { redirect: "manual" });
    assert.equal(oldArticle.status, 301);
    assert.equal(oldArticle.headers.get("location"), "/bai-viet/bi-quyet-nau-com-deo-thom");
    const articlePage = await fetch(origin + oldArticle.headers.get("location"));
    assert.equal(articlePage.status, 200);
    assert.match(await articlePage.text(), /<base href="\/">/);
    for (const suffix of ["/", "?utm_source=test"]) {
      const response = await fetch(origin + "/bai-viet/bi-quyet-nau-com-deo-thom" + suffix, { redirect: "manual" });
      assert.equal(response.status, 301);
      assert.equal(response.headers.get("location"), "/bai-viet/bi-quyet-nau-com-deo-thom");
    }
    const articleHead = await fetch(origin + "/bai-viet/bi-quyet-nau-com-deo-thom", { method: "HEAD" });
    assert.equal(articleHead.status, 200);
    assert.equal(await articleHead.text(), "");
    assert.equal((await fetch(origin + "/bai-viet/bad%2Fslug")).status, 404);
    const robots = await fetch(origin + "/robots.txt");
    assert.equal(robots.status, 200);
    assert.match(await robots.text(), /Sitemap: http:\/\/127\.0\.0\.1:\d+\/sitemap\.xml/);
    const sitemap = await fetch(origin + "/sitemap.xml");
    assert.equal(sitemap.status, 200);
    const sitemapXml = await sitemap.text();
    assert.match(sitemapXml, new RegExp(`http://127\\.0\\.0\\.1:\\d+/`));
    assert.match(sitemapXml, /chi-tiet-gao\.html\?id=/);
    assert.match(sitemapXml, /bai-viet-danh-sach\.html/);
    await stop();
    await start();
    const relogin = await api("/api/admin/login", { method: "POST", body: { password } });
    const persisted = await api("/api/admin/orders", { cookie: relogin.cookie });
    assert.equal(persisted.body.count, 1);
    assert.equal(persisted.body.orders[0].status, "confirmed");
    assert.equal(persisted.body.orders[0].total, 57600);
    assert.equal((await api("/api/admin/logout", { method: "POST", body: {}, cookie: relogin.cookie })).status, 200);
    assert.equal((await api("/api/admin/orders", { cookie: relogin.cookie })).status, 401);
  } finally {
    if (server?.listening) await stop();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
