/** All 48 nations at FIFA World Cup 2026. */
export type Team = {
  accent: string;
  c1: string;
  c2: string;
  /** ISO 3166-1 alpha-2 (flagcdn.com; subnational where needed). */
  code: string;
  /** Local-language “let’s go [country]” line on the card. */
  cheer: string;
};

function team(
  cheer: string,
  code: string,
  c1: string,
  c2: string,
  accent: string
): Team {
  return { cheer, code, c1, c2, accent };
}

export const TEAMS: Record<string, Team> = {
  Algeria: team("Allez l'Algérie !", "dz", "#006233", "#ffffff", "#6cc24a"),
  Argentina: team("¡Vamos, Argentina!", "ar", "#75aadb", "#0f4c81", "#8fd0f0"),
  Australia: team("Come on, Australia!", "au", "#00843d", "#ffcd00", "#6bbf59"),
  Austria: team("Auf geht's, Österreich!", "at", "#ed2939", "#ffffff", "#ff6b6b"),
  Belgium: team("Allez les Diables Rouges !", "be", "#fdda24", "#ef3340", "#ffd166"),
  "Bosnia and Herzegovina": team("Ajmo Bosno!", "ba", "#002395", "#fecb00", "#5e8bff"),
  Brazil: team("Vamos, Brasil!", "br", "#ffdf00", "#009b3a", "#e8c84d"),
  "Cabo Verde": team("Vamos, Cabo Verde!", "cv", "#003893", "#ffffff", "#4cc9f0"),
  Canada: team("Go Canada!", "ca", "#d52b1e", "#2a2f36", "#ff4d4d"),
  Colombia: team("¡Vamos, Colombia!", "co", "#fcd116", "#003893", "#ffd166"),
  "Congo DR": team("Allez les Léopards !", "cd", "#007fff", "#f7d618", "#4cc9f0"),
  "Côte d'Ivoire": team("Allez les Éléphants !", "ci", "#ff8200", "#009639", "#ffb347"),
  Croatia: team("Ajmo, Hrvatska!", "hr", "#ff0000", "#171796", "#ff5f6d"),
  Curaçao: team("Guera Curaçao!", "cw", "#002b7f", "#f9e814", "#4cc9f0"),
  Czechia: team("Do toho, Česko!", "cz", "#11457e", "#d7141a", "#5e8bff"),
  Ecuador: team("¡Vamos, Ecuador!", "ec", "#ffdd00", "#034ea2", "#ffd166"),
  Egypt: team("Yalla Masr!", "eg", "#ce1126", "#ffffff", "#ff6b6b"),
  England: team("Come on, England!", "gb-eng", "#ffffff", "#ce1124", "#c9d2e6"),
  France: team("Allez la France !", "fr", "#0055a4", "#ef4135", "#6a8bff"),
  Germany: team("Auf geht's, Deutschland!", "de", "#ffffff", "#000000", "#c9d2e6"),
  Ghana: team("Go Black Stars!", "gh", "#006b3f", "#fcd116", "#6bbf59"),
  Haiti: team("Allez Haïti !", "ht", "#00209f", "#d21034", "#5e8bff"),
  "IR Iran": team("Be Iran!", "ir", "#239f40", "#ffffff", "#6bbf59"),
  Iraq: team("Yalla Iraq!", "iq", "#ce1126", "#ffffff", "#ff6b6b"),
  Japan: team("行こう、日本！", "jp", "#bc002d", "#ffffff", "#ff8aa3"),
  Jordan: team("Yalla Urdun!", "jo", "#007a3d", "#ffffff", "#6bbf59"),
  "Korea Republic": team("가자, 대한민국!", "kr", "#cd2e3a", "#0047a0", "#ff6b6b"),
  Mexico: team("¡Vamos, México!", "mx", "#006847", "#ce1126", "#1faf6a"),
  Morocco: team("Allez le Maroc !", "ma", "#c1272d", "#006233", "#ff6b6b"),
  Netherlands: team("Hup Holland!", "nl", "#ff7a1a", "#123a8f", "#ff7a1a"),
  "New Zealand": team("Come on, New Zealand!", "nz", "#000000", "#ffffff", "#c9d2e6"),
  Norway: team("Heia Norge!", "no", "#ba0c2f", "#00205b", "#ff6b6b"),
  Panama: team("¡Vamos, Panamá!", "pa", "#005293", "#d21034", "#4cc9f0"),
  Paraguay: team("¡Vamos, Paraguay!", "py", "#d52b1e", "#0038a8", "#ff6b6b"),
  Portugal: team("Vamos, Portugal!", "pt", "#006847", "#da291c", "#1faf6a"),
  Qatar: team("Hayya Qatar!", "qa", "#8a1538", "#ffffff", "#ff8aa3"),
  "Saudi Arabia": team("Yalla Saudi!", "sa", "#006c35", "#ffffff", "#6bbf59"),
  Scotland: team("Come on, Scotland!", "gb-sct", "#005eb8", "#ffffff", "#4cc9f0"),
  Senegal: team("Allez les Lions !", "sn", "#00853f", "#fdef00", "#6bbf59"),
  "South Africa": team("Ayoba Bafana!", "za", "#007749", "#ffb612", "#6bbf59"),
  Spain: team("¡Vamos, España!", "es", "#c60b1e", "#ffc400", "#d4af37"),
  Sweden: team("Heja Sverige!", "se", "#006aa7", "#fecc00", "#4cc9f0"),
  Switzerland: team("Hopp Schwiiz!", "ch", "#ff0000", "#ffffff", "#ff6b6b"),
  Tunisia: team("Yalla Tounes!", "tn", "#e70013", "#ffffff", "#ff6b6b"),
  Türkiye: team("Haydi Türkiye!", "tr", "#e30a17", "#ffffff", "#ff6b6b"),
  Uruguay: team("¡Vamos, Uruguay!", "uy", "#0038a8", "#ffffff", "#5e8bff"),
  USA: team("Let's go, USA!", "us", "#0a3161", "#b31942", "#c9d2e6"),
  Uzbekistan: team("Olga O'zbekiston!", "uz", "#1eb53a", "#0099b5", "#6bbf59"),
};
