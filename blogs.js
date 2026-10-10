(function () {
  const storageKey = "thien-manh-rice-articles-v1";
  const categoriesKey = "thien-manh-rice-article-categories-v1";
  const defaultArticles = [
    {
      id: "bi-quyet-nau-com-deo-thom",
      title: "Bí quyết nấu cơm dẻo thơm, hạt nào ra hạt nấy",
      category: "Bếp nhà",
      summary: "Chỉ vài thay đổi nhỏ trong cách vo gạo và canh nước là nồi cơm nhà mình thơm ngon hơn hẳn.",
      content: "Vo gạo nhẹ tay từ hai đến ba lần để làm sạch bụi cám mà không làm mất đi quá nhiều dưỡng chất ở lớp ngoài hạt gạo.\n\nLượng nước phụ thuộc vào giống gạo và độ mới của gạo. Hãy bắt đầu với tỉ lệ nước theo hướng dẫn trên bao bì, sau đó điều chỉnh một chút theo khẩu vị của gia đình.\n\nKhi cơm vừa chín, đừng mở nắp ngay. Để cơm nghỉ khoảng mười phút rồi xới nhẹ từ dưới lên, hạt cơm sẽ tơi và giữ được độ dẻo thơm.",
      image: "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80",
      alt: "Bữa cơm nhà ấm cúng",
      seoTitle: "Bí quyết nấu cơm dẻo thơm, tơi ngon tại nhà",
      seoDescription: "Mẹo vo gạo, canh lượng nước và ủ cơm để nấu được nồi cơm dẻo thơm, hạt tơi ngon cho bữa cơm gia đình.",
      status: "published",
      createdAt: "2026-10-08T00:00:00.000Z",
      updatedAt: "2026-10-08T00:00:00.000Z"
    },
    {
      id: "chon-gao-st25-jasmine-gao-lut",
      title: "Gạo ST25, Jasmine hay gạo lứt: chọn sao cho đúng?",
      category: "Chọn gạo",
      summary: "Tìm hiểu đặc điểm từng loại để chọn hạt gạo vừa khẩu vị, vừa hợp với bữa ăn của gia đình.",
      content: "Mỗi loại gạo có hương thơm, độ dẻo và cách dùng riêng. Chọn đúng loại gạo sẽ giúp món ăn hằng ngày ngon miệng hơn.\n\nGạo ST25 thường có hạt dài, cơm thơm và dẻo mềm. Gạo Jasmine có hương thơm dịu, vị ngọt nhẹ, dễ kết hợp với nhiều món ăn quen thuộc.\n\nGạo lứt giữ lại lớp cám bên ngoài nên có kết cấu chắc và vị bùi hơn. Khi nấu, nên ngâm gạo trước để hạt mềm và chín đều. Hãy thử một lượng nhỏ trước để tìm ra loại phù hợp nhất với khẩu vị nhà mình.",
      image: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=900&q=80",
      alt: "Nguyên liệu tươi ngon cho bữa ăn đủ chất",
      seoTitle: "So sánh gạo ST25, Jasmine và gạo lứt",
      seoDescription: "So sánh hương thơm, độ dẻo và cách nấu gạo ST25, Jasmine, gạo lứt để chọn đúng loại gạo cho gia đình.",
      status: "published",
      createdAt: "2026-10-08T00:00:00.000Z",
      updatedAt: "2026-10-08T00:00:00.000Z"
    },
    {
      id: "hanh-trinh-tu-hat-lua-den-hat-gao",
      title: "Từ hạt lúa đến hạt gạo: hành trình của một mùa vàng",
      category: "Chuyện mùa vàng",
      summary: "Một hạt gạo ngon là kết tinh của nắng, đất và bao ngày chăm chút của người nông dân.",
      content: "Một mùa lúa bắt đầu từ lúc người nông dân chọn giống và chuẩn bị đất. Từng thửa ruộng được chăm sóc qua những ngày nắng, những cơn mưa và cả những lần thăm đồng sớm hôm.\n\nKhi bông lúa chín vàng, thời điểm thu hoạch được lựa chọn cẩn thận để giữ chất lượng hạt. Lúa sau đó được phơi, xay xát và tuyển chọn trước khi trở thành gạo dùng trong bữa ăn hằng ngày.\n\nĐằng sau mỗi hạt gạo là công sức của người trồng lúa và sự trù phú của từng vùng đất Việt Nam.",
      image: "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=900&q=80",
      alt: "Ánh nắng ban mai trên cánh đồng",
      seoTitle: "Hành trình từ hạt lúa đến hạt gạo Việt Nam",
      seoDescription: "Khám phá các công đoạn trồng lúa, thu hoạch và tuyển chọn để tạo nên hạt gạo thơm ngon từ những mùa vàng Việt Nam.",
      status: "published",
      createdAt: "2026-10-08T00:00:00.000Z",
      updatedAt: "2026-10-08T00:00:00.000Z"
    }
  ];

  const allowedContentTags = new Set(["A", "B", "BLOCKQUOTE", "BR", "DIV", "EM", "FIGURE", "FIGCAPTION", "H2", "H3", "I", "IMG", "LI", "OL", "P", "SPAN", "STRONG", "U", "UL"]);
  const discardedContentTags = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "TEMPLATE", "TITLE", "META", "LINK"]);
  const allowedFontSizes = new Set(["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px"]);

  function safeTextColor(value) {
    if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
    const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(value);
    if (!rgb) return "";
    const channels = rgb.slice(1).map(Number);
    if (channels.some((channel) => channel > 255)) return "";
    return `rgb(${channels.join(", ")})`;
  }

  function safeContentUrl(value, allowDataImage) {
    if (!value || /[\u0000-\u001f\u007f]/.test(value) || value.trim() !== value) return "";
    if (allowDataImage && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(value)) return value;
    if (value.startsWith("//")) return "";
    try {
      const url = new URL(value, location.href);
      if (!["http:", "https:"].includes(url.protocol) || (url.origin !== location.origin && !/^https?:\/\//i.test(value))) return "";
      return value;
    } catch {
      return "";
    }
  }

  function sanitizeContent(html) {
    const parsed = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");

    function cleanNode(source) {
      if (source.nodeType === Node.TEXT_NODE) return document.createTextNode(source.nodeValue);
      if (source.nodeType !== Node.ELEMENT_NODE) return null;
      if (discardedContentTags.has(source.tagName)) return null;
      if (!allowedContentTags.has(source.tagName)) {
        const fragment = document.createDocumentFragment();
        source.childNodes.forEach((child) => {
          const cleaned = cleanNode(child);
          if (cleaned) fragment.append(cleaned);
        });
        return fragment;
      }

      const element = document.createElement(source.tagName.toLowerCase());
      if (source.tagName === "A") {
        const href = safeContentUrl(source.getAttribute("href"), false);
        if (href) {
          element.setAttribute("href", href);
          if (new URL(href, location.href).origin !== location.origin) {
            element.setAttribute("target", "_blank");
            element.setAttribute("rel", "noopener noreferrer");
          }
        }
      } else if (source.tagName === "IMG") {
        const src = safeContentUrl(source.getAttribute("src"), true);
        if (!src) return null;
        element.setAttribute("src", src);
        element.setAttribute("alt", (source.getAttribute("alt") || "").slice(0, 200));
        element.setAttribute("loading", "lazy");
        return element;
      } else if (source.tagName === "SPAN") {
        const size = source.style.fontSize;
        if (allowedFontSizes.has(size)) element.style.fontSize = size;
      }
      const color = safeTextColor(source.style.color);
      if (color) element.style.color = color;

      source.childNodes.forEach((child) => {
        const cleaned = cleanNode(child);
        if (cleaned) element.append(cleaned);
      });
      return element;
    }

    const fragment = document.createDocumentFragment();
    parsed.body.childNodes.forEach((child) => {
      const cleaned = cleanNode(child);
      if (cleaned) fragment.append(cleaned);
    });
    const container = document.createElement("div");
    container.append(fragment);
    return container.innerHTML;
  }

  function isValidArticle(article) {
    if (!article || typeof article !== "object") return false;
    const textFields = ["id", "title", "category", "summary", "content", "image", "seoTitle", "seoDescription"];
    if (!textFields.every((key) => typeof article[key] === "string" && article[key].trim())) return false;
    if (!["published", "draft"].includes(article.status)) return false;
    if (!["createdAt", "updatedAt"].every((key) => typeof article[key] === "string" && !Number.isNaN(Date.parse(article[key])))) return false;
    if (article.alt !== undefined && typeof article.alt !== "string") return false;
    if (article.coverCaption !== undefined && (typeof article.coverCaption !== "string" || article.coverCaption.length > 500)) return false;
    if (article.categoryId !== undefined && typeof article.categoryId !== "string") return false;
    if (/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(article.image)) return true;
    try {
      return ["http:", "https:"].includes(new URL(article.image).protocol);
    } catch {
      return false;
    }
  }

  function slugifyCategory(value) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80).replace(/-$/, "");
  }
  function validateCategories(categories) {
    if (!Array.isArray(categories) || categories.length > 100) throw new TypeError("Có thể tạo tối đa 100 danh mục bài viết.");
    const ids = new Set();
    const slugs = new Set();
    return categories.map((category) => {
      if (!category || typeof category.id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(category.id) || ids.has(category.id) ||
          typeof category.name !== "string" || !category.name.trim() || category.name.length > 60 || /[\u0000-\u001f\u007f]/.test(category.name) ||
          typeof category.slug !== "string" || category.slug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category.slug) || slugs.has(category.slug) ||
          (category.legacyName !== undefined && typeof category.legacyName !== "string")) {
        throw new TypeError("Danh mục cần tên (tối đa 60 ký tự), mã và đường dẫn duy nhất. Đường dẫn chỉ gồm chữ thường không dấu, số và dấu gạch ngang.");
      }
      ids.add(category.id);
      slugs.add(category.slug);
      return { id: category.id, name: category.name.trim(), slug: category.slug, ...(category.legacyName !== undefined ? { legacyName: category.legacyName } : {}) };
    });
  }
  function getCategories() {
    const saved = localStorage.getItem(categoriesKey);
    if (saved !== null) return validateCategories(JSON.parse(saved));
    const articles = getRawArticles();
    const names = [...new Set(articles.map((article) => article.category))];
    const slugs = new Set();
    const categories = names.map((name, index) => {
      const base = slugifyCategory(name) || `danh-muc-${index + 1}`;
      let slug = base;
      let suffix = 2;
      while (slugs.has(slug)) slug = `${base.slice(0, 74)}-${suffix++}`;
      slugs.add(slug);
      return { id: `legacy-${index + 1}`, name: name.slice(0, 60), slug, legacyName: name };
    });
    saveCategories(categories);
    return categories;
  }
  function saveCategories(categories) {
    localStorage.setItem(categoriesKey, JSON.stringify(validateCategories(categories)));
  }
  function categoryHref(category) { return `bai-viet-danh-sach.html?category=${encodeURIComponent(category.slug)}`; }
  function getRawArticles() {
    const savedArticles = localStorage.getItem(storageKey);
    if (savedArticles === null) {
      localStorage.setItem(storageKey, JSON.stringify(defaultArticles));
      return defaultArticles.map((article) => ({ ...article }));
    }

    const articles = JSON.parse(savedArticles);
    if (!Array.isArray(articles) || !articles.every(isValidArticle) || new Set(articles.map((article) => article.id)).size !== articles.length) {
      throw new TypeError("Dữ liệu bài viết đã lưu không hợp lệ.");
    }
    return articles;
  }
  function getArticles() {
    const articles = getRawArticles();
    const categories = getCategories();
    return articles.map((article) => {
      const category = article.categoryId !== undefined
        ? categories.find((item) => item.id === article.categoryId)
        : categories.find((item) => item.legacyName === article.category);
      return { ...article, categoryId: category?.id || "", category: category?.name || "Chưa phân loại" };
    });
  }

  function validateArticles(articles, categories) {
    if (!Array.isArray(articles) || !articles.every(isValidArticle) || new Set(articles.map((article) => article.id)).size !== articles.length) {
      throw new TypeError("Danh sách bài viết không hợp lệ.");
    }
    if (articles.some((article) => article.categoryId && !categories.some((category) => category.id === article.categoryId))) {
      throw new TypeError("Danh mục bài viết đã bị xóa. Hãy chọn lại danh mục trước khi lưu.");
    }
  }
  function saveArticles(articles) {
    validateArticles(articles, getCategories());
    localStorage.setItem(storageKey, JSON.stringify(articles));
  }
  function saveCategorySelection(categories, articles) {
    const nextCategories = validateCategories(categories);
    validateArticles(articles, nextCategories);
    const previousCategories = localStorage.getItem(categoriesKey);
    const previousArticles = localStorage.getItem(storageKey);
    try {
      localStorage.setItem(categoriesKey, JSON.stringify(nextCategories));
      localStorage.setItem(storageKey, JSON.stringify(articles));
    } catch (error) {
      try {
        if (previousCategories === null) localStorage.removeItem(categoriesKey);
        else localStorage.setItem(categoriesKey, previousCategories);
        if (previousArticles === null) localStorage.removeItem(storageKey);
        else localStorage.setItem(storageKey, previousArticles);
      } catch (rollbackError) {
        console.error("Không thể khôi phục dữ liệu bài viết sau lỗi lưu:", rollbackError);
        throw new Error("Lưu danh mục thất bại và không thể khôi phục dữ liệu cũ. Không đóng trang; hãy kiểm tra bộ nhớ trình duyệt.", { cause: error });
      }
      throw error;
    }
  }

  async function fetchBlog(admin = false) {
    const path = admin ? "/api/admin/blog" : "/api/blog";
    const data = window.RiceOrders
      ? await window.RiceOrders.request(path)
      : await fetch(path, { credentials: "same-origin" }).then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Không thể tải bài viết từ máy chủ.");
        return result;
      });
    if (!data || !Array.isArray(data.articles) || !Array.isArray(data.categories) || !Number.isSafeInteger(data.version)) {
      throw new TypeError("Dữ liệu bài viết nhận từ máy chủ không hợp lệ.");
    }
    return data;
  }

  async function saveBlog(categories, articles, version) {
    const data = await window.RiceOrders.request("/api/admin/blog", {
      method: "PUT",
      body: JSON.stringify({ categories, articles, version })
    });
    saveCategorySelection(data.categories, data.articles);
    return data;
  }

  window.RiceArticles = { storageKey, categoriesKey, getArticles, saveArticles, sanitizeContent, getCategories, saveCategories, validateCategories, validateArticles, safeTextColor, slugifyCategory, categoryHref, saveCategorySelection, fetchBlog, saveBlog };
})();
