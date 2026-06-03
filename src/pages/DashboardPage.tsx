import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import type { Department } from "../types";
import { apiGetDepartments, apiCreateDepartment, apiDeleteDepartment, apiUpdateDepartment } from "../api";
import { PLANS } from "../utils/plans";
import { AppLayout } from "../components/AppLayout";

const ICONS = ["🛒", "⚖️", "👥", "🚛", "📢", "💻", "📊", "🏗️", "💰", "📦", "🔧", "📋", "🎯", "🤝", "📱", "🏢", "✈️", "🌐", "💡", "🔍", "💬", "📄"];

const INSTANT_RULE = "ВАЖНО: отвечай НЕМЕДЛЕННО на основе своих знаний. Никогда не говори 'подожди', 'уточню у поставщиков', 'свяжусь', 'дам ответ через N дней', 'приступаю к поиску'. Давай конкретные данные, цифры, примеры, шаблоны прямо сейчас.";

const DEFAULT_PROMPT = "Ты универсальный бизнес-ассистент. Отвечай на вопросы чётко и профессионально.";

const PROMPT_TEMPLATES: Record<string, string> = {
  "Закупки": `Ты опытный менеджер по закупкам с глубокими знаниями рынка поставщиков. ${INSTANT_RULE} Помогаешь: искать поставщиков (называй конкретные компании и категории), сравнивать цены (давай типичные рыночные диапазоны), составлять заявки и анализировать КП. Отвечай структурированно, с таблицами и списками.`,
  "Юридический": `Ты опытный юрист по российскому праву (НК РФ, ГК РФ, ТК РФ). ${INSTANT_RULE} Анализируй законы, договоры, указывай номера статей, давай готовые формулировки.`,
  "HR": `Ты HR-специалист с опытом подбора персонала. ${INSTANT_RULE} Помогаешь с вакансиями, оценкой резюме, кадровыми вопросами по ТК РФ. Давай готовые шаблоны и конкретные рекомендации.`,
  "Логистика": `Ты специалист по логистике и грузоперевозкам. ${INSTANT_RULE} Помогаешь с маршрутами, выбором перевозчиков, расчётом стоимости. Давай конкретные цифры и варианты.`,
  "Маркетинг": `Ты маркетолог с практическим опытом. ${INSTANT_RULE} Помогаешь с анализом рынка, рекламными кампаниями, контентом. Давай готовые идеи, тексты и стратегии.`,
  "Бухгалтерия": `Ты бухгалтер со знанием российского законодательства. ${INSTANT_RULE} Помогаешь с учётом, налогами, отчётностью. Давай конкретные проводки, сроки, формы документов.`,
};

type DeptForm = { name: string; description: string; icon: string; systemPrompt: string };

function DeptFormModal({
  title,
  initial,
  onClose,
  onSubmit,
  submitting,
  error,
}: {
  title: string;
  initial: DeptForm;
  onClose: () => void;
  onSubmit: (form: DeptForm) => void;
  submitting: boolean;
  error: string;
}) {
  const [form, setForm] = useState<DeptForm>(initial);
  const promptEmpty = !form.systemPrompt.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-[#1E293B] mb-4">{title}</h2>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#1E293B]">Название *</label>
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Например, Закупки" className="border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#1E293B]">Описание</label>
            <input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Краткое описание отдела" className="border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#1E293B]">Иконка</label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map((ic) => (
                <button key={ic} type="button" onClick={() => setForm((p) => ({ ...p, icon: ic }))}
                  className={`w-9 h-9 text-lg rounded-lg border transition-all cursor-pointer ${form.icon === ic ? "border-[#2563EB] bg-[#EFF6FF]" : "border-[#E2E8F0] hover:border-[#2563EB]/40"}`}>
                  {ic}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-[#1E293B]">Системный промт</label>
              <select onChange={(e) => e.target.value && setForm((p) => ({ ...p, systemPrompt: PROMPT_TEMPLATES[e.target.value] ?? "" }))}
                className="text-xs border border-[#E2E8F0] rounded-lg px-2 py-1 text-[#64748B] cursor-pointer">
                <option value="">Использовать шаблон</option>
                {Object.keys(PROMPT_TEMPLATES).map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <textarea value={form.systemPrompt} onChange={(e) => setForm((p) => ({ ...p, systemPrompt: e.target.value }))}
              rows={4} placeholder="Опишите роль и задачи AI-ассистента для этого отдела..."
              className={`border rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-colors ${promptEmpty ? "border-yellow-400 bg-yellow-50" : "border-[#E2E8F0]"}`} />
            {promptEmpty && (
              <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                Если оставить пустым, будет использован стандартный промт: «{DEFAULT_PROMPT}»
              </p>
            )}
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex justify-end gap-3 mt-1">
            <button type="button" onClick={onClose}
              className="border border-[#E2E8F0] text-[#64748B] px-4 py-2 rounded-lg text-sm hover:bg-[#F8F9FA] transition-colors cursor-pointer">
              Отмена
            </button>
            <button type="submit" disabled={submitting}
              className="bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer">
              {submitting ? "Сохраняем..." : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const plan = user ? PLANS[user.plan] : PLANS.business;
  const atLimit = departments.length >= (plan?.maxDepartments ?? Infinity);

  useEffect(() => {
    apiGetDepartments()
      .then((d) => setDepartments(d.departments))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (form: DeptForm) => {
    setFormError("");
    if (!form.name.trim()) { setFormError("Укажите название"); return; }
    setSubmitting(true);
    try {
      const res = await apiCreateDepartment(form);
      setDepartments((p) => [...p, res.department]);
      setShowCreate(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Ошибка создания");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (form: DeptForm) => {
    if (!editDept) return;
    setFormError("");
    if (!form.name.trim()) { setFormError("Укажите название"); return; }
    setSubmitting(true);
    try {
      const res = await apiUpdateDepartment(editDept.id, form);
      setDepartments((p) => p.map((d) => d.id === editDept.id ? res.department : d));
      setEditDept(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    await apiDeleteDepartment(id).catch(() => {});
    setDepartments((p) => p.filter((d) => d.id !== id));
    setDeleteId(null);
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-[#1E293B]">Добро пожаловать в Mindcod</h1>
            <p className="text-sm text-[#64748B] mt-1">Выберите отдел для работы с AI-ассистентом</p>
          </div>
          {user?.role === "admin" && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-[#64748B]">
                Отделов: <strong className={atLimit ? "text-red-500" : "text-[#1E293B]"}>{departments.length}</strong>
                {" / "}{plan.maxDepartments === Infinity ? "∞" : plan.maxDepartments}
              </span>
              <button
                onClick={() => !atLimit && setShowCreate(true)}
                disabled={atLimit}
                title={atLimit ? "Лимит отделов по тарифу исчерпан. Обновите тариф." : ""}
                className="bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap">
                + Добавить отдел
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-20 text-[#64748B]">Загрузка...</div>
        ) : departments.length === 0 ? (
          <div className="text-center py-20 text-[#64748B]">
            <p className="text-4xl mb-4">🏢</p>
            <p>Нет отделов. Создайте первый.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((dept) => (
              <div key={dept.id} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group relative">
                <Link to={`/department/${dept.id}`} className="block p-5">
                  <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] flex items-center justify-center text-2xl mb-4">{dept.icon}</div>
                  <h3 className="font-semibold text-[#1E293B] group-hover:text-[#2563EB] transition-colors">{dept.name}</h3>
                  <p className="text-sm text-[#64748B] mt-1">{dept.description || "Нажмите, чтобы открыть чат"}</p>
                  <div className="mt-3 text-xs text-[#2563EB] font-medium opacity-0 group-hover:opacity-100 transition-opacity">Открыть чат →</div>
                </Link>
                {user?.role === "admin" && (
                  <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={() => { setFormError(""); setEditDept(dept); }}
                      className="w-7 h-7 flex items-center justify-center text-[#64748B] hover:text-[#2563EB] hover:bg-[#EFF6FF] rounded-lg transition-all cursor-pointer"
                      title="Редактировать отдел">
                      ✏️
                    </button>
                    <button
                      onClick={() => setDeleteId(dept.id)}
                      className="w-7 h-7 flex items-center justify-center text-[#64748B] hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                      title="Удалить отдел">
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <DeptFormModal
          title="Создать отдел"
          initial={{ name: "", description: "", icon: "💬", systemPrompt: "" }}
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
          submitting={submitting}
          error={formError}
        />
      )}

      {/* Edit modal */}
      {editDept && (
        <DeptFormModal
          title="Редактировать отдел"
          initial={{ name: editDept.name, description: editDept.description, icon: editDept.icon, systemPrompt: editDept.systemPrompt }}
          onClose={() => setEditDept(null)}
          onSubmit={handleEdit}
          submitting={submitting}
          error={formError}
        />
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeleteId(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-[#1E293B] mb-2">Удалить отдел?</h3>
            <p className="text-sm text-[#64748B] mb-5">Все чаты и файлы отдела будут удалены без возможности восстановления.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="border border-[#E2E8F0] text-[#64748B] px-4 py-2 rounded-lg text-sm hover:bg-[#F8F9FA] cursor-pointer">Отмена</button>
              <button onClick={() => void handleDelete(deleteId)} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer">Удалить</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
