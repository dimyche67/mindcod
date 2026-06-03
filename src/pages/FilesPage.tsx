import { useState, useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import type { DeptFile } from "../types";
import { apiGetFiles, apiUploadFile, apiDeleteFile } from "../api";
import { useAuth } from "../hooks/useAuth";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

export function FilesPage() {
  const { id: departmentId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [files, setFiles] = useState<DeptFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!departmentId) return;
    apiGetFiles(departmentId)
      .then((r) => setFiles(r.files))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [departmentId]);

  const handleUpload = async (file: File) => {
    if (!departmentId) return;
    setError("");
    setUploading(true);
    try {
      const res = await apiUploadFile(departmentId, file);
      if (res.file) setFiles((p) => [res.file!, ...p]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    await apiDeleteFile(id).catch(() => {});
    setFiles((p) => p.filter((f) => f.id !== id));
    setDeleteId(null);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link to={`/department/${departmentId}`} className="text-sm text-[#64748B] hover:text-[#1E293B]">← Назад к чату</Link>
            <h1 className="text-2xl font-bold text-[#1E293B]">Файлы отдела</h1>
          </div>
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer">
            {uploading ? "Загрузка..." : "Загрузить файл"}
            <input ref={fileRef} type="file" accept=".txt,.pdf" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUpload(f); e.target.value = ""; }} />
          </button>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4">{error}</p>}
        <p className="text-xs text-[#64748B] mb-4">Поддерживаются форматы: TXT, PDF. Файлы используются AI как контекст при ответах.</p>

        {loading ? <p className="text-[#64748B]">Загрузка...</p> : files.length === 0 ? (
          <div className="text-center py-20 text-[#64748B]">
            <p className="text-4xl mb-3">📎</p>
            <p>Нет загруженных файлов</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#F8F9FA] border-b border-[#E2E8F0]">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B]">Файл</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B]">Размер</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B]">Дата загрузки</th>
                  {user?.role === "admin" && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8F9FA]/50">
                    <td className="px-4 py-3 font-medium text-[#1E293B]">📄 {f.name}</td>
                    <td className="px-4 py-3 text-[#64748B]">{formatSize(f.size)}</td>
                    <td className="px-4 py-3 text-[#64748B]">{new Date(f.uploadedAt).toLocaleString("ru-RU")}</td>
                    {user?.role === "admin" && (
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setDeleteId(f.id)}
                          className="text-red-400 hover:text-red-600 transition-colors cursor-pointer">🗑️</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeleteId(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-[#1E293B] mb-2">Удалить файл?</h3>
            <p className="text-sm text-[#64748B] mb-5">Файл будет удалён из базы знаний отдела.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="border border-[#E2E8F0] text-[#64748B] px-4 py-2 rounded-lg text-sm cursor-pointer">Отмена</button>
              <button onClick={() => handleDelete(deleteId)} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer">Удалить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
