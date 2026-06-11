import { TEAMS } from "./teams-data";

/** Self-hosted flag from /public/flags/{code}.png */
export function flagUrl(team: string): string | null {
  const code = TEAMS[team]?.code;
  if (!code) return null;
  return `/flags/${code}.png`;
}

export function flagUrlForCode(code: string): string {
  return `/flags/${code}.png`;
}
