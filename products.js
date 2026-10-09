(function () {
  const storageKey = "thien-manh-rice-products-v1";
  const defaultProducts = [
    { id: "gao-jasmine", name: "Gạo Jasmine thơm", origin: "An Giang · Gạo thơm", price: 32000, tag: "Bán chạy", image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80", alt: "Hạt gạo trắng thơm Jasmine", description: "Gạo Jasmine thơm từ An Giang, hạt cơm mềm dẻo, thơm nhẹ, phù hợp cho những bữa cơm gia đình hằng ngày.", details: "Gạo Jasmine có hạt thon dài, màu trắng trong và hương thơm dịu nhẹ. Khi nấu, cơm mềm dẻo, vị ngọt tự nhiên, dễ kết hợp cùng nhiều món ăn trong bữa cơm Việt. Sản phẩm phù hợp dùng hằng ngày cho gia đình.", rating: 5, reviews: 28 },
    { id: "gao-st25", name: "Gạo ST25", origin: "Sóc Trăng · Gạo đặc sản", price: 42000, tag: "Đặc sản", image: "https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=800&q=80", alt: "Bát cơm gạo ST25 dẻo thơm", description: "Gạo ST25 đặc sản Sóc Trăng, được yêu thích nhờ hương thơm tự nhiên và độ dẻo thơm khi nấu chín.", details: "Gạo ST25 có hạt dài, khi nấu cho cơm mềm dẻo và tỏa hương thơm tự nhiên. Thưởng thức ngon nhất khi cơm vừa chín tới; có thể dùng kèm các món mặn, món kho hoặc rau củ trong bữa cơm gia đình.", rating: 5, reviews: 36 },
    { id: "gao-lut", name: "Gạo lứt đỏ", origin: "Long An · Gạo nguyên cám", price: 38000, tag: "Lành mạnh", image: "https://images.unsplash.com/photo-1596560548464-f010549b84d7?auto=format&fit=crop&w=800&q=80", alt: "Món cơm gạo lứt ăn kèm rau", description: "Gạo lứt đỏ nguyên cám từ Long An, giữ lớp cám bên ngoài và thích hợp cho thực đơn đa dạng của gia đình.", details: "Gạo lứt đỏ giữ lại lớp cám bên ngoài hạt gạo nên có kết cấu chắc và cần thời gian nấu lâu hơn gạo trắng. Nên vo nhẹ, ngâm trước khi nấu để hạt cơm mềm hơn. Sản phẩm phù hợp để thay đổi khẩu vị và kết hợp với rau củ, đậu hoặc các món ăn gia đình.", rating: 4, reviews: 19 },
    { id: "gao-nang-thom", name: "Nàng thơm Chợ Đào", origin: "Long An · Gạo thơm dẻo", price: 35000, tag: "Theo mùa", image: "https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=800&q=80", alt: "Bát cơm trắng thơm dẻo", description: "Nàng thơm Chợ Đào nổi bật với hạt cơm thơm dẻo, là lựa chọn đậm vị quê nhà cho mâm cơm gia đình.", details: "Nàng thơm Chợ Đào là dòng gạo thơm được nhiều gia đình lựa chọn. Hạt gạo khi nấu cho cơm dẻo mềm, hương thơm đặc trưng và vị ngọt nhẹ. Có thể điều chỉnh lượng nước theo khẩu vị để cơm đạt độ mềm mong muốn.", rating: 5, reviews: 14 }
  ];

  function isValidProduct(product) {
    if (!product || typeof product !== "object") return false;
    if (!["id", "name", "origin", "image"].every((key) => typeof product[key] === "string" && product[key].trim())) return false;
    if (!Number.isSafeInteger(product.price) || product.price < 1) return false;
    if (product.stock !== undefined && product.stock !== null && (!Number.isSafeInteger(product.stock) || product.stock < 0)) return false;
    if (product.tag !== undefined && typeof product.tag !== "string") return false;
    if (product.alt !== undefined && typeof product.alt !== "string") return false;
    if (product.description !== undefined && (typeof product.description !== "string" || product.description.length > 12000)) return false;
    if (product.details !== undefined && (typeof product.details !== "string" || product.details.length > 30000)) return false;
    if (product.gallery !== undefined && (!Array.isArray(product.gallery) || product.gallery.length > 4 || !product.gallery.every((image) => typeof image === "string" && image.trim() && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(image)))) return false;
    if (product.rating !== undefined && (!Number.isInteger(product.rating) || product.rating < 1 || product.rating > 5)) return false;
    if (product.reviews !== undefined && (!Number.isSafeInteger(product.reviews) || product.reviews < 0)) return false;
    if (/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(product.image)) return true;
    try {
      return ["http:", "https:"].includes(new URL(product.image).protocol);
    } catch {
      return false;
    }
  }

  function getProducts() {
    const customerPage = typeof location !== "undefined" && !location.pathname.split("/").pop().startsWith("admin");
    const savedProducts = (customerPage ? localStorage.getItem(`${storageKey}-server`) : null) ?? localStorage.getItem(storageKey);
    if (savedProducts === null) {
      localStorage.setItem(storageKey, JSON.stringify(defaultProducts));
      return defaultProducts.map((product) => ({ ...product }));
    }

    const products = JSON.parse(savedProducts);
    if (!Array.isArray(products) || !products.every(isValidProduct) || new Set(products.map((product) => product.id)).size !== products.length) {
      throw new TypeError("Dữ liệu sản phẩm đã lưu không hợp lệ.");
    }
    return products.map((product) => {
      const defaultProduct = defaultProducts.find((item) => item.id === product.id);
      return {
        ...product,
        description: typeof product.description === "string" ? product.description : (defaultProduct ? defaultProduct.description : ""),
        details: typeof product.details === "string" ? product.details : (defaultProduct ? defaultProduct.details : "")
      };
    });
  }

  function saveProducts(products) {
    if (!Array.isArray(products) || !products.every(isValidProduct) || new Set(products.map((product) => product.id)).size !== products.length) {
      throw new TypeError("Danh sách sản phẩm không hợp lệ.");
    }
    localStorage.setItem(storageKey, JSON.stringify(products));
  }

  function cacheServerProducts(products) {
    if (!Array.isArray(products) || !products.every(isValidProduct) || new Set(products.map((product) => product.id)).size !== products.length) {
      throw new TypeError("Dữ liệu sản phẩm máy chủ không hợp lệ.");
    }
    localStorage.setItem(`${storageKey}-server`, JSON.stringify(products));
  }

  function sanitizeRichText(value) {
    if (typeof value !== "string") throw new TypeError("Nội dung định dạng không hợp lệ.");
    const source = new DOMParser().parseFromString(value, "text/html").body;
    const output = document.createElement("div");
    const allowedTags = new Set(["p", "div", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "span", "h2", "h3", "blockquote"]);
    const discardedTags = new Set(["script", "style", "iframe", "object", "embed", "svg", "math", "template"]);
    const allowedFonts = new Set(["Arial", "Georgia", "Verdana", "Tahoma", "Trebuchet MS", "Times New Roman"]);

    function copyNode(node, parent) {
      if (node.nodeType === Node.TEXT_NODE) {
        parent.append(document.createTextNode(node.nodeValue || ""));
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE || node.namespaceURI !== "http://www.w3.org/1999/xhtml") return;
      const tag = node.tagName.toLowerCase();
      if (discardedTags.has(tag)) return;
      if (!allowedTags.has(tag)) {
        Array.from(node.childNodes).forEach((child) => copyNode(child, parent));
        return;
      }

      const safeElement = document.createElement(tag);
      const style = node.style;
      const color = style.color.trim();
      if (/^(#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla)\([0-9.% ,+-]+\)|[a-z]{3,20})$/i.test(color)) {
        safeElement.style.color = color;
      }
      const fontSize = style.fontSize.trim();
      if (/^\d{1,2}px$/.test(fontSize) && Number.parseInt(fontSize, 10) >= 10 && Number.parseInt(fontSize, 10) <= 48) {
        safeElement.style.fontSize = fontSize;
      }
      const fontFamily = style.fontFamily.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
      if (allowedFonts.has(fontFamily)) safeElement.style.fontFamily = fontFamily;
      if (["left", "center", "right", "justify"].includes(style.textAlign)) safeElement.style.textAlign = style.textAlign;
      if (!safeElement.getAttribute("style")) safeElement.removeAttribute("style");

      parent.append(safeElement);
      Array.from(node.childNodes).forEach((child) => copyNode(child, safeElement));
    }

    Array.from(source.childNodes).forEach((child) => copyNode(child, output));
    return output.innerHTML;
  }

  function getStockLabel(product) {
    return product.stock === undefined || product.stock === null
      ? "Tồn kho chưa thiết lập"
      : product.stock === 0 ? "Hết hàng" : `Còn ${product.stock.toLocaleString("vi-VN")} kg`;
  }

  function getAvailabilityLabel(product) {
    return product.stock === 0 ? "Hết hàng" : "Còn hàng";
  }

  window.RiceCatalog = { storageKey, getProducts, saveProducts, cacheServerProducts, sanitizeRichText, getStockLabel, getAvailabilityLabel };
})();
