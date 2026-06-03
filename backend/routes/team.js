import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import db from "../database.js";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";

const router = Router();

function safeUser(u) {
  const deptRows = db.prepare("SELECT department_id FROM department_users WHERE user_id = ?").all(u.id);
  return {
    id: u.id,
    email: u.email,
    name: u.name ?? u.email.split("@")[0],
    role: u.role,
    departmentIds: deptRows.map((r) => r.department_id),
  };
}

// GET /api/team
router.get("/", authMiddleware, adminMiddleware, (req, res) => {
  const users = db.prepare("SELECT * FROM users WHERE company_id = ?").all(req.user.companyId);
  res.json({ ok: true, users: users.map(safeUser) });
});

// POST /api/team/invite
router.post("/invite", authMiddleware, adminMiddleware, async (req, res) => {
  const { name, email, password, departmentIds } = req.body ?? {};
  if (!email?.trim() || !password?.trim()) {
    return res.status(400).json({ ok: false, error: "Email и пароль обязательны" });
  }
  if (password.length < 6) {
    return res.status(400).json({ ok: false, error: "Пароль минимум 6 символов" });
  }

  const existing = db.prepare("SELECT id, company_id FROM users WHERE email = ?").get(email.toLowerCase().trim());
  if (existing) {
    const msg = existing.company_id === req.user.companyId
      ? "Сотрудник с таким email уже добавлен в вашу компанию"
      : "Этот email уже зарегистрирован в другой компании";
    return res.status(409).json({ ok: false, error: msg });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = randomUUID();
  const now = new Date().toISOString();

  db.prepare("INSERT INTO users (id, company_id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    userId, req.user.companyId, email.toLowerCase().trim(), passwordHash, name?.trim() || email.split("@")[0], "employee", now
  );

  const insertDU = db.prepare("INSERT OR IGNORE INTO department_users (department_id, user_id) VALUES (?, ?)");
  if (Array.isArray(departmentIds)) {
    for (const dId of departmentIds) insertDU.run(dId, userId);
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  res.status(201).json({ ok: true, user: safeUser(user) });
});

// PATCH /api/team/:userId/departments
router.patch("/:userId/departments", authMiddleware, adminMiddleware, (req, res) => {
  const { departmentIds } = req.body ?? {};
  const target = db.prepare("SELECT id FROM users WHERE id = ? AND company_id = ?").get(req.params.userId, req.user.companyId);
  if (!target) return res.status(404).json({ ok: false, error: "Пользователь не найден" });

  db.prepare("DELETE FROM department_users WHERE user_id = ?").run(req.params.userId);
  const insert = db.prepare("INSERT OR IGNORE INTO department_users (department_id, user_id) VALUES (?, ?)");
  if (Array.isArray(departmentIds)) {
    for (const dId of departmentIds) insert.run(dId, req.params.userId);
  }

  res.json({ ok: true });
});

// DELETE /api/team/:userId
router.delete("/:userId", authMiddleware, adminMiddleware, (req, res) => {
  if (req.params.userId === req.user.id) {
    return res.status(400).json({ ok: false, error: "Нельзя удалить себя" });
  }
  const target = db.prepare("SELECT id FROM users WHERE id = ? AND company_id = ?").get(req.params.userId, req.user.companyId);
  if (!target) return res.status(404).json({ ok: false, error: "Пользователь не найден" });

  db.prepare("DELETE FROM department_users WHERE user_id = ?").run(req.params.userId);
  db.prepare("DELETE FROM users WHERE id = ?").run(req.params.userId);
  res.json({ ok: true });
});

export default router;
