(function () {
  const defaultMenu = [
    { label: "Trang chủ", href: "index.html", children: [] },
    { label: "Đặt gạo", href: "gao.html", children: [] },
    { label: "Về chúng tôi", href: "index.html#cau-chuyen", children: [] },
    { label: "Bài viết", href: "bai-viet-danh-sach.html", children: [] },
    { label: "Liên hệ", href: "index.html#lien-he", children: [] }
  ];
  function validLink(href) {
    if (typeof href !== "string" || href.length > 1000 || href !== href.trim() ||
        !href || /[\s\\\u0000-\u001f\u007f]/.test(href)) return false;
    if (/^https?:\/\//i.test(href)) {
      try {
        const url = new URL(href);
        return Boolean(url.hostname) && !url.username && !url.password;
      } catch { return false; }
    }
    if (/^tel:\+?[0-9().-]+$/i.test(href) || /^mailto:[^:@/?#]+@[^:@/?#]+$/i.test(href)) return true;
    if (href.startsWith("//") || href.includes(":") || /%(?:0[0-9a-f]|1[0-9a-f]|7f|5c)/i.test(href)) return false;
    return /^(?:[a-zA-Z0-9_./%~-]+)?(?:\?[^#]*)?(?:#.*)?$/.test(href);
  }
  function validateMenu(items, childLimit = 20) {
    if (!Array.isArray(items) || items.length > 12) throw new TypeError("Menu chính có tối đa 12 mục.");
    const validateItem = (item) => {
      if (!item || typeof item.label !== "string" || !item.label.trim() || item.label.length > 60 ||
          /[\u0000-\u001f\u007f]/.test(item.label) || !validLink(item.href)) {
        throw new TypeError("Mỗi mục cần tên (tối đa 60 ký tự) và liên kết hợp lệ: trang nội bộ, https://, http://, tel: hoặc mailto:.");
      }
    };
    items.forEach((item) => {
      validateItem(item);
      if (!Array.isArray(item.children) || item.children.length > childLimit) throw new TypeError(`Dropdown có tối đa ${childLimit} mục con.`);
      item.children.forEach((child) => {
        validateItem(child);
        if (child.children !== undefined) throw new TypeError("Dropdown chỉ hỗ trợ một cấp mục con.");
      });
    });
    return items.map((item) => ({
      label: item.label.trim(), href: item.href,
      children: item.children.map((child) => ({ label: child.label.trim(), href: child.href }))
    }));
  }
  function validateCategory(category) {
    return validateMenu([category], 200)[0];
  }
  function syncCategoryLinks(category, previous, next, migrate = false) {
    const href = (item) => `gao.html?category=${encodeURIComponent(item.slug)}`;
    const oldLinks = new Map(previous.map((item) => [href(item), item]));
    const nextById = new Map(next.map((item) => [item.id, item]));
    const children = [];
    category.children.forEach((child) => {
      const old = oldLinks.get(child.href);
      if (!old) { children.push({ ...child }); return; }
      const updated = nextById.get(old.id);
      if (updated) children.push({ label: child.label === old.name ? updated.name : child.label, href: href(updated) });
    });
    const oldIds = new Set(previous.map((item) => item.id));
    const existingLinks = new Set(children.map((child) => child.href));
    const added = next.filter((item) => (migrate || !oldIds.has(item.id)) && !existingLinks.has(href(item)))
      .map((item) => ({ label: item.name, href: href(item) }));
    return validateCategory({ ...category, children: migrate ? [...added, ...children] : [...children, ...added] });
  }
  function defaultCategory(products) {
    return validateCategory({
      label: "Danh mục gạo ngon", href: "gao.html",
      children: products.map((product) => ({
        label: product.name.slice(0, 60),
        href: `chi-tiet-gao.html?id=${encodeURIComponent(product.id)}`
      }))
    });
  }
  const api = { defaultMenu, validLink, validateMenu, validateCategory, defaultCategory, syncCategoryLinks };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else window.RiceMenu = api;
})();
