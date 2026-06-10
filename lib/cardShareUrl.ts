import type { CardStyle, Finish, Shine } from "./card";

export type SharePlatform = {
  id: string;
  label: string;
  href?: (url: string, text: string) => string;
  note?: string;
};

export type CardShareState = {
  name: string;
  team: string;
  cardStyle: CardStyle;
  shine: Shine;
  finish: Finish;
};

export function buildCardShareUrl(state: CardShareState, origin?: string) {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  const params = new URLSearchParams();
  if (state.name.trim()) params.set("name", state.name.trim());
  params.set("team", state.team);
  params.set("style", state.cardStyle);
  params.set("shine", state.shine);
  params.set("finish", state.finish);
  return `${base}/?${params.toString()}`;
}

export function buildShareCopy(state: CardShareState) {
  const who = state.name.trim() || "My";
  return `${who} World Cup 2026 holo card — create yours!`;
}
