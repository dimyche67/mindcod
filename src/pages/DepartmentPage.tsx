import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { useAuth } from "../hooks/useAuth";
import type { ChatSummary, ChatMessage, Department } from "../types";
import { apiGetChats, apiGetChatMessages, apiSendMessage, apiUploadFile, apiGetDepartment } from "../api";
import { DepartmentSidebar } from "../components/chat/DepartmentSidebar";

// ── Markdown-компоненты ──────────────────────────────────────────────────────
const mdComponents: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="text-[#2563EB] underline underline-offset-2 hover:text-[#1D4ED8] break-all">
      {children}
    </a>
  ),
  p: ({ children }) => <p className="mb-1.5 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }) => <h1 className="font-bold text-base mb-1">{children}</h1>,
  h2: ({ children }) => <h2 className="font-semibold text-sm mb-1">{children}</h2>,
  h3: ({ children }) => <h3 className="font-semibold text-sm mb-0.5">{children}</h3>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  table: ({ children }) => (
    <div className="overflow-x-auto mb-2">
      <table className="text-xs border-collapse w-full">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-[#E2E8F0] bg-[#F8F9FA] px-2 py-1 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-[#E2E8F0] px-2 py-1">{children}</td>,
  code: ({ children }) => <code className="bg-[#F1F5F9] rounded px-1 py-0.5 text-xs font-mono">{children}</code>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-[#E2E8F0] pl-3 text-[#64748B] my-1">{children}</blockquote>,
};

// ── Подсказки по типу отдела ─────────────────────────────────────────────────
function getSuggestions(dept: Department | null): string[] {
  if (!dept) return ["С чего начать?", "Помоги с задачей", "Что ты умеешь?"];
  const hay = `${dept.name} ${dept.systemPrompt}`.toLowerCase();
  if (/юр|закон|право|договор/.test(hay))
    return ["Проанализируй этот договор", "Какие риски в этом пункте?", "Найди актуальный закон по теме"];
  if (/закуп|поставщ|снабж/.test(hay))
    return ["Найди поставщиков цемента в Москве", "Сравни условия поставки", "Составь заявку на закупку"];
  if (/hr|кадр|персонал|подбор/.test(hay))
    return ["Составь вакансию для разработчика", "Оцени это резюме", "Что говорит ТК РФ об отпуске"];
  if (/логист|доставк|перевозк|транспорт/.test(hay))
    return ["Рассчитай стоимость доставки", "Найди перевозчиков", "Оптимизируй маршрут"];
  if (/маркет|реклам|продвиж|контент|smm/.test(hay))
    return ["Придумай контент-план", "Проанализируй конкурентов", "Напиши пост для соцсетей"];
  if (/бухгалтер|налог|учёт|учет|фнс/.test(hay))
    return ["Как учесть это в расходах?", "Какие налоги платит ИП?", "Помоги с закрывающими документами"];
  return ["С чего начать?", "Помоги с задачей", "Что ты умеешь?"];
}

// ── Компонент ────────────────────────────────────────────────────────────────
export function DepartmentPage() {
  const { id: departmentId } = useParams<{ id: string }>();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [dept, setDept] = useState<Department | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // FIX 3 — AbortController: отменяем запросы при смене отдела
  useEffect(() => {
    if (!departmentId) return;
    const controller = new AbortController();

    apiGetDepartment(departmentId, controller.signal)
      .then((res) => { if (!controller.signal.aborted) setDept(res.department); })
      .catch(() => {});

    apiGetChats(departmentId, controller.signal)
      .then((res) => { if (!controller.signal.aborted) setChats(res.chats); })
      .catch(() => {});

    return () => controller.abort();
  }, [departmentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // УЛУЧШЕНИЕ 1 — isLoadingChat при переключении чата
  const loadChat = useCallback(async (chatId: string) => {
    if (!departmentId) return;
    setActiveChatId(chatId);
    setIsLoadingChat(true);
    setMessages([]);
    setDrawerOpen(false);
    try {
      const res = await apiGetChatMessages(departmentId, chatId);
      setMessages(res.messages);
    } catch {
      /* ignore */
    } finally {
      setIsLoadingChat(false);
    }
  }, [departmentId]);

  const startNewChat = () => {
    setActiveChatId(null);
    setMessages([]);
    setDrawerOpen(false);
  };

  const handleSend = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!departmentId || (!msg && !attachedFile) || isLoading) return;

    if (attachedFile) {
      try { await apiUploadFile(departmentId, attachedFile); } catch { /* ignore */ }
      setAttachedFile(null);
    }

    if (!msg) return;
    setInput("");
    setIsLoading(true);

    const deptName = dept?.name ?? "Ассистент";
    const userMsg: ChatMessage = { id: `tmp_${Date.now()}`, role: "user", author: "Вы", text: msg };
    setMessages((p) => [...p, userMsg]);

    try {
      const res = await apiSendMessage(departmentId, msg, activeChatId ?? undefined);

      if (!activeChatId) {
        setActiveChatId(res.chatId);
        apiGetChats(departmentId).then((r) => setChats(r.chats)).catch(() => {});
      }

      const aiMsg: ChatMessage = { id: res.messageId, role: "assistant", author: deptName, text: res.reply };
      setMessages((p) => [...p, aiMsg]);
    } catch {
      setMessages((p) => [...p, {
        id: `err_${Date.now()}`, role: "assistant", author: deptName,
        text: "Не удалось получить ответ. Проверьте подключение к бэкенду.",
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const deptName = dept?.name ?? "Отдел";
  const deptIcon = dept?.icon ?? "💬";
  const deptPromptPreview = dept?.systemPrompt
    ? dept.systemPrompt.slice(0, 80) + (dept.systemPrompt.length > 80 ? "…" : "")
    : "";
  const suggestions = getSuggestions(dept);

  return (
    <div className="h-screen flex flex-col bg-[#F8F9FA] overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-[#E2E8F0] h-14 flex items-center justify-between px-4 md:px-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-bold text-[#2563EB]">Mindcod</span>
          <Link to="/dashboard" className="text-sm text-[#64748B] hover:text-[#1E293B] transition-colors hidden sm:inline">
            ← Все отделы
          </Link>
          <button
            onClick={() => setDrawerOpen(true)}
            className="md:hidden text-sm border border-[#E2E8F0] px-3 py-1.5 rounded-lg hover:bg-[#F8F9FA] transition-colors cursor-pointer"
          >
            ☰ Чаты
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#64748B] hidden sm:inline">{deptIcon} {deptName}</span>
          <button
            onClick={() => { logout(); navigate("/login"); }}
            className="text-sm border border-[#E2E8F0] px-3 py-1.5 rounded-lg hover:bg-[#F8F9FA] transition-colors cursor-pointer"
          >
            Выйти
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* FIX 7 — aside без дублирующихся border/padding (они внутри DepartmentSidebar) */}
        <aside className="hidden md:flex w-60 bg-white border-r border-[#E2E8F0] flex-col flex-shrink-0">
          <DepartmentSidebar
            chats={chats}
            activeChatId={activeChatId}
            onChatSelect={(id) => void loadChat(id)}
            onNewChat={startNewChat}
            departmentId={departmentId ?? ""}
            deptName={deptName}
            deptIcon={deptIcon}
            deptPromptPreview={deptPromptPreview}
          />
        </aside>

        {/* Mobile Drawer */}
        {drawerOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
            <div className="relative w-72 bg-white h-full shadow-xl flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0]">
                <span className="font-semibold text-sm text-[#1E293B]">История чатов</span>
                <button onClick={() => setDrawerOpen(false)} className="text-[#64748B] hover:text-[#1E293B] cursor-pointer text-lg">✕</button>
              </div>
              <div className="flex-1 overflow-hidden">
                <DepartmentSidebar
                  chats={chats}
                  activeChatId={activeChatId}
                  onChatSelect={(id) => void loadChat(id)}
                  onNewChat={startNewChat}
                  departmentId={departmentId ?? ""}
                  deptName={deptName}
                  deptIcon={deptIcon}
                  deptPromptPreview={deptPromptPreview}
                />
              </div>
            </div>
          </div>
        )}

        {/* Chat area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden bg-white m-2 md:m-4 rounded-xl border border-[#E2E8F0] shadow-sm">

            {/* УЛУЧШЕНИЕ 1 — индикатор загрузки чата */}
            {isLoadingChat ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex items-center gap-2 text-[#64748B]">
                  <span className="text-sm">Загружаю чат</span>
                  <span className="thinking-dots flex gap-1"><span /><span /><span /></span>
                </div>
              </div>

            /* УЛУЧШЕНИЕ 2 — пустое состояние с подсказками */
            ) : messages.length === 0 && !activeChatId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                <div className="text-5xl mb-4">{deptIcon}</div>
                <h2 className="text-xl font-semibold text-[#1E293B] mb-1">{deptName}</h2>
                <p className="text-sm text-[#64748B] mb-6">Чем могу помочь?</p>
                <div className="flex flex-col sm:flex-row gap-2 flex-wrap justify-center max-w-md">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => void handleSend(s)}
                      className="bg-[#F8F9FA] hover:bg-[#EFF6FF] border border-[#E2E8F0] hover:border-[#2563EB]/30 text-[#1E293B] text-sm px-4 py-2 rounded-xl transition-colors cursor-pointer text-left"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

            ) : (
              <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 flex flex-col gap-3 messages-scroll">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex items-start gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                    {msg.role !== "user" && (
                      <div className="w-7 h-7 rounded-full bg-[#EFF6FF] flex items-center justify-center text-sm flex-shrink-0 mt-0.5">
                        {deptIcon}
                      </div>
                    )}
                    <div className={`flex flex-col gap-1 max-w-[85%] md:max-w-[78%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                      <div className={`px-3.5 py-2.5 rounded-2xl text-sm ${
                        msg.role === "user"
                          ? "bg-[#2563EB] text-white rounded-br-sm"
                          : "bg-[#F8F9FA] border border-[#E2E8F0] text-[#1E293B] rounded-bl-sm"
                      }`}>
                        {msg.role === "assistant"
                          ? <ReactMarkdown components={mdComponents}>{msg.text}</ReactMarkdown>
                          : msg.text}
                      </div>
                    </div>
                    {msg.role === "user" && (
                      <div className="w-7 h-7 rounded-full bg-[#2563EB] flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5">
                        Я
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[#EFF6FF] flex items-center justify-center text-sm flex-shrink-0">{deptIcon}</div>
                    <div className="bg-[#F8F9FA] border border-[#E2E8F0] rounded-2xl rounded-bl-sm px-3.5 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[#64748B]">Думает</span>
                        <span className="thinking-dots flex gap-1"><span /><span /><span /></span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}

            {/* Input */}
            <div className="border-t border-[#E2E8F0] p-3 flex-shrink-0">
              {attachedFile && (
                <div className="flex items-center gap-2 mb-2 text-xs text-[#64748B] bg-[#F8F9FA] rounded-lg px-3 py-1.5">
                  <span>📎 {attachedFile.name}</span>
                  <button onClick={() => setAttachedFile(null)} className="ml-auto hover:text-red-500 cursor-pointer">✕</button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="text-[#64748B] hover:text-[#2563EB] transition-colors cursor-pointer flex-shrink-0 pb-2.5 text-lg"
                  title="Прикрепить файл"
                >
                  📎
                  <input ref={fileRef} type="file" accept=".txt,.pdf" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) setAttachedFile(f); e.target.value = ""; }} />
                </button>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
                  placeholder="Введите сообщение... (Enter — отправить, Shift+Enter — новая строка)"
                  rows={2}
                  disabled={isLoading}
                  className="flex-1 resize-none border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all min-h-[42px] max-h-32 disabled:opacity-60"
                />
                <button
                  onClick={() => void handleSend()}
                  disabled={isLoading || (!input.trim() && !attachedFile)}
                  className="bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0 cursor-pointer"
                >
                  {isLoading ? "..." : "Отправить"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
