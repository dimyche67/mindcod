import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { PLANS } from "../utils/plans";
import { apiGetDepartments } from "../api";
import { AppLayout } from "../components/AppLayout";

export function SettingsPage() {
  const { user } = useAuth();
  const [showContact, setShowContact] = useState(false);
  const [deptCount, setDeptCount] = useState<number | null>(null);

  // Все хуки до раннего return
  useEffect(() => {
    if (!user || user.role !== "admin") return;
    apiGetDepartments()
      .then((res) => setDeptCount(res.departments.length))
      .catch(() => {});
  }, [user]);

  if (!user || user.role !== "admin") return <Navigate to="/dashboard" replace />;

  const plan = PLANS[user.plan];

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-[#1E293B]">Настройки</h1>

        {/* Company */}
        <section className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-6">
          <h2 className="font-semibold text-[#1E293B] mb-4">Компания</h2>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#64748B]">Название компании</label>
              <input defaultValue={user.companyName} readOnly
                className="border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-sm text-[#1E293B] bg-[#F8F9FA]" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#64748B]">Email администратора</label>
              <input value={user.email} readOnly
                className="border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-sm text-[#64748B] bg-[#F8F9FA]" />
            </div>
          </div>
        </section>

        {/* Tariff */}
        <section className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-6">
          <h2 className="font-semibold text-[#1E293B] mb-4">Тариф и использование</h2>

          <div className="flex items-center gap-3 mb-5">
            <span className="text-sm font-medium text-[#1E293B]">Текущий тариф:</span>
            <span className="bg-[#EFF6FF] text-[#2563EB] text-sm font-semibold px-3 py-1 rounded-full">{plan.name}</span>
          </div>

          <div className="flex flex-col gap-3 mb-6">
            {[
              { label: "Отделов", used: deptCount ?? "…", max: plan.maxDepartments === Infinity ? "∞" : plan.maxDepartments },
              { label: "Пользователей", used: 1, max: plan.maxUsers === Infinity ? "∞" : plan.maxUsers },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[#64748B]">{item.label}</span>
                  <span className="font-medium text-[#1E293B]">{item.used} / {item.max}</span>
                </div>
                {typeof item.max === "number" && typeof item.used === "number" && (
                  <div className="h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                    <div className="h-full bg-[#2563EB] rounded-full" style={{ width: `${Math.min(100, (item.used / item.max) * 100)}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(["starter", "business", "enterprise"] as const).map((planId) => {
              const p = PLANS[planId];
              const isCurrent = user.plan === planId;
              return (
                <div key={planId} className={`rounded-xl border p-4 flex flex-col gap-2 ${isCurrent ? "border-[#2563EB] bg-[#EFF6FF]" : "border-[#E2E8F0]"}`}>
                  <div className="font-semibold text-[#1E293B] text-sm">{p.name}</div>
                  <div className="text-lg font-bold text-[#1E293B]">{p.price.toLocaleString("ru-RU")} ₽<span className="text-xs font-normal text-[#64748B]">/мес</span></div>
                  {isCurrent ? (
                    <span className="text-xs text-[#2563EB] font-medium">Текущий тариф</span>
                  ) : (
                    <button onClick={() => setShowContact(true)}
                      className="border border-[#E2E8F0] text-[#1E293B] hover:bg-[#F8F9FA] px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer">
                      Выбрать
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {showContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowContact(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-[#1E293B] mb-2">Смена тарифа</h3>
            <p className="text-sm text-[#64748B] mb-4">Для смены тарифа свяжитесь с нами:</p>
            <a href="mailto:admin@aioffice.ru" className="text-[#2563EB] font-medium text-sm">admin@aioffice.ru</a>
            <div className="mt-5">
              <button onClick={() => setShowContact(false)}
                className="w-full border border-[#E2E8F0] text-[#64748B] py-2 rounded-lg text-sm cursor-pointer hover:bg-[#F8F9FA]">
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
