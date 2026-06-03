import { Link } from "react-router-dom";
import type { ChatSummary } from "../../types";

interface Props {
  chats: ChatSummary[];
  activeChatId: string | null;
  onChatSelect: (id: string) => void;
  onNewChat: () => void;
  departmentId: string;
  deptName: string;
  deptIcon: string;
  deptPromptPreview: string;
}

/** Форматирует дату чата: сегодня → "Сегодня, 14:32", вчера → "Вчера", раньше → "15 янв" */
function formatChatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const chatDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (chatDay.getTime() === today.getTime()) {
    return `Сегодня, ${date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (chatDay.getTime() === yesterday.getTime()) {
    return "Вчера";
  }
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

/** Обрезает превью по последнему слову, не разрывая слова посередине */
function trimPreview(text: string, maxLen = 48): string {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + "…";
}

export function DepartmentSidebar({
  chats,
  activeChatId,
  onChatSelect,
  onNewChat,
  departmentId,
  deptName,
  deptIcon,
  deptPromptPreview,
}: Props) {
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">{deptIcon}</span>
          <span className="font-semibold text-[#1E293B] text-sm truncate">{deptName}</span>
        </div>
        {deptPromptPreview && (
          <p className="text-[11px] text-[#94A3B8] mb-3 leading-tight">{deptPromptPreview}</p>
        )}
        <button
          onClick={onNewChat}
          className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
        >
          + Новый чат
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {chats.length === 0 && (
          <p className="text-xs text-[#64748B] text-center py-6">История пуста</p>
        )}
        {chats.map((c) => (
          <button
            key={c.id}
            onClick={() => onChatSelect(c.id)}
            className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition-colors cursor-pointer ${
              c.id === activeChatId
                ? "bg-[#EFF6FF] text-[#2563EB]"
                : "hover:bg-[#F8F9FA] text-[#64748B]"
            }`}
          >
            <div className="text-xs font-medium text-[#1E293B] truncate">
              {trimPreview(c.preview || "Новый чат")}
            </div>
            <div className="text-[11px] text-[#94A3B8] mt-0.5">{formatChatDate(c.createdAt)}</div>
          </button>
        ))}
      </nav>

      <div className="p-3 border-t border-[#E2E8F0] flex flex-col gap-1">
        <Link
          to={`/department/${departmentId}/files`}
          className="text-sm text-[#64748B] hover:text-[#1E293B] px-3 py-2 rounded-lg hover:bg-[#F8F9FA] transition-colors flex items-center gap-2"
        >
          📎 Файлы отдела
        </Link>
      </div>
    </div>
  );
}
