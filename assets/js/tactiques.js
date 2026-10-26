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

  data.tools.forEach((tool, index) => {
    const card = el("article", "tq-tool");
    card.appendChild(el("span", "tq-tool-index", String(index + 1).padStart(2, "0")));
    const title = el("h3", "tq-tool-title");
    const open = el("a", "", tool.title);
    open.href = tool.href;
    title.appendChild(open);
    card.append(title, el("p", "tq-tool-quest", `Quête « ${tool.quest} »`), el("p", "tq-tool-text", tool.summary));
    const foot = el("div", "tq-tool-foot");
    foot.append(el("span", "tq-tool-open", "Ouvrir l'outil"), guideLink(tool.guide, "Guide ↗"));
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
