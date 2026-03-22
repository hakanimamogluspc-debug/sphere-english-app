import { useState } from "react";
import { useGetMessages, useGetConversation, useSendMessage } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, Button } from "@/components/ui/core";
import { MessageSquare, Send, Search } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";

export default function Messages() {
  const { user } = useAuth();
  const { data: messages, isLoading } = useGetMessages();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [messageText, setMessageText] = useState("");
  const { data: conversation } = useGetConversation(selectedUserId || 0);
  const sendMutation = useSendMessage();
  const queryClient = useQueryClient();

  const conversations = messages?.conversations || [];

  const handleSend = async () => {
    if (!messageText.trim() || !selectedUserId) return;
    await sendMutation.mutateAsync({
      data: { receiverId: selectedUserId, content: messageText.trim() }
    });
    setMessageText("");
    queryClient.invalidateQueries({ queryKey: [`/api/messages/conversation/${selectedUserId}`] });
    queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
  };

  const selectedContact = conversations.find(c => c.userId === selectedUserId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display">Mesajlar</h1>
        <p className="text-muted-foreground mt-1">Öğretmenleriniz ve öğrencilerinizle iletişim kurun.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        {/* Konuşma Listesi */}
        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="p-4 border-b border-border shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <input
                type="text"
                placeholder="Konuşma ara..."
                className="w-full pl-9 pr-4 py-2 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </CardHeader>
          <div className="flex-1 overflow-y-auto divide-y divide-border/50">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground animate-pulse">Yükleniyor...</div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Henüz konuşma yok</p>
              </div>
            ) : conversations.map(conv => (
              <button
                key={conv.userId}
                className={`w-full p-4 flex items-center gap-3 hover:bg-secondary/50 transition-colors text-left ${selectedUserId === conv.userId ? 'bg-primary/5 border-r-2 border-primary' : ''}`}
                onClick={() => setSelectedUserId(conv.userId)}
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0">
                  {conv.firstName?.[0]}{conv.lastName?.[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground text-sm">{conv.firstName} {conv.lastName}</p>
                  <p className="text-xs text-muted-foreground truncate">{conv.lastMessage || 'Henüz mesaj yok'}</p>
                </div>
                {conv.unreadCount > 0 && (
                  <span className="shrink-0 h-5 w-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">
                    {conv.unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </Card>

        {/* Mesajlaşma Alanı */}
        <Card className="lg:col-span-2 flex flex-col overflow-hidden">
          {!selectedUserId ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="font-medium">Bir konuşma seçin</p>
                <p className="text-sm mt-1">Mesajlaşmaya başlamak için sol taraftan bir kişi seçin</p>
              </div>
            </div>
          ) : (
            <>
              <CardHeader className="p-4 border-b border-border shrink-0">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                    {selectedContact?.firstName?.[0]}{selectedContact?.lastName?.[0]}
                  </div>
                  <div>
                    <p className="font-semibold">{selectedContact?.firstName} {selectedContact?.lastName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{selectedContact?.role === 'teacher' ? 'Öğretmen' : selectedContact?.role === 'student' ? 'Öğrenci' : selectedContact?.role || ''}</p>
                  </div>
                </div>
              </CardHeader>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {conversation?.messages?.map((msg: any) => {
                  const isMe = msg.senderId === user?.id;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] px-4 py-3 rounded-2xl text-sm ${
                        isMe 
                          ? 'bg-primary text-white rounded-br-sm' 
                          : 'bg-secondary text-foreground rounded-bl-sm'
                      }`}>
                        <p>{msg.content}</p>
                        <p className={`text-xs mt-1 ${isMe ? 'text-white/60' : 'text-muted-foreground'}`}>
                          {new Date(msg.sentAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {(!conversation?.messages || conversation.messages.length === 0) && (
                  <div className="text-center text-muted-foreground py-8">
                    <p className="text-sm">Henüz mesaj yok. Konuşmaya başlayın!</p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-border flex gap-3 shrink-0">
                <input
                  type="text"
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Mesajınızı yazın..."
                  className="flex-1 px-4 py-3 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:border-primary"
                />
                <Button
                  onClick={handleSend}
                  disabled={!messageText.trim() || sendMutation.isPending}
                  className="shrink-0 px-4"
                >
                  <Send size={18} />
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
