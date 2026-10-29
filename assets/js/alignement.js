// Page « Bonta contre Brâkmar »: chiffres, métiers et tableau des quêtes d'alignement (data/alignement.json,
// écrit par tools/build-alignement.js depuis DofusDB). L'histoire et les Ordres sont écrits dans la page.
(function () {
  const SIDES = ["bonta", "brakmar"];
  const NAMES = { bonta: "Bonta", brakmar: "Brâkmar" };
  const SOURCES = { craft: "à fabriquer", recolte: "à récolter", drop: "sur des monstres", quete: "donné par la quête", autre: "à acheter" };

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const sum = (list, fn) => list.reduce((total, item) => total + fn(item), 0);
  const jobsOf = (quest) => [...new Set(quest.needs.filter((need) => need.job).map((need) => need.job))];

  function render(quests) {
    const bySide = Object.fromEntries(SIDES.map((side) => [side, quests.filter((quest) => quest.side === side)]));
    SIDES.forEach((side) => { document.getElementById(`al-count-${side}`).textContent = bySide[side].length; });
    renderStats(bySide);
    renderJobs(bySide);
    renderHelp(bySide);
    renderTable(bySide);
  }

  // Une ligne = une mesure, une barre par camp (la plus longue = le plus grand des deux)
  function renderStats(bySide) {
    const metrics = [
      ["Quêtes", (list) => list.length],
      ["Quêtes principales", (list) => list.filter((q) => q.kind === "principale").length],
      ["Quêtes d'Ordre", (list) => list.filter((q) => q.kind === "ordre").length],
      ["Quêtes à choix", (list) => list.filter((q) => q.kind === "choix").length],
      ["Étapes", (list) => sum(list, (q) => q.steps.length)],
      ["PNJ à aller voir", (list) => sum(list, (q) => q.count.parler)],
      ["Objets à apporter", (list) => sum(list, (q) => q.count.objets)],
      ["Objets à fabriquer soi-même", (list) => sum(list, (q) => q.count.fabriquer)],
      ["Cartes à découvrir", (list) => sum(list, (q) => q.count.cartes)],
      ["Combats imposés", (list) => sum(list, (q) => q.count.combats)],
      ["Quêtes avec un donjon", (list) => list.filter((q) => q.dungeon).length],
      ["Quêtes où il faut de l'aide", (list) => list.filter((q) => q.help).length],
      ["Quêtes qui sollicitent un métier", (list) => list.filter((q) => jobsOf(q).length).length],
    ];
    const box = document.getElementById("al-stats");
    const values = {};
    metrics.forEach(([label, fn]) => {
      const pair = SIDES.map((side) => fn(bySide[side]));
      values[label] = pair;
      box.append(barRow(label, pair));
    });

    // Les écarts les plus nets, en une phrase
    const [fightB, fightK] = values["Combats imposés"];
    const [talkB, talkK] = values["PNJ à aller voir"];
    const [itemB, itemK] = values["Objets à apporter"];
    document.getElementById("al-verdict").textContent =
      `Les deux parcours ont la même longueur (100 rangs, niveaux 30 à 200). Brâkmar fait plus combattre (${fightK} combats contre ${fightB}) et a des choix moraux en plus ; `
      + `Bonta fait plus parler (${talkB} PNJ contre ${talkK}) et demande un peu plus d'objets (${itemB} contre ${itemK}).`;
  }

  function barRow(label, [left, right], detail) {
    const max = Math.max(left, right, 1);
    const row = el("div", "al-bar");
    const sideBar = (side, value) => {
      const cell = el("span", `al-bar-side ${side}`);
      const fill = el("span", "al-bar-fill");
      fill.style.width = `${(value / max) * 100}%`;
      cell.append(fill, el("b", "al-bar-value", String(value)));
      if (value > (side === "bonta" ? right : left)) cell.classList.add("is-more");
      return cell;
    };
    const name = el("span", "al-bar-label", label);
    if (detail) name.append(el("small", "", detail));
    row.append(sideBar("bonta", left), name, sideBar("brakmar", right));
    return row;
  }

  // Métiers: nombre de quêtes de chaque camp qui demandent un objet fabriqué ou récolté par ce métier
  function renderJobs(bySide) {
    const jobs = new Map();
    SIDES.forEach((side) => bySide[side].forEach((quest) => quest.needs.forEach((need) => {
      if (!need.job) return;
      if (!jobs.has(need.job)) jobs.set(need.job, { bonta: new Set(), brakmar: new Set(), items: new Set() });
      const job = jobs.get(need.job);
      job[side].add(quest.id);
      job.items.add(need.name);
    })));
    const box = document.getElementById("al-jobs");
    [...jobs.entries()]
      .sort((a, b) => (b[1].bonta.size + b[1].brakmar.size) - (a[1].bonta.size + a[1].brakmar.size))
      .forEach(([name, job]) => {
        const items = [...job.items];
        box.append(barRow(name, [job.bonta.size, job.brakmar.size], items.slice(0, 4).join(", ") + (items.length > 4 ? "…" : "")));
      });
  }

  function renderHelp(bySide) {
    const box = document.getElementById("al-help");
    SIDES.forEach((side) => {
      const col = el("ul", `al-help-list ${side}`);
      bySide[side].filter((q) => q.help).forEach((quest) => {
        const item = el("li");
        item.append(el("b", "", quest.name), el("span", "al-help-lvl", `rang ${quest.rank} · niv. ${quest.level}`), el("p", "", quest.help));
        col.append(item);
      });
      box.append(col);
    });
  }

  // Tableau: une ligne par rang, la quête de chaque camp avec des pastilles (métier, combat, donjon, aide)
  function renderTable(bySide) {
    const table = document.getElementById("al-table");
    const main = Object.fromEntries(SIDES.map((side) => [side, new Map(bySide[side].filter((q) => q.kind === "principale").map((q) => [q.rank, q]))]));
    const rows = [];
    for (let rank = 0; rank < 100; rank += 1) {
      const pair = SIDES.map((side) => main[side].get(rank));
      const row = el("button", "al-row");
      row.type = "button";
      row.setAttribute("aria-expanded", "false");
      row.append(el("span", "al-rank", String(rank)));
      pair.forEach((quest, i) => row.append(questCell(quest, SIDES[i])));
      const detail = el("div", "al-detail");
      detail.hidden = true;
      pair.forEach((quest, i) => detail.append(questDetail(quest, SIDES[i])));
      row.addEventListener("click", () => {
        const open = detail.hidden;
        detail.hidden = !open;
        row.setAttribute("aria-expanded", String(open));
      });
      const tags = new Set(pair.flatMap((quest) => (quest ? flags(quest) : [])));
      rows.push({ row, detail, tags });
      table.append(row, detail);
    }

    // Filtres: on garde les rangs où au moins un des deux camps a la pastille
    const buttons = [...document.querySelectorAll("#al-filters button")];
    buttons.forEach((button) => button.addEventListener("click", () => {
      buttons.forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
      const filter = button.dataset.f;
      rows.forEach(({ row, detail, tags }) => {
        const show = !filter || tags.has(filter);
        row.hidden = !show;
        if (!show) detail.hidden = true;
      });
    }));

    const extra = SIDES.map((side) => {
      const orders = bySide[side].filter((q) => q.kind === "ordre").length;
      const choices = bySide[side].filter((q) => q.kind === "choix").length;
      return `${NAMES[side]} : ${orders} quêtes d'Ordre${choices ? ` et ${choices} quêtes d'embranchement (selon tes choix)` : ""}`;
    });
    document.getElementById("al-extra").textContent = `En plus des 100 rangs. ${extra.join(" · ")}.`;
  }

  function flags(quest) {
    const list = [];
    if (jobsOf(quest).length) list.push("job");
    if (quest.count.combats) list.push("fight");
    if (quest.dungeon) list.push("dungeon");
    if (quest.help) list.push("help");
    return list;
  }

  function questCell(quest, side) {
    const cell = el("span", `al-cell ${side}`);
    if (!quest) return cell;
    cell.append(el("span", "al-name", quest.name));
    const tags = el("span", "al-tags");
    jobsOf(quest).forEach((job) => tags.append(el("span", "al-tag job", job)));
    if (quest.count.combats) tags.append(el("span", "al-tag fight", `${quest.count.combats} combat${quest.count.combats > 1 ? "s" : ""}`));
    if (quest.dungeon) tags.append(el("span", "al-tag dungeon", "Donjon"));
    if (quest.help) tags.append(el("span", "al-tag help", "Aide"));
    cell.append(el("span", "al-lvl", `niv. ${quest.level}`), tags);
    return cell;
  }

  function questDetail(quest, side) {
    const box = el("div", `al-detail-side ${side}`);
    if (!quest) return box;
    box.append(el("h4", "", quest.name));
    const steps = el("ol", "al-steps");
    quest.steps.forEach((step) => steps.append(el("li", "", step)));
    box.append(steps);
    if (quest.needs.length) {
      const list = el("ul", "al-needs");
      quest.needs.forEach((need) => {
        const item = el("li");
        item.append(el("b", "", `${need.qty} × ${need.name}`));
        const how = need.make ? `à fabriquer toi-même${need.job ? ` (${need.job})` : ""}` : need.job ? `${SOURCES[need.src]} (${need.job})` : SOURCES[need.src];
        item.append(el("span", "", how));
        list.append(item);
      });
      box.append(list);
    }
    if (quest.fights.length) box.append(el("p", "al-fights", `Combats : ${quest.fights.map((f) => (f.qty > 1 ? `${f.qty} × ${f.name}` : f.name)).join(", ")}`));
    if (quest.help) box.append(el("p", "al-fights", `Aide : ${quest.help}`));
    return box;
  }

  fetch("data/alignement.json")
    .then((response) => response.json())
    .then((data) => render(data.quests))
    .catch(() => {
      document.getElementById("al-stats").textContent = "Les quêtes n'ont pas pu être chargées.";
    });
})();
