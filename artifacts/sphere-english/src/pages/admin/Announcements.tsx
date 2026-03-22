import { useState } from "react";
import { useGetAnnouncements, useCreateAnnouncement } from "@workspace/api-client-react";
import { Card, CardContent, Button, Badge } from "@/components/ui/core";
import { Megaphone, Plus, Calendar } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-blue-100 text-blue-700",
  normal: "bg-gray-100 text-gray-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

export default function Announcements() {
  const { data: announcements, isLoading } = useGetAnnouncements();
  const createMutation = useCreateAnnouncement();
  const [showCreate, setShowCreate] = useState(false);
  const { register, handleSubmit, reset } = useForm();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const onSubmit = async (data: any) => {
    try {
      await createMutation.mutateAsync({ data: { title: data.title, content: data.content, priority: data.priority || "normal", targetRole: data.targetRole || null } });
      toast({ title: "Announcement created!" });
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
      setShowCreate(false);
      reset();
    } catch {
      toast({ title: "Error", description: "Could not create announcement.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-display">Announcements</h1>
          <p className="text-muted-foreground mt-1">Post announcements to all students and teachers.</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="flex items-center gap-2">
          <Plus size={18} /> New Announcement
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">{[1, 2, 3].map(i => <Card key={i} className="h-32 animate-pulse bg-secondary/50" />)}</div>
      ) : announcements?.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Megaphone className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-bold mb-2">No announcements yet</h3>
            <p className="text-muted-foreground">Create your first announcement to notify users.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements?.map(ann => (
            <Card key={ann.id} className={`border-l-4 ${ann.priority === 'urgent' ? 'border-l-red-500' : ann.priority === 'high' ? 'border-l-orange-500' : 'border-l-accent'}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Megaphone className="h-5 w-5 text-accent shrink-0" />
                    <h3 className="font-bold text-lg">{ann.title}</h3>
                    <Badge className={PRIORITY_COLORS[ann.priority] || "bg-gray-100 text-gray-700"}>{ann.priority}</Badge>
                    {ann.targetRole && <Badge variant="outline" className="capitalize">{ann.targetRole}s only</Badge>}
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
                    <Calendar size={14} />
                    {new Date(ann.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed ml-8">{ann.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Announcement</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div>
              <Label>Title</Label>
              <Input {...register("title", { required: true })} placeholder="Announcement title" className="mt-1" />
            </div>
            <div>
              <Label>Content</Label>
              <textarea
                {...register("content", { required: true })}
                rows={4}
                placeholder="Write your announcement..."
                className="mt-1 w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Priority</Label>
                <select {...register("priority")} className="mt-1 w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-background">
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <Label>Audience</Label>
                <select {...register("targetRole")} className="mt-1 w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-background">
                  <option value="">Everyone</option>
                  <option value="student">Students</option>
                  <option value="teacher">Teachers</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={createMutation.isPending} className="flex-1">
                {createMutation.isPending ? "Posting..." : "Post Announcement"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
