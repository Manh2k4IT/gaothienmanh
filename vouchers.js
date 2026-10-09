(function () {
  const storageKey = "thien-manh-rice-vouchers-v1";

  function normalizeCode(code) {
    return String(code).trim().toUpperCase();
  }

  function isValidDate(value) {
    if (value === "") return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function validateVouchers(vouchers) {
    if (!Array.isArray(vouchers) || !vouchers.every((voucher) =>
      voucher &&
      typeof voucher.code === "string" && /^[A-Z0-9_-]{3,30}$/.test(voucher.code) &&
      ["percent", "fixed"].includes(voucher.type) &&
      Number.isSafeInteger(voucher.value) && voucher.value > 0 &&
      (voucher.type !== "percent" || voucher.value <= 100) &&
      Number.isSafeInteger(voucher.minimum) && voucher.minimum >= 0 &&
      typeof voucher.expires === "string" && isValidDate(voucher.expires) &&
      typeof voucher.active === "boolean"
    ) || new Set(vouchers.map((voucher) => voucher.code)).size !== vouchers.length) {
      throw new TypeError("Dữ liệu voucher không hợp lệ. Mã phải duy nhất, giảm giá phải là số nguyên dương và ngày hết hạn hợp lệ.");
    }
  }

  function getVouchers() {
    const customerPage = typeof location !== "undefined" && !location.pathname.split("/").pop().startsWith("admin");
    const saved = (customerPage ? localStorage.getItem(`${storageKey}-server`) : null) ?? localStorage.getItem(storageKey);
    const vouchers = saved === null ? [] : JSON.parse(saved);
    validateVouchers(vouchers);
    return vouchers;
  }

  function saveVouchers(vouchers) {
    validateVouchers(vouchers);
    localStorage.setItem(storageKey, JSON.stringify(vouchers));
  }

  function cacheServerVouchers(vouchers) {
    validateVouchers(vouchers);
    localStorage.setItem(`${storageKey}-server`, JSON.stringify(vouchers));
  }

  function localDate(now) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  function calculateDiscount(code, subtotal, now = new Date()) {
    if (!Number.isSafeInteger(subtotal) || subtotal < 0) throw new TypeError("Tạm tính đơn hàng không hợp lệ.");
    const voucher = getVouchers().find((item) => item.code === normalizeCode(code));
    if (!voucher || !voucher.active) throw new RangeError("Mã voucher không tồn tại hoặc đã ngừng áp dụng.");
    if (voucher.expires && localDate(now) > voucher.expires) throw new RangeError("Voucher đã hết hạn.");
    if (!subtotal) throw new RangeError("Hãy thêm sản phẩm vào giỏ trước khi áp dụng voucher.");
    if (subtotal < voucher.minimum) {
      throw new RangeError(`Voucher áp dụng cho đơn từ ${voucher.minimum.toLocaleString("vi-VN")}đ.`);
    }
    const discount = Math.min(subtotal, voucher.type === "percent" ? Math.round(subtotal * voucher.value / 100) : voucher.value);
    return { code: voucher.code, discount, total: subtotal - discount };
  }

  window.RiceVouchers = { storageKey, normalizeCode, getVouchers, saveVouchers, cacheServerVouchers, calculateDiscount };
})();
