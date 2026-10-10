(function () {
  function login() {
    location.replace(`/admin-login.html?next=${encodeURIComponent(location.pathname)}`);
  }
  const button = document.getElementById("logout") || document.createElement("button");
  button.type = "button";
  button.textContent = "Đăng xuất";
  button.className = "admin-session-logout";
  const footer = document.createElement("div");
  footer.className = "admin-session-footer";
  footer.append(button);
  const host = document.querySelector(".sidebar") || document.querySelector(".shop-header");
  host.append(footer);
  const sidebar = document.querySelector(".sidebar");
  if (sidebar) {
    const menu = document.createElement("div");
    menu.id = "adminSidebarMenu";
    menu.className = "admin-sidebar-menu";
    Array.from(sidebar.children).forEach((child) => {
      if (!child.classList.contains("brand")) menu.append(child);
    });
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "admin-menu-toggle";
    toggle.setAttribute("aria-controls", menu.id);
    function setMenuOpen(open) {
      sidebar.classList.toggle("admin-menu-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Đóng menu quản trị" : "Mở menu quản trị");
      toggle.textContent = open ? "×" : "☰";
    }
    setMenuOpen(false);
    sidebar.append(toggle, menu);
    toggle.addEventListener("click", () => setMenuOpen(!sidebar.classList.contains("admin-menu-open")));
    menu.addEventListener("click", (event) => {
      if (event.target.closest("a")) setMenuOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && sidebar.classList.contains("admin-menu-open")) {
        setMenuOpen(false);
        toggle.focus();
      }
    });
    document.addEventListener("click", (event) => {
      if (!sidebar.contains(event.target)) setMenuOpen(false);
    });
    window.matchMedia("(max-width: 650px)").addEventListener("change", () => setMenuOpen(false));
  }
  const status = document.createElement("p");
  status.setAttribute("role", "alert");
  status.className = "admin-session-error";
  status.hidden = true;
  footer.append(status);
  const ordersLink = document.querySelector('.sidebar a[href="admin-don-hang.html"]');
  const badge = document.createElement("span");
  badge.className = "admin-order-count";
  badge.hidden = true;
  if (ordersLink) ordersLink.append(badge);
  let checking = false;
  let refreshPending = false;
  let loggingOut = false;
  async function request(url, options = {}) {
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...options });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401 && !loggingOut) login();
      throw new Error(data.error || "Không thể kiểm tra phiên quản trị.");
    }
    return data;
  }
  function report(error) {
    console.error("Lỗi phiên quản trị:", error);
    status.textContent = error.message;
    status.hidden = false;
  }
  button.addEventListener("click", async () => {
    if (loggingOut) return;
    loggingOut = true;
    button.disabled = true;
    try {
      await request("/api/admin/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      login();
    } catch (error) {
      report(error);
      loggingOut = false;
      button.disabled = false;
    }
  });
  async function check() {
    if (loggingOut) return;
    if (checking) { refreshPending = true; return; }
    checking = true;
    try {
      const session = await request("/api/admin/session");
      button.hidden = session.localMode === true;
      if (ordersLink) {
        const notifications = await request("/api/admin/order-notifications");
        if (!Number.isSafeInteger(notifications.count) || notifications.count < 0) throw new Error("Số thông báo đơn hàng không hợp lệ.");
        badge.textContent = String(notifications.count);
        badge.hidden = notifications.count === 0;
        ordersLink.setAttribute("aria-label", notifications.count ? `Đơn hàng, ${notifications.count} đơn chưa xem` : "Đơn hàng");
      }
      status.hidden = true;
    } catch (error) { if (!loggingOut) report(error); }
    finally {
      checking = false;
      if (refreshPending) { refreshPending = false; check(); }
    }
  }
  window.addEventListener("focus", check);
  window.addEventListener("riceordersseen", check);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
  let timer = setInterval(() => { if (!document.hidden) check(); }, 30000);
  window.addEventListener("pagehide", () => clearInterval(timer));
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    timer = setInterval(() => { if (!document.hidden) check(); }, 30000);
    check();
  });
  check();
})();
