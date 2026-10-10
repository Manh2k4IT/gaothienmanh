const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function context(memory = new Map()) {
  const sandbox = { window: {}, localStorage: { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: (key) => memory.delete(key) }, URL, console };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "blogs.js"), "utf8"), sandbox);
  return sandbox.window.RiceArticles;
}

test("Related articles show at most three newest published articles excluding the current one", () => {
  const api = context();
  const article = (id, date, status = "published") => ({ id, createdAt: date, updatedAt: date, status });
  const items = [
    article("old", "2026-01-01"), article("current", "2026-10-10"),
    article("third", "2026-07-01"), article("draft", "2026-10-11", "draft"),
    article("newest", "2026-10-09"), article("second", "2026-09-01")
  ];
  assert.deepEqual(Array.from(api.latestRelatedArticles(items, "current"), (item) => item.id), ["newest", "second", "third"]);
  assert.equal(items[0].id, "old");
  assert.equal(api.latestRelatedArticles([items[1], items[3]], "current").length, 0);
  assert.equal(api.latestRelatedArticles([items[0]], "current").length, 1);
});

test("Blog categories preserve old groups, rename membership, persist and delete without deleting articles", () => {
  const memory = new Map();
  const api = context(memory);
  const original = api.getArticles();
  const categories = api.getCategories();
  assert.equal(categories.length, 3);
  assert.equal(original.length, 3);
  assert.ok(original.every((article) => categories.some((category) => category.id === article.categoryId)));
  const first = categories[0];
  api.saveCategories(categories.map((category) => category.id === first.id ? { ...category, name: "New name", slug: "new-name" } : category));
  assert.equal(api.getArticles().find((article) => article.id === original[0].id).category, "New name");
  assert.equal(context(memory).getCategories()[0].slug, "new-name");
  assert.equal(api.categoryHref(api.getCategories()[0]), "bai-viet-danh-sach.html?category=new-name");
  api.saveCategories([...api.getCategories(), { id: "custom", name: "Custom", slug: "custom" }]);
  api.saveArticles(api.getArticles().map((article, index) => index === 1 ? { ...article, categoryId: "custom", category: "Custom" } : article));
  assert.equal(api.getArticles()[1].categoryId, "custom");
  api.saveCategories(api.getCategories().filter((category) => category.id !== "custom"));
  assert.equal(api.getArticles().length, original.length);
  assert.equal(api.getArticles()[1].categoryId, "");
  assert.equal(api.getArticles()[1].category, "Chưa phân loại");
  assert.throws(() => api.saveArticles(api.getArticles().map((article) => ({ ...article, categoryId: "deleted" }))), /TypeError|danh mục/i);
  api.saveCategories([]);
  assert.equal(api.getCategories().length, 0);
  assert.equal(api.getArticles().length, original.length);
});

test("Blog categories reject duplicate slugs, malformed records and invalid stored data", () => {
  const api = context();
  const item = { id: "cat", name: "Category", slug: "category" };
  for (const items of [null, Array(101).fill(item), [item, { ...item, id: "another" }], [item, { ...item, slug: "another" }],
    [{ ...item, slug: "../bad" }], [{ ...item, name: "" }], [{ ...item, name: "x".repeat(61) }]]) {
    assert.throws(() => api.saveCategories(items), { name: "TypeError" });
  }
  const memory = new Map([[api.categoriesKey, "not-json"]]);
  assert.throws(() => context(memory).getCategories(), { name: "SyntaxError" });
  assert.equal(api.slugifyCategory("Mẹo nấu cơm Đặc biệt"), "meo-nau-com-dac-biet");
});

test("Blog text colors allow safe hex and RGB values only", () => {
  const api = context();
  assert.equal(api.safeTextColor("#A1b2C3"), "#a1b2c3");
  assert.equal(api.safeTextColor("rgb(1, 20, 255)"), "rgb(1, 20, 255)");
  for (const value of ["red", "url(javascript:alert(1))", "rgb(256, 0, 0)", "#fff", ""]) {
    assert.equal(api.safeTextColor(value), "");
  }
});

test("Article cover captions persist and validate without requiring them on older articles", () => {
  const memory = new Map();
  const api = context(memory);
  const articles = api.getArticles();
  articles[0].coverCaption = 'Gạo ST25 — Ảnh: Thiên Mạnh';
  api.saveArticles(articles);
  assert.equal(context(memory).getArticles()[0].coverCaption, articles[0].coverCaption);
  for (const caption of [null, 12, "x".repeat(501)]) {
    assert.throws(() => api.saveArticles(articles.map((article) => ({ ...article, coverCaption: caption }))), { name: "TypeError" });
  }
});

test("Saving category selections persists article moves and restores both records on storage failure", () => {
  const memory = new Map();
  const api = context(memory);
  const articles = api.getArticles();
  const categories = api.getCategories();
  const custom = { id: "custom", name: "Mẹo cơm", slug: "meo-com" };
  const next = articles.map((article, index) => index < 2 ? { ...article, categoryId: custom.id, category: custom.name } : article);
  api.saveCategorySelection([...categories, custom], next);
  assert.equal(context(memory).getArticles().filter((article) => article.categoryId === custom.id).length, 2);
  const originalCategories = memory.get(api.categoriesKey);
  const originalArticles = memory.get(api.storageKey);
  const originalSet = memory.set.bind(memory);
  let fail = true;
  memory.set = (key, value) => {
    if (key === api.storageKey && fail) {
      fail = false;
      throw new Error("Simulated quota failure");
    }
    return originalSet(key, value);
  };
  assert.throws(() => api.saveCategorySelection([...categories, { ...custom, name: "Changed" }], next), /quota/);
  assert.equal(memory.get(api.categoriesKey), originalCategories);
  assert.equal(memory.get(api.storageKey), originalArticles);
  api.saveCategorySelection(api.getCategories(), api.getArticles().map((article) => article.categoryId === custom.id ? { ...article, categoryId: "", category: "Chưa phân loại" } : article));
  assert.equal(api.getArticles().filter((article) => article.categoryId === custom.id).length, 0);
});
