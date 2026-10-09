(function () {
  async function request(url, options = {}) {
    if (!["http:", "https:"].includes(location.protocol)) throw new Error("Hãy mở cửa hàng qua máy chủ Node.js, không mở trực tiếp tệp HTML.");
    const response = await fetch(url, { credentials: "same-origin", ...options, headers: { "Content-Type": "application/json", ...options.headers } });
    if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("Máy chủ hiện tại chưa hỗ trợ nhận đơn. Hãy mở cửa hàng trên cổng 8002.");
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401 && /^\/admin(?:-[a-z0-9-]+)?\.html$/.test(location.pathname) && location.pathname !== "/admin-login.html") {
        location.replace(`/admin-login.html?next=${encodeURIComponent(location.pathname)}`);
      }
      const error = new Error(data.error || "Không thể xử lý yêu cầu.");
      error.status = response.status;
      throw error;
    }
    return data;
  }
  const post = (url, body) => request(url, { method: "POST", body: JSON.stringify(body) });
  window.RiceOrders = { request, post, voucherKey: "thien-manh-checkout-voucher" };
})();
