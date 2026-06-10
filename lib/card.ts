// Deterministic stat / rarity logic.
// Ported verbatim from reference/holo-card.html — do not "improve" the math,
// the outputs are intentionally stable for a given (name, position).

export type StatKey = "PAC" | "SHO" | "PAS" | "DRI" | "DEF" | "PHY";
export type Stats = Record<StatKey, number>;

export type { Team } from "./teams-data";
export { TEAMS } from "./teams-data";
export {
  WORLD_CUP_GROUPS,
  TEAM_NAMES,
  groupForTeam,
} from "./world-cup-groups";
export { crestUrl } from "./team-crests";
export {
  SHINE_TUNING,
  FINISH_TUNING,
  buildShineFinishVars,
  pointerGlow,
  idleGlow,
} from "./shine-finish";

export type CardStyle = "prizm" | "optic" | "mosaic" | "galaxy";

export const STYLES: { id: CardStyle; name: string; blurb: string }[] = [
  { id: "prizm", name: "Prizm", blurb: "Cracked ice" },
  { id: "optic", name: "Optic", blurb: "Starburst" },
  { id: "mosaic", name: "Mosaic", blurb: "Honeycomb" },
  { id: "galaxy", name: "Galaxy", blurb: "Rainbow holo" },
];

export type Shine = "rainbow" | "diamond" | "sapphire" | "emerald" | "ruby";

export type Finish = "gloss" | "matte";

export const FINISHES: { id: Finish; name: string }[] = [
  { id: "gloss", name: "gloss" },
  { id: "matte", name: "matte" },
];

/** Hover/tilt foil color. `swatch` is a CSS background used in the picker chip. */
export const SHINES: { id: Shine; name: string; swatch: string }[] = [
  {
    id: "rainbow",
    name: "rainbow",
    swatch:
      "conic-gradient(from 0deg, #ff5f6d, #ffd166, #06d6a0, #4cc9f0, #b15bff, #ff5f6d)",
  },
  { id: "diamond", name: "diamond", swatch: "linear-gradient(135deg,#ffffff,#cdd6e6)" },
  { id: "sapphire", name: "sapphire", swatch: "linear-gradient(135deg,#bfefff,#3aa6ff)" },
  { id: "emerald", name: "emerald", swatch: "linear-gradient(135deg,#7dffc4,#0f9d6a)" },
  { id: "ruby", name: "ruby", swatch: "linear-gradient(135deg,#ff8aa3,#e01040)" },
];

export const POSITIONS: Record<
  string,
  { pac: number; sho: number; pas: number; dri: number; def: number; phy: number }
> = {
  ST: { pac: 1, sho: 1.15, pas: 0.85, dri: 1, def: 0.5, phy: 1 },
  CAM: { pac: 0.95, sho: 0.95, pas: 1.15, dri: 1.15, def: 0.6, phy: 0.85 },
  CM: { pac: 0.9, sho: 0.85, pas: 1.15, dri: 1, def: 0.95, phy: 1 },
  CB: { pac: 0.85, sho: 0.5, pas: 0.8, dri: 0.75, def: 1.2, phy: 1.2 },
  GK: { pac: 0.7, sho: 0.4, pas: 0.8, dri: 0.6, def: 1.1, phy: 1 },
};

export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rand(seed: number) {
  let x = seed;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

export function buildStats(name: string, pos: string): { s: Stats; ovr: number } {
  const r = rand(hash(name + pos)),
    w = POSITIONS[pos],
    base = () => 68 + Math.floor(r() * 28),
    c = (v: number) => Math.max(58, Math.min(99, Math.round(v)));
  const s: Stats = {
    PAC: c(base() * w.pac),
    SHO: c(base() * w.sho),
    PAS: c(base() * w.pas),
    DRI: c(base() * w.dri),
    DEF: c(base() * w.def),
    PHY: c(base() * w.phy),
  };
  return { s, ovr: c((s.PAC + s.SHO + s.PAS + s.DRI + s.DEF + s.PHY) / 6 + 4) };
}

export function rarity(ovr: number, name: string) {
  if (hash(name) % 17 === 0) return "Prismatic";
  if (ovr >= 90) return "Icon";
  if (ovr >= 85) return "Gold";
  return "Holo";
}
