(function () {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const page = path.split("/").pop();
  const articlePath = /^\/bai-viet\/[^/]+$/.test(path);
  const allowedParams = {
    "gao.html": ["category"],
    "chi-tiet-gao.html": ["id"],
    "bai-viet-danh-sach.html": ["category"],
    "bai-viet.html": ["slug"]
  };
  const canonical = new URL(articlePath ? path : page === "index.html" || page === "/" ? "/" : `/${page}`, location.origin);
  for (const key of allowedParams[page] || []) {
    const value = new URL(location.href).searchParams.get(key);
    if (value) canonical.searchParams.set(key, value);
  }
  if (["chi-tiet-gao.html", "bai-viet.html"].includes(page) && !canonical.search) {
    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.append(robots);
    }
    robots.content = "noindex, nofollow";
  }
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.append(link);
  }
  link.href = canonical.href;
})();
