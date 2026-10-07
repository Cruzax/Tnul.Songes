// Icônes des caractéristiques (PV, PA, PM, portée, éléments). Script classique: expose window.TnulIcons
// pour la fiche (modules) comme pour le simulateur (script classique).
(function (root) {
  const svg = (body) =>
    `<svg class="ico" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false">${body}</svg>`;

  const ICONS = {
    hp: svg('<path fill="#ef4b5b" d="M12 21.5l-1.4-1.3C5.4 15.5 2 12.4 2 8.6 2 5.5 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.5 22 8.6c0 3.8-3.4 6.9-8.6 11.6L12 21.5z"/>'),
    pa: svg('<path fill="#4db2ff" d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.5l-5.9 3.2 1.2-6.6L2.5 9.5l6.6-.9z"/>'),
    pm: svg('<path fill="#46d39a" d="M12 2l8 10-8 10-8-10z"/>'),
    po: svg('<circle cx="12" cy="12" r="8" fill="none" stroke="#cbd5e1" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="#cbd5e1"/>'),
    strength: svg('<path fill="#b98350" d="M2 20l7-12 4 6.5 3-4.5 6 10z"/>'),
    intelligence: svg('<path fill="#ff7a3d" d="M12 2c1 3.4 5.5 5.5 5.5 10.2A5.5 5.5 0 0 1 6.5 12.5c0-2 .9-3.4 2-4.6.2 1.5.9 2.4 1.9 2.8C10 8 10.5 4.7 12 2z"/>'),
    chance: svg('<path fill="#3a9cff" d="M12 2.5c3.5 4.3 6 7.4 6 10.6A6 6 0 0 1 6 13.1C6 9.9 8.5 6.8 12 2.5z"/>'),
    agility: svg('<path fill="#6bd68a" d="M20 4C9 4 4 9.5 4 16c0 1.6.4 2.9 1 4 1.3-4.7 5-8 10-9.5-4 2.4-6.7 5.6-8 9.5 6.6 1 13-4 13-16z"/>'),
    power: svg('<path fill="#ffd34d" d="M13 2L4 14h6l-1 8 9-12h-6z"/>'),
  };

  const LABELS = {
    hp: "Points de vie",
    pa: "Points d'action",
    pm: "Points de mouvement",
    po: "Portée",
    strength: "Force",
    intelligence: "Intelligence",
    chance: "Chance",
    agility: "Agilité",
    power: "Puissance",
  };

  root.TnulIcons = {
    html: (name) => ICONS[name] || "",
    label: (name) => LABELS[name] || name,
  };
})(typeof window !== "undefined" ? window : globalThis);
