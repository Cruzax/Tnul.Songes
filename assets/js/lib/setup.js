// Pages des combats tactiques: bandeau « Mise en place » sous l'en-tête, avec les étapes de data/tactiques.json
// (les mêmes que sur les cartes de tactiques.html). Script classique, chargé en defer.
(async function () {
  const hero = document.querySelector(".page-hero");
  if (!hero) return;
  const page = location.pathname.split("/").pop();
  let tool;
  try {
    const data = await fetch("data/tactiques.json").then((response) => response.json());
    tool = data.tools.find((item) => item.href === page);
  } catch (error) {
    return;
  }
  if (!tool || !tool.setup) return;
  const box = document.createElement("section");
  box.className = "setup-strip";
  box.setAttribute("aria-label", "Mise en place");
  if (tool.color) box.style.setProperty("--tool", tool.color);
  const title = document.createElement("p");
  title.className = "setup-title";
  title.textContent = "Mise en place";
  const list = document.createElement("ol");
  list.className = "setup-steps";
  tool.setup.forEach((step) => {
    const item = document.createElement("li");
    item.textContent = step;
    list.appendChild(item);
  });
  box.append(title, list);
  hero.after(box);
})();
