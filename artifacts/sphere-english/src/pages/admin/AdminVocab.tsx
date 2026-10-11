import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/core";
import {
  BookOpen, Search, Plus, Edit, Trash2, Save, X, Loader2,
} from "lucide-react";

interface Word {
  id: number;
  word: string;
  turkish: string;
  level: string;
  category: string;
  pronunciation: string | null;
  partOfSpeech: string | null;
  exampleSentence: string | null;
  exampleSentenceTurkish: string | null;
  synonyms: string[] | null;
  antonyms: string[] | null;
  frequencyRank: number | null;
  difficulty: number | null;
}

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

async function apiJson(path: string, init?: RequestInit) {
  const token = localStorage.getItem("sphere_token");
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Hata" }));
    throw new Error(data.error || "Hata");
  }
  return res.json();
}

export default function AdminVocab() {
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Word | null>(null);
  const [creating, setCreating] = useState(false);

  const qp = new URLSearchParams();
  if (search.trim()) qp.set("q", search.trim());
  if (levelFilter) qp.set("level", levelFilter);
  qp.set("page", String(page));
  qp.set("limit", "25");

  const { data, isLoading } = useQuery<{ words: Word[]; total: number }>({
    queryKey: ["admin-vocab", search, levelFilter, page],
    queryFn: () => apiJson(`/api/admin/vocab/words?${qp.toString()}`),
  });

  const words = data?.words ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 25);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Kelime Yönetimi
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} kelime
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
        >
          <Plus className="h-4 w-4" /> Yeni Kelime
        </button>
      </div>

      {/* Filters */}
      <Card className="p-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Kelime veya Türkçe'de ara..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <select
          value={levelFilter}
          onChange={(e) => { setLevelFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Tüm seviyeler</option>
          {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </Card>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : words.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Kelime bulunamadı</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {words.map((w) => (
            <Card key={w.id} className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{w.word}</p>
                    {w.pronunciation && (
                      <span className="text-xs text-muted-foreground font-mono">{w.pronunciation}</span>
                    )}
                    <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                      {w.level}
                    </span>
                    {w.partOfSpeech && (
                      <span className="text-xs italic text-muted-foreground">{w.partOfSpeech}</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{w.turkish}</p>
                  {w.exampleSentence && (
                    <p className="text-xs text-muted-foreground mt-1 italic truncate">
                      "{w.exampleSentence}"
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(w)}
                  className="h-8 w-8 rounded-lg hover:bg-secondary flex items-center justify-center"
                  aria-label="Düzenle"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <DeleteButton word={w} />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 rounded border border-border disabled:opacity-50"
          >
            Önceki
          </button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 rounded border border-border disabled:opacity-50"
          >
            Sonraki
          </button>
        </div>
      )}

      {editing && <EditModal word={editing} onClose={() => setEditing(null)} />}
      {creating && <EditModal word={null} onClose={() => setCreating(false)} />}
    </div>
  );
}

function DeleteButton({ word }: { word: Word }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: () => apiJson(`/api/admin/vocab/words/${word.id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-vocab"] }),
  });
  return (
    <button
      type="button"
      onClick={() => {
        if (confirm(`"${word.word}" kelimesini silmek istediğine emin misin?`)) {
          del.mutate();
        }
      }}
      disabled={del.isPending}
      className="h-8 w-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-600 disabled:opacity-50"
      aria-label="Sil"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

function EditModal({ word, onClose }: { word: Word | null; onClose: () => void }) {
  const isNew = word === null;
  const qc = useQueryClient();
  const [form, setForm] = useState({
    word: word?.word ?? "",
    turkish: word?.turkish ?? "",
    level: word?.level ?? "A1",
    category: word?.category ?? "general_business",
    imagePrompt: "",
    pronunciation: word?.pronunciation ?? "",
    partOfSpeech: word?.partOfSpeech ?? "",
    exampleSentence: word?.exampleSentence ?? "",
    exampleSentenceTurkish: word?.exampleSentenceTurkish ?? "",
    synonymsText: (word?.synonyms ?? []).join(", "),
  });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        ...form,
        synonyms: form.synonymsText
          .split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10),
      };
      delete (body as any).synonymsText;
      return isNew
        ? apiJson(`/api/admin/vocab/words`, { method: "POST", body: JSON.stringify(body) })
        : apiJson(`/api/admin/vocab/words/${word!.id}`, { method: "PATCH", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-vocab"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-xl bg-background border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">{isNew ? "Yeni Kelime" : "Düzenle"}</h3>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-full hover:bg-secondary flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
          <Field label="İngilizce" value={form.word} onChange={(v) => setForm({ ...form, word: v })} />
          <Field label="Türkçe" value={form.turkish} onChange={(v) => setForm({ ...form, turkish: v })} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Seviye</label>
              <select
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background"
              >
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <Field label="Kategori" value={form.category} onChange={(v) => setForm({ ...form, category: v })} />
          </div>
          <Field label="Telaffuz (IPA)" value={form.pronunciation} onChange={(v) => setForm({ ...form, pronunciation: v })} placeholder="/ˈæpəl/" />
          <Field label="Söz türü (part of speech)" value={form.partOfSpeech} onChange={(v) => setForm({ ...form, partOfSpeech: v })} placeholder="noun / verb / ..." />
          <Field label="Örnek cümle (EN)" value={form.exampleSentence} onChange={(v) => setForm({ ...form, exampleSentence: v })} />
          <Field label="Örnek cümle (TR)" value={form.exampleSentenceTurkish} onChange={(v) => setForm({ ...form, exampleSentenceTurkish: v })} />
          <Field label="Eş anlamlı (virgülle)" value={form.synonymsText} onChange={(v) => setForm({ ...form, synonymsText: v })} placeholder="fowl, avian, bird" />
          {save.isError && (
            <div className="p-2 bg-red-50 text-red-700 text-sm rounded">{(save.error as Error).message}</div>
          )}
        </div>
        <div className="p-4 border-t flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 px-4 rounded-lg border border-border text-sm font-medium">İptal</button>
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending || !form.word || !form.turkish}
            className="flex-1 py-2 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isNew ? "Oluştur" : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );
}
