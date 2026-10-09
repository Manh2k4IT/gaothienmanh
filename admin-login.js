(function () {
  const form = document.getElementById("adminLoginForm");
  const status = document.getElementById("status");
  const button = form.querySelector("button");
  const requestedPage = new URLSearchParams(location.search).get("next");
  const next = /^\/admin(?:-[a-z0-9-]+)?\.html$/.test(requestedPage || "") && requestedPage !== "/admin-login.html"
    ? requestedPage : "/admin.html";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (button.disabled) return;
    button.disabled = true;
    status.textContent = "";
    try {
      await RiceOrders.post("/api/admin/login", {
        username: form.elements.username.value,
        password: form.elements.password.value
      });
      form.elements.password.value = "";
      location.replace(next);
    } catch (error) {
      console.error("Đăng nhập quản trị thất bại:", error);
      status.textContent = error.message;
      button.disabled = false;
    }
  });
})();
