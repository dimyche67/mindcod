import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import authRouter from "./routes/auth.js";
import departmentsRouter from "./routes/departments.js";
import chatRouter from "./routes/chat.js";
import artifactsRouter from "./routes/artifacts.js";
import filesRouter from "./routes/files.js";
import teamRouter from "./routes/team.js";
import crmRouter from "./routes/crm.js";
import adminRouter from "./routes/admin.js";
import integrationsRouter from "./routes/integrations.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IS_PROD = process.env.NODE_ENV === "production";

const app = express();
const PORT = process.env.PORT || 8787;

if (!process.env.OPENROUTER_API_KEY) {
  console.warn("⚠️  OPENROUTER_API_KEY не задан — чат работать не будет");
}

// ── CORS ─────────────────────────────────────────────────────────────────────

// Public submit + widget: allow all origins (external sites)
app.use("/api/integrations/submit", cors({ origin: "*" }));
app.use("/api/integrations/widget.js", cors({ origin: "*" }));

// App routes: restrict to known origins
const allowedOrigins = IS_PROD
  ? [
      "https://mindcod.ru",
      "https://www.mindcod.ru",
      // Vercel preview URLs (*.vercel.app)
      process.env.FRONTEND_URL, // задаётся в Railway env
    ].filter(Boolean)
  : ["http://localhost:5173", "http://localhost:1420"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Разрешаем vercel.app поддомены
      if (!origin || allowedOrigins.includes(origin) || origin?.endsWith(".vercel.app")) {
        callback(null, true);
      } else callback(new Error("CORS not allowed"));
    },
  })
);

app.use(express.json({ limit: "10mb" }));

app.get("/", (_req, res) => res.json({ ok: true, message: "AI Office backend is running" }));
app.get("/health", (_req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

app.use("/api/auth", authRouter);
app.use("/api/departments", departmentsRouter);
app.use("/api/chat", chatRouter);
app.use("/api/artifacts", artifactsRouter);
app.use("/api/files", filesRouter);
app.use("/api/team", teamRouter);
app.use("/api/crm", crmRouter);
app.use("/api/admin", adminRouter);
app.use("/api/integrations", integrationsRouter);

// ── Production: serve frontend static files ───────────────────────────────────
if (IS_PROD) {
  const distPath = path.join(__dirname, "..", "dist");
  app.use(express.static(distPath));
  // SPA fallback — все не-API пути → index.html
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Backend started: http://localhost:${PORT} [${IS_PROD ? "production" : "dev"}]`);
});
