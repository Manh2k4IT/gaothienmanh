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
  if (!getSetting("products")) setSetting("products", JSON.stringify(catalogContext.window.RiceCatalog.getProducts()));
  if (!getSetting("vouchers")) setSetting("vouchers", "[]");
  if (!getSetting("categories")) setSetting("categories", JSON.stringify({ items: [], version: 1 }));
  if (!getSetting("site-content")) setSetting("site-content", JSON.stringify({ content: siteContent.defaults(), version: 1 }));
  const storedContent = JSON.parse(getSetting("site-content"));
  if (storedContent.content.header === undefined || storedContent.content.benefits === undefined) {
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
    const token = /(?:^|;\s*)rice_admin=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || "")?.[1];
    if (!token || !sessions.has(token)) throw new RequestError(401, "Vui lòng đăng nhập quản trị.");
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
  const server = http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "DENY");
    try {
      const url = new URL(req.url, "http://localhost");
      const route = url.pathname;
      if (!publicOrigin && !/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(req.headers.host || "")) throw new RequestError(403, "Cần cấu hình PUBLIC_ORIGIN khi sử dụng tên miền.");
      if (route === "/robots.txt" || route === "/sitemap.xml") {
        if (req.method !== "GET" && req.method !== "HEAD") throw new RequestError(405, "Phương thức không hỗ trợ.");
        const origin = (publicOrigin || `http://${req.headers.host}`).replace(/\/+$/, "");
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
        const escapeXml = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
        const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...pages].map((page) => `  <url><loc>${escapeXml(new URL(page, origin).href)}</loc></url>`).join("\n")}\n</urlset>\n`;
        res.writeHead(200, { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" });
        return res.end(req.method === "HEAD" ? undefined : body);
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
          return json(res, 200, { ok: true }, { "Set-Cookie": `rice_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${publicOrigin.startsWith("https:") ? "; Secure" : ""}` });
        }
        if (route.startsWith("/api/admin/")) {
          const token = requireAdmin(req);
          if (route === "/api/admin/session" && req.method === "GET") return json(res, 200, { ok: true, localMode: token === null });
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
            return json(res, 200, { ok: true }, { "Set-Cookie": `rice_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${publicOrigin.startsWith("https:") ? "; Secure" : ""}` });
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
            return json(res, 200, { orders: rows.map((row) => ({ ...JSON.parse(row.detail), id: row.id, createdAt: row.created_at, status: row.status })), count: db.prepare("SELECT count(*) AS count FROM orders").get().count });
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
        return res.end(req.method === "HEAD" ? undefined : fs.readFileSync(file, "utf8").replace("</body>", '<script src="admin-session.js"></script>\n</body>'));
      }
      const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
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
