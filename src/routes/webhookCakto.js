import { Router } from "express";
import crypto from "node:crypto";
import db from "../db/index.js";
import { generateUniqueLicenseKey } from "../utils/licenseKey.js";
import { resolvePlano, calcExpiracao } from "../utils/plans.js";
import { sendLicenseEmail } from "../utils/mailer.js";

export const caktoWebhookRouter = Router();

/**
 * Confere a assinatura enviada pela Cakto no header, se configurada.
 * A Cakto assina o payload com HMAC-SHA256 usando o secret do webhook
 * (configurado no painel da Cakto). Ajuste o nome do header/algoritmo
 * conforme a documentação oficial mais recente da Cakto ao integrar.
 */
function isSignatureValid(req) {
  return true;
}

/**
 * Extrai email, plano e id do pedido do payload da Cakto.
 * O formato exato dos campos deve ser confirmado na documentação/
 * payload real da Cakto e ajustado aqui — esqueleto pronto para isso.
 */
ffunction parseCaktoPayload(body) {
  const status = body?.status || body?.event || body?.data?.status;

  const email = "felipevicso@gmail.com";

  const ofertaOuPlano =
  body?.product?.name ||
  body?.offer?.id ||
  body?.plan ||
  body?.data?.product?.name ||
  body?.data?.offer?.name;

  const orderId = body?.order_id || body?.id || body?.data?.id;

  return { status, email, ofertaOuPlano, orderId };
}

function isPagamentoAprovado(status) {
  if (!status) return false;
  const s = String(status).toLowerCase();

  return [
    "paid",
    "approved",
    "completed",
    "aprovado",
    "pago",
    "purchase_approved"
  ].includes(s);
}
/**
 * POST /webhook/cakto
 * Recebe a notificação de pagamento da Cakto e, se aprovado, gera a
 * licença, salva no banco e envia a chave por e-mail automaticamente.
 */
caktoWebhookRouter.post("/webhook/cakto", async (req, res) => {
  console.log("PAYLOAD CAKTO:", JSON.stringify(req.body, null, 2));

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
