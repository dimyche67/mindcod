import { Router } from "express";
import { randomUUID } from "crypto";
import db from "../database.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

// GET /api/artifacts/:departmentId
router.get("/:departmentId", authMiddleware, (req, res) => {
  const dept = db.prepare("SELECT id FROM departments WHERE id = ? AND company_id = ?").get(req.params.departmentId, req.user.companyId);
  if (!dept) return res.status(404).json({ ok: false, error: "Отдел не найден" });

  const rows = db.prepare("SELECT * FROM artifacts WHERE department_id = ? ORDER BY created_at DESC").all(req.params.departmentId);
  const artifacts = rows.map((r) => ({
    id: r.id,
    departmentId: r.department_id,
    userId: r.created_by,
    title: r.title,
    content: r.content,
    createdAt: r.created_at,
  }));
  res.json({ ok: true, artifacts });
});

// POST /api/artifacts
router.post("/", authMiddleware, (req, res) => {
  const { departmentId, content, title } = req.body ?? {};
  if (!departmentId || !content?.trim()) {
    return res.status(400).json({ ok: false, error: "departmentId и content обязательны" });
  }

  const id = randomUUID();
  const artTitle = title?.trim() || `Артефакт от ${new Date().toLocaleDateString("ru-RU")}`;
  const now = new Date().toISOString();

  db.prepare("INSERT INTO artifacts (id, department_id, company_id, title, content, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    id, departmentId, req.user.companyId, artTitle, content.trim(), req.user.id, now
  );

  res.status(201).json({ ok: true, artifact: { id, departmentId, userId: req.user.id, title: artTitle, content: content.trim(), createdAt: now } });
});

// DELETE /api/artifacts/:id
router.delete("/:id", authMiddleware, (req, res) => {
  const row = db.prepare("SELECT id FROM artifacts WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ ok: false, error: "Не найден" });
  db.prepare("DELETE FROM artifacts WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

export default router;
