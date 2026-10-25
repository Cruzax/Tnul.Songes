// Menu « Combats tactiques »: se referme au clic à l'extérieur, avec Échap, ou quand on choisit un lien.
(function () {
  const menus = () => document.querySelectorAll("details.nav-menu");
  document.addEventListener("click", (event) => {
    menus().forEach((menu) => {
      if (!menu.contains(event.target)) menu.removeAttribute("open");
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") menus().forEach((menu) => menu.removeAttribute("open"));
  });
})();
