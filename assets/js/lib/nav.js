// Menu du site, le même sur toutes les pages: pour ajouter une page, il suffit de l'ajouter dans GROUPS.
// Ce script est chargé dans l'en-tête juste après <nav class="site-nav">, sans defer, pour que le menu
// soit en place dès le premier affichage.
(function () {
  // icon: nom d'une icône de ICONS, ou gem: couleur du Dofus (pastille en losange)
  const GROUPS = [
    {
      title: "Songes infinis",
      links: [
        { href: "./", label: "Boss", hint: "Fiches, stats et simulateur", icon: "skull" },
        { href: "salles.html", label: "Salles", hint: "Positions de départ", icon: "grid" },
      ],
    },
    {
      title: "Combats tactiques",
      dropdown: true,
      all: { href: "tactiques.html", label: "Tous les combats", hint: "Vue d'ensemble et fiches de mécanique" },
      links: [
        { href: "ambre.html", label: "Ocre d'ambre", hint: "Memory des Malters", gem: "#e0a24a" },
        { href: "minogolem.html", label: "Dofus Pourpre", hint: "Labyrinthe du Minogolem", gem: "#b05ad6" },
        { href: "bolgrot.html", label: "Dofus Turquoise", hint: "Esprit de Bolgrot", gem: "#2fc4b2" },
        { href: "rainikrone.html", label: "Dofus Ivoire", hint: "Glyphes de la Rainikrone", gem: "#e9e2cf" },
        { href: "arakne.html", label: "Arakne de Leng", hint: "Les 2 combats en petite arakne", icon: "spider" },
      ],
    },
    {
      title: "Outils",
      links: [
        { href: "classes.html", label: "Classes", hint: "Fiches mémo des 19 classes", icon: "book" },
        { href: "palette/", label: "Palette", hint: "Couleurs de skins (Skinoskope)", icon: "palette" },
      ],
    },
  ];

  const svg = (paths) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const ICONS = {
    skull: svg('<path d="M12 3a8 8 0 0 0-5 14.2V20a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2.8A8 8 0 0 0 12 3z"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><path d="M10 21v-2M14 21v-2"/>'),
    grid: svg('<path d="M12 3 21 8.5 12 14 3 8.5z"/><path d="m3 12.5 9 5.5 9-5.5"/><path d="m3 16.5 9 5.5 9-5.5"/>'),
    spider: svg('<circle cx="12" cy="13" r="3.2"/><circle cx="12" cy="8" r="1.8"/><path d="M9 11 4 7M9 13H3M9.5 15.5 5 20M15 11l5-4M15 13h6M14.5 15.5 19 20"/>'),
    book: svg('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7M8 11h5"/>'),
    palette: svg('<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2 0-1.5-1-1.6-1-3 0-1 .8-2 2-2h2a4 4 0 0 0 4-4c0-4-4-7-9-7z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10.5" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/>'),
    list: svg('<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>'),
  };
  const gem = (color) => `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 2.5 20 9l-8 12.5L4 9z" fill="${color}" stroke="rgb(0 0 0 / 0.35)" stroke-width="1"/><path d="M4 9h16M12 2.5 9 9l3 12.5L15 9z" fill="none" stroke="rgb(255 255 255 / 0.45)" stroke-width="0.9"/></svg>`;

  const page = location.pathname.split("/").pop() || "index.html";
  const isCurrent = (link) => (link.href === "./" ? "index.html" : link.href) === page;
  const current = (link) => (isCurrent(link) ? ' aria-current="page"' : "");
  const badge = (link) => `<span class="nav-ico">${link.gem ? gem(link.gem) : ICONS[link.icon] || ""}</span>`;
  const tile = (link) => `<a class="nav-tile" href="${link.href}"${current(link)}>${badge(link)}<span class="nav-tile-text"><span>${link.label}</span><small>${link.hint}</small></span></a>`;
  const allLink = (group) => `<a class="nav-all" href="${group.all.href}"${current(group.all)}>${ICONS.list}<span>${group.all.label}</span><small>${group.all.hint}</small><span class="nav-all-arrow" aria-hidden="true">→</span></a>`;
  const groupLinks = (group) => (group.all ? [group.all, ...group.links] : group.links);

  // Ordinateur: liens à plat, sauf les groupes en menu déroulant (panneau en 2 colonnes)
  const desktop = GROUPS.map((group) => {
    if (!group.dropdown) {
      return group.links.map((link) => `<a class="nav-link" href="${link.href}"${current(link)}>${link.label}</a>`).join("");
    }
    const active = groupLinks(group).some(isCurrent) ? " is-current" : "";
    return `<details class="nav-menu"><summary class="nav-link${active}">${group.title}</summary>`
      + `<div class="nav-menu-panel nav-panel-wide"><p class="nav-panel-title">${group.title}</p>`
      + `<div class="nav-tiles">${group.links.map(tile).join("")}</div>${group.all ? allLink(group) : ""}</div></details>`;
  }).join("");

  // Mobile: un seul bouton « Menu » qui ouvre toutes les pages, rangées par groupe en tuiles
  const burger = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>';
  const mobile = `<details class="nav-menu nav-mobile"><summary class="nav-link">${burger}Menu</summary><div class="nav-menu-panel">`
    + GROUPS.map((group) => `<section><p class="nav-panel-title">${group.title}</p><div class="nav-tiles">${group.links.map(tile).join("")}</div>${group.all ? allLink(group) : ""}</section>`).join("")
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
