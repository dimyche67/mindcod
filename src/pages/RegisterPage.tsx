import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function RegisterPage() {
  const { register, isAuthenticated, isLoading } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  if (pending) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] w-full max-w-sm p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-[#1E293B] mb-2">Заявка отправлена</h2>
          <p className="text-sm text-[#64748B] mb-6">
            Мы проверим данные и откроем доступ в течение <strong>24 часов</strong>. После активации вы сможете войти в систему.
          </p>
          <Link to="/login" className="text-sm text-[#2563EB] hover:underline">Вернуться на страницу входа</Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Пароли не совпадают"); return; }
    if (password.length < 6) { setError("Пароль минимум 6 символов"); return; }
    try {
      const result = await register(companyName.trim(), email.trim(), password);
      if (result?.pendingApproval) setPending(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка регистрации");
    }
  };

  const inputClass = "border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all";

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <Link to="/" className="text-2xl font-bold text-[#2563EB]">Mindcod</Link>
          <p className="text-sm text-[#64748B] mt-1">Регистрация компании</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#1E293B]">Название компании</label>
            <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
              placeholder="ООО Ромашка" className={inputClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#1E293B]">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@company.ru" autoComplete="email" className={inputClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#1E293B]">Пароль</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Минимум 6 символов" autoComplete="new-password" className={inputClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#1E293B]">Повторите пароль</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••" autoComplete="new-password" className={inputClass} />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <button type="submit"
            disabled={isLoading || !companyName || !email || !password || !confirm}
            className="bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-medium text-sm transition-colors mt-1">
            {isLoading ? "Отправляем заявку..." : "Создать аккаунт"}
          </button>
        </form>

        <p className="text-center text-sm text-[#64748B] mt-6">
          Уже есть аккаунт?{" "}
          <Link to="/login" className="text-[#2563EB] hover:underline font-medium">Войти</Link>
        </p>
      </div>
    </div>
  );
}
