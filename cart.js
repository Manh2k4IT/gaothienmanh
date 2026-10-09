(function () {
  const storageKey = "thien-manh-rice-cart-v1";

  function getCart() {
    const savedCart = localStorage.getItem(storageKey);
    if (savedCart === null) return [];
    const cart = JSON.parse(savedCart);
    if (!Array.isArray(cart) || !cart.every((item) =>
      item &&
      typeof item.id === "string" &&
      item.id.trim() &&
      Number.isSafeInteger(item.quantity) &&
      item.quantity >= 1 &&
      item.quantity <= 99
    )) {
      throw new TypeError("Dữ liệu giỏ hàng đã lưu không hợp lệ.");
    }
    return cart;
  }

  function saveCart(cart) {
    if (!Array.isArray(cart) || !cart.every((item) =>
      item &&
      typeof item.id === "string" &&
      item.id.trim() &&
      Number.isSafeInteger(item.quantity) &&
      item.quantity >= 1 &&
      item.quantity <= 99
    )) {
      throw new TypeError("Danh sách giỏ hàng không hợp lệ.");
    }
    localStorage.setItem(storageKey, JSON.stringify(cart));
    window.dispatchEvent(new CustomEvent("ricecartchange", { detail: { cart } }));
  }

  function addItem(productId, quantity = 1) {
    if (typeof productId !== "string" || !productId.trim()) throw new TypeError("Sản phẩm không hợp lệ.");
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) throw new RangeError("Số lượng phải từ 1 đến 99 kg.");
    const cart = getCart();
    const existing = cart.find((item) => item.id === productId);
    validateAvailability(productId, (existing ? existing.quantity : 0) + quantity);
    if (existing) {
      if (existing.quantity + quantity > 99) throw new RangeError("Mỗi sản phẩm chỉ có thể đặt tối đa 99 kg.");
      existing.quantity += quantity;
    } else {
      cart.push({ id: productId, quantity });
    }
    saveCart(cart);
    return cart;
  }

  function setQuantity(productId, quantity) {
    if (typeof productId !== "string" || !productId.trim() || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new RangeError("Số lượng phải từ 1 đến 99 kg.");
    }
    const cart = getCart();
    const item = cart.find((entry) => entry.id === productId);
    if (!item) throw new TypeError("Không tìm thấy sản phẩm trong giỏ hàng.");
    if (quantity >= item.quantity) validateAvailability(productId, quantity);
    item.quantity = quantity;
    saveCart(cart);
    return cart;
  }

  function removeItem(productId) {
    if (typeof productId !== "string" || !productId.trim()) throw new TypeError("Sản phẩm không hợp lệ.");
    const cart = getCart().filter((item) => item.id !== productId);
    saveCart(cart);
    return cart;
  }

  function clear() {
    saveCart([]);
  }

  function getItemCount() {
    return getCart().reduce((total, item) => total + item.quantity, 0);
  }

  function validateAvailability(productId, quantity, products = RiceCatalog.getProducts()) {
    const product = products.find((entry) => entry.id === productId);
    if (!product) throw new TypeError("Sản phẩm không còn trong cửa hàng. Hãy xóa khỏi giỏ.");
    if (product.stock === 0) throw new RangeError(`${product.name} đã hết hàng.`);
    if (product.stock !== undefined && product.stock !== null && quantity > product.stock) {
      throw new RangeError(`Số lượng ${product.name} vượt quá tồn kho. Hãy giảm số lượng trong giỏ.`);
    }
  }

  window.RiceCart = { storageKey, getCart, addItem, setQuantity, removeItem, clear, getItemCount, validateAvailability };
})();
