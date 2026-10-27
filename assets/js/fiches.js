// Fiches de classes (classes/*.html): un clic sur le nom d'un sort ouvre sa carte du grimoire dans une bulle,
// à l'endroit du clic (pas besoin de descendre jusqu'au grimoire). Ajouté par tools/patch-classes.js.
// Sur petit écran, les tableaux passent en cartes empilées (fiches.css): chaque cellule reçoit le nom de sa
// colonne, affiché devant la valeur. Une section « Combos » est aussi ajoutée depuis data/combos.json.
// Icônes des fiches redessinées: dommages = épée, PO = œil, PM = botte (« s » = trait, « f » = plein)
const ICONS = {
  dommages: ["s", '<path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/>'],
  po: ["s", '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'],
  pm: ["f", '<path d="M5.5 2h8l-.3 9.4 5.9 2a3.3 3.3 0 0 1 2.2 3.1V20h-7.6l-1.4-1.8H9.6L8.4 20H5.2z"/>'],
};
Object.entries(ICONS).forEach(([name, [style, svg]]) => {
  document.querySelectorAll(`.ic-${name}`).forEach((icon) => {
    icon.classList.remove("f", "s");
    icon.classList.add(style);
    const box = icon.querySelector("svg");
    if (box) box.innerHTML = svg;
  });
});

document.querySelectorAll(".tableau table").forEach((table) => {
  const heads = [...table.querySelectorAll("thead th")].map((th) => th.textContent.trim());
  table.querySelectorAll("tbody tr").forEach((row) => {
    [...row.children].forEach((cell, i) => {
      if (cell.tagName === "TD" && heads[i]) cell.dataset.label = heads[i];
    });
  });
  // Couleur d'élément de la colonne, reprise sur l'étiquette
  table.querySelectorAll("thead th").forEach((th, i) => {
    const el = ["eau", "terre", "air", "feu"].find((c) => th.classList.contains(c));
    if (el) table.querySelectorAll(`tbody tr > :nth-child(${i + 1})`).forEach((cell) => cell.classList.add(`lbl-${el}`));
  });
});

(function () {
  const cards = [...document.querySelectorAll(".spc[data-nom]")];
  if (!cards.length) return;
  const norm = (text) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
  const byName = cards.map((card) => ({ card, name: norm(card.dataset.nom) })).sort((a, b) => b.name.length - a.name.length);

  // L'étiquette .sp ne contient que l'icône et le premier mot (« Flèche » de « Flèche d'Expiation »):
  // on lit la suite du texte et on garde le nom de sort le plus long qui correspond
  function spellOf(tag) {
    if (tag.dataset.nom) return cards.find((card) => card.dataset.nom === tag.dataset.nom);
    let text = tag.textContent;
    for (let node = tag.nextSibling; node && text.length < 80; node = node.nextSibling) {
      text += node.textContent;
    }
    const read = norm(text);
    const found = byName.find(({ name }) => read.startsWith(name) && !/[a-z0-9]/.test(read.charAt(name.length)));
    return found && found.card;
  }

  const pop = document.createElement("div");
  pop.className = "sp-pop";
  pop.setAttribute("role", "dialog");
  pop.hidden = true;
  document.body.appendChild(pop);
  let openFor = null;

  function close() {
    pop.hidden = true;
    pop.textContent = "";
    openFor = null;
  }

  function open(tag, card, event) {
    const clone = card.cloneNode(true);
    clone.removeAttribute("id");
    clone.hidden = false;
    clone.querySelector(".spc-foot")?.remove();
    const goto = document.createElement("button");
    goto.type = "button";
    goto.className = "sp-pop-goto";
    goto.textContent = "Voir dans le grimoire ↓";
    goto.addEventListener("click", () => {
      close();
      if (card.hidden) document.querySelector(".gf-reset")?.click();
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.classList.add("flash");
      setTimeout(() => card.classList.remove("flash"), 1200);
    });
    pop.textContent = "";
    pop.append(clone, goto);
    pop.setAttribute("aria-label", card.dataset.nom);
    pop.hidden = false;
    openFor = tag;

    // Sous le pointeur, décalé à droite; ramené dans la largeur de la page, et au-dessus s'il manque de place
    const margin = 12;
    const width = pop.offsetWidth;
    const height = pop.offsetHeight;
    let left = event.pageX + 14;
    if (left + width > document.documentElement.clientWidth - margin) left = event.pageX - width - 14;
    left = Math.max(margin, Math.min(left, document.documentElement.clientWidth - width - margin));
    // Dans la page Classes, la fiche est un cadre sans défilement: la partie visible est celle de la page parente
    let pointerY = event.clientY;
    let viewHeight = window.innerHeight;
    try {
      if (window.frameElement) {
        pointerY += window.frameElement.getBoundingClientRect().top;
        viewHeight = window.parent.innerHeight;
      }
    } catch (error) {
      // cadre d'une autre origine: on garde la fenêtre de la fiche
    }
    let top = event.pageY + 16;
    if (pointerY + 16 + height > viewHeight - margin && pointerY - 16 - height > margin) top = event.pageY - height - 16;
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }

  document.addEventListener("click", (event) => {
    const tag = event.target.closest(".sp");
    if (tag && !tag.closest(".spc-jumeau, .sp-pop")) {
      const card = spellOf(tag);
      if (card && openFor !== tag) {
        event.preventDefault();
        open(tag, card, event);
        return;
      }
    }
    if (!event.target.closest(".sp-pop")) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  // Les noms de sorts cliquables le montrent
  document.querySelectorAll(".sp").forEach((tag) => {
    if (!tag.closest(".spc-jumeau") && spellOf(tag)) tag.classList.add("sp-link");
  });

  // Combos (data/combos.json): quelques enchaînements pour un tour, ajoutés après la première section.
  // Chaque sort est cliquable (même bulle) et le coût total est recalculé depuis les cartes du grimoire.
  const slug = location.pathname.split("/").pop().replace(/\.html$/, "");
  const cardOf = (name) => cards.find((card) => card.dataset.nom === name);
  const costOf = (card) => parseInt(card.querySelector(".chip-k.pa")?.textContent, 10) || 0;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function comboCard(combo) {
    const steps = combo.steps.filter(([name]) => cardOf(name));
    const article = el("article", "cb");
    const head = el("header", "cb-head");
    head.append(el("span", "cb-tag", combo.tag), el("h3", "", combo.name));
    head.append(el("span", "chip-k pa cb-pa", `${steps.reduce((sum, [name]) => sum + costOf(cardOf(name)), 0)} PA`));
    const list = el("ol", "cb-steps");
    steps.forEach(([name, note]) => {
      const card = cardOf(name);
      const item = el("li");
      const tag = el("span", "sp sp-link cb-sp");
      tag.dataset.nom = name;
      const icon = card.querySelector(".spc-ic");
      if (icon) tag.append(Object.assign(el("img", "sp-ic"), { src: icon.src, alt: "" }));
      tag.append(name, el("span", "cb-cost", `${costOf(card)} PA`));
      item.append(tag);
      if (note) item.append(el("small", "", note));
      list.append(item);
    });
    article.append(head, el("p", "cb-idea", combo.idea), list);
    return article;
  }

  fetch("../data/combos.json")
    .then((response) => (response.ok ? response.json() : {}))
    .then((all) => {
      const combos = all[slug];
      const first = document.querySelector("main .section");
      if (!combos || !combos.length || !first) return;
      const section = el("section", "section section-combos");
      section.id = "combos";
      const head = el("div", "section-head");
      head.append(el("h2", "", "Combos"), el("span", "sub", "Idées d'enchaînements pour un tour, à adapter au combat"));
      const grid = el("div", "cb-grid");
      combos.forEach((combo) => grid.append(comboCard(combo)));
      section.append(head, grid);
      first.after(section);
      const link = Object.assign(el("a", "", "Combos"), { href: "#combos" });
      document.querySelector(`.nav-toc a[href="#${first.id}"]`)?.after(link);
      // Page Classes: le sommaire de la page parente est reconstruit
      document.dispatchEvent(new Event("fiche:toc"));
    })
    .catch(() => {});
})();
