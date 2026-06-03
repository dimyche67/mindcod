import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import db from "../database.js";
import { PLANS, DEFAULT_PLAN } from "../plans.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "aioffice-dev-secret";

function makeToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function safeUser(user, company) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isSuperadmin: !!user.is_superadmin,
    companyId: user.company_id ?? null,
    companyName: company?.name ?? "",
    plan: company?.plan ?? DEFAULT_PLAN,
    companyStatus: company?.status ?? "active",
  };
}

function createStarterDepartments(companyId) {
  const now = new Date().toISOString();
  const insertDept = db.prepare(`
    INSERT INTO departments (id, company_id, name, description, icon, system_prompt, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertDept.run(
    randomUUID(), companyId, "Общий", "Универсальный бизнес-ассистент", "💬",
    "Ты универсальный бизнес-ассистент с обширными знаниями. ВАЖНО: ты отвечаешь СРАЗУ на основе своих знаний — никогда не говори 'подожди', 'я уточню', 'свяжусь с поставщиками', 'дам ответ через N дней'. Давай конкретные данные, примеры, цифры прямо сейчас. Если нужны данные которых у тебя нет — дай методологию, шаблон или типичные рыночные значения. Отвечай структурированно на русском языке.",
    now
  );
  insertDept.run(
    randomUUID(), companyId, "Юридический", "Анализ законов и договоров", "⚖️",
    "Ты опытный юрист по российскому праву с глубокими знаниями НК РФ, ГК РФ, ТК РФ. ВАЖНО: отвечай НЕМЕДЛЕННО на основе своих знаний — никогда не говори 'уточню', 'проконсультируюсь', 'дам ответ позже'. Давай конкретные ссылки на статьи, трактовку норм, готовые формулировки прямо сейчас. Отвечай структурированно на русском языке.",
    now
  );
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { companyName, email, password } = req.body ?? {};

  if (!companyName?.trim() || !email?.trim() || !password?.trim()) {
    return res.status(400).json({ ok: false, error: "Заполните все поля" });
  }
  if (password.length < 6) {
    return res.status(400).json({ ok: false, error: "Пароль минимум 6 символов" });
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ ok: false, error: "Email уже зарегистрирован" });
  }

  const companyId = randomUUID();
  const userId = randomUUID();
  const now = new Date().toISOString();

  // New companies start as 'pending' — superadmin must approve
  const company = { id: companyId, name: companyName.trim(), plan: DEFAULT_PLAN, status: "pending", created_at: now };
  db.prepare("INSERT INTO companies (id, name, plan, status, created_at) VALUES (?, ?, ?, ?, ?)").run(
    company.id, company.name, company.plan, company.status, company.created_at
  );

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: userId,
    company_id: companyId,
    email: email.toLowerCase().trim(),
    password_hash: passwordHash,
    name: email.split("@")[0],
    role: "admin",
    created_at: now,
  };
  db.prepare("INSERT INTO users (id, company_id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    user.id, user.company_id, user.email, user.password_hash, user.name, user.role, user.created_at
  );

  createStarterDepartments(companyId);

  // Don't issue a token — account needs approval
  return res.status(201).json({ ok: true, pendingApproval: true });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email?.trim() || !password?.trim()) {
    return res.status(400).json({ ok: false, error: "Заполните все поля" });
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase().trim());
  if (!user) {
    return res.status(401).json({ ok: false, error: "Неверный email или пароль" });
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ ok: false, error: "Неверный email или пароль" });
  }

  // Superadmin bypasses company status check
  if (user.is_superadmin) {
    const safe = safeUser(user, null);
    const token = makeToken(safe);
    return res.json({ ok: true, token, user: safe });
  }

  const company = db.prepare("SELECT * FROM companies WHERE id = ?").get(user.company_id);

  if (!company || company.status === "pending") {
    return res.status(403).json({ ok: false, error: "PENDING", message: "Ваша заявка на рассмотрении. Мы проверим данные и откроем доступ в течение 24 часов." });
  }
  if (company.status === "blocked") {
    return res.status(403).json({ ok: false, error: "BLOCKED", message: "Аккаунт заблокирован. Свяжитесь с поддержкой." });
  }

  const safe = safeUser(user, company);
  const token = makeToken(safe);
  return res.json({ ok: true, token, user: safe });
});

// GET /api/auth/me
router.get("/me", authMiddleware, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ ok: false, error: "Пользователь не найден" });
  const company = user.company_id ? db.prepare("SELECT * FROM companies WHERE id = ?").get(user.company_id) : null;
  return res.json({ ok: true, user: safeUser(user, company) });
});

export default router;
