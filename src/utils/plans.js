// Mapeia o identificador de plano (vindo do webhook da Cakto) para o
// nosso enum interno + duração em dias.
// Ajuste PLAN_ID_MAP para os IDs/nomes de oferta reais configurados
// na Cakto (produto -> plano).
export const PLAN_DAYS = {
  mensal: 30,
  trimestral: 90,
  anual: 365,
};

export const PLAN_ID_MAP = {
  // "offer_id_da_cakto": "mensal" | "trimestral" | "anual"
  onlive_mensal: "mensal",
  onlive_trimestral: "trimestral",
  onlive_anual: "anual",
};

export function resolvePlano(rawPlanoOuOferta) {
  if (!rawPlanoOuOferta) return null;
  const normalized = String(rawPlanoOuOferta).trim().toLowerCase();

  if (normalized in PLAN_DAYS) return normalized;
  if (normalized in PLAN_ID_MAP) return PLAN_ID_MAP[normalized];

  return null;
}

export function calcExpiracao(plano, from = new Date()) {
  const dias = PLAN_DAYS[plano];
  if (!dias) throw new Error(`Plano inválido: ${plano}`);

  const expira = new Date(from);
  expira.setUTCDate(expira.getUTCDate() + dias);
  return expira;
}
