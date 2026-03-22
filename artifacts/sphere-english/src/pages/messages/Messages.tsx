import { useState } from "react";
import { useGetMessages, useGetConversation, useSendMessage } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, Button } from "@/components/ui/core";
import { MessageSquare, Send, Search } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["bg-blue-500", "bg-purple-500", "bg-green-500", "bg-orange-500", "bg-pink-500"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`h-10 w-10 rounded-full ${color} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
      {initials}
    </div>
  );
}

function ConversationView({ partnerId, onBack }: { partnerId: number; onBack: () => void }) {
  const { user } = useAuth();
  const { data: msgs, isLoading } = useGetConversation(partnerId);
  const sendMutation = useSendMessage();
  const [text, setText] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSend = async () => {
    if (!text.trim()) return;
    try {
      await sendMutation.mutateAsync({ data: { recipientId: partnerId, content: text.trim() } });
      setText("");
      queryClient.invalidateQueries({ queryKey: [`/api/messages/conversation/${partnerId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    } catch {
      toast({ title: "Error", description: "Could not send message.", variant: "destructive" });
    }
  };

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  const partner = msgs?.find(m => m.senderId !== user?.id)?.sender || msgs?.find(m => m.recipientId !== user?.id)?.recipient;
  const partnerName = partner ? `${partner.firstName} ${partner.lastName}` : "User";

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-4 border-b border-border bg-card">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground mr-2">←</button>
        <Avatar name={partnerName} />
        <div>
          <p className="font-semibold">{partnerName}</p>
          <p className="text-xs text-muted-foreground capitalize">{partner?.role || "user"}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {msgs?.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>No messages yet. Start the conversation!</p>
          </div>
        )}
        {msgs?.map(msg => {
          const isMe = msg.senderId === user?.id;
          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
              {!isMe && <Avatar name={partnerName} />}
              <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${isMe ? "bg-primary text-white rounded-br-none" : "bg-secondary text-foreground rounded-bl-none"}`}>
                <p>{msg.content}</p>
                <p className={`text-xs mt-1 ${isMe ? "text-white/60" : "text-muted-foreground"}`}>
                  {new Date(msg.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 border-t border-border bg-card">
        <div className="flex gap-3">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          />
          <Button onClick={handleSend} disabled={!text.trim() || sendMutation.isPending} size="sm" className="px-4">
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Messages() {
  const { user } = useAuth();
  const { data: messages, isLoading } = useGetMessages();
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  // Group messages by conversation partner
  const conversations = (() => {
    if (!messages || !user) return [];
    const seen = new Map<number, typeof messages[0]>();
    [...messages].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).forEach(msg => {
      const partnerId = msg.senderId === user.id ? msg.recipientId : msg.senderId;
      if (!seen.has(partnerId)) seen.set(partnerId, msg);
    });
    return Array.from(seen.entries()).map(([partnerId, lastMsg]) => ({ partnerId, lastMsg }));
  })();

  const filtered = conversations.filter(c => {
    const partner = c.lastMsg.senderId === user?.id ? c.lastMsg.recipient : c.lastMsg.sender;
    const name = `${partner?.firstName} ${partner?.lastName}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display">Messages</h1>
        <p className="text-muted-foreground mt-1">Chat with your teachers and classmates.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-280px)] min-h-[500px]">
        {/* Conversation List */}
        <Card className="lg:col-span-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {isLoading && [1, 2, 3].map(i => (
              <div key={i} className="p-4 flex gap-3 animate-pulse">
                <div className="h-10 w-10 rounded-full bg-secondary shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-secondary rounded w-2/3" />
                  <div className="h-2 bg-secondary rounded w-full" />
                </div>
              </div>
            ))}
            {!isLoading && filtered.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No conversations yet.</p>
              </div>
            )}
            {filtered.map(({ partnerId, lastMsg }) => {
              const partner = lastMsg.senderId === user?.id ? lastMsg.recipient : lastMsg.sender;
              const partnerName = `${partner?.firstName} ${partner?.lastName}`;
              const isMe = lastMsg.senderId === user?.id;
              const isSelected = selectedPartnerId === partnerId;
              return (
                <button
                  key={partnerId}
                  onClick={() => setSelectedPartnerId(partnerId)}
                  className={`w-full p-4 flex gap-3 text-left transition-colors ${isSelected ? "bg-accent/10" : "hover:bg-secondary/50"}`}
                >
                  <Avatar name={partnerName} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-semibold text-sm truncate">{partnerName}</p>
                      <p className="text-xs text-muted-foreground shrink-0">
                        {new Date(lastMsg.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {isMe ? "You: " : ""}{lastMsg.content}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Conversation View */}
        <Card className="lg:col-span-2 flex flex-col overflow-hidden">
          {selectedPartnerId ? (
            <ConversationView partnerId={selectedPartnerId} onBack={() => setSelectedPartnerId(null)} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <MessageSquare className="h-16 w-16 mb-4 opacity-30" />
              <h3 className="text-xl font-bold mb-2 text-foreground">Select a Conversation</h3>
              <p className="text-sm text-center max-w-xs">Choose a conversation from the list or start a new one by contacting your teacher.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
