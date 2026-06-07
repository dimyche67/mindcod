import type { AuthUser, Department, ChatSummary, ChatMessage, Artifact, DeptFile, TeamMember, CrmLead, CrmComment, CrmTask, CrmHistoryEntry, CrmStatus, CrmTag, CrmColumn, CrmField, CrmMember, AdminCompany, AdminStats, CrmIntegration, IntegrationField, CrmNotification } from "../types";

// В dev: vite proxy перенаправит /api → localhost:8787 (см. vite.config.ts)
// В production (nginx): /api → localhost:8787 через proxy_pass
// VITE_API_URL можно задать явно для нестандартных конфигов
const BASE = import.meta.env.VITE_API_URL ?? "";

function getToken(): string | null {
  return localStorage.getItem("aioffice_token");
}

function authHeaders(): HeadersInit {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers ?? {}) },
  });
  const data = await res.json() as { ok: boolean; error?: string } & T;
  if (!res.ok) throw new Error((data as Record<string, string>).error ?? "Ошибка запроса");
  return data;
}

// ---- Auth ----

export async function apiRegister(companyName: string, email: string, password: string) {
  return req<{ token: string; user: AuthUser }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ companyName, email, password }),
  });
}

export async function apiLogin(email: string, password: string) {
  return req<{ token: string; user: AuthUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function apiMe() {
  return req<{ user: AuthUser }>("/api/auth/me");
}

// ---- Departments ----

export async function apiGetDepartments() {
  return req<{ departments: Department[] }>("/api/departments");
}

export async function apiCreateDepartment(data: { name: string; description: string; icon: string; systemPrompt: string }) {
  return req<{ department: Department }>("/api/departments", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function apiGetDepartment(id: string, signal?: AbortSignal) {
  return req<{ department: Department }>(`/api/departments/${id}`, { signal });
}

export async function apiUpdateDepartment(id: string, data: Partial<{ name: string; description: string; icon: string; systemPrompt: string }>) {
  return req<{ department: Department }>(`/api/departments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function apiDeleteDepartment(id: string) {
  return req<Record<string, never>>(`/api/departments/${id}`, { method: "DELETE" });
}

// ---- Team ----

export async function apiGetTeam() {
  return req<{ users: TeamMember[] }>("/api/team");
}

export async function apiInviteUser(data: { name: string; email: string; password: string; departmentIds: string[] }) {
  return req<{ user: TeamMember }>("/api/team/invite", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function apiUpdateUserDepartments(userId: string, departmentIds: string[]) {
  return req<Record<string, never>>(`/api/team/${userId}/departments`, {
    method: "PATCH",
    body: JSON.stringify({ departmentIds }),
  });
}

export async function apiDeleteTeamMember(userId: string) {
  return req<Record<string, never>>(`/api/team/${userId}`, { method: "DELETE" });
}

// ---- Chat ----

export async function apiGetChats(departmentId: string, signal?: AbortSignal) {
  return req<{ chats: ChatSummary[] }>(`/api/chat/${departmentId}`, { signal });
}

export async function apiGetChatMessages(departmentId: string, chatId: string) {
  return req<{ messages: ChatMessage[] }>(`/api/chat/${departmentId}/${chatId}`);
}

export async function apiSendMessage(departmentId: string, message: string, chatId?: string) {
  return req<{ reply: string; chatId: string; messageId: string }>(`/api/chat/${departmentId}`, {
    method: "POST",
    body: JSON.stringify({ message, chatId }),
  });
}

// ---- Artifacts ----

export async function apiGetArtifacts(departmentId: string) {
  return req<{ artifacts: Artifact[] }>(`/api/artifacts/${departmentId}`);
}

export async function apiSaveArtifact(departmentId: string, content: string, title?: string) {
  return req<{ artifact: Artifact }>("/api/artifacts", {
    method: "POST",
    body: JSON.stringify({ departmentId, content, title }),
  });
}

export async function apiDeleteArtifact(id: string) {
  return req<Record<string, never>>(`/api/artifacts/${id}`, { method: "DELETE" });
}

// ---- Files ----

export async function apiGetFiles(departmentId: string) {
  return req<{ files: DeptFile[] }>(`/api/files/${departmentId}`);
}

export async function apiUploadFile(departmentId: string, file: File) {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/api/files/${departmentId}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const data = await res.json() as { ok: boolean; error?: string; file?: DeptFile };
  if (!res.ok) throw new Error(data.error ?? "Ошибка загрузки");
  return data;
}

export async function apiDeleteFile(id: string) {
  return req<Record<string, never>>(`/api/files/${id}`, { method: "DELETE" });
}

// ── CRM ────────────────────────────────────────────────────────────────────────

export type LeadCreateData = { name: string; phone?: string; email?: string; source?: string; custom_fields?: Record<string, string> };

export async function apiGetLeads(params?: { status?: CrmStatus; search?: string; source?: string; date_from?: string; date_to?: string }) {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.search) q.set("search", params.search);
  if (params?.source) q.set("source", params.source);
  if (params?.date_from) q.set("date_from", params.date_from);
  if (params?.date_to) q.set("date_to", params.date_to);
  const qs = q.toString() ? `?${q}` : "";
  return req<{ leads: CrmLead[] }>(`/api/crm/leads${qs}`);
}

export async function apiCreateLead(data: LeadCreateData) {
  return req<{ lead: CrmLead }>("/api/crm/leads", { method: "POST", body: JSON.stringify(data) });
}

export async function apiGetLead(id: string) {
  return req<{ lead: CrmLead; comments: CrmComment[]; tasks: CrmTask[]; history: CrmHistoryEntry[] }>(`/api/crm/leads/${id}`);
}

export async function apiUpdateLead(id: string, data: Partial<LeadCreateData & { status: CrmStatus; assigned_to: string }>) {
  return req<{ lead: CrmLead }>(`/api/crm/leads/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function apiDeleteLead(id: string) {
  return req<Record<string, never>>(`/api/crm/leads/${id}`, { method: "DELETE" });
}

export async function apiAddComment(leadId: string, text: string) {
  return req<{ comment: CrmComment }>(`/api/crm/leads/${leadId}/comments`, { method: "POST", body: JSON.stringify({ text }) });
}

export async function apiDeleteComment(leadId: string, commentId: string) {
  return req<Record<string, never>>(`/api/crm/leads/${leadId}/comments/${commentId}`, { method: "DELETE" });
}

export async function apiCreateTask(leadId: string, data: { title: string; due_date?: string | null; priority?: string }) {
  return req<{ task: CrmTask }>(`/api/crm/leads/${leadId}/tasks`, { method: "POST", body: JSON.stringify(data) });
}

export async function apiUpdateTask(leadId: string, taskId: string, data: { done?: boolean; title?: string; due_date?: string | null; priority?: string }) {
  return req<{ task: CrmTask }>(`/api/crm/leads/${leadId}/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function apiDeleteTask(leadId: string, taskId: string) {
  return req<Record<string, never>>(`/api/crm/leads/${leadId}/tasks/${taskId}`, { method: "DELETE" });
}

// ── CRM Tags ──────────────────────────────────────────────────────────────────
export async function apiGetTags() {
  return req<{ tags: CrmTag[] }>("/api/crm/tags");
}
export async function apiCreateTag(name: string, color: string) {
  return req<{ tag: CrmTag }>("/api/crm/tags", { method: "POST", body: JSON.stringify({ name, color }) });
}
export async function apiUpdateTag(id: string, data: Partial<CrmTag>) {
  return req<{ tag: CrmTag }>(`/api/crm/tags/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}
export async function apiDeleteTag(id: string) {
  return req<Record<string, never>>(`/api/crm/tags/${id}`, { method: "DELETE" });
}
export async function apiAddLeadTag(leadId: string, tagId: string) {
  return req<Record<string, never>>(`/api/crm/leads/${leadId}/tags/${tagId}`, { method: "POST" });
}
export async function apiRemoveLeadTag(leadId: string, tagId: string) {
  return req<Record<string, never>>(`/api/crm/leads/${leadId}/tags/${tagId}`, { method: "DELETE" });
}

// ── CRM Columns ───────────────────────────────────────────────────────────────
export async function apiGetCrmColumns() {
  return req<{ columns: CrmColumn[] }>("/api/crm/columns");
}
export async function apiCreateCrmColumn(name: string, color: string) {
  return req<{ column: CrmColumn }>("/api/crm/columns", { method: "POST", body: JSON.stringify({ name, color }) });
}
export async function apiDeleteCrmColumn(id: string) {
  return req<Record<string, never>>(`/api/crm/columns/${id}`, { method: "DELETE" });
}

// ── CRM Fields ────────────────────────────────────────────────────────────────
export async function apiGetCrmFields() {
  return req<{ fields: CrmField[] }>("/api/crm/fields");
}
export async function apiCreateCrmField(name: string, field_type: string) {
  return req<{ field: CrmField }>("/api/crm/fields", { method: "POST", body: JSON.stringify({ name, field_type }) });
}
export async function apiDeleteCrmField(id: string) {
  return req<Record<string, never>>(`/api/crm/fields/${id}`, { method: "DELETE" });
}

// ── CRM Members ───────────────────────────────────────────────────────────────
export async function apiGetCrmMembers() {
  return req<{ members: CrmMember[] }>("/api/crm/members");
}

// ── CRM Bulk ──────────────────────────────────────────────────────────────────
export async function apiBulkLeads(action: "status" | "assign" | "delete", ids: string[], value?: string) {
  return req<{ ok: boolean; affected: number }>("/api/crm/leads/bulk", { method: "POST", body: JSON.stringify({ action, ids, value }) });
}

// ── CRM Analytics ─────────────────────────────────────────────────────────────
export type CrmAnalytics = {
  byStatus: { status: string; count: number; profit: number | null }[];
  bySource: { source: string; count: number }[];
  total: { count: number; profit: number | null };
  overdueTasks: number;
};
export async function apiGetAnalytics(params?: { date_from?: string; date_to?: string }) {
  const q = new URLSearchParams();
  if (params?.date_from) q.set("date_from", params.date_from);
  if (params?.date_to) q.set("date_to", params.date_to);
  const qs = q.toString() ? `?${q}` : "";
  return req<{ ok: boolean } & CrmAnalytics>(`/api/crm/analytics${qs}`);
}

// ── CRM Notifications ─────────────────────────────────────────────────────────
export async function apiGetNotifications() {
  return req<{ notifications: CrmNotification[] }>("/api/crm/notifications");
}
export async function apiMarkAllNotificationsRead() {
  return req<{ ok: boolean }>("/api/crm/notifications/read-all", { method: "PATCH" });
}
export async function apiMarkNotificationRead(id: string) {
  return req<{ ok: boolean }>(`/api/crm/notifications/${id}/read`, { method: "PATCH" });
}

// ── Admin ─────────────────────────────────────────────────────────────────────
export async function apiAdminGetCompanies() {
  return req<{ companies: AdminCompany[] }>("/api/admin/companies");
}
export async function apiAdminPatchCompany(id: string, data: { plan?: string; status?: string }) {
  return req<{ company: AdminCompany }>(`/api/admin/companies/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}
export async function apiAdminGetStats() {
  return req<{ stats: AdminStats }>("/api/admin/stats");
}

// ── Integrations ──────────────────────────────────────────────────────────────
export async function apiGetIntegrations() {
  return req<{ integrations: CrmIntegration[] }>("/api/integrations");
}
export async function apiCreateIntegration(name: string, form_fields?: IntegrationField[]) {
  return req<{ integration: CrmIntegration }>("/api/integrations", {
    method: "POST",
    body: JSON.stringify({ name, form_fields }),
  });
}
export async function apiUpdateIntegration(id: string, data: Partial<{ name: string; form_fields: IntegrationField[]; active: boolean }>) {
  return req<{ integration: CrmIntegration }>(`/api/integrations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
export async function apiRegenerateIntegrationKey(id: string) {
  return req<{ integration: CrmIntegration }>(`/api/integrations/${id}/regenerate-key`, { method: "POST" });
}
export async function apiDeleteIntegration(id: string) {
  return req<Record<string, never>>(`/api/integrations/${id}`, { method: "DELETE" });
}
