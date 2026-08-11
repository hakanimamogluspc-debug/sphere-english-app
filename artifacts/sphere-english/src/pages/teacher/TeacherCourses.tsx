import { useState } from "react";
import { useGetMyCourses, useCreateCourse, useGetCourse } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@/components/ui/core";
import { BookOpen, Plus, Users, Clock, ChevronRight, Video, FileText } from "lucide-react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getLevelColor } from "@/lib/utils";

export default function TeacherCourses() {
  const { data: courses, isLoading } = useGetMyCourses();
  const createMutation = useCreateCourse();
  const [showCreate, setShowCreate] = useState(false);
  const { register, handleSubmit, reset } = useForm();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const onSubmit = async (data: any) => {
    try {
      await createMutation.mutateAsync({
        data: {
          title: data.title,
          description: data.description,
          level: data.level,
          price: data.price ? parseFloat(data.price) : null,
          imageUrl: data.imageUrl || null,
          isActive: true,
        }
      });
      toast({ title: "Kurs Oluşturuldu!", description: "Yeni kursunuz başarıyla eklendi." });
      queryClient.invalidateQueries({ queryKey: ["/api/courses/my-courses"] });
      setShowCreate(false);
      reset();
    } catch {
      toast({ title: "Hata", description: "Kurs oluşturulamadı.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display">Kurslarımı Yönet</h1>
          <p className="text-muted-foreground mt-1">Kurslarınızı oluşturun ve içeriklerinizi düzenleyin.</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="flex items-center gap-2">
          <Plus size={18} /> Kurs Oluştur
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3].map(i => <Card key={i} className="h-48 animate-pulse bg-secondary/50" />)}
        </div>
      ) : courses?.length === 0 ? (
        <Card>
          <CardContent className="py-20 text-center">
            <BookOpen className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-bold mb-2">Henüz kursunuz yok</h3>
            <p className="text-muted-foreground mb-6">İlk kursunuzu oluşturarak öğrencilerinize içerik sunmaya başlayın.</p>
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus size={18} /> İlk Kursumu Oluştur
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {courses?.map(course => (
            <Card key={course.id} className="overflow-hidden flex flex-col hover:-translate-y-1 transition-transform duration-300">
              <div className="h-40 relative bg-secondary">
                <img
                  src={course.imageUrl || `${import.meta.env.BASE_URL}images/course-placeholder.png`}
                  alt={course.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3">
                  <Badge className={getLevelColor(course.level)}>{course.level}</Badge>
                </div>
                <div className="absolute top-3 right-3">
                  <Badge variant={course.isActive ? 'success' : 'secondary'}>
                    {course.isActive ? 'Yayında' : 'Taslak'}
                  </Badge>
                </div>
              </div>
              <CardContent className="p-5 flex flex-col flex-1">
                <h3 className="text-lg font-bold font-display mb-1 line-clamp-1">{course.title}</h3>
                <p className="text-muted-foreground text-sm line-clamp-2 mb-4 flex-1">{course.description}</p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <span className="flex items-center gap-1.5"><Users size={14} /> {course.enrolledCount || 0} öğrenci</span>
                  <span className="flex items-center gap-1.5"><BookOpen size={14} /> {course.totalLessons || 0} ders</span>
                  <span className="font-semibold text-foreground">{course.price ? `₺${course.price}` : 'Ücretsiz'}</span>
                </div>
                <div className="flex gap-2">
                  <Link href={`/courses/${course.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full gap-1.5">
                      Görüntüle <ChevronRight size={14} />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Yeni Kurs Oluştur</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div>
              <Label>Kurs Başlığı</Label>
              <Input {...register("title", { required: true })} placeholder="örn. İngilizce A1'den A2'ye" className="mt-1" />
            </div>
            <div>
              <Label>Açıklama</Label>
              <textarea
                {...register("description", { required: true })}
                placeholder="Kurs hakkında kısa açıklama..."
                className="mt-1 w-full px-4 py-3 border-2 border-border rounded-xl focus:outline-none focus:border-primary bg-background text-foreground resize-none h-24 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Seviye</Label>
                <select {...register("level", { required: true })} className="mt-1 flex h-12 w-full rounded-xl border-2 border-border bg-background px-4 py-2 text-sm">
                  <option value="A1">A1 - Başlangıç</option>
                  <option value="A2">A2 - Temel</option>
                  <option value="B1">B1 - Orta Altı</option>
                  <option value="B2">B2 - Orta</option>
                  <option value="C1">C1 - İleri</option>
                  <option value="C2">C2 - Ustalık</option>
                </select>
              </div>
              <div>
                <Label>Ücret (₺)</Label>
                <Input type="number" {...register("price")} placeholder="0 = Ücretsiz" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Kapak Görseli URL (isteğe bağlı)</Label>
              <Input {...register("imageUrl")} placeholder="https://..." className="mt-1" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={createMutation.isPending} className="flex-1">
                {createMutation.isPending ? "Oluşturuluyor..." : "Kurs Oluştur"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>İptal</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
