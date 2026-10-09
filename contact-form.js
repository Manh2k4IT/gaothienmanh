(function () {
  const form = document.getElementById("newsletterForm");
  const status = document.getElementById("newsletterStatus");
  let busy = false;
  let pending;
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy) return;
    const controls = Array.from(form.querySelectorAll("input,button"));
    try {
      const contact = RiceContacts.validate({
        name: form.elements.name.value,
        phone: form.elements.phone.value,
        email: form.elements.email.value
      });
      const snapshot = JSON.stringify(contact);
      if (!pending || pending.snapshot !== snapshot) pending = { snapshot, requestId: crypto.randomUUID() };
      busy = true;
      controls.forEach(el => { el.disabled = true; });
      status.style.color = "#647164";
      status.textContent = "Đang gửi đăng ký…";
      await RiceOrders.post("/api/contacts", { ...contact, requestId: pending.requestId });
      form.reset();
      pending = null;
      status.style.color = "#24543b";
      status.textContent = "Đã đăng ký thành công! Gạo Thiên Mạnh đã nhận thông tin để liên hệ với bạn.";
    } catch (error) {
      console.error("Không thể gửi đăng ký:", error);
      status.style.color = "#964a3d";
      status.textContent = error.message || "Không thể gửi đăng ký. Vui lòng thử lại.";
    } finally {
      busy = false;
      controls.forEach(el => { el.disabled = false; });
    }
  });
})();
