document.addEventListener("DOMContentLoaded", function () {
  var cfg = window.SITE_CONFIG || {};
  var base = cfg.logoBase || "";
  var type = cfg.logoType || "";
  var single = cfg.logoUrl || "";

  function resolveLogo() {
    if (base && type) {
      var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      var suffix = prefersDark ? "-dark" : "-light";
      return base + suffix + "." + type;
    }
    return single;
  }

  var logoSrc = resolveLogo();
  if (!logoSrc) return;

  var brands = document.querySelectorAll(".navbar-brand");
  brands.forEach(function (brand) {
    if (brand.querySelector("img.brand-logo")) return;
    brand.classList.add("brand-with-logo");
    brand.innerHTML = "";
    var img = document.createElement("img");
    img.src = logoSrc;
    img.alt = "Logo";
    img.className = "brand-logo";
    brand.insertBefore(img, brand.firstChild);
  });

  var heroNames = document.querySelectorAll(".hero-names");

  heroNames.forEach(function (hero) {
    if (hero.querySelector("img.brand-logo")) return;
    var img = document.createElement("img");
    img.src = logoSrc;
    img.alt = "Logo";
    img.className = "brand-logo hero-logo";
    img.style.height = "250px";
    hero.insertBefore(img, hero.firstChild);
  });

  if (base && type && window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", function () {
      var updated = resolveLogo();
      document.querySelectorAll("img.brand-logo").forEach(function (img) {
        img.src = updated;
      });
    });
  }
});
