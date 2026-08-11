import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, Button } from "@/components/ui/core";
import { MessageSquare, Send, Search, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { API } from "@/lib/api-url";

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem("sphere_token")}` };
}

async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: { ...authHeaders(), ...(options?.headers || {}) },
  });
  if (!res.ok) throw new Error("İstek başarısız");
  return res.json();
}

interface Conversation {
  userId: number;
  userName: string;
  userAvatar: string | null;
  userRole: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

interface Message {
  id: number;
  senderId: number;
  receiverId: number;
  content: string;
  sentAt: string;
  isRead: boolean;
  senderName: string;
}

export default function Messages() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [messageText, setMessageText] = useState("");
  const [search, setSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [], isLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/messages"],
    queryFn: () => apiFetch(`${API}/messages`),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  const { data: thread = [] } = useQuery<Message[]>({
    queryKey: ["/api/messages", selectedUserId],
    queryFn: () => apiFetch(`${API}/messages/${selectedUserId}`),
    enabled: !!selectedUserId,
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  const sendMut = useMutation({
    mutationFn: (content: string) =>
      apiFetch(`${API}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: selectedUserId, content }),
      }),
    onSuccess: () => {
      setMessageText("");
      qc.invalidateQueries({ queryKey: ["/api/messages", selectedUserId] });
      qc.invalidateQueries({ queryKey: ["/api/messages"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (msgId: number) =>
      apiFetch(`${API}/messages/${msgId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/messages", selectedUserId] });
      qc.invalidateQueries({ queryKey: ["/api/messages"] });
    },
  });

  // Konuşma açıldığında okunmamış mesajları okundu olarak işaretle
  useEffect(() => {
    if (!thread.length || !user?.id) return;
    const unread = thread.filter((m) => m.receiverId === user.id && !m.isRead);
    if (unread.length === 0) return;
    Promise.all(
      unread.map((m) =>
        apiFetch(`${API}/messages/${m.id}/read`, { method: "PATCH" })
      )
    ).then(() => {
      qc.invalidateQueries({ queryKey: ["/api/messages"] });
      qc.invalidateQueries({ queryKey: ["/api/messages", selectedUserId] });
    });
  }, [thread, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  const handleSend = () => {
    if (!messageText.trim() || !selectedUserId || sendMut.isPending) return;
    sendMut.mutate(messageText.trim());
  };

  const filtered = conversations.filter((c) =>
    c.userName.toLowerCase().includes(search.toLowerCase())
  );

  const selectedContact = conversations.find((c) => c.userId === selectedUserId);

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Mesajlar</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Öğretmenlerinizle iletişim kurun.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[600px]">
        {/* Konuşma Listesi */}
        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="p-3 border-b shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <input
                type="text"
                placeholder="Konuşma ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-secondary/50 border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </CardHeader>
          <div className="flex-1 overflow-y-auto divide-y divide-border/50">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground text-sm animate-pulse">
                Yükleniyor...
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Henüz konuşma yok</p>
              </div>
            ) : (
              filtered.map((conv) => (
                <button
                  key={conv.userId}
                  onClick={() => setSelectedUserId(conv.userId)}
                  className={`w-full p-4 flex items-center gap-3 hover:bg-secondary/50 transition-colors text-left ${
                    selectedUserId === conv.userId
                      ? "bg-primary/5 border-r-2 border-primary"
                      : ""
                  }`}
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                    {conv.userName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{conv.userName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {conv.lastMessage || "Henüz mesaj yok"}
                    </p>
                  </div>
                  {conv.unreadCount > 0 && (
                    <span className="shrink-0 h-5 w-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">
                      {conv.unreadCount}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Mesajlaşma Alanı */}
        <Card className="lg:col-span-2 flex flex-col overflow-hidden">
          {!selectedUserId ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="font-medium">Bir konuşma seçin</p>
                <p className="text-sm mt-1 text-muted-foreground">
                  Mesajlaşmaya başlamak için soldaki kişiye tıklayın
                </p>
              </div>
            </div>
          ) : (
            <>
              <CardHeader className="p-4 border-b shrink-0">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
                    {selectedContact?.userName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{selectedContact?.userName}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedContact?.userRole === "teacher"
                        ? "Öğretmen"
                        : selectedContact?.userRole === "admin"
                        ? "Admin"
                        : "Öğrenci"}
                    </p>
                  </div>
                </div>
              </CardHeader>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {thread.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8 text-sm">
                    Henüz mesaj yok. Konuşmaya başlayın!
                  </div>
                ) : (
                  thread.map((msg) => {
                    const isMe = msg.senderId === user?.id;
                    return (
                      <div
                        key={msg.id}
                        className={`group flex items-end gap-1.5 ${isMe ? "justify-end" : "justify-start"}`}
                      >
                        {isMe && (
                          <button
                            onClick={() => deleteMut.mutate(msg.id)}
                            disabled={deleteMut.isPending}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0 mb-1"
                            title="Sil"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                        <div
                          className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
                            isMe
                              ? "bg-primary text-white rounded-br-sm"
                              : "bg-secondary text-foreground rounded-bl-sm"
                          }`}
                        >
                          <p>{msg.content}</p>
                          <p className={`text-xs mt-1 ${isMe ? "text-white/60" : "text-muted-foreground"}`}>
                            {new Date(msg.sentAt).toLocaleTimeString("tr-TR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 border-t flex gap-3 shrink-0">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && !e.shiftKey && handleSend()
                  }
                  placeholder="Mesajınızı yazın..."
                  className="flex-1 px-4 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:border-primary"
                />
                <Button
                  onClick={handleSend}
                  disabled={!messageText.trim() || sendMut.isPending}
                  className="shrink-0 px-4"
                >
                  <Send size={16} />
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
