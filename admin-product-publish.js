(function () {
  const button = document.getElementById("publishProducts");
  const status = document.getElementById("publishStatus");
  let busy = false;
  function message(text, error = false) {
    status.textContent = text;
    status.style.color = error ? "#964a3d" : "#24543b";
  }
  button.addEventListener("click", async () => {
    if (busy) return;
    busy = true;
    button.disabled = true;
    try {
      const products = RiceCatalog.getProducts();
      const current = await RiceOrders.request("/api/admin/catalog");
      const ids = new Set(products.map(product => product.id));
      const removed = current.products.filter(product => !ids.has(product.id));
      const warning = removed.length ? `\nSản phẩm đang bán sẽ bị gỡ: ${removed.map(product => product.name).join(", ")}.` : "";
      if (!confirm(`Đăng ${products.length} sản phẩm trong bản nháp lên cửa hàng, thay thế danh sách sản phẩm đang bán?${warning}\nVoucher đang bán được giữ nguyên.`)) return;
      message("Đang đăng sản phẩm…");
      await RiceOrders.request("/api/admin/catalog", { method: "PUT", body: JSON.stringify({ products, vouchers: current.vouchers }) });
      message("Đã đăng sản phẩm ra web. Mở hoặc tải lại cửa hàng để xem.");
    } catch (error) {
      console.error("Không thể đăng sản phẩm:", error);
      message(error.status === 401 ? "Cần đăng nhập quản trị. Bấm Đăng nhập / Dữ liệu cửa hàng, đăng nhập rồi quay lại đăng sản phẩm." : error.message || "Không thể đăng sản phẩm. Bản nháp vẫn được giữ, vui lòng thử lại.", true);
    } finally {
      busy = false;
      button.disabled = false;
    }
  });
})();
