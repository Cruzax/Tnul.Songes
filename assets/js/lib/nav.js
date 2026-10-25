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

// Bouton « Accueil » flottant sur toutes les pages sauf l'accueil, pour ne jamais rester coincé.
(function () {
  const path = location.pathname.replace(/\/+$/, "");
  if (path === "" || path.endsWith("/index.html") || document.querySelector(".home-fab")) return;
  const link = document.createElement("a");
  link.className = "home-fab";
  link.href = "./";
  link.textContent = "⌂ Accueil";
  link.setAttribute("aria-label", "Retour à l'accueil");
  document.body.appendChild(link);
})();
