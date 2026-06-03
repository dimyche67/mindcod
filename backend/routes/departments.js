import { Router } from "express";
import { randomUUID } from "crypto";
import db from "../database.js";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";
import { PLANS } from "../plans.js";

const router = Router();

function rowToDept(row) {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    description: row.description ?? "",
    icon: row.icon ?? "💬",
    systemPrompt: row.system_prompt ?? "",
    createdAt: row.created_at,
  };
}

// GET /api/departments
router.get("/", authMiddleware, (req, res) => {
  let rows;
  if (req.user.role === "admin") {
    rows = db.prepare("SELECT * FROM departments WHERE company_id = ?").all(req.user.companyId);
  } else {
    rows = db.prepare(`
      SELECT d.* FROM departments d
      INNER JOIN department_users du ON du.department_id = d.id
      WHERE d.company_id = ? AND du.user_id = ?
    `).all(req.user.companyId, req.user.id);
  }
  res.json({ ok: true, departments: rows.map(rowToDept) });
});

// GET /api/departments/:id
router.get("/:id", authMiddleware, (req, res) => {
  const row = db.prepare("SELECT * FROM departments WHERE id = ? AND company_id = ?").get(req.params.id, req.user.companyId);
  if (!row) return res.status(404).json({ ok: false, error: "Отдел не найден" });
  res.json({ ok: true, department: rowToDept(row) });
});

// POST /api/departments
router.post("/", authMiddleware, adminMiddleware, (req, res) => {
  const { name, description, icon, systemPrompt } = req.body ?? {};
  if (!name?.trim()) {
    return res.status(400).json({ ok: false, error: "Название обязательно" });
  }

  const company = db.prepare("SELECT * FROM companies WHERE id = ?").get(req.user.companyId);
  const plan = PLANS[company?.plan] ?? PLANS.business;
  const current = db.prepare("SELECT COUNT(*) as cnt FROM departments WHERE company_id = ?").get(req.user.companyId);

  if (current.cnt >= plan.maxDepartments) {
    return res.status(403).json({ ok: false, error: "Лимит отделов по тарифу исчерпан" });
  }

  const dept = {
    id: randomUUID(),
    company_id: req.user.companyId,
    name: name.trim(),
    description: description?.trim() ?? "",
    icon: icon ?? "💬",
    system_prompt: systemPrompt?.trim() || "Ты универсальный бизнес-ассистент. Отвечай на вопросы чётко и профессионально.",
    created_at: new Date().toISOString(),
  };
  db.prepare("INSERT INTO departments (id, company_id, name, description, icon, system_prompt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    dept.id, dept.company_id, dept.name, dept.description, dept.icon, dept.system_prompt, dept.created_at
  );
  res.status(201).json({ ok: true, department: rowToDept(dept) });
});

// PATCH /api/departments/:id
router.patch("/:id", authMiddleware, adminMiddleware, (req, res) => {
  const row = db.prepare("SELECT * FROM departments WHERE id = ? AND company_id = ?").get(req.params.id, req.user.companyId);
  if (!row) return res.status(404).json({ ok: false, error: "Отдел не найден" });

  const body = req.body ?? {};
  const { name, description, icon, systemPrompt } = body;
  const updated = {
    name: name?.trim() ?? row.name,
    description: description !== undefined ? (description?.trim() ?? "") : row.description,
    icon: icon ?? row.icon,
    // FIX 4: если ключ systemPrompt передан (даже пустой) — сохраняем как есть,
    // дефолт применяется только при отправке в OpenRouter, не в БД
    system_prompt: "systemPrompt" in body ? (systemPrompt?.trim() ?? "") : row.system_prompt,
  };

  db.prepare("UPDATE departments SET name = ?, description = ?, icon = ?, system_prompt = ? WHERE id = ?").run(
    updated.name, updated.description, updated.icon, updated.system_prompt, req.params.id
  );

  const newRow = db.prepare("SELECT * FROM departments WHERE id = ?").get(req.params.id);
  res.json({ ok: true, department: rowToDept(newRow) });
});

// DELETE /api/departments/:id
router.delete("/:id", authMiddleware, adminMiddleware, (req, res) => {
  const row = db.prepare("SELECT id FROM departments WHERE id = ? AND company_id = ?").get(req.params.id, req.user.companyId);
  if (!row) return res.status(404).json({ ok: false, error: "Отдел не найден" });
  db.prepare("DELETE FROM departments WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

export default router;
