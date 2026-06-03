import { useEffect, useState } from "react";
import {
  Bot, Plus, Edit2, Trash2, Save, X, Search, MessageSquare,
  ToggleLeft, ToggleRight, AlertCircle, ChevronUp, ChevronDown,
} from "lucide-react";
import { API } from "@/lib/api-url";

const TOKEN_KEY = "sphere_token";

async function apiFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts?.headers || {}) },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  return res.json();
}

interface Faq {
  id: number;
  category?: string;
  question: string;
  answer: string;
  keywords?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

interface Conversation {
  id: number;
  sessionId: string;
  messages: Array<{ role: string; content: string }>;
  leadEmail?: string;
  leadName?: string;
  leadCompany?: string;
  messageCount: number;
  startedAt: string;
  lastMessageAt: string;
}

type Tab = "faqs" | "conversations";

export default function ChatbotFaqs() {
  const [tab, setTab] = useState<Tab>("faqs");
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Faq | null>(null);
  const [creating, setCreating] = useState(false);
  const [expandedConv, setExpandedConv] = useState<number | null>(null);

  async function loadFaqs() {
    try {
      setLoading(true);
      const data = await apiFetch("/admin/chatbot/faqs");
      setFaqs(data);
    } catch (e: any) {
      alert("FAQ'ler alınamadı: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadConversations() {
    try {
      setLoading(true);
      const data = await apiFetch("/admin/chatbot/conversations");
      setConversations(data.items);
    } catch (e: any) {
      alert("Konuşmalar alınamadı: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "faqs") loadFaqs();
    else loadConversations();
  }, [tab]);

  async function saveFaq(faq: Partial<Faq>) {
    try {
      if (faq.id) {
        await apiFetch(`/admin/chatbot/faqs/${faq.id}`, {
          method: "PATCH",
          body: JSON.stringify(faq),
        });
      } else {
        await apiFetch("/admin/chatbot/faqs", {
          method: "POST",
          body: JSON.stringify(faq),
        });
      }
      setEditing(null);
      setCreating(false);
      await loadFaqs();
    } catch (e: any) {
      alert("Kaydedilemedi: " + e.message);
    }
  }

  async function deleteFaq(id: number) {
    if (!confirm("Bu FAQ'i silmek istediğinden emin misin?")) return;
    try {
      await apiFetch(`/admin/chatbot/faqs/${id}`, { method: "DELETE" });
      await loadFaqs();
    } catch (e: any) {
      alert("Silinemedi: " + e.message);
    }
  }

  async function toggleActive(faq: Faq) {
    try {
      await apiFetch(`/admin/chatbot/faqs/${faq.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !faq.isActive }),
      });
      await loadFaqs();
    } catch (e: any) {
      alert(e.message);
    }
  }

  const filteredFaqs = faqs.filter((f) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      f.question.toLowerCase().includes(q) ||
      f.answer.toLowerCase().includes(q) ||
      f.category?.toLowerCase().includes(q) ||
      f.keywords?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Bot className="w-6 h-6 text-blue-600" />
            Chatbot Yönetimi
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Marketing sitesindeki Sphere Asistan'ın bilgi tabanı ve konuşma geçmişi
          </p>
        </div>
      </div>

      {/* Tab'lar */}
      <div className="flex gap-1 mb-4 border-b border-slate-200">
        <button
          onClick={() => setTab("faqs")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === "faqs" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          FAQ'ler ({faqs.length})
        </button>
        <button
          onClick={() => setTab("conversations")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === "conversations" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Konuşmalar
        </button>
      </div>

      {/* FAQ Tab */}
      {tab === "faqs" && (
        <>
          <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4 flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="FAQ ara..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => setCreating(true)}
              className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Yeni FAQ
            </button>
          </div>

          {creating && (
            <FaqEditor
              faq={null}
              onSave={(f) => saveFaq(f)}
              onCancel={() => setCreating(false)}
            />
          )}

          <div className="space-y-3">
            {loading && <div className="text-center py-8 text-slate-400">Yükleniyor...</div>}
            {!loading && filteredFaqs.length === 0 && (
              <div className="text-center py-12 bg-white border border-slate-200 rounded-lg">
                <MessageSquare className="w-12 h-12 mx-auto text-slate-200 mb-3" />
                <div className="text-slate-500">Henüz FAQ yok. "Yeni FAQ" ile başlayın.</div>
              </div>
            )}
            {!loading && filteredFaqs.map((faq) =>
              editing?.id === faq.id ? (
                <FaqEditor
                  key={faq.id}
                  faq={editing}
                  onSave={(f) => saveFaq({ ...f, id: faq.id })}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div key={faq.id} className={`bg-white border rounded-lg p-4 ${faq.isActive ? "border-slate-200" : "border-slate-200 opacity-60"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {faq.category && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                            {faq.category}
                          </span>
                        )}
                        {!faq.isActive && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">
                            Pasif
                          </span>
                        )}
                      </div>
                      <div className="font-medium text-slate-900">{faq.question}</div>
                      <div className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{faq.answer}</div>
                      {faq.keywords && (
                        <div className="text-xs text-slate-400 mt-2">
                          Anahtar kelimeler: {faq.keywords}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => toggleActive(faq)}
                        className="p-2 rounded hover:bg-slate-100"
                        title={faq.isActive ? "Pasif yap" : "Aktif yap"}
                      >
                        {faq.isActive ? (
                          <ToggleRight className="w-5 h-5 text-green-600" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-slate-400" />
                        )}
                      </button>
                      <button
                        onClick={() => setEditing(faq)}
                        className="p-2 rounded hover:bg-slate-100"
                      >
                        <Edit2 className="w-4 h-4 text-slate-600" />
                      </button>
                      <button
                        onClick={() => deleteFaq(faq.id)}
                        className="p-2 rounded hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </>
      )}

      {/* Conversations Tab */}
      {tab === "conversations" && (
        <div className="space-y-3">
          {loading && <div className="text-center py-8 text-slate-400">Yükleniyor...</div>}
          {!loading && conversations.length === 0 && (
            <div className="text-center py-12 bg-white border border-slate-200 rounded-lg">
              <MessageSquare className="w-12 h-12 mx-auto text-slate-200 mb-3" />
              <div className="text-slate-500">Henüz konuşma yok.</div>
            </div>
          )}
          {!loading && conversations.map((c) => (
            <div key={c.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedConv(expandedConv === c.id ? null : c.id)}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-50"
              >
                <div className="text-left flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-900">
                      {c.leadEmail || `Anonim · ${c.sessionId.slice(-6)}`}
                    </span>
                    {c.leadEmail && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                        Lead
                      </span>
                    )}
                    {c.leadCompany && (
                      <span className="text-xs text-slate-500">{c.leadCompany}</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {c.messageCount} mesaj · {new Date(c.lastMessageAt).toLocaleString("tr-TR")}
                  </div>
                </div>
                {expandedConv === c.id ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>
              {expandedConv === c.id && (
                <div className="border-t border-slate-100 p-4 bg-slate-50 max-h-96 overflow-y-auto">
                  {c.messages.map((m, i) => (
                    <div key={i} className={`mb-2 ${m.role === "user" ? "text-right" : ""}`}>
                      <div
                        className={`inline-block max-w-[80%] p-2 rounded text-sm ${
                          m.role === "user" ? "bg-blue-600 text-white" : "bg-white text-slate-800 border border-slate-200"
                        }`}
                      >
                        {m.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── FAQ Editor ───────────────────────────────────────────────────────────
function FaqEditor({ faq, onSave, onCancel }: { faq: Faq | null; onSave: (f: any) => void; onCancel: () => void }) {
  const [category, setCategory] = useState(faq?.category ?? "");
  const [question, setQuestion] = useState(faq?.question ?? "");
  const [answer, setAnswer] = useState(faq?.answer ?? "");
  const [keywords, setKeywords] = useState(faq?.keywords ?? "");
  const [isActive, setIsActive] = useState(faq?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState(faq?.sortOrder ?? 0);

  return (
    <div className="bg-white border-2 border-blue-300 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-medium text-slate-900">{faq ? "FAQ Düzenle" : "Yeni FAQ"}</div>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-600">Kategori (opsiyonel)</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Fiyatlandırma, Kurumsal, Koçlar..."
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Sıra (büyük olan önce)</label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600">Soru *</label>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Örn: Kurumsal eğitim için kaç kişiden başlıyorsunuz?"
            className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600">Cevap *</label>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={4}
            placeholder="Bot'un kullanacağı bilgi. Markdown desteklenir."
            className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600">
            Anahtar Kelimeler (opsiyonel, virgülle ayrılmış)
          </label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="fiyat, kurumsal teklif, kaç kişi, minimum"
            className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded"
            />
            Aktif
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={onCancel}
            className="px-3 py-2 text-sm rounded border border-slate-200 hover:bg-slate-50"
          >
            İptal
          </button>
          <button
            onClick={() => onSave({ category, question, answer, keywords, isActive, sortOrder })}
            disabled={!question.trim() || !answer.trim()}
            className="px-3 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
