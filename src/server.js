import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { activateRouter } from "./routes/activate.js";
import { licenseRouter } from "./routes/license.js";
import { caktoWebhookRouter } from "./routes/webhookCakto.js";
import { adminRouter } from "./routes/admin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Guarda o corpo cru para a checagem de assinatura HMAC do webhook.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(
  cors({
    origin: true, // extensão Chrome envia origin "chrome-extension://..."; landing page também pode chamar /activate
  })
);

// Limita força-bruta de tentativas de ativação/consulta de licença.
const limiter = rateLimit({ windowMs: 60_000, max: 30 });
app.use(["/activate", "/license"], limiter);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use(activateRouter);
app.use(licenseRouter);
app.use(caktoWebhookRouter);
app.use(adminRouter);

// Página administrativa (HTML/JS estático) — protegida pelo próprio
// token exigido nas rotas /admin/api/* consumidas por ela via fetch.
app.use("/admin", express.static(path.join(__dirname, "..", "public", "admin")));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ ok: false, message: "Erro interno." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Onlive licensing backend rodando na porta ${PORT}`);
});
