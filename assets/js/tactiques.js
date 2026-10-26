// Page « Combats tactiques »: liste des combats, avec ou sans outil (données dans data/tactiques.json).
(async function () {
  const GUIDE = "https://www.dofuspourlesnoobs.com/";
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  // « Le Trésor et les Vigicoffres » -> « le-tresor-et-les-vigicoffres », pour les ancres du sommaire
  const slug = (text) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  let data;
  try {
    data = await fetch("data/tactiques.json").then((response) => response.json());
  } catch (error) {
    document.getElementById("tq-tools").textContent = "Impossible de charger la liste.";
    console.error("Erreur de chargement:", error.message);
    return;
  }
  document.getElementById("tq-count-tools").textContent = data.tools.length;
  document.getElementById("tq-count-fights").textContent = data.fights.length;

  function guideLink(guide, label) {
    const a = el("a", "tq-guide", label);
    a.href = `${GUIDE}${guide}.html`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    return a;
  }

  // Bandeau des cartes d'outil: gemme du Dofus (ou icône) sur un halo de sa couleur
  const NS = "http://www.w3.org/2000/svg";
  const ICONS = {
    gem: '<path d="M12 2.5 20 9l-8 12.5L4 9z" fill="currentColor" stroke="rgb(0 0 0 / 0.35)" stroke-width="0.8"/><path d="M4 9h16M12 2.5 9 9l3 12.5L15 9z" fill="none" stroke="rgb(255 255 255 / 0.5)" stroke-width="0.7"/><path d="M8.5 5.5 6.5 8.2" stroke="rgb(255 255 255 / 0.8)" stroke-width="0.9" stroke-linecap="round"/>',
    yin: '<circle cx="12" cy="12" r="9" fill="currentColor" stroke="rgb(0 0 0 / 0.4)" stroke-width="0.8"/><path d="M12 3a4.5 4.5 0 0 1 0 9 4.5 4.5 0 0 0 0 9 9 9 0 0 1 0-18z" fill="#15161a"/><circle cx="12" cy="7.5" r="1.4" fill="#15161a"/><circle cx="12" cy="16.5" r="1.4" fill="currentColor"/>',
    spider: '<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="13" r="3.2" fill="currentColor"/><circle cx="12" cy="8" r="1.8" fill="currentColor"/><path d="M9 11 4 7M9 13H3M9.5 15.5 5 20M15 11l5-4M15 13h6M14.5 15.5 19 20"/></g>',
  };
  function banner(tool) {
    const head = el("div", "tq-tool-banner");
    const badge = document.createElementNS(NS, "svg");
    badge.setAttribute("viewBox", "0 0 24 24");
    badge.setAttribute("class", "tq-tool-gem");
    badge.setAttribute("aria-hidden", "true");
    badge.innerHTML = ICONS[tool.icon || "gem"];
    head.append(badge, guideLink(tool.guide, "Guide ↗"));
    return head;
  }

  data.tools.forEach((tool) => {
    const card = el("article", "tq-tool");
    if (tool.color) card.style.setProperty("--tool", tool.color);
    const title = el("h3", "tq-tool-title");
    const open = el("a", "", tool.title);
    open.href = tool.href;
    title.appendChild(open);
    const body = el("div", "tq-tool-body");
    body.append(title, el("p", "tq-tool-quest", `Quête « ${tool.quest} »`), el("p", "tq-tool-text", tool.summary));
    card.append(banner(tool), body);
    // Bouton pleine largeur (décoratif: c'est le lien du titre qui couvre toute la carte)
    const foot = el("div", "tq-tool-foot");
    const button = el("span", "tq-tool-open", "Ouvrir l'outil");
    button.setAttribute("aria-hidden", "true");
    foot.appendChild(button);
    card.appendChild(foot);
    document.getElementById("tq-tools").appendChild(card);
  });

  const index = document.getElementById("tq-index");
  const links = new Map();
  data.fights.forEach((fight) => {
    const id = slug(fight.title);
    const card = el("article", "tq-fiche");
    card.id = id;

    const head = el("header", "tq-fiche-head");
    const heading = el("div");
    heading.append(el("p", "tq-fiche-quest", fight.quest), el("h3", "tq-fiche-title", fight.title));
    head.append(heading, guideLink(fight.guide, "Guide complet ↗"));

    const rows = el("dl", "tq-rows");
    const row = (label, content) => {
      const line = el("div");
      const value = el("dd");
      value.append(content);
      line.append(el("dt", "", label), value);
      rows.appendChild(line);
    };
    row("But", fight.goal);
    row("Mécanique", fight.mechanic);
    if (fight.tips && fight.tips.length) {
      const list = el("ul", "tq-tips");
      fight.tips.forEach((tip) => list.appendChild(el("li", "", tip)));
      row("Astuces", list);
    }
    card.append(head, rows);
    document.getElementById("tq-fights").appendChild(card);

    const link = el("a", "", fight.title);
    link.href = `#${id}`;
    link.appendChild(el("small", "", fight.quest));
    index.appendChild(link);
    links.set(id, link);
  });

  // Sommaire: surligne la fiche en cours de lecture
  const visible = new Set();
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => (entry.isIntersecting ? visible.add(entry.target.id) : visible.delete(entry.target.id)));
    const first = data.fights.map((fight) => slug(fight.title)).find((id) => visible.has(id));
    if (!first) return;
    links.forEach((link, id) => link.classList.toggle("is-current", id === first));
    const current = links.get(first);
    if (index.scrollWidth > index.clientWidth) index.scrollTo({ left: current.offsetLeft - 16, behavior: "smooth" });
  }, { rootMargin: "-80px 0px -55% 0px" });
  document.querySelectorAll(".tq-fiche").forEach((card) => observer.observe(card));
})();
