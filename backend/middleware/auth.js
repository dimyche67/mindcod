import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "aioffice-dev-secret";

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ ok: false, error: "Требуется авторизация" });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { ...payload, isSuperadmin: !!payload.isSuperadmin };
    next();
  } catch {
    return res.status(401).json({ ok: false, error: "Недействительный токен" });
  }
}

export function adminMiddleware(req, res, next) {
  if (req.user?.role !== "admin" && !req.user?.isSuperadmin) {
    return res.status(403).json({ ok: false, error: "Доступ только для администратора" });
  }
  next();
}

export function superadminMiddleware(req, res, next) {
  if (!req.user?.isSuperadmin) {
    return res.status(403).json({ ok: false, error: "Доступ только для суперадмина" });
  }
  next();
}
