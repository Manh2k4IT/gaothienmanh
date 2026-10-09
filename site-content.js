(function () {
  function text(selector, value) {
    document.querySelectorAll(selector).forEach(el => { el.textContent = value; });
  }
  function button(selector, label, href) {
    document.querySelectorAll(selector).forEach(el => {
      el.replaceChildren(document.createTextNode(label + " "));
      const arrow = document.createElement("span");
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "→";
      el.append(arrow);
      if (href) el.href = href;
    });
  }
  function background(selector, image) {
    document.querySelectorAll(selector).forEach(el => { el.style.backgroundImage = `url(${JSON.stringify(image)})`; });
  }
  function apply(c) {
    document.querySelectorAll(".brand img, .shop-brand img, .store-footer-logo").forEach(el => { el.src = c.brand.logo; el.alt = c.brand.name; });
    text(".brand strong, .shop-brand strong, .store-footer strong", c.brand.name);
    text(".brand small, .shop-brand small", c.brand.tagline);
    document.querySelectorAll(".brand, .shop-brand").forEach(el => { el.setAttribute("aria-label", c.brand.name + " - Trang chủ"); });
    text(".utility-inner > span", c.brand.announcement);
    document.querySelectorAll(".utility-links > span").forEach(el => {
      const number = document.createElement("strong");
      number.textContent = c.header.phone;
      el.replaceChildren(document.createTextNode(c.header.topPhoneLabel + ": "), number);
    });
    document.querySelectorAll(".utility-links > a").forEach(el => {
      el.textContent = c.header.introLabel;
      el.href = c.header.introHref;
    });
    document.querySelectorAll(".nav-contact").forEach(el => {
      function contactLink(icon, label, href) {
        const link = document.createElement("a");
        const symbol = document.createElement("span");
        symbol.setAttribute("aria-hidden", "true");
        symbol.textContent = icon;
        link.href = href;
        link.append(symbol, document.createTextNode(" " + label));
        return link;
      }
      el.replaceChildren(
        contactLink("✉", c.header.emailLabel, `mailto:${c.header.email}`),
        contactLink("☎", `${c.header.navPhoneLabel}: ${c.header.phone}`, `tel:${c.header.phone.replace(/[^\d+]/g, "")}`)
      );
    });
    background(".hero", c.hero.image);
    text(".hero-copy .eyebrow", c.hero.eyebrow);
    const heading = document.querySelector(".hero h1");
    if (heading) {
      const accent = document.createElement("em");
      accent.textContent = c.hero.accent;
      heading.replaceChildren(document.createTextNode(c.hero.title), document.createElement("br"), accent);
    }
    text(".hero-copy > p", c.hero.description);
    button(".hero-cta", c.hero.button, c.hero.href);
    text(".hero-note > span:last-child", c.hero.note);
    document.querySelectorAll(".benefit-row .benefit").forEach((el, index) => {
      const title = el.querySelector("strong");
      const description = el.querySelector("small");
      if (title) title.textContent = c.benefits[`title${index}`];
      if (description) description.textContent = c.benefits[`description${index}`];
    });
    background(".story-image", c.story.image);
    document.querySelectorAll(".story-image").forEach(el => { el.setAttribute("aria-label", c.story.imageAlt); });
    text(".story-copy .eyebrow", c.story.eyebrow);
    text(".story-copy h2", c.story.title);
    document.querySelectorAll(".story-copy h2").forEach(el => { el.style.whiteSpace = "pre-line"; });
    text(".story-copy > p", c.story.description);
    button(".story-copy .button", c.story.button, c.story.href);
    text(".newsletter .section-label", c.newsletter.eyebrow);
    text("#newsletterHeading", c.newsletter.title);
    text(".newsletter-copy p", c.newsletter.description);
    button("#newsletterForm button", c.newsletter.button);
    document.querySelectorAll(".newsletter-family-image").forEach(el => { el.src = c.newsletter.image; el.alt = c.newsletter.imageAlt; });
    text(".footer-about p", c.footer.description);
    text(".footer-contact h4", c.footer.contactTitle);
    document.querySelectorAll(".footer-contact").forEach(el => {
      const heading = el.querySelector("h4");
      if (!heading) return;
      const phone = document.createElement("a");
      phone.href = `tel:${c.footer.phone.replace(/[^\d+]/g, "")}`;
      phone.textContent = "☎ " + c.footer.phone;
      const email = document.createElement("a");
      email.href = `mailto:${c.footer.email}`;
      email.textContent = "✉ " + c.footer.email;
      const address = document.createElement("span");
      address.textContent = "⌖ " + c.footer.address;
      const hours = document.createElement("span");
      hours.textContent = c.footer.hours;
      el.replaceChildren(heading, phone, email, address, hours);
    });
    document.querySelectorAll(".footer-grid > div").forEach(el => {
      const list = el.querySelector(".footer-links");
      if (!list) return;
      const group = el === document.querySelector(".footer-grid > div:nth-child(2)") ? c.explore : c.support;
      const heading = el.querySelector("h4");
      if (heading) heading.textContent = group.title;
      list.replaceChildren();
      for (let i = 0; group[`label${i}`] !== undefined; i++) {
        const link = document.createElement("a");
        link.textContent = group[`label${i}`];
        link.href = group[`href${i}`];
        list.append(link);
      }
    });
    text(".copyright > span:first-child", c.footer.copyright);
    text(".copyright > span:last-child, .store-footer p", c.footer.slogan);
    document.querySelectorAll('link[rel="icon"]').forEach(el => { el.href = c.brand.logo; });
  }
  async function load() {
    if (location.protocol === "file:") return;
    try {
      const response = await fetch("/api/site-content", { cache: "no-store" });
      if (!response.ok) throw new Error("Không thể tải nội dung giao diện.");
      const data = await response.json();
      apply(RiceSiteContent.validate(data.content));
    } catch (error) {
      console.error("Không thể tải giao diện cửa hàng:", error);
      const message = document.createElement("p");
      message.setAttribute("role", "status");
      message.style.cssText = "margin:0;padding:12px 20px;background:#fff0dd;color:#794822;font:13px/1.6 Arial,sans-serif;text-align:center";
      message.append(document.createTextNode("Chưa tải được nội dung cửa hàng mới nhất. "));
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "Thử lại";
      retry.addEventListener("click", () => { message.remove(); load(); });
      message.append(retry);
      document.body.prepend(message);
    }
  }
  load();
})();
