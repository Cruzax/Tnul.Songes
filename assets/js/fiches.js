// Fiches de classes (classes/*.html): un clic sur le nom d'un sort ouvre sa carte du grimoire dans une bulle,
// à l'endroit du clic (pas besoin de descendre jusqu'au grimoire). Ajouté par tools/patch-classes.js.
// Sur petit écran, les tableaux passent en cartes empilées (fiches.css): chaque cellule reçoit le nom de sa
// colonne, affiché devant la valeur.
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
})();
