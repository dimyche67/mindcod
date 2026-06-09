import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { AppLayout } from "../components/AppLayout";
import { useAuth } from "../hooks/useAuth";
import {
  apiMsgGetRooms, apiMsgGetMessages, apiMsgSendMessage,
  apiMsgUploadFile, apiMsgGetUsers, apiMsgOpenDirect,
  apiMsgCreateRoom, apiMsgDeleteMessage,
  type MsgRoom, type MsgMessage, type MsgUser,
} from "../api";

const BASE = import.meta.env.VITE_API_URL ?? "";

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("ru", { day: "numeric", month: "short" });
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

function roomDisplayName(room: MsgRoom, _myId: string) {
  if (room.type === "direct") return room.otherUser?.name ?? "Неизвестный";
  return room.name ?? "Без названия";
}

function roomIcon(room: MsgRoom) {
  if (room.type === "direct") return "👤";
  if (room.type === "channel") return "📢";
  return "👥";
}

// ── New Room Modal ────────────────────────────────────────────────────────────

function NewRoomModal({
  users,
  onClose,
  onCreated,
}: {
  users: MsgUser[];
  onClose: () => void;
  onCreated: (roomId: string) => void;
}) {
  const [tab, setTab] = useState<"direct" | "group" | "channel">("direct");
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreate() {
    setLoading(true);
    try {
      if (tab === "direct") {
        if (!selectedUser) return;
        const { roomId } = await apiMsgOpenDirect(selectedUser);
        onCreated(roomId);
      } else {
        if (!groupName.trim()) return;
        const { room } = await apiMsgCreateRoom({ type: tab, name: groupName, description, memberIds: selectedMembers });
        onCreated(room.id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-semibold text-[#1E293B]">Новый чат</h2>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#1E293B] transition-colors cursor-pointer">✕</button>
        </div>

        <div className="flex border-b border-[#E2E8F0]">
          {(["direct", "group", "channel"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors cursor-pointer ${tab === t ? "text-[#2563EB] border-b-2 border-[#2563EB]" : "text-[#64748B] hover:text-[#1E293B]"}`}
            >
              {t === "direct" ? "Личное" : t === "group" ? "Группа" : "Канал"}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-3">
          {tab !== "direct" && (
            <>
              <input
                className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                placeholder="Название"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
              />
              <input
                className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                placeholder="Описание (необязательно)"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </>
          )}

          <input
            className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
            placeholder="Поиск сотрудников..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          <div className="max-h-48 overflow-y-auto space-y-1">
            {filtered.map(u => {
              const selected = tab === "direct" ? selectedUser === u.id : selectedMembers.includes(u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => {
                    if (tab === "direct") {
                      setSelectedUser(u.id);
                    } else {
                      setSelectedMembers(prev =>
                        prev.includes(u.id) ? prev.filter(x => x !== u.id) : [...prev, u.id]
                      );
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${selected ? "bg-[#EFF6FF] text-[#2563EB]" : "hover:bg-[#F8F9FA] text-[#1E293B]"}`}
                >
                  <div className="w-8 h-8 rounded-full bg-[#EFF6FF] flex items-center justify-center text-sm font-semibold text-[#2563EB] shrink-0">
                    {u.name[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{u.name}</p>
                    <p className="text-xs text-[#94A3B8] truncate">{u.email}</p>
                  </div>
                  {selected && <span className="ml-auto text-[#2563EB]">✓</span>}
                </button>
              );
            })}
            {filtered.length === 0 && <p className="text-sm text-[#94A3B8] text-center py-4">Никого не найдено</p>}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[#E2E8F0] flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#64748B] hover:text-[#1E293B] cursor-pointer transition-colors">Отмена</button>
          <button
            onClick={handleCreate}
            disabled={loading || (tab === "direct" ? !selectedUser : !groupName.trim())}
            className="px-4 py-2 text-sm bg-[#2563EB] text-white rounded-lg hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            {loading ? "Создаю..." : "Создать"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function MessengerPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeRoomId = searchParams.get("room");

  const [rooms, setRooms] = useState<MsgRoom[]>([]);
  const [messages, setMessages] = useState<MsgMessage[]>([]);
  const [users, setUsers] = useState<MsgUser[]>([]);
  const [text, setText] = useState("");
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, { name: string; ts: number }>>({});
  const [roomSearch, setRoomSearch] = useState("");
  const [showMobileList, setShowMobileList] = useState(true);

  const socketRef = useRef<Socket | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeRoom = rooms.find(r => r.id === activeRoomId);

  // ── Socket ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const token = localStorage.getItem("aioffice_token");
    if (!token) return;

    const socket = io(BASE || window.location.origin, {
      path: "/socket.io",
      auth: { token },
    });
    socketRef.current = socket;

    socket.on("new_message", ({ roomId, message }: { roomId: string; message: MsgMessage }) => {
      setMessages(prev => {
        if (roomId === activeRoomId && !prev.find(m => m.id === message.id)) {
          return [...prev, message];
        }
        return prev;
      });
      setRooms(prev => prev.map(r => {
        if (r.id !== roomId) return r;
        return {
          ...r,
          last_message: message.content,
          last_message_at: message.created_at,
          last_message_user_id: message.user_id,
          unread_count: roomId === activeRoomId ? 0 : (r.unread_count || 0) + 1,
        };
      }));
    });

    socket.on("user_typing", ({ roomId, userId: uid, userName, isTyping }: { roomId: string; userId: string; userName: string; isTyping: boolean }) => {
      if (roomId !== activeRoomId || uid === user?.id) return;
      setTypingUsers(prev => {
        if (!isTyping) {
          const next = { ...prev };
          delete next[uid];
          return next;
        }
        return { ...prev, [uid]: { name: userName, ts: Date.now() } };
      });
    });

    return () => { socket.disconnect(); };
  }, []);

  // Обновляем activeRoomId в сокете
  useEffect(() => {
    if (activeRoomId && socketRef.current) {
      socketRef.current.emit("join_room", activeRoomId);
      socketRef.current.emit("mark_read", { roomId: activeRoomId });
      setRooms(prev => prev.map(r => r.id === activeRoomId ? { ...r, unread_count: 0 } : r));
    }
  }, [activeRoomId]);

  // ── Load rooms ────────────────────────────────────────────────────────────

  useEffect(() => {
    apiMsgGetRooms().then(({ rooms }) => setRooms(rooms)).catch(console.error);
    apiMsgGetUsers().then(({ users }) => setUsers(users)).catch(console.error);
  }, []);

  // ── Load messages ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!activeRoomId) return;
    setLoadingMsgs(true);
    setMessages([]);
    apiMsgGetMessages(activeRoomId)
      .then(({ messages }) => setMessages(messages))
      .catch(console.error)
      .finally(() => setLoadingMsgs(false));
  }, [activeRoomId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send ──────────────────────────────────────────────────────────────────

  function handleSend() {
    const content = text.trim();
    if (!content || !activeRoomId) return;
    setText("");
    if (socketRef.current?.connected) {
      socketRef.current.emit("send_message", { roomId: activeRoomId, content });
    } else {
      apiMsgSendMessage(activeRoomId, content)
        .then(({ message }) => setMessages(prev => [...prev, message]))
        .catch(console.error);
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    socketRef.current?.emit("typing", { roomId: activeRoomId, isTyping: false });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleTyping(val: string) {
    setText(val);
    if (!activeRoomId) return;
    socketRef.current?.emit("typing", { roomId: activeRoomId, isTyping: true });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socketRef.current?.emit("typing", { roomId: activeRoomId, isTyping: false });
    }, 2000);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeRoomId) return;
    e.target.value = "";
    try {
      const { message } = await apiMsgUploadFile(activeRoomId, file);
      setMessages(prev => [...prev, message]);
      socketRef.current?.emit("join_room", activeRoomId); // refresh
    } catch (err) {
      console.error(err);
    }
  }

  function openRoom(roomId: string) {
    setSearchParams({ room: roomId });
    setShowMobileList(false);
  }

  function handleNewRoomCreated(roomId: string) {
    setShowNewRoom(false);
    apiMsgGetRooms().then(({ rooms }) => setRooms(rooms)).catch(console.error);
    openRoom(roomId);
  }

  async function handleDelete(msgId: string) {
    await apiMsgDeleteMessage(msgId);
    setMessages(prev => prev.filter(m => m.id !== msgId));
  }

  const typingNames = Object.values(typingUsers).map(v => v.name);
  const filteredRooms = rooms.filter(r => {
    const name = roomDisplayName(r, user?.id ?? "");
    return name.toLowerCase().includes(roomSearch.toLowerCase());
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="flex h-full bg-[#F8F9FA]">

        {/* Sidebar — список чатов */}
        <aside className={`${showMobileList ? "flex" : "hidden"} md:flex flex-col w-full md:w-72 lg:w-80 bg-white border-r border-[#E2E8F0] flex-shrink-0`}>
          <div className="px-4 pt-4 pb-3 border-b border-[#E2E8F0]">
            <div className="flex items-center justify-between mb-3">
              <h1 className="font-semibold text-[#1E293B] text-base">Чат</h1>
              <button
                onClick={() => setShowNewRoom(true)}
                className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE] flex items-center justify-center text-lg cursor-pointer transition-colors"
                title="Новый чат"
              >
                +
              </button>
            </div>
            <input
              className="w-full border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
              placeholder="Поиск чатов..."
              value={roomSearch}
              onChange={e => setRoomSearch(e.target.value)}
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredRooms.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-[#94A3B8] text-sm">
                <p>Нет чатов</p>
                <button onClick={() => setShowNewRoom(true)} className="mt-2 text-[#2563EB] hover:underline cursor-pointer">
                  Создать первый
                </button>
              </div>
            )}
            {filteredRooms.map(room => {
              const isActive = room.id === activeRoomId;
              const name = roomDisplayName(room, user?.id ?? "");
              return (
                <button
                  key={room.id}
                  onClick={() => openRoom(room.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer border-b border-[#F1F5F9] last:border-b-0 ${isActive ? "bg-[#EFF6FF]" : "hover:bg-[#F8F9FA]"}`}
                >
                  <div className="w-10 h-10 rounded-full bg-[#F1F5F9] flex items-center justify-center text-lg shrink-0">
                    {roomIcon(room)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-medium truncate ${isActive ? "text-[#2563EB]" : "text-[#1E293B]"}`}>{name}</p>
                      <span className="text-[11px] text-[#94A3B8] shrink-0 ml-1">
                        {room.last_message_at ? formatTime(room.last_message_at) : ""}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-[#64748B] truncate pr-2">
                        {room.last_message
                          ? (room.last_message.length > 40 ? room.last_message.slice(0, 40) + "…" : room.last_message)
                          : <span className="italic text-[#94A3B8]">Нет сообщений</span>}
                      </p>
                      {room.unread_count > 0 && (
                        <span className="shrink-0 bg-[#2563EB] text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                          {room.unread_count > 99 ? "99+" : room.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Основная область */}
        <div className={`${!showMobileList ? "flex" : "hidden"} md:flex flex-col flex-1 min-w-0`}>
          {!activeRoom ? (
            <div className="flex-1 flex flex-col items-center justify-center text-[#94A3B8]">
              <div className="text-5xl mb-4">💬</div>
              <p className="text-lg font-medium text-[#1E293B]">Выберите чат</p>
              <p className="text-sm mt-1">или создайте новый</p>
              <button
                onClick={() => setShowNewRoom(true)}
                className="mt-4 px-4 py-2 bg-[#2563EB] text-white text-sm rounded-lg hover:bg-[#1D4ED8] cursor-pointer transition-colors"
              >
                Новый чат
              </button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-[#E2E8F0] flex-shrink-0">
                <button
                  onClick={() => setShowMobileList(true)}
                  className="md:hidden text-[#64748B] cursor-pointer mr-1"
                >
                  ←
                </button>
                <div className="w-9 h-9 rounded-full bg-[#F1F5F9] flex items-center justify-center text-lg">
                  {roomIcon(activeRoom)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#1E293B] text-sm">{roomDisplayName(activeRoom, user?.id ?? "")}</p>
                  {activeRoom.type !== "direct" && (
                    <p className="text-xs text-[#94A3B8]">
                      {activeRoom.members?.length ?? 0} участников
                    </p>
                  )}
                </div>
                {activeRoom.type === "channel" && (
                  <span className="text-xs bg-[#F1F5F9] text-[#64748B] px-2 py-0.5 rounded-full">Канал</span>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
                {loadingMsgs && (
                  <div className="flex justify-center py-8">
                    <div className="w-5 h-5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {!loadingMsgs && messages.length === 0 && (
                  <div className="flex justify-center py-12 text-[#94A3B8] text-sm">Нет сообщений. Напишите первым!</div>
                )}
                {messages.map((msg, idx) => {
                  const isMe = msg.user_id === user?.id;
                  const prevMsg = messages[idx - 1];
                  const showName = !isMe && (!prevMsg || prevMsg.user_id !== msg.user_id);

                  return (
                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} group`}>
                      <div className={`max-w-[70%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                        {showName && (
                          <span className="text-xs text-[#94A3B8] mb-1 px-1">{msg.user_name}</span>
                        )}
                        <div className={`relative rounded-2xl px-3 py-2 text-sm ${
                          isMe
                            ? "bg-[#2563EB] text-white rounded-br-sm"
                            : "bg-white text-[#1E293B] rounded-bl-sm shadow-sm border border-[#E2E8F0]"
                        }`}>
                          {msg.type === "image" ? (
                            <a href={`${BASE}/api/messenger/messages/${msg.id}/file`} target="_blank" rel="noreferrer">
                              <img
                                src={`${BASE}/api/messenger/messages/${msg.id}/file`}
                                alt={msg.file_name ?? ""}
                                className="max-w-[240px] max-h-[240px] rounded-lg object-cover"
                              />
                            </a>
                          ) : msg.type === "file" ? (
                            <a
                              href={`${BASE}/api/messenger/messages/${msg.id}/file`}
                              target="_blank"
                              rel="noreferrer"
                              className={`flex items-center gap-2 ${isMe ? "text-white" : "text-[#2563EB]"}`}
                            >
                              <span className="text-xl">📎</span>
                              <div>
                                <p className="font-medium text-xs">{msg.file_name}</p>
                                {msg.file_size && <p className="text-[11px] opacity-70">{formatSize(msg.file_size)}</p>}
                              </div>
                            </a>
                          ) : (
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          )}
                          <div className={`flex items-center gap-1 mt-0.5 ${isMe ? "justify-end" : "justify-start"}`}>
                            <span className={`text-[10px] ${isMe ? "text-blue-100" : "text-[#94A3B8]"}`}>
                              {formatTime(msg.created_at)}
                            </span>
                          </div>

                          {/* Delete button */}
                          {isMe && (
                            <button
                              onClick={() => handleDelete(msg.id)}
                              className="absolute -top-2 -right-2 hidden group-hover:flex w-5 h-5 bg-red-500 text-white rounded-full text-[10px] items-center justify-center cursor-pointer hover:bg-red-600"
                              title="Удалить"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {typingNames.length > 0 && (
                  <div className="flex justify-start">
                    <div className="bg-white rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm border border-[#E2E8F0] text-xs text-[#94A3B8] italic">
                      {typingNames.join(", ")} {typingNames.length === 1 ? "печатает" : "печатают"}…
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              {(activeRoom.type !== "channel" || activeRoom.members?.find(m => m.id === user?.id)?.role === "admin") && (
                <div className="bg-white border-t border-[#E2E8F0] px-4 py-3 flex-shrink-0">
                  <div className="flex items-end gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-9 h-9 rounded-lg bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0] flex items-center justify-center shrink-0 cursor-pointer transition-colors text-lg"
                      title="Прикрепить файл"
                    >
                      📎
                    </button>
                    <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
                    <textarea
                      className="flex-1 border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 resize-none min-h-[40px] max-h-32"
                      placeholder="Напишите сообщение..."
                      rows={1}
                      value={text}
                      onChange={e => handleTyping(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!text.trim()}
                      className="w-9 h-9 rounded-lg bg-[#2563EB] text-white hover:bg-[#1D4ED8] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                      title="Отправить (Enter)"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
              {activeRoom.type === "channel" && !activeRoom.members?.find(m => m.id === user?.id && m.role === "admin") && (
                <div className="bg-[#F8F9FA] border-t border-[#E2E8F0] px-4 py-3 text-center text-sm text-[#94A3B8]">
                  Только администраторы могут писать в этот канал
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showNewRoom && (
        <NewRoomModal
          users={users}
          onClose={() => setShowNewRoom(false)}
          onCreated={handleNewRoomCreated}
        />
      )}
    </AppLayout>
  );
}
