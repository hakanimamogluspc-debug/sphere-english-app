import { useState, useEffect } from "react";
import { MessageCircle, Plus, ArrowLeft, Send, ChevronRight, Clock, Users, Pin, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/core";
import { Button } from "@/components/ui/core";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

import { API } from "@/lib/api-url";

type Topic = {
  id: number;
  title: string;
  content: string;
  authorId: number;
  authorName: string;
  authorRole: string;
  category: string;
  isPinned: boolean;
  replyCount: number;
  createdAt: string;
  updatedAt: string;
  lastReplyAt: string | null;
};

type Reply = {
  id: number;
  topicId: number;
  authorId: number;
  authorName: string;
  authorRole: string;
  content: string;
  createdAt: string;
};

type TopicDetail = Topic & { replies: Reply[] };

const CATEGORIES = [
  { key: "tumu",    label: "Tümü" },
  { key: "genel",   label: "Genel" },
  { key: "gramer",  label: "Gramer" },
  { key: "kelime",  label: "Kelime" },
  { key: "konusma", label: "Konuşma" },
  { key: "sinav",   label: "Sınav" },
];

const CATEGORY_COLORS: Record<string, string> = {
  genel:   "bg-gray-100 text-gray-700",
  gramer:  "bg-blue-100 text-blue-700",
  kelime:  "bg-green-100 text-green-700",
  konusma: "bg-purple-100 text-purple-700",
  sinav:   "bg-orange-100 text-orange-700",
};

const ROLE_COLORS: Record<string, string> = {
  teacher: "bg-primary/10 text-primary",
  admin:   "bg-red-100 text-red-700",
  student: "bg-secondary text-muted-foreground",
};

const ROLE_LABELS: Record<string, string> = {
  teacher: "Öğretmen",
  admin:   "Yönetici",
  student: "Öğrenci",
};

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("sphere_token")}`,
  };
}

function relativeTime(s: string) {
  const diff = (Date.now() - new Date(s).getTime()) / 1000;
  if (diff < 60) return "Az önce";
  if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} sa önce`;
  return new Date(s).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

function Avatar({ name, role }: { name: string; role: string }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const colors: Record<string, string> = {
    teacher: "bg-primary text-white",
    admin: "bg-red-500 text-white",
    student: "bg-secondary text-muted-foreground",
  };
  return (
    <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${colors[role] ?? colors.student}`}>
      {initials}
    </div>
  );
}

export default function Forum() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [view, setView] = useState<"list" | "detail" | "create">("list");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<TopicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeCategory, setActiveCategory] = useState("tumu");
  const [search, setSearch] = useState("");
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Yeni konu formu
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState("genel");
  const [creating, setCreating] = useState(false);

  const fetchTopics = (cat = activeCategory) => {
    setLoading(true);
    const qs = cat !== "tumu" ? `?category=${cat}` : "";
    fetch(`${API}/forum${qs}`, { headers: authHeaders() })
      .then(r => r.json())
      .then(data => setTopics(Array.isArray(data) ? data : []))
      .catch(() => toast({ title: "Hata", description: "Forum yüklenemedi", variant: "destructive" }))
      .finally(() => setLoading(false));
  };

  const fetchDetail = async (topicId: number) => {
    setLoadingDetail(true);
    try {
      const r = await fetch(`${API}/forum/${topicId}`, { headers: authHeaders() });
      const d = await r.json();
      setSelectedTopic(d);
      setView("detail");
    } catch {
      toast({ title: "Hata", description: "Konu yüklenemedi", variant: "destructive" });
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => { fetchTopics(); }, []);

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    fetchTopics(cat);
  };

  const handleReply = async () => {
    if (!replyText.trim() || !selectedTopic || sendingReply) return;
    setSendingReply(true);
    try {
      const r = await fetch(`${API}/forum/${selectedTopic.id}/replies`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ content: replyText.trim() }),
      });
      if (!r.ok) throw new Error();
      const reply = await r.json();
      setSelectedTopic(prev => prev ? { ...prev, replies: [...prev.replies, reply], replyCount: prev.replyCount + 1 } : prev);
      setReplyText("");
    } catch {
      toast({ title: "Hata", description: "Yanıt gönderilemedi", variant: "destructive" });
    } finally {
      setSendingReply(false);
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || !newContent.trim() || creating) return;
    setCreating(true);
    try {
      const r = await fetch(`${API}/forum`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ title: newTitle.trim(), content: newContent.trim(), category: newCategory }),
      });
      if (!r.ok) throw new Error();
      toast({ title: "Konu Oluşturuldu!", description: "Konunuz foruma eklendi." });
      setNewTitle(""); setNewContent(""); setNewCategory("genel");
      setView("list");
      fetchTopics();
    } catch {
      toast({ title: "Hata", description: "Konu oluşturulamadı", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTopic || deleting) return;
    setDeleting(true);
    try {
      await fetch(`${API}/forum/${selectedTopic.id}`, { method: "DELETE", headers: authHeaders() });
      toast({ title: "Silindi", description: "Konu başarıyla silindi." });
      setView("list");
      fetchTopics();
    } catch {
      toast({ title: "Hata", description: "Silinemedi", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const filtered = topics.filter(t =>
    !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.authorName.toLowerCase().includes(search.toLowerCase())
  );

  // ─── Liste Görünümü ────────────────────────────────────────────────────────
  if (view === "list") return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display">Forum</h1>
          <p className="text-muted-foreground mt-1">Öğretmen ve arkadaşlarınızla tartışmalara katılın.</p>
        </div>
        <Button onClick={() => setView("create")} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Konu Aç
        </Button>
      </div>

      {/* Kategori + Arama */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1.5 bg-secondary/40 rounded-xl p-1 overflow-x-auto shrink-0">
          {CATEGORIES.map(c => (
            <button
              key={c.key}
              onClick={() => handleCategoryChange(c.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeCategory === c.key ? "bg-white shadow text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <input
            type="text"
            placeholder="Konu veya yazar ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Konu listesi */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Card key={i} className="h-24 animate-pulse bg-secondary/50" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <MessageCircle className="h-14 w-14 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Henüz konu yok</p>
            <p className="text-sm mt-1">İlk konuyu siz açın!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(topic => (
            <button
              key={topic.id}
              onClick={() => fetchDetail(topic.id)}
              className="w-full text-left"
            >
              <Card className="hover:border-primary/30 hover:shadow-sm transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar name={topic.authorName} role={topic.authorRole} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        {topic.isPinned && <Pin className="h-3.5 w-3.5 text-primary shrink-0" />}
                        <span className="font-semibold text-sm text-foreground">{topic.title}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${CATEGORY_COLORS[topic.category] ?? CATEGORY_COLORS.genel}`}>
                          {CATEGORIES.find(c => c.key === topic.category)?.label ?? topic.category}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{topic.content}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ROLE_COLORS[topic.authorRole] ?? ROLE_COLORS.student}`}>
                            {ROLE_LABELS[topic.authorRole] ?? topic.authorRole}
                          </span>
                          {topic.authorName}
                        </span>
                        <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {topic.replyCount}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {relativeTime(topic.lastReplyAt ?? topic.createdAt)}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // ─── Konu Oluşturma ────────────────────────────────────────────────────────
  if (view === "create") return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={() => setView("list")} className="p-2 rounded-lg hover:bg-secondary transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-3xl font-bold font-display">Konu Aç</h1>
          <p className="text-muted-foreground mt-0.5">Forumda yeni bir tartışma başlatın.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          {/* Kategori */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Kategori</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.filter(c => c.key !== "tumu").map(c => (
                <button
                  key={c.key}
                  onClick={() => setNewCategory(c.key)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${newCategory === c.key ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Başlık */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Başlık</label>
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Konunuzu özetleyen bir başlık yazın..."
              className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:border-primary"
            />
          </div>

          {/* İçerik */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">İçerik</label>
            <textarea
              rows={7}
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder="Sorunuzu veya düşüncelerinizi detaylıca açıklayın..."
              className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:border-primary resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={handleCreate} disabled={!newTitle.trim() || !newContent.trim() || creating} className="flex-1">
              {creating ? "Oluşturuluyor..." : "Konuyu Yayınla"}
            </Button>
            <Button variant="outline" onClick={() => setView("list")}>İptal</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ─── Konu Detayı ──────────────────────────────────────────────────────────
  if (view === "detail") {
    if (loadingDetail || !selectedTopic) return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-secondary animate-pulse rounded-lg" />
        <div className="h-64 bg-secondary animate-pulse rounded-xl" />
      </div>
    );

    return (
      <div className="space-y-6">
        {/* Geri + başlık */}
        <div className="flex items-center gap-3">
          <button onClick={() => setView("list")} className="p-2 rounded-lg hover:bg-secondary transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold font-display truncate">{selectedTopic.title}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${CATEGORY_COLORS[selectedTopic.category] ?? ""}`}>
                {CATEGORIES.find(c => c.key === selectedTopic.category)?.label}
              </span>
            </div>
          </div>
        </div>

        {/* Ana konu */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <Avatar name={selectedTopic.authorName} role={selectedTopic.authorRole} />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-sm">{selectedTopic.authorName}</span>
                    <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded font-medium ${ROLE_COLORS[selectedTopic.authorRole] ?? ""}`}>
                      {ROLE_LABELS[selectedTopic.authorRole] ?? selectedTopic.authorRole}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">{relativeTime(selectedTopic.createdAt)}</span>
                </div>
                <p className="text-sm text-foreground mt-2 leading-relaxed whitespace-pre-wrap">{selectedTopic.content}</p>
                {(user?.id === selectedTopic.authorId || user?.role === "admin") && (
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="mt-3 text-xs text-red-400 hover:text-red-500 transition-colors"
                  >
                    {deleting ? "Siliniyor..." : "Konuyu Sil"}
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Yanıtlar */}
        {selectedTopic.replies.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              {selectedTopic.replies.length} Yanıt
            </h3>
            {selectedTopic.replies.map(reply => (
              <Card key={reply.id} className="ml-6">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar name={reply.authorName} role={reply.authorRole} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-sm">{reply.authorName}</span>
                          <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded font-medium ${ROLE_COLORS[reply.authorRole] ?? ""}`}>
                            {ROLE_LABELS[reply.authorRole] ?? reply.authorRole}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">{relativeTime(reply.createdAt)}</span>
                      </div>
                      <p className="text-sm text-foreground mt-1.5 leading-relaxed whitespace-pre-wrap">{reply.content}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Yanıt yaz */}
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-3">Yanıt Yaz</p>
            <div className="flex gap-3">
              <Avatar name={`${user?.firstName ?? ""} ${user?.lastName ?? ""}`} role={user?.role ?? "student"} />
              <div className="flex-1 flex gap-2">
                <textarea
                  rows={3}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Düşüncelerinizi paylaşın..."
                  onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) handleReply(); }}
                  className="flex-1 px-4 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:border-primary resize-none"
                />
                <Button onClick={handleReply} disabled={!replyText.trim() || sendingReply} className="shrink-0 self-end px-4">
                  {sendingReply ? "..." : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Ctrl+Enter ile gönder</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
