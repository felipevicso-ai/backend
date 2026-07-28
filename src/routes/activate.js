import { Router } from "express";
import { checkLicense } from "./licenseCheck.js";

export const activateRouter = Router();

/**
 * POST /activate
 * body: { email, licenseKey }
 * resposta: { result: "valid" | "invalid" | "expired", license?, message? }
 */
activateRouter.post("/activate", (req, res) => {
  const { email, licenseKey } = req.body || {};
  const check = checkLicense(email, licenseKey);

  if (check.result !== "valid") {
    return res.status(200).json({ result: check.result, message: check.message });
  }

  return res.status(200).json({
    result: "valid",
    license: {
      email: check.row.email,
      plano: check.row.plano,
      dataExpiracao: check.row.data_expiracao,
    },
  });
});
