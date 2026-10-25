// Page « Fiches de classes »: choix de la classe, la fiche s'affiche dans un cadre intégré (classes/<nom>.html).
(function () {
  const CLASSES = [
    ["feca", "Féca"], ["osamodas", "Osamodas"], ["enutrof", "Enutrof"], ["sram", "Sram"], ["xelor", "Xélor"],
    ["ecaflip", "Ecaflip"], ["eniripsa", "Eniripsa"], ["iop", "Iop"], ["cra", "Crâ"], ["sadida", "Sadida"],
    ["sacrieur", "Sacrieur"], ["pandawa", "Pandawa"], ["roublard", "Roublard"], ["zobal", "Zobal"], ["steamer", "Steamer"],
    ["eliotrope", "Éliotrope"], ["huppermage", "Huppermage"], ["ouginak", "Ouginak"], ["forgelance", "Forgelance"],
  ];
  const EXTRAS = [["simu-eliotrope-portails", "Simulateur de portails Éliotrope"]];

  const grid = document.getElementById("cl-grid");
  const frame = document.getElementById("cl-frame");
  const title = document.getElementById("cl-title");
  const open = document.getElementById("cl-open");
  const empty = document.getElementById("cl-empty");
  const buttons = new Map();

  function show(slug) {
    const entry = [...CLASSES, ...EXTRAS].find(([id]) => id === slug);
    if (!entry) {
      return;
    }
    const url = `classes/${slug}.html`;
    title.textContent = entry[1];
    open.href = url;
    open.hidden = false;
    empty.hidden = true;
    frame.hidden = false;
    if (!frame.src.endsWith(url)) {
      frame.src = url;
    }
    buttons.forEach((button, id) => button.setAttribute("aria-pressed", String(id === slug)));
    try {
      history.replaceState(null, "", `#${slug}`);
    } catch (error) {
      // sans importance
    }
  }

  [...CLASSES, ...EXTRAS].forEach(([slug, label], index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cl-button" + (index >= CLASSES.length ? " extra" : "");
    button.textContent = label;
    button.addEventListener("click", () => show(slug));
    grid.appendChild(button);
    buttons.set(slug, button);
  });

  const initial = location.hash.slice(1);
  if (buttons.has(initial)) {
    show(initial);
  }
  window.addEventListener("hashchange", () => {
    const slug = location.hash.slice(1);
    if (buttons.has(slug)) show(slug);
  });
})();
