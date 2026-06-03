import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { AppLayout } from "../components/AppLayout";
import type { TeamMember, Department } from "../types";
import {
  apiGetTeam, apiInviteUser, apiUpdateUserDepartments, apiDeleteTeamMember, apiGetDepartments,
} from "../api";

export function TeamPage() {
  const { user } = useAuth();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [accessMember, setAccessMember] = useState<TeamMember | null>(null);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", password: "", departmentIds: [] as string[] });
  const [accessDeptIds, setAccessDeptIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!user || user.role !== "admin") return <Navigate to="/dashboard" replace />;

  useEffect(() => {
    Promise.all([apiGetTeam(), apiGetDepartments()])
      .then(([teamRes, deptsRes]) => {
        setMembers(teamRes.users);
        setDepartments(deptsRes.departments);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!inviteForm.email.trim() || !inviteForm.password.trim()) {
      setError("Email и пароль обязательны");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiInviteUser(inviteForm);
      setMembers((p) => [...p, res.user]);
      setShowInvite(false);
      setInviteForm({ name: "", email: "", password: "", departmentIds: [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка создания");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAccess = async () => {
    if (!accessMember) return;
    setSubmitting(true);
    try {
      await apiUpdateUserDepartments(accessMember.id, accessDeptIds);
      setMembers((p) => p.map((m) => m.id === accessMember.id ? { ...m, departmentIds: accessDeptIds } : m));
      setAccessMember(null);
    } catch {
      /* ignore */
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (memberId: string) => {
    await apiDeleteTeamMember(memberId).catch(() => {});
    setMembers((p) => p.filter((m) => m.id !== memberId));
  };

  const toggleInviteDept = (id: string) => {
    setInviteForm((p) => ({
      ...p,
      departmentIds: p.departmentIds.includes(id) ? p.departmentIds.filter((d) => d !== id) : [...p.departmentIds, id],
    }));
  };

  const toggleAccessDept = (id: string) => {
    setAccessDeptIds((p) => p.includes(id) ? p.filter((d) => d !== id) : [...p, id]);
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[#1E293B]">Команда</h1>
          <button onClick={() => { setError(""); setShowInvite(true); }}
            className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer">
            + Пригласить сотрудника
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-[#64748B]">Загрузка...</div>
        ) : (
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8F9FA]">
                    <th className="text-left px-4 py-3 font-semibold text-[#64748B]">Сотрудник</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#64748B]">Роль</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#64748B] hidden sm:table-cell">Отделы</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8F9FA]">
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#1E293B]">{m.name}</div>
                        <div className="text-xs text-[#64748B]">{m.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.role === "admin" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                          {m.role === "admin" ? "Админ" : "Сотрудник"}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {m.departmentIds.length === 0 ? (
                            <span className="text-xs text-[#94A3B8]">Нет доступа</span>
                          ) : m.departmentIds.map((dId) => {
                            const d = departments.find((dep) => dep.id === dId);
                            return d ? (
                              <span key={dId} className="text-base" title={d.name}>{d.icon}</span>
                            ) : null;
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => { setAccessMember(m); setAccessDeptIds(m.departmentIds); }}
                            className="text-xs border border-[#E2E8F0] px-2 py-1 rounded-lg hover:bg-[#F8F9FA] text-[#64748B] cursor-pointer whitespace-nowrap">
                            Доступ
                          </button>
                          {m.id !== user.id && (
                            <button
                              onClick={() => void handleDelete(m.id)}
                              className="text-xs border border-red-100 px-2 py-1 rounded-lg hover:bg-red-50 text-red-500 cursor-pointer">
                              Удалить
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowInvite(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-[#1E293B] mb-4">Пригласить сотрудника</h2>
            <form onSubmit={(e) => void handleInvite(e)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#1E293B]">Имя</label>
                <input value={inviteForm.name} onChange={(e) => setInviteForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Иван Иванов" className="border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#1E293B]">Email *</label>
                <input value={inviteForm.email} onChange={(e) => setInviteForm((p) => ({ ...p, email: e.target.value }))}
                  type="email" placeholder="ivan@company.ru" className="border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#1E293B]">Пароль *</label>
                <input value={inviteForm.password} onChange={(e) => setInviteForm((p) => ({ ...p, password: e.target.value }))}
                  type="password" placeholder="Минимум 6 символов" className="border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" />
              </div>
              {departments.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#1E293B]">Отделы</label>
                  <div className="flex flex-col gap-2 max-h-40 overflow-y-auto border border-[#E2E8F0] rounded-lg p-3">
                    {departments.map((d) => (
                      <label key={d.id} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={inviteForm.departmentIds.includes(d.id)} onChange={() => toggleInviteDept(d.id)}
                          className="rounded text-[#2563EB]" />
                        <span className="text-base">{d.icon}</span>
                        <span className="text-sm text-[#1E293B]">{d.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
              <div className="flex justify-end gap-3 mt-1">
                <button type="button" onClick={() => setShowInvite(false)}
                  className="border border-[#E2E8F0] text-[#64748B] px-4 py-2 rounded-lg text-sm hover:bg-[#F8F9FA] cursor-pointer">
                  Отмена
                </button>
                <button type="submit" disabled={submitting}
                  className="bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer">
                  {submitting ? "Создаём..." : "Создать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Access modal */}
      {accessMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setAccessMember(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-[#1E293B] mb-1">Управление доступом</h2>
            <p className="text-sm text-[#64748B] mb-4">{accessMember.name} · {accessMember.email}</p>
            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto mb-4">
              {departments.map((d) => (
                <label key={d.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-[#F8F9FA]">
                  <input type="checkbox" checked={accessDeptIds.includes(d.id)} onChange={() => toggleAccessDept(d.id)}
                    className="rounded text-[#2563EB]" />
                  <span className="text-base">{d.icon}</span>
                  <span className="text-sm text-[#1E293B]">{d.name}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setAccessMember(null)}
                className="border border-[#E2E8F0] text-[#64748B] px-4 py-2 rounded-lg text-sm hover:bg-[#F8F9FA] cursor-pointer">
                Отмена
              </button>
              <button onClick={() => void handleSaveAccess()} disabled={submitting}
                className="bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer">
                {submitting ? "Сохраняем..." : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
