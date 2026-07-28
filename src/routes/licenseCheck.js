import db from "../db/index.js";

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function normalizeKey(key) {
  return String(key || "").trim().toUpperCase();
}

/**
 * Busca + valida uma licença por email/chave, atualizando status
 * expirado e ultimo_acesso quando aplicável.
 * Retorna { result: "valid"|"invalid"|"expired", row? }
 */
export function checkLicense(email, licenseKey, { touch = true } = {}) {
  const normEmail = normalizeEmail(email);
  const normKey = normalizeKey(licenseKey);

  if (!normEmail || !normKey) {
    return { result: "invalid", message: "E-mail e chave são obrigatórios." };
  }

  const row = db
    .prepare("SELECT * FROM licenses WHERE email = ? AND license_key = ?")
    .get(normEmail, normKey);

  if (!row) {
    return { result: "invalid", message: "E-mail ou chave inválidos." };
  }

  const venceu = new Date() > new Date(row.data_expiracao);
  if (venceu && row.status === "active") {
    db.prepare("UPDATE licenses SET status = 'expired', updated_at = datetime('now') WHERE id = ?").run(row.id);
    row.status = "expired";
  }

  if (row.status !== "active") {
    return {
      result: row.status === "cancelled" ? "invalid" : "expired",
      message: row.status === "cancelled" ? "Licença cancelada." : "Assinatura expirada.",
      row,
    };
  }

  if (touch) {
    db.prepare("UPDATE licenses SET ultimo_acesso = datetime('now') WHERE id = ?").run(row.id);
  }

  return { result: "valid", row };
}
