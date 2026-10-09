(function () {
  const form = document.getElementById("categoriesForm");
  const editor = document.getElementById("categoriesEditor");
  const status = document.getElementById("status");
  const loadError = document.getElementById("loadError");
  const content = document.getElementById("categoriesContent");
  const editorStatus = document.getElementById("editorStatus");
  let items = [];
  let products = [];
  let version = null;
  let dirty = false;
  let busy = false;
  let draft = null;
  const autoSlugs = new Set();
  function node(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function changed(value = true) {
    dirty = value;
    status.classList.remove("error");
    editorStatus.classList.remove("error");
    document.getElementById("draftStatus").textContent = value ? "Có thay đổi chưa lưu" : "Đã đồng bộ với máy chủ";
    if (value) {
      status.textContent = "";
      editorStatus.textContent = "";
      editor.querySelectorAll(".category-link").forEach((link) => link.removeAttribute("href"));
    }
  }
  function render() {
    editor.replaceChildren();
    content.hidden = draft !== null;
    form.hidden = draft === null;
    if (!draft) { renderList(); return; }
    [draft].forEach((item) => {
      const card = node("section", "category-card");
      const top = node("div", "category-top");
      top.append(node("h2", "", items.some((saved) => saved.id === item.id) ? "Sửa danh mục" : "Tạo danh mục mới"));
      const fields = node("div", "category-fields");
      const nameLabel = node("label", "", "Tên danh mục");
      const name = document.createElement("input");
      name.required = true;
      name.maxLength = 60;
      name.value = item.name;
      name.placeholder = "Ví dụ: Gạo lài";
      const slugLabel = node("label", "", "Đường dẫn (không dấu, không khoảng trắng)");
      const slug = document.createElement("input");
      slug.required = true;
      slug.maxLength = 80;
      slug.pattern = "[a-z0-9]+(?:-[a-z0-9]+)*";
      slug.value = item.slug;
      slug.placeholder = "gao-lai";
      const link = node("a", "category-link");
      function updateLink() {
        link.textContent = `Trang danh mục: ${RiceCategories.href(item)}${dirty ? " · lưu trước khi xem" : ""}`;
        if (!dirty) link.href = RiceCategories.href(item);
        else link.removeAttribute("href");
      }
      name.addEventListener("input", () => {
        item.name = name.value;
        if (autoSlugs.has(item.id)) { item.slug = RiceCategories.slugify(item.name); slug.value = item.slug; }
        changed();
        updateLink();
      });
      slug.addEventListener("input", () => { autoSlugs.delete(item.id); item.slug = slug.value; changed(); updateLink(); });
      nameLabel.append(name);
      slugLabel.append(slug);
      fields.append(nameLabel, slugLabel);
      updateLink();
      const selected = node("p", "category-selected", `Đã chọn ${item.productIds.length} sản phẩm`);
      const searchLabel = node("label", "", "Tìm sản phẩm để chọn");
      const search = document.createElement("input");
      search.type = "search";
      search.placeholder = "Nhập tên gạo…";
      searchLabel.append(search);
      const list = node("div", "category-products");
      const knownIds = new Set(products.map((product) => product.id));
      const choices = [...products, ...item.productIds.filter((id) => !knownIds.has(id)).map((id) => ({ id, name: `Sản phẩm đã xóa: ${id}`, origin: "Bỏ chọn sản phẩm này trước khi lưu." }))];
      function renderProducts() {
        list.replaceChildren();
        const matches = RiceCategories.filterProducts(choices, null, search.value);
        if (!matches.length) list.append(node("p", "intro", "Không có sản phẩm phù hợp."));
        matches.forEach((product) => {
          const label = node("label", "category-product");
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = item.productIds.includes(product.id);
          checkbox.addEventListener("change", () => {
            if (checkbox.checked) item.productIds.push(product.id);
            else item.productIds = item.productIds.filter((id) => id !== product.id);
            selected.textContent = `Đã chọn ${item.productIds.length} sản phẩm`;
            changed();
            updateLink();
          });
          const details = node("span", "", product.name);
          details.append(node("small", "", product.origin));
          label.append(checkbox);
          if (product.image) {
            const image = document.createElement("img");
            image.className = "category-product-image";
            image.src = product.image;
            image.alt = "";
            image.loading = "lazy";
            label.append(image);
          }
          label.append(details);
          list.append(label);
        });
      }
      search.addEventListener("input", renderProducts);
      renderProducts();
      card.append(top, fields, link, selected, searchLabel, list);
      editor.append(card);
    });
    document.getElementById("addCategory").disabled = items.length >= 100;
  }
  function renderList() {
    const list = document.getElementById("categoriesList");
    list.replaceChildren();
    document.getElementById("categoryCount").textContent = `Danh sách danh mục (${items.length})`;
    if (!items.length) list.append(node("p", "panel intro", "Chưa có danh mục. Bấm Tạo danh mục để bắt đầu."));
    items.forEach((item, index) => {
      const row = node("section", "category-list-row");
      const info = node("div", "category-list-info");
      info.append(node("h3", "", item.name), node("p", "", `${item.productIds.length} sản phẩm đã chọn`));
      const link = node("a", "category-link", `Xem danh mục: ${RiceCategories.href(item)}`);
      link.href = RiceCategories.href(item);
      info.append(link);
      const actions = node("div", "category-actions");
      [["↑", "Đưa lên", -1], ["↓", "Đưa xuống", 1], ["Sửa", "Sửa", null], ["Xóa", "Xóa", 0]].forEach(([text, label, direction]) => {
        const button = node("button", direction === 0 ? "category-delete" : "", text);
        button.type = "button";
        button.setAttribute("aria-label", `${label} danh mục ${item.name}`);
        button.disabled = direction === -1 ? index === 0 : direction === 1 ? index === items.length - 1 : false;
        button.addEventListener("click", () => {
          if (direction === null) {
            draft = { ...item, productIds: [...item.productIds] };
            changed(false);
            render();
            editor.querySelector("input").focus();
            return;
          }
          const next = items.map((saved) => ({ ...saved, productIds: [...saved.productIds] }));
          if (direction === 0) {
            if (!confirm(`Xóa danh mục “${item.name}”? Sản phẩm không bị xóa. Liên kết tới danh mục này trong menu tùy chỉnh cần được sửa riêng.`)) return;
            next.splice(index, 1);
          } else {
            const target = index + direction;
            [next[index], next[target]] = [next[target], next[index]];
          }
          action(async () => {
            await save(next);
            status.textContent = direction === 0 ? "Đã xóa danh mục. Sản phẩm vẫn được giữ nguyên." : "Đã lưu thứ tự danh mục.";
          });
        });
        actions.append(button);
      });
      row.append(info, actions);
      list.append(row);
    });
    document.getElementById("addCategory").disabled = items.length >= 100;
  }
  async function save(next) {
    const data = await RiceOrders.request("/api/admin/categories", { method: "PUT", body: JSON.stringify({ items: RiceCategories.validateCategories(next), version }) });
    items = RiceCategories.validateCategories(data.items);
    version = data.version;
    draft = null;
    autoSlugs.clear();
    changed(false);
    render();
  }
  async function load() {
    const [data, catalog] = await Promise.all([RiceOrders.request("/api/admin/categories"), RiceOrders.request("/api/admin/catalog")]);
    items = RiceCategories.validateCategories(data.items);
    products = catalog.products;
    version = data.version;
    autoSlugs.clear();
    draft = null;
    changed(false);
    render();
    document.getElementById("loginPanel").hidden = true;
    loadError.textContent = "";
    document.getElementById("retryLoad").hidden = true;
  }
  async function action(callback) {
    if (busy) return;
    busy = true;
    const controls = Array.from(document.querySelectorAll("button,input"), (control) => ({ control, disabled: control.disabled }));
    controls.forEach(({ control }) => { control.disabled = true; });
    try { await callback(); }
    catch (error) {
      console.error("Không thể cập nhật danh mục sản phẩm:", error);
      status.classList.add("error");
      status.textContent = error.message;
      editorStatus.classList.add("error");
      editorStatus.textContent = error.message;
      if (version === null) {
        loadError.textContent = error.message;
        document.getElementById("retryLoad").hidden = false;
      }
      if (error.status === 401) document.getElementById("loginPanel").hidden = false;
    } finally {
      busy = false;
      controls.forEach(({ control, disabled }) => { control.disabled = disabled; });
    }
  }
  document.getElementById("addCategory").addEventListener("click", () => {
    const id = crypto.randomUUID();
    autoSlugs.add(id);
    draft = { id, name: "", slug: "", productIds: [] };
    changed();
    render();
    editor.lastElementChild.querySelector("input").focus();
  });
  document.getElementById("cancelCategory").addEventListener("click", () => {
    if (dirty && !confirm("Bỏ thay đổi chưa lưu và quay lại danh sách danh mục?")) return;
    draft = null;
    autoSlugs.clear();
    changed(false);
    render();
    document.getElementById("addCategory").focus();
  });
  function reload() {
    if (dirty && !confirm("Bỏ thay đổi chưa lưu và tải lại danh mục, sản phẩm từ máy chủ?")) return;
    action(load);
  }
  document.getElementById("reloadCategories").addEventListener("click", reload);
  document.getElementById("reloadEditor").addEventListener("click", reload);
  document.getElementById("retryLoad").addEventListener("click", () => action(load));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    action(async () => {
      const index = items.findIndex((item) => item.id === draft.id);
      const next = items.map((item) => ({ ...item, productIds: [...item.productIds] }));
      if (index === -1) next.push(draft);
      else next[index] = draft;
      await save(next);
      status.classList.remove("error");
      status.textContent = "Đã lưu danh mục. Khách có thể mở danh mục từ dropdown Danh mục gạo ngon.";
    });
  });
  document.getElementById("loginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    action(async () => {
      await RiceOrders.post("/api/admin/login", { password: event.target.elements.password.value });
      event.target.reset();
      document.getElementById("loginPanel").hidden = true;
      if (version === null) await load();
      else { loadError.textContent = ""; status.textContent = "Đã đăng nhập lại. Thay đổi chưa lưu được giữ nguyên."; }
    });
  });
  window.addEventListener("beforeunload", (event) => {
    if (dirty) { event.preventDefault(); event.returnValue = ""; }
  });
  action(load);
})();
