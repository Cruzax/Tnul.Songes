// Page « Fiches de classes »: choix de la classe, puis la fiche (classes/<nom>.html) dans une card.
// Le cadre prend toute la hauteur de la fiche, donc seule la page défile; la barre collante de la card
// reprend le sommaire de la fiche et permet de changer de classe.
(function () {
  // [fichier, nom, accroche (le « kicker » en tête de la fiche)]
  const CLASSES = [
    ["feca", "Féca", "Gardien des glyphes"], ["osamodas", "Osamodas", "Dresseur d'invocations"],
    ["enutrof", "Enutrof", "Chercheur de trésors"], ["sram", "Sram", "Maître des pièges"],
    ["xelor", "Xélor", "Maître du temps"], ["ecaflip", "Ecaflip", "Joueur de poker"],
    ["eniripsa", "Eniripsa", "Soigneuse des mots"], ["iop", "Iop", "Guerrier qui monte en puissance"],
    ["cra", "Crâ", "Archer à distance"], ["sadida", "Sadida", "Maître des poupées"],
    ["sacrieur", "Sacrieur", "Berserker de la souffrance"], ["pandawa", "Pandawa", "Brasseur sobre ou saoul"],
    ["roublard", "Roublard", "Artificier"], ["zobal", "Zobal", "Porteur de masques"],
    ["steamer", "Steamer", "Ingénieur des tourelles"], ["eliotrope", "Éliotrope", "Maître des portails"],
    ["huppermage", "Huppermage", "Mage élémentaliste"], ["ouginak", "Ouginak", "Chasseur enragé"],
    ["forgelance", "Forgelance", "Lancier"],
  ];
  const EXTRAS = [["simu-eliotrope-portails", "Portails Éliotrope", "Simulateur"]];
  const all = [...CLASSES, ...EXTRAS];

  const grid = document.getElementById("cl-grid");
  const viewer = document.getElementById("cl-viewer");
  const bar = document.getElementById("cl-bar");
  const select = document.getElementById("cl-select");
  const toc = document.getElementById("cl-toc");
  const open = document.getElementById("cl-open");
  const empty = document.getElementById("cl-empty");
  const frame = document.getElementById("cl-frame");
  const back = document.getElementById("cl-back");
  const buttons = new Map();
  let sections = [];
  let shown = "";
  let scrollToCard = false;

  // Hauteur cachée en haut de l'écran par l'en-tête du site et la barre de la card
  const covered = () => document.querySelector(".site-header").offsetHeight + bar.offsetHeight + 12;

  // Fait défiler la page pour amener un élément de la fiche sous la barre (le cadre, lui, ne défile pas)
  function scrollToInFrame(element, block) {
    const rect = element.getBoundingClientRect();
    const frameTop = frame.getBoundingClientRect().top + window.scrollY;
    const top = block === "center"
      ? frameTop + rect.top + rect.height / 2 - (covered() + window.innerHeight) / 2
      : frameTop + rect.top - covered();
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  function fit() {
    const body = frame.contentDocument && frame.contentDocument.body;
    if (body) frame.style.height = `${body.offsetHeight}px`;
  }

  // Section de la fiche visible sous la barre: mise en avant dans le sommaire
  function markSection() {
    const limit = covered() + 8;
    let current = null;
    sections.forEach((section) => {
      if (section.target.getBoundingClientRect().top + frame.getBoundingClientRect().top <= limit) current = section;
    });
    sections.forEach((section) => section.button.classList.toggle("is-active", section === current));
  }

  function buildToc(doc) {
    toc.textContent = "";
    sections = [...doc.querySelectorAll(".nav-toc a[href^='#']")].flatMap((link) => {
      const target = doc.getElementById(decodeURIComponent(link.getAttribute("href").slice(1)));
      if (!target) return [];
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = link.textContent;
      button.addEventListener("click", () => scrollToInFrame(target, "start"));
      toc.appendChild(button);
      return [{ target, button }];
    });
    markSection();
  }

  // Met à jour les pastilles, la liste, le lien et l'adresse pour la classe affichée
  function mark(slug) {
    select.value = slug;
    open.href = `classes/${slug}.html`;
    open.hidden = false;
    buttons.forEach((button, id) => button.setAttribute("aria-pressed", String(id === slug)));
    try {
      history.replaceState(null, "", `#${slug}`);
    } catch (error) {
      // sans importance
    }
  }

  function show(slug) {
    if (!buttons.has(slug)) return;
    mark(slug);
    if (shown === slug) return;
    shown = slug;
    grid.hidden = true;
    viewer.hidden = false;
    toc.textContent = "";
    sections = [];
    empty.hidden = false;
    frame.hidden = true;
    frame.src = `classes/${slug}.html`;
  }

  frame.addEventListener("load", () => {
    const win = frame.contentWindow;
    const doc = frame.contentDocument;
    if (!doc || !doc.body) return;
    empty.hidden = true;
    frame.hidden = false;

    // Les liens internes et scrollIntoView (filtres du grimoire, « sort jumeau ») font défiler la page
    win.Element.prototype.scrollIntoView = function (options) {
      scrollToInFrame(this, options && typeof options === "object" ? options.block : "start");
    };
    doc.addEventListener("click", (event) => {
      const link = event.target.closest("a[href^='#']");
      const target = link && doc.getElementById(decodeURIComponent(link.getAttribute("href").slice(1)));
      if (!target) return;
      event.preventDefault();
      scrollToInFrame(target, "start");
    });

    new win.ResizeObserver(fit).observe(doc.body);
    fit();
    buildToc(doc);
    doc.addEventListener("fiche:toc", () => buildToc(doc));

    // Si la fiche a changé toute seule (lien vers une autre classe), on remet le choix à jour
    const slug = win.location.pathname.split("/").pop().replace(/\.html$/, "");
    if (buttons.has(slug) && slug !== shown) {
      shown = slug;
      mark(slug);
    }
    if (scrollToCard) {
      scrollToCard = false;
      window.scrollTo({ top: viewer.getBoundingClientRect().top + window.scrollY - document.querySelector(".site-header").offsetHeight - 8 });
    }
  });

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choisis une classe";
  placeholder.disabled = true;
  placeholder.selected = true;
  select.appendChild(placeholder);

  all.forEach(([slug, label, role], index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cl-button" + (index >= CLASSES.length ? " extra" : "");
    const name = document.createElement("span");
    name.className = "cl-name";
    name.textContent = label;
    const tagline = document.createElement("span");
    tagline.className = "cl-role";
    tagline.textContent = role;
    button.append(name, tagline);
    button.addEventListener("click", () => {
      scrollToCard = true;
      show(slug);
    });
    grid.appendChild(button);
    buttons.set(slug, button);

    const option = document.createElement("option");
    option.value = slug;
    option.textContent = label;
    select.appendChild(option);
  });

  // Changer de classe depuis la barre (souvent en bas d'une fiche): on revient en haut de la card
  select.addEventListener("change", () => {
    scrollToCard = true;
    show(select.value);
  });

  // « ← Toutes »: on revient à la grille des classes (la fiche reste chargée si on y retourne)
  function showGrid() {
    grid.hidden = false;
    viewer.hidden = true;
    shown = "";
    buttons.forEach((button) => button.setAttribute("aria-pressed", "false"));
    try {
      history.replaceState(null, "", location.pathname);
    } catch (error) {
      // sans importance
    }
    window.scrollTo({ top: 0 });
  }
  back.addEventListener("click", showGrid);

  let ticking = false;
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      markSection();
    });
  }, { passive: true });

  const initial = location.hash.slice(1);
  if (buttons.has(initial)) show(initial);
  window.addEventListener("hashchange", () => {
    const slug = location.hash.slice(1);
    if (buttons.has(slug)) show(slug);
  });
})();
