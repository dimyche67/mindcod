import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "../components/AppLayout";
import type { CrmLead, CrmStatus, CrmTag, CrmColumn, CrmField, CrmMember, CrmNotification, CrmSource } from "../types";
import {
  apiGetLeads, apiCreateLead, apiUpdateLead, apiDeleteLead,
  apiGetTags, apiCreateTag, apiUpdateTag, apiDeleteTag, apiAddLeadTag, apiRemoveLeadTag,
  apiGetCrmColumns, apiCreateCrmColumn, apiDeleteCrmColumn,
  apiGetCrmFields, apiCreateCrmField, apiDeleteCrmField,
  apiGetCrmMembers, apiBulkLeads, apiGetAnalytics, type CrmAnalytics,
  apiGetNotifications, apiMarkAllNotificationsRead, apiMarkNotificationRead,
  apiGetSources, apiCreateSource, apiUpdateSource, apiDeleteSource,
} from "../api";

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_COLUMNS = [
  { id: "new", label: "Новая заявка", color: "#3B82F6", dotClass: "bg-blue-500", borderClass: "border-t-blue-500" },
  { id: "calculating", label: "В расчете", color: "#EAB308", dotClass: "bg-yellow-500", borderClass: "border-t-yellow-500" },
  { id: "in_progress", label: "В работе", color: "#22C55E", dotClass: "bg-green-500", borderClass: "border-t-green-500" },
  { id: "rejected", label: "Не интересно", color: "#F87171", dotClass: "bg-red-400", borderClass: "border-t-red-400" },
];

const TAG_COLORS = ["#6366F1","#EC4899","#EF4444","#F59E0B","#10B981","#3B82F6","#8B5CF6","#14B8A6"];
const DEFAULT_SOURCE_LABELS: Record<string, string> = { manual: "Вручную", website: "Сайт", other: "Другое" };
const SORT_KEYS = ["created_at","name","profit","status"] as const;
type SortKey = typeof SORT_KEYS[number];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}
function fmtMoney(n?: number | null) {
  return n != null ? n.toLocaleString("ru-RU") + " ₽" : "—";
}

// ── Settings Modal ────────────────────────────────────────────────────────────

function SettingsModal({
  tags, columns, fields, sources,
  onClose,
  onTagCreate, onTagUpdate, onTagDelete,
  onColCreate, onColDelete,
  onFieldCreate, onFieldDelete,
  onSourceCreate, onSourceUpdate, onSourceDelete,
}: {
  tags: CrmTag[]; columns: CrmColumn[]; fields: CrmField[]; sources: CrmSource[];
  onClose: () => void;
  onTagCreate: (name: string, color: string) => Promise<void>;
  onTagUpdate: (id: string, name: string, color: string) => Promise<void>;
  onTagDelete: (id: string) => Promise<void>;
  onColCreate: (name: string, color: string) => Promise<void>;
  onColDelete: (id: string) => Promise<void>;
  onFieldCreate: (name: string, type: string) => Promise<void>;
  onFieldDelete: (id: string) => Promise<void>;
  onSourceCreate: (name: string) => Promise<void>;
  onSourceUpdate: (id: string, name: string) => Promise<void>;
  onSourceDelete: (id: string) => Promise<void>;
}) {
  const [tab, setTab] = useState<"tags" | "columns" | "fields" | "sources">("tags");
  const [tagName, setTagName] = useState(""); const [tagColor, setTagColor] = useState(TAG_COLORS[0]);
  const [colName, setColName] = useState(""); const [colColor, setColColor] = useState(TAG_COLORS[2]);
  const [fieldName, setFieldName] = useState(""); const [fieldType, setFieldType] = useState("text");
  const [sourceName, setSourceName] = useState(""); const [editSource, setEditSource] = useState<CrmSource | null>(null);
  const [editTag, setEditTag] = useState<CrmTag | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-semibold text-[#1E293B]">Настройки CRM</h2>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#64748B] cursor-pointer text-lg">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-4 border-b border-[#E2E8F0] pb-0 flex-wrap">
          {(["tags","columns","fields","sources"] as const).map((t) => {
            const ls = { tags: "🏷️ Теги", columns: "📋 Колонки", fields: "🗂️ Поля", sources: "📥 Источники" };
            return (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium cursor-pointer border-b-2 -mb-px transition-colors ${tab === t ? "border-[#2563EB] text-[#2563EB]" : "border-transparent text-[#64748B] hover:text-[#1E293B]"}`}>
                {ls[t]}
              </button>
            );
          })}
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Tags */}
          {tab === "tags" && (
            <>
              <div className="flex flex-col gap-2">
                {tags.map((tag) => (
                  <div key={tag.id} className="flex items-center gap-2 group">
                    {editTag?.id === tag.id ? (
                      <>
                        <input value={editTag.name} onChange={(e) => setEditTag({ ...editTag, name: e.target.value })}
                          className="flex-1 border border-[#E2E8F0] rounded px-2 py-1 text-sm focus:outline-none" />
                        <div className="flex gap-1">{TAG_COLORS.map((c) => (
                          <button key={c} onClick={() => setEditTag({ ...editTag, color: c })}
                            style={{ background: c }} className={`w-5 h-5 rounded-full cursor-pointer ${editTag.color === c ? "ring-2 ring-offset-1 ring-gray-400" : ""}`} />
                        ))}</div>
                        <button onClick={() => { onTagUpdate(tag.id, editTag.name, editTag.color); setEditTag(null); }}
                          className="text-xs bg-[#2563EB] text-white px-2 py-1 rounded cursor-pointer">✓</button>
                        <button onClick={() => setEditTag(null)} className="text-xs text-[#94A3B8] cursor-pointer">✕</button>
                      </>
                    ) : (
                      <>
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: tag.color }} />
                        <span className="flex-1 text-sm text-[#1E293B]">{tag.name}</span>
                        <button onClick={() => setEditTag(tag)} className="opacity-0 group-hover:opacity-100 text-xs text-[#64748B] hover:text-[#2563EB] cursor-pointer">✏️</button>
                        <button onClick={() => onTagDelete(tag.id)} className="opacity-0 group-hover:opacity-100 text-xs text-[#94A3B8] hover:text-red-500 cursor-pointer">🗑️</button>
                      </>
                    )}
                  </div>
                ))}
                {tags.length === 0 && <p className="text-sm text-[#94A3B8]">Теги не созданы</p>}
              </div>
              <div className="flex flex-col gap-2 pt-3 border-t border-[#F1F5F9]">
                <p className="text-xs font-medium text-[#64748B]">Новый тег</p>
                <div className="flex gap-2 items-center">
                  <input value={tagName} onChange={(e) => setTagName(e.target.value)} placeholder="Название тега"
                    className="flex-1 border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2563EB]" />
                  <div className="flex gap-1">{TAG_COLORS.map((c) => (
                    <button key={c} onClick={() => setTagColor(c)} style={{ background: c }}
                      className={`w-5 h-5 rounded-full cursor-pointer ${tagColor === c ? "ring-2 ring-offset-1 ring-gray-400" : ""}`} />
                  ))}</div>
                  <button onClick={() => { if (tagName.trim()) { onTagCreate(tagName.trim(), tagColor); setTagName(""); } }}
                    disabled={!tagName.trim()}
                    className="bg-[#2563EB] text-white text-sm px-3 py-2 rounded-lg cursor-pointer hover:bg-[#1D4ED8] disabled:opacity-40">+</button>
                </div>
              </div>
            </>
          )}

          {/* Columns */}
          {tab === "columns" && (
            <>
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-[#94A3B8] uppercase tracking-wide">Системные</p>
                {DEFAULT_COLUMNS.map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: c.color }} />
                    <span className="text-sm text-[#64748B]">{c.label}</span>
                    <span className="text-xs text-[#CBD5E1]">системная</span>
                  </div>
                ))}
                {columns.length > 0 && (
                  <>
                    <p className="text-xs font-medium text-[#94A3B8] uppercase tracking-wide mt-2">Кастомные</p>
                    {columns.map((col) => (
                      <div key={col.id} className="flex items-center gap-2 group">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: col.color }} />
                        <span className="flex-1 text-sm text-[#1E293B]">{col.name}</span>
                        <button onClick={() => onColDelete(col.id)} className="opacity-0 group-hover:opacity-100 text-xs text-[#94A3B8] hover:text-red-500 cursor-pointer">🗑️</button>
                      </div>
                    ))}
                  </>
                )}
              </div>
              <div className="flex flex-col gap-2 pt-3 border-t border-[#F1F5F9]">
                <p className="text-xs font-medium text-[#64748B]">Новая колонка</p>
                <div className="flex gap-2 items-center">
                  <input value={colName} onChange={(e) => setColName(e.target.value)} placeholder="Название статуса"
                    className="flex-1 border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2563EB]" />
                  <div className="flex gap-1">{TAG_COLORS.map((c) => (
                    <button key={c} onClick={() => setColColor(c)} style={{ background: c }}
                      className={`w-5 h-5 rounded-full cursor-pointer ${colColor === c ? "ring-2 ring-offset-1 ring-gray-400" : ""}`} />
                  ))}</div>
                  <button onClick={() => { if (colName.trim()) { onColCreate(colName.trim(), colColor); setColName(""); } }}
                    disabled={!colName.trim()}
                    className="bg-[#2563EB] text-white text-sm px-3 py-2 rounded-lg cursor-pointer hover:bg-[#1D4ED8] disabled:opacity-40">+</button>
                </div>
              </div>
            </>
          )}

          {/* Fields */}
          {tab === "fields" && (
            <>
              <div className="flex flex-col gap-2">
                {fields.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 group">
                    <span className="text-sm text-[#1E293B] flex-1">{f.name}</span>
                    <span className="text-xs text-[#94A3B8] bg-[#F1F5F9] px-2 py-0.5 rounded">{f.field_type}</span>
                    <button onClick={() => onFieldDelete(f.id)} className="opacity-0 group-hover:opacity-100 text-xs text-[#94A3B8] hover:text-red-500 cursor-pointer">🗑️</button>
                  </div>
                ))}
                {fields.length === 0 && <p className="text-sm text-[#94A3B8]">Кастомных полей нет</p>}
              </div>
              <div className="flex flex-col gap-2 pt-3 border-t border-[#F1F5F9]">
                <p className="text-xs font-medium text-[#64748B]">Новое поле</p>
                <div className="flex gap-2">
                  <input value={fieldName} onChange={(e) => setFieldName(e.target.value)} placeholder="Название поля"
                    className="flex-1 border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2563EB]" />
                  <select value={fieldType} onChange={(e) => setFieldType(e.target.value)}
                    className="border border-[#E2E8F0] rounded-lg px-2 py-2 text-sm focus:outline-none cursor-pointer">
                    <option value="text">Текст</option>
                    <option value="number">Число</option>
                    <option value="date">Дата</option>
                    <option value="select">Список</option>
                  </select>
                  <button onClick={() => { if (fieldName.trim()) { onFieldCreate(fieldName.trim(), fieldType); setFieldName(""); } }}
                    disabled={!fieldName.trim()}
                    className="bg-[#2563EB] text-white text-sm px-3 py-2 rounded-lg cursor-pointer hover:bg-[#1D4ED8] disabled:opacity-40">+</button>
                </div>
              </div>
            </>
          )}

          {/* Sources */}
          {tab === "sources" && (
            <>
              <div className="flex flex-col gap-2">
                {sources.filter((s) => s.is_default).map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <span className="flex-1 text-sm text-[#64748B]">{s.name}</span>
                    <span className="text-xs text-[#CBD5E1]">системный</span>
                  </div>
                ))}
                {sources.filter((s) => !s.is_default).length > 0 && (
                  <>
                    <p className="text-xs font-medium text-[#94A3B8] uppercase tracking-wide mt-2">Кастомные</p>
                    {sources.filter((s) => !s.is_default).map((s) => (
                      <div key={s.id} className="flex items-center gap-2 group">
                        {editSource?.id === s.id ? (
                          <>
                            <input value={editSource.name} onChange={(e) => setEditSource({ ...editSource, name: e.target.value })}
                              className="flex-1 border border-[#E2E8F0] rounded px-2 py-1 text-sm focus:outline-none" />
                            <button onClick={() => { onSourceUpdate(s.id, editSource.name); setEditSource(null); }}
                              className="text-xs bg-[#2563EB] text-white px-2 py-1 rounded cursor-pointer">✓</button>
                            <button onClick={() => setEditSource(null)} className="text-xs text-[#94A3B8] cursor-pointer">✕</button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-sm text-[#1E293B]">{s.name}</span>
                            <button onClick={() => setEditSource(s)} className="opacity-0 group-hover:opacity-100 text-xs text-[#64748B] hover:text-[#2563EB] cursor-pointer">✏️</button>
                            <button onClick={() => onSourceDelete(s.id)} className="opacity-0 group-hover:opacity-100 text-xs text-[#94A3B8] hover:text-red-500 cursor-pointer">🗑️</button>
                          </>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
              <div className="flex gap-2 pt-3 border-t border-[#F1F5F9]">
                <input value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="Новый источник…"
                  className="flex-1 border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2563EB]" />
                <button onClick={() => { if (sourceName.trim()) { onSourceCreate(sourceName.trim()); setSourceName(""); } }}
                  disabled={!sourceName.trim()}
                  className="bg-[#2563EB] text-white text-sm px-3 py-2 rounded-lg cursor-pointer hover:bg-[#1D4ED8] disabled:opacity-40">+</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main CRMPage ──────────────────────────────────────────────────────────────

type CreateForm = { name: string; phone: string; email: string; source: string; extra: string };
const EMPTY_FORM: CreateForm = { name: "", phone: "", email: "", source: "manual", extra: "" };

export function CRMPage() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [tags, setTags] = useState<CrmTag[]>([]);
  const [customColumns, setCustomColumns] = useState<CrmColumn[]>([]);
  const [fields, setFields] = useState<CrmField[]>([]);
  const [members, setMembers] = useState<CrmMember[]>([]);
  const [sources, setSources] = useState<CrmSource[]>([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<"kanban" | "list">(() =>
    (localStorage.getItem("crm_view") as "kanban" | "list") ?? "kanban"
  );
  const [search, setSearch] = useState("");
  const [filterAssigned, setFilterAssigned] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analytics, setAnalytics] = useState<CrmAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [notifications, setNotifications] = useState<CrmNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<{ id: string; name: string } | null>(null);

  // bulk selection (list view)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);

  // list sort
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // drag
  const draggingId = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
    apiGetNotifications().then((r) => setNotifications(r.notifications)).catch(() => {});
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [leadsRes, tagsRes, colsRes, fieldsRes, membersRes, sourcesRes] = await Promise.all([
        apiGetLeads(), apiGetTags(), apiGetCrmColumns(), apiGetCrmFields(), apiGetCrmMembers(), apiGetSources(),
      ]);
      setLeads(leadsRes.leads);
      setTags(tagsRes.tags);
      setCustomColumns(colsRes.columns);
      setFields(fieldsRes.fields);
      setMembers(membersRes.members);
      setSources(sourcesRes.sources);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function openAnalytics() {
    setShowAnalytics(true);
    setAnalyticsLoading(true);
    try {
      const res = await apiGetAnalytics();
      setAnalytics(res);
    } catch { /* ignore */ }
    finally { setAnalyticsLoading(false); }
  }

  async function markAllRead() {
    await apiMarkAllNotificationsRead();
    setNotifications((p) => p.map((n) => ({ ...n, read: 1 })));
  }

  async function markRead(id: string) {
    await apiMarkNotificationRead(id);
    setNotifications((p) => p.map((n) => n.id === id ? { ...n, read: 1 } : n));
  }

  function switchView(v: "kanban" | "list") {
    setView(v);
    localStorage.setItem("crm_view", v);
  }

  // All columns = default + custom
  const allColumns = [
    ...DEFAULT_COLUMNS,
    ...customColumns.map((c) => ({
      id: c.id, label: c.name, color: c.color,
      dotClass: "", borderClass: "",
      customColor: c.color,
    })),
  ];

  const filtered = leads.filter((l) => {
    if (filterAssigned && l.assigned_to !== filterAssigned) return false;
    if (filterSource && l.source !== filterSource) return false;
    if (filterDateFrom && l.created_at < filterDateFrom) return false;
    if (filterDateTo && l.created_at > filterDateTo + "T23:59:59") return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return l.name.toLowerCase().includes(q) || l.phone?.includes(q) || l.email?.toLowerCase().includes(q);
    }
    return true;
  });

  const byStatus = (s: string) => filtered.filter((l) => l.status === s);
  const totalProfit = leads.reduce((s, l) => s + (l.profit ?? 0), 0);
  const hasProfit = leads.some((l) => l.profit != null);

  // ── Sorted list ────────────────────────────────────────────────────────────
  const sortedList = [...filtered].sort((a, b) => {
    const va = a[sortKey as keyof CrmLead] ?? "";
    const vb = b[sortKey as keyof CrmLead] ?? "";
    const cmp = String(va).localeCompare(String(vb), "ru", { numeric: true });
    return sortDir === "asc" ? cmp : -cmp;
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  // ── Drag & Drop ────────────────────────────────────────────────────────────
  async function onDrop(col: string) {
    setDragOver(null);
    const id = draggingId.current;
    draggingId.current = null;
    if (!id) return;
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.status === col) return;
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, status: col } : l));
    try { await apiUpdateLead(id, { status: col as CrmStatus }); }
    catch { setLeads((prev) => prev.map((l) => l.id === id ? { ...l, status: lead.status } : l)); }
  }

  // ── Create ─────────────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent, force = false) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Имя обязательно"); return; }
    setError(""); setSubmitting(true); setDuplicateWarning(null);
    try {
      const extra: Record<string, string> = {};
      if (form.extra.trim()) extra.note = form.extra.trim();
      const body = { name: form.name.trim(), phone: form.phone.trim() || undefined, email: form.email.trim() || undefined, source: form.source, custom_fields: extra, ...(force ? { force: true } : {}) };
      const res = await apiCreateLead(body as Parameters<typeof apiCreateLead>[0]);
      if ((res as Record<string, unknown>).duplicate) {
        setDuplicateWarning((res as Record<string, unknown>).existing as { id: string; name: string });
        setSubmitting(false);
        return;
      }
      setLeads((prev) => [res.lead, ...prev]);
      setShowCreate(false); setForm(EMPTY_FORM);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally { setSubmitting(false); }
  }

  // ── Bulk ───────────────────────────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === sortedList.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(sortedList.map((l) => l.id)));
  }

  async function executeBulk() {
    if (!bulkAction || selectedIds.size === 0) return;
    if (bulkAction === "delete" && !confirm(`Удалить ${selectedIds.size} заявок?`)) return;
    setBulkLoading(true);
    try {
      await apiBulkLeads(bulkAction as "status" | "assign" | "delete", [...selectedIds], bulkValue);
      setSelectedIds(new Set());
      setBulkAction("");
      setBulkValue("");
      await loadAll();
    } catch { /* ignore */ }
    finally { setBulkLoading(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить заявку?")) return;
    setLeads((prev) => prev.filter((l) => l.id !== id));
    try { await apiDeleteLead(id); } catch { loadAll(); }
  }

  // ── Settings handlers ──────────────────────────────────────────────────────
  const handleTagCreate = useCallback(async (name: string, color: string) => {
    const res = await apiCreateTag(name, color);
    setTags((p) => [...p, res.tag]);
  }, []);

  const handleTagUpdate = useCallback(async (id: string, name: string, color: string) => {
    const res = await apiUpdateTag(id, { name, color });
    setTags((p) => p.map((t) => t.id === id ? res.tag : t));
    setLeads((p) => p.map((l) => ({ ...l, tags: l.tags?.map((t) => t.id === id ? res.tag : t) })));
  }, []);

  const handleTagDelete = useCallback(async (id: string) => {
    await apiDeleteTag(id);
    setTags((p) => p.filter((t) => t.id !== id));
    setLeads((p) => p.map((l) => ({ ...l, tags: l.tags?.filter((t) => t.id !== id) })));
  }, []);

  const handleColCreate = useCallback(async (name: string, color: string) => {
    const res = await apiCreateCrmColumn(name, color);
    setCustomColumns((p) => [...p, res.column]);
  }, []);

  const handleColDelete = useCallback(async (id: string) => {
    await apiDeleteCrmColumn(id);
    setCustomColumns((p) => p.filter((c) => c.id !== id));
  }, []);

  const handleFieldCreate = useCallback(async (name: string, type: string) => {
    const res = await apiCreateCrmField(name, type);
    setFields((p) => [...p, res.field]);
  }, []);

  const handleFieldDelete = useCallback(async (id: string) => {
    await apiDeleteCrmField(id);
    setFields((p) => p.filter((f) => f.id !== id));
  }, []);

  const handleSourceCreate = useCallback(async (name: string) => {
    const res = await apiCreateSource(name);
    setSources((p) => [...p, res.source]);
  }, []);

  const handleSourceUpdate = useCallback(async (id: string, name: string) => {
    const res = await apiUpdateSource(id, name);
    setSources((p) => p.map((s) => s.id === id ? res.source : s));
  }, []);

  const handleSourceDelete = useCallback(async (id: string) => {
    await apiDeleteSource(id);
    setSources((p) => p.filter((s) => s.id !== id));
  }, []);

  const sourceLabel = (src: string) => sources.find((s) => s.id === src)?.name ?? DEFAULT_SOURCE_LABELS[src] ?? src;

  // ── Column header style ────────────────────────────────────────────────────
  function colBorderStyle(col: typeof allColumns[0]) {
    if (col.borderClass) return {};
    return { borderTopColor: (col as typeof col & { customColor?: string }).customColor ?? "#6366F1" };
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Sub-header */}
        <div className="bg-white border-b border-[#E2E8F0] px-6 py-3 flex items-center justify-between gap-3 flex-wrap flex-shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-semibold text-[#1E293B]">CRM — Заявки</h1>
            {hasProfit && (
              <span className="text-sm text-[#64748B]">
                Прибыль: <strong className="text-green-600">{fmtMoney(totalProfit)}</strong>
              </span>
            )}
            <span className="text-xs text-[#94A3B8]">{filtered.length} заявок</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск…"
              className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" />

            {/* Extended filters toggle */}
            <button onClick={() => setShowFilters((p) => !p)}
              className={`border px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-colors ${showFilters || filterSource || filterDateFrom || filterDateTo ? "border-[#2563EB] text-[#2563EB] bg-blue-50" : "border-[#E2E8F0] text-[#64748B] hover:bg-[#F8F9FA]"}`}
              title="Фильтры">
              Фильтры {(filterSource || filterDateFrom || filterDateTo) ? "●" : ""}
            </button>

            {/* Analytics */}
            <button onClick={openAnalytics}
              className="border border-[#E2E8F0] px-3 py-1.5 rounded-lg text-sm text-[#64748B] hover:bg-[#F8F9FA] cursor-pointer" title="Аналитика">
              📊
            </button>

            {/* Notifications bell */}
            <div className="relative">
              <button onClick={() => setShowNotifications((p) => !p)}
                className="relative border border-[#E2E8F0] px-3 py-1.5 rounded-lg text-sm text-[#64748B] hover:bg-[#F8F9FA] cursor-pointer">
                🔔
                {notifications.some((n) => !n.read) && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {notifications.filter((n) => !n.read).length}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-9 w-80 bg-white border border-[#E2E8F0] rounded-xl shadow-xl z-30">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#F1F5F9]">
                    <span className="font-semibold text-sm text-[#1E293B]">Уведомления</span>
                    {notifications.some((n) => !n.read) && (
                      <button onClick={markAllRead} className="text-xs text-[#2563EB] hover:underline cursor-pointer">Прочитать все</button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 && <p className="text-sm text-[#94A3B8] text-center py-6">Нет уведомлений</p>}
                    {notifications.map((n) => (
                      <div key={n.id} onClick={() => { markRead(n.id); setShowNotifications(false); if (n.lead_id) navigate(`/crm/${n.lead_id}`); }}
                        className={`flex gap-3 px-4 py-3 border-b border-[#F1F5F9] last:border-0 cursor-pointer hover:bg-[#F8FAFC] ${!n.read ? "bg-blue-50/50" : ""}`}>
                        <span className="text-lg shrink-0">{n.type === "assigned" ? "👤" : "🔔"}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${!n.read ? "font-medium text-[#1E293B]" : "text-[#64748B]"}`}>{n.message}</p>
                          <p className="text-xs text-[#94A3B8] mt-0.5">{new Date(n.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                        {!n.read && <span className="w-2 h-2 rounded-full bg-[#2563EB] shrink-0 mt-1.5" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* View toggle */}
            <div className="flex border border-[#E2E8F0] rounded-lg overflow-hidden">
              <button onClick={() => switchView("kanban")} title="Канбан"
                className={`px-3 py-1.5 text-sm cursor-pointer transition-colors ${view === "kanban" ? "bg-[#2563EB] text-white" : "bg-white text-[#64748B] hover:bg-[#F8F9FA]"}`}>
                ⬛ Канбан
              </button>
              <button onClick={() => switchView("list")} title="Список"
                className={`px-3 py-1.5 text-sm cursor-pointer transition-colors border-l border-[#E2E8F0] ${view === "list" ? "bg-[#2563EB] text-white" : "bg-white text-[#64748B] hover:bg-[#F8F9FA]"}`}>
                ☰ Список
              </button>
            </div>

            <button onClick={() => setShowSettings(true)}
              className="border border-[#E2E8F0] px-3 py-1.5 rounded-lg text-sm text-[#64748B] hover:bg-[#F8F9FA] cursor-pointer" title="Настройки">
              ⚙️
            </button>

            <button onClick={() => setShowCreate(true)}
              className="bg-[#2563EB] text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-[#1D4ED8] cursor-pointer whitespace-nowrap">
              + Новая заявка
            </button>
          </div>
        </div>

        {/* Extended filters panel */}
        {showFilters && (
          <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-6 py-3 flex items-center gap-3 flex-wrap flex-shrink-0">
            <select value={filterAssigned} onChange={(e) => setFilterAssigned(e.target.value)}
              className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm focus:outline-none cursor-pointer bg-white">
              <option value="">Все сотрудники</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)}
              className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm focus:outline-none cursor-pointer bg-white">
              <option value="">Все источники</option>
              {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div className="flex items-center gap-1.5 text-sm text-[#64748B]">
              <span>С</span>
              <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)}
                className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#2563EB] cursor-pointer bg-white" />
              <span>по</span>
              <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)}
                className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#2563EB] cursor-pointer bg-white" />
            </div>
            {(filterSource || filterDateFrom || filterDateTo || filterAssigned) && (
              <button onClick={() => { setFilterSource(""); setFilterDateFrom(""); setFilterDateTo(""); setFilterAssigned(""); }}
                className="text-xs text-red-500 hover:underline cursor-pointer">Сбросить</button>
            )}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-[#64748B]">Загрузка…</div>
        ) : view === "kanban" ? (
          // ── Kanban ──────────────────────────────────────────────────────────
          <div className="flex-1 overflow-auto p-6">
            <div className="flex gap-4 min-w-max h-full">
              {allColumns.map((col) => {
                const colLeads = byStatus(col.id);
                const colProfit = colLeads.reduce((s, l) => s + (l.profit ?? 0), 0);
                const colHasProfit = colLeads.some((l) => l.profit != null);
                const isOver = dragOver === col.id;
                return (
                  <div key={col.id}
                    className={`w-72 flex flex-col rounded-xl border-t-4 bg-white shadow-sm transition-shadow ${col.borderClass || "border-t-[#6366F1]"} ${isOver ? "shadow-lg ring-2 ring-blue-300" : ""}`}
                    style={colBorderStyle(col)}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(col.id); }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={() => onDrop(col.id)}
                  >
                    <div className="px-4 py-3 flex items-center justify-between border-b border-[#F1F5F9]">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: col.color || "#6366F1" }} />
                        <span className="font-semibold text-sm text-[#1E293B]">{col.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {colHasProfit && <span className="text-[10px] text-green-600 font-medium">{fmtMoney(colProfit)}</span>}
                        <span className="text-xs bg-[#F1F5F9] text-[#64748B] px-2 py-0.5 rounded-full font-medium">{colLeads.length}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 p-3 overflow-y-auto">
                      {colLeads.length === 0 && (
                        <div className="text-xs text-[#CBD5E1] text-center py-6 select-none">Перетащите заявку сюда</div>
                      )}
                      {colLeads.map((lead) => (
                        <KanbanCard key={lead.id} lead={lead} tags={tags} sourceLabel={sourceLabel}
                          onDragStart={() => { draggingId.current = lead.id; }}
                          onDelete={() => handleDelete(lead.id)}
                          onTagToggle={async (tagId, has) => {
                            if (has) await apiRemoveLeadTag(lead.id, tagId);
                            else await apiAddLeadTag(lead.id, tagId);
                            const updated = has
                              ? lead.tags?.filter((t) => t.id !== tagId)
                              : [...(lead.tags ?? []), tags.find((t) => t.id === tagId)!].filter(Boolean);
                            setLeads((p) => p.map((l) => l.id === lead.id ? { ...l, tags: updated } : l));
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          // ── List view ──────────────────────────────────────────────────────
          <div className="flex-1 overflow-auto p-6 flex flex-col gap-3">
            {/* Bulk action bar */}
            {selectedIds.size > 0 && (
              <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl px-4 py-2.5 flex items-center gap-3 flex-wrap flex-shrink-0">
                <span className="text-sm font-medium text-[#2563EB]">Выбрано: {selectedIds.size}</span>
                <select value={bulkAction} onChange={(e) => { setBulkAction(e.target.value); setBulkValue(""); }}
                  className="border border-[#BFDBFE] rounded-lg px-2 py-1 text-sm focus:outline-none cursor-pointer bg-white">
                  <option value="">Действие…</option>
                  <option value="status">Сменить статус</option>
                  <option value="assign">Назначить</option>
                  <option value="delete">Удалить</option>
                </select>
                {bulkAction === "status" && (
                  <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}
                    className="border border-[#BFDBFE] rounded-lg px-2 py-1 text-sm focus:outline-none cursor-pointer bg-white">
                    <option value="">Выберите статус…</option>
                    {allColumns.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                )}
                {bulkAction === "assign" && (
                  <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}
                    className="border border-[#BFDBFE] rounded-lg px-2 py-1 text-sm focus:outline-none cursor-pointer bg-white">
                    <option value="">Не назначен</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                )}
                <button onClick={executeBulk} disabled={bulkLoading || !bulkAction || (bulkAction !== "delete" && !bulkValue)}
                  className="px-3 py-1 bg-[#2563EB] text-white text-sm rounded-lg hover:bg-[#1D4ED8] disabled:opacity-40 cursor-pointer">
                  {bulkLoading ? "…" : "Применить"}
                </button>
                <button onClick={() => setSelectedIds(new Set())} className="text-xs text-[#64748B] hover:text-[#1E293B] cursor-pointer ml-auto">Снять выделение</button>
              </div>
            )}
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F8F9FA] border-b border-[#E2E8F0]">
                    <th className="px-4 py-3 w-10">
                      <input type="checkbox" checked={sortedList.length > 0 && selectedIds.size === sortedList.length}
                        onChange={toggleSelectAll} className="cursor-pointer" />
                    </th>
                    {([
                      { key: "name", label: "Имя" },
                      { key: null, label: "Телефон" },
                      { key: null, label: "Email" },
                      { key: null, label: "Источник" },
                      { key: "status", label: "Статус" },
                      { key: "profit", label: "Прибыль" },
                      { key: null, label: "Ответственный" },
                      { key: null, label: "Теги" },
                      { key: "created_at", label: "Дата" },
                      { key: null, label: "" },
                    ] as { key: SortKey | null; label: string }[]).map(({ key, label }) => (
                      <th key={label} className="text-left text-xs font-semibold text-[#64748B] px-4 py-3 whitespace-nowrap">
                        {key ? (
                          <button onClick={() => toggleSort(key)} className="flex items-center gap-1 cursor-pointer hover:text-[#1E293B]">
                            {label}
                            <span className="text-[10px]">{sortKey === key ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
                          </button>
                        ) : label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedList.length === 0 && (
                    <tr><td colSpan={11} className="text-center py-16 text-[#94A3B8]">Заявок нет</td></tr>
                  )}
                  {sortedList.map((lead) => {
                    const colDef = allColumns.find((c) => c.id === lead.status);
                    const isSelected = selectedIds.has(lead.id);
                    return (
                      <tr key={lead.id}
                        className={`border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] cursor-pointer ${isSelected ? "bg-blue-50/40" : ""}`}>
                        <td className="px-4 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(lead.id)} className="cursor-pointer" />
                        </td>
                        <td className="px-4 py-3 font-medium text-sm text-[#1E293B]" onClick={() => navigate(`/crm/${lead.id}`)}>{lead.name}</td>
                        <td className="px-4 py-3 text-sm text-[#64748B]" onClick={() => navigate(`/crm/${lead.id}`)}>{lead.phone ?? "—"}</td>
                        <td className="px-4 py-3 text-sm text-[#64748B]" onClick={() => navigate(`/crm/${lead.id}`)}>{lead.email ?? "—"}</td>
                        <td className="px-4 py-3 text-sm text-[#64748B]" onClick={() => navigate(`/crm/${lead.id}`)}>{sourceLabel(lead.source)}</td>
                        <td className="px-4 py-3" onClick={() => navigate(`/crm/${lead.id}`)}>
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{ background: (colDef?.color ?? "#6366F1") + "20", color: colDef?.color ?? "#6366F1" }}>
                            {colDef?.label ?? lead.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-green-600 font-medium" onClick={() => navigate(`/crm/${lead.id}`)}>{fmtMoney(lead.profit)}</td>
                        <td className="px-4 py-3 text-sm text-[#64748B]" onClick={() => navigate(`/crm/${lead.id}`)}>{lead.assignee_name ?? "—"}</td>
                        <td className="px-4 py-3" onClick={() => navigate(`/crm/${lead.id}`)}>
                          <div className="flex gap-1 flex-wrap">
                            {lead.tags?.slice(0, 3).map((t) => (
                              <span key={t.id} className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-medium" style={{ background: t.color }}>{t.name}</span>
                            ))}
                            {(lead.tags?.length ?? 0) > 3 && <span className="text-[10px] text-[#94A3B8]">+{(lead.tags?.length ?? 0) - 3}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#94A3B8]" onClick={() => navigate(`/crm/${lead.id}`)}>{fmtDate(lead.created_at)}</td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => handleDelete(lead.id)} className="text-[#94A3B8] hover:text-red-500 cursor-pointer text-sm">🗑️</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => { setShowCreate(false); setDuplicateWarning(null); }}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-[#1E293B] mb-4">Новая заявка</h2>
            {duplicateWarning ? (
              <div className="flex flex-col gap-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-yellow-800">⚠️ Возможный дубликат</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Лид с таким телефоном уже существует: <strong>{duplicateWarning.name}</strong>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { navigate(`/crm/${duplicateWarning.id}`); setShowCreate(false); setDuplicateWarning(null); }}
                    className="flex-1 px-4 py-2 text-sm border border-[#2563EB] text-[#2563EB] rounded-lg hover:bg-blue-50 cursor-pointer">
                    Открыть существующий
                  </button>
                  <button onClick={(e) => handleCreate(e, true)}
                    className="flex-1 px-4 py-2 text-sm bg-[#2563EB] text-white rounded-lg hover:bg-[#1D4ED8] cursor-pointer">
                    Создать всё равно
                  </button>
                </div>
                <button onClick={() => setDuplicateWarning(null)} className="text-sm text-[#64748B] hover:underline cursor-pointer text-center">← Вернуться к форме</button>
              </div>
            ) : (
              <form onSubmit={(e) => handleCreate(e)} className="flex flex-col gap-3">
                {[
                  { label: "Имя *", val: form.name, key: "name" as keyof CreateForm, ph: "Иван Иванов" },
                  { label: "Телефон", val: form.phone, key: "phone" as keyof CreateForm, ph: "+7 900 000-00-00" },
                  { label: "Email", val: form.email, key: "email" as keyof CreateForm, ph: "ivan@example.com" },
                ].map(({ label, val, key, ph }) => (
                  <div key={key} className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-[#1E293B]">{label}</label>
                    <input value={val} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} placeholder={ph}
                      className="border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" />
                  </div>
                ))}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#1E293B]">Источник</label>
                  <select value={form.source} onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))}
                    className="border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]">
                    {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#1E293B]">Заметка</label>
                  <textarea value={form.extra} onChange={(e) => setForm((p) => ({ ...p, extra: e.target.value }))}
                    rows={2} className="border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] resize-none" />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <div className="flex gap-2 justify-end pt-1">
                  <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border border-[#E2E8F0] rounded-lg hover:bg-[#F8F9FA] cursor-pointer">Отмена</button>
                  <button type="submit" disabled={submitting} className="px-4 py-2 text-sm bg-[#2563EB] text-white rounded-lg hover:bg-[#1D4ED8] disabled:opacity-50 cursor-pointer">
                    {submitting ? "Создаю…" : "Создать"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          tags={tags} columns={customColumns} fields={fields} sources={sources}
          onClose={() => setShowSettings(false)}
          onTagCreate={handleTagCreate} onTagUpdate={handleTagUpdate} onTagDelete={handleTagDelete}
          onColCreate={handleColCreate} onColDelete={handleColDelete}
          onFieldCreate={handleFieldCreate} onFieldDelete={handleFieldDelete}
          onSourceCreate={handleSourceCreate} onSourceUpdate={handleSourceUpdate} onSourceDelete={handleSourceDelete}
        />
      )}

      {/* Analytics modal */}
      {showAnalytics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowAnalytics(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
              <h2 className="font-semibold text-[#1E293B]">📊 Аналитика CRM</h2>
              <button onClick={() => setShowAnalytics(false)} className="text-[#94A3B8] hover:text-[#64748B] cursor-pointer">✕</button>
            </div>
            {analyticsLoading ? (
              <div className="flex items-center justify-center py-16 text-[#64748B]">Загрузка…</div>
            ) : analytics ? (
              <div className="p-6 flex flex-col gap-6">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-[#F8FAFC] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-[#1E293B]">{analytics.total.count}</p>
                    <p className="text-sm text-[#64748B] mt-1">Всего заявок</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {analytics.total.profit != null ? analytics.total.profit.toLocaleString("ru-RU") + " ₽" : "—"}
                    </p>
                    <p className="text-sm text-[#64748B] mt-1">Общая прибыль</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-red-500">{analytics.overdueTasks}</p>
                    <p className="text-sm text-[#64748B] mt-1">Просроченных задач</p>
                  </div>
                </div>

                {/* Funnel by status */}
                <div>
                  <h3 className="font-semibold text-sm text-[#1E293B] mb-3">Воронка по статусам</h3>
                  <div className="flex flex-col gap-2">
                    {analytics.byStatus.map((s) => {
                      const colDef = allColumns.find((c) => c.id === s.status);
                      const pct = analytics.total.count > 0 ? Math.round((s.count / analytics.total.count) * 100) : 0;
                      return (
                        <div key={s.status} className="flex items-center gap-3">
                          <span className="text-sm text-[#64748B] w-32 shrink-0 truncate">{colDef?.label ?? s.status}</span>
                          <div className="flex-1 bg-[#F1F5F9] rounded-full h-5 overflow-hidden">
                            <div className="h-5 rounded-full flex items-center justify-end pr-2 transition-all"
                              style={{ width: `${Math.max(pct, 4)}%`, background: colDef?.color ?? "#6366F1" }}>
                              <span className="text-[10px] text-white font-bold">{pct}%</span>
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-[#1E293B] w-8 text-right shrink-0">{s.count}</span>
                          {s.profit != null && s.profit > 0 && (
                            <span className="text-xs text-green-600 w-28 text-right shrink-0">{s.profit.toLocaleString("ru-RU")} ₽</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* By source */}
                <div>
                  <h3 className="font-semibold text-sm text-[#1E293B] mb-3">По источникам</h3>
                  <div className="flex gap-3 flex-wrap">
                    {analytics.bySource.map((s) => (
                      <div key={s.source} className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-4 py-3 text-center">
                        <p className="text-xl font-bold text-[#1E293B]">{s.count}</p>
                        <p className="text-xs text-[#64748B] mt-0.5">{sourceLabel(s.source)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-center py-8 text-[#94A3B8]">Нет данных</p>
            )}
          </div>
        </div>
      )}

      {/* Backdrop for notifications */}
      {showNotifications && <div className="fixed inset-0 z-20" onClick={() => setShowNotifications(false)} />}
    </AppLayout>
  );
}

// ── Kanban card ───────────────────────────────────────────────────────────────

function KanbanCard({ lead, tags, sourceLabel, onDragStart, onDelete, onTagToggle }: {
  lead: CrmLead; tags: CrmTag[]; sourceLabel: (src: string) => string;
  onDragStart: () => void; onDelete: () => void;
  onTagToggle: (tagId: string, hasTag: boolean) => void;
}) {
  const navigate = useNavigate();
  const [showTagMenu, setShowTagMenu] = useState(false);
  const leadTagIds = new Set(lead.tags?.map((t) => t.id) ?? []);

  return (
    <div draggable onDragStart={onDragStart}
      className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between gap-1 mb-2">
        <button onClick={() => navigate(`/crm/${lead.id}`)}
          className="font-medium text-sm text-[#1E293B] hover:text-[#2563EB] text-left leading-snug cursor-pointer flex-1">{lead.name}</button>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={() => navigate(`/crm/${lead.id}`)} className="text-[#64748B] hover:text-[#2563EB] p-0.5 cursor-pointer">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
          <button onClick={onDelete} className="text-[#64748B] hover:text-red-500 p-0.5 cursor-pointer">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1 text-xs text-[#64748B]">
        {lead.phone && <span>📞 {lead.phone}</span>}
        {lead.email && <span className="truncate">✉️ {lead.email}</span>}
        {lead.profit != null && <span className="text-green-600 font-medium">💰 {lead.profit.toLocaleString("ru-RU")} ₽</span>}
        {lead.assignee_name && <span className="text-[#2563EB]">👤 {lead.assignee_name}</span>}
      </div>

      {/* Tags */}
      {(lead.tags?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {lead.tags!.map((t) => (
            <span key={t.id} className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-medium" style={{ background: t.color }}>{t.name}</span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[#E2E8F0]">
        <span className="text-[10px] text-[#94A3B8]">{sourceLabel(lead.source)}</span>
        <div className="flex items-center gap-2">
          {tags.length > 0 && (
            <div className="relative">
              <button onClick={() => setShowTagMenu((p) => !p)} className="text-[10px] text-[#94A3B8] hover:text-[#2563EB] cursor-pointer opacity-0 group-hover:opacity-100">🏷️</button>
              {showTagMenu && (
                <div className="absolute right-0 bottom-5 bg-white border border-[#E2E8F0] rounded-lg shadow-lg p-2 z-20 min-w-32">
                  {tags.map((t) => (
                    <button key={t.id} onClick={() => { onTagToggle(t.id, leadTagIds.has(t.id)); setShowTagMenu(false); }}
                      className="flex items-center gap-2 w-full text-left px-2 py-1 text-xs hover:bg-[#F8F9FA] rounded cursor-pointer">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                      <span>{t.name}</span>
                      {leadTagIds.has(t.id) && <span className="ml-auto text-green-500">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <span className="text-[10px] text-[#94A3B8]">{fmtDate(lead.created_at)}</span>
        </div>
      </div>
    </div>
  );
}
