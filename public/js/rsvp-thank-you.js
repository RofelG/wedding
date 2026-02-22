document.addEventListener("DOMContentLoaded", function () {
  var toggle = document.getElementById("calendarMenuToggle");
  var menu = document.getElementById("calendarMenu");
  if (!toggle || !menu) return;

  function setOpen(isOpen) {
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    menu.hidden = !isOpen;
  }

  toggle.addEventListener("click", function () {
    var open = toggle.getAttribute("aria-expanded") === "true";
    setOpen(!open);
  });

  document.addEventListener("click", function (e) {
    if (!menu.hidden && !e.target.closest("#calendarMenuToggle") && !e.target.closest("#calendarMenu")) {
      setOpen(false);
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !menu.hidden) {
      setOpen(false);
      toggle.focus();
      return;
    }
  });
});
