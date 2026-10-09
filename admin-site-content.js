(function () {
  const form = document.getElementById("contentForm");
  const editor = document.getElementById("contentEditor");
  const status = document.getElementById("status");
  let content;
  let version = null;
  let dirty = false;
  let busy = false;
  function message(text, error = false) {
    status.textContent = text;
    status.classList.toggle("error", error);
  }
  function changed(value = true) {
    dirty = value;
    const indicator = document.getElementById("draftStatus");
    indicator.textContent = value ? "Có thay đổi chưa lưu" : "Đã đồng bộ với máy chủ";
    indicator.classList.toggle("is-dirty", value);
  }
  function showAdmin(value) {
    form.hidden = !value;
    document.getElementById("loginPanel").hidden = value;
  }
  function node(tag, className, text) {
    const el = document.createElement(tag);
    el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  async function action(callback) {
    if (busy) return;
    busy = true;
    const controls = Array.from(document.querySelectorAll("button,input,textarea"), control => ({ control, disabled: control.disabled }));
    controls.forEach(({ control }) => { control.disabled = true; });
    try { await callback(); }
    catch (error) {
      console.error("Không thể cập nhật giao diện:", error);
      message(error.message || "Không thể kết nối máy chủ.", true);
      if (error.status === 401) showAdmin(false);
    } finally {
      busy = false;
      controls.forEach(({ control, disabled }) => { control.disabled = disabled; });
    }
  }
  async function convertImage(file, logo) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
      throw new TypeError("Chọn ảnh PNG, JPEG hoặc WebP, dung lượng tối đa 8 MB.");
    }
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 24000000) throw new TypeError("Ảnh quá lớn. Chọn ảnh nhỏ hơn 24 megapixel.");
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, (logo ? 512 : 1400) / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Trình duyệt không hỗ trợ xử lý ảnh.");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/webp", .82);
      if (!RiceSiteContent.validImage(data)) throw new TypeError("Ảnh sau xử lý vẫn quá lớn. Chọn ảnh nhỏ hơn.");
      return data;
    } finally { URL.revokeObjectURL(url); }
  }
  function render() {
    editor.replaceChildren();
    RiceSiteContent.sections.forEach((section, index) => {
      const details = node("details", "content-section");
      details.open = index === 0;
      details.append(node("summary", "", `${String(index + 1).padStart(2, "0")} · ${section.title}`));
      const fields = node("div", "content-fields");
      for (const field of section.fields) {
        const label = node("label", field.type === "textarea" ? "content-wide" : "", field.label);
        const input = node(field.type === "textarea" ? "textarea" : "input", "");
        input.name = `${section.key}.${field.key}`;
        input.value = content[section.key][field.key];
        input.required = field.type !== "image";
        if (field.type !== "textarea") input.type = field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text";
        input.maxLength = field.type === "textarea" ? 2000 : ["image", "link"].includes(field.type) ? 1000 : 200;
        input.addEventListener("input", () => {
          content[section.key][field.key] = input.value;
          input.setCustomValidity("");
          changed();
        });
        label.append(input);
        if (field.type !== "image") { fields.append(label); continue; }
        input.placeholder = "Nhập URL ảnh hoặc chọn ảnh từ máy";
        if (input.value.startsWith("data:")) {
          input.value = "";
          input.placeholder = "Đang dùng ảnh đã tải từ máy";
        }
        const block = node("div", "image-field");
        const preview = node("img", "");
        preview.src = content[section.key][field.key];
        preview.alt = field.label;
        preview.addEventListener("error", () => message(`${field.label}: không tải được ảnh. Kiểm tra liên kết hoặc chọn ảnh khác.`, true));
        input.addEventListener("change", () => {
          if (!RiceSiteContent.validImage(input.value)) {
            input.setCustomValidity("Ảnh hoặc liên kết ảnh không hợp lệ.");
            message(`${field.label}: ảnh hoặc liên kết ảnh không hợp lệ.`, true);
            return;
          }
          preview.src = input.value;
        });
        const uploadLabel = node("label", "", "Chọn ảnh từ máy");
        const upload = node("input", "");
        upload.type = "file";
        upload.accept = "image/png,image/jpeg,image/webp";
        upload.addEventListener("change", () => {
          const file = upload.files[0];
          if (!file) return;
          action(async () => {
            const data = await convertImage(file, section.key === "brand");
            content[section.key][field.key] = data;
            input.value = "";
            input.placeholder = "Đang dùng ảnh đã tải từ máy";
            input.setCustomValidity("");
            preview.src = data;
            changed();
            message("Đã chọn ảnh. Bấm Lưu giao diện để áp dụng.");
          });
        });
        uploadLabel.append(upload);
        const controls = node("div", "image-controls");
        controls.append(uploadLabel, label, node("small", "", "PNG, JPEG, WebP tối đa 8 MB. Ảnh được thu gọn và lưu cùng nội dung trên máy chủ; hoặc nhập URL ảnh http/https."));
        block.append(preview, controls);
        fields.append(block);
      }
      details.append(fields);
      editor.append(details);
    });
  }
  async function load() {
    const data = await RiceOrders.request("/api/admin/site-content");
    content = RiceSiteContent.validate(data.content);
    version = data.version;
    render();
    changed(false);
  }
  form.addEventListener("invalid", event => { event.target.closest("details").open = true; }, true);
  form.addEventListener("submit", event => {
    event.preventDefault();
    action(async () => {
      const validated = RiceSiteContent.validate(content);
      const data = await RiceOrders.request("/api/admin/site-content", { method: "PUT", body: JSON.stringify({ content: validated, version }) });
      content = data.content;
      version = data.version;
      changed(false);
      message("Đã lưu giao diện lên máy chủ. Tải lại trang cửa hàng để xem thay đổi.");
    });
  });
  document.getElementById("reloadContent").addEventListener("click", () => {
    if (dirty && !confirm("Bỏ thay đổi chưa lưu và tải lại giao diện từ máy chủ?")) return;
    action(async () => { await load(); message("Đã tải lại giao diện."); });
  });
  document.getElementById("loginForm").addEventListener("submit", event => {
    event.preventDefault();
    action(async () => {
      await RiceOrders.post("/api/admin/login", { username: "Manh Trinh", password: event.target.elements.password.value });
      event.target.reset();
      if (version === null) await load();
      showAdmin(true);
      message("Đã đăng nhập quản trị.");
    });
  });
  window.addEventListener("beforeunload", event => {
    if (dirty || busy) { event.preventDefault(); event.returnValue = ""; }
  });
  action(async () => {
    await RiceOrders.request("/api/admin/session");
    await load();
    showAdmin(true);
  });
})();
