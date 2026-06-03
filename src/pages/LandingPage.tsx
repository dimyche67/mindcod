import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { PLANS } from "../utils/plans";

export function LandingPage() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-[#E2E8F0]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-bold text-[#2563EB]">Mindcod</span>
          <nav className="hidden md:flex items-center gap-8 text-sm text-[#64748B]">
            <a href="#features" className="hover:text-[#1E293B] transition-colors">Возможности</a>
            <a href="#crm" className="hover:text-[#1E293B] transition-colors">CRM</a>
            <a href="#departments" className="hover:text-[#1E293B] transition-colors">Отделы</a>
            <a href="#pricing" className="hover:text-[#1E293B] transition-colors">Тарифы</a>
            <a href="#reviews" className="hover:text-[#1E293B] transition-colors">Отзывы</a>
            <a href="#contacts" className="hover:text-[#1E293B] transition-colors">Контакты</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-[#1E293B] border border-[#E2E8F0] px-4 py-2 rounded-lg hover:bg-[#F8F9FA] transition-colors">
              Войти
            </Link>
            <Link to="/register" className="text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] px-4 py-2 rounded-lg transition-colors">
              Начать бесплатно
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-[#EFF6FF] text-[#2563EB] text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          🚀 AI-платформа для бизнеса нового поколения
        </div>
        <h1 className="text-5xl font-bold text-[#1E293B] mb-6 leading-tight">
          AI-ассистенты для каждого<br />отдела вашей компании
        </h1>
        <p className="text-xl text-[#64748B] mb-10 max-w-2xl mx-auto">
          Закупки, юридический, HR, логистика — каждый отдел получает своего умного помощника. Плюс CRM для работы с клиентами.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link to="/register" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-8 py-3.5 rounded-lg font-semibold text-base transition-colors">
            Попробовать бесплатно
          </Link>
          <a href="#features" className="border border-[#E2E8F0] text-[#1E293B] hover:bg-[#F8F9FA] px-8 py-3.5 rounded-lg font-semibold text-base transition-colors">
            Узнать больше
          </a>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-[#F8F9FA] py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-[#1E293B] text-center mb-4">Что умеет Mindcod</h2>
          <p className="text-center text-[#64748B] mb-12 max-w-xl mx-auto">Полный набор инструментов для автоматизации рутины в каждом отделе</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: "🧠", title: "Специализированный AI", text: "Каждый отдел получает ассистента со своей ролью, экспертизой и системным промптом" },
              { icon: "📁", title: "История и артефакты", text: "Все диалоги сохраняются, AI создаёт документы, шаблоны и резюме по запросу" },
              { icon: "📎", title: "Загрузка файлов", text: "Загружайте документы — AI анализирует их содержимое в контексте ваших задач" },
              { icon: "📋", title: "CRM для заявок", text: "Kanban-доска, карточки лидов, задачи, комментарии и учёт прибыли по сделкам" },
              { icon: "🔗", title: "Webhook с сайта", text: "Заявки с вашего сайта автоматически попадают в CRM через простой POST-запрос" },
              { icon: "👥", title: "Управление командой", text: "Приглашайте сотрудников, разграничивайте доступ к отделам по ролям" },
            ].map((f) => (
              <div key={f.title} className="bg-white rounded-xl p-6 shadow-sm border border-[#E2E8F0]">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-semibold text-[#1E293B] mb-2">{f.title}</h3>
                <p className="text-sm text-[#64748B]">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CRM Section */}
      <section id="crm" className="py-20 max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-[#EFF6FF] text-[#2563EB] text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
              📋 CRM-модуль
            </div>
            <h2 className="text-3xl font-bold text-[#1E293B] mb-4">Управляйте заявками как в Bitrix24</h2>
            <p className="text-[#64748B] mb-6">Kanban-доска с drag-and-drop, карточки лидов с полной историей, задачи и комментарии — всё в одном месте.</p>
            <ul className="space-y-3">
              {[
                "Kanban: Новая → В расчёте → В работе → Не интересно",
                "Карточка лида: комментарии, задачи, история изменений",
                "Поле «Прибыль» и суммарная выручка на доске",
                "Webhook: заявки с сайта приходят автоматически",
                "Поиск по имени, телефону и email",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-[#475569]">
                  <span className="w-5 h-5 rounded-full bg-[#DCFCE7] flex items-center justify-center text-green-600 text-xs shrink-0">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-[#F8F9FA] rounded-2xl p-6 border border-[#E2E8F0]">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Новая заявка", count: 4, color: "border-t-blue-500" },
                { label: "В расчете", count: 2, color: "border-t-yellow-500" },
                { label: "В работе", count: 3, color: "border-t-green-500" },
                { label: "Не интересно", count: 1, color: "border-t-red-400" },
              ].map((col) => (
                <div key={col.label} className={`bg-white rounded-lg border-t-4 ${col.color} p-3 shadow-sm`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-[#1E293B]">{col.label}</span>
                    <span className="text-xs bg-[#F1F5F9] px-1.5 py-0.5 rounded text-[#64748B]">{col.count}</span>
                  </div>
                  {[...Array(Math.min(col.count, 2))].map((_, i) => (
                    <div key={i} className="bg-[#F8F9FA] rounded p-2 mb-1.5 last:mb-0">
                      <div className="h-2 bg-[#E2E8F0] rounded w-3/4 mb-1" />
                      <div className="h-1.5 bg-[#F1F5F9] rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Departments Section */}
      <section id="departments" className="bg-[#F8F9FA] py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-white text-[#64748B] text-xs font-semibold px-3 py-1.5 rounded-full border border-[#E2E8F0] mb-4">
              🏢 Модуль отделов
            </div>
            <h2 className="text-3xl font-bold text-[#1E293B] mb-4">Каждому отделу — свой AI</h2>
            <p className="text-[#64748B] max-w-xl mx-auto">Создавайте отделы с индивидуальными промптами. Каждый ассистент знает специфику своей области.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { icon: "🛒", name: "Закупки", desc: "Поиск поставщиков и КП" },
              { icon: "⚖️", name: "Юридический", desc: "Анализ договоров и законов" },
              { icon: "👥", name: "HR", desc: "Подбор и кадровые вопросы" },
              { icon: "🚛", name: "Логистика", desc: "Маршруты и перевозчики" },
              { icon: "📢", name: "Маркетинг", desc: "Рекламные кампании" },
              { icon: "📊", name: "Бухгалтерия", desc: "Налоги и отчётность" },
            ].map((dept) => (
              <div key={dept.name} className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-sm text-center hover:shadow-md transition-shadow">
                <div className="text-3xl mb-2">{dept.icon}</div>
                <p className="font-semibold text-[#1E293B] text-sm mb-1">{dept.name}</p>
                <p className="text-[10px] text-[#94A3B8]">{dept.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 bg-white rounded-xl p-6 border border-[#E2E8F0] max-w-2xl mx-auto">
            <p className="text-sm font-semibold text-[#1E293B] mb-3">Ключевые возможности отделов:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                "Кастомный системный промпт для каждого отдела",
                "Готовые шаблоны промптов для 6+ специализаций",
                "Изолированная история чатов",
                "Умный веб-поиск по контексту отдела",
                "Загрузка файлов для анализа",
                "Сохранение ответов как артефактов",
              ].map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm text-[#475569]">
                  <span className="text-[#2563EB] text-xs">✓</span>{f}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-[#1E293B] mb-4">Тарифы</h2>
          <p className="text-[#64748B]">Начните бесплатно, масштабируйтесь по мере роста</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-6 border border-[#E2E8F0] shadow-sm flex flex-col">
            <div className="mb-4">
              <div className="text-sm font-semibold text-[#64748B] mb-1">{PLANS.starter.name}</div>
              <div className="text-3xl font-bold text-[#1E293B]">{PLANS.starter.price.toLocaleString("ru-RU")} ₽<span className="text-base font-normal text-[#64748B]">/мес</span></div>
            </div>
            <ul className="flex flex-col gap-2 mb-6 flex-1">
              {PLANS.starter.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-[#64748B]"><span className="text-green-500">✓</span>{f}</li>
              ))}
            </ul>
            <Link to="/register" className="text-center border border-[#2563EB] text-[#2563EB] hover:bg-[#EFF6FF] px-4 py-2.5 rounded-lg font-medium text-sm transition-colors">
              Выбрать
            </Link>
          </div>
          <div className="bg-[#2563EB] rounded-xl p-6 border border-[#2563EB] shadow-lg flex flex-col relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#F59E0B] text-white text-xs font-bold px-3 py-1 rounded-full">Популярный</div>
            <div className="mb-4">
              <div className="text-sm font-semibold text-blue-200 mb-1">{PLANS.business.name}</div>
              <div className="text-3xl font-bold text-white">{PLANS.business.price.toLocaleString("ru-RU")} ₽<span className="text-base font-normal text-blue-200">/мес</span></div>
            </div>
            <ul className="flex flex-col gap-2 mb-6 flex-1">
              {PLANS.business.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-blue-100"><span className="text-white">✓</span>{f}</li>
              ))}
            </ul>
            <Link to="/register" className="text-center bg-white text-[#2563EB] hover:bg-blue-50 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors">
              Выбрать
            </Link>
          </div>
          <div className="bg-white rounded-xl p-6 border border-[#E2E8F0] shadow-sm flex flex-col">
            <div className="mb-4">
              <div className="text-sm font-semibold text-[#64748B] mb-1">{PLANS.enterprise.name}</div>
              <div className="text-3xl font-bold text-[#1E293B]">{PLANS.enterprise.price.toLocaleString("ru-RU")} ₽<span className="text-base font-normal text-[#64748B]">/мес</span></div>
            </div>
            <ul className="flex flex-col gap-2 mb-6 flex-1">
              {PLANS.enterprise.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-[#64748B]"><span className="text-green-500">✓</span>{f}</li>
              ))}
            </ul>
            <a href="#contacts" className="text-center border border-[#E2E8F0] text-[#1E293B] hover:bg-[#F8F9FA] px-4 py-2.5 rounded-lg font-medium text-sm transition-colors">
              Связаться с нами
            </a>
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section id="reviews" className="bg-[#F8F9FA] py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-[#1E293B] text-center mb-4">Отзывы клиентов</h2>
          <p className="text-center text-[#64748B] mb-12">Что говорят команды, которые уже работают с Mindcod</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: "Андрей Козлов",
                role: "Директор по закупкам",
                company: "СтройГрупп",
                text: "Раньше менеджеры тратили 2–3 часа на поиск поставщиков. Теперь AI за 5 минут выдаёт список с контактами и ценовыми диапазонами. Производительность выросла в разы.",
                rating: 5,
              },
              {
                name: "Екатерина Сорокина",
                role: "HR-директор",
                company: "ФинансТех",
                text: "Юридический ассистент помогает проверять договоры — указывает на рискованные формулировки со ссылками на статьи ГК РФ. Раньше мы отдавали это на аутсорс.",
                rating: 5,
              },
              {
                name: "Михаил Петров",
                role: "Руководитель отдела маркетинга",
                company: "Ecommerce Solutions",
                text: "CRM-модуль полностью закрыл потребность в отдельной системе для заявок. Лиды с сайта сразу падают в Kanban, менеджеры видят всё в одном месте.",
                rating: 5,
              },
              {
                name: "Ольга Иванова",
                role: "Главный бухгалтер",
                company: "ЛогиМастер",
                text: "Бухгалтерский ассистент знает актуальные сроки сдачи отчётности и типовые проводки. Экономим время на рутинных консультациях для сотрудников.",
                rating: 5,
              },
              {
                name: "Дмитрий Чернов",
                role: "CEO",
                company: "Медиа Агентство Pulse",
                text: "Попробовали на маркетинговом отделе — понравилось настолько, что подключили все 6 отделов. Интерфейс интуитивный, команда освоилась за один день.",
                rating: 5,
              },
            ].map((r) => (
              <div key={r.name} className="bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-sm">
                <div className="flex items-center gap-0.5 mb-3">
                  {[...Array(r.rating)].map((_, i) => <span key={i} className="text-[#F59E0B] text-sm">★</span>)}
                </div>
                <p className="text-sm text-[#475569] mb-4 leading-relaxed">"{r.text}"</p>
                <div className="flex items-center gap-3 pt-3 border-t border-[#F1F5F9]">
                  <div className="w-8 h-8 rounded-full bg-[#EFF6FF] flex items-center justify-center text-sm font-semibold text-[#2563EB]">
                    {r.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1E293B]">{r.name}</p>
                    <p className="text-xs text-[#94A3B8]">{r.role}, {r.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contacts */}
      <section id="contacts" className="py-20 max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div>
            <h2 className="text-3xl font-bold text-[#1E293B] mb-4">Свяжитесь с нами</h2>
            <p className="text-[#64748B] mb-8">Ответим на вопросы, поможем выбрать тариф и настроить платформу под ваши задачи.</p>
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm text-[#475569]">
                <span className="w-9 h-9 bg-[#EFF6FF] rounded-lg flex items-center justify-center text-base">✉️</span>
                <div>
                  <p className="font-medium text-[#1E293B]">Email</p>
                  <a href="mailto:hello@aioffice.ru" className="text-[#2563EB] hover:underline">hello@aioffice.ru</a>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm text-[#475569]">
                <span className="w-9 h-9 bg-[#EFF6FF] rounded-lg flex items-center justify-center text-base">📞</span>
                <div>
                  <p className="font-medium text-[#1E293B]">Телефон</p>
                  <a href="tel:+74951234567" className="text-[#2563EB] hover:underline">+7 (495) 123-45-67</a>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm text-[#475569]">
                <span className="w-9 h-9 bg-[#EFF6FF] rounded-lg flex items-center justify-center text-base">🕐</span>
                <div>
                  <p className="font-medium text-[#1E293B]">Время работы</p>
                  <p>Пн–Пт, 9:00–18:00 МСК</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#F8F9FA] rounded-2xl p-6 border border-[#E2E8F0]">
            <h3 className="font-semibold text-[#1E293B] mb-4">Напишите нам</h3>
            <form className="flex flex-col gap-3" onSubmit={(e) => e.preventDefault()}>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#1E293B]">Имя</label>
                <input placeholder="Иван Иванов"
                  className="border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#1E293B]">Email</label>
                <input type="email" placeholder="ivan@company.ru"
                  className="border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#1E293B]">Сообщение</label>
                <textarea placeholder="Расскажите о вашем проекте…" rows={4}
                  className="border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] resize-none" />
              </div>
              <button type="submit"
                className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-6 py-2.5 rounded-lg font-medium text-sm transition-colors cursor-pointer">
                Отправить
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#E2E8F0] py-8 bg-[#F8F9FA]">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-bold text-[#2563EB]">Mindcod</span>
          <nav className="flex items-center gap-6 text-sm text-[#94A3B8]">
            <a href="#features" className="hover:text-[#64748B]">Возможности</a>
            <a href="#crm" className="hover:text-[#64748B]">CRM</a>
            <a href="#pricing" className="hover:text-[#64748B]">Тарифы</a>
            <a href="#contacts" className="hover:text-[#64748B]">Контакты</a>
          </nav>
          <span className="text-sm text-[#94A3B8]">© 2026 Mindcod</span>
        </div>
      </footer>
    </div>
  );
}
