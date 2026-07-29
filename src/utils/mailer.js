import nodemailer from "nodemailer";

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

function buildHtml({ licenseKey, plano, dataExpiracao }) {
  const planoLabel = { mensal: "Mensal", trimestral: "Trimestral", anual: "Anual" }[plano] || plano;
  const expiraFormatada = new Date(dataExpiracao).toLocaleDateString("pt-BR");

  return `
    <div style="background:#08090b;padding:32px;font-family:Inter,-apple-system,sans-serif;color:#f5f7fa;">
      <div style="max-width:480px;margin:0 auto;background:#131519;border:1px solid #1e2126;border-radius:18px;padding:32px;">
        <h1 style="color:#39ff8a;font-size:20px;margin:0 0 16px;">Sua assinatura Onlive está ativa</h1>
        <p style="color:#8b909c;font-size:14px;line-height:1.6;">Obrigado por assinar o plano <strong style="color:#f5f7fa;">${planoLabel}</strong>. Use os dados abaixo para ativar a extensão:</p>
        <div style="background:#101216;border:1px solid #1e2126;border-radius:12px;padding:16px;margin:20px 0;">
          <p style="margin:0 0 6px;color:#5b606b;font-size:12px;">CHAVE DE ACESSO</p>
          <p style="margin:0;color:#39ff8a;font-size:18px;letter-spacing:1px;font-weight:600;">${licenseKey}</p>
        </div>
        <p style="color:#8b909c;font-size:13px;">Válida até <strong style="color:#f5f7fa;">${expiraFormatada}</strong>.</p>
        <p style="color:#5b606b;font-size:12px;margin-top:24px;">Abra a extensão Onlive, informe seu e-mail e essa chave na tela de ativação.</p>
      </div>
    </div>
  `;
}

/**
 * Envia via API HTTP da Brevo (porta 443/HTTPS) em vez de SMTP.
 * Preferido em PaaS (Railway, Render, etc.) porque portas de SMTP
 * (587/465/25) costumam ser bloqueadas na saída, enquanto HTTPS nunca é.
 */
async function sendViaBrevoApi({ to, licenseKey, plano, dataExpiracao }) {
  const from = process.env.MAIL_FROM || "Onlive <no-reply@onlive.app>";
  const fromMatch = from.match(/^(.*)<(.+)>$/);
  const fromName = fromMatch ? fromMatch[1].trim() : "Onlive";
  const fromEmail = fromMatch ? fromMatch[2].trim() : from;

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "api-key": process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { name: fromName, email: fromEmail },
      to: [{ email: to }],
      subject: "Sua chave de acesso Onlive",
      htmlContent: buildHtml({ licenseKey, plano, dataExpiracao }),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Brevo API respondeu ${res.status}: ${body}`);
  }

  return res.json();
}

export async function sendLicenseEmail({ to, licenseKey, plano, dataExpiracao }) {
  if (process.env.BREVO_API_KEY) {
    return sendViaBrevoApi({ to, licenseKey, plano, dataExpiracao });
  }

  if (!process.env.SMTP_HOST) {
    console.warn("[mailer] Nem BREVO_API_KEY nem SMTP_HOST configurados; e-mail não enviado.", { to, licenseKey });
    return { skipped: true };
  }

  // Fallback: SMTP tradicional (só chega aqui se BREVO_API_KEY não estiver definida).
  const from = process.env.MAIL_FROM || "Onlive <no-reply@onlive.app>";
  return getTransporter().sendMail({
    from,
    to,
    subject: "Sua chave de acesso Onlive",
    html: buildHtml({ licenseKey, plano, dataExpiracao }),
  });
}
