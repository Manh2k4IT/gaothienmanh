(function () {
  const form = document.getElementById("checkoutForm");
  const submit = document.getElementById("submitOrder");
  const quoteStatus = document.getElementById("quoteStatus");
  const status = document.getElementById("formStatus");
  let summary = null;
  let currentItems = [];
  let voucher = "";
  let loading = false;
  let sending = false;
  let completed = false;
  let needsRefresh = false;
  const money = (value) => `${value.toLocaleString("vi-VN")}đ`;
  function report(element, error) {
    console.error("Không thể xử lý đặt hàng:", error);
    element.textContent = error.message || "Không thể kết nối máy chủ.";
    element.classList.add("error");
    element.hidden = false;
  }
  async function refresh() {
    if (completed) return;
    if (loading || sending) { needsRefresh = true; return; }
    needsRefresh = false;
    loading = true;
    summary = null;
    submit.disabled = true;
    quoteStatus.hidden = true;
    document.getElementById("retryQuote").hidden = true;
    try {
      currentItems = RiceCart.getCart();
      voucher = sessionStorage.getItem(RiceOrders.voucherKey) || "";
      const result = await RiceOrders.post("/api/quote", { items: currentItems, voucher });
      if (needsRefresh) return;
      summary = result;
      const list = document.getElementById("items");
      list.replaceChildren();
      result.items.forEach((item) => {
        const row = document.createElement("p");
        row.className = "summary-row";
        const name = document.createElement("span");
        name.textContent = `${item.name} × ${item.quantity} kg`;
        const price = document.createElement("strong");
        price.textContent = money(item.total);
        row.append(name, price);
        list.append(row);
      });
      document.getElementById("subtotal").textContent = money(result.subtotal);
      document.getElementById("discount").textContent = `−${money(result.discount)}`;
      document.getElementById("voucherLabel").textContent = result.voucher;
      document.getElementById("total").textContent = money(result.total);
      quoteStatus.classList.remove("error");
      quoteStatus.textContent = "";
      submit.disabled = false;
    } catch (error) {
      document.getElementById("total").textContent = "Chưa tính được";
      report(quoteStatus, error);
      document.getElementById("retryQuote").hidden = false;
    } finally {
      loading = false;
      document.getElementById("dropVoucher").hidden = !voucher;
      if (needsRefresh) refresh();
    }
  }
  document.getElementById("retryQuote").addEventListener("click", refresh);
  document.getElementById("dropVoucher").addEventListener("click", () => {
    try { sessionStorage.removeItem(RiceOrders.voucherKey); refresh(); }
    catch (error) { report(quoteStatus, error); }
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!summary || loading || sending || completed) return;
    sending = true;
    submit.disabled = true;
    submit.textContent = "Đang gửi đơn…";
    status.textContent = "";
    try {
      if (JSON.stringify(currentItems) !== JSON.stringify(RiceCart.getCart())) {
        needsRefresh = true;
        throw new Error("Giỏ hàng đã thay đổi. Vui lòng kiểm tra tổng tiền mới trước khi gửi lại.");
      }
      const data = new FormData(form);
      const payload = { items: currentItems, voucher, expectedTotal: summary.total, accepted: form.elements.accepted.checked, customer: { name: data.get("name"), phone: data.get("phone"), address: data.get("address"), note: data.get("note") } };
      const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(payload)));
      const fingerprint = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
      const saved = sessionStorage.getItem("thien-manh-pending-order");
      let request = saved ? JSON.parse(saved) : null;
      if (!request || request.fingerprint !== fingerprint) {
        request = { fingerprint, id: crypto.randomUUID() };
        sessionStorage.setItem("thien-manh-pending-order", JSON.stringify(request));
      }
      const result = await RiceOrders.post("/api/orders", { ...payload, requestId: request.id });
      completed = true;
      document.getElementById("checkoutContent").hidden = true;
      document.getElementById("success").hidden = false;
      document.getElementById("receipt").textContent = `Mã đơn: ${result.id} · Tiền hàng: ${money(result.total)} (chưa gồm phí giao hàng).`;
      document.getElementById("success").focus();
      try {
        if (JSON.stringify(currentItems) === JSON.stringify(RiceCart.getCart())) RiceCart.clear();
        sessionStorage.removeItem(RiceOrders.voucherKey);
        sessionStorage.removeItem("thien-manh-pending-order");
      } catch (error) {
        console.error("Đơn đã lưu nhưng chưa dọn được giỏ:", error);
        document.getElementById("receipt").append(" Đơn đã được lưu, nhưng chưa xóa được giỏ hàng. Không gửi lại đơn này.");
      }
    } catch (error) {
      report(status, error);
      if (error.status === 409) { summary = null; needsRefresh = true; }
    } finally {
      sending = false;
      submit.disabled = !summary || completed;
      submit.textContent = "Gửi đơn đặt hàng →";
      if (needsRefresh && !completed) refresh();
    }
  });
  window.addEventListener("storage", (event) => {
    if (event.key === RiceCart.storageKey || event.key === null) {
      summary = null;
      submit.disabled = true;
      refresh();
    }
  });
  window.addEventListener("online", refresh);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });
  refresh();
})();
