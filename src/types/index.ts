import type { PlanId } from "../utils/plans";

export type UserRole = "admin" | "employee" | "superadmin";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isSuperadmin?: boolean;
  companyId: string | null;
  companyName: string;
  plan: PlanId;
  companyStatus?: string;
};

export type Department = {
  id: string;
  companyId: string;
  name: string;
  description: string;
  icon: string;
  systemPrompt: string;
  createdAt: string;
};

export type ChatSummary = {
  id: string;
  preview: string;
  createdAt: string;
  messageCount: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  author: string;
  text: string;
};

export type Artifact = {
  id: string;
  departmentId: string;
  userId: string;
  title: string;
  content: string;
  createdAt: string;
};

export type DeptFile = {
  id: string;
  departmentId: string;
  userId: string;
  name: string;
  size: number;
  uploadedAt: string;
};

export type TeamMember = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  departmentIds: string[];
};

// ── CRM ────────────────────────────────────────────────────────────────────────

export type CrmStatus = string;

export type CrmTag = { id: string; name: string; color: string };
export type CrmColumn = { id: string; company_id: string; name: string; color: string; position: number; is_default: number };
export type CrmField = { id: string; company_id: string; name: string; field_type: "text" | "number" | "date" | "select"; position: number };
export type CrmMember = { id: string; name: string; email: string; role: string };

export type AdminCompany = {
  id: string;
  name: string;
  plan: string;
  status: "pending" | "active" | "blocked";
  created_at: string;
  user_count: number;
  owner_email: string | null;
};

export type AdminStats = {
  total: number; active: number; blocked: number; pending: number;
  users: number; chats: number; leads: number;
};

export type CrmLead = {
  id: string;
  company_id: string;
  status: CrmStatus;
  name: string;
  phone: string | null;
  email: string | null;
  source: string;
  custom_fields: Record<string, string>;
  profit?: number | null;
  assigned_to: string | null;
  assignee_name?: string | null;
  tags?: CrmTag[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type IntegrationField = {
  key: string;
  label: string;
  type: "text" | "tel" | "email" | "textarea" | "select" | "number";
  required: boolean;
  options?: string[]; // for select type
};

export type CrmIntegration = {
  id: string;
  company_id: string;
  name: string;
  api_key: string;
  form_fields: IntegrationField[];
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type CrmComment = {
  id: string;
  lead_id: string;
  user_id: string | null;
  user_name: string | null;
  text: string;
  created_at: string;
};

export type CrmTask = {
  id: string;
  lead_id: string;
  title: string;
  done: number;
  due_date?: string | null;
  priority?: "low" | "normal" | "high";
  created_by: string | null;
  created_at: string;
};

export type CrmNotification = {
  id: string;
  company_id: string;
  user_id: string;
  type: string;
  lead_id: string | null;
  lead_name: string | null;
  message: string;
  read: number;
  created_at: string;
};

export type CrmHistoryEntry = {
  id: string;
  lead_id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  details: string | null;
  created_at: string;
};
