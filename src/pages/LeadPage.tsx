import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "../components/AppLayout";
import type { CrmLead, CrmComment, CrmTask, CrmHistoryEntry, CrmStatus, CrmTag, CrmMember } from "../types";
import {
  apiGetLead, apiUpdateLead, apiDeleteLead,
  apiAddComment, apiDeleteComment,
  apiCreateTask, apiUpdateTask, apiDeleteTask,
  apiGetTags, apiAddLeadTag, apiRemoveLeadTag,
  apiGetCrmMembers,
} from "../api";

const STATUS_OPTIONS: { id: CrmStatus; label: string; color: string }[] = [
  { id: "new", label: "Новая заявка", color: "bg-blue-100 text-blue-700" },
  { id: "calculating", label: "В расчете", color: "bg-yellow-100 text-yellow-700" },
  { id: "in_progress", label: "В работе", color: "bg-green-100 text-green-700" },
  { id: "rejected", label: "Не интересно", color: "bg-red-100 text-red-600" },
];

function statusColor(s: CrmStatus) { return STATUS_OPTIONS.find((o) => o.id === s)?.color ?? "bg-gray-100 text-gray-600"; }
function statusLabel(s: CrmStatus) { return STATUS_OPTIONS.find((o) => o.id === s)?.label ?? s; }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

type LeadWithProfit = CrmLead & { profit?: number | null };

export function LeadPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [lead, setLead] = useState<LeadWithProfit | null>(null);
  const [comments, setComments] = useState<CrmComment[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [history, setHistory] = useState<CrmHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"info" | "tasks" | "comments" | "history">("info");

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", phone: "", email: "", profit: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  // profit inline edit
  const [editingProfit, setEditingProfit] = useState(false);
  const [profitInput, setProfitInput] = useState("");
  const [savingProfit, setSavingProfit] = useState(false);

  const [commentText, setCommentText] = useState("");
  const [addingComment, setAddingComment] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskPriority, setTaskPriority] = useState("normal");
  const [addingTask, setAddingTask] = useState(false);

  // Tags & members
  const [allTags, setAllTags] = useState<CrmTag[]>([]);
  const [members, setMembers] = useState<CrmMember[]>([]);
  const [savingAssignee, setSavingAssignee] = useState(false);

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
        setEditForm({ name: l.name, phone: l.phone ?? "", email: l.email ?? "", profit: l.profit != null ? String(l.profit) : "" });
        setProfitInput(l.profit != null ? String(l.profit) : "");
      })
      .catch(() => navigate("/crm"))
      .finally(() => setLoading(false));
  }, [id]);

  async function refreshHistory() {
    if (!id) return;
    const updated = await apiGetLead(id);
    setHistory(updated.history);
  }

  // ── Status ────────────────────────────────────────────────────────────────────
  async function changeStatus(s: CrmStatus) {
    if (!lead || lead.status === s) return;
    const prev = lead.status;
    setLead({ ...lead, status: s });
    try {
      const res = await apiUpdateLead(lead.id, { status: s });
      setLead({ ...res.lead, profit: lead.profit } as LeadWithProfit);
      await refreshHistory();
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
      await refreshHistory();
      setEditing(false);
    } catch { /* ignore */ }
    finally { setSavingEdit(false); }
  }

  // ── Profit inline ─────────────────────────────────────────────────────────────
  async function saveProfit() {
    if (!lead) return;
    setSavingProfit(true);
    try {
      const val = profitInput.trim() !== "" ? parseFloat(profitInput.replace(/\s/g, "").replace(",", ".")) : null;
      await apiUpdateLead(lead.id, { profit: val } as Parameters<typeof apiUpdateLead>[1]);
      setLead({ ...lead, profit: val });
      setEditingProfit(false);
      await refreshHistory();
    } catch { /* ignore */ }
    finally { setSavingProfit(false); }
  }

  // ── Assignee ──────────────────────────────────────────────────────────────────
  async function changeAssignee(userId: string | null) {
    if (!lead) return;
    setSavingAssignee(true);
    try {
      const res = await apiUpdateLead(lead.id, { assigned_to: userId ?? "" } as Parameters<typeof apiUpdateLead>[1]);
      setLead({ ...lead, assigned_to: userId, assignee_name: res.lead.assignee_name } as LeadWithProfit);
      await refreshHistory();
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

  // ── Comments ──────────────────────────────────────────────────────────────────
  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!lead || !commentText.trim()) return;
    setAddingComment(true);
    try {
      const res = await apiAddComment(lead.id, commentText.trim());
      setComments((p) => [...p, res.comment]);
      setCommentText("");
      await refreshHistory();
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
      const res = await apiCreateTask(lead.id, {
        title: taskTitle.trim(),
        due_date: taskDueDate || null,
        priority: taskPriority,
      });
      setTasks((p) => [...p, res.task]);
      setTaskTitle("");
      setTaskDueDate("");
      setTaskPriority("normal");
      await refreshHistory();
    } catch { /* ignore */ }
    finally { setAddingTask(false); }
  }

  async function toggleTask(task: CrmTask) {
    if (!lead) return;
    const next = !task.done;
    setTasks((p) => p.map((t) => (t.id === task.id ? { ...t, done: next ? 1 : 0 } : t)));
    try {
      await apiUpdateTask(lead.id, task.id, { done: next });
      await refreshHistory();
    } catch {
      setTasks((p) => p.map((t) => (t.id === task.id ? { ...t, done: task.done } : t)));
    }
  }

  async function removeTask(task: CrmTask) {
    if (!lead) return;
    setTasks((p) => p.filter((t) => t.id !== task.id));
    try { await apiDeleteTask(lead.id, task.id); } catch { /* ignore */ }
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

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col gap-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[#64748B]">
          <button onClick={() => navigate("/crm")} className="hover:text-[#2563EB] cursor-pointer">← CRM</button>
          <span>/</span>
          <span className="text-[#1E293B] font-medium truncate max-w-xs">{lead.name}</span>
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
                    <input value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="Телефон"
                      className="border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm flex-1 min-w-36 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" />
                    <input value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="Email"
                      className="border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm flex-1 min-w-36 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" />
                    <input value={editForm.profit} onChange={(e) => setEditForm((p) => ({ ...p, profit: e.target.value }))}
                      placeholder="Прибыль, ₽"
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

                  {/* Profit field */}
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-sm text-[#64748B]">💰 Прибыль:</span>
                    {editingProfit ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={profitInput}
                          onChange={(e) => setProfitInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveProfit(); if (e.key === "Escape") setEditingProfit(false); }}
                          autoFocus
                          placeholder="0"
                          className="border border-[#2563EB] rounded-lg px-2 py-1 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                        />
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

                  {/* Assignee */}
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-sm text-[#64748B]">👤 Ответственный:</span>
                    <select
                      value={lead.assigned_to ?? ""}
                      disabled={savingAssignee}
                      onChange={(e) => changeAssignee(e.target.value || null)}
                      className="border border-[#E2E8F0] rounded-lg px-2 py-1 text-sm focus:outline-none cursor-pointer bg-white"
                    >
                      <option value="">Не назначен</option>
                      {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>

                  {/* Tags */}
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

                  {Object.keys(lead.custom_fields ?? {}).length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Object.entries(lead.custom_fields).map(([k, v]) => (
                        <span key={k} className="text-xs bg-[#F1F5F9] px-2 py-1 rounded-full text-[#64748B]">{k}: {v}</span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Status + actions */}
            <div className="flex flex-col items-end gap-3 shrink-0">
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusColor(lead.status)}`}>
                {statusLabel(lead.status)}
              </span>
              <div className="flex flex-wrap gap-1 justify-end">
                {STATUS_OPTIONS.filter((o) => o.id !== lead.status).map((o) => (
                  <button key={o.id} onClick={() => changeStatus(o.id)}
                    className={`text-xs px-2.5 py-1 rounded-full border border-transparent hover:border-current cursor-pointer transition-colors ${o.color}`}>
                    → {o.label}
                  </button>
                ))}
              </div>
              {!editing && (
                <div className="flex gap-2">
                  <button onClick={() => setEditing(true)} className="text-xs border border-[#E2E8F0] px-3 py-1.5 rounded-lg hover:bg-[#F8F9FA] cursor-pointer">Редактировать</button>
                  <button onClick={deleteLead} className="text-xs border border-red-200 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 cursor-pointer">Удалить</button>
                </div>
              )}
            </div>
          </div>

          {/* Task progress bar */}
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
            {(["info", "tasks", "comments", "history"] as const).map((t) => {
              const labels = { info: "Доп. поля", tasks: `Задачи (${tasks.length})`, comments: `Комментарии (${comments.length})`, history: "История" };
              return (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-5 py-3 text-sm font-medium cursor-pointer transition-colors ${tab === t ? "border-b-2 border-[#2563EB] text-[#2563EB]" : "text-[#64748B] hover:text-[#1E293B]"}`}>
                  {labels[t]}
                </button>
              );
            })}
          </div>

          <div className="p-5">
            {/* Info */}
            {tab === "info" && (
              <div>
                {Object.keys(lead.custom_fields ?? {}).length === 0 ? (
                  <p className="text-sm text-[#94A3B8]">Дополнительных полей нет</p>
                ) : (
                  <table className="w-full text-sm">
                    <tbody>
                      {Object.entries(lead.custom_fields).map(([k, v]) => (
                        <tr key={k} className="border-b border-[#F1F5F9] last:border-0">
                          <td className="py-2 pr-4 font-medium text-[#64748B] w-40">{k}</td>
                          <td className="py-2 text-[#1E293B]">{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Tasks */}
            {tab === "tasks" && (
              <div className="flex flex-col gap-3">
                {tasks.map((task) => {
                  const isOverdue = !task.done && task.due_date && task.due_date < new Date().toISOString().slice(0, 10);
                  const isDueToday = !task.done && task.due_date && task.due_date === new Date().toISOString().slice(0, 10);
                  const priorityColors: Record<string, string> = { high: "text-red-500", normal: "text-[#94A3B8]", low: "text-[#CBD5E1]" };
                  return (
                    <div key={task.id} className={`flex items-center gap-3 group p-2 rounded-lg ${isOverdue ? "bg-red-50" : isDueToday ? "bg-yellow-50" : ""}`}>
                      <button onClick={() => toggleTask(task)}
                        className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${task.done ? "bg-[#2563EB] border-[#2563EB]" : "border-[#CBD5E1] hover:border-[#2563EB]"}`}>
                        {task.done ? <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> : null}
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
                        <span className={`text-xs font-medium shrink-0 ${priorityColors[task.priority]}`}>
                          {task.priority === "high" ? "↑ Высокий" : "↓ Низкий"}
                        </span>
                      )}
                      <button onClick={() => removeTask(task)}
                        className="opacity-0 group-hover:opacity-100 text-[#94A3B8] hover:text-red-500 cursor-pointer transition-opacity">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  );
                })}
                <form onSubmit={addTask} className="flex flex-col gap-2 mt-1 pt-2 border-t border-[#F1F5F9]">
                  <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Новая задача…"
                    className="flex-1 border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" />
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

            {/* Comments */}
            {tab === "comments" && (
              <div className="flex flex-col gap-4">
                {comments.length === 0 && <p className="text-sm text-[#94A3B8]">Комментариев пока нет</p>}
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-3 group">
                    <div className="w-8 h-8 rounded-full bg-[#E2E8F0] flex items-center justify-center text-sm font-medium text-[#64748B] shrink-0">
                      {(c.user_name ?? "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-[#1E293B]">{c.user_name ?? "Система"}</span>
                        <span className="text-xs text-[#94A3B8]">{fmtDate(c.created_at)}</span>
                        <button onClick={() => removeComment(c.id)}
                          className="ml-auto opacity-0 group-hover:opacity-100 text-[#94A3B8] hover:text-red-500 cursor-pointer text-xs transition-opacity">удалить</button>
                      </div>
                      <p className="text-sm text-[#475569] mt-0.5 whitespace-pre-wrap">{c.text}</p>
                    </div>
                  </div>
                ))}
                <form onSubmit={submitComment} className="flex gap-2 pt-2 border-t border-[#F1F5F9]">
                  <input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Написать комментарий…"
                    className="flex-1 border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" />
                  <button type="submit" disabled={addingComment || !commentText.trim()}
                    className="px-4 py-2 bg-[#2563EB] text-white text-sm rounded-lg hover:bg-[#1D4ED8] disabled:opacity-40 cursor-pointer">Отправить</button>
                </form>
              </div>
            )}

            {/* History */}
            {tab === "history" && (
              <div className="flex flex-col gap-2">
                {history.length === 0 && <p className="text-sm text-[#94A3B8]">История пуста</p>}
                {history.map((h) => (
                  <div key={h.id} className="flex gap-3 items-start text-sm py-2 border-b border-[#F1F5F9] last:border-0">
                    <span className="text-[#94A3B8] text-xs w-36 shrink-0 pt-0.5">{fmtDate(h.created_at)}</span>
                    <div>
                      <span className="font-medium text-[#1E293B]">{h.user_name ?? "Система"}</span>
                      {" — "}
                      <span className="text-[#64748B]">{h.action}</span>
                      {h.details && <span className="text-[#94A3B8]">: {h.details}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
