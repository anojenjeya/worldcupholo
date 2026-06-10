/** FIFA World Cup 2026 group-stage draw (48 teams, 12 groups). */
export const WORLD_CUP_GROUPS: { id: string; label: string; teams: string[] }[] = [
  { id: "A", label: "Group A", teams: ["Mexico", "South Africa", "Korea Republic", "Czechia"] },
  {
    id: "B",
    label: "Group B",
    teams: ["Canada", "Bosnia and Herzegovina", "Qatar", "Switzerland"],
  },
  { id: "C", label: "Group C", teams: ["Brazil", "Morocco", "Haiti", "Scotland"] },
  { id: "D", label: "Group D", teams: ["USA", "Paraguay", "Australia", "Türkiye"] },
  {
    id: "E",
    label: "Group E",
    teams: ["Germany", "Curaçao", "Côte d'Ivoire", "Ecuador"],
  },
  { id: "F", label: "Group F", teams: ["Netherlands", "Japan", "Sweden", "Tunisia"] },
  { id: "G", label: "Group G", teams: ["Belgium", "Egypt", "IR Iran", "New Zealand"] },
  { id: "H", label: "Group H", teams: ["Spain", "Cabo Verde", "Saudi Arabia", "Uruguay"] },
  { id: "I", label: "Group I", teams: ["France", "Senegal", "Iraq", "Norway"] },
  { id: "J", label: "Group J", teams: ["Argentina", "Algeria", "Austria", "Jordan"] },
  {
    id: "K",
    label: "Group K",
    teams: ["Portugal", "Congo DR", "Uzbekistan", "Colombia"],
  },
  { id: "L", label: "Group L", teams: ["England", "Croatia", "Ghana", "Panama"] },
];

/** Flat list of all teams in group order (A → L). */
export const TEAM_NAMES = WORLD_CUP_GROUPS.flatMap((g) => g.teams);

export function groupForTeam(team: string) {
  return WORLD_CUP_GROUPS.find((g) => g.teams.includes(team));
}

/** FIFA confederation for each qualified nation. */
export type TeamRegion = "UEFA" | "CONMEBOL" | "CONCACAF" | "AFC" | "CAF" | "OFC";

export const TEAM_REGIONS: Record<string, TeamRegion> = {
  Algeria: "CAF",
  Argentina: "CONMEBOL",
  Australia: "AFC",
  Austria: "UEFA",
  Belgium: "UEFA",
  "Bosnia and Herzegovina": "UEFA",
  Brazil: "CONMEBOL",
  "Cabo Verde": "CAF",
  Canada: "CONCACAF",
  Colombia: "CONMEBOL",
  "Congo DR": "CAF",
  "Côte d'Ivoire": "CAF",
  Croatia: "UEFA",
  Curaçao: "CONCACAF",
  Czechia: "UEFA",
  Ecuador: "CONMEBOL",
  Egypt: "CAF",
  England: "UEFA",
  France: "UEFA",
  Germany: "UEFA",
  Ghana: "CAF",
  Haiti: "CONCACAF",
  "IR Iran": "AFC",
  Iraq: "AFC",
  Japan: "AFC",
  Jordan: "AFC",
  "Korea Republic": "AFC",
  Mexico: "CONCACAF",
  Morocco: "CAF",
  Netherlands: "UEFA",
  "New Zealand": "OFC",
  Norway: "UEFA",
  Panama: "CONCACAF",
  Paraguay: "CONMEBOL",
  Portugal: "UEFA",
  Qatar: "AFC",
  "Saudi Arabia": "AFC",
  Scotland: "UEFA",
  Senegal: "CAF",
  "South Africa": "CAF",
  Spain: "UEFA",
  Sweden: "UEFA",
  Switzerland: "UEFA",
  Tunisia: "CAF",
  Türkiye: "UEFA",
  Uruguay: "CONMEBOL",
  USA: "CONCACAF",
  Uzbekistan: "AFC",
};

export const REGION_LABELS: Record<TeamRegion, string> = {
  UEFA: "Europe",
  CONMEBOL: "South America",
  CONCACAF: "North & Central America",
  AFC: "Asia",
  CAF: "Africa",
  OFC: "Oceania",
};

export const REGION_ORDER: TeamRegion[] = [
  "UEFA",
  "CONMEBOL",
  "CONCACAF",
  "AFC",
  "CAF",
  "OFC",
];

