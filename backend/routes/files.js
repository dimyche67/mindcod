import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import db from "../database.js";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const extOk = /\.(txt|pdf)$/.test(file.originalname.toLowerCase());
    if (extOk) cb(null, true);
    else cb(new Error("Только TXT и PDF файлы"));
  },
});

const router = Router();

// GET /api/files/:departmentId
router.get("/:departmentId", authMiddleware, (req, res) => {
  const rows = db.prepare(
    "SELECT id, department_id, company_id, name, size, uploaded_by, created_at FROM files WHERE department_id = ? ORDER BY created_at DESC"
  ).all(req.params.departmentId);
  const files = rows.map((r) => ({
    id: r.id,
    departmentId: r.department_id,
    name: r.name,
    size: r.size,
    uploadedAt: r.created_at,
  }));
  res.json({ ok: true, files });
});

// POST /api/files/:departmentId
router.post("/:departmentId", authMiddleware, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: "Файл не загружен" });

  const dept = db.prepare("SELECT id FROM departments WHERE id = ? AND company_id = ?").get(req.params.departmentId, req.user.companyId);
  if (!dept) return res.status(404).json({ ok: false, error: "Отдел не найден" });

  let content = "";
  try {
    if (req.file.originalname.toLowerCase().endsWith(".txt")) {
      content = fs.readFileSync(req.file.path, "utf-8").slice(0, 20000);
    } else if (req.file.originalname.toLowerCase().endsWith(".pdf")) {
      const pdfParse = (await import("pdf-parse")).default;
      const buffer = fs.readFileSync(req.file.path);
      const data = await pdfParse(buffer);
      content = data.text?.trim() ? data.text.slice(0, 20000) : "[PDF файл: текст не удалось извлечь]";
    }
  } catch {
    content = req.file.originalname.toLowerCase().endsWith(".pdf") ? "[PDF файл: текст не удалось извлечь]" : "";
  }

  // Remove temp file after reading
  try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }

  const fileId = randomUUID();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO files (id, department_id, company_id, name, size, content, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
    fileId, req.params.departmentId, req.user.companyId, req.file.originalname, req.file.size, content, req.user.id, now
  );

  res.status(201).json({ ok: true, file: { id: fileId, departmentId: req.params.departmentId, name: req.file.originalname, size: req.file.size, uploadedAt: now } });
});

// DELETE /api/files/:id
router.delete("/:id", authMiddleware, adminMiddleware, (req, res) => {
  const row = db.prepare("SELECT id FROM files WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ ok: false, error: "Файл не найден" });
  db.prepare("DELETE FROM files WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

export default router;
