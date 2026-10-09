(function () {
  const status = document.getElementById("status");
  const list = document.getElementById("contacts");
  let page = 1;
  let busy = false;
  function message(text, error = false) {
    status.textContent = text;
    status.classList.toggle("error", error);
  }
  function showAdmin(value) {
    document.getElementById("adminContent").hidden = !value;
    document.getElementById("loginPanel").hidden = value;
  }
  function node(tag, className, text) {
    const el = document.createElement(tag);
    el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  async function load(target = page) {
    const data = await RiceOrders.request(`/api/admin/contacts?page=${target}`);
    page = target;
    list.replaceChildren();
    if (!data.contacts.length) list.append(node("p", "contacts-empty", "Chưa có khách đăng ký ở trang này."));
    data.contacts.forEach(contact => {
      const card = node("article", "contact-card");
      const identity = node("div", "");
      const time = node("time", "", new Date(contact.createdAt).toLocaleString("vi-VN"));
      time.dateTime = contact.createdAt;
      identity.append(node("h3", "", contact.name), time);
      const links = node("div", "contact-links");
      const phone = node("a", "customer-phone", "☎ " + contact.phone);
      phone.href = `tel:${contact.phone}`;
      links.append(phone);
      if (contact.email) {
        const email = node("a", "contact-email", contact.email);
        email.href = `mailto:${contact.email}`;
        links.append(email);
      } else links.append(node("span", "order-meta", "Không cung cấp email"));
      card.append(identity, links);
      list.append(card);
    });
    const pages = Math.max(1, Math.ceil(data.count / data.pageSize));
    document.getElementById("count").textContent = `${data.count} lượt đăng ký · Mới nhất trước`;
    document.getElementById("pageLabel").textContent = `Trang ${page} / ${pages}`;
    document.getElementById("pageLabel").dataset.pages = String(pages);
    document.getElementById("previous").disabled = page <= 1;
    document.getElementById("next").disabled = page >= pages;
    showAdmin(true);
  }
  async function action(callback) {
    if (busy) return;
    busy = true;
    const controls = Array.from(document.querySelectorAll("button,input"));
    controls.forEach(control => { control.disabled = true; });
    try { await callback(); }
    catch (error) {
      console.error("Không thể tải khách đăng ký:", error);
      message(error.message || "Không thể kết nối máy chủ.", true);
      if (error.status === 401) showAdmin(false);
    } finally {
      busy = false;
      controls.forEach(control => { control.disabled = false; });
      const pages = document.getElementById("pageLabel").dataset.pages;
      document.getElementById("previous").disabled = page <= 1;
      document.getElementById("next").disabled = !pages || page >= Number(pages);
    }
  }
  document.getElementById("refresh").addEventListener("click", () => action(async () => { await load(1); message("Đã làm mới danh sách."); }));
  document.getElementById("previous").addEventListener("click", () => action(async () => { await load(page - 1); message(""); }));
  document.getElementById("next").addEventListener("click", () => action(async () => { await load(page + 1); message(""); }));
  document.getElementById("loginForm").addEventListener("submit", event => {
    event.preventDefault();
    action(async () => {
      await RiceOrders.post("/api/admin/login", { password: event.target.elements.password.value });
      event.target.reset();
      await load();
      message("");
    });
  });
  action(async () => { await load(); });
})();
