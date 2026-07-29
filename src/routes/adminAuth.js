/**
 * adminAuth.js
 * Proteção simples por token compartilhado (ADMIN_TOKEN no .env).
 * Não existe sistema de usuários/login no projeto ainda — para uma
 * página interna de uso da equipe, um token fixo enviado via header
 * é suficiente. Se no futuro isso for exposto a mais gente, trocar
 * por login de verdade (ex: sessão + senha por admin).
 */
export function adminAuth(req, res, next) {
  const expected = process.env.ADMIN_TOKEN;

  if (!expected) {
    return res.status(500).json({ ok: false, message: "ADMIN_TOKEN não configurado no backend." });
  }

  const token = req.header("x-admin-token");
  if (token !== expected) {
    return res.status(401).json({ ok: false, message: "Token de administrador inválido." });
  }

  next();
}
