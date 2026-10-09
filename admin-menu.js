(function () {
  const form = document.getElementById("menuForm");
  const editor = document.getElementById("menuEditor");
  const status = document.getElementById("status");
  let items = [];
  let category;
  let productCategories = [];
  let blogCategories = [];
  let version = null;
  let dirty = false;
  let busy = false;
  function message(text, error = false) {
    status.textContent = text;
    status.classList.toggle("error", error);
  }
  function changed(value = true) {
    dirty = value;
    document.getElementById("draftStatus").textContent = value ? "Có thay đổi chưa lưu" : "Đã đồng bộ với máy chủ";
    document.getElementById("draftStatus").classList.toggle("is-dirty", value);
  }
  function showAdmin(loggedIn) {
    form.hidden = !loggedIn;
    document.getElementById("loginPanel").hidden = loggedIn;
  }
  function node(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function fields(item) {
    const wrapper = node("div", "menu-fields");
    [["label", "Tên hiển thị", 60, "Ví dụ: Gạo thơm"], ["href", "Liên kết riêng", 1000, "Ví dụ: gao.html"]].forEach(([key, text, max, placeholder]) => {
      const label = node("label", "", text);
      const input = document.createElement("input");
      input.required = true;
      input.maxLength = max;
      input.value = item[key];
      input.placeholder = placeholder;
      input.addEventListener("input", () => {
        item[key] = input.value;
        if (key === "label") {
          const card = input.closest(".menu-card");
          if (card && !input.closest(".menu-child")) card.querySelector(".menu-card-title").textContent = input.value.trim() || "Chưa đặt tên";
        }
        changed();
      });
      input.addEventListener("change", () => input.setCustomValidity(key === "href" && !RiceMenu.validLink(input.value) ? "Nhập liên kết hợp lệ (trang nội bộ hoặc http/https/tel/mailto)." : ""));
      input.addEventListener("input", () => input.setCustomValidity(""));
      label.append(input);
      wrapper.append(label);
    });
    function categorySelect(categories, title, href) {
      if (!categories.length) return;
      const label = node("label", "", title);
      const select = document.createElement("select");
      const placeholder = node("option", "", "— Chọn danh mục —");
      placeholder.value = "";
      select.append(placeholder);
      categories.forEach((category) => {
        const option = node("option", "", category.name);
        option.value = category.id;
        select.append(option);
      });
      const matching = categories.find((category) => href(category) === item.href);
      if (matching) select.value = matching.id;
      select.addEventListener("change", () => {
        const selected = categories.find((category) => category.id === select.value);
        if (!selected) return;
        item.label = selected.name;
        item.href = href(selected);
        changed();
        render();
      });
      label.append(select);
      wrapper.append(label);
    }
    categorySelect(productCategories, "Danh mục sản phẩm", RiceCategories.href);
    categorySelect(blogCategories, "Danh mục bài viết", RiceArticles.categoryHref);
    return wrapper;
  }
  function actions(collection, index, title) {
    const wrapper = node("div", "menu-item-actions");
    [["up", "↑", "Đưa lên"], ["down", "↓", "Đưa xuống"], ["delete", "Xóa", "Xóa"]].forEach(([action, text, label]) => {
      const button = node("button", action === "delete" ? "menu-delete" : "", text);
      button.type = "button";
      button.setAttribute("aria-label", `${label} ${title}`);
      button.title = `${label} ${title}`;
      button.disabled = action === "up" ? index === 0 : action === "down" ? index === collection.length - 1 : false;
      button.addEventListener("click", () => {
        if (action === "delete") {
          if (!confirm(`Xóa ${title}${collection[index].children?.length ? " và toàn bộ mục dropdown bên trong" : ""}?`)) return;
          collection.splice(index, 1);
        } else {
          const target = index + (action === "up" ? -1 : 1);
          [collection[index], collection[target]] = [collection[target], collection[index]];
        }
        changed();
        render();
      });
      wrapper.append(button);
    });
    return wrapper;
  }
  function render() {
    editor.replaceChildren();
    if (!items.length) editor.append(node("p", "menu-empty", "Chưa có menu chính. Bấm Thêm menu chính để bắt đầu."));
    function cardFor(item, title, description, limit, controls) {
      const card = node("section", "menu-card");
      const top = node("div", "menu-card-top");
      const identity = node("div", "menu-card-identity");
      identity.append(node("span", "menu-card-number", title), node("h3", "menu-card-title", item.label || "Chưa đặt tên"));
      top.append(identity);
      if (controls) top.append(controls);
      card.append(top, fields(item));
      const children = node("div", "menu-children");
      const childHeading = node("div", "menu-children-heading");
      childHeading.append(node("h4", "", "Mục trong dropdown"), node("span", "menu-count", `${item.children.length} / ${limit} mục`));
      children.append(childHeading);
      if (!item.children.length) children.append(node("p", "intro", controls ? "Chưa có mục con. Menu này đang là liên kết trực tiếp." : "Chưa có mục con. Dropdown chỉ hiển thị liên kết Xem tất cả."));
      item.children.forEach((child, childIndex) => {
        const row = node("div", "menu-child");
        const rowTop = node("div", "menu-child-top");
        rowTop.append(node("span", "menu-child-number", `Mục ${String(childIndex + 1).padStart(2, "0")}`), actions(item.children, childIndex, `mục con ${childIndex + 1} của ${description}`));
        row.append(rowTop, fields(child));
        children.append(row);
      });
      const add = node("button", "menu-add-child", "+ Thêm mục dropdown");
      add.type = "button";
      add.disabled = item.children.length >= limit;
      add.addEventListener("click", () => {
        item.children.push({ label: "", href: "" });
        changed();
        render();
      });
      children.append(add);
      card.append(children);
      return card;
    }
    document.getElementById("categoryEditor").replaceChildren(cardFor(category, "Khối danh mục", "danh mục gạo", 200));
    items.forEach((item, index) => {
      editor.append(cardFor(item, `Menu ${index + 1}`, `menu ${index + 1}`, 20, actions(items, index, `menu ${index + 1}`)));
    });
    document.getElementById("addMenu").disabled = items.length >= 12;
  }
  async function action(callback) {
    if (busy) return;
    busy = true;
    const controls = Array.from(form.querySelectorAll("button,input,select"), (control) => ({ control, disabled: control.disabled }));
    controls.forEach(({ control }) => { control.disabled = true; });
    try { await callback(); }
    catch (error) {
      console.error("Không thể cập nhật menu:", error);
      message(error.message || "Không thể kết nối máy chủ.", true);
      if (error.status === 401) showAdmin(false);
    } finally {
      busy = false;
      controls.forEach(({ control, disabled }) => { control.disabled = disabled; });
    }
  }
  async function load() {
    const [data, categories] = await Promise.all([RiceOrders.request("/api/admin/menu"), RiceOrders.request("/api/admin/categories")]);
    productCategories = RiceCategories.validateCategories(categories.items);
    blogCategories = RiceArticles.getCategories();
    items = RiceMenu.validateMenu(data.items);
    category = RiceMenu.validateCategory(data.category);
    version = data.version;
    changed(false);
    render();
  }
  document.getElementById("addMenu").addEventListener("click", () => {
    items.push({ label: "", href: "", children: [] });
    changed();
    render();
  });
  document.getElementById("reloadMenu").addEventListener("click", () => {
    if (dirty && !confirm("Bỏ các thay đổi chưa lưu và tải lại menu từ máy chủ?")) return;
    action(async () => { await load(); message("Đã tải menu."); });
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    action(async () => {
      const data = await RiceOrders.request("/api/admin/menu", { method: "PUT", body: JSON.stringify({ items: RiceMenu.validateMenu(items), category: RiceMenu.validateCategory(category), version }) });
      items = data.items;
      category = data.category;
      version = data.version;
      changed(false);
      render();
      message("Đã lưu menu lên máy chủ. Các trang cửa hàng sẽ dùng menu mới khi tải lại.");
    });
  });
  document.getElementById("loginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    action(async () => {
      await RiceOrders.post("/api/admin/login", { username: "Manh Trinh", password: event.target.elements.password.value });
      event.target.reset();
      showAdmin(true);
      if (version === null) await load();
      else message("Đã đăng nhập lại. Các thay đổi chưa lưu được giữ nguyên.");
    });
  });
  window.addEventListener("beforeunload", (event) => {
    if (dirty) { event.preventDefault(); event.returnValue = ""; }
  });
  action(async () => {
    await RiceOrders.request("/api/admin/session");
    await load();
    showAdmin(true);
  });
})();
