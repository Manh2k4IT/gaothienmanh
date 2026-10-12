const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const { defaultMenu, validateMenu, validateCategory, defaultCategory, syncCategoryLinks } = require("./menu-model");
const { validateCategories } = require("./categories-model");
const siteContent = require("./site-content-model");
const contacts = require("./contacts-model");
process.env.TZ = process.env.TZ || "Asia/Ho_Chi_Minh";

const root = __dirname;
class RequestError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function createStore({ databasePath, password, publicOrigin = "", allowLocalAdmin = false }) {
  const canonicalOrigin = publicOrigin ? new URL(publicOrigin).origin : "";
  publicOrigin = canonicalOrigin;
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, request_id TEXT UNIQUE NOT NULL, payload_hash TEXT NOT NULL,
      created_at TEXT NOT NULL, status TEXT NOT NULL, detail TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY, request_id TEXT UNIQUE NOT NULL, payload_hash TEXT NOT NULL,
      created_at TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL
    );
  `);
  const getSetting = (key) => db.prepare("SELECT value FROM settings WHERE key = ?").get(key)?.value;
  const setSetting = (key, value) => db.prepare("INSERT OR REPLACE INTO settings VALUES (?, ?)").run(key, value);
  const memory = new Map();
  const catalogContext = { window: {}, localStorage: { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) }, URL };
  vm.createContext(catalogContext);
  vm.runInContext(fs.readFileSync(path.join(root, "products.js"), "utf8"), catalogContext);
  const blogMemory = new Map();
  const blogContext = { window: {}, localStorage: { getItem: (key) => blogMemory.get(key) ?? null, setItem: (key, value) => blogMemory.set(key, value) }, URL };
  vm.createContext(blogContext);
  vm.runInContext(fs.readFileSync(path.join(root, "blogs.js"), "utf8"), blogContext);
  const riceArticles = blogContext.window.RiceArticles;
  if (!getSetting("products")) setSetting("products", JSON.stringify(catalogContext.window.RiceCatalog.getProducts()));
  if (!getSetting("vouchers")) setSetting("vouchers", "[]");
  if (!getSetting("categories")) setSetting("categories", JSON.stringify({ items: [], version: 1 }));
  if (!getSetting("blog")) setSetting("blog", JSON.stringify({ articles: [], categories: [], version: 1 }));
  if (!getSetting("site-content")) setSetting("site-content", JSON.stringify({ content: siteContent.defaults(), version: 1 }));
  const storedContent = JSON.parse(getSetting("site-content"));
  if (storedContent.content.header === undefined || storedContent.content.benefits === undefined || storedContent.content.seo === undefined) {
    setSetting("site-content", JSON.stringify({ content: siteContent.validate(siteContent.migrate(storedContent.content)), version: storedContent.version + 1 }));
  }
  const categoryDefaults = () => defaultCategory(JSON.parse(getSetting("products")));
  if (!getSetting("menu")) setSetting("menu", JSON.stringify({ items: defaultMenu, category: categoryDefaults(), version: 1 }));
  const storedMenu = JSON.parse(getSetting("menu"));
  if (storedMenu.category === undefined) {
    setSetting("menu", JSON.stringify({ ...storedMenu, category: categoryDefaults(), version: storedMenu.version + 1 }));
  }
  if (!getSetting("menu-category-links-managed")) {
    const current = JSON.parse(getSetting("menu"));
    const categories = JSON.parse(getSetting("categories")).items;
    const category = syncCategoryLinks(current.category, categories, categories, true);
    db.exec("BEGIN IMMEDIATE");
    try {
      if (JSON.stringify(category) !== JSON.stringify(current.category)) {
        setSetting("menu", JSON.stringify({ ...current, category, version: current.version + 1 }));
      }
      setSetting("menu-category-links-managed", "true");
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  }
  if (password || !getSetting("password")) {
    const initialPassword = password || crypto.randomBytes(18).toString("base64url");
    if (initialPassword.length < 12) throw new Error("ADMIN_PASSWORD cần ít nhất 12 ký tự.");
    const salt = crypto.randomBytes(16).toString("hex");
    setSetting("password", `${salt}:${crypto.scryptSync(initialPassword, salt, 64).toString("hex")}`);
    if (!password) console.log(`Mật khẩu quản trị mới (hãy lưu ở nơi an toàn): ${initialPassword}`);
  }
  const voucherContext = { window: {}, localStorage: { getItem: () => getSetting("vouchers"), setItem: (_, value) => setSetting("vouchers", value) } };
  vm.createContext(voucherContext);
  vm.runInContext(fs.readFileSync(path.join(root, "vouchers.js"), "utf8"), voucherContext);
  const sessions = new Map();
  const attempts = new Map();
  const statuses = ["new", "confirmed", "shipping", "completed", "cancelled"];
  function limit(req, scope, maximum) {
    const now = Date.now();
    for (const [key, value] of attempts) if (value.until < now) attempts.delete(key);
    const key = `${scope}:${req.socket.remoteAddress}`;
    const record = attempts.get(key) || { count: 0, until: now + 60000 };
    record.count += 1;
    attempts.set(key, record);
    if (record.count > maximum) throw new RequestError(429, "Thao tác quá nhiều lần. Vui lòng chờ một phút.");
  }
  function requireAdmin(req) {
    const localAddress = ["127.0.0.1", "::1", "::ffff:127.0.0.1"];
    if (allowLocalAdmin && !publicOrigin &&
        localAddress.includes(req.socket.localAddress) &&
        localAddress.includes(req.socket.remoteAddress) &&
        /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(req.headers.host || "")) return null;
    for (const [token, expiry] of sessions) if (expiry < Date.now()) sessions.delete(token);
    const tokens = (req.headers.cookie || "").split(";").map((cookie) => /^rice_admin=([a-f0-9]{64})$/.exec(cookie.trim())?.[1]);
    const token = tokens.find((value) => value && sessions.has(value));
    if (!token) throw new RequestError(401, "Vui lòng đăng nhập quản trị.");
    return token;
  }
  async function readBody(req, max = 32000) {
    if (!req.headers["content-type"]?.startsWith("application/json")) throw new RequestError(415, "Yêu cầu phải là JSON.");
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > max) throw new RequestError(413, "Dữ liệu gửi lên quá lớn.");
      chunks.push(chunk);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { throw new RequestError(400, "Dữ liệu JSON không hợp lệ."); }
  }
  function quote(body) {
    if (!body || !Array.isArray(body.items) || !body.items.length || body.items.length > 100) throw new RequestError(400, "Giỏ hàng phải có từ 1 đến 100 sản phẩm.");
    const products = JSON.parse(getSetting("products"));
    const seen = new Set();
    const items = body.items.map((item) => {
      if (!item || typeof item.id !== "string" || seen.has(item.id) || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) throw new RequestError(400, "Sản phẩm hoặc số kg không hợp lệ.");
      seen.add(item.id);
      const product = products.find((product) => product.id === item.id);
      if (!product) throw new RequestError(409, "Sản phẩm không còn được bán. Hãy cập nhật giỏ hàng.");
      if (product.stock != null && product.stock < item.quantity) throw new RequestError(409, `${product.name} không đủ hàng. Hãy giảm số kg.`);
      return { id: product.id, name: product.name, price: product.price, quantity: item.quantity, total: product.price * item.quantity };
    });
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    if (!Number.isSafeInteger(subtotal)) throw new RequestError(400, "Tổng tiền vượt giới hạn.");
    if (body.voucher != null && (typeof body.voucher !== "string" || body.voucher.length > 30)) throw new RequestError(400, "Mã voucher không hợp lệ.");
    let discount = 0;
    let voucher = "";
    if (body.voucher) {
      try {
        const result = voucherContext.window.RiceVouchers.calculateDiscount(body.voucher, subtotal);
        discount = result.discount;
        voucher = result.code;
      } catch (error) {
        if (error.name === "RangeError") throw new RequestError(409, error.message);
        throw error;
      }
    }
    return { items, subtotal, voucher, discount, total: subtotal - discount };
  }
  function customerInfo(customer) {
    if (!customer || typeof customer !== "object") throw new RequestError(400, "Vui lòng nhập thông tin khách hàng.");
    const result = {};
    for (const [key, min, max] of [["name", 2, 100], ["phone", 8, 20], ["address", 10, 500], ["note", 0, 1000]]) {
      const value = typeof customer[key] === "string" ? customer[key].trim() : "";
      if (value.length < min || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new RequestError(400, `Thông tin ${key} không hợp lệ.`);
      result[key] = value;
    }
    if (!/^(?:0|\+84)[0-9]{8,10}$/.test(result.phone.replace(/[\s.-]/g, ""))) throw new RequestError(400, "Số điện thoại Việt Nam không hợp lệ.");
    return result;
  }
  function json(res, status, data, headers = {}) {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
    res.end(JSON.stringify(data));
  }
  function orderNotifications() {
    const seen = Number(getSetting("orders-seen-cursor") || 0);
    const cursor = db.prepare("SELECT coalesce(max(rowid), 0) AS cursor FROM orders").get().cursor;
    const count = db.prepare("SELECT count(*) AS count FROM orders WHERE rowid > ?").get(seen).count;
    return { count, cursor };
  }
  function escapeHtml(value) {
    return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#39;");
  }
  function escapeJsonLd(value) {
    return JSON.stringify(value).replace(/</g, "\\u003c");
  }
  function canonicalUrl(route, url, origin) {
    const pathname = route === "/index.html" ? "/" : route;
    const result = new URL(pathname, origin);
    const allowedParams = {
      "/gao.html": ["category"],
      "/chi-tiet-gao.html": ["id"],
      "/bai-viet-danh-sach.html": ["category"],
      "/bai-viet.html": ["slug"]
    };
    for (const key of allowedParams[pathname] || []) {
      const value = url.searchParams.get(key);
      if (value) result.searchParams.set(key, value);
    }
    return result.href;
  }
  function addCanonical(html, href) {
    if (/<link\s+rel="canonical"/i.test(html)) return html;
    const link = `<link rel="canonical" href="${escapeHtml(href)}">`;
    return html.replace('<script src="seo.js"></script>', `${link}\n  <script src="seo.js"></script>`);
  }
  function setMeta(html, pattern, value) {
    return html.replace(pattern, (tag) => tag.replace(/content="[^"]*"/, `content="${escapeHtml(value)}"`));
  }
  function jsonLdScript(value) {
    return `<script type="application/ld+json">${escapeJsonLd(value)}</script>`;
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "DENY");
    try {
      const url = new URL(req.url, "http://localhost");
      const route = url.pathname;
      if (canonicalOrigin && ["GET", "HEAD"].includes(req.method) && !route.startsWith("/api/")) {
        const canonicalHost = new URL(canonicalOrigin).host.toLowerCase();
        const requestHost = (req.headers.host || "").toLowerCase();
        const forwardedProto = (req.headers["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase();
        if ((requestHost && requestHost !== canonicalHost) || (canonicalOrigin.startsWith("https:") && forwardedProto === "http") || route === "/index.html") {
          const destination = new URL(canonicalOrigin);
          destination.pathname = url.pathname;
          destination.search = url.search;
          if (route === "/index.html") destination.pathname = "/";
          res.writeHead(301, { Location: destination.href, "Cache-Control": "public, max-age=3600" });
          return res.end();
        }
      }
      if (!publicOrigin && !/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(req.headers.host || "")) throw new RequestError(403, "Cần cấu hình PUBLIC_ORIGIN khi sử dụng tên miền.");
      if (route === "/robots.txt" || route === "/sitemap.xml") {
        if (req.method !== "GET" && req.method !== "HEAD") throw new RequestError(405, "Phương thức không hỗ trợ.");
        const origin = canonicalOrigin || `http://${req.headers.host}`;
        if (route === "/robots.txt") {
          res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" });
          return res.end(req.method === "HEAD" ? undefined : `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
        }
        const pages = new Set(["/", "/gao.html", "/bai-viet-danh-sach.html"]);
        for (const category of JSON.parse(getSetting("categories")).items) {
          const categoryUrl = new URL("/gao.html", origin);
          categoryUrl.searchParams.set("category", category.slug);
          pages.add(categoryUrl.pathname + categoryUrl.search);
        }
        for (const product of JSON.parse(getSetting("products"))) {
          const productUrl = new URL("/chi-tiet-gao.html", origin);
          productUrl.searchParams.set("id", product.id);
          pages.add(productUrl.pathname + productUrl.search);
        }
        for (const article of JSON.parse(getSetting("blog")).articles.filter((item) => item.status === "published")) {
          const articleUrl = new URL("/bai-viet.html", origin);
          articleUrl.searchParams.set("slug", article.id);
          pages.add(articleUrl.pathname + articleUrl.search);
        }
        const escapeXml = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
        const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...pages].map((page) => `  <url><loc>${escapeXml(new URL(page, origin).href)}</loc></url>`).join("\n")}\n</urlset>\n`;
        res.writeHead(200, { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" });
        return res.end(req.method === "HEAD" ? undefined : body);
      }
      if (route === "/blog-media" || route.startsWith("/blog-media/")) {
        if (req.method !== "GET" && req.method !== "HEAD") throw new RequestError(405, "Phương thức không hỗ trợ.");
        const match = /^\/blog-media\/([a-zA-Z0-9_-]{1,120})\.jpg$/.exec(route);
        if (!match) throw new RequestError(404, "Không tìm thấy ảnh bài viết.");
        const article = JSON.parse(getSetting("blog")).articles.find((item) => item.id === match[1] && item.status === "published");
        if (!article || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(article.image)) throw new RequestError(404, "Không tìm thấy ảnh bài viết.");
        const image = Buffer.from(article.image.slice("data:image/jpeg;base64,".length), "base64");
        res.writeHead(200, { "Content-Type": "image/jpeg", "Content-Length": image.length, "Cache-Control": "public, max-age=300" });
        return res.end(req.method === "HEAD" ? undefined : image);
      }
      if (route === "/product-media" || route.startsWith("/product-media/")) {
        if (req.method !== "GET" && req.method !== "HEAD") throw new RequestError(405, "Phương thức không hỗ trợ.");
        const match = /^\/product-media\/([a-zA-Z0-9_-]{1,120})\.jpg$/.exec(route);
        if (!match) throw new RequestError(404, "Không tìm thấy ảnh sản phẩm.");
        const product = JSON.parse(getSetting("products")).find((item) => item.id === match[1]);
        if (!product || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(product.image)) throw new RequestError(404, "Không tìm thấy ảnh sản phẩm.");
        const image = Buffer.from(product.image.slice("data:image/jpeg;base64,".length), "base64");
        res.writeHead(200, { "Content-Type": "image/jpeg", "Content-Length": image.length, "Cache-Control": "public, max-age=300" });
        return res.end(req.method === "HEAD" ? undefined : image);
      }
      if (route === "/brand-logo") {
        if (req.method !== "GET" && req.method !== "HEAD") throw new RequestError(405, "Phương thức không hỗ trợ.");
        const logo = JSON.parse(getSetting("site-content")).content.brand.logo;
        if (!logo.startsWith("data:")) {
          const destination = new URL(logo, canonicalOrigin || `http://${req.headers.host}`);
          res.writeHead(302, { Location: destination.href, "Cache-Control": "public, max-age=3600" });
          return res.end();
        }
        const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+=*)$/.exec(logo);
        if (!match) throw new RequestError(404, "Không tìm thấy logo.");
        const image = Buffer.from(match[2], "base64");
        const contentType = match[1] === "jpeg" ? "image/jpeg" : `image/${match[1]}`;
        res.writeHead(200, { "Content-Type": contentType, "Content-Length": image.length, "Cache-Control": "public, max-age=3600" });
        return res.end(req.method === "HEAD" ? undefined : image);
      }
      if (route.startsWith("/api/")) {
        if (!["GET", "POST", "PUT", "PATCH"].includes(req.method)) throw new RequestError(405, "Phương thức không hỗ trợ.");
        if (req.method !== "GET") {
          const expectedOrigin = publicOrigin || `http://${req.headers.host}`;
          if (req.headers.origin !== expectedOrigin || req.headers["sec-fetch-site"] === "cross-site") throw new RequestError(403, "Nguồn gửi yêu cầu không hợp lệ.");
        }
        if (route === "/api/catalog" && req.method === "GET") {
          const products = JSON.parse(getSetting("products"));
          return json(res, 200, { products, vouchers: JSON.parse(getSetting("vouchers")).filter((voucher) => voucher.active) });
        }
        if (route === "/api/blog" && req.method === "GET") {
          const blog = JSON.parse(getSetting("blog"));
          return json(res, 200, { ...blog, articles: blog.articles.filter((article) => article.status === "published") });
        }
        if (route === "/api/menu" && req.method === "GET") return json(res, 200, JSON.parse(getSetting("menu")));
        if (route === "/api/categories" && req.method === "GET") return json(res, 200, JSON.parse(getSetting("categories")));
        if (route === "/api/site-content" && req.method === "GET") return json(res, 200, JSON.parse(getSetting("site-content")));
        if (route === "/api/contacts" && req.method === "POST") {
          limit(req, "contacts", 10);
          const body = await readBody(req, 8000);
          if (!body || typeof body.requestId !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(body.requestId)) throw new RequestError(400, "Mã đăng ký không hợp lệ. Tải lại trang rồi thử lại.");
          let contact;
          try { contact = contacts.validate(body); }
          catch (error) {
            if (error instanceof TypeError) throw new RequestError(400, error.message);
            throw error;
          }
          const hash = crypto.createHash("sha256").update(JSON.stringify(contact)).digest("hex");
          const existing = db.prepare("SELECT id, payload_hash FROM contacts WHERE request_id = ?").get(body.requestId);
          if (existing) {
            if (existing.payload_hash !== hash) throw new RequestError(409, "Mã đăng ký đã dùng cho thông tin khác. Tải lại trang rồi thử lại.");
            return json(res, 200, { id: existing.id });
          }
          const id = crypto.randomUUID();
          db.prepare("INSERT INTO contacts VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, body.requestId, hash, new Date().toISOString(), contact.name, contact.phone, contact.email);
          return json(res, 201, { id });
        }
        if (route === "/api/quote" && req.method === "POST") {
          limit(req, "quote", 120);
          return json(res, 200, quote(await readBody(req)));
        }
        if (route === "/api/admin/login" && req.method === "POST") {
          limit(req, "login", 5);
          const body = await readBody(req);
          if (typeof body?.password !== "string" || body.password.length > 256) throw new RequestError(400, "Mật khẩu không hợp lệ.");
          const [salt, hash] = getSetting("password").split(":");
          const validPassword = crypto.timingSafeEqual(crypto.scryptSync(body.password, salt, 64), Buffer.from(hash, "hex"));
          if (body.username !== "Manh Trinh" || !validPassword) throw new RequestError(401, "Tài khoản hoặc mật khẩu không đúng.");
          const token = crypto.randomBytes(32).toString("hex");
          sessions.set(token, Date.now() + 8 * 3600000);
          return json(res, 200, { ok: true }, { "Set-Cookie": [
            `rice_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${publicOrigin.startsWith("https:") ? "; Secure" : ""}`,
            `rice_admin=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0${publicOrigin.startsWith("https:") ? "; Secure" : ""}`
          ] });
        }
        if (route.startsWith("/api/admin/")) {
          const token = requireAdmin(req);
          if (route === "/api/admin/session" && req.method === "GET") return json(res, 200, { ok: true, localMode: token === null });
          if (route === "/api/admin/order-notifications" && req.method === "GET") return json(res, 200, orderNotifications());
          if (route === "/api/admin/orders/seen" && req.method === "POST") {
            const body = await readBody(req);
            const current = orderNotifications();
            if (!Number.isSafeInteger(body?.cursor) || body.cursor < 0 || body.cursor > current.cursor) throw new RequestError(400, "Mốc thông báo đơn hàng không hợp lệ.");
            const seen = Number(getSetting("orders-seen-cursor") || 0);
            setSetting("orders-seen-cursor", String(Math.max(seen, body.cursor)));
            return json(res, 200, orderNotifications());
          }
          if (route === "/api/admin/blog" && req.method === "GET") return json(res, 200, JSON.parse(getSetting("blog")));
          if (route === "/api/admin/blog" && req.method === "PUT") {
            const body = await readBody(req, 25 * 1024 * 1024);
            const current = JSON.parse(getSetting("blog"));
            if (!body || body.version !== current.version) throw new RequestError(409, "Bài viết đã được sửa ở nơi khác. Hãy tải lại trước khi lưu.");
            let categories;
            try {
              categories = riceArticles.validateCategories(body.categories);
              riceArticles.validateArticles(body.articles, categories);
            } catch (error) {
              if (error?.name === "TypeError") throw new RequestError(400, error.message);
              throw error;
            }
            const result = { articles: body.articles, categories, version: current.version + 1 };
            setSetting("blog", JSON.stringify(result));
            return json(res, 200, result);
          }
          if (route === "/api/admin/contacts" && req.method === "GET") {
            const page = Number(url.searchParams.get("page") || 1);
            if (!Number.isSafeInteger(page) || page < 1 || page > 1000000) throw new RequestError(400, "Trang không hợp lệ.");
            const rows = db.prepare("SELECT id, created_at AS createdAt, name, phone, email FROM contacts ORDER BY created_at DESC, rowid DESC LIMIT 25 OFFSET ?").all((page - 1) * 25);
            return json(res, 200, { contacts: rows, count: db.prepare("SELECT count(*) AS count FROM contacts").get().count, pageSize: 25 });
          }
          if (route === "/api/admin/site-content" && req.method === "GET") return json(res, 200, JSON.parse(getSetting("site-content")));
          if (route === "/api/admin/site-content" && req.method === "PUT") {
            const body = await readBody(req, 8 * 1024 * 1024);
            const current = JSON.parse(getSetting("site-content"));
            if (!body || body.version !== current.version) throw new RequestError(409, "Giao diện đã được sửa ở nơi khác. Hãy tải lại trước khi lưu.");
            let content;
            try { content = siteContent.validate(body.content); }
            catch (error) {
              if (error instanceof TypeError) throw new RequestError(400, error.message);
              throw error;
            }
            const result = { content, version: current.version + 1 };
            setSetting("site-content", JSON.stringify(result));
            return json(res, 200, result);
          }
          if (route === "/api/admin/categories" && req.method === "GET") return json(res, 200, JSON.parse(getSetting("categories")));
          if (route === "/api/admin/categories" && req.method === "PUT") {
            const body = await readBody(req, 3 * 1024 * 1024);
            const current = JSON.parse(getSetting("categories"));
            if (!body || body.version !== current.version) throw new RequestError(409, "Danh mục đã được sửa ở nơi khác. Hãy tải lại trước khi lưu.");
            let items;
            try { items = validateCategories(body.items); }
            catch (error) {
              if (error instanceof TypeError) throw new RequestError(400, error.message);
              throw error;
            }
            const productIds = new Set(JSON.parse(getSetting("products")).map((product) => product.id));
            if (items.some((item) => item.productIds.some((id) => !productIds.has(id)))) {
              throw new RequestError(400, "Có sản phẩm không còn trên máy chủ. Tải lại danh sách và bỏ chọn sản phẩm đã xóa, hoặc đăng sản phẩm lên máy chủ trước.");
            }
            const result = { items, version: current.version + 1 };
            const menu = JSON.parse(getSetting("menu"));
            let category;
            try { category = syncCategoryLinks(menu.category, current.items, items); }
            catch (error) {
              if (error instanceof TypeError) throw new RequestError(400, "Dropdown danh mục đã đầy. Xóa bớt liên kết trong Menu trước khi tạo thêm danh mục.");
              throw error;
            }
            db.exec("BEGIN IMMEDIATE");
            try {
              setSetting("categories", JSON.stringify(result));
              if (JSON.stringify(category) !== JSON.stringify(menu.category)) {
                setSetting("menu", JSON.stringify({ ...menu, category, version: menu.version + 1 }));
              }
              db.exec("COMMIT");
            } catch (error) { db.exec("ROLLBACK"); throw error; }
            return json(res, 200, result);
          }
          if (route === "/api/admin/menu" && req.method === "GET") return json(res, 200, JSON.parse(getSetting("menu")));
          if (route === "/api/admin/menu" && req.method === "PUT") {
            const body = await readBody(req, 300000);
            const current = JSON.parse(getSetting("menu"));
            if (!body || body.version !== current.version) throw new RequestError(409, "Menu đã được sửa ở nơi khác. Hãy tải lại dữ liệu trước khi lưu.");
            let items;
            let category;
            try {
              items = validateMenu(body.items);
              category = body.category === undefined ? current.category : validateCategory(body.category);
            }
            catch (error) {
              if (error instanceof TypeError) throw new RequestError(400, error.message);
              throw error;
            }
            const result = { items, category, version: current.version + 1 };
            setSetting("menu", JSON.stringify(result));
            return json(res, 200, result);
          }
          if (route === "/api/admin/logout" && req.method === "POST") {
            sessions.delete(token);
            for (const cookie of (req.headers.cookie || "").split(";")) {
              const otherToken = /^rice_admin=([a-f0-9]{64})$/.exec(cookie.trim())?.[1];
              if (otherToken) sessions.delete(otherToken);
            }
            return json(res, 200, { ok: true }, { "Set-Cookie": ["/", "/api"].map((cookiePath) =>
              `rice_admin=; HttpOnly; SameSite=Strict; Path=${cookiePath}; Max-Age=0${publicOrigin.startsWith("https:") ? "; Secure" : ""}`) });
          }
          if (route === "/api/admin/catalog" && req.method === "GET") return json(res, 200, { products: JSON.parse(getSetting("products")), vouchers: JSON.parse(getSetting("vouchers")) });
          if (route === "/api/admin/catalog" && req.method === "PUT") {
            const body = await readBody(req, 25 * 1024 * 1024);
            if (!body || !Array.isArray(body.products) || !body.products.length || body.products.length > 100) throw new RequestError(400, "Cần 1–100 sản phẩm.");
            try {
              catalogContext.window.RiceCatalog.saveProducts(body.products);
              const previous = getSetting("vouchers");
              voucherContext.localStorage = { getItem: () => previous, setItem: () => {} };
              voucherContext.window.RiceVouchers.saveVouchers(body.vouchers);
            } catch (error) {
              if (error.name === "TypeError") throw new RequestError(400, error.message);
              throw error;
            } finally {
              voucherContext.localStorage = { getItem: () => getSetting("vouchers"), setItem: (_, value) => setSetting("vouchers", value) };
            }
            db.exec("BEGIN IMMEDIATE");
            try {
              setSetting("products", JSON.stringify(body.products));
              setSetting("vouchers", JSON.stringify(body.vouchers));
              db.exec("COMMIT");
            } catch (error) { db.exec("ROLLBACK"); throw error; }
            return json(res, 200, { ok: true });
          }
          if (route === "/api/admin/orders" && req.method === "GET") {
            const page = Number(url.searchParams.get("page") || 1);
            if (!Number.isSafeInteger(page) || page < 1) throw new RequestError(400, "Trang không hợp lệ.");
            const rows = db.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 30 OFFSET ?").all((page - 1) * 30);
            return json(res, 200, { orders: rows.map((row) => ({ ...JSON.parse(row.detail), id: row.id, createdAt: row.created_at, status: row.status })), count: db.prepare("SELECT count(*) AS count FROM orders").get().count, notificationCursor: orderNotifications().cursor });
          }
          if (/^\/api\/admin\/orders\/[a-f0-9-]{36}$/.test(route) && req.method === "PATCH") {
            const body = await readBody(req);
            if (!statuses.includes(body?.status)) throw new RequestError(400, "Trạng thái đơn hàng không hợp lệ.");
            const result = db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(body.status, route.split("/").pop());
            if (!result.changes) throw new RequestError(404, "Không tìm thấy đơn hàng.");
            return json(res, 200, { ok: true });
          }
        }
        if (route === "/api/orders" && req.method === "POST") {
          limit(req, "order", 10);
          const body = await readBody(req);
          if (!body || typeof body.requestId !== "string" || !/^[a-f0-9-]{36}$/.test(body.requestId) || body.accepted !== true) throw new RequestError(400, "Vui lòng xác nhận thông tin đặt hàng.");
          const customer = customerInfo(body.customer);
          const payloadHash = crypto.createHash("sha256").update(JSON.stringify({ items: body.items, voucher: body.voucher || "", customer, expectedTotal: body.expectedTotal })).digest("hex");
          const existing = db.prepare("SELECT * FROM orders WHERE request_id = ?").get(body.requestId);
          if (existing) {
            if (existing.payload_hash !== payloadHash) throw new RequestError(409, "Yêu cầu này đã dùng cho một đơn khác. Vui lòng tải lại trang.");
            return json(res, 200, { id: existing.id, total: JSON.parse(existing.detail).total });
          }
          const summary = quote(body);
          if (body.expectedTotal !== summary.total) throw new RequestError(409, "Giá hoặc ưu đãi đã thay đổi. Hãy cập nhật tổng tiền và xác nhận lại.");
          const id = crypto.randomUUID();
          db.prepare("INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?)").run(id, body.requestId, payloadHash, new Date().toISOString(), "new", JSON.stringify({ ...summary, customer }));
          return json(res, 201, { id, total: summary.total });
        }
        throw new RequestError(404, "Không tìm thấy chức năng.");
      }
      if (req.method !== "GET" && req.method !== "HEAD") throw new RequestError(405, "Phương thức không hỗ trợ.");
      const name = route === "/" ? "index.html" : decodeURIComponent(route.slice(1));
      if (!/^[a-zA-Z0-9_-]+\.(?:html|js|css|png|jpg|jpeg|svg|ico)$/.test(name) || ["server.js", "server.test.js"].includes(name)) throw new RequestError(404, "Không tìm thấy trang.");
      const file = path.join(root, name);
      if (!fs.existsSync(file)) throw new RequestError(404, "Không tìm thấy trang.");
      if (/^admin(?:-[a-z0-9-]+)?\.html$/.test(name) && name !== "admin-login.html") {
        try { requireAdmin(req); }
        catch (error) {
          if (!(error instanceof RequestError) || error.status !== 401) throw error;
          res.writeHead(302, { Location: `/admin-login.html?next=${encodeURIComponent(`/${name}`)}`, "Cache-Control": "no-store" });
          return res.end();
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        return res.end(req.method === "HEAD" ? undefined : fs.readFileSync(file, "utf8").replace("</head>", '<link rel="stylesheet" href="admin-session.css">\n</head>').replace("</body>", '<script src="admin-session.js"></script>\n</body>'));
      }
      if (name === "bai-viet.html") {
        const html = fs.readFileSync(file, "utf8");
        const slug = url.searchParams.get("slug");
        const article = slug && JSON.parse(getSetting("blog")).articles.find((item) => item.id === slug && item.status === "published");
        if (!article) {
          const notFoundHtml = html.replace("</head>", '<meta name="robots" content="noindex, nofollow">\n</head>');
          res.writeHead(404, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
          return res.end(req.method === "HEAD" ? undefined : notFoundHtml);
        }
        const origin = canonicalOrigin || `http://${req.headers.host}`;
        const articleUrl = new URL("/bai-viet.html", origin);
        articleUrl.searchParams.set("slug", article.id);
        const imageUrl = /^data:image\/jpeg;base64,/.test(article.image)
          ? new URL(`/blog-media/${encodeURIComponent(article.id)}.jpg`, origin).href
          : article.image;
        const pageTitle = escapeHtml(article.seoTitle || article.title);
        const shareTitle = escapeHtml(article.title);
        const description = escapeHtml(article.seoDescription || article.summary);
        const escapedUrl = escapeHtml(articleUrl.href);
        const escapedImage = escapeHtml(imageUrl);
        const site = JSON.parse(getSetting("site-content")).content;
        const brandLogo = site.brand.logo.startsWith("data:")
          ? new URL("/brand-logo", origin).href
          : new URL(site.brand.logo, origin).href;
        const categories = JSON.parse(getSetting("blog")).categories;
        const articleCategory = categories.find((item) => item.id === article.categoryId);
        const breadcrumbs = [
          { "@type": "ListItem", position: 1, name: site.brand.name, item: new URL("/", origin).href },
          { "@type": "ListItem", position: 2, name: "Bài viết", item: new URL("/bai-viet-danh-sach.html", origin).href }
        ];
        if (articleCategory) {
          const categoryUrl = new URL("/bai-viet-danh-sach.html", origin);
          categoryUrl.searchParams.set("category", articleCategory.slug);
          breadcrumbs.push({ "@type": "ListItem", position: breadcrumbs.length + 1, name: articleCategory.name, item: categoryUrl.href });
        }
        breadcrumbs.push({ "@type": "ListItem", position: breadcrumbs.length + 1, name: article.title, item: articleUrl.href });
        const articleSchema = {
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "BlogPosting",
              headline: article.title,
              description: article.seoDescription || article.summary,
              mainEntityOfPage: articleUrl.href,
              author: { "@type": "Organization", name: site.brand.name },
              publisher: {
                "@type": "Organization",
                name: site.brand.name,
                logo: { "@type": "ImageObject", url: brandLogo }
              },
              ...(Number.isFinite(Date.parse(article.createdAt)) ? { datePublished: new Date(article.createdAt).toISOString() } : {}),
              ...(Number.isFinite(Date.parse(article.updatedAt)) ? { dateModified: new Date(article.updatedAt).toISOString() } : {}),
              ...(imageUrl.startsWith("http") ? { image: [imageUrl] } : {})
            },
            { "@type": "BreadcrumbList", itemListElement: breadcrumbs }
          ]
        };
        const personalizedHtml = addCanonical(html, articleUrl.href)
          .replace(/<title>[\s\S]*?<\/title>/, `<title>${pageTitle}</title>`)
          .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${description}">`)
          .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${shareTitle}">`)
          .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${description}">`)
          .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${escapedUrl}">`)
          .replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${escapedImage}">`)
          .replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${shareTitle}">`)
          .replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${description}">`)
          .replace(/<meta name="twitter:image" content="[^"]*">/, `<meta name="twitter:image" content="${escapedImage}">`)
          .replace("</head>", `${jsonLdScript(articleSchema)}\n</head>`);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" });
        return res.end(req.method === "HEAD" ? undefined : personalizedHtml);
      }
      if (name === "chi-tiet-gao.html") {
        const html = fs.readFileSync(file, "utf8");
        const productId = url.searchParams.get("id");
        const product = productId && JSON.parse(getSetting("products")).find((item) => item.id === productId);
        if (!product) {
          const notFoundHtml = html.replace("</head>", '<meta name="robots" content="noindex, nofollow">\n</head>');
          res.writeHead(404, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
          return res.end(req.method === "HEAD" ? undefined : notFoundHtml);
        }
        const origin = canonicalOrigin || `http://${req.headers.host}`;
        const productUrl = new URL("/chi-tiet-gao.html", origin);
        productUrl.searchParams.set("id", product.id);
        const description = product.description || `${product.name}, ${product.origin}. Xem giá bán và liên hệ Gạo Thiên Mạnh để đặt gạo giao tận nhà.`;
        const productImage = /^data:image\/jpeg;base64,/.test(product.image)
          ? new URL(`/product-media/${encodeURIComponent(product.id)}.jpg`, origin).href
          : /^https?:\/\//i.test(product.image) ? new URL(product.image).href : "";
        const title = `${product.name} — Gạo Thiên Mạnh`;
        const productSchema = {
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          description,
          sku: product.id,
          ...(productImage ? { image: [productImage] } : {}),
          offers: {
            "@type": "Offer",
            url: productUrl.href,
            priceCurrency: "VND",
            price: product.price,
            availability: product.stock === 0 ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
            seller: { "@type": "Organization", name: "Gạo Thiên Mạnh" }
          }
        };
        let productHtml = addCanonical(html, productUrl.href)
          .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
          .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escapeHtml(description)}">`);
        productHtml = setMeta(productHtml, /<meta property="og:title" content="[^"]*">/, title);
        productHtml = setMeta(productHtml, /<meta property="og:description" content="[^"]*">/, description);
        productHtml = setMeta(productHtml, /<meta property="og:url" content="[^"]*">/, productUrl.href);
        productHtml = setMeta(productHtml, /<meta property="og:image" content="[^"]*">/, productImage);
        productHtml = setMeta(productHtml, /<meta name="twitter:title" content="[^"]*">/, title);
        productHtml = setMeta(productHtml, /<meta name="twitter:description" content="[^"]*">/, description);
        productHtml = setMeta(productHtml, /<meta name="twitter:image" content="[^"]*">/, productImage);
        productHtml = productHtml.replace("</head>", `${jsonLdScript(productSchema)}\n</head>`);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" });
        return res.end(req.method === "HEAD" ? undefined : productHtml);
      }
      const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
      if (name.endsWith(".html")) {
        let html = fs.readFileSync(file, "utf8");
        const origin = canonicalOrigin || `http://${req.headers.host}`;
        const canonical = canonicalUrl(route, url, origin);
        html = addCanonical(html, canonical);
        if (route === "/" || route === "/index.html") {
          const site = JSON.parse(getSetting("site-content")).content;
          const title = site.seo.title;
          const description = site.seo.description;
          const logo = site.brand.logo.startsWith("data:")
            ? new URL("/brand-logo", origin).href
            : new URL(site.brand.logo, origin).href;
          html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`);
          html = setMeta(html, /<meta name="description" content="[^"]*">/, description);
          html = setMeta(html, /<meta property="og:title" content="[^"]*">/, title);
          html = setMeta(html, /<meta property="og:description" content="[^"]*">/, description);
          html = setMeta(html, /<meta property="og:url" content="[^"]*">/, canonical);
          html = setMeta(html, /<meta property="og:image" content="[^"]*">/, logo);
          html = setMeta(html, /<meta name="twitter:title" content="[^"]*">/, title);
          html = setMeta(html, /<meta name="twitter:description" content="[^"]*">/, description);
          html = setMeta(html, /<meta name="twitter:url" content="[^"]*">/, canonical);
          html = setMeta(html, /<meta name="twitter:image" content="[^"]*">/, logo);
          html = setMeta(html, /<meta property="og:url" content="[^"]*">/, canonical);
          html = setMeta(html, /<meta name="twitter:url" content="[^"]*">/, canonical);
          const organizationSchema = {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: site.brand.name,
            url: new URL("/", origin).href,
            logo
          };
          const websiteSchema = {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: site.brand.name,
            url: new URL("/", origin).href,
            inLanguage: "vi-VN"
          };
          html = html.replace("</head>", `${jsonLdScript(organizationSchema)}\n${jsonLdScript(websiteSchema)}\n</head>`);
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
        return res.end(html);
      }
      res.writeHead(200, { "Content-Type": types[path.extname(file)], "Cache-Control": "no-cache" });
      if (req.method === "HEAD") return res.end();
        const stream = fs.createReadStream(file);
        stream.on("error", (error) => { console.error("Không đọc được tệp website:", error); res.destroy(); });
        stream.pipe(res);
    } catch (error) {
      if (!(error instanceof RequestError)) console.error("Lỗi xử lý yêu cầu máy chủ:", error);
      if (!res.headersSent) json(res, error.status || 500, { error: error instanceof RequestError ? error.message : "Máy chủ gặp lỗi. Vui lòng thử lại sau." });
      else res.destroy();
    }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  server.on("close", () => db.close());
  return server;
}

if (require.main === module) {
  const host = process.env.HOST || "127.0.0.1";
  const publicOrigin = process.env.PUBLIC_ORIGIN || "";
  const allowLocalAdmin = false;
  const server = createStore({ databasePath: process.env.DATABASE_PATH || path.join(root, "data", "store.sqlite"), password: process.env.ADMIN_PASSWORD, publicOrigin, allowLocalAdmin });
  const port = Number(process.env.PORT || 8002);
  server.listen(port, host, () => console.log(`Cửa hàng: http://127.0.0.1:${port}\nQuản trị đơn hàng: http://127.0.0.1:${port}/admin-don-hang.html${allowLocalAdmin ? "\nChế độ cục bộ: không cần đăng nhập quản trị trên máy này." : ""}`));
}
module.exports = { createStore };
