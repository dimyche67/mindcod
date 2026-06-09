import { Router } from "express";
import { randomUUID } from "crypto";
import db from "../database.js";
import { authMiddleware } from "../middleware/auth.js";
import multer from "multer";

const router = Router();
const upload = multer({ limits: { fileSize: 20 * 1024 * 1024 } });

router.use(authMiddleware);

// Получить все комнаты пользователя
router.get("/rooms", (req, res) => {
  const { id: userId, companyId } = req.user;
  const rooms = db.prepare(`
    SELECT r.*,
      (SELECT COUNT(*) FROM msg_messages m
       WHERE m.room_id = r.id AND m.deleted = 0
         AND m.created_at > COALESCE(
           (SELECT last_read_at FROM msg_room_members WHERE room_id = r.id AND user_id = ?), '1970-01-01'
         )
      ) as unread_count,
      (SELECT m2.content FROM msg_messages m2 WHERE m2.room_id = r.id AND m2.deleted = 0 ORDER BY m2.created_at DESC LIMIT 1) as last_message,
      (SELECT m2.created_at FROM msg_messages m2 WHERE m2.room_id = r.id AND m2.deleted = 0 ORDER BY m2.created_at DESC LIMIT 1) as last_message_at,
      (SELECT m2.user_id FROM msg_messages m2 WHERE m2.room_id = r.id AND m2.deleted = 0 ORDER BY m2.created_at DESC LIMIT 1) as last_message_user_id
    FROM msg_rooms r
    JOIN msg_room_members rm ON rm.room_id = r.id
    WHERE rm.user_id = ? AND r.company_id = ?
    ORDER BY COALESCE(last_message_at, r.created_at) DESC
  `).all(userId, userId, companyId);

  // Для direct-чатов подставим имя собеседника
  const enriched = rooms.map(room => {
    if (room.type === "direct") {
      const other = db.prepare(`
        SELECT u.id, u.name FROM msg_room_members rm
        JOIN users u ON u.id = rm.user_id
        WHERE rm.room_id = ? AND rm.user_id != ?
      `).get(room.id, userId);
      return { ...room, otherUser: other ?? null };
    }
    // Для группы/канала — список участников
    const members = db.prepare(`
      SELECT u.id, u.name, rm.role FROM msg_room_members rm
      JOIN users u ON u.id = rm.user_id
      WHERE rm.room_id = ?
    `).all(room.id);
    return { ...room, members };
  });

  res.json({ ok: true, rooms: enriched });
});

// Создать группу или канал
router.post("/rooms", (req, res) => {
  const { id: userId, companyId } = req.user;
  const { type, name, description, memberIds = [] } = req.body;
  if (!["group", "channel"].includes(type)) return res.status(400).json({ ok: false, error: "Неверный тип" });
  if (!name?.trim()) return res.status(400).json({ ok: false, error: "Нужно название" });

  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO msg_rooms (id, company_id, type, name, description, created_by, created_at) VALUES (?,?,?,?,?,?,?)")
    .run(id, companyId, type, name.trim(), description ?? null, userId, now);

  const allMembers = [...new Set([userId, ...memberIds])];
  const insertMember = db.prepare("INSERT OR IGNORE INTO msg_room_members (room_id, user_id, role, joined_at) VALUES (?,?,?,?)");
  for (const uid of allMembers) {
    insertMember.run(id, uid, uid === userId ? "admin" : "member", now);
  }

  const room = db.prepare("SELECT * FROM msg_rooms WHERE id = ?").get(id);
  res.json({ ok: true, room });
});

// Получить или создать direct-чат
router.post("/rooms/direct", (req, res) => {
  const { id: userId, companyId } = req.user;
  const { targetUserId } = req.body;
  if (!targetUserId) return res.status(400).json({ ok: false, error: "targetUserId обязателен" });

  // Проверяем что target в той же компании
  const target = db.prepare("SELECT id, name FROM users WHERE id = ? AND company_id = ?").get(targetUserId, companyId);
  if (!target) return res.status(404).json({ ok: false, error: "Пользователь не найден" });

  // Ищем существующий direct
  const existing = db.prepare(`
    SELECT r.id FROM msg_rooms r
    JOIN msg_room_members a ON a.room_id = r.id AND a.user_id = ?
    JOIN msg_room_members b ON b.room_id = r.id AND b.user_id = ?
    WHERE r.type = 'direct' AND r.company_id = ?
    LIMIT 1
  `).get(userId, targetUserId, companyId);

  if (existing) return res.json({ ok: true, roomId: existing.id });

  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO msg_rooms (id, company_id, type, name, created_by, created_at) VALUES (?,?,?,?,?,?)")
    .run(id, companyId, "direct", null, userId, now);
  db.prepare("INSERT INTO msg_room_members (room_id, user_id, role, joined_at) VALUES (?,?,?,?)").run(id, userId, "member", now);
  db.prepare("INSERT INTO msg_room_members (room_id, user_id, role, joined_at) VALUES (?,?,?,?)").run(id, targetUserId, "member", now);

  res.json({ ok: true, roomId: id });
});

// Добавить участников в группу
router.post("/rooms/:id/members", (req, res) => {
  const { id: userId, companyId } = req.user;
  const room = db.prepare("SELECT * FROM msg_rooms WHERE id = ? AND company_id = ?").get(req.params.id, companyId);
  if (!room) return res.status(404).json({ ok: false, error: "Комната не найдена" });

  const myRole = db.prepare("SELECT role FROM msg_room_members WHERE room_id = ? AND user_id = ?").get(room.id, userId);
  if (!myRole || myRole.role !== "admin") return res.status(403).json({ ok: false, error: "Только администратор может добавлять участников" });

  const { memberIds = [] } = req.body;
  const now = new Date().toISOString();
  const insert = db.prepare("INSERT OR IGNORE INTO msg_room_members (room_id, user_id, role, joined_at) VALUES (?,?,?,?)");
  for (const uid of memberIds) insert.run(room.id, uid, "member", now);

  res.json({ ok: true });
});

// Сообщения комнаты
router.get("/rooms/:id/messages", (req, res) => {
  const { id: userId, companyId } = req.user;
  const room = db.prepare("SELECT * FROM msg_rooms WHERE id = ? AND company_id = ?").get(req.params.id, companyId);
  if (!room) return res.status(404).json({ ok: false, error: "Комната не найдена" });

  const member = db.prepare("SELECT 1 FROM msg_room_members WHERE room_id = ? AND user_id = ?").get(room.id, userId);
  if (!member) return res.status(403).json({ ok: false, error: "Нет доступа" });

  const before = req.query.before;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);

  const messages = before
    ? db.prepare(`SELECT m.*, u.name as user_name FROM msg_messages m JOIN users u ON u.id = m.user_id WHERE m.room_id = ? AND m.deleted = 0 AND m.created_at < ? ORDER BY m.created_at DESC LIMIT ?`).all(room.id, before, limit)
    : db.prepare(`SELECT m.*, u.name as user_name FROM msg_messages m JOIN users u ON u.id = m.user_id WHERE m.room_id = ? AND m.deleted = 0 ORDER BY m.created_at DESC LIMIT ?`).all(room.id, limit);

  // Отметить как прочитанное
  db.prepare("UPDATE msg_room_members SET last_read_at = ? WHERE room_id = ? AND user_id = ?")
    .run(new Date().toISOString(), room.id, userId);

  res.json({ ok: true, messages: messages.reverse() });
});

// Отправить сообщение (текст)
router.post("/rooms/:id/messages", (req, res) => {
  const { id: userId, companyId } = req.user;
  const room = db.prepare("SELECT * FROM msg_rooms WHERE id = ? AND company_id = ?").get(req.params.id, companyId);
  if (!room) return res.status(404).json({ ok: false, error: "Комната не найдена" });

  const member = db.prepare("SELECT 1 FROM msg_room_members WHERE room_id = ? AND user_id = ?").get(room.id, userId);
  if (!member) return res.status(403).json({ ok: false, error: "Нет доступа" });

  if (room.type === "channel") {
    const myRole = db.prepare("SELECT role FROM msg_room_members WHERE room_id = ? AND user_id = ?").get(room.id, userId);
    if (myRole?.role !== "admin") return res.status(403).json({ ok: false, error: "В канал могут писать только администраторы" });
  }

  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ ok: false, error: "Сообщение пустое" });

  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO msg_messages (id, room_id, user_id, content, type, created_at) VALUES (?,?,?,?,?,?)")
    .run(id, room.id, userId, content.trim(), "text", now);

  db.prepare("UPDATE msg_room_members SET last_read_at = ? WHERE room_id = ? AND user_id = ?")
    .run(now, room.id, userId);

  const message = db.prepare("SELECT m.*, u.name as user_name FROM msg_messages m JOIN users u ON u.id = m.user_id WHERE m.id = ?").get(id);
  res.json({ ok: true, message });
});

// Загрузить файл/картинку
router.post("/rooms/:id/upload", upload.single("file"), (req, res) => {
  const { id: userId, companyId } = req.user;
  const room = db.prepare("SELECT * FROM msg_rooms WHERE id = ? AND company_id = ?").get(req.params.id, companyId);
  if (!room) return res.status(404).json({ ok: false, error: "Комната не найдена" });

  const member = db.prepare("SELECT 1 FROM msg_room_members WHERE room_id = ? AND user_id = ?").get(room.id, userId);
  if (!member) return res.status(403).json({ ok: false, error: "Нет доступа" });

  if (!req.file) return res.status(400).json({ ok: false, error: "Файл не передан" });

  const isImage = req.file.mimetype.startsWith("image/");
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO msg_messages (id, room_id, user_id, content, type, file_name, file_size, file_mime, file_data, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run(id, room.id, userId, req.file.originalname, isImage ? "image" : "file",
      req.file.originalname, req.file.size, req.file.mimetype,
      req.file.buffer.toString("base64"), now);

  db.prepare("UPDATE msg_room_members SET last_read_at = ? WHERE room_id = ? AND user_id = ?")
    .run(now, room.id, userId);

  const message = db.prepare("SELECT m.*, u.name as user_name FROM msg_messages m JOIN users u ON u.id = m.user_id WHERE m.id = ?").get(id);
  res.json({ ok: true, message });
});

// Скачать файл
router.get("/messages/:id/file", (req, res) => {
  const { id: userId, companyId } = req.user;
  const msg = db.prepare("SELECT * FROM msg_messages WHERE id = ?").get(req.params.id);
  if (!msg) return res.status(404).json({ ok: false, error: "Не найдено" });

  const room = db.prepare("SELECT * FROM msg_rooms WHERE id = ? AND company_id = ?").get(msg.room_id, companyId);
  if (!room) return res.status(403).json({ ok: false, error: "Нет доступа" });

  const member = db.prepare("SELECT 1 FROM msg_room_members WHERE room_id = ? AND user_id = ?").get(msg.room_id, userId);
  if (!member) return res.status(403).json({ ok: false, error: "Нет доступа" });

  const buf = Buffer.from(msg.file_data, "base64");
  res.set("Content-Type", msg.file_mime);
  res.set("Content-Disposition", `inline; filename="${encodeURIComponent(msg.file_name)}"`);
  res.send(buf);
});

// Удалить сообщение
router.delete("/messages/:id", (req, res) => {
  const { userId } = req.user;
  const msg = db.prepare("SELECT * FROM msg_messages WHERE id = ?").get(req.params.id);
  if (!msg) return res.status(404).json({ ok: false, error: "Не найдено" });
  if (msg.user_id !== userId) return res.status(403).json({ ok: false, error: "Нельзя удалить чужое сообщение" });

  db.prepare("UPDATE msg_messages SET deleted = 1 WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// Список пользователей компании (для нового чата)
router.get("/users", (req, res) => {
  const { id: userId, companyId } = req.user;
  const users = db.prepare("SELECT id, name, email FROM users WHERE company_id = ? AND id != ? ORDER BY name").all(companyId, userId);
  res.json({ ok: true, users });
});

export default router;
