(function () {
  function validate(contact) {
    if (!contact || typeof contact !== "object") throw new TypeError("Vui lòng nhập thông tin đăng ký.");
    const name = typeof contact.name === "string" ? contact.name.trim() : "";
    const phone = typeof contact.phone === "string" ? contact.phone.trim().replace(/[\s.-]/g, "") : "";
    const email = typeof contact.email === "string" ? contact.email.trim() : "";
    if (!name || name.length > 100 || /[\u0000-\u001f\u007f]/.test(name)) throw new TypeError("Họ và tên cần từ 1 đến 100 ký tự.");
    if (!/^(?:0|\+84)[0-9]{8,10}$/.test(phone)) throw new TypeError("Nhập số điện thoại Việt Nam hợp lệ, bắt đầu bằng 0 hoặc +84.");
    if (email.length > 254 || (email && !/^[^\s@:<>()]+@[^\s@:<>()]+\.[^\s@:<>()]+$/.test(email))) throw new TypeError("Email không hợp lệ. Bạn có thể để trống ô email.");
    return { name, phone, email };
  }
  const api = { validate };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else window.RiceContacts = api;
})();
