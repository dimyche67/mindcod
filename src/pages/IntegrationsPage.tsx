import { useState, useEffect } from "react";
import { AppLayout } from "../components/AppLayout";
import type { CrmIntegration, IntegrationField } from "../types";
import {
  apiGetIntegrations, apiCreateIntegration, apiUpdateIntegration,
  apiRegenerateIntegrationKey, apiDeleteIntegration,
} from "../api";

const BASE = import.meta.env.VITE_API_URL ?? (typeof window !== "undefined" ? window.location.origin : "");

const DEFAULT_FIELDS: IntegrationField[] = [
  { key: "name",    label: "Имя",       type: "text",     required: true  },
  { key: "phone",   label: "Телефон",   type: "tel",      required: false },
  { key: "email",   label: "Email",     type: "email",    required: false },
  { key: "message", label: "Сообщение", type: "textarea", required: false },
];

const FIELD_TYPES = ["text", "tel", "email", "textarea", "number", "select"] as const;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyBtn({ text, label = "Копировать" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button onClick={copy}
      className={`text-xs px-2.5 py-1 rounded-lg cursor-pointer transition-all font-medium ${copied ? "bg-green-100 text-green-700" : "bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE]"}`}>
      {copied ? "✓ Скопировано" : label}
    </button>
  );
}

// ── Code snippet block ────────────────────────────────────────────────────────
function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative">
      <pre className="bg-[#0F172A] text-[#94A3B8] rounded-lg p-4 text-xs font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap">
        {code}
      </pre>
      <div className="absolute top-2 right-2">
        <CopyBtn text={code} />
      </div>
    </div>
  );
}

// ── Generate code snippets ────────────────────────────────────────────────────
function genHtmlForm(integration: CrmIntegration): string {
  const fields = integration.form_fields.length ? integration.form_fields : DEFAULT_FIELDS;
  const inputs = fields.map((f) => {
    if (f.type === "textarea") {
      return `  <div class="form-group">
    <label for="${f.key}">${f.label}${f.required ? " *" : ""}</label>
    <textarea id="${f.key}" name="${f.key}"${f.required ? " required" : ""} placeholder="${f.label}"></textarea>
  </div>`;
    }
    return `  <div class="form-group">
    <label for="${f.key}">${f.label}${f.required ? " *" : ""}</label>
    <input type="${f.type}" id="${f.key}" name="${f.key}"${f.required ? " required" : ""} placeholder="${f.label}" />
  </div>`;
  }).join("\n");

  return `<style>
  .ai-form { max-width: 480px; font-family: sans-serif; }
  .ai-form .form-group { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
  .ai-form label { font-size: 13px; font-weight: 500; color: #475569; }
  .ai-form input, .ai-form textarea { border: 1.5px solid #E2E8F0; border-radius: 8px;
    padding: 9px 12px; font-size: 14px; outline: none; }
  .ai-form input:focus, .ai-form textarea:focus { border-color: #2563EB; }
  .ai-form button { background: #2563EB; color: white; border: none; border-radius: 8px;
    padding: 11px 20px; font-size: 15px; font-weight: 600; cursor: pointer; width: 100%; }
  .ai-form .success { color: #16A34A; text-align: center; padding: 12px; }
  .ai-form .error { color: #DC2626; font-size: 13px; margin-top: 8px; }
</style>

<form class="ai-form" id="ai-lead-form">
${inputs}
  <button type="submit" id="ai-submit-btn">Отправить заявку</button>
  <div id="ai-form-message"></div>
</form>

<script>
document.getElementById('ai-lead-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const btn = document.getElementById('ai-submit-btn');
  const msg = document.getElementById('ai-form-message');
  btn.disabled = true;
  btn.textContent = 'Отправляю...';
  msg.textContent = '';

  const data = {};
  this.querySelectorAll('input, textarea, select').forEach(function(el) {
    if (el.name && el.value.trim()) data[el.name] = el.value.trim();
  });

  try {
    const res = await fetch('${BASE}/api/integrations/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': '${integration.api_key}' },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (json.ok) {
      msg.className = 'success';
      msg.textContent = '✅ Заявка отправлена! Мы свяжемся с вами.';
      this.reset();
    } else {
      msg.className = 'error';
      msg.textContent = json.error || 'Ошибка отправки';
    }
  } catch {
    msg.className = 'error';
    msg.textContent = 'Ошибка соединения. Попробуйте позже.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Отправить заявку';
  }
});
<\/script>`;
}

function genWidgetSnippet(integration: CrmIntegration): string {
  return `<!-- Mindcod виджет — вставьте перед </body> -->
<script src="${BASE}/api/integrations/widget.js?key=${integration.api_key}" async><\/script>`;
}

function genFetchSnippet(integration: CrmIntegration): string {
  return `// Отправка заявки через fetch (JavaScript)
fetch('${BASE}/api/integrations/submit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Api-Key': '${integration.api_key}'
  },
  body: JSON.stringify({
    name: 'Иван Иванов',      // обязательно
    phone: '+7 900 123-45-67', // опционально
    email: 'ivan@example.com', // опционально
    message: 'Текст заявки'    // опционально
  })
})
.then(res => res.json())
.then(data => console.log(data)); // { ok: true, leadId: "..." }`;
}

function genCurlSnippet(integration: CrmIntegration): string {
  return `# cURL пример
curl -X POST '${BASE}/api/integrations/submit' \\
  -H 'Content-Type: application/json' \\
  -H 'X-Api-Key: ${integration.api_key}' \\
  -d '{"name":"Иван","phone":"+7 900 123-45-67","email":"ivan@mail.ru"}'`;
}

// ── Field editor ──────────────────────────────────────────────────────────────
function FieldEditor({
  fields,
  onChange,
}: {
  fields: IntegrationField[];
  onChange: (f: IntegrationField[]) => void;
}) {
  function add() {
    onChange([...fields, { key: `field_${Date.now()}`, label: "Новое поле", type: "text", required: false }]);
  }
  function remove(i: number) {
    onChange(fields.filter((_, idx) => idx !== i));
  }
  function update(i: number, patch: Partial<IntegrationField>) {
    onChange(fields.map((f, idx) => idx === i ? { ...f, ...patch } : f));
  }
  function move(i: number, dir: -1 | 1) {
    const arr = [...fields];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    onChange(arr);
  }

  return (
    <div className="flex flex-col gap-2">
      {fields.map((f, i) => (
        <div key={i} className="flex items-center gap-2 bg-[#F8F9FA] rounded-lg px-3 py-2">
          <div className="flex flex-col gap-0.5">
            <button onClick={() => move(i, -1)} className="text-[10px] text-[#94A3B8] hover:text-[#64748B] cursor-pointer leading-none">▲</button>
            <button onClick={() => move(i, 1)} className="text-[10px] text-[#94A3B8] hover:text-[#64748B] cursor-pointer leading-none">▼</button>
          </div>
          <input value={f.label} onChange={(e) => update(i, { label: e.target.value })}
            placeholder="Название поля"
            className="border border-[#E2E8F0] rounded px-2 py-1 text-sm w-32 focus:outline-none focus:border-[#2563EB] bg-white" />
          <input value={f.key} onChange={(e) => update(i, { key: e.target.value.replace(/\s/g, "_").toLowerCase() })}
            placeholder="key"
            className="border border-[#E2E8F0] rounded px-2 py-1 text-sm w-28 focus:outline-none focus:border-[#2563EB] bg-white font-mono text-xs" />
          <select value={f.type} onChange={(e) => update(i, { type: e.target.value as IntegrationField["type"] })}
            className="border border-[#E2E8F0] rounded px-2 py-1 text-sm focus:outline-none cursor-pointer bg-white">
            {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <label className="flex items-center gap-1 text-xs text-[#64748B] cursor-pointer">
            <input type="checkbox" checked={f.required} onChange={(e) => update(i, { required: e.target.checked })} />
            Обяз.
          </label>
          <button onClick={() => remove(i)} className="text-[#94A3B8] hover:text-red-500 cursor-pointer ml-auto">✕</button>
        </div>
      ))}
      <button onClick={add}
        className="text-sm text-[#2563EB] hover:text-[#1D4ED8] cursor-pointer text-left py-1">
        + Добавить поле
      </button>
    </div>
  );
}

// ── Integration card ──────────────────────────────────────────────────────────
function IntegrationCard({
  integration,
  onUpdate,
  onDelete,
  onRegen,
}: {
  integration: CrmIntegration;
  onUpdate: (updated: CrmIntegration) => void;
  onDelete: () => void;
  onRegen: (updated: CrmIntegration) => void;
}) {
  const [tab, setTab] = useState<"widget" | "html" | "fetch" | "fields">("widget");
  const [expanded, setExpanded] = useState(false);
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState(integration.name);
  const [fields, setFields] = useState<IntegrationField[]>(integration.form_fields.length ? integration.form_fields : DEFAULT_FIELDS);
  const [savingFields, setSavingFields] = useState(false);
  const [showKey, setShowKey] = useState(false);

  async function saveName() {
    if (!name.trim()) return;
    const res = await apiUpdateIntegration(integration.id, { name: name.trim() });
    onUpdate(res.integration);
    setEditName(false);
  }

  async function toggleActive() {
    const res = await apiUpdateIntegration(integration.id, { active: !integration.active });
    onUpdate(res.integration);
  }

  async function saveFields() {
    setSavingFields(true);
    try {
      const res = await apiUpdateIntegration(integration.id, { form_fields: fields });
      onUpdate(res.integration);
    } finally { setSavingFields(false); }
  }

  async function regen() {
    if (!confirm("Старый ключ перестанет работать. Продолжить?")) return;
    const res = await apiRegenerateIntegrationKey(integration.id);
    onRegen(res.integration);
  }

  return (
    <div className={`bg-white rounded-xl border ${integration.active ? "border-[#E2E8F0]" : "border-[#F1F5F9]"} shadow-sm overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[#F1F5F9]">
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${integration.active ? "bg-green-500" : "bg-[#CBD5E1]"}`} />
        {editName ? (
          <div className="flex items-center gap-2 flex-1">
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditName(false); }}
              className="border border-[#2563EB] rounded px-2 py-1 text-sm flex-1 focus:outline-none" />
            <button onClick={saveName} className="text-xs bg-[#2563EB] text-white px-2 py-1 rounded cursor-pointer">✓</button>
            <button onClick={() => setEditName(false)} className="text-xs text-[#94A3B8] cursor-pointer">✕</button>
          </div>
        ) : (
          <div className="flex-1 flex items-center gap-2">
            <span className="font-semibold text-[#1E293B]">{integration.name}</span>
            <button onClick={() => setEditName(true)} className="text-xs text-[#94A3B8] hover:text-[#64748B] cursor-pointer">✏️</button>
          </div>
        )}
        <span className="text-xs text-[#94A3B8]">Создана {fmtDate(integration.created_at)}</span>
        <button onClick={toggleActive}
          className={`text-xs px-2.5 py-1 rounded-full cursor-pointer font-medium transition-colors ${integration.active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]"}`}>
          {integration.active ? "Активна" : "Отключена"}
        </button>
        <button onClick={() => onDelete()} className="text-[#94A3B8] hover:text-red-500 cursor-pointer text-sm">🗑️</button>
        <button onClick={() => setExpanded((p) => !p)} className="text-[#94A3B8] hover:text-[#64748B] cursor-pointer text-sm">
          {expanded ? "▲" : "▼"}
        </button>
      </div>

      {/* API Key row */}
      <div className="px-5 py-3 flex items-center gap-3 bg-[#F8FAFC] border-b border-[#F1F5F9]">
        <span className="text-xs text-[#64748B] shrink-0 font-medium">API ключ:</span>
        <code className="text-xs font-mono text-[#1E293B] flex-1 truncate">
          {showKey ? integration.api_key : integration.api_key.slice(0, 12) + "••••••••••••••••••••••••"}
        </code>
        <button onClick={() => setShowKey((p) => !p)} className="text-xs text-[#94A3B8] hover:text-[#64748B] cursor-pointer shrink-0">
          {showKey ? "Скрыть" : "Показать"}
        </button>
        <CopyBtn text={integration.api_key} label="Копировать ключ" />
        <button onClick={regen} className="text-xs border border-[#E2E8F0] px-2 py-1 rounded cursor-pointer hover:bg-[#F8F9FA] text-[#64748B]" title="Перегенерировать ключ">
          🔄 Обновить
        </button>
      </div>

      {/* Expandable: code snippets + field editor */}
      {expanded && (
        <div className="p-5">
          {/* Tab bar */}
          <div className="flex gap-1 mb-4 border-b border-[#F1F5F9] pb-0">
            {([
              { id: "widget",  label: "🔌 Виджет"    },
              { id: "html",    label: "📄 HTML форма" },
              { id: "fetch",   label: "⚡ fetch / cURL" },
              { id: "fields",  label: "🗂️ Поля формы" },
            ] as { id: typeof tab; label: string }[]).map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-4 py-2 text-sm cursor-pointer border-b-2 -mb-px transition-colors ${tab === t.id ? "border-[#2563EB] text-[#2563EB] font-medium" : "border-transparent text-[#64748B] hover:text-[#1E293B]"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Widget tab */}
          {tab === "widget" && (
            <div className="flex flex-col gap-4">
              <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-4">
                <p className="text-sm font-semibold text-[#1E293B] mb-1">🔌 Виджет — одна строка кода</p>
                <p className="text-sm text-[#475569] mb-3">
                  Вставьте этот тег перед закрывающим <code className="bg-white px-1 rounded text-xs">&lt;/body&gt;</code> на любой странице сайта.
                  На сайте появится кнопка «Оставить заявку», которая открывает форму.
                </p>
                <CodeBlock code={genWidgetSnippet(integration)} />
              </div>
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
                <p className="text-sm font-semibold text-[#1E293B] mb-2">Как выглядит виджет:</p>
                <div className="flex items-center gap-3">
                  <div className="bg-[#2563EB] text-white text-sm px-4 py-2.5 rounded-full shadow-lg font-medium">📩 Оставить заявку</div>
                  <span className="text-sm text-[#64748B]">→ Кнопка фиксируется в правом нижнем углу сайта</span>
                </div>
              </div>
            </div>
          )}

          {/* HTML form tab */}
          {tab === "html" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-[#475569]">
                Готовый HTML + JS код формы. Вставьте в любое место страницы — форма отправит заявку прямо в вашу CRM.
              </p>
              <CodeBlock code={genHtmlForm(integration)} />
            </div>
          )}

          {/* Fetch tab */}
          {tab === "fetch" && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-medium text-[#1E293B] mb-2">JavaScript (fetch)</p>
                <CodeBlock code={genFetchSnippet(integration)} />
              </div>
              <div>
                <p className="text-sm font-medium text-[#1E293B] mb-2">cURL / Webhook</p>
                <CodeBlock code={genCurlSnippet(integration)} />
              </div>
              <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-lg p-3 text-xs text-[#92400E]">
                💡 Endpoint принимает <strong>любые JSON-поля</strong> в теле запроса. Поля <code>name</code>, <code>phone</code>, <code>email</code> — стандартные.
                Остальные сохраняются в «Доп. поля» карточки лида.
              </div>
            </div>
          )}

          {/* Fields editor tab */}
          {tab === "fields" && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-[#475569]">
                Настройте поля формы. Они применяются к виджету и HTML-сниппету.
              </p>
              <FieldEditor fields={fields} onChange={setFields} />
              <div className="flex gap-2 pt-2 border-t border-[#F1F5F9]">
                <button onClick={saveFields} disabled={savingFields}
                  className="bg-[#2563EB] text-white text-sm px-4 py-2 rounded-lg cursor-pointer hover:bg-[#1D4ED8] disabled:opacity-50">
                  {savingFields ? "Сохраняю…" : "Сохранить поля"}
                </button>
                <button onClick={() => setFields(DEFAULT_FIELDS)}
                  className="border border-[#E2E8F0] text-sm px-4 py-2 rounded-lg cursor-pointer hover:bg-[#F8F9FA] text-[#64748B]">
                  Сбросить к стандартным
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<CrmIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiGetIntegrations()
      .then((r) => setIntegrations(r.integrations))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiCreateIntegration(newName.trim());
      setIntegrations((p) => [res.integration, ...p]);
      setNewName(""); setCreating(false);
    } finally { setSubmitting(false); }
  }

  function update(updated: CrmIntegration) {
    setIntegrations((p) => p.map((i) => i.id === updated.id ? updated : i));
  }

  async function del(id: string) {
    if (!confirm("Удалить интеграцию? Все формы с этим ключом перестанут работать.")) return;
    setIntegrations((p) => p.filter((i) => i.id !== id));
    try { await apiDeleteIntegration(id); } catch { /* ignore */ }
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-6 py-6 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1E293B]">Интеграции с сайтом</h1>
            <p className="text-sm text-[#64748B] mt-1">Подключите вашу CRM к любому сайту или форме</p>
          </div>
          <button onClick={() => setCreating(true)}
            className="bg-[#2563EB] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1D4ED8] cursor-pointer">
            + Новая интеграция
          </button>
        </div>

        {/* How it works */}
        <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-4">
          <p className="text-sm font-semibold text-[#15803D] mb-2">Как это работает</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[#166534]">
            {[
              { step: "1", text: "Создайте интеграцию и получите API-ключ" },
              { step: "2", text: "Вставьте код виджета или HTML-форму на ваш сайт" },
              { step: "3", text: "Заявки с сайта автоматически попадают в CRM" },
            ].map((s) => (
              <div key={s.step} className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-green-600 text-white text-xs flex items-center justify-center font-bold shrink-0">{s.step}</span>
                <span>{s.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Create form */}
        {creating && (
          <div className="bg-white rounded-xl border border-[#2563EB]/30 shadow-sm p-5">
            <h2 className="font-semibold text-[#1E293B] mb-3">Новая интеграция</h2>
            <form onSubmit={create} className="flex gap-3">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus
                placeholder="Например: Главная страница, Лендинг, Popup"
                className="flex-1 border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" />
              <button type="submit" disabled={submitting || !newName.trim()}
                className="bg-[#2563EB] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#1D4ED8] disabled:opacity-50 cursor-pointer">
                {submitting ? "Создаю…" : "Создать"}
              </button>
              <button type="button" onClick={() => setCreating(false)}
                className="border border-[#E2E8F0] px-4 py-2.5 rounded-lg text-sm text-[#64748B] hover:bg-[#F8F9FA] cursor-pointer">
                Отмена
              </button>
            </form>
            <p className="text-xs text-[#94A3B8] mt-2">Дайте понятное имя — оно будет отображаться как «источник» у лидов из этой формы</p>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="text-center py-16 text-[#64748B]">Загрузка…</div>
        ) : integrations.length === 0 && !creating ? (
          <div className="text-center py-20 bg-white rounded-xl border border-[#E2E8F0]">
            <div className="text-4xl mb-3">🔌</div>
            <p className="font-medium text-[#1E293B] mb-1">Интеграций пока нет</p>
            <p className="text-sm text-[#64748B] mb-4">Создайте первую интеграцию чтобы подключить CRM к вашему сайту</p>
            <button onClick={() => setCreating(true)}
              className="bg-[#2563EB] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1D4ED8] cursor-pointer">
              + Создать интеграцию
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {integrations.map((integration) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                onUpdate={update}
                onDelete={() => del(integration.id)}
                onRegen={update}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
