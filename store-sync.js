(function () {
  if (!["http:", "https:"].includes(location.protocol)) return;
  let syncing = false;
  let notice = null;
  async function syncCatalog() {
    if (syncing) return;
    syncing = true;
    try {
      const catalog = await RiceOrders.request("/api/catalog", { cache: "no-store" });
      RiceCatalog.cacheServerProducts(catalog.products);
      RiceVouchers.cacheServerVouchers(catalog.vouchers);
      window.dispatchEvent(new StorageEvent("storage", { key: RiceCatalog.storageKey }));
      window.dispatchEvent(new StorageEvent("storage", { key: RiceVouchers.storageKey }));
      if (notice) {
        notice.remove();
        notice = null;
      }
    } catch (error) {
      console.error("Không thể đồng bộ cửa hàng:", error);
      if (!notice) {
        notice = document.createElement("p");
        notice.setAttribute("role", "alert");
        notice.style.cssText = "margin:0;padding:12px 20px;background:#fff3e6;color:#873e29;font:14px Arial,sans-serif;line-height:1.6;text-align:center";
        document.body.prepend(notice);
      }
      notice.textContent = `Chưa đồng bộ được sản phẩm, thứ tự, giá và tồn kho máy chủ: ${error.message}`;
    } finally {
      syncing = false;
    }
  }
  window.addEventListener("focus", syncCatalog);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncCatalog();
  });
  syncCatalog();
})();
