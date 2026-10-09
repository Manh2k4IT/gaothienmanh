(function () {
  function login() {
    location.replace(`/admin-login.html?next=${encodeURIComponent(location.pathname)}`);
  }
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Đăng xuất";
  button.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:1000;padding:12px 18px;border:1px solid #d3a650;border-radius:6px;background:#173d2c;color:white;cursor:pointer";
  document.body.append(button);
  const status = document.createElement("p");
  status.setAttribute("role", "alert");
  status.style.cssText = "position:fixed;right:16px;bottom:60px;z-index:1000;background:#fffefa;color:#a33122;padding:12px;max-width:320px";
  status.hidden = true;
  document.body.append(status);
  async function request(url, options = {}) {
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...options });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401) login();
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
    button.disabled = true;
    try {
      await request("/api/admin/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      login();
    } catch (error) {
      report(error);
      button.disabled = false;
    }
  });
  async function check() {
    try {
      const session = await request("/api/admin/session");
      button.hidden = session.localMode === true;
      status.hidden = true;
    } catch (error) { report(error); }
  }
  window.addEventListener("focus", check);
  check();
})();
