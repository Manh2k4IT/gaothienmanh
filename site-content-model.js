(function () {
  const links = typeof module !== "undefined" && module.exports ? require("./menu-model") : window.RiceMenu;
  const field = (key, label, value, type = "text") => ({ key, label, value, type });
  const landscape = "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1600&q=85";
  const sections = [
    { key: "brand", title: "Logo & thương hiệu", fields: [
      field("logo", "Logo cửa hàng", "logo.png", "image"),
      field("name", "Tên cửa hàng", "Gạo Thiên Mạnh"),
      field("tagline", "Dòng chữ dưới tên", "Gạo ngon · Cơm lành"),
      field("announcement", "Dòng thông báo đầu trang", "GẠO MỚI MỖI NGÀY · GIAO HÀNG TẬN NHÀ")
    ] },
    { key: "header", title: "Liên hệ đầu trang", fields: [
      field("phone", "Số điện thoại Hotline đầu trang", "0901 234 567", "phone"),
      field("topPhoneLabel", "Chữ trước số điện thoại ở thanh trên", "Hotline"),
      field("introLabel", "Tên mục Giới thiệu", "Giới thiệu"),
      field("introHref", "Liên kết mục Giới thiệu", "index.html#cau-chuyen", "link"),
      field("emailLabel", "Chữ nút Email trên thanh menu", "EMAIL"),
      field("email", "Địa chỉ email đầu trang", "hello@nhamua.vn", "email"),
      field("navPhoneLabel", "Chữ trước số điện thoại trên thanh menu", "HOTLINE")
    ] },
    { key: "hero", title: "Banner đầu trang", fields: [
      field("image", "Ảnh nền banner", landscape, "image"),
      field("eyebrow", "Dòng chữ nhỏ", "Từ ruộng lành đến mâm cơm"),
      field("title", "Tiêu đề dòng đầu", "Hạt gạo quê,"),
      field("accent", "Tiêu đề nổi bật", "vị ngon lành."),
      field("description", "Nội dung giới thiệu", "Chọn gạo ngon từ những mùa vàng trù phú của Việt Nam. Thơm tự nhiên, dẻo vừa đủ — để bữa cơm nhà luôn là điều mình mong chờ.", "textarea"),
      field("button", "Tên nút", "Đặt gạo ngon tại nhà"),
      field("href", "Liên kết nút", "gao.html", "link"),
      field("note", "Dòng cam kết", "Canh tác tử tế · Tuyển chọn kỹ càng · Giao tận nhà")
    ] },
    { key: "benefits", title: "4 cam kết cửa hàng", fields: [
      ...[
        ["Gạo mới mỗi mùa", "Rang xay, đóng gói định kỳ"],
        ["Rõ nguồn gốc", "Từ vùng trồng tuyển chọn"],
        ["Giao hàng tận nhà", "Đóng gói sạch, giao nhanh"],
        ["Đổi trả dễ dàng", "An tâm chọn gạo hợp vị"]
      ].flatMap(([title, description], i) => [
        field(`title${i}`, `Ô ${i + 1} · Tiêu đề`, title),
        field(`description${i}`, `Ô ${i + 1} · Mô tả`, description)
      ])
    ] },
    { key: "story", title: "Câu chuyện cửa hàng", fields: [
      field("image", "Ảnh câu chuyện", landscape, "image"),
      field("imageAlt", "Mô tả ảnh", "Cánh đồng dưới nắng"),
      field("eyebrow", "Dòng chữ nhỏ", "Chuyện từ những mùa vàng"),
      field("title", "Tiêu đề (có thể xuống dòng)", "Gạo ngon bắt đầu\ntừ ruộng lành.", "textarea"),
      field("description", "Nội dung", "Gạo Thiên Mạnh kết nối với những người nông dân trồng lúa bằng sự chăm chút và hiểu biết. Từng mùa gặt được tuyển chọn kỹ, để hạt gạo đến tay bạn vẫn giữ được hương thơm và vị ngọt tự nhiên.", "textarea"),
      field("button", "Tên nút", "Tìm hiểu câu chuyện"),
      field("href", "Liên kết nút", "index.html#lien-he", "link")
    ] },
    { key: "newsletter", title: "Khối đăng ký liên hệ", fields: [
      field("image", "Ảnh gia đình", "family-meal.jpg", "image"),
      field("imageAlt", "Mô tả ảnh", "Gia đình nhiều thế hệ vui vẻ quây quần bên bàn ăn"),
      field("eyebrow", "Dòng chữ nhỏ", "Kết nối với Gạo Thiên Mạnh"),
      field("title", "Tiêu đề", "Tin mới cho bữa cơm nhà"),
      field("description", "Nội dung", "Nhận gợi ý món ngon, chuyện về gạo và ưu đãi mới qua Zalo.", "textarea"),
      field("button", "Tên nút", "Đăng ký")
    ] },
    { key: "footer", title: "Chân trang & thông tin liên hệ", fields: [
      field("description", "Giới thiệu dưới logo", "Gạo ngon tuyển chọn từ những mùa vàng Việt Nam. Gửi đến nhà bạn hạt gạo lành, thơm vị quê hương.", "textarea"),
      field("contactTitle", "Tiêu đề liên hệ", "Ghé thăm Gạo Thiên Mạnh"),
      field("phone", "Số điện thoại / Hotline", "0901 234 567", "phone"),
      field("email", "Email liên hệ", "hello@nhamua.vn", "email"),
      field("address", "Địa chỉ", "Quận 3, TP. Hồ Chí Minh"),
      field("hours", "Giờ làm việc", "Thứ 2 – Thứ 7 · 8:00 – 18:00"),
      field("copyright", "Dòng bản quyền", "© 2025 Gạo Thiên Mạnh. Gạo ngon, cơm lành."),
      field("slogan", "Dòng chữ cuối trang", "Chăm chút từ hạt gạo, thương nhau từ bữa cơm.")
    ] },
    { key: "explore", title: "Liên kết chân trang · Khám phá", fields: [
      field("title", "Tên nhóm", "Khám phá"),
      ...[["Gạo ngon", "gao.html"], ["Về chúng tôi", "index.html#cau-chuyen"], ["Bài viết", "bai-viet-danh-sach.html"], ["Chính sách đổi trả", "index.html#cam-nang"]]
        .flatMap(([label, href], i) => [field(`label${i}`, `Tên liên kết ${i + 1}`, label), field(`href${i}`, `Địa chỉ liên kết ${i + 1}`, href, "link")])
    ] },
    { key: "support", title: "Liên kết chân trang · Hỗ trợ", fields: [
      field("title", "Tên nhóm", "Hỗ trợ"),
      ...[["Hướng dẫn mua hàng", "index.html#lien-he"], ["Vận chuyển & giao hàng", "index.html#lien-he"], ["Câu hỏi thường gặp", "index.html#lien-he"], ["Liên hệ với Gạo Thiên Mạnh", "mailto:hello@nhamua.vn"], ["Quản lý sản phẩm", "admin.html"], ["Quản lý bài viết", "admin-blog.html"]]
        .flatMap(([label, href], i) => [field(`label${i}`, `Tên liên kết ${i + 1}`, label), field(`href${i}`, `Địa chỉ liên kết ${i + 1}`, href, "link")])
    ] }
  ];
  function defaults() {
    return Object.fromEntries(sections.map(section => [section.key, Object.fromEntries(section.fields.map(f => [f.key, f.value]))]));
  }
  function migrate(content) {
    let result = content;
    const initial = defaults();
    if (result.header === undefined) result = { ...result, header: { ...initial.header, phone: content.footer.phone, email: content.footer.email } };
    if (result.benefits === undefined) result = { ...result, benefits: initial.benefits };
    return result;
  }
  function validImage(value) {
    if (typeof value !== "string") return false;
    if (value.startsWith("data:")) {
      if (value.length > 1400000) return false;
      const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
      if (!match || match[2].length % 4) return false;
      const bytes = typeof Buffer !== "undefined" ? Buffer.from(match[2], "base64").toString("latin1") : atob(match[2]);
      return match[1] === "png" ? bytes.startsWith("\x89PNG\r\n\x1a\n") :
        match[1] === "jpeg" ? bytes.startsWith("\xff\xd8\xff") :
          bytes.startsWith("RIFF") && bytes.slice(8, 12) === "WEBP";
    }
    return value.length <= 1000 && ( /^https?:\/\//i.test(value) ? links.validLink(value) : /^[a-zA-Z0-9_-]+\.(?:png|jpg|jpeg)$/.test(value));
  }
  function validate(content) {
    if (!content || typeof content !== "object" || Array.isArray(content)) throw new TypeError("Nội dung giao diện không hợp lệ.");
    const result = {};
    for (const section of sections) {
      result[section.key] = {};
      for (const f of section.fields) {
        const value = content[section.key]?.[f.key];
        const max = f.type === "textarea" ? 2000 : f.type === "link" ? 1000 : 200;
        if (f.type === "image") {
          if (!validImage(value)) throw new TypeError(`${f.label}: chọn ảnh PNG, JPEG, WebP (tối đa 1 MB) hoặc liên kết ảnh hợp lệ.`);
        } else {
          if (typeof value !== "string" || !value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
            throw new TypeError(`${f.label}: nhập nội dung từ 1 đến ${max} ký tự.`);
          }
          if (f.type === "link" && !links.validLink(value)) throw new TypeError(`${f.label}: liên kết không hợp lệ.`);
          if (f.type === "email" && !/^[^\s@:<>()]+@[^\s@:<>()]+\.[^\s@:<>()]+$/.test(value)) throw new TypeError("Email liên hệ không hợp lệ.");
          if (f.type === "phone" && !/^\+?[0-9][0-9 .()-]{6,18}[0-9]$/.test(value)) throw new TypeError("Số điện thoại liên hệ không hợp lệ.");
        }
        result[section.key][f.key] = value.trim();
      }
    }
    return result;
  }
  const api = { sections, defaults, migrate, validImage, validate };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else window.RiceSiteContent = api;
})();
