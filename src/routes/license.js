import { Router } from "express";
import { checkLicense } from "./licenseCheck.js";

export const licenseRouter = Router();

/**
 * GET /license
 * headers: x-onlive-email, x-onlive-license-key
 * (usado pela extensão para revalidar silenciosamente a cada abertura)
 */
licenseRouter.get("/license", (req, res) => {
  const email = req.header("x-onlive-email");
  const licenseKey = req.header("x-onlive-license-key");

  // touch:false -> uma revalidação silenciosa não deve reescrever
  // ultimo_acesso a cada poucos segundos; ajuste se quiser esse tracking fino.
  const check = checkLicense(email, licenseKey, { touch: true });

  if (check.result !== "valid") {
    return res.status(200).json({ result: check.result, message: check.message });
  }

  return res.status(200).json({
    result: "valid",
    license: {
      email: check.row.email,
      plano: check.row.plano,
      status: check.row.status,
      dataCriacao: check.row.data_criacao,
      dataExpiracao: check.row.data_expiracao,
      ultimoAcesso: check.row.ultimo_acesso,
    },
  });
});
