import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server as SocketIO } from "socket.io";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import db from "./database.js";

import authRouter from "./routes/auth.js";
import departmentsRouter from "./routes/departments.js";
import chatRouter from "./routes/chat.js";
import artifactsRouter from "./routes/artifacts.js";
import filesRouter from "./routes/files.js";
import teamRouter from "./routes/team.js";
import crmRouter from "./routes/crm.js";
import adminRouter from "./routes/admin.js";
import integrationsRouter from "./routes/integrations.js";
import messengerRouter from "./routes/messenger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IS_PROD = process.env.NODE_ENV === "production";
const JWT_SECRET = process.env.JWT_SECRET || "aioffice-dev-secret";

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 8787;

if (!process.env.OPENROUTER_API_KEY) {
  console.warn("⚠️  OPENROUTER_API_KEY не задан — чат работать не будет");
}

// ── CORS ─────────────────────────────────────────────────────────────────────

app.use("/api/integrations/submit", cors({ origin: "*" }));
app.use("/api/integrations/widget.js", cors({ origin: "*" }));

const allowedOrigins = IS_PROD
  ? [
      "https://mindcod.ru",
      "https://www.mindcod.ru",
      process.env.FRONTEND_URL,
    ].filter(Boolean)
  : ["http://localhost:5173", "http://localhost:1420"];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin?.endsWith(".vercel.app")) {
      callback(null, true);
    } else callback(new Error("CORS not allowed"));
  },
  credentials: true,
};

app.use(cors(corsOptions));
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
app.use("/api/messenger", messengerRouter);

// ── Socket.IO ─────────────────────────────────────────────────────────────────

const io = new SocketIO(httpServer, {
  cors: corsOptions,
  path: "/socket.io",
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Нет токена"));
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    socket.user = payload;
    next();
  } catch {
    next(new Error("Недействительный токен"));
  }
});

io.on("connection", (socket) => {
  const { id: userId, companyId } = socket.user;

  // Подписываем на все комнаты пользователя
  const rooms = db.prepare(`
    SELECT room_id FROM msg_room_members WHERE user_id = ?
  `).all(userId);
  for (const { room_id } of rooms) {
    socket.join(`room:${room_id}`);
  }
  socket.join(`user:${userId}`);

  socket.on("join_room", (roomId) => {
    const member = db.prepare("SELECT 1 FROM msg_room_members WHERE room_id = ? AND user_id = ?").get(roomId, userId);
    if (member) socket.join(`room:${roomId}`);
  });

  socket.on("send_message", ({ roomId, content }) => {
    if (!content?.trim()) return;
    const room = db.prepare("SELECT * FROM msg_rooms WHERE id = ? AND company_id = ?").get(roomId, companyId);
    if (!room) return;
    const member = db.prepare("SELECT role FROM msg_room_members WHERE room_id = ? AND user_id = ?").get(roomId, userId);
    if (!member) return;
    if (room.type === "channel" && member.role !== "admin") return;

    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare("INSERT INTO msg_messages (id, room_id, user_id, content, type, created_at) VALUES (?,?,?,?,?,?)")
      .run(id, roomId, userId, content.trim(), "text", now);
    db.prepare("UPDATE msg_room_members SET last_read_at = ? WHERE room_id = ? AND user_id = ?")
      .run(now, roomId, userId);

    const message = db.prepare("SELECT m.*, u.name as user_name FROM msg_messages m JOIN users u ON u.id = m.user_id WHERE m.id = ?").get(id);
    io.to(`room:${roomId}`).emit("new_message", { roomId, message });
  });

  socket.on("typing", ({ roomId, isTyping }) => {
    const user = db.prepare("SELECT name FROM users WHERE id = ?").get(userId);
    socket.to(`room:${roomId}`).emit("user_typing", { roomId, userId, userName: user?.name, isTyping });
  });

  socket.on("mark_read", ({ roomId }) => {
    const now = new Date().toISOString();
    db.prepare("UPDATE msg_room_members SET last_read_at = ? WHERE room_id = ? AND user_id = ?").run(now, roomId, userId);
    socket.to(`room:${roomId}`).emit("room_read", { roomId, userId });
  });

  socket.on("disconnect", () => {
    // nothing to clean up
  });
});

// Экспортируем io для использования в маршрутах
export { io };

// ── Production: serve frontend static files ───────────────────────────────────
if (IS_PROD) {
  const distPath = path.join(__dirname, "..", "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

httpServer.listen(PORT, () => {
  console.log(`Backend started: http://localhost:${PORT} [${IS_PROD ? "production" : "dev"}]`);
});
