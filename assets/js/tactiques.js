// Page « Combats tactiques »: liste des combats, avec ou sans outil (données dans data/tactiques.json).
(async function () {
  const GUIDE = "https://www.dofuspourlesnoobs.com/";
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  let data;
  try {
    data = await fetch("data/tactiques.json").then((response) => response.json());
  } catch (error) {
    document.getElementById("tq-tools").textContent = "Impossible de charger la liste.";
    console.error("Erreur de chargement:", error.message);
    return;
  }

  function guideLink(slug, label) {
    const a = el("a", "tq-guide", label);
    a.href = `${GUIDE}${slug}.html`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    return a;
  }

  data.tools.forEach((tool) => {
    const card = el("article", "tq-card tool");
    card.appendChild(el("p", "tq-quest", tool.quest));
    card.appendChild(el("h4", "tq-title", tool.title));
    card.appendChild(el("p", "tq-text", tool.summary));
    const actions = el("div", "tq-actions");
    const open = el("a", "tq-open", "Ouvrir l'outil");
    open.href = tool.href;
    actions.append(open, guideLink(tool.guide, "Guide ↗"));
    card.appendChild(actions);
    document.getElementById("tq-tools").appendChild(card);
  });

  data.fights.forEach((fight) => {
    const card = el("article", "tq-card");
    card.appendChild(el("p", "tq-quest", fight.quest));
    card.appendChild(el("h4", "tq-title", fight.title));
    const goal = el("p", "tq-text");
    goal.appendChild(el("strong", "", "But: "));
    goal.append(fight.goal);
    card.appendChild(goal);
    const mechanic = el("p", "tq-text");
    mechanic.appendChild(el("strong", "", "Mécanique: "));
    mechanic.append(fight.mechanic);
    card.appendChild(mechanic);
    if (fight.tips && fight.tips.length) {
      const list = el("ul", "tq-tips");
      fight.tips.forEach((tip) => list.appendChild(el("li", "", tip)));
      card.appendChild(list);
    }
    const actions = el("div", "tq-actions");
    actions.appendChild(guideLink(fight.guide, "Guide complet ↗"));
    card.appendChild(actions);
    document.getElementById("tq-fights").appendChild(card);
  });
})();
