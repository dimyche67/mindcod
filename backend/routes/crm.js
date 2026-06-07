import { Router } from "express";
import { randomUUID } from "crypto";
import db from "../database.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

const DEFAULT_STATUSES = ["new", "calculating", "in_progress", "rejected"];
const STATUS_LABELS = { new: "Новая заявка", calculating: "В расчете", in_progress: "В работе", rejected: "Не интересно" };

function now() { return new Date().toISOString(); }

function addHistory(leadId, userId, userName, action, details = null) {
  db.prepare(
    "INSERT INTO crm_history (id, lead_id, user_id, user_name, action, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(randomUUID(), leadId, userId ?? null, userName ?? null, action, details, now());
}

function parseLead(row) {
  if (!row) return null;
  return { ...row, custom_fields: row.custom_fields ? JSON.parse(row.custom_fields) : {} };
}

function attachTags(leads, companyId) {
  if (!leads.length) return leads;
  const leadIds = leads.map((l) => l.id);
  const placeholders = leadIds.map(() => "?").join(",");
  const rows = db.prepare(
    `SELECT lt.lead_id, t.id, t.name, t.color
     FROM crm_lead_tags lt JOIN crm_tags t ON t.id = lt.tag_id
     WHERE lt.lead_id IN (${placeholders})`
  ).all(...leadIds);
  const byLead = {};
  for (const r of rows) {
    if (!byLead[r.lead_id]) byLead[r.lead_id] = [];
    byLead[r.lead_id].push({ id: r.id, name: r.name, color: r.color });
  }
  return leads.map((l) => ({ ...l, tags: byLead[l.id] ?? [] }));
}

function attachAssignee(leads) {
  if (!leads.length) return leads;
  const userIds = [...new Set(leads.map((l) => l.assigned_to).filter(Boolean))];
  if (!userIds.length) return leads.map((l) => ({ ...l, assignee_name: null }));
  const placeholders = userIds.map(() => "?").join(",");
  const users = db.prepare(`SELECT id, name FROM users WHERE id IN (${placeholders})`).all(...userIds);
  const byId = Object.fromEntries(users.map((u) => [u.id, u.name]));
  return leads.map((l) => ({ ...l, assignee_name: l.assigned_to ? (byId[l.assigned_to] ?? null) : null }));
}

function getValidStatuses(companyId) {
  const custom = db.prepare("SELECT id FROM crm_columns WHERE company_id = ?").all(companyId).map((r) => r.id);
  return [...DEFAULT_STATUSES, ...custom];
}

// ── Public webhook ────────────────────────────────────────────────────────────
router.post("/webhook/:companyId", (req, res) => {
  const { companyId } = req.params;
  const company = db.prepare("SELECT id FROM companies WHERE id = ?").get(companyId);
  if (!company) return res.status(404).json({ ok: false, error: "Компания не найдена" });

  const { name, phone, email, source, ...rest } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ ok: false, error: "Поле name обязательно" });

  const id = randomUUID();
  const ts = now();
  const cf = Object.keys(rest).length ? JSON.stringify(rest) : "{}";

  db.prepare(
    "INSERT INTO crm_leads (id, company_id, status, name, phone, email, source, custom_fields, created_at, updated_at) VALUES (?, ?, 'new', ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, companyId, name.trim(), phone ?? null, email ?? null, source ?? "website", cf, ts, ts);
  addHistory(id, null, "Сайт", "Создана заявка", `Источник: ${source ?? "website"}`);

  const lead = parseLead(db.prepare("SELECT * FROM crm_leads WHERE id = ?").get(id));
  res.status(201).json({ ok: true, lead });
});

// ── Auth required ─────────────────────────────────────────────────────────────
router.use(authMiddleware);

// GET /api/crm/leads
router.get("/leads", (req, res) => {
  const { status, search, assigned, source, date_from, date_to } = req.query;
  let sql = "SELECT * FROM crm_leads WHERE company_id = ?";
  const params = [req.user.companyId];

  if (status) { sql += " AND status = ?"; params.push(status); }
  if (search?.trim()) {
    sql += " AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)";
    const q = `%${search.trim()}%`;
    params.push(q, q, q);
  }
  if (assigned) { sql += " AND assigned_to = ?"; params.push(assigned); }
  if (source) { sql += " AND source = ?"; params.push(source); }
  if (date_from) { sql += " AND created_at >= ?"; params.push(date_from); }
  if (date_to) { sql += " AND created_at <= ?"; params.push(date_to + "T23:59:59"); }

  sql += " ORDER BY created_at DESC";
  let leads = db.prepare(sql).all(...params).map(parseLead);
  leads = attachTags(leads, req.user.companyId);
  leads = attachAssignee(leads);
  res.json({ ok: true, leads });
});

// POST /api/crm/leads
router.post("/leads", (req, res) => {
  const { name, phone, email, source, custom_fields, force } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ ok: false, error: "Имя обязательно" });

  // Duplicate check by phone
  if (phone?.trim() && !force) {
    const dup = db.prepare("SELECT id, name FROM crm_leads WHERE company_id = ? AND phone = ?").get(req.user.companyId, phone.trim());
    if (dup) return res.status(200).json({ ok: false, duplicate: true, existing: dup });
  }

  const id = randomUUID();
  const ts = now();
  const cf = custom_fields && typeof custom_fields === "object" ? JSON.stringify(custom_fields) : "{}";

  db.prepare(
    "INSERT INTO crm_leads (id, company_id, status, name, phone, email, source, custom_fields, created_by, created_at, updated_at) VALUES (?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, req.user.companyId, name.trim(), phone ?? null, email ?? null, source ?? "manual", cf, req.user.userId, ts, ts);
  addHistory(id, req.user.userId, req.user.name, "Создана заявка", "Добавлена вручную");

  let lead = parseLead(db.prepare("SELECT * FROM crm_leads WHERE id = ?").get(id));
  lead = attachTags([lead], req.user.companyId)[0];
  lead = attachAssignee([lead])[0];
  res.status(201).json({ ok: true, lead });
});

// GET /api/crm/leads/:id
router.get("/leads/:id", (req, res) => {
  const lead = parseLead(
    db.prepare("SELECT * FROM crm_leads WHERE id = ? AND company_id = ?").get(req.params.id, req.user.companyId)
  );
  if (!lead) return res.status(404).json({ ok: false, error: "Заявка не найдена" });

  const withTags = attachTags([lead], req.user.companyId)[0];
  const withAssignee = attachAssignee([withTags])[0];

  const comments = db.prepare("SELECT * FROM crm_comments WHERE lead_id = ? ORDER BY created_at ASC").all(req.params.id);
  const tasks = db.prepare("SELECT * FROM crm_tasks WHERE lead_id = ? ORDER BY created_at ASC").all(req.params.id);
  const history = db.prepare("SELECT * FROM crm_history WHERE lead_id = ? ORDER BY created_at DESC").all(req.params.id);
  const files = db.prepare("SELECT id, name, size, mime_type, uploader_name, created_at FROM crm_lead_files WHERE lead_id = ? ORDER BY created_at DESC").all(req.params.id);

  res.json({ ok: true, lead: withAssignee, comments, tasks, history, files });
});

// PATCH /api/crm/leads/:id
router.patch("/leads/:id", (req, res) => {
  const lead = db.prepare("SELECT * FROM crm_leads WHERE id = ? AND company_id = ?").get(req.params.id, req.user.companyId);
  if (!lead) return res.status(404).json({ ok: false, error: "Заявка не найдена" });

  const { name, phone, email, source, custom_fields, assigned_to, status, profit } = req.body ?? {};
  const validStatuses = getValidStatuses(req.user.companyId);
  const changes = [];

  if (status !== undefined) {
    if (!validStatuses.includes(status)) return res.status(400).json({ ok: false, error: "Неверный статус" });
    if (status !== lead.status) changes.push(`Статус: ${STATUS_LABELS[lead.status] ?? lead.status} → ${STATUS_LABELS[status] ?? status}`);
  }
  if (name !== undefined && name.trim() !== lead.name) changes.push(`Имя: ${lead.name} → ${name.trim()}`);
  if (phone !== undefined && phone !== lead.phone) changes.push("Телефон изменён");
  if (email !== undefined && email !== lead.email) changes.push("Email изменён");
  if (assigned_to !== undefined && assigned_to !== lead.assigned_to) {
    const u = assigned_to ? db.prepare("SELECT name FROM users WHERE id = ?").get(assigned_to) : null;
    changes.push(`Ответственный: ${u?.name ?? "—"}`);
  }
  if (profit !== undefined) changes.push(`Прибыль: ${profit != null ? Number(profit).toLocaleString("ru-RU") + " ₽" : "—"}`);

  // Create notification when lead is assigned
  if (assigned_to !== undefined && assigned_to && assigned_to !== lead.assigned_to) {
    const notifId = randomUUID();
    db.prepare(
      "INSERT INTO crm_notifications (id, company_id, user_id, type, lead_id, lead_name, message, read, created_at) VALUES (?, ?, ?, 'assigned', ?, ?, ?, 0, ?)"
    ).run(notifId, req.user.companyId, assigned_to, req.params.id, lead.name, `Вам назначена заявка: ${lead.name}`, now());
  }

  const cf = custom_fields && typeof custom_fields === "object" ? JSON.stringify(custom_fields) : lead.custom_fields;
  const profitVal = profit !== undefined ? (profit != null ? parseFloat(profit) : null) : undefined;

  db.prepare(`UPDATE crm_leads SET
    name = COALESCE(?, name), phone = COALESCE(?, phone), email = COALESCE(?, email),
    source = COALESCE(?, source), custom_fields = ?,
    assigned_to = ${assigned_to !== undefined ? "?" : "assigned_to"},
    status = COALESCE(?, status),
    profit = ${profit !== undefined ? "?" : "profit"},
    updated_at = ? WHERE id = ?`)
    .run(
      name?.trim() ?? null, phone ?? null, email ?? null, source ?? null, cf,
      ...(assigned_to !== undefined ? [assigned_to ?? null] : []),
      status ?? null,
      ...(profit !== undefined ? [profitVal] : []),
      now(), req.params.id
    );

  if (changes.length) addHistory(req.params.id, req.user.userId, req.user.name, "Обновлена заявка", changes.join("; "));

  let updated = parseLead(db.prepare("SELECT * FROM crm_leads WHERE id = ?").get(req.params.id));
  updated = attachTags([updated], req.user.companyId)[0];
  updated = attachAssignee([updated])[0];
  res.json({ ok: true, lead: updated });
});

// DELETE /api/crm/leads/:id
router.delete("/leads/:id", (req, res) => {
  const lead = db.prepare("SELECT id FROM crm_leads WHERE id = ? AND company_id = ?").get(req.params.id, req.user.companyId);
  if (!lead) return res.status(404).json({ ok: false, error: "Заявка не найдена" });
  db.prepare("DELETE FROM crm_lead_tags WHERE lead_id = ?").run(req.params.id);
  db.prepare("DELETE FROM crm_comments WHERE lead_id = ?").run(req.params.id);
  db.prepare("DELETE FROM crm_tasks WHERE lead_id = ?").run(req.params.id);
  db.prepare("DELETE FROM crm_history WHERE lead_id = ?").run(req.params.id);
  db.prepare("DELETE FROM crm_leads WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ── Comments ──────────────────────────────────────────────────────────────────
router.post("/leads/:id/comments", (req, res) => {
  const lead = db.prepare("SELECT id FROM crm_leads WHERE id = ? AND company_id = ?").get(req.params.id, req.user.companyId);
  if (!lead) return res.status(404).json({ ok: false, error: "Заявка не найдена" });
  const { text } = req.body ?? {};
  if (!text?.trim()) return res.status(400).json({ ok: false, error: "Текст комментария обязателен" });
  const id = randomUUID();
  db.prepare("INSERT INTO crm_comments (id, lead_id, user_id, user_name, text, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, req.params.id, req.user.userId, req.user.name, text.trim(), now());
  addHistory(req.params.id, req.user.userId, req.user.name, "Добавлен комментарий");
  res.status(201).json({ ok: true, comment: db.prepare("SELECT * FROM crm_comments WHERE id = ?").get(id) });
});

router.delete("/leads/:id/comments/:commentId", (req, res) => {
  const c = db.prepare("SELECT c.id FROM crm_comments c JOIN crm_leads l ON l.id = c.lead_id WHERE c.id = ? AND l.company_id = ?")
    .get(req.params.commentId, req.user.companyId);
  if (!c) return res.status(404).json({ ok: false, error: "Комментарий не найден" });
  db.prepare("DELETE FROM crm_comments WHERE id = ?").run(req.params.commentId);
  res.json({ ok: true });
});

// ── Tasks ─────────────────────────────────────────────────────────────────────
router.post("/leads/:id/tasks", (req, res) => {
  const lead = db.prepare("SELECT id FROM crm_leads WHERE id = ? AND company_id = ?").get(req.params.id, req.user.companyId);
  if (!lead) return res.status(404).json({ ok: false, error: "Заявка не найдена" });
  const { title, due_date, priority } = req.body ?? {};
  if (!title?.trim()) return res.status(400).json({ ok: false, error: "Название задачи обязательно" });
  const id = randomUUID();
  db.prepare("INSERT INTO crm_tasks (id, lead_id, title, done, due_date, priority, created_by, created_at) VALUES (?, ?, ?, 0, ?, ?, ?, ?)")
    .run(id, req.params.id, title.trim(), due_date ?? null, priority ?? "normal", req.user.userId, now());
  addHistory(req.params.id, req.user.userId, req.user.name, "Добавлена задача", title.trim());
  res.status(201).json({ ok: true, task: db.prepare("SELECT * FROM crm_tasks WHERE id = ?").get(id) });
});

router.patch("/leads/:id/tasks/:taskId", (req, res) => {
  const task = db.prepare("SELECT t.* FROM crm_tasks t JOIN crm_leads l ON l.id = t.lead_id WHERE t.id = ? AND l.company_id = ?")
    .get(req.params.taskId, req.user.companyId);
  if (!task) return res.status(404).json({ ok: false, error: "Задача не найдена" });
  const { title, done, due_date, priority } = req.body ?? {};
  db.prepare("UPDATE crm_tasks SET title = COALESCE(?, title), done = COALESCE(?, done), due_date = COALESCE(?, due_date), priority = COALESCE(?, priority) WHERE id = ?")
    .run(title?.trim() ?? null, done !== undefined ? (done ? 1 : 0) : null, due_date !== undefined ? (due_date ?? null) : null, priority ?? null, req.params.taskId);
  if (done !== undefined) addHistory(req.params.id, req.user.userId, req.user.name, done ? "Задача выполнена" : "Задача возобновлена", task.title);
  res.json({ ok: true, task: db.prepare("SELECT * FROM crm_tasks WHERE id = ?").get(req.params.taskId) });
});

router.delete("/leads/:id/tasks/:taskId", (req, res) => {
  const t = db.prepare("SELECT t.id FROM crm_tasks t JOIN crm_leads l ON l.id = t.lead_id WHERE t.id = ? AND l.company_id = ?")
    .get(req.params.taskId, req.user.companyId);
  if (!t) return res.status(404).json({ ok: false, error: "Задача не найдена" });
  db.prepare("DELETE FROM crm_tasks WHERE id = ?").run(req.params.taskId);
  res.json({ ok: true });
});

// ── Tags ──────────────────────────────────────────────────────────────────────
router.get("/tags", (req, res) => {
  const tags = db.prepare("SELECT * FROM crm_tags WHERE company_id = ? ORDER BY name ASC").all(req.user.companyId);
  res.json({ ok: true, tags });
});

router.post("/tags", (req, res) => {
  const { name, color } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ ok: false, error: "Название обязательно" });
  const id = randomUUID();
  db.prepare("INSERT INTO crm_tags (id, company_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(id, req.user.companyId, name.trim(), color ?? "#6366F1", now());
  res.status(201).json({ ok: true, tag: db.prepare("SELECT * FROM crm_tags WHERE id = ?").get(id) });
});

router.patch("/tags/:id", (req, res) => {
  const tag = db.prepare("SELECT id FROM crm_tags WHERE id = ? AND company_id = ?").get(req.params.id, req.user.companyId);
  if (!tag) return res.status(404).json({ ok: false, error: "Тег не найден" });
  const { name, color } = req.body ?? {};
  db.prepare("UPDATE crm_tags SET name = COALESCE(?, name), color = COALESCE(?, color) WHERE id = ?")
    .run(name?.trim() ?? null, color ?? null, req.params.id);
  res.json({ ok: true, tag: db.prepare("SELECT * FROM crm_tags WHERE id = ?").get(req.params.id) });
});

router.delete("/tags/:id", (req, res) => {
  const tag = db.prepare("SELECT id FROM crm_tags WHERE id = ? AND company_id = ?").get(req.params.id, req.user.companyId);
  if (!tag) return res.status(404).json({ ok: false, error: "Тег не найден" });
  db.prepare("DELETE FROM crm_lead_tags WHERE tag_id = ?").run(req.params.id);
  db.prepare("DELETE FROM crm_tags WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

router.post("/leads/:id/tags/:tagId", (req, res) => {
  const lead = db.prepare("SELECT id FROM crm_leads WHERE id = ? AND company_id = ?").get(req.params.id, req.user.companyId);
  if (!lead) return res.status(404).json({ ok: false, error: "Заявка не найдена" });
  const tag = db.prepare("SELECT id FROM crm_tags WHERE id = ? AND company_id = ?").get(req.params.tagId, req.user.companyId);
  if (!tag) return res.status(404).json({ ok: false, error: "Тег не найден" });
  try {
    db.prepare("INSERT INTO crm_lead_tags (lead_id, tag_id) VALUES (?, ?)").run(req.params.id, req.params.tagId);
  } catch { /* already exists */ }
  res.json({ ok: true });
});

router.delete("/leads/:id/tags/:tagId", (req, res) => {
  db.prepare("DELETE FROM crm_lead_tags WHERE lead_id = ? AND tag_id = ?").run(req.params.id, req.params.tagId);
  res.json({ ok: true });
});

// ── Custom Columns ────────────────────────────────────────────────────────────
router.get("/columns", (req, res) => {
  const cols = db.prepare("SELECT * FROM crm_columns WHERE company_id = ? ORDER BY position ASC").all(req.user.companyId);
  res.json({ ok: true, columns: cols });
});

router.post("/columns", (req, res) => {
  const { name, color } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ ok: false, error: "Название обязательно" });
  const maxPos = db.prepare("SELECT MAX(position) as m FROM crm_columns WHERE company_id = ?").get(req.user.companyId);
  const id = randomUUID();
  db.prepare("INSERT INTO crm_columns (id, company_id, name, color, position, is_default) VALUES (?, ?, ?, ?, ?, 0)")
    .run(id, req.user.companyId, name.trim(), color ?? "#6366F1", (maxPos?.m ?? 0) + 1);
  res.status(201).json({ ok: true, column: db.prepare("SELECT * FROM crm_columns WHERE id = ?").get(id) });
});

router.delete("/columns/:id", (req, res) => {
  const col = db.prepare("SELECT id FROM crm_columns WHERE id = ? AND company_id = ?").get(req.params.id, req.user.companyId);
  if (!col) return res.status(404).json({ ok: false, error: "Колонка не найдена" });
  db.prepare("DELETE FROM crm_columns WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ── Custom Fields ─────────────────────────────────────────────────────────────
router.get("/fields", (req, res) => {
  const fields = db.prepare("SELECT * FROM crm_fields WHERE company_id = ? ORDER BY position ASC").all(req.user.companyId);
  res.json({ ok: true, fields });
});

router.post("/fields", (req, res) => {
  const { name, field_type } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ ok: false, error: "Название обязательно" });
  const VALID_TYPES = ["text", "number", "date", "select"];
  if (field_type && !VALID_TYPES.includes(field_type)) return res.status(400).json({ ok: false, error: "Неверный тип поля" });
  const maxPos = db.prepare("SELECT MAX(position) as m FROM crm_fields WHERE company_id = ?").get(req.user.companyId);
  const id = randomUUID();
  db.prepare("INSERT INTO crm_fields (id, company_id, name, field_type, position) VALUES (?, ?, ?, ?, ?)")
    .run(id, req.user.companyId, name.trim(), field_type ?? "text", (maxPos?.m ?? 0) + 1);
  res.status(201).json({ ok: true, field: db.prepare("SELECT * FROM crm_fields WHERE id = ?").get(id) });
});

router.delete("/fields/:id", (req, res) => {
  const f = db.prepare("SELECT id FROM crm_fields WHERE id = ? AND company_id = ?").get(req.params.id, req.user.companyId);
  if (!f) return res.status(404).json({ ok: false, error: "Поле не найдено" });
  db.prepare("DELETE FROM crm_fields WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ── Sources ───────────────────────────────────────────────────────────────────
const DEFAULT_SOURCES = [
  { id: "manual",  name: "Вручную", is_default: 1 },
  { id: "website", name: "Сайт",    is_default: 1 },
  { id: "other",   name: "Другое",  is_default: 1 },
];

router.get("/sources", (req, res) => {
  const custom = db.prepare("SELECT * FROM crm_sources WHERE company_id = ? ORDER BY position ASC").all(req.user.companyId);
  res.json({ ok: true, sources: [...DEFAULT_SOURCES, ...custom] });
});

router.post("/sources", (req, res) => {
  const { name } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ ok: false, error: "Название обязательно" });
  const maxPos = db.prepare("SELECT MAX(position) as m FROM crm_sources WHERE company_id = ?").get(req.user.companyId);
  const id = randomUUID();
  db.prepare("INSERT INTO crm_sources (id, company_id, name, is_default, position, created_at) VALUES (?, ?, ?, 0, ?, ?)")
    .run(id, req.user.companyId, name.trim(), (maxPos?.m ?? 0) + 1, now());
  res.status(201).json({ ok: true, source: db.prepare("SELECT * FROM crm_sources WHERE id = ?").get(id) });
});

router.patch("/sources/:id", (req, res) => {
  const src = db.prepare("SELECT id FROM crm_sources WHERE id = ? AND company_id = ?").get(req.params.id, req.user.companyId);
  if (!src) return res.status(404).json({ ok: false, error: "Источник не найден" });
  const { name } = req.body ?? {};
  db.prepare("UPDATE crm_sources SET name = COALESCE(?, name) WHERE id = ?").run(name?.trim() ?? null, req.params.id);
  res.json({ ok: true, source: db.prepare("SELECT * FROM crm_sources WHERE id = ?").get(req.params.id) });
});

router.delete("/sources/:id", (req, res) => {
  const src = db.prepare("SELECT id FROM crm_sources WHERE id = ? AND company_id = ?").get(req.params.id, req.user.companyId);
  if (!src) return res.status(404).json({ ok: false, error: "Источник не найден" });
  db.prepare("DELETE FROM crm_sources WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ── Team members (for assignee dropdown) ─────────────────────────────────────
router.get("/members", (req, res) => {
  const members = db.prepare("SELECT id, name, email, role FROM users WHERE company_id = ? ORDER BY name ASC").all(req.user.companyId);
  res.json({ ok: true, members });
});

// ── Lead Files ────────────────────────────────────────────────────────────────
router.get("/leads/:id/files", (req, res) => {
  const lead = db.prepare("SELECT id FROM crm_leads WHERE id = ? AND company_id = ?").get(req.params.id, req.user.companyId);
  if (!lead) return res.status(404).json({ ok: false, error: "Заявка не найдена" });
  const files = db.prepare("SELECT id, name, size, mime_type, uploader_name, created_at FROM crm_lead_files WHERE lead_id = ? ORDER BY created_at DESC").all(req.params.id);
  res.json({ ok: true, files });
});

router.post("/leads/:id/files", (req, res) => {
  const lead = db.prepare("SELECT id FROM crm_leads WHERE id = ? AND company_id = ?").get(req.params.id, req.user.companyId);
  if (!lead) return res.status(404).json({ ok: false, error: "Заявка не найдена" });
  const { name, size, mime_type, data } = req.body ?? {};
  if (!name || !data) return res.status(400).json({ ok: false, error: "name и data обязательны" });
  const id = randomUUID();
  db.prepare("INSERT INTO crm_lead_files (id, lead_id, company_id, name, size, mime_type, data, uploaded_by, uploader_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(id, req.params.id, req.user.companyId, name, size ?? 0, mime_type ?? "application/octet-stream", data, req.user.userId, req.user.name, now());
  addHistory(req.params.id, req.user.userId, req.user.name, "Загружен файл", name);
  const file = db.prepare("SELECT id, name, size, mime_type, uploader_name, created_at FROM crm_lead_files WHERE id = ?").get(id);
  res.status(201).json({ ok: true, file });
});

router.get("/leads/:id/files/:fileId/download", (req, res) => {
  const file = db.prepare("SELECT f.* FROM crm_lead_files f JOIN crm_leads l ON l.id = f.lead_id WHERE f.id = ? AND l.company_id = ?")
    .get(req.params.fileId, req.user.companyId);
  if (!file) return res.status(404).json({ ok: false, error: "Файл не найден" });
  const buf = Buffer.from(file.data, "base64");
  res.setHeader("Content-Type", file.mime_type);
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.name)}"`);
  res.send(buf);
});

router.delete("/leads/:id/files/:fileId", (req, res) => {
  const file = db.prepare("SELECT f.id, f.name FROM crm_lead_files f JOIN crm_leads l ON l.id = f.lead_id WHERE f.id = ? AND l.company_id = ?")
    .get(req.params.fileId, req.user.companyId);
  if (!file) return res.status(404).json({ ok: false, error: "Файл не найден" });
  db.prepare("DELETE FROM crm_lead_files WHERE id = ?").run(req.params.fileId);
  addHistory(req.params.id, req.user.userId, req.user.name, "Удалён файл", file.name);
  res.json({ ok: true });
});

// ── Bulk actions ──────────────────────────────────────────────────────────────
router.post("/leads/bulk", (req, res) => {
  const { action, ids, value } = req.body ?? {};
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ ok: false, error: "ids обязательны" });

  // Verify all leads belong to this company
  const placeholders = ids.map(() => "?").join(",");
  const owned = db.prepare(`SELECT id FROM crm_leads WHERE id IN (${placeholders}) AND company_id = ?`).all(...ids, req.user.companyId);
  if (owned.length !== ids.length) return res.status(403).json({ ok: false, error: "Нет доступа к некоторым заявкам" });

  if (action === "status") {
    const validStatuses = getValidStatuses(req.user.companyId);
    if (!validStatuses.includes(value)) return res.status(400).json({ ok: false, error: "Неверный статус" });
    db.prepare(`UPDATE crm_leads SET status = ?, updated_at = ? WHERE id IN (${placeholders})`).run(value, now(), ...ids);
  } else if (action === "assign") {
    db.prepare(`UPDATE crm_leads SET assigned_to = ?, updated_at = ? WHERE id IN (${placeholders})`).run(value || null, now(), ...ids);
  } else if (action === "delete") {
    db.prepare(`DELETE FROM crm_lead_tags WHERE lead_id IN (${placeholders})`).run(...ids);
    db.prepare(`DELETE FROM crm_comments WHERE lead_id IN (${placeholders})`).run(...ids);
    db.prepare(`DELETE FROM crm_tasks WHERE lead_id IN (${placeholders})`).run(...ids);
    db.prepare(`DELETE FROM crm_history WHERE lead_id IN (${placeholders})`).run(...ids);
    db.prepare(`DELETE FROM crm_leads WHERE id IN (${placeholders})`).run(...ids);
  } else {
    return res.status(400).json({ ok: false, error: "Неверное действие" });
  }

  res.json({ ok: true, affected: ids.length });
});

// ── Analytics ─────────────────────────────────────────────────────────────────
router.get("/analytics", (req, res) => {
  const { date_from, date_to } = req.query;
  let where = "WHERE company_id = ?";
  const params = [req.user.companyId];
  if (date_from) { where += " AND created_at >= ?"; params.push(date_from); }
  if (date_to) { where += " AND created_at <= ?"; params.push(date_to + "T23:59:59"); }

  const byStatus = db.prepare(`SELECT status, COUNT(*) as count, SUM(profit) as profit FROM crm_leads ${where} GROUP BY status`).all(...params);
  const bySource = db.prepare(`SELECT source, COUNT(*) as count FROM crm_leads ${where} GROUP BY source`).all(...params);
  const total = db.prepare(`SELECT COUNT(*) as count, SUM(profit) as profit FROM crm_leads ${where}`).get(...params);

  const today = new Date().toISOString().slice(0, 10);
  const overdue = db.prepare(
    `SELECT COUNT(*) as count FROM crm_tasks t JOIN crm_leads l ON l.id = t.lead_id WHERE l.company_id = ? AND t.done = 0 AND t.due_date IS NOT NULL AND t.due_date < ?`
  ).get(req.user.companyId, today);

  res.json({ ok: true, byStatus, bySource, total, overdueTasks: overdue.count });
});

// ── Notifications ─────────────────────────────────────────────────────────────
router.get("/notifications", (req, res) => {
  const notifs = db.prepare(
    "SELECT * FROM crm_notifications WHERE user_id = ? AND company_id = ? ORDER BY created_at DESC LIMIT 50"
  ).all(req.user.userId, req.user.companyId);
  res.json({ ok: true, notifications: notifs });
});

router.patch("/notifications/read-all", (req, res) => {
  db.prepare("UPDATE crm_notifications SET read = 1 WHERE user_id = ? AND company_id = ?").run(req.user.userId, req.user.companyId);
  res.json({ ok: true });
});

router.patch("/notifications/:id/read", (req, res) => {
  db.prepare("UPDATE crm_notifications SET read = 1 WHERE id = ? AND user_id = ?").run(req.params.id, req.user.userId);
  res.json({ ok: true });
});

export default router;
