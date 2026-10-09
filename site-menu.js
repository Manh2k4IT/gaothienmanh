(function () {
  const nav = document.getElementById("navLinks");
  if (!nav) return;
  function closeAll(except) {
    nav.querySelectorAll(".managed-toggle").forEach((button) => {
      if (button === except) return;
      button.setAttribute("aria-expanded", "false");
      document.getElementById(button.getAttribute("aria-controls")).hidden = true;
    });
  }
  function closeMobileMenu() {
    nav.classList.remove("open");
    const toggle = document.getElementById("menuToggle");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Mở menu");
    toggle.textContent = "☰";
  }
  function render(items) {
    const fragment = document.createDocumentFragment();
    items.forEach((item, index) => {
      const group = document.createElement("div");
      group.className = "managed-item";
      const hasDropdown = item.children.length > 0;
      const link = document.createElement(hasDropdown ? "button" : "a");
      link.className = "managed-main-link";
      link.textContent = item.label;
      if (!hasDropdown) link.href = item.href;
      const target = new URL(item.href, location.href);
      if (target.origin === location.origin && target.pathname === location.pathname && !target.hash && target.search === location.search) link.setAttribute("aria-current", "page");
      group.append(link);
      if (hasDropdown) {
        const button = link;
        button.type = "button";
        button.classList.add("managed-toggle");
        const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        arrow.setAttribute("class", "managed-arrow");
        arrow.setAttribute("viewBox", "0 0 16 16");
        arrow.setAttribute("aria-hidden", "true");
        arrow.setAttribute("focusable", "false");
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", "M4 6l4 4 4-4");
        arrow.append(path);
        button.append(arrow);
        button.setAttribute("aria-label", `Mở danh mục ${item.label}`);
        button.setAttribute("aria-expanded", "false");
        button.setAttribute("aria-controls", `managed-panel-${index}`);
        const panel = document.createElement("div");
        panel.className = "managed-panel";
        panel.id = `managed-panel-${index}`;
        panel.hidden = true;
        const parentLink = document.createElement("a");
        parentLink.className = "managed-sub-link managed-parent-link";
        parentLink.textContent = `Xem tất cả: ${item.label}`;
        parentLink.href = item.href;
        panel.append(parentLink);
        item.children.forEach((child) => {
          const childLink = document.createElement("a");
          childLink.className = "managed-sub-link";
          childLink.textContent = child.label;
          childLink.href = child.href;
          panel.append(childLink);
        });
        group.append(panel);
      }
      fragment.append(group);
    });
    nav.replaceChildren(fragment);
    nav.classList.add("managed-menu");
  }
  function renderCategory(category) {
    const toggle = document.getElementById("riceDropdownToggle");
    const panel = document.getElementById("riceDropdownPanel");
    panel.dataset.managed = "true";
    toggle.hidden = false;
    const label = toggle.querySelector(".category-label");
    const icon = document.createElement("span");
    icon.className = "category-menu-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "☰";
    label.replaceChildren(icon, document.createTextNode(category.label));
    panel.replaceChildren();
    panel.setAttribute("aria-label", category.label);
    [{ label: `Xem tất cả: ${category.label}`, href: category.href }, ...category.children].forEach((item) => {
      const link = document.createElement("a");
      link.className = "dropdown-link";
      link.href = item.href;
      const name = document.createElement("strong");
      name.textContent = item.label;
      const arrow = document.createElement("span");
      arrow.className = "dropdown-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "→";
      link.append(name, arrow);
      panel.append(link);
    });
  }
  nav.addEventListener("click", (event) => {
    const toggle = event.target.closest(".managed-toggle");
    if (toggle) {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      closeAll(toggle);
      toggle.setAttribute("aria-expanded", String(open));
      const panel = document.getElementById(toggle.getAttribute("aria-controls"));
      panel.hidden = !open;
      if (open && matchMedia("(min-width: 651px)").matches) {
        panel.style.left = "0";
        panel.style.right = "auto";
        if (panel.getBoundingClientRect().right > innerWidth - 16) {
          panel.style.left = "auto";
          panel.style.right = "0";
        }
      }
    } else if (event.target.closest("a")) {
      closeAll();
      closeMobileMenu();
    }
  });
  nav.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const expanded = nav.querySelector('.managed-toggle[aria-expanded="true"]');
      if (expanded) { closeAll(); expanded.focus(); event.preventDefault(); }
    }
  });
  document.addEventListener("click", (event) => {
    if (!nav.contains(event.target) || event.target.closest("#menuToggle")) closeAll();
  });
  async function load() {
    try {
      const data = await RiceOrders.request("/api/menu");
      const items = RiceMenu.validateMenu(data.items);
      const category = RiceMenu.validateCategory(data.category);
      render(items);
      renderCategory(category);
      document.getElementById("menuLoadError")?.remove();
    } catch (error) {
      console.error("Không thể tải menu cửa hàng:", error);
      if (document.getElementById("menuLoadError")) return;
      const notice = document.createElement("p");
      notice.id = "menuLoadError";
      notice.setAttribute("role", "alert");
      notice.style.cssText = "margin:0;padding:8px 16px;background:#fff3e6;color:#873e29;font:12px Arial,sans-serif";
      notice.textContent = "Chưa tải được menu đã lưu. Đang hiển thị menu sẵn có; hãy mở bản máy chủ cổng 8002 hoặc tải lại trang.";
      document.querySelector(".main-nav-band").after(notice);
    }
  }
  if (["http:", "https:"].includes(location.protocol)) {
    load();
    document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });
  }
})();
