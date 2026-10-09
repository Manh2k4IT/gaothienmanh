(function () {
  function validateCategories(items) {
    if (!Array.isArray(items) || items.length > 100) throw new TypeError("Có thể tạo tối đa 100 danh mục sản phẩm.");
    const ids = new Set();
    const slugs = new Set();
    return items.map((item) => {
      if (!item || typeof item.id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) || ids.has(item.id)) {
        throw new TypeError("Mã danh mục không hợp lệ hoặc bị trùng.");
      }
      if (typeof item.name !== "string" || !item.name.trim() || item.name.length > 60 || /[\u0000-\u001f\u007f]/.test(item.name)) {
        throw new TypeError("Tên danh mục cần từ 1 đến 60 ký tự.");
      }
      if (typeof item.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug) || item.slug.length > 80 || slugs.has(item.slug)) {
        throw new TypeError("Đường dẫn danh mục cần duy nhất, chỉ gồm chữ thường không dấu, số và dấu gạch ngang.");
      }
      if (!Array.isArray(item.productIds) || item.productIds.length > 100 ||
          !item.productIds.every((id) => typeof id === "string" && id.trim() && id.length <= 200) ||
          new Set(item.productIds).size !== item.productIds.length) {
        throw new TypeError("Danh sách sản phẩm trong danh mục không hợp lệ hoặc bị trùng.");
      }
      ids.add(item.id);
      slugs.add(item.slug);
      return { id: item.id, name: item.name.trim(), slug: item.slug, productIds: [...item.productIds] };
    });
  }
  function slugify(name) {
    return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80).replace(/-$/, "");
  }
  function href(category) { return `gao.html?category=${encodeURIComponent(category.slug)}`; }
  function filterProducts(products, category, search = "") {
    const ids = category ? new Set(category.productIds) : null;
    const query = search.trim().toLocaleLowerCase("vi");
    return products.filter((product) => (!ids || ids.has(product.id)) &&
      (!query || `${product.name} ${product.origin} ${product.tag || ""}`.toLocaleLowerCase("vi").includes(query)));
  }
  const api = { validateCategories, slugify, href, filterProducts };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else window.RiceCategories = api;
})();
