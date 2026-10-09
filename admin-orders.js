(function () {
  const status = document.getElementById("status");
  const labels = { new: "Mới đặt", confirmed: "Đã xác nhận", shipping: "Đang giao", completed: "Hoàn tất", cancelled: "Đã hủy" };
  let page = 1;
  let busy = false;
  let localMode = false;
  const money = (value) => `${value.toLocaleString("vi-VN")}đ`;
  function message(text, error = false) {
    status.textContent = text;
    status.classList.toggle("error", error);
  }
  function showAdmin(loggedIn) {
    document.getElementById("logout").hidden = localMode;
    document.getElementById("loginPanel").hidden = loggedIn;
    document.getElementById("adminContent").hidden = !loggedIn;
    if (!loggedIn) document.getElementById("orders").replaceChildren();
  }
  function report(error) {
    console.error("Không thể quản lý đơn hàng:", error);
    message(error.message || "Không thể kết nối máy chủ.", true);
    if (error.status === 401) showAdmin(false);
  }
  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function field(parent, label, value) {
    const row = element("div", "customer-field");
    row.append(element("dt", "", label), element("dd", "", value));
    parent.append(row);
    return row.lastChild;
  }
  function totalRow(parent, label, value, className = "") {
    const row = element("div", `order-amount-row ${className}`);
    row.append(element("span", "", label), element("strong", "", value));
    parent.append(row);
  }
  function renderOrder(order) {
    const card = element("article", "order-card");
    const header = element("header", "order-card-header");
    const identity = element("div", "order-identity");
    const heading = element("h3", "", `Đơn #${order.id.slice(0, 8).toUpperCase()}`);
    identity.append(heading, element("p", "order-meta", new Date(order.createdAt).toLocaleString("vi-VN")));
    const badge = element("span", `order-badge status-${order.status}`, labels[order.status]);
    header.append(identity, badge);
    card.append(header);

    const details = element("div", "order-details");
    const customer = element("section", "order-customer");
    customer.append(element("h4", "order-section-title", "Thông tin khách hàng"));
    const fields = element("dl", "customer-fields");
    field(fields, "Người nhận", order.customer.name).classList.add("customer-name");
    const phone = field(fields, "Số điện thoại", "");
    const call = element("a", "customer-phone", order.customer.phone);
    const normalizedPhone = order.customer.phone.replace(/[\s.-]/g, "");
    if (/^(?:0|\+84)[0-9]{8,10}$/.test(normalizedPhone)) call.href = `tel:${normalizedPhone}`;
    call.setAttribute("aria-label", `Gọi khách ${order.customer.name}: ${order.customer.phone}`);
    phone.append(call);
    field(fields, "Địa chỉ giao hàng", order.customer.address);
    customer.append(fields);
    if (order.customer.note) {
      const note = element("div", "customer-note");
      note.append(element("strong", "", "Ghi chú từ khách"), element("p", "", order.customer.note));
      customer.append(note);
    }

    const products = element("section", "order-products");
    products.append(element("h4", "order-section-title", "Sản phẩm đã đặt"));
    const list = element("ul", "order-product-list");
    order.items.forEach((item) => {
      const row = element("li", "order-product-row");
      const description = element("div", "");
      description.append(element("strong", "order-product-name", item.name), element("span", "order-product-meta", `${item.quantity} kg × ${money(item.price)} / kg`));
      row.append(description, element("strong", "order-line-total", money(item.total)));
      list.append(row);
    });
    products.append(list);
    const amounts = element("div", "order-amounts");
    totalRow(amounts, "Tạm tính", money(order.subtotal));
    if (order.voucher || order.discount) totalRow(amounts, order.voucher ? `Giảm giá · ${order.voucher}` : "Giảm giá", `−${money(order.discount)}`);
    totalRow(amounts, "Phí giao hàng", "Chờ xác nhận");
    totalRow(amounts, "Tổng tiền hàng", money(order.total), "order-grand-total");
    products.append(amounts);
    details.append(customer, products);
    card.append(details);

    const footer = element("footer", "order-card-footer");
    const label = element("label", "order-status-label", "Cập nhật trạng thái");
    const select = document.createElement("select");
    Object.entries(labels).forEach(([value, text]) => {
      const option = element("option", "", text);
      option.value = value;
      select.append(option);
    });
    select.value = order.status;
    select.addEventListener("change", async () => {
      select.disabled = true;
      try {
        await RiceOrders.request(`/api/admin/orders/${order.id}`, { method: "PATCH", body: JSON.stringify({ status: select.value }) });
        order.status = select.value;
        badge.className = `order-badge status-${order.status}`;
        badge.textContent = labels[order.status];
        message(`Đã cập nhật đơn #${order.id.slice(0, 8).toUpperCase()}.`);
      } catch (error) { select.value = order.status; report(error); }
      finally { select.disabled = false; }
    });
    label.append(select);
    footer.append(label, element("span", "order-full-id", `Mã đơn đầy đủ: ${order.id}`));
    card.append(footer);
    return card;
  }
  async function loadOrders(targetPage = page) {
    const data = await RiceOrders.request(`/api/admin/orders?page=${targetPage}`);
    const cards = data.orders.map(renderOrder);
    if (!cards.length) {
      const empty = element("div", "orders-empty");
      empty.append(element("span", "orders-empty-icon", "☷"), element("h3", "", "Chưa có đơn hàng"), element("p", "", "Đơn khách gửi sẽ xuất hiện tại đây. Nhấn Làm mới để kiểm tra đơn mới."));
      cards.push(empty);
    }
    document.getElementById("orders").replaceChildren(...cards);
    page = targetPage;
    document.getElementById("count").textContent = `${data.count} đơn hàng · ${data.orders.length} đơn trên trang này`;
    document.getElementById("pageLabel").textContent = `Trang ${page}`;
    document.getElementById("previous").disabled = page === 1;
    document.getElementById("next").disabled = page * 30 >= data.count;
  }
  async function action(callback) {
    if (busy) return;
    busy = true;
    document.getElementById("refresh").disabled = true;
    try { await callback(); } catch (error) { report(error); }
    finally { busy = false; document.getElementById("refresh").disabled = false; }
  }
  document.getElementById("loginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    action(async () => {
      await RiceOrders.post("/api/admin/login", { password: event.target.elements.password.value });
      event.target.reset();
      showAdmin(true);
      await loadOrders();
      message("Đã đăng nhập.");
    });
  });
  document.getElementById("refresh").addEventListener("click", () => action(async () => { await loadOrders(); message("Đã làm mới đơn hàng."); }));
  document.getElementById("previous").addEventListener("click", () => action(async () => { if (page > 1) await loadOrders(page - 1); }));
  document.getElementById("next").addEventListener("click", () => action(() => loadOrders(page + 1)));
  document.getElementById("logout").addEventListener("click", () => action(async () => { await RiceOrders.post("/api/admin/logout", {}); showAdmin(false); message("Đã đăng xuất."); }));
  action(async () => {
    try {
      const session = await RiceOrders.request("/api/admin/session");
      localMode = session.localMode === true;
    } catch (error) {
      if (error.status === 401) { showAdmin(false); return; }
      throw error;
    }
    showAdmin(true);
    await loadOrders();
  });
})();
