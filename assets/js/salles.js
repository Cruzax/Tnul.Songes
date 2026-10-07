(async function () {
  const container = document.getElementById("simulation");

  try {
    const maps = await fetch("data/maps.json").then((response) => response.json());
    window.TnulSimulator.mount(container, {
      imageUrls: [],
      data: { spells: [] },
      maps,
      noEmptyOption: true,
      showStarts: true,
      hideStartsToggle: true,
      harebourg: true,
      viewOnly: true,
    });
  } catch (error) {
    container.textContent = "Impossible de charger les cartes.";
    console.error("Erreur de chargement:", error.message);
  }
})();

// ---- Top Domi Reversi (top 10 de la communauté, avec lien vers le chapitre de la vidéo) ----
(async function () {
  const root = document.getElementById("domireversi");
  if (!root) {
    return;
  }

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text !== undefined) {
      node.textContent = text;
    }
    return node;
  };

  try {
    const data = await fetch("data/domireversi.json").then((response) => response.json());
    root.appendChild(el("h2", "m-0 text-xl font-semibold", "Top Domi Reversi"));

    const list = el("ol", "mt-4 grid gap-2");
    data.top.forEach((monster, index) => {
      const item = el("li", "flex items-center gap-3 rounded-2xl border border-slate-200/20 bg-slate-900/50 p-2.5");
      item.appendChild(el("span", "w-6 flex-none text-center text-sm font-semibold text-slate-300", String(index + 1)));

      const media = el("span", "grid h-14 w-14 flex-none place-items-center overflow-hidden rounded-xl bg-slate-950/60");
      if (monster.image) {
        const image = el("img", "h-full w-full object-contain");
        image.src = "Images/" + encodeURIComponent(monster.image);
        image.alt = "";
        image.loading = "lazy";
        image.addEventListener("error", () => {
          image.remove();
          media.textContent = monster.name.charAt(0);
        });
        media.appendChild(image);
      } else {
        media.textContent = monster.name.charAt(0);
      }
      item.appendChild(media);

      const body = el("div", "min-w-0 flex-1");
      body.appendChild(el("p", "m-0 font-semibold", monster.name));
      if (monster.why) {
        body.appendChild(el("p", "m-0 text-sm text-slate-300", monster.why));
      }
      item.appendChild(body);

      const link = el("a", "flex-none rounded-full border border-slate-200/30 px-3 py-1 text-xs text-sky-200 no-underline hover:border-sky-300/70", "▶ Voir");
      link.href = data.video + "&t=" + monster.time + "s";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      item.appendChild(link);
      list.appendChild(item);
    });
    root.appendChild(list);

    const source = el("p", "mt-3 text-xs text-slate-400");
    source.append("Source: « Top 10 Domi Reversi en Songe » par " + data.author + " (");
    const videoLink = el("a", "text-sky-200 underline underline-offset-2", "YouTube");
    videoLink.href = data.video;
    videoLink.target = "_blank";
    videoLink.rel = "noopener noreferrer";
    source.append(videoLink, "), dans l'ordre de la vidéo.");
    root.appendChild(source);
  } catch (error) {
    root.textContent = "Impossible de charger le classement.";
    console.error("Erreur de chargement:", error.message);
  }
})();
