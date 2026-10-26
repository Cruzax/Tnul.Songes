// Menu du site, le même sur toutes les pages: pour ajouter une page, il suffit de l'ajouter dans GROUPS.
// Ce script est chargé dans l'en-tête juste après <nav class="site-nav">, sans defer, pour que le menu
// soit en place dès le premier affichage.
(function () {
  const GROUPS = [
    {
      title: "Songes infinis",
      links: [
        { href: "./", label: "Boss", hint: "Fiches, stats et simulateur" },
        { href: "salles.html", label: "Salles", hint: "Positions de départ" },
      ],
    },
    {
      title: "Combats tactiques",
      dropdown: true,
      links: [
        { href: "tactiques.html", label: "Tous les combats", hint: "Vue d'ensemble et fiches" },
        { href: "ambre.html", label: "Ocre d'ambre", hint: "Memory des Malters" },
        { href: "minogolem.html", label: "Dofus Pourpre", hint: "Labyrinthe du Minogolem" },
        { href: "bolgrot.html", label: "Dofus Turquoise", hint: "Esprit de Bolgrot" },
        { href: "rainikrone.html", label: "Dofus Ivoire", hint: "Glyphes de la Rainikrone" },
      ],
    },
    {
      title: "Outils",
      links: [
        { href: "classes.html", label: "Classes", hint: "Fiches mémo des 19 classes" },
        { href: "palette/", label: "Palette", hint: "Couleurs de skins (Skinoskope)" },
      ],
    },
  ];

  const page = location.pathname.split("/").pop() || "index.html";
  const isCurrent = (link) => (link.href === "./" ? "index.html" : link.href) === page;
  const current = (link) => (isCurrent(link) ? ' aria-current="page"' : "");
  const panelLink = (link) => `<a href="${link.href}"${current(link)}><span>${link.label}</span><small>${link.hint}</small></a>`;

  // Ordinateur: liens à plat, sauf les groupes en menu déroulant
  const desktop = GROUPS.map((group) => {
    if (!group.dropdown) {
      return group.links.map((link) => `<a class="nav-link" href="${link.href}"${current(link)}>${link.label}</a>`).join("");
    }
    const active = group.links.some(isCurrent) ? " is-current" : "";
    return `<details class="nav-menu"><summary class="nav-link${active}">${group.title}</summary>`
      + `<div class="nav-menu-panel">${group.links.map(panelLink).join("")}</div></details>`;
  }).join("");

  // Mobile: un seul bouton « Menu » qui ouvre toutes les pages, rangées par groupe
  const burger = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>';
  const mobile = `<details class="nav-menu nav-mobile"><summary class="nav-link">${burger}Menu</summary><div class="nav-menu-panel">`
    + GROUPS.map((group) => `<section><p class="card-label">${group.title}</p>${group.links.map(panelLink).join("")}</section>`).join("")
    + "</div></details>";

  document.querySelector(".site-nav").innerHTML = `<div class="nav-desktop">${desktop}</div>${mobile}`;

  // Les menus se referment au clic à l'extérieur ou avec Échap
  const menus = () => document.querySelectorAll("details.nav-menu");
  document.addEventListener("click", (event) => {
    menus().forEach((menu) => {
      if (!menu.contains(event.target)) menu.removeAttribute("open");
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    menus().forEach((menu) => {
      if (!menu.open) return;
      menu.removeAttribute("open");
      if (menu.contains(document.activeElement)) menu.querySelector("summary").focus();
    });
  });
})();
