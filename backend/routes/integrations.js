import { Router } from "express";
import { randomUUID } from "crypto";
import db from "../database.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

function now() { return new Date().toISOString(); }

function genApiKey() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "sk_live_";
  for (let i = 0; i < 32; i++) key += chars[Math.floor(Math.random() * chars.length)];
  return key;
}

function parseIntegration(row) {
  if (!row) return null;
  return { ...row, form_fields: row.form_fields ? JSON.parse(row.form_fields) : [], active: !!row.active };
}

const DEFAULT_FIELDS = [
  { key: "name",    label: "Имя",      type: "text",     required: true  },
  { key: "phone",   label: "Телефон",  type: "tel",      required: false },
  { key: "email",   label: "Email",    type: "email",    required: false },
  { key: "message", label: "Сообщение",type: "textarea", required: false },
];

// ─────────────────────────────────────────────────────────────────────────────
//  Public — submit lead via API key (called from external websites)
//  POST /api/integrations/submit
//  Header: X-Api-Key: sk_live_...  OR  Query: ?key=sk_live_...
// ─────────────────────────────────────────────────────────────────────────────
router.post("/submit", (req, res) => {
  const apiKey = req.headers["x-api-key"] || req.query.key;
  if (!apiKey) return res.status(401).json({ ok: false, error: "API ключ обязателен" });

  const integration = db.prepare(
    "SELECT * FROM crm_integrations WHERE api_key = ? AND active = 1"
  ).get(apiKey);
  if (!integration) return res.status(401).json({ ok: false, error: "Неверный или неактивный API ключ" });

  const body = req.body ?? {};
  const { name, phone, email, ...rest } = body;

  if (!name?.toString().trim()) {
    return res.status(400).json({ ok: false, error: "Поле 'name' (имя) обязательно" });
  }

  const leadId = randomUUID();
  const ts = now();

  // Build custom_fields from extra keys
  const customFields = {};
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined && v !== null && String(v).trim()) {
      customFields[k] = String(v).trim();
    }
  }

  db.prepare(`
    INSERT INTO crm_leads
      (id, company_id, status, name, phone, email, source, custom_fields, created_at, updated_at)
    VALUES (?, ?, 'new', ?, ?, ?, ?, ?, ?, ?)
  `).run(
    leadId,
    integration.company_id,
    name.toString().trim(),
    phone?.toString().trim() || null,
    email?.toString().trim() || null,
    integration.name,
    JSON.stringify(customFields),
    ts,
    ts
  );

  db.prepare(`
    INSERT INTO crm_history (id, lead_id, user_id, user_name, action, details, created_at)
    VALUES (?, ?, NULL, 'Сайт', 'Создана заявка', ?, ?)
  `).run(randomUUID(), leadId, `Источник: ${integration.name}`, ts);

  return res.status(201).json({ ok: true, leadId });
});

// ─────────────────────────────────────────────────────────────────────────────
//  Public — serve embeddable widget
//  GET /api/integrations/widget.js?key=sk_live_...
// ─────────────────────────────────────────────────────────────────────────────
router.get("/widget.js", (req, res) => {
  const apiKey = req.query.key;
  if (!apiKey) {
    return res.status(400).type("text/javascript").send("console.error('AI Офис Widget: укажите параметр ?key=ваш_api_ключ');");
  }

  const integration = db.prepare(
    "SELECT * FROM crm_integrations WHERE api_key = ? AND active = 1"
  ).get(apiKey);

  if (!integration) {
    return res.status(404).type("text/javascript").send("console.error('AI Офис Widget: API ключ не найден или деактивирован');");
  }

  const fields = JSON.parse(integration.form_fields || "[]");
  const fieldsJson = JSON.stringify(fields.length ? fields : DEFAULT_FIELDS);
  const submitUrl = `${req.protocol}://${req.get("host")}/api/integrations/submit`;

  const js = `
(function() {
  var AI_WIDGET_KEY = ${JSON.stringify(apiKey)};
  var AI_SUBMIT_URL = ${JSON.stringify(submitUrl)};
  var AI_FIELDS = ${fieldsJson};
  var AI_TITLE = ${JSON.stringify(integration.name)};

  var style = document.createElement('style');
  style.textContent = [
    '#_aioffice_btn{position:fixed;bottom:24px;right:24px;z-index:99999;background:#2563EB;color:#fff;border:none;border-radius:50px;padding:12px 20px;font-size:15px;font-family:sans-serif;cursor:pointer;box-shadow:0 4px 16px rgba(37,99,235,.4);transition:transform .15s}',
    '#_aioffice_btn:hover{transform:scale(1.06)}',
    '#_aioffice_overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99998;align-items:center;justify-content:center}',
    '#_aioffice_overlay.open{display:flex}',
    '#_aioffice_modal{background:#fff;border-radius:16px;padding:28px;width:100%;max-width:420px;margin:16px;box-shadow:0 16px 48px rgba(0,0,0,.18);font-family:sans-serif}',
    '#_aioffice_modal h2{margin:0 0 20px;font-size:18px;color:#1E293B}',
    '#_aioffice_modal .ai-field{display:flex;flex-direction:column;gap:5px;margin-bottom:14px}',
    '#_aioffice_modal label{font-size:13px;font-weight:500;color:#475569}',
    '#_aioffice_modal input,#_aioffice_modal textarea,#_aioffice_modal select{border:1.5px solid #E2E8F0;border-radius:8px;padding:9px 12px;font-size:14px;outline:none;font-family:sans-serif;transition:border .15s}',
    '#_aioffice_modal input:focus,#_aioffice_modal textarea:focus{border-color:#2563EB}',
    '#_aioffice_modal textarea{resize:vertical;min-height:80px}',
    '#_aioffice_modal .ai-submit{width:100%;background:#2563EB;color:#fff;border:none;border-radius:8px;padding:11px;font-size:15px;font-weight:600;cursor:pointer;margin-top:6px;transition:background .15s}',
    '#_aioffice_modal .ai-submit:hover{background:#1D4ED8}',
    '#_aioffice_modal .ai-submit:disabled{opacity:.6;cursor:not-allowed}',
    '#_aioffice_modal .ai-close{float:right;background:none;border:none;font-size:20px;cursor:pointer;color:#94A3B8;line-height:1}',
    '#_aioffice_modal .ai-success{text-align:center;padding:20px 0;color:#16A34A;font-size:15px}',
    '#_aioffice_modal .ai-error{color:#DC2626;font-size:13px;margin-top:8px}',
  ].join('');
  document.head.appendChild(style);

  var btn = document.createElement('button');
  btn.id = '_aioffice_btn';
  btn.textContent = '📩 Оставить заявку';
  document.body.appendChild(btn);

  var overlay = document.createElement('div');
  overlay.id = '_aioffice_overlay';
  overlay.innerHTML = '<div id="_aioffice_modal"><button class="ai-close" id="_ai_close">×</button><h2>' + AI_TITLE + '</h2><div id="_ai_form_wrap"></div></div>';
  document.body.appendChild(overlay);

  function buildForm() {
    var wrap = document.getElementById('_ai_form_wrap');
    wrap.innerHTML = '';
    AI_FIELDS.forEach(function(f) {
      var div = document.createElement('div');
      div.className = 'ai-field';
      var lbl = document.createElement('label');
      lbl.textContent = f.label + (f.required ? ' *' : '');
      div.appendChild(lbl);
      var inp;
      if (f.type === 'textarea') {
        inp = document.createElement('textarea');
      } else {
        inp = document.createElement('input');
        inp.type = f.type || 'text';
      }
      inp.name = f.key;
      inp.placeholder = f.label;
      if (f.required) inp.required = true;
      div.appendChild(inp);
      wrap.appendChild(div);
    });
    var sub = document.createElement('button');
    sub.className = 'ai-submit';
    sub.id = '_ai_submit';
    sub.textContent = 'Отправить заявку';
    wrap.appendChild(sub);
    document.getElementById('_ai_submit').onclick = submitForm;
  }

  function submitForm() {
    var btn2 = document.getElementById('_ai_submit');
    var data = {};
    var valid = true;
    AI_FIELDS.forEach(function(f) {
      var el = document.querySelector('[name="' + f.key + '"]');
      if (!el) return;
      var val = el.value.trim();
      if (f.required && !val) { el.style.borderColor = '#DC2626'; valid = false; }
      else { el.style.borderColor = ''; if (val) data[f.key] = val; }
    });
    if (!valid) return;
    btn2.disabled = true;
    btn2.textContent = 'Отправляю...';
    fetch(AI_SUBMIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': AI_WIDGET_KEY },
      body: JSON.stringify(data)
    })
    .then(function(r) { return r.json(); })
    .then(function(res) {
      if (res.ok) {
        document.getElementById('_ai_form_wrap').innerHTML = '<div class="ai-success">✅ Заявка отправлена!<br><small style="color:#64748B">Мы свяжемся с вами в ближайшее время</small></div>';
        setTimeout(closeModal, 3000);
      } else {
        btn2.disabled = false; btn2.textContent = 'Отправить заявку';
        var err = document.createElement('div'); err.className = 'ai-error'; err.textContent = res.error || 'Ошибка отправки';
        document.getElementById('_ai_form_wrap').appendChild(err);
      }
    })
    .catch(function() {
      btn2.disabled = false; btn2.textContent = 'Отправить заявку';
    });
  }

  function openModal() { buildForm(); overlay.classList.add('open'); }
  function closeModal() { overlay.classList.remove('open'); }

  btn.onclick = openModal;
  document.getElementById('_ai_close').onclick = closeModal;
  overlay.onclick = function(e) { if (e.target === overlay) closeModal(); };
})();
`;

  res.type("text/javascript").send(js);
});

// ─────────────────────────────────────────────────────────────────────────────
//  Protected — manage integrations
// ─────────────────────────────────────────────────────────────────────────────
router.use(authMiddleware);

// GET /api/integrations
router.get("/", (req, res) => {
  const rows = db.prepare(
    "SELECT * FROM crm_integrations WHERE company_id = ? ORDER BY created_at DESC"
  ).all(req.user.companyId);
  res.json({ ok: true, integrations: rows.map(parseIntegration) });
});

// POST /api/integrations
router.post("/", (req, res) => {
  const { name, form_fields } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ ok: false, error: "Название обязательно" });

  const id = randomUUID();
  const apiKey = genApiKey();
  const ts = now();
  const ff = Array.isArray(form_fields) ? JSON.stringify(form_fields) : JSON.stringify(DEFAULT_FIELDS);

  db.prepare(`
    INSERT INTO crm_integrations (id, company_id, name, api_key, form_fields, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `).run(id, req.user.companyId, name.trim(), apiKey, ff, ts, ts);

  res.status(201).json({ ok: true, integration: parseIntegration(db.prepare("SELECT * FROM crm_integrations WHERE id = ?").get(id)) });
});

// PATCH /api/integrations/:id
router.patch("/:id", (req, res) => {
  const row = db.prepare("SELECT id FROM crm_integrations WHERE id = ? AND company_id = ?")
    .get(req.params.id, req.user.companyId);
  if (!row) return res.status(404).json({ ok: false, error: "Интеграция не найдена" });

  const { name, form_fields, active } = req.body ?? {};
  const ff = Array.isArray(form_fields) ? JSON.stringify(form_fields) : undefined;

  db.prepare(`UPDATE crm_integrations SET
    name = COALESCE(?, name),
    form_fields = COALESCE(?, form_fields),
    active = COALESCE(?, active),
    updated_at = ?
    WHERE id = ?`)
    .run(name?.trim() ?? null, ff ?? null, active !== undefined ? (active ? 1 : 0) : null, now(), req.params.id);

  res.json({ ok: true, integration: parseIntegration(db.prepare("SELECT * FROM crm_integrations WHERE id = ?").get(req.params.id)) });
});

// POST /api/integrations/:id/regenerate-key
router.post("/:id/regenerate-key", (req, res) => {
  const row = db.prepare("SELECT id FROM crm_integrations WHERE id = ? AND company_id = ?")
    .get(req.params.id, req.user.companyId);
  if (!row) return res.status(404).json({ ok: false, error: "Интеграция не найдена" });

  const newKey = genApiKey();
  db.prepare("UPDATE crm_integrations SET api_key = ?, updated_at = ? WHERE id = ?")
    .run(newKey, now(), req.params.id);

  res.json({ ok: true, integration: parseIntegration(db.prepare("SELECT * FROM crm_integrations WHERE id = ?").get(req.params.id)) });
});

// DELETE /api/integrations/:id
router.delete("/:id", (req, res) => {
  const row = db.prepare("SELECT id FROM crm_integrations WHERE id = ? AND company_id = ?")
    .get(req.params.id, req.user.companyId);
  if (!row) return res.status(404).json({ ok: false, error: "Интеграция не найдена" });

  db.prepare("DELETE FROM crm_integrations WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

export default router;
