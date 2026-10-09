(function () {
  const form = document.getElementById("categoriesForm");
  const content = document.getElementById("categoriesContent");
  const status = document.getElementById("status");
  let categories = [];
  let articles = [];
  let draft = null;
  let dirty = false;
  let autoSlug = false;
  let snapshot = "";
  let articlesSnapshot = "";
  let selectedArticles = new Set();
  function changed() {
    dirty = true;
    document.getElementById("draftStatus").textContent = "Có thay đổi chưa lưu";
    document.getElementById("editorStatus").textContent = "";
  }
  function node(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
  }
  function errorMessage(error) {
    console.error("Không thể cập nhật danh mục bài viết:", error);
    status.classList.add("error");
    status.textContent = error.message;
    const editorStatus = document.getElementById("editorStatus");
    editorStatus.classList.add("error");
    editorStatus.textContent = error.message;
    document.getElementById("retryLoad").hidden = false;
  }
  function render() {
    form.hidden = draft === null;
    content.hidden = draft !== null;
    if (draft) {
      document.getElementById("editorTitle").textContent = categories.some((item) => item.id === draft.id) ? "Sửa danh mục bài viết" : "Tạo danh mục bài viết";
      form.elements.name.value = draft.name;
      form.elements.slug.value = draft.slug;
      document.getElementById("editorStatus").textContent = "";
      document.getElementById("draftStatus").textContent = "Chưa có thay đổi";
      document.getElementById("articleSearch").value = "";
      renderArticleChoices();
      form.elements.name.focus();
      return;
    }
    const list = document.getElementById("categoriesList");
    list.replaceChildren();
    document.getElementById("categoryCount").textContent = `Danh sách danh mục (${categories.length})`;
    if (!categories.length) list.append(node("p", "panel intro", "Chưa có danh mục bài viết."));
    categories.forEach((category, index) => {
      const row = node("section", "category-list-row", "");
      const info = node("div", "category-list-info", "");
      const count = articles.filter((article) => article.categoryId === category.id).length;
      info.append(node("h3", "", category.name), node("p", "", `${count} bài viết`));
      const link = node("a", "category-link", "Xem danh mục");
      link.href = RiceArticles.categoryHref(category);
      info.append(link);
      const actions = node("div", "category-actions", "");
      [["↑", "Đưa lên", -1], ["↓", "Đưa xuống", 1], ["Sửa", "Sửa", null], ["Xóa", "Xóa", 0]].forEach(([text, title, direction]) => {
        const button = node("button", direction === 0 ? "category-delete" : "", text);
        button.type = "button";
        button.setAttribute("aria-label", `${title} danh mục ${category.name}`);
        button.disabled = direction === -1 ? index === 0 : direction === 1 ? index === categories.length - 1 : false;
        button.addEventListener("click", () => {
          if (direction === null) {
            draft = { ...category };
            selectedArticles = new Set(articles.filter((article) => article.categoryId === category.id).map((article) => article.id));
            dirty = false;
            autoSlug = false;
            render();
            return;
          }
          const next = categories.map((item) => ({ ...item }));
          if (direction === 0) {
            if (!confirm(`Xóa danh mục “${category.name}”? Bài viết không bị xóa, sẽ chuyển sang Chưa phân loại. Liên kết menu tới danh mục này cần được sửa riêng.`)) return;
            next.splice(index, 1);
          } else {
            const target = index + direction;
            [next[index], next[target]] = [next[target], next[index]];
          }
          save(next);
        });
        actions.append(button);
      });
      row.append(info, actions);
      list.append(row);
    });
    document.getElementById("addCategory").disabled = categories.length >= 100;
  }
  function load() {
    try {
      categories = RiceArticles.getCategories();
      articles = RiceArticles.getArticles();
      snapshot = localStorage.getItem(RiceArticles.categoriesKey);
      articlesSnapshot = localStorage.getItem(RiceArticles.storageKey);
      draft = null;
      dirty = false;
      status.textContent = "";
      document.getElementById("retryLoad").hidden = true;
      render();
    } catch (error) { errorMessage(error); }
  }
  function save(next) {
    try {
      if (localStorage.getItem(RiceArticles.categoriesKey) !== snapshot) throw new Error("Danh mục đã được sửa ở thẻ khác. Hãy tải lại trước khi lưu.");
      if (localStorage.getItem(RiceArticles.storageKey) !== articlesSnapshot) throw new Error("Bài viết đã thay đổi ở thẻ khác. Hãy tải lại trước khi lưu.");
      if (draft) {
        const selectedCategory = next.find((item) => item.id === draft.id);
        const nextArticles = articles.map((article) => {
          if (selectedArticles.has(article.id)) return { ...article, categoryId: draft.id, category: selectedCategory.name };
          if (article.categoryId === draft.id) return { ...article, categoryId: "", category: "Chưa phân loại" };
          return article;
        });
        RiceArticles.saveCategorySelection(next, nextArticles);
      } else RiceArticles.saveCategories(next);
      load();
      status.classList.remove("error");
      status.textContent = "Đã lưu danh mục bài viết.";
    } catch (error) { errorMessage(error); }
  }
  document.getElementById("addCategory").addEventListener("click", () => {
    draft = { id: crypto.randomUUID(), name: "", slug: "" };
    selectedArticles = new Set();
    autoSlug = true;
    dirty = false;
    render();
  });
  form.addEventListener("input", (event) => {
    if (![form.elements.name, form.elements.slug].includes(event.target)) return;
    draft.name = form.elements.name.value;
    if (event.target === form.elements.slug) autoSlug = false;
    if (autoSlug) form.elements.slug.value = RiceArticles.slugifyCategory(draft.name);
    draft.slug = form.elements.slug.value;
    changed();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const next = categories.map((item) => ({ ...item }));
    const index = next.findIndex((item) => item.id === draft.id);
    if (index === -1) next.push(draft);
    else next[index] = draft;
    save(next);
  });
  document.getElementById("cancelCategory").addEventListener("click", () => {
    if (dirty && !confirm("Bỏ các thay đổi chưa lưu?")) return;
    draft = null;
    dirty = false;
    render();
  });
  document.getElementById("reloadCategories").addEventListener("click", load);
  function renderArticleChoices() {
    const choices = document.getElementById("articleChoices");
    choices.replaceChildren();
    document.getElementById("selectedArticleCount").textContent = `Đã chọn ${selectedArticles.size} bài viết`;
    const query = document.getElementById("articleSearch").value.trim().toLocaleLowerCase("vi");
    const matches = articles.filter((article) => article.title.toLocaleLowerCase("vi").includes(query));
    if (!matches.length) choices.append(node("p", "intro", articles.length ? "Không có bài viết phù hợp." : "Chưa có bài viết. Hãy tạo bài ở mục Bài viết trước."));
    matches.forEach((article) => {
      const label = node("label", "category-product", "");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = selectedArticles.has(article.id);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) selectedArticles.add(article.id);
        else selectedArticles.delete(article.id);
        changed();
        document.getElementById("selectedArticleCount").textContent = `Đã chọn ${selectedArticles.size} bài viết`;
      });
      const image = document.createElement("img");
      image.className = "category-product-image";
      image.src = article.image;
      image.alt = "";
      image.loading = "lazy";
      const details = node("span", "", article.title);
      details.append(node("small", "", `${article.status === "published" ? "Đã đăng" : "Bản nháp"} · ${article.category}`));
      label.append(checkbox, image, details);
      choices.append(label);
    });
  }
  document.getElementById("articleSearch").addEventListener("input", renderArticleChoices);
  document.getElementById("retryLoad").addEventListener("click", () => {
    if (dirty && !confirm("Bỏ các thay đổi chưa lưu và tải lại?")) return;
    load();
  });
  window.addEventListener("storage", (event) => {
    if (![RiceArticles.storageKey, RiceArticles.categoriesKey, null].includes(event.key)) return;
    if (draft) { errorMessage(new Error("Dữ liệu đã thay đổi ở thẻ khác. Hủy chỉnh sửa và tải lại trước khi lưu.")); return; }
    load();
  });
  window.addEventListener("beforeunload", (event) => {
    if (dirty) { event.preventDefault(); event.returnValue = ""; }
  });
  load();
})();
