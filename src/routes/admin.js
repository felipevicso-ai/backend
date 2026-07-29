import { Router } from "express";
import db from "../db/index.js";
import { generateUniqueLicenseKey } from "../utils/licenseKey.js";
import { PLAN_DAYS, calcExpiracao } from "../utils/plans.js";
import { adminAuth } from "./adminAuth.js";

export const adminRouter = Router();

adminRouter.use("/admin/api", adminAuth);

/**
 * GET /admin/api/licenses?search=termo&status=active
 * Lista licenças, com busca simples por e-mail ou chave.
 */
adminRouter.get("/admin/api/licenses", (req, res) => {
  const { search = "", status = "" } = req.query;

  let query = "SELECT * FROM licenses WHERE 1=1";
  const params = [];

  if (search) {
    query += " AND (email LIKE ? OR license_key LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  if (status) {
    query += " AND status = ?";
    params.push(status);
  }

  query += " ORDER BY created_at DESC LIMIT 500";

  const rows = db.prepare(query).all(...params);
  res.json({ ok: true, licenses: rows });
});

/**
 * POST /admin/api/licenses
 * body: { email, plano, dataExpiracao? }
 * Cria uma licença manualmente. Se dataExpiracao não vier, calcula
 * automaticamente a partir da duração padrão do plano.
 */
adminRouter.post("/admin/api/licenses", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const plano = String(req.body?.plano || "").trim().toLowerCase();
  const dataExpiracaoInput = req.body?.dataExpiracao;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, message: "E-mail inválido." });
  }

  if (!(plano in PLAN_DAYS)) {
    return res.status(400).json({ ok: false, message: "Plano inválido. Use mensal, trimestral ou anual." });
  }

  const agora = new Date();
  let expiracao;
  if (dataExpiracaoInput) {
    expiracao = new Date(dataExpiracaoInput);
    if (Number.isNaN(expiracao.getTime())) {
      return res.status(400).json({ ok: false, message: "Data de validade inválida." });
    }
  } else {
    expiracao = calcExpiracao(plano, agora);
  }

  const licenseKey = generateUniqueLicenseKey();

  db.prepare(
    `INSERT INTO licenses (email, license_key, plano, status, data_criacao, data_expiracao)
     VALUES (?, ?, ?, 'active', ?, ?)`
  ).run(email, licenseKey, plano, agora.toISOString(), expiracao.toISOString());

  const created = db.prepare("SELECT * FROM licenses WHERE license_key = ?").get(licenseKey);
  res.status(201).json({ ok: true, license: created });
});

/**
 * PATCH /admin/api/licenses/:id/deactivate
 * Marca a licença como cancelada (não exclui — mantém histórico).
 */
adminRouter.patch("/admin/api/licenses/:id/deactivate", (req, res) => {
  const { id } = req.params;
  const row = db.prepare("SELECT * FROM licenses WHERE id = ?").get(id);

  if (!row) return res.status(404).json({ ok: false, message: "Licença não encontrada." });

  db.prepare("UPDATE licenses SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(id);
  const updated = db.prepare("SELECT * FROM licenses WHERE id = ?").get(id);
  res.json({ ok: true, license: updated });
});

/**
 * PATCH /admin/api/licenses/:id/reactivate
 * Reativa uma licença cancelada (se ainda não estiver vencida).
 */
adminRouter.patch("/admin/api/licenses/:id/reactivate", (req, res) => {
  const { id } = req.params;
  const row = db.prepare("SELECT * FROM licenses WHERE id = ?").get(id);

  if (!row) return res.status(404).json({ ok: false, message: "Licença não encontrada." });

  const status = new Date() > new Date(row.data_expiracao) ? "expired" : "active";
  db.prepare("UPDATE licenses SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
  const updated = db.prepare("SELECT * FROM licenses WHERE id = ?").get(id);
  res.json({ ok: true, license: updated });
});

/**
 * DELETE /admin/api/licenses/:id
 * Exclusão definitiva do registro.
 */
adminRouter.delete("/admin/api/licenses/:id", (req, res) => {
  const { id } = req.params;
  const result = db.prepare("DELETE FROM licenses WHERE id = ?").run(id);

  if (result.changes === 0) {
    return res.status(404).json({ ok: false, message: "Licença não encontrada." });
  }

  res.json({ ok: true });
});
