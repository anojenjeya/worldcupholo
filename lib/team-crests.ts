import { TEAMS } from "./teams-data";

/** Local FA crest from /public/crests/{code}.png */
export function crestUrl(team: string): string | null {
  const code = TEAMS[team]?.code;
  if (!code) return null;
  return `/crests/${code}.png`;
}
