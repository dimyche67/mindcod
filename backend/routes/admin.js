import { Router } from "express";
import db from "../database.js";
import { authMiddleware } from "../middleware/auth.js";
import { superadminMiddleware } from "../middleware/auth.js";

const router = Router();
router.use(authMiddleware, superadminMiddleware);

// GET /api/admin/companies
router.get("/companies", (req, res) => {
  const companies = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id) as user_count,
      (SELECT email FROM users u WHERE u.company_id = c.id AND u.role = 'admin' LIMIT 1) as owner_email
    FROM companies c ORDER BY c.created_at DESC
  `).all();
  res.json({ ok: true, companies });
});

// PATCH /api/admin/companies/:id
router.patch("/companies/:id", (req, res) => {
  const company = db.prepare("SELECT id FROM companies WHERE id = ?").get(req.params.id);
  if (!company) return res.status(404).json({ ok: false, error: "Компания не найдена" });

  const { plan, status } = req.body ?? {};
  const VALID_PLANS = ["starter", "business", "enterprise"];
  const VALID_STATUSES = ["pending", "active", "blocked"];

  if (plan && !VALID_PLANS.includes(plan)) return res.status(400).json({ ok: false, error: "Неверный тариф" });
  if (status && !VALID_STATUSES.includes(status)) return res.status(400).json({ ok: false, error: "Неверный статус" });

  db.prepare("UPDATE companies SET plan = COALESCE(?, plan), status = COALESCE(?, status) WHERE id = ?")
    .run(plan ?? null, status ?? null, req.params.id);

  const updated = db.prepare("SELECT * FROM companies WHERE id = ?").get(req.params.id);
  res.json({ ok: true, company: updated });
});

// GET /api/admin/stats
router.get("/stats", (req, res) => {
  const total = db.prepare("SELECT COUNT(*) as n FROM companies").get().n;
  const active = db.prepare("SELECT COUNT(*) as n FROM companies WHERE status = 'active'").get().n;
  const blocked = db.prepare("SELECT COUNT(*) as n FROM companies WHERE status = 'blocked'").get().n;
  const pending = db.prepare("SELECT COUNT(*) as n FROM companies WHERE status = 'pending'").get().n;
  const users = db.prepare("SELECT COUNT(*) as n FROM users WHERE is_superadmin = 0").get().n;
  const chats = db.prepare("SELECT COUNT(*) as n FROM chats").get().n;
  const leads = db.prepare("SELECT COUNT(*) as n FROM crm_leads").get().n;
  res.json({ ok: true, stats: { total, active, blocked, pending, users, chats, leads } });
});

export default router;
