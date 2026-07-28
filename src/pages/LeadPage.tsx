import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "../components/AppLayout";
import type { CrmLead, CrmComment, CrmTask, CrmHistoryEntry, CrmStatus, CrmTag, CrmMember, CrmLeadFile } from "../types";
import {
  apiGetLead, apiUpdateLead, apiDeleteLead,
  apiAddComment, apiDeleteComment,
  apiCreateTask, apiUpdateTask, apiDeleteTask,
  apiGetTags, apiAddLeadTag, apiRemoveLeadTag,
  apiGetCrmMembers,
  apiUploadLeadFile, apiDeleteLeadFile, apiLeadFileDownloadUrl,
} from "../api";

const STATUS_OPTIONS: { id: CrmStatus; label: string; color: string; dot: string }[] = [
  { id: "new",        label: "Новая заявка",  color: "#3B82F6", dot: "bg-blue-500" },
  { id: "calculating",label: "В расчете",     color: "#EAB308", dot: "bg-yellow-500" },
  { id: "in_progress",label: "В работе",      color: "#22C55E", dot: "bg-green-500" },
  { id: "rejected",   label: "Не интересно",  color: "#F87171", dot: "bg-red-400" },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtFileSize(bytes: number) {
  if (bytes < 1024) return bytes + " Б";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " КБ";
  return (bytes / 1024 / 1024).toFixed(1) + " МБ";
}

type LeadWithProfit = CrmLead & { profit?: number | null };
type ActivityItem =
  | { kind: "comment"; data: CrmComment }
  | { kind: "history"; data: CrmHistoryEntry };

export function LeadPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [lead, setLead] = useState<LeadWithProfit | null>(null);
  const [comments, setComments] = useState<CrmComment[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [history, setHistory] = useState<CrmHistoryEntry[]>([]);
  const [files, setFiles] = useState<CrmLeadFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"feed" | "tasks" | "files" | "info">("feed");

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", phone: "", email: "", profit: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  const [editingProfit, setEditingProfit] = useState(false);
  const [profitInput, setProfitInput] = useState("");
  const [savingProfit, setSavingProfit] = useState(false);

  // Custom field inline edit
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editFieldVal, setEditFieldVal] = useState("");
  const [savingField, setSavingField] = useState(false);

  // Task editing
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskForm, setEditTaskForm] = useState({ title: "", due_date: "", priority: "normal" });
  const [savingTask, setSavingTask] = useState(false);

  // New task
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskPriority, setTaskPriority] = useState("normal");
  const [addingTask, setAddingTask] = useState(false);

  // Comment + @mentions
  const [commentText, setCommentText] = useState("");
  const [addingComment, setAddingComment] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState<CrmMember[]>([]);
  const commentRef = useRef<HTMLInputElement>(null);

  // Files
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tags & members
  const [allTags, setAllTags] = useState<CrmTag[]>([]);
  const [members, setMembers] = useState<CrmMember[]>([]);
  const [savingAssignee, setSavingAssignee] = useState(false);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiGetTags().then((r) => setAllTags(r.tags)).catch(() => {});
    apiGetCrmMembers().then((r) => setMembers(r.members)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiGetLead(id)
      .then((res) => {
        const l = res.lead as LeadWithProfit;
        setLead(l);
        setComments(res.comments);
        setTasks(res.tasks);
        setHistory(res.history);
        setFiles(res.files ?? []);
        setEditForm({ name: l.name, phone: l.phone ?? "", email: l.email ?? "", profit: l.profit != null ? String(l.profit) : "" });
        setProfitInput(l.profit != null ? String(l.profit) : "");
      })
      .catch(() => navigate("/crm"))
      .finally(() => setLoading(false));
  }, [id]);

  async function refresh() {
    if (!id) return;
    const res = await apiGetLead(id);
    setHistory(res.history);
    setComments(res.comments);
    setFiles(res.files ?? []);
  }

  // ── Status ────────────────────────────────────────────────────────────────────
  async function changeStatus(s: CrmStatus) {
    if (!lead || lead.status === s) return;
    const prev = lead.status;
    setLead({ ...lead, status: s });
    try {
      const res = await apiUpdateLead(lead.id, { status: s });
      setLead({ ...res.lead, profit: lead.profit } as LeadWithProfit);
      await refresh();
    } catch { setLead({ ...lead, status: prev }); }
  }

  // ── Edit ──────────────────────────────────────────────────────────────────────
  async function saveEdit() {
    if (!lead) return;
    setSavingEdit(true);
    try {
      const profitVal = editForm.profit.trim() !== "" ? parseFloat(editForm.profit.replace(/\s/g, "").replace(",", ".")) : null;
      const body: Parameters<typeof apiUpdateLead>[1] = {
        name: editForm.name.trim(),
        phone: editForm.phone.trim() || undefined,
        email: editForm.email.trim() || undefined,
      };
      if (editForm.profit.trim() !== "") (body as Record<string, unknown>).profit = profitVal;
      const res = await apiUpdateLead(lead.id, body);
      setLead({ ...res.lead, profit: profitVal } as LeadWithProfit);
      await refresh();
      setEditing(false);
    } catch { /* ignore */ }
    finally { setSavingEdit(false); }
  }

  async function saveProfit() {
    if (!lead) return;
    setSavingProfit(true);
    try {
      const val = profitInput.trim() !== "" ? parseFloat(profitInput.replace(/\s/g, "").replace(",", ".")) : null;
      await apiUpdateLead(lead.id, { profit: val } as Parameters<typeof apiUpdateLead>[1]);
      setLead({ ...lead, profit: val });
      setEditingProfit(false);
      await refresh();
    } catch { /* ignore */ }
    finally { setSavingProfit(false); }
  }

  // ── Custom field inline edit ───────────────────────────────────────────────
  async function saveField(key: string) {
    if (!lead) return;
    setSavingField(true);
    try {
      const cf = { ...(lead.custom_fields ?? {}), [key]: editFieldVal };
      await apiUpdateLead(lead.id, { custom_fields: cf } as Parameters<typeof apiUpdateLead>[1]);
      setLead({ ...lead, custom_fields: cf });
      setEditingField(null);
    } catch { /* ignore */ }
    finally { setSavingField(false); }
  }

  // ── Assignee ──────────────────────────────────────────────────────────────────
  async function changeAssignee(userId: string | null) {
    if (!lead) return;
    setSavingAssignee(true);
    try {
      const res = await apiUpdateLead(lead.id, { assigned_to: userId } as Parameters<typeof apiUpdateLead>[1]);
      setLead({ ...lead, assigned_to: userId, assignee_name: res.lead.assignee_name } as LeadWithProfit);
      await refresh();
    } catch { /* ignore */ }
    finally { setSavingAssignee(false); }
  }

  // ── Tags ──────────────────────────────────────────────────────────────────────
  async function toggleTag(tagId: string) {
    if (!lead) return;
    const has = lead.tags?.some((t) => t.id === tagId);
    if (has) {
      await apiRemoveLeadTag(lead.id, tagId);
      setLead({ ...lead, tags: lead.tags?.filter((t) => t.id !== tagId) } as LeadWithProfit);
    } else {
      await apiAddLeadTag(lead.id, tagId);
      const tag = allTags.find((t) => t.id === tagId);
      if (tag) setLead({ ...lead, tags: [...(lead.tags ?? []), tag] } as LeadWithProfit);
    }
  }

  // ── Comments + @mentions ──────────────────────────────────────────────────────
  function handleCommentInput(val: string) {
    setCommentText(val);
    const atMatch = val.match(/@(\w*)$/);
    if (atMatch) {
      const q = atMatch[1].toLowerCase();
      setMentionSuggestions(members.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 5));
    } else {
      setMentionSuggestions([]);
    }
  }

  function insertMention(member: CrmMember) {
    const text = commentText.replace(/@\w*$/, `@${member.name} `);
    setCommentText(text);
    setMentionSuggestions([]);
    commentRef.current?.focus();
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!lead || !commentText.trim()) return;
    setAddingComment(true);
    try {
      const res = await apiAddComment(lead.id, commentText.trim());
      setComments((p) => [...p, res.comment]);
      setCommentText("");
      setMentionSuggestions([]);
      await refresh();
    } catch { /* ignore */ }
    finally { setAddingComment(false); }
  }

  async function removeComment(cid: string) {
    if (!lead) return;
    setComments((p) => p.filter((c) => c.id !== cid));
    try { await apiDeleteComment(lead.id, cid); } catch { /* ignore */ }
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────────
  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!lead || !taskTitle.trim()) return;
    setAddingTask(true);
    try {
      const res = await apiCreateTask(lead.id, { title: taskTitle.trim(), due_date: taskDueDate || null, priority: taskPriority });
      setTasks((p) => [...p, res.task]);
      setTaskTitle(""); setTaskDueDate(""); setTaskPriority("normal");
      await refresh();
    } catch { /* ignore */ }
    finally { setAddingTask(false); }
  }

  async function toggleTask(task: CrmTask) {
    if (!lead) return;
    const next = !task.done;
    setTasks((p) => p.map((t) => t.id === task.id ? { ...t, done: next ? 1 : 0 } : t));
    try { await apiUpdateTask(lead.id, task.id, { done: next }); await refresh(); }
    catch { setTasks((p) => p.map((t) => t.id === task.id ? { ...t, done: task.done } : t)); }
  }

  function startEditTask(task: CrmTask) {
    setEditingTaskId(task.id);
    setEditTaskForm({ title: task.title, due_date: task.due_date ?? "", priority: task.priority ?? "normal" });
  }

  async function saveTask() {
    if (!lead || !editingTaskId || !editTaskForm.title.trim()) return;
    setSavingTask(true);
    try {
      const res = await apiUpdateTask(lead.id, editingTaskId, {
        title: editTaskForm.title.trim(),
        due_date: editTaskForm.due_date || null,
        priority: editTaskForm.priority,
      });
      setTasks((p) => p.map((t) => t.id === editingTaskId ? res.task : t));
      setEditingTaskId(null);
    } catch { /* ignore */ }
    finally { setSavingTask(false); }
  }

  async function removeTask(task: CrmTask) {
    if (!lead) return;
    setTasks((p) => p.filter((t) => t.id !== task.id));
    try { await apiDeleteTask(lead.id, task.id); } catch { /* ignore */ }
  }

  // ── Files ─────────────────────────────────────────────────────────────────────
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!lead || !e.target.files?.length) return;
    setUploadingFile(true);
    try {
      for (const file of Array.from(e.target.files)) {
        const res = await apiUploadLeadFile(lead.id, file);
        setFiles((p) => [res.file, ...p]);
      }
      await refresh();
    } catch { /* ignore */ }
    finally { setUploadingFile(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  }

  async function deleteFile(fileId: string) {
    if (!lead || !confirm("Удалить файл?")) return;
    setFiles((p) => p.filter((f) => f.id !== fileId));
    try { await apiDeleteLeadFile(lead.id, fileId); } catch { /* ignore */ }
  }

  // ── Copy link ─────────────────────────────────────────────────────────────────
  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function deleteLead() {
    if (!lead || !confirm("Удалить заявку?")) return;
    await apiDeleteLead(lead.id);
    navigate("/crm");
  }

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-full text-[#64748B]">Загрузка…</div>
    </AppLayout>
  );
  if (!lead) return null;

  const doneTasks = tasks.filter((t) => t.done).length;
  const statusIdx = STATUS_OPTIONS.findIndex((o) => o.id === lead.status);

  // Unified activity feed: merge comments + history, sort by date desc
  const feed: ActivityItem[] = [
    ...comments.map((c) => ({ kind: "comment" as const, data: c })),
    ...history.map((h) => ({ kind: "history" as const, data: h })),
  ].sort((a, b) => {
    const ta = a.kind === "comment" ? a.data.created_at : a.data.created_at;
    const tb = b.kind === "comment" ? b.data.created_at : b.data.created_at;
    return tb.localeCompare(ta);
  });

  const PRIORITY_LABELS: Record<string, string> = { high: "↑ Высокий", normal: "", low: "↓ Низкий" };
  const PRIORITY_COLORS: Record<string, string> = { high: "text-red-500", normal: "text-[#94A3B8]", low: "text-[#CBD5E1]" };

  function renderCommentText(text: string) {
    const parts = text.split(/(@\S+)/g);
    return parts.map((p, i) =>
      p.startsWith("@") ? <span key={i} className="text-[#2563EB] font-medium">{p}</span> : p
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col gap-4">

        {/* Breadcrumb + copy link */}
        <div className="flex items-center gap-2 text-sm text-[#64748B]">
          <button onClick={() => navigate("/crm")} className="hover:text-[#2563EB] cursor-pointer">← CRM</button>
          <span>/</span>
          <span className="text-[#1E293B] font-medium truncate max-w-xs">{lead.name}</span>
          <button onClick={copyLink} title="Скопировать ссылку"
            className="ml-2 text-xs text-[#94A3B8] hover:text-[#2563EB] cursor-pointer border border-[#E2E8F0] px-2 py-0.5 rounded-lg transition-colors">
            {copied ? "✓ Скопировано" : "🔗 Ссылка"}
          </button>
        </div>

        {/* Status progress bar */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm px-6 py-4">
          <div className="flex items-center gap-0">
            {STATUS_OPTIONS.map((opt, idx) => {
              const isActive = lead.status === opt.id;
              const isPast = statusIdx > idx;
              return (
                <button key={opt.id} onClick={() => changeStatus(opt.id)}
                  className="flex-1 flex flex-col items-center gap-1.5 cursor-pointer group relative">
                  <div className="flex items-center w-full">
                    {idx > 0 && (
                      <div className={`h-0.5 flex-1 transition-colors ${isPast || isActive ? "" : "bg-[#E2E8F0]"}`}
                        style={isPast || isActive ? { background: opt.color } : {}} />
                    )}
                    <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                      isActive ? "border-current scale-110 shadow-md" : isPast ? "border-current" : "border-[#E2E8F0] bg-[#F8F9FA]"
                    }`} style={isActive || isPast ? { borderColor: opt.color, background: isActive ? opt.color : opt.color + "20" } : {}}>
                      {isPast && !isActive && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: opt.color }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      {isActive && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    {idx < STATUS_OPTIONS.length - 1 && (
                      <div className={`h-0.5 flex-1 transition-colors ${isPast ? "" : "bg-[#E2E8F0]"}`}
                        style={isPast ? { background: STATUS_OPTIONS[idx + 1]?.color ?? opt.color } : {}} />
                    )}
                  </div>
                  <span className={`text-[11px] font-medium transition-colors ${isActive ? "font-semibold" : "text-[#94A3B8] group-hover:text-[#64748B]"}`}
                    style={isActive ? { color: opt.color } : {}}>
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Top card */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              {editing ? (
                <div className="flex flex-col gap-3">
                  <input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                    className="text-xl font-bold border border-[#E2E8F0] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" />
                  <div className="flex gap-3 flex-wrap">
                    <input value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} placeholder="Телефон"
                      className="border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm flex-1 min-w-36 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" />
                    <input value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} placeholder="Email"
                      className="border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm flex-1 min-w-36 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" />
                    <input value={editForm.profit} onChange={(e) => setEditForm((p) => ({ ...p, profit: e.target.value }))} placeholder="Прибыль, ₽"
                      className="border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveEdit} disabled={savingEdit} className="px-4 py-1.5 bg-[#2563EB] text-white text-sm rounded-lg hover:bg-[#1D4ED8] disabled:opacity-50 cursor-pointer">
                      {savingEdit ? "Сохраняю…" : "Сохранить"}
                    </button>
                    <button onClick={() => setEditing(false)} className="px-4 py-1.5 border border-[#E2E8F0] text-sm rounded-lg hover:bg-[#F8F9FA] cursor-pointer">Отмена</button>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="text-2xl font-bold text-[#1E293B]">{lead.name}</h1>
                  <div className="flex flex-wrap gap-4 mt-2 text-sm text-[#64748B]">
                    {lead.phone && <span>📞 {lead.phone}</span>}
                    {lead.email && <span>✉️ {lead.email}</span>}
                    <span>📥 {lead.source}</span>
                    <span>🕐 {fmtDate(lead.created_at)}</span>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-sm text-[#64748B]">💰 Прибыль:</span>
                    {editingProfit ? (
                      <div className="flex items-center gap-2">
                        <input value={profitInput} onChange={(e) => setProfitInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveProfit(); if (e.key === "Escape") setEditingProfit(false); }}
                          autoFocus placeholder="0"
                          className="border border-[#2563EB] rounded-lg px-2 py-1 text-sm w-32 focus:outline-none" />
                        <span className="text-sm text-[#64748B]">₽</span>
                        <button onClick={saveProfit} disabled={savingProfit} className="text-xs bg-[#2563EB] text-white px-2 py-1 rounded cursor-pointer hover:bg-[#1D4ED8] disabled:opacity-50">
                          {savingProfit ? "…" : "✓"}
                        </button>
                        <button onClick={() => setEditingProfit(false)} className="text-xs text-[#94A3B8] hover:text-[#64748B] cursor-pointer">✕</button>
                      </div>
                    ) : (
                      <button onClick={() => { setProfitInput(lead.profit != null ? String(lead.profit) : ""); setEditingProfit(true); }}
                        className="text-sm font-semibold text-green-600 hover:underline cursor-pointer">
                        {lead.profit != null ? lead.profit.toLocaleString("ru-RU") + " ₽" : <span className="text-[#94A3B8] font-normal">Не указана</span>}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-sm text-[#64748B]">👤 Ответственный:</span>
                    <select value={lead.assigned_to ?? ""} disabled={savingAssignee} onChange={(e) => changeAssignee(e.target.value || null)}
                      className="border border-[#E2E8F0] rounded-lg px-2 py-1 text-sm focus:outline-none cursor-pointer bg-white">
                      <option value="">Не назначен</option>
                      {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>

                  {allTags.length > 0 && (
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-sm text-[#64748B]">🏷️ Теги:</span>
                      {allTags.map((tag) => {
                        const active = lead.tags?.some((t) => t.id === tag.id);
                        return (
                          <button key={tag.id} onClick={() => toggleTag(tag.id)}
                            className="text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer transition-opacity"
                            style={{ background: active ? tag.color : "#F1F5F9", color: active ? "white" : "#64748B" }}>
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {!editing && (
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setEditing(true)} className="text-xs border border-[#E2E8F0] px-3 py-1.5 rounded-lg hover:bg-[#F8F9FA] cursor-pointer">Редактировать</button>
                <button onClick={deleteLead} className="text-xs border border-red-200 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 cursor-pointer">Удалить</button>
              </div>
            )}
          </div>

          {tasks.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[#F1F5F9]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-[#64748B]">Задачи: {doneTasks}/{tasks.length}</span>
                <span className="text-xs text-[#64748B]">{Math.round((doneTasks / tasks.length) * 100)}%</span>
              </div>
              <div className="h-1.5 bg-[#F1F5F9] rounded-full">
                <div className="h-1.5 bg-[#2563EB] rounded-full transition-all" style={{ width: `${(doneTasks / tasks.length) * 100}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="flex border-b border-[#E2E8F0]">
            {([
              { key: "feed",  label: `Лента (${feed.length})` },
              { key: "tasks", label: `Задачи (${tasks.length})` },
              { key: "files", label: `Файлы (${files.length})` },
              { key: "info",  label: "Доп. поля" },
            ] as const).map(({ key, label }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`px-5 py-3 text-sm font-medium cursor-pointer transition-colors ${tab === key ? "border-b-2 border-[#2563EB] text-[#2563EB]" : "text-[#64748B] hover:text-[#1E293B]"}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="p-5">

            {/* ── Feed ── */}
            {tab === "feed" && (
              <div className="flex flex-col gap-4">
                {/* Comment form */}
                <div className="relative">
                  <form onSubmit={submitComment} className="flex gap-2">
                    <div className="flex-1 relative">
                      <input ref={commentRef} value={commentText} onChange={(e) => handleCommentInput(e.target.value)}
                        placeholder="Комментарий… Используйте @имя для упоминания"
                        className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" />
                      {mentionSuggestions.length > 0 && (
                        <div className="absolute left-0 top-full mt-1 bg-white border border-[#E2E8F0] rounded-lg shadow-lg z-20 w-full">
                          {mentionSuggestions.map((m) => (
                            <button key={m.id} type="button" onClick={() => insertMention(m)}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-[#F8F9FA] cursor-pointer text-left">
                              <span className="w-6 h-6 rounded-full bg-[#EFF6FF] text-[#2563EB] text-xs font-bold flex items-center justify-center shrink-0">
                                {m.name[0].toUpperCase()}
                              </span>
                              {m.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button type="submit" disabled={addingComment || !commentText.trim()}
                      className="px-4 py-2 bg-[#2563EB] text-white text-sm rounded-lg hover:bg-[#1D4ED8] disabled:opacity-40 cursor-pointer">
                      Отправить
                    </button>
                  </form>
                </div>

                {feed.length === 0 && <p className="text-sm text-[#94A3B8] text-center py-4">Активности пока нет</p>}

                {feed.map((item) => {
                  if (item.kind === "comment") {
                    const c = item.data;
                    return (
                      <div key={"c-" + c.id} className="flex gap-3 group">
                        <div className="w-8 h-8 rounded-full bg-[#EFF6FF] flex items-center justify-center text-sm font-bold text-[#2563EB] shrink-0">
                          {(c.user_name ?? "?")[0].toUpperCase()}
                        </div>
                        <div className="flex-1 bg-[#F8FAFC] rounded-xl px-4 py-3 border border-[#E2E8F0]">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-sm font-semibold text-[#1E293B]">{c.user_name ?? "Система"}</span>
                            <span className="text-xs text-[#94A3B8]">{fmtDate(c.created_at)}</span>
                            <button onClick={() => removeComment(c.id)}
                              className="ml-auto opacity-0 group-hover:opacity-100 text-[#94A3B8] hover:text-red-500 cursor-pointer text-xs transition-opacity">удалить</button>
                          </div>
                          <p className="text-sm text-[#475569] whitespace-pre-wrap">{renderCommentText(c.text)}</p>
                        </div>
                      </div>
                    );
                  }
                  const h = item.data;
                  return (
                    <div key={"h-" + h.id} className="flex gap-3 items-start text-sm">
                      <div className="w-8 h-8 rounded-full bg-[#F1F5F9] flex items-center justify-center text-[#94A3B8] shrink-0 text-xs">●</div>
                      <div className="flex-1 py-1">
                        <span className="font-medium text-[#64748B]">{h.user_name ?? "Система"}</span>
                        {" — "}
                        <span className="text-[#64748B]">{h.action}</span>
                        {h.details && <span className="text-[#94A3B8]">: {h.details}</span>}
                        <span className="text-xs text-[#CBD5E1] ml-2">{fmtDate(h.created_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Tasks ── */}
            {tab === "tasks" && (
              <div className="flex flex-col gap-2">
                {tasks.map((task) => {
                  const isOverdue = !task.done && task.due_date && task.due_date < new Date().toISOString().slice(0, 10);
                  const isDueToday = !task.done && task.due_date && task.due_date === new Date().toISOString().slice(0, 10);

                  if (editingTaskId === task.id) {
                    return (
                      <div key={task.id} className="border border-[#2563EB] rounded-lg p-3 flex flex-col gap-2 bg-blue-50/30">
                        <input value={editTaskForm.title} onChange={(e) => setEditTaskForm((p) => ({ ...p, title: e.target.value }))}
                          className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#2563EB]" />
                        <div className="flex gap-2">
                          <input type="date" value={editTaskForm.due_date} onChange={(e) => setEditTaskForm((p) => ({ ...p, due_date: e.target.value }))}
                            className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#2563EB] cursor-pointer" />
                          <select value={editTaskForm.priority} onChange={(e) => setEditTaskForm((p) => ({ ...p, priority: e.target.value }))}
                            className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm focus:outline-none cursor-pointer bg-white">
                            <option value="low">Низкий</option>
                            <option value="normal">Обычный</option>
                            <option value="high">Высокий</option>
                          </select>
                          <button onClick={saveTask} disabled={savingTask || !editTaskForm.title.trim()}
                            className="px-3 py-1.5 bg-[#2563EB] text-white text-sm rounded-lg hover:bg-[#1D4ED8] disabled:opacity-40 cursor-pointer">
                            {savingTask ? "…" : "Сохранить"}
                          </button>
                          <button onClick={() => setEditingTaskId(null)} className="px-3 py-1.5 text-sm border border-[#E2E8F0] rounded-lg hover:bg-[#F8F9FA] cursor-pointer">Отмена</button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={task.id} className={`flex items-center gap-3 group p-2.5 rounded-lg border ${isOverdue ? "bg-red-50 border-red-100" : isDueToday ? "bg-yellow-50 border-yellow-100" : "border-transparent hover:bg-[#F8FAFC]"}`}>
                      <button onClick={() => toggleTask(task)}
                        className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${task.done ? "bg-[#2563EB] border-[#2563EB]" : "border-[#CBD5E1] hover:border-[#2563EB]"}`}>
                        {task.done && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </button>
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm ${task.done ? "line-through text-[#94A3B8]" : "text-[#1E293B]"}`}>{task.title}</span>
                        {task.due_date && (
                          <div className={`text-xs mt-0.5 ${isOverdue ? "text-red-500 font-medium" : isDueToday ? "text-yellow-600 font-medium" : "text-[#94A3B8]"}`}>
                            {isOverdue ? "⚠️ Просрочено: " : isDueToday ? "📅 Сегодня: " : "📅 "}
                            {new Date(task.due_date).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })}
                          </div>
                        )}
                      </div>
                      {task.priority && task.priority !== "normal" && (
                        <span className={`text-xs font-medium shrink-0 ${PRIORITY_COLORS[task.priority]}`}>{PRIORITY_LABELS[task.priority]}</span>
                      )}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEditTask(task)} className="text-[#94A3B8] hover:text-[#2563EB] cursor-pointer p-1" title="Редактировать">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => removeTask(task)} className="text-[#94A3B8] hover:text-red-500 cursor-pointer p-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </div>
                  );
                })}

                <form onSubmit={addTask} className="flex flex-col gap-2 mt-2 pt-3 border-t border-[#F1F5F9]">
                  <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Новая задача…"
                    className="border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" />
                  <div className="flex gap-2">
                    <input type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)}
                      className="border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2563EB] cursor-pointer" />
                    <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)}
                      className="border border-[#E2E8F0] rounded-lg px-2 py-2 text-sm focus:outline-none cursor-pointer bg-white">
                      <option value="low">Низкий</option>
                      <option value="normal">Обычный</option>
                      <option value="high">Высокий</option>
                    </select>
                    <button type="submit" disabled={addingTask || !taskTitle.trim()}
                      className="px-4 py-2 bg-[#2563EB] text-white text-sm rounded-lg hover:bg-[#1D4ED8] disabled:opacity-40 cursor-pointer">Добавить</button>
                  </div>
                </form>
              </div>
            )}

            {/* ── Files ── */}
            {tab === "files" && (
              <div className="flex flex-col gap-3">
                <div>
                  <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploadingFile}
                    className="flex items-center gap-2 border-2 border-dashed border-[#E2E8F0] rounded-xl px-6 py-4 text-sm text-[#64748B] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer transition-colors w-full justify-center disabled:opacity-50">
                    {uploadingFile ? "Загрузка…" : "📎 Нажмите чтобы прикрепить файлы"}
                  </button>
                </div>

                {files.length === 0 && <p className="text-sm text-[#94A3B8] text-center py-4">Файлов нет</p>}

                {files.map((f) => {
                  const isImage = f.mime_type?.startsWith("image/");
                  const ext = f.name.split(".").pop()?.toUpperCase() ?? "FILE";
                  return (
                    <div key={f.id} className="flex items-center gap-3 p-3 border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] group">
                      <div className="w-10 h-10 rounded-lg bg-[#F1F5F9] flex items-center justify-center text-xs font-bold text-[#64748B] shrink-0">
                        {isImage ? "🖼️" : ext.slice(0, 4)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1E293B] truncate">{f.name}</p>
                        <p className="text-xs text-[#94A3B8]">{fmtFileSize(f.size)} · {f.uploader_name ?? "Система"} · {fmtDate(f.created_at)}</p>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <a href={apiLeadFileDownloadUrl(id!, f.id)} download={f.name}
                          className="text-xs text-[#2563EB] hover:underline cursor-pointer px-2 py-1 border border-[#BFDBFE] rounded-lg">
                          Скачать
                        </a>
                        <button onClick={() => deleteFile(f.id)} className="text-xs text-[#94A3B8] hover:text-red-500 cursor-pointer px-2 py-1 border border-[#E2E8F0] rounded-lg">
                          Удалить
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Info (custom fields inline edit) ── */}
            {tab === "info" && (
              <div>
                {Object.keys(lead.custom_fields ?? {}).length === 0 ? (
                  <p className="text-sm text-[#94A3B8]">Дополнительных полей нет</p>
                ) : (
                  <table className="w-full text-sm">
                    <tbody>
                      {Object.entries(lead.custom_fields).map(([k, v]) => (
                        <tr key={k} className="border-b border-[#F1F5F9] last:border-0 group">
                          <td className="py-2.5 pr-4 font-medium text-[#64748B] w-40">{k}</td>
                          <td className="py-2.5">
                            {editingField === k ? (
                              <div className="flex gap-2 items-center">
                                <input value={editFieldVal} onChange={(e) => setEditFieldVal(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") saveField(k); if (e.key === "Escape") setEditingField(null); }}
                                  autoFocus
                                  className="flex-1 border border-[#2563EB] rounded-lg px-2 py-1 text-sm focus:outline-none" />
                                <button onClick={() => saveField(k)} disabled={savingField}
                                  className="text-xs bg-[#2563EB] text-white px-2 py-1 rounded cursor-pointer hover:bg-[#1D4ED8] disabled:opacity-50">
                                  {savingField ? "…" : "✓"}
                                </button>
                                <button onClick={() => setEditingField(null)} className="text-xs text-[#94A3B8] cursor-pointer">✕</button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-[#1E293B]">{v}</span>
                                <button onClick={() => { setEditingField(k); setEditFieldVal(String(v)); }}
                                  className="opacity-0 group-hover:opacity-100 text-[#94A3B8] hover:text-[#2563EB] cursor-pointer transition-opacity text-xs">✏️</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </AppLayout>
  );
}
