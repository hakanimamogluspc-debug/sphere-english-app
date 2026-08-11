import { useState } from "react";
import { useGetAnnouncements, useCreateAnnouncement } from "@workspace/api-client-react";
import { Card, CardContent, Button, Badge } from "@/components/ui/core";
import { Megaphone, Plus, Calendar } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const priorityLabel: Record<string, string> = {
  normal: "Normal",
  important: "Önemli",
  urgent: "Acil",
};

const audienceLabel: Record<string, string> = {
  all: "Herkese",
  students: "Öğrencilere",
  teachers: "Öğretmenlere",
};

export default function Announcements() {
  const { data: announcements, isLoading } = useGetAnnouncements();
  const createMutation = useCreateAnnouncement();
  const [isOpen, setIsOpen] = useState(false);
  const { register, handleSubmit, reset } = useForm();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const onSubmit = async (data: any) => {
    try {
      await createMutation.mutateAsync({ data: { ...data, isActive: true } });
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
      setIsOpen(false);
      reset();
      toast({ title: "Duyuru yayınlandı!", description: "Duyurunuz başarıyla oluşturuldu." });
    } catch {
      toast({ title: "Hata", description: "Duyuru oluşturulamadı.", variant: "destructive" });
    }
  };

  const priorityColor: Record<string, string> = {
    normal: "bg-blue-100 text-blue-700",
    important: "bg-orange-100 text-orange-700",
    urgent: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-display text-foreground">Duyurular</h1>
          <p className="text-muted-foreground mt-1">Platform geneli duyuruları yönetin.</p>
        </div>
        <Button onClick={() => setIsOpen(true)} className="flex items-center gap-2">
          <Plus size={18} /> Yeni Duyuru
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Card key={i} className="h-28 animate-pulse bg-secondary/50" />)}
        </div>
      ) : announcements?.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Megaphone className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-bold mb-2">Henüz duyuru yok</h3>
            <p className="text-muted-foreground">İlk duyuruyu oluşturmak için "Yeni Duyuru" butonuna tıklayın.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements?.map(ann => (
            <Card key={ann.id} className={`border-l-4 ${ann.priority === 'urgent' ? 'border-l-red-500' : ann.priority === 'important' ? 'border-l-orange-400' : 'border-l-blue-400'}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="font-bold text-lg">{ann.title}</h3>
                      <Badge className={priorityColor[ann.priority] || 'bg-secondary'}>
                        {priorityLabel[ann.priority] || ann.priority}
                      </Badge>
                      <Badge variant="outline">{audienceLabel[ann.audience] || ann.audience}</Badge>
                    </div>
                    <p className="text-muted-foreground">{ann.content}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
                    <Calendar size={14} />
                    {new Date(ann.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Duyuru Oluştur</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div>
              <Label>Başlık</Label>
              <Input {...register("title", { required: true })} placeholder="Duyuru başlığı" className="mt-1" />
            </div>
            <div>
              <Label>İçerik</Label>
              <textarea
                {...register("content", { required: true })}
                placeholder="Duyurunun detayları..."
                className="mt-1 w-full px-4 py-3 border-2 border-border rounded-xl focus:outline-none focus:border-primary bg-background text-foreground resize-none h-28 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Öncelik</Label>
                <select {...register("priority", { required: true })} className="mt-1 flex h-12 w-full rounded-xl border-2 border-border bg-background px-4 py-2 text-sm">
                  <option value="normal">Normal</option>
                  <option value="important">Önemli</option>
                  <option value="urgent">Acil</option>
                </select>
              </div>
              <div>
                <Label>Hedef Kitle</Label>
                <select {...register("audience", { required: true })} className="mt-1 flex h-12 w-full rounded-xl border-2 border-border bg-background px-4 py-2 text-sm">
                  <option value="all">Herkes</option>
                  <option value="students">Öğrenciler</option>
                  <option value="teachers">Öğretmenler</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={createMutation.isPending} className="flex-1">
                {createMutation.isPending ? "Yayınlanıyor..." : "Duyuruyu Yayınla"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>İptal</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
