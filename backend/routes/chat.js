import { Router } from "express";
import { randomUUID } from "crypto";
import db from "../database.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

const SEARCH_PROFILES = [
  {
    keywords: ["закупк", "поставщик", "снабжени", "procurement"],
    buildQuery: (q) => `${q} купить поставщик производитель интернет-магазин`,
    excludeDomains: ["wildberries.ru","ozon.ru","market.yandex.ru","aliexpress.ru","aliexpress.com","megamarket.ru","sbermegamarket.ru","avito.ru"],
    includeDomains: [],
  },
  {
    keywords: ["юридич", "право", "закон", "legal", "юрист"],
    buildQuery: (q) => `${q} закон РФ 2025 2026 сайт`,
    excludeDomains: [],
    includeDomains: ["consultant.ru","garant.ru","pravo.gov.ru","rg.ru","kremlin.ru","sozd.duma.gov.ru"],
  },
  {
    keywords: ["hr", "кадр", "персонал", "подбор", "сотрудник", "трудов"],
    buildQuery: (q) => `${q} кадры персонал ТК РФ`,
    excludeDomains: [],
    includeDomains: ["hh.ru","trudvsem.ru","rosmintrud.ru","rostrud.gov.ru","superjob.ru"],
  },
  {
    keywords: ["логистик", "доставк", "перевозк", "транспорт", "груз"],
    buildQuery: (q) => `${q} логистика перевозчик доставка`,
    excludeDomains: ["wildberries.ru","ozon.ru"],
    includeDomains: [],
  },
  {
    keywords: ["маркетинг", "реклам", "продвижени", "контент", "smm"],
    buildQuery: (q) => `${q} маркетинг реклама Россия`,
    excludeDomains: [],
    includeDomains: [],
  },
  {
    keywords: ["бухгалтер", "налог", "учёт", "учет", "отчётност", "фнс"],
    buildQuery: (q) => `${q} налоги бухгалтерия ФНС РФ`,
    excludeDomains: [],
    includeDomains: ["nalog.gov.ru","minfin.gov.ru","consultant.ru","garant.ru"],
  },
  {
    keywords: ["it", "техподдержк", "разработк", "программ", "сервер"],
    buildQuery: (q) => `${q} IT технологии решение`,
    excludeDomains: [],
    includeDomains: [],
  },
];

function getSearchProfile(dept) {
  const haystack = `${dept.name} ${dept.system_prompt}`.toLowerCase();
  return SEARCH_PROFILES.find((p) => p.keywords.some((kw) => haystack.includes(kw))) ?? null;
}

async function tavilySearch(query, profile) {
  if (!TAVILY_API_KEY || !profile) return null;
  try {
    const body = {
      api_key: TAVILY_API_KEY,
      query: profile.buildQuery(query),
      search_depth: "advanced",
      max_results: 6,
      include_answer: false,
    };
    if (profile.excludeDomains.length) body.exclude_domains = profile.excludeDomains;
    if (profile.includeDomains.length) body.include_domains = profile.includeDomains;

    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.results?.length) return null;
    return data.results
      .map((r) => `- [${r.title}](${r.url})\n  ${r.content?.slice(0, 200) ?? ""}`)
      .join("\n\n");
  } catch {
    return null;
  }
}

async function askOpenRouter(messages, temperature = 0.7) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:5173",
      "X-Title": "AI Office",
    },
    body: JSON.stringify({ model: "openrouter/auto", messages, temperature }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data?.choices?.[0]?.message?.content ?? "";
}

// GET /api/chat/:departmentId — list chats
router.get("/:departmentId", authMiddleware, (req, res) => {
  const dept = db.prepare("SELECT id FROM departments WHERE id = ? AND company_id = ?").get(req.params.departmentId, req.user.companyId);
  if (!dept) return res.status(404).json({ ok: false, error: "Отдел не найден" });

  const chats = db.prepare("SELECT * FROM chats WHERE department_id = ? ORDER BY created_at DESC").all(req.params.departmentId);
  const result = chats.map((c) => {
    const firstMsg = db.prepare("SELECT content FROM messages WHERE chat_id = ? AND role = 'user' ORDER BY created_at ASC LIMIT 1").get(c.id);
    const count = db.prepare("SELECT COUNT(*) as cnt FROM messages WHERE chat_id = ?").get(c.id);
    return {
      id: c.id,
      preview: firstMsg?.content?.slice(0, 80) ?? "Новый чат",
      createdAt: c.created_at,
      messageCount: count.cnt,
    };
  });

  res.json({ ok: true, chats: result });
});

// GET /api/chat/:departmentId/:chatId — messages
router.get("/:departmentId/:chatId", authMiddleware, (req, res) => {
  const chat = db.prepare("SELECT * FROM chats WHERE id = ? AND department_id = ?").get(req.params.chatId, req.params.departmentId);
  if (!chat) return res.status(404).json({ ok: false, error: "Чат не найден" });

  const msgs = db.prepare("SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC").all(req.params.chatId);
  const messages = msgs.map((m) => ({
    id: m.id,
    role: m.role,
    author: m.role === "user" ? "Вы" : "Ассистент",
    text: m.content,
  }));

  res.json({ ok: true, messages });
});

// POST /api/chat/:departmentId — send message
router.post("/:departmentId", authMiddleware, async (req, res) => {
  const { message, chatId } = req.body ?? {};
  if (!message?.trim()) return res.status(400).json({ ok: false, error: "Пустое сообщение" });

  const dept = db.prepare("SELECT * FROM departments WHERE id = ? AND company_id = ?").get(req.params.departmentId, req.user.companyId);
  if (!dept) return res.status(404).json({ ok: false, error: "Отдел не найден" });

  // Find or create chat
  let chat = chatId ? db.prepare("SELECT * FROM chats WHERE id = ?").get(chatId) : null;
  if (!chat) {
    const newChat = { id: randomUUID(), department_id: dept.id, user_id: req.user.id, created_at: new Date().toISOString() };
    db.prepare("INSERT INTO chats (id, department_id, user_id, created_at) VALUES (?, ?, ?, ?)").run(
      newChat.id, newChat.department_id, newChat.user_id, newChat.created_at
    );
    chat = newChat;
  }

  const userMsgId = randomUUID();
  db.prepare("INSERT INTO messages (id, chat_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)").run(
    userMsgId, chat.id, "user", message.trim(), new Date().toISOString()
  );

  // Web search via Tavily
  let searchContext = "";
  const searchProfile = getSearchProfile(dept);
  if (searchProfile) {
    const results = await tavilySearch(message, searchProfile);
    if (results) {
      searchContext = `\n\nРЕЗУЛЬТАТЫ ПОИСКА В ИНТЕРНЕТЕ (актуальные данные):\n${results}\n\nИспользуй ТОЛЬКО эти реальные ссылки и данные. Не выдумывай другие URL.`;
    }
  }

  // File context
  const deptFiles = db.prepare("SELECT name, content FROM files WHERE department_id = ? AND content IS NOT NULL AND content != ''").all(dept.id);
  const fileContext = deptFiles.length > 0
    ? `\n\nКонтекст из файлов отдела:\n${deptFiles.map((f) => `[${f.name}]:\n${f.content}`).join("\n\n")}`
    : "";

  const now = new Date();
  const currentDate = now.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

  // FIX 4: если промт пустой в БД — применяем дефолт только здесь, не в БД
  const effectivePrompt = dept.system_prompt?.trim()
    || "Ты универсальный бизнес-ассистент. Отвечай на вопросы чётко и профессионально.";

  const systemContent = `Сегодня: ${currentDate}. Ты работаешь в реальном времени — это актуальная дата, не спорь с ней.

${effectivePrompt}${fileContext}${searchContext}

СТРОГИЕ ПРАВИЛА ОТВЕТА:
1. Отвечай КРАТКО — максимум 150 слов. Никакой воды.
2. ЗАПРЕЩЕНО: "приступаю к поиску", "свяжусь с поставщиками", "следите за обновлениями".
3. ССЫЛКИ: используй ТОЛЬКО ссылки из результатов поиска выше. Не выдумывай URL.
4. ЦЕНЫ: называй только те цены, которые есть в результатах поиска.
5. Формат ответа: короткий вывод → нумерованный список ссылок с названием сайта и ценой (если есть) → совет по выбору.`;

  // Load last 10 messages as context
  const historyRows = db.prepare(
    "SELECT role, content FROM messages WHERE chat_id = ? ORDER BY created_at ASC"
  ).all(chat.id);
  // exclude the just-inserted user message (last one)
  const historyForContext = historyRows.slice(-11, -1).map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.content,
  }));

  const apiMessages = [
    { role: "system", content: systemContent },
    ...historyForContext,
    { role: "user", content: message.trim() },
  ];

  try {
    const reply = await askOpenRouter(apiMessages);
    const aiMsgId = randomUUID();
    db.prepare("INSERT INTO messages (id, chat_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)").run(
      aiMsgId, chat.id, "assistant", reply, new Date().toISOString()
    );
    return res.json({ ok: true, reply, chatId: chat.id, messageId: aiMsgId });
  } catch (err) {
    // Remove the user message on failure
    db.prepare("DELETE FROM messages WHERE id = ?").run(userMsgId);
    return res.status(500).json({ ok: false, error: "Ошибка AI: " + err.message });
  }
});

export default router;
