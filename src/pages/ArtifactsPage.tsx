import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import type { Artifact } from "../types";
import { apiGetArtifacts, apiDeleteArtifact } from "../api";

export function ArtifactsPage() {
  const { id: departmentId } = useParams<{ id: string }>();
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<Artifact | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!departmentId) return;
    apiGetArtifacts(departmentId)
      .then((r) => setArtifacts(r.artifacts))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [departmentId]);

  const handleDelete = async (id: string) => {
    await apiDeleteArtifact(id).catch(() => {});
    setArtifacts((p) => p.filter((a) => a.id !== id));
    setDeleteId(null);
  };

  const handleDownload = (art: Artifact) => {
    const blob = new Blob([art.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${art.title}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Link to={`/department/${departmentId}`} className="text-sm text-[#64748B] hover:text-[#1E293B]">← Назад к чату</Link>
          <h1 className="text-2xl font-bold text-[#1E293B]">Артефакты отдела</h1>
        </div>

        {loading ? <p className="text-[#64748B]">Загрузка...</p> : artifacts.length === 0 ? (
          <div className="text-center py-20 text-[#64748B]">
            <p className="text-4xl mb-3">📋</p>
            <p>Нет сохранённых артефактов</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {artifacts.map((art) => (
              <div key={art.id} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-4 flex flex-col gap-3">
                <div>
                  <div className="font-medium text-[#1E293B] mb-1">{art.title}</div>
                  <div className="text-xs text-[#64748B]">{new Date(art.createdAt).toLocaleString("ru-RU")}</div>
                  <p className="text-sm text-[#64748B] mt-2 line-clamp-3">{art.content.slice(0, 120)}...</p>
                </div>
                <div className="flex gap-2 mt-auto">
                  <button onClick={() => setViewing(art)}
                    className="flex-1 border border-[#E2E8F0] text-[#1E293B] hover:bg-[#F8F9FA] px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer">
                    Просмотр
                  </button>
                  <button onClick={() => handleDownload(art)}
                    className="border border-[#E2E8F0] text-[#1E293B] hover:bg-[#F8F9FA] px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer">
                    ⬇️
                  </button>
                  <button onClick={() => setDeleteId(art.id)}
                    className="border border-red-200 text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer">
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* View modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setViewing(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[#1E293B]">{viewing.title}</h3>
              <button onClick={() => setViewing(null)} className="text-[#64748B] hover:text-[#1E293B] cursor-pointer">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto messages-scroll">
              <div className="prose prose-sm max-w-none"><ReactMarkdown>{viewing.content}</ReactMarkdown></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => navigator.clipboard.writeText(viewing.content)}
                className="border border-[#E2E8F0] text-[#1E293B] hover:bg-[#F8F9FA] px-4 py-2 rounded-lg text-sm cursor-pointer">
                📋 Копировать
              </button>
              <button onClick={() => handleDownload(viewing)}
                className="border border-[#E2E8F0] text-[#1E293B] hover:bg-[#F8F9FA] px-4 py-2 rounded-lg text-sm cursor-pointer">
                ⬇️ Скачать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeleteId(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-[#1E293B] mb-2">Удалить артефакт?</h3>
            <p className="text-sm text-[#64748B] mb-5">Это действие нельзя отменить.</p>
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
