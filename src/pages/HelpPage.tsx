import { useState } from "react";
import { AppLayout } from "../components/AppLayout";

type Section = { id: string; icon: string; title: string; content: React.ReactNode };

function AccordionItem({ icon, title, content }: { icon: string; title: string; content: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-[#F8F9FA] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{icon}</span>
          <span className="font-semibold text-[#1E293B] text-sm">{title}</span>
        </div>
        <svg
          className={`w-5 h-5 text-[#94A3B8] transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-5 py-4 bg-white border-t border-[#F1F5F9] text-sm text-[#475569] leading-relaxed">
          {content}
        </div>
      )}
    </div>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-start gap-3 mb-2">
      <span className="w-6 h-6 rounded-full bg-[#EFF6FF] text-[#2563EB] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{n}</span>
      <span>{text}</span>
    </div>
  );
}

function Tip({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-3 py-2 mt-3 text-xs text-[#92400E]">
      <span className="shrink-0">💡</span>
      <span>{text}</span>
    </div>
  );
}

const SECTIONS: Section[] = [
  {
    id: "chat",
    icon: "💬",
    title: "Как работает чат с AI",
    content: (
      <div>
        <p className="mb-3">Каждый отдел — это отдельный AI-ассистент с настроенной ролью. Вы общаетесь в чате, и ассистент отвечает строго в контексте своей специализации.</p>
        <Step n={1} text='Перейдите в нужный отдел с дашборда (например, "Закупки" или "Юридический").' />
        <Step n={2} text='Нажмите "+ Новый чат" или выберите существующий из списка слева.' />
        <Step n={3} text="Задайте вопрос в поле ввода — ассистент ответит мгновенно." />
        <Step n={4} text='Важные ответы можно сохранить как артефакт: кнопка "Сохранить как артефакт" появляется рядом с сообщением.' />
        <Tip text="Для лучших результатов формулируйте вопросы конкретно: вместо «помоги с договором» — «проверь этот пункт договора поставки на соответствие ГК РФ»." />
      </div>
    ),
  },
  {
    id: "dept",
    icon: "🏢",
    title: "Как настроить отдел и системный промпт",
    content: (
      <div>
        <p className="mb-3">Системный промпт — это инструкция для AI, которая задаёт его роль и поведение. Чем точнее промпт, тем полезнее ответы.</p>
        <Step n={1} text="На дашборде нажмите ✏️ рядом с нужным отделом." />
        <Step n={2} text='В поле "Системный промпт" опишите роль ассистента: кто он, что умеет, как должен отвечать.' />
        <Step n={3} text='Используйте готовые шаблоны — кнопки "HR", "Юридический", "Закупки" и другие подставляют проверенные промпты.' />
        <Step n={4} text="Сохраните изменения. Новый промпт применится сразу с следующего сообщения." />
        <Tip text='Добавьте в промпт правило: "Отвечай только на русском, используй маркированные списки". Это сделает ответы читаемее.' />
      </div>
    ),
  },
  {
    id: "crm",
    icon: "📋",
    title: "Как пользоваться CRM",
    content: (
      <div>
        <p className="mb-3">CRM — система для работы с заявками от клиентов. Kanban-доска с 4 статусами: Новая → В расчете → В работе → Не интересно.</p>
        <Step n={1} text='Перейдите в раздел "CRM" через боковое меню.' />
        <Step n={2} text='Создайте заявку вручную кнопкой "+ Новая заявка" или настройте автоматическое получение с сайта через Webhook.' />
        <Step n={3} text="Перетаскивайте карточки между колонками для смены статуса (drag-and-drop)." />
        <Step n={4} text="Откройте карточку для подробной работы: добавляйте комментарии, создавайте задачи, указывайте прибыль по сделке." />
        <Step n={5} text='Для интеграции с сайтом используйте Webhook: POST /api/crm/webhook/{companyId} — все поля формы сохранятся в заявке.' />
        <Tip text="Поле «Прибыль» в карточке лида позволяет отслеживать суммарную выручку по всем сделкам — сумма видна в шапке CRM-доски." />
      </div>
    ),
  },
  {
    id: "files",
    icon: "📎",
    title: "Как загружать файлы",
    content: (
      <div>
        <p className="mb-3">Файлы загружаются в контекст конкретного отдела. AI может использовать их содержимое при ответах.</p>
        <Step n={1} text="Откройте нужный отдел." />
        <Step n={2} text='В левом меню отдела нажмите "📎 Файлы отдела".' />
        <Step n={3} text='Нажмите "Загрузить файл" и выберите документ (PDF, DOCX, TXT).' />
        <Step n={4} text="После загрузки AI будет учитывать содержимое файла в ответах." />
        <Tip text="Загрузка файлов доступна на тарифах Бизнес и Корпоратив. На тарифе Старт эта функция недоступна." />
      </div>
    ),
  },
  {
    id: "team",
    icon: "👥",
    title: "Как приглашать сотрудников",
    content: (
      <div>
        <p className="mb-3">Администратор может пригласить сотрудников и дать им доступ к конкретным отделам.</p>
        <Step n={1} text='Перейдите в раздел "Команда" через боковое меню.' />
        <Step n={2} text='Нажмите "+ Пригласить сотрудника".' />
        <Step n={3} text="Заполните имя, email и пароль. Выберите отделы, к которым будет доступ." />
        <Step n={4} text="Сотрудник сможет войти в систему с указанными данными." />
        <Step n={5} text='Чтобы изменить доступ позже — нажмите "Изменить доступ" рядом с сотрудником.' />
        <Tip text="Сотрудники видят только назначенные им отделы. Управлять командой и настройками может только администратор." />
      </div>
    ),
  },
  {
    id: "plans",
    icon: "💳",
    title: "Тарифы и лимиты",
    content: (
      <div>
        <p className="mb-3">Выберите тариф исходя из размера команды и нужного функционала.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          {[
            { name: "Старт", price: "4 990 ₽/мес", limits: "3 отдела, 5 сотрудников", features: ["Чат с AI", "История диалогов"] },
            { name: "Бизнес", price: "14 990 ₽/мес", limits: "10 отделов, 25 сотрудников", features: ["Всё из Старта", "Загрузка файлов", "Артефакты", "CRM"] },
            { name: "Корпоратив", price: "39 990 ₽/мес", limits: "Без лимитов", features: ["Всё из Бизнеса", "Приоритетная поддержка", "Кастомизация"] },
          ].map((p) => (
            <div key={p.name} className="border border-[#E2E8F0] rounded-lg p-3">
              <p className="font-semibold text-[#1E293B] mb-1">{p.name}</p>
              <p className="text-[#2563EB] font-medium text-xs mb-1">{p.price}</p>
              <p className="text-[#94A3B8] text-xs mb-2">{p.limits}</p>
              <ul className="space-y-0.5">
                {p.features.map((f) => <li key={f} className="text-xs text-[#64748B] flex items-center gap-1"><span className="text-green-500">✓</span>{f}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <Tip text="Текущий тариф и лимиты отделов видны в разделе Настройки. Для смены тарифа — свяжитесь с нами." />
      </div>
    ),
  },
];

export function HelpPage() {
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#1E293B]">Справочник</h1>
          <p className="text-sm text-[#64748B] mt-1">Инструкции по работе с платформой Mindcod</p>
        </div>

        <div className="flex flex-col gap-3">
          {SECTIONS.map((s) => (
            <AccordionItem key={s.id} icon={s.icon} title={s.title} content={s.content} />
          ))}
        </div>

        <div className="mt-8 bg-[#EFF6FF] rounded-xl p-5 text-center">
          <p className="text-sm font-medium text-[#1E293B] mb-1">Не нашли ответ?</p>
          <p className="text-sm text-[#64748B]">
            Напишите нам на{" "}
            <a href="mailto:support@aioffice.ru" className="text-[#2563EB] hover:underline">
              support@aioffice.ru
            </a>
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
