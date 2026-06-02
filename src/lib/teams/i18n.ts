/**
 * FIFA-code → display name in Spanish (es-AR).
 * Used in the front-end to show team names localized regardless of what
 * api-football returns. Falls back to whatever we have in the DB row.
 */
const SPANISH_BY_FIFA: Record<string, string> = {
  ALG: "Argelia",
  ARG: "Argentina",
  AUS: "Australia",
  AUT: "Austria",
  BEL: "Bélgica",
  BOS: "Bosnia y Herzegovina",
  BRA: "Brasil",
  CAN: "Canadá",
  CAP: "Cabo Verde",
  COL: "Colombia",
  CON: "RD del Congo",
  CRO: "Croacia",
  CUW: "Curazao",
  CZE: "República Checa",
  ECU: "Ecuador",
  EGY: "Egipto",
  ENG: "Inglaterra",
  FRA: "Francia",
  GER: "Alemania",
  GHA: "Ghana",
  HAI: "Haití",
  IRN: "Irán",
  IRQ: "Irak",
  IVO: "Costa de Marfil",
  JAP: "Japón",
  JOR: "Jordania",
  KOR: "Corea del Sur",
  MEX: "México",
  MOR: "Marruecos",
  NET: "Países Bajos",
  NOR: "Noruega",
  PAN: "Panamá",
  PAR: "Paraguay",
  POR: "Portugal",
  QAT: "Catar",
  SAU: "Arabia Saudita",
  SCO: "Escocia",
  SEN: "Senegal",
  SOU: "Sudáfrica",
  SPA: "España",
  SWE: "Suecia",
  SWI: "Suiza",
  TUN: "Túnez",
  TUR: "Turquía",
  URU: "Uruguay",
  USA: "Estados Unidos",
  UZB: "Uzbekistán",
  ZEA: "Nueva Zelanda",
};

export function teamName(fifa: string | null | undefined, fallback: string): string {
  if (!fifa) return fallback;
  return SPANISH_BY_FIFA[fifa.toUpperCase()] ?? fallback;
}
