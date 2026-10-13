// Mise à l'échelle Songes: stats d'un monstre à un niveau choisi (mêmes formules que tools/build-spells.js)
export const DEFAULT_LEVEL = 225;
export const MIN_LEVEL = 1;
export const MAX_LEVEL = 600;

const ELEMENT_STAT = { Terre: "strength", Neutre: "strength", Feu: "intelligence", Eau: "chance", Air: "agility" };

export function clampLevel(value) {
  const level = Math.round(Number(value));
  return Number.isFinite(level) ? Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, level)) : DEFAULT_LEVEL;
}

// Copie de l'entrée de data/spells.json recalculée au niveau demandé (le niveau réel du monstre reste un plancher)
export function scaleEntry(entry, level) {
  const base = entry?.stats;
  if (!base?.ratios || level === base.level) {
    return entry;
  }
  const effective = Math.max(level, base.floor || 0);
  if (effective === base.level) {
    return entry;
  }
  const stat = (ratio) => Math.floor((ratio || 0) * Math.pow(effective, 1.26) + 7);
  const stats = {
    ...base,
    level: effective,
    life: Math.max(1, Number(Math.floor((base.ratios.life || 0) * Math.pow(effective, 1.625)).toPrecision(2))),
    strength: stat(base.ratios.strength),
    intelligence: stat(base.ratios.intelligence),
    chance: stat(base.ratios.chance),
    agility: stat(base.ratios.agility),
    power: stat(base.ratios.power),
  };
  const rescale = (effects) => (effects || []).map((effect) => {
    if (!effect.est) {
      return effect;
    }
    const value = stats[effect.kind === "heal" ? "intelligence" : ELEMENT_STAT[effect.element]] || 0;
    return {
      ...effect,
      est: [Math.floor((effect.min * (100 + value)) / 100), Math.floor((effect.max * (100 + value)) / 100)],
    };
  });
  return {
    ...entry,
    stats,
    spells: entry.spells.map((spell) => ({ ...spell, effects: rescale(spell.effects), critEffects: rescale(spell.critEffects) })),
  };
}
