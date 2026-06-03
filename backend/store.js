// In-memory store for MVP (no database)

export const users = [];       // { id, email, passwordHash, companyId, role, name }
export const companies = [];   // { id, name, plan, createdAt }
export const departments = []; // { id, companyId, name, description, icon, systemPrompt, createdAt }
export const chats = [];       // { id, departmentId, userId, createdAt, messages: [] }
export const artifacts = [];   // { id, departmentId, userId, title, content, createdAt }
export const files = [];       // { id, departmentId, userId, name, size, path, content, uploadedAt }
