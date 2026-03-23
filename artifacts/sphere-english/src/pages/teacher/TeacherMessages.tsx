import { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, Send, Users, Search, Filter, CheckSquare, Square, Building2, GraduationCap, ChevronDown, X, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/core";
import { Button } from "@/components/ui/core";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { abbrevName } from "@/lib/utils";

import { API } from "@/lib/api-url";

type Student = {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  currentLevel: string | null;
  companyId: number | null;
  companyName?: string | null;
  avatar: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
};

type Message = {
  id: number;
  senderId: number;
  receiverId: number;
  content: string;
  sentAt: string;
  isRead: boolean;
};

type Tab = "bireysel" | "toplu";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

const LEVEL_COLORS: Record<string, string> = {
  A1: "bg-emerald-100 text-emerald-700",
  A2: "bg-green-100 text-green-700",
  B1: "bg-blue-100 text-blue-700",
  B2: "bg-indigo-100 text-indigo-700",
  C1: "bg-purple-100 text-purple-700",
  C2: "bg-rose-100 text-rose-700",
};

function getToken() {
  return localStorage.getItem("sphere_token");
}

function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` };
}

function initials(f?: string, l?: string) {
  return `${f?.[0] ?? ""}${l?.[0] ?? ""}`;
}

export default function TeacherMessages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("bireysel");

  // ─── Öğrenci listesi ──────────────────────────────────────────────────────
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);

  // ─── Bireysel mesaj ───────────────────────────────────────────────────────
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);
  const [searchBireysel, setSearchBireysel] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ─── Toplu mesaj ─────────────────────────────────────────────────────────
  const [filterLevel, setFilterLevel] = useState<string>("Tümü");
  const [filterCompany, setFilterCompany] = useState<string>("Tümü");
  const [searchToplu, setSearchToplu] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkText, setBulkText] = useState("");
  const [sendingBulk, setSendingBulk] = useState(false);

  // Öğrencileri yükle + her 5 sn'de güncelle
  const loadStudents = useCallback(async (silent = false) => {
    if (!silent) setLoadingStudents(true);
    try {
      const r = await fetch(`${API}/teacher/messages`, { headers: authHeaders() });
      const d = await r.json();
      setStudents(d.conversations ?? []);
    } catch {
      if (!silent) toast({ title: "Hata", description: "Öğrenciler yüklenemedi", variant: "destructive" });
    } finally {
      if (!silent) setLoadingStudents(false);
    }
  }, []);

  useEffect(() => {
    loadStudents();
    const interval = setInterval(() => loadStudents(true), 5000);
    return () => clearInterval(interval);
  }, [loadStudents]);

  // Mesaj geçmişini yükle
  const loadMessages = useCallback(async (studentId: number, silent = false) => {
    if (!silent) setLoadingMsgs(true);
    try {
      const r = await fetch(`${API}/teacher/messages/${studentId}`, { headers: authHeaders() });
      const d = await r.json();
      setMessages(d.messages ?? []);
    } catch {
      if (!silent) toast({ title: "Hata", description: "Mesajlar yüklenemedi", variant: "destructive" });
    } finally {
      if (!silent) setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedStudent) return;
    loadMessages(selectedStudent.userId);
    const interval = setInterval(() => loadMessages(selectedStudent.userId, true), 3000);
    return () => clearInterval(interval);
  }, [selectedStudent, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Bireysel mesaj gönder
  const sendIndividual = async () => {
    if (!msgText.trim() || !selectedStudent || sending) return;
    setSending(true);
    try {
      const r = await fetch(`${API}/teacher/messages/${selectedStudent.userId}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ content: msgText.trim() }),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error ?? "Gönderilemedi");
      }
      const msg = await r.json();
      setMessages(prev => [...prev, msg]);
      setMsgText("");
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  // Toplu mesaj gönder
  const sendBulk = async () => {
    if (!bulkText.trim() || selected.size === 0 || sendingBulk) return;
    setSendingBulk(true);
    try {
      const r = await fetch(`${API}/teacher/messages/bulk`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ studentIds: [...selected], content: bulkText.trim() }),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error ?? "Gönderilemedi");
      }
      const d = await r.json();
      toast({ title: "Başarıyla gönderildi", description: `${d.sent} öğrenciye mesaj iletildi.` });
      setBulkText("");
      setSelected(new Set());
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setSendingBulk(false);
    }
  };

  // ─── Filtre hesapları ─────────────────────────────────────────────────────
  const companies = ["Tümü", ...Array.from(new Set(students.map(s => s.companyName).filter(Boolean) as string[]))];

  const filteredForToplu = students.filter(s => {
    const matchLevel = filterLevel === "Tümü" || s.currentLevel === filterLevel;
    const matchCompany = filterCompany === "Tümü" || s.companyName === filterCompany;
    const matchSearch = searchToplu === "" ||
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchToplu.toLowerCase()) ||
      s.email.toLowerCase().includes(searchToplu.toLowerCase());
    return matchLevel && matchCompany && matchSearch;
  });

  const filteredForBireysel = students.filter(s => {
    if (!searchBireysel) return true;
    return `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchBireysel.toLowerCase()) ||
      s.email.toLowerCase().includes(searchBireysel.toLowerCase());
  });

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const selectAll = () => setSelected(new Set(filteredForToplu.map(s => s.userId)));
  const clearAll = () => setSelected(new Set());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display">Mesajlar</h1>
        <p className="text-muted-foreground mt-1">Öğrencilerinizle bireysel veya toplu iletişim kurun.</p>
      </div>

      {/* Tab seçici */}
      <div className="flex gap-2 bg-secondary/40 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab("bireysel")}
          className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === "bireysel" ? "bg-white shadow text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          <MessageSquare className="inline h-4 w-4 mr-2 -mt-0.5" />
          Bireysel Mesaj
        </button>
        <button
          onClick={() => setActiveTab("toplu")}
          className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === "toplu" ? "bg-white shadow text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Users className="inline h-4 w-4 mr-2 -mt-0.5" />
          Toplu Mesaj
        </button>
      </div>

      {/* ═══ BİREYSEL MESAJ TABI ═══════════════════════════════════════════ */}
      {activeTab === "bireysel" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 h-[600px]">
          {/* Öğrenci listesi */}
          <Card className="flex flex-col overflow-hidden">
            <CardHeader className="p-4 border-b shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <input
                  type="text"
                  placeholder="Öğrenci ara..."
                  value={searchBireysel}
                  onChange={e => setSearchBireysel(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </CardHeader>
            <div className="flex-1 overflow-y-auto divide-y divide-border/50">
              {loadingStudents ? (
                <div className="p-4 text-center text-muted-foreground text-sm animate-pulse">Yükleniyor...</div>
              ) : filteredForBireysel.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Öğrenci bulunamadı</p>
                </div>
              ) : filteredForBireysel.map(s => (
                <button
                  key={s.userId}
                  onClick={() => setSelectedStudent(s)}
                  className={`w-full p-4 flex items-center gap-3 hover:bg-secondary/50 transition-colors text-left ${selectedStudent?.userId === s.userId ? "bg-primary/5 border-r-2 border-primary" : ""}`}
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                    {initials(s.firstName, s.lastName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-sm truncate">{abbrevName(s.firstName, s.lastName)}</p>
                      {s.currentLevel && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${LEVEL_COLORS[s.currentLevel] ?? "bg-gray-100 text-gray-600"}`}>
                          {s.currentLevel}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{s.lastMessage ?? "Henüz mesaj yok"}</p>
                  </div>
                  {s.unreadCount > 0 && (
                    <span className="shrink-0 h-5 w-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">
                      {s.unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </Card>

          {/* Sohbet alanı */}
          <Card className="lg:col-span-2 flex flex-col overflow-hidden">
            {!selectedStudent ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <p className="font-medium">Bir öğrenci seçin</p>
                  <p className="text-sm mt-1 text-muted-foreground/70">Soldaki listeden bir öğrenci seçerek mesajlaşmaya başlayın</p>
                </div>
              </div>
            ) : (
              <>
                {/* Başlık */}
                <div className="p-4 border-b flex items-center gap-3 shrink-0">
                  <button onClick={() => setSelectedStudent(null)} className="lg:hidden p-1 rounded-lg hover:bg-secondary">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                    {initials(selectedStudent.firstName, selectedStudent.lastName)}
                  </div>
                  <div>
                    <p className="font-semibold">{abbrevName(selectedStudent.firstName, selectedStudent.lastName)}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {selectedStudent.currentLevel && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${LEVEL_COLORS[selectedStudent.currentLevel] ?? ""}`}>
                          {selectedStudent.currentLevel}
                        </span>
                      )}
                      {selectedStudent.companyName && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Building2 className="h-3 w-3" />{selectedStudent.companyName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Mesajlar */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {loadingMsgs ? (
                    <div className="text-center text-muted-foreground text-sm animate-pulse py-8">Yükleniyor...</div>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <p className="text-sm">Henüz mesaj yok. Konuşmaya başlayın!</p>
                    </div>
                  ) : messages.map(msg => {
                    const isMe = msg.senderId === user?.id;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[70%] px-4 py-3 rounded-2xl text-sm ${isMe ? "bg-primary text-white rounded-br-sm" : "bg-secondary text-foreground rounded-bl-sm"}`}>
                          <p>{msg.content}</p>
                          <p className={`text-xs mt-1 ${isMe ? "text-white/60" : "text-muted-foreground"}`}>
                            {new Date(msg.sentAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Giriş */}
                <div className="p-4 border-t flex gap-3 shrink-0">
                  <input
                    type="text"
                    value={msgText}
                    onChange={e => setMsgText(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendIndividual()}
                    placeholder="Mesajınızı yazın..."
                    className="flex-1 px-4 py-3 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:border-primary"
                  />
                  <Button onClick={sendIndividual} disabled={!msgText.trim() || sending} className="shrink-0 px-4">
                    <Send size={18} />
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {/* ═══ TOPLU MESAJ TABI ════════════════════════════════════════════════ */}
      {activeTab === "toplu" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Sol: Filtre + Öğrenci seçimi */}
          <div className="lg:col-span-3 space-y-4">
            {/* Filtre çubuğu */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Filter className="h-4 w-4 text-primary" />
                  Filtrele
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Seviye filtresi */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                      <GraduationCap className="h-3 w-3" /> Seviye
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {["Tümü", ...LEVELS].map(l => (
                        <button
                          key={l}
                          onClick={() => setFilterLevel(l)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${filterLevel === l ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Kurum filtresi */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                      <Building2 className="h-3 w-3" /> Kurum
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {companies.map(c => (
                        <button
                          key={c}
                          onClick={() => setFilterCompany(c)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border max-w-[120px] truncate ${filterCompany === c ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Arama */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <input
                    type="text"
                    placeholder="İsim veya e-posta ile ara..."
                    value={searchToplu}
                    onChange={e => setSearchToplu(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Öğrenci listesi */}
            <Card>
              <CardContent className="p-4 space-y-3">
                {/* Toplu seçim başlık */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    {filteredForToplu.length} öğrenci listeleniyor
                  </span>
                  <div className="flex gap-2">
                    <button onClick={selectAll} className="text-xs text-primary hover:underline font-medium">
                      Tümünü Seç
                    </button>
                    {selected.size > 0 && (
                      <>
                        <span className="text-xs text-muted-foreground">·</span>
                        <button onClick={clearAll} className="text-xs text-red-500 hover:underline font-medium">
                          Temizle
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {loadingStudents ? (
                  <div className="text-center text-muted-foreground text-sm animate-pulse py-4">Yükleniyor...</div>
                ) : filteredForToplu.length === 0 ? (
                  <div className="text-center text-muted-foreground py-6">
                    <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Bu kriterlere uyan öğrenci yok</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50 -mx-4">
                    {filteredForToplu.map(s => {
                      const isChecked = selected.has(s.userId);
                      return (
                        <button
                          key={s.userId}
                          onClick={() => toggleSelect(s.userId)}
                          className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-secondary/40 transition-colors text-left ${isChecked ? "bg-primary/5" : ""}`}
                        >
                          <div className={`shrink-0 ${isChecked ? "text-primary" : "text-muted-foreground"}`}>
                            {isChecked ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                          </div>
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                            {initials(s.firstName, s.lastName)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-sm">{abbrevName(s.firstName, s.lastName)}</span>
                              {s.currentLevel && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${LEVEL_COLORS[s.currentLevel] ?? "bg-gray-100 text-gray-600"}`}>
                                  {s.currentLevel}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {s.companyName ? `${s.companyName} · ` : ""}{s.email}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sağ: Mesaj oluşturma */}
          <div className="lg:col-span-2">
            <Card className="sticky top-4">
              <CardContent className="p-5 space-y-4">
                <div>
                  <h3 className="font-semibold text-foreground">Toplu Mesaj Gönder</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Seçili öğrencilerin hepsine ayrı ayrı iletilir.</p>
                </div>

                {/* Seçili öğrenciler özeti */}
                {selected.size > 0 ? (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-primary">{selected.size} öğrenci seçildi</span>
                      <button onClick={clearAll} className="text-muted-foreground hover:text-foreground">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[...selected].slice(0, 6).map(id => {
                        const s = students.find(st => st.userId === id);
                        return s ? (
                          <span key={id} className="inline-flex items-center gap-1 bg-white border border-border rounded-full px-2 py-0.5 text-xs">
                            {abbrevName(s.firstName, s.lastName)}
                            <button onClick={e => { e.stopPropagation(); toggleSelect(id); }} className="text-muted-foreground hover:text-red-500">
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ) : null;
                      })}
                      {selected.size > 6 && (
                        <span className="inline-flex items-center bg-secondary rounded-full px-2 py-0.5 text-xs text-muted-foreground">
                          +{selected.size - 6} daha
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-secondary/50 rounded-xl p-4 text-center text-sm text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-1.5 opacity-30" />
                    Soldan öğrenci seçin
                  </div>
                )}

                {/* Mesaj alanı */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Mesaj</label>
                  <textarea
                    rows={6}
                    value={bulkText}
                    onChange={e => setBulkText(e.target.value)}
                    placeholder="Tüm seçili öğrencilere gönderilecek mesajı yazın..."
                    className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:border-primary resize-none"
                  />
                  <p className="text-xs text-muted-foreground text-right">{bulkText.length} karakter</p>
                </div>

                <Button
                  onClick={sendBulk}
                  disabled={selected.size === 0 || !bulkText.trim() || sendingBulk}
                  className="w-full"
                >
                  {sendingBulk ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                      Gönderiliyor...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Send className="h-4 w-4" />
                      {selected.size > 0 ? `${selected.size} Öğrenciye Gönder` : "Öğrenci Seçin"}
                    </span>
                  )}
                </Button>

                {/* Hızlı seçim kısayolları */}
                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Hızlı Seçim</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSelected(new Set(students.map(s => s.userId)))}
                      className="text-xs px-3 py-2 border border-border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-colors text-left"
                    >
                      <Users className="h-3 w-3 inline mr-1" />
                      Tüm Öğrenciler
                    </button>
                    {LEVELS.filter(l => students.some(s => s.currentLevel === l)).map(l => (
                      <button
                        key={l}
                        onClick={() => setSelected(new Set(students.filter(s => s.currentLevel === l).map(s => s.userId)))}
                        className={`text-xs px-3 py-2 border border-border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-colors text-left ${LEVEL_COLORS[l] ? "" : ""}`}
                      >
                        <GraduationCap className="h-3 w-3 inline mr-1" />
                        {l} Seviyesi
                      </button>
                    ))}
                    {companies.filter(c => c !== "Tümü").map(c => (
                      <button
                        key={c}
                        onClick={() => setSelected(new Set(students.filter(s => s.companyName === c).map(s => s.userId)))}
                        className="text-xs px-3 py-2 border border-border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-colors text-left col-span-2 truncate"
                      >
                        <Building2 className="h-3 w-3 inline mr-1" />
                        {c} Kurumu
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
