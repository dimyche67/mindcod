import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { AdminCompany, AdminStats } from "../types";
import { apiAdminGetCompanies, apiAdminPatchCompany, apiAdminGetStats } from "../api";

const STATUS_LABELS: Record<string, string> = { pending: "На рассмотрении", active: "Активна", blocked: "Заблокирована" };
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  active: "bg-green-100 text-green-700",
  blocked: "bg-red-100 text-red-600",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

type Tab = "all" | "pending" | "active" | "blocked";

export function SuperAdminPage() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([apiAdminGetCompanies(), apiAdminGetStats()])
      .then(([c, s]) => { setCompanies(c.companies); setStats(s.stats); })
      .catch(() => navigate("/login"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = companies.filter((c) => {
    if (tab !== "all" && c.status !== tab) return false;
    if (search.trim() && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.owner_email?.includes(search)) return false;
    return true;
  });

  async function patch(id: string, data: { plan?: string; status?: string }) {
    setActing(id);
    try {
      const res = await apiAdminPatchCompany(id, data);
      setCompanies((prev) => prev.map((c) => c.id === id ? { ...c, ...res.company } : c));
      if (stats) {
        const updated = await apiAdminGetStats();
        setStats(updated.stats);
      }
    } finally { setActing(null); }
  }

  function logout() {
    localStorage.removeItem("aioffice_token");
    localStorage.removeItem("aioffice_user");
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9]">
      {/* Header */}
      <header className="bg-white border-b border-[#E2E8F0] h-14 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <span className="font-bold text-[#2563EB] text-lg">AI Офис</span>
          <span className="text-xs bg-[#1E293B] text-white px-2 py-0.5 rounded font-mono">SUPERADMIN</span>
        </div>
        <button onClick={logout} className="text-sm border border-[#E2E8F0] px-3 py-1.5 rounded-lg hover:bg-[#F8F9FA] cursor-pointer">Выйти</button>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 flex flex-col gap-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: "Всего компаний", value: stats.total, color: "text-[#1E293B]" },
              { label: "Активных", value: stats.active, color: "text-green-600" },
              { label: "Заблокированных", value: stats.blocked, color: "text-red-500" },
              { label: "На рассмотрении", value: stats.pending, color: "text-yellow-600" },
              { label: "Пользователей", value: stats.users, color: "text-blue-600" },
              { label: "Чатов", value: stats.chats, color: "text-purple-600" },
              { label: "Лидов CRM", value: stats.leads, color: "text-indigo-600" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-[#E2E8F0] p-4 text-center">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-[#94A3B8] mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Tabs */}
          <div className="flex gap-1 bg-white border border-[#E2E8F0] rounded-lg p-1">
            {(["all", "pending", "active", "blocked"] as Tab[]).map((t) => {
              const labels: Record<Tab, string> = { all: "Все", pending: "Заявки", active: "Активные", blocked: "Заблокированные" };
              const counts: Record<Tab, number> = {
                all: companies.length,
                pending: companies.filter((c) => c.status === "pending").length,
                active: companies.filter((c) => c.status === "active").length,
                blocked: companies.filter((c) => c.status === "blocked").length,
              };
              return (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-3 py-1.5 rounded text-sm font-medium cursor-pointer transition-colors flex items-center gap-1.5 ${tab === t ? "bg-[#2563EB] text-white" : "text-[#64748B] hover:text-[#1E293B]"}`}>
                  {labels[t]}
                  <span className={`text-xs px-1.5 rounded-full ${tab === t ? "bg-blue-400 text-white" : "bg-[#F1F5F9] text-[#64748B]"}`}>
                    {counts[t]}
                  </span>
                </button>
              );
            })}
          </div>

          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по компании или email…"
            className="border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm w-64 bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" />
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          {loading ? (
            <div className="text-center py-20 text-[#64748B]">Загрузка…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-[#94A3B8]">Ничего не найдено</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F1F5F9] bg-[#F8F9FA]">
                  {["Компания", "Email владельца", "Тариф", "Статус", "Дата", "Польз.", "Действия"].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-[#64748B] px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                    <td className="px-4 py-3 font-medium text-[#1E293B] text-sm">{c.name}</td>
                    <td className="px-4 py-3 text-sm text-[#64748B]">{c.owner_email ?? "—"}</td>
                    <td className="px-4 py-3">
                      <select
                        value={c.plan}
                        disabled={acting === c.id}
                        onChange={(e) => patch(c.id, { plan: e.target.value })}
                        className="text-xs border border-[#E2E8F0] rounded px-2 py-1 focus:outline-none cursor-pointer"
                      >
                        <option value="starter">Старт</option>
                        <option value="business">Бизнес</option>
                        <option value="enterprise">Корпоратив</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABELS[c.status] ?? c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#64748B]">{fmtDate(c.created_at)}</td>
                    <td className="px-4 py-3 text-sm text-[#64748B]">{c.user_count}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {c.status === "pending" && (
                          <button
                            onClick={() => patch(c.id, { status: "active" })}
                            disabled={acting === c.id}
                            className="text-xs bg-green-500 hover:bg-green-600 text-white px-2.5 py-1 rounded cursor-pointer disabled:opacity-50"
                          >
                            ✅ Активировать
                          </button>
                        )}
                        {c.status === "pending" && (
                          <button
                            onClick={() => patch(c.id, { status: "blocked" })}
                            disabled={acting === c.id}
                            className="text-xs bg-red-500 hover:bg-red-600 text-white px-2.5 py-1 rounded cursor-pointer disabled:opacity-50"
                          >
                            ❌ Отклонить
                          </button>
                        )}
                        {c.status === "active" && (
                          <button
                            onClick={() => { if (confirm(`Заблокировать "${c.name}"?`)) patch(c.id, { status: "blocked" }); }}
                            disabled={acting === c.id}
                            className="text-xs border border-red-200 text-red-500 hover:bg-red-50 px-2.5 py-1 rounded cursor-pointer disabled:opacity-50"
                          >
                            🔒 Заблокировать
                          </button>
                        )}
                        {c.status === "blocked" && (
                          <button
                            onClick={() => patch(c.id, { status: "active" })}
                            disabled={acting === c.id}
                            className="text-xs border border-green-200 text-green-600 hover:bg-green-50 px-2.5 py-1 rounded cursor-pointer disabled:opacity-50"
                          >
                            🔓 Разблокировать
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
