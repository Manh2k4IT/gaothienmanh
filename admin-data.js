(function () {
  const status = document.getElementById("status");
  let busy = false;
  let localMode = false;
  function message(text, error = false) {
    status.textContent = text;
    status.classList.toggle("error", error);
  }
  function showAdmin(loggedIn) {
    document.getElementById("loginPanel").hidden = loggedIn;
    document.getElementById("dataContent").hidden = !loggedIn;
    document.getElementById("importDraft").disabled = !loggedIn;
    document.getElementById("logout").hidden = localMode;
  }
  function report(error) {
    console.error("Không thể quản lý dữ liệu cửa hàng:", error);
    message(error.message || "Không thể kết nối máy chủ.", true);
    if (error.status === 401) showAdmin(false);
  }
  async function action(callback) {
    if (busy) return;
    busy = true;
    try { await callback(); } catch (error) { report(error); }
    finally { busy = false; }
  }
  document.getElementById("loginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    action(async () => {
      await RiceOrders.post("/api/admin/login", { password: event.target.elements.password.value });
      event.target.reset();
      showAdmin(true);
      message("Đã đăng nhập.");
    });
  });
  document.getElementById("logout").addEventListener("click", () => action(async () => {
    await RiceOrders.post("/api/admin/logout", {});
    showAdmin(false);
    message("Đã đăng xuất.");
  }));
  document.getElementById("publish").addEventListener("click", () => {
    if (!confirm("Đăng toàn bộ sản phẩm và voucher của trình duyệt này, thay thế dữ liệu đang bán trên máy chủ?")) return;
    action(async () => {
      await RiceOrders.request("/api/admin/catalog", { method: "PUT", body: JSON.stringify({ products: RiceCatalog.getProducts(), vouchers: RiceVouchers.getVouchers() }) });
      message("Đã đăng sản phẩm và voucher lên máy chủ.");
    });
  });
  document.getElementById("download").addEventListener("click", () => {
    if (!confirm("Tải dữ liệu máy chủ về và thay thế bản nháp sản phẩm, voucher trên trình duyệt này?")) return;
    action(async () => {
      const data = await RiceOrders.request("/api/admin/catalog");
      RiceCatalog.saveProducts(data.products);
      RiceVouchers.saveVouchers(data.vouchers);
      window.dispatchEvent(new StorageEvent("storage", { key: RiceCatalog.storageKey }));
      window.dispatchEvent(new StorageEvent("storage", { key: RiceVouchers.storageKey }));
      message("Đã tải dữ liệu về trình chỉnh sửa.");
    });
  });
  document.getElementById("exportDraft").addEventListener("click", () => {
    try {
      const data = { products: RiceCatalog.getProducts(), vouchers: RiceVouchers.getVouchers() };
      const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "thien-manh-san-pham-voucher.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      message("Đã xuất sản phẩm và voucher. Không bao gồm thông tin khách hoặc đơn hàng.");
    } catch (error) { report(error); }
  });
  document.getElementById("importDraft").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!confirm("Nhập tệp và thay thế toàn bộ sản phẩm, voucher đang bán trên máy chủ?")) { event.target.value = ""; return; }
    action(async () => {
      try {
        if (file.size > 25 * 1024 * 1024) throw new Error("Tệp dữ liệu vượt quá 25 MB.");
        const data = JSON.parse(await file.text());
        await RiceOrders.request("/api/admin/catalog", { method: "PUT", body: JSON.stringify(data) });
        message("Đã nhập và đăng dữ liệu lên máy chủ.");
        try {
          RiceCatalog.saveProducts(data.products);
          RiceVouchers.saveVouchers(data.vouchers);
        } catch (error) {
          console.error("Dữ liệu đã đăng nhưng chưa lưu được bản nháp:", error);
          message("Dữ liệu đã đăng, nhưng chưa lưu được bản nháp trình duyệt. Hãy kiểm tra dung lượng bộ nhớ trước khi chỉnh sửa.", true);
        }
      } finally { event.target.value = ""; }
    });
  });
  action(async () => {
    try {
      const session = await RiceOrders.request("/api/admin/session");
      localMode = session.localMode === true;
    } catch (error) {
      if (error.status === 401) { showAdmin(false); return; }
      throw error;
    }
    showAdmin(true);
  });
})();
