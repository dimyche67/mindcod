import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pendingMsg, setPendingMsg] = useState("");

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setPendingMsg("");
    try {
      const result = await login(email.trim(), password);
      if (result?.pendingApproval) {
        setPendingMsg("Ваша заявка на рассмотрении. Мы проверим данные и откроем доступ в течение 24 часов.");
      } else if (result?.blocked) {
        setError("Аккаунт заблокирован. Свяжитесь с поддержкой: hello@aioffice.ru");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <Link to="/" className="text-2xl font-bold text-[#2563EB]">AI Офис</Link>
          <p className="text-sm text-[#64748B] mt-1">Вход в систему</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#1E293B]" htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.ru" autoComplete="email"
              className="border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#1E293B]" htmlFor="password">Пароль</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••" autoComplete="current-password"
              className="border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all" />
          </div>

          {pendingMsg && (
            <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-3 py-2.5 flex items-start gap-2">
              <span className="shrink-0">⏳</span>
              <p className="text-sm text-[#92400E]">{pendingMsg}</p>
            </div>
          )}
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <button type="submit" disabled={isLoading || !email || !password}
            className="bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-medium text-sm transition-colors mt-1">
            {isLoading ? "Вход..." : "Войти"}
          </button>
        </form>

        <p className="text-center text-sm text-[#64748B] mt-6">
          Нет аккаунта?{" "}
          <Link to="/register" className="text-[#2563EB] hover:underline font-medium">Зарегистрироваться</Link>
        </p>
      </div>
    </div>
  );
}
