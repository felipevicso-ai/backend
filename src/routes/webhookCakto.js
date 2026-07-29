import { Router } from "express";
import crypto from "node:crypto";
import db from "../db/index.js";
import { generateUniqueLicenseKey } from "../utils/licenseKey.js";
import { resolvePlano, calcExpiracao } from "../utils/plans.js";
import { sendLicenseEmail } from "../utils/mailer.js";
export const caktoWebhookRouter = Router();
/**
 * A Cakto autentica o webhook enviando um campo "secret" DENTRO do
 * próprio corpo da requisição (confirmado no payload real recebido),
 * não por assinatura HMAC em header. Comparação simples e direta.
 */
function isSignatureValid(req) {
  const expected = process.env.CAKTO_WEBHOOK_SECRET;
  if (!expected) return true; // sem secret configurado, pula checagem (defina em produção)
  return req.body?.secret === expected;
}
/**
 * Extrai email, plano e id do pedido do payload real da Cakto:
 * { data: { id, status, customer: {email}, offer: {id,name}, product: {name} }, event, secret }
 */
function parseCaktoPayload(body) {
  const data = body?.data || {};
  const status = data.status || body?.event;
  const email = data?.customer?.email;
  const orderId = data?.id;

  // IMPORTANTE: prioriza product.name porque é ele que diferencia
  // "Onlive - Mensal" / "Onlive - Trimestral" / "Onlive - Anual".
  // O offer.name muitas vezes vem só "Onlive" (sem o plano) e, se
  // colocado antes, faz o resolvePlano cair em null → 400 no webhook.
  const ofertaOuPlano =
    data?.product?.name ||
    data?.offer?.name ||
    data?.offer?.id ||
    data?.product?.id ||
    "";

  return { status, email, ofertaOuPlano, orderId };
}
function isPagamentoAprovado(status) {
  if (!status) return false;
  const s = String(status).toLowerCase();
  return ["paid", "approved", "completed", "aprovado", "pago", "purchase_approved"].includes(s);
}
/**
 * POST /webhook/cakto
 * Recebe a notificação de pagamento da Cakto e, se aprovado, gera a
 * licença, salva no banco e envia a chave por e-mail automaticamente.
 */
caktoWebhookRouter.post("/webhook/cakto", async (req, res) => {
  if (!isSignatureValid(req)) {
    return res.status(401).json({ ok: false, message: "Assinatura inválida." });
  }
  const { status, email, ofertaOuPlano, orderId } = parseCaktoPayload(req.body);
  if (!isPagamentoAprovado(status)) {
    // Outros eventos (recusado, estornado, etc.) apenas confirmamos o
    // recebimento sem gerar licença. Trate 'refunded'/'chargeback' aqui
    // se quiser cancelar licenças automaticamente.
    return res.status(200).json({ ok: true, ignored: true, status });
  }
  const plano = resolvePlano(ofertaOuPlano);
  const normEmail = String(email || "").trim().toLowerCase();
  if (!plano || !normEmail) {
    console.error("[webhook/cakto] Payload incompleto/plano não reconhecido:", req.body);
    return res.status(400).json({ ok: false, message: "Payload incompleto ou plano não reconhecido." });
  }
  const agora = new Date();
  const expiracao = calcExpiracao(plano, agora);
  const licenseKey = generateUniqueLicenseKey();
  db.prepare(
    `INSERT INTO licenses (email, license_key, plano, status, data_criacao, data_expiracao, cakto_order_id)
     VALUES (?, ?, ?, 'active', ?, ?, ?)`
  ).run(normEmail, licenseKey, plano, agora.toISOString(), expiracao.toISOString(), orderId ? String(orderId) : null);
  try {
    await sendLicenseEmail({
      to: normEmail,
      licenseKey,
      plano,
      dataExpiracao: expiracao.toISOString(),
    });
  } catch (err) {
    // Licença já foi criada; erro de e-mail não deve derrubar o webhook.
    // Log para reenvio manual se necessário.
    console.error("[webhook/cakto] Falha ao enviar e-mail:", err);
  }
  return res.status(200).json({ ok: true, licenseKey, plano, dataExpiracao: expiracao.toISOString() });
});
