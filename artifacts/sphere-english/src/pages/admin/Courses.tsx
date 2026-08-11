import { useGetCourses, useUpdateCourse, useDeleteCourse } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@/components/ui/core";
import { BookOpen, Users, Search, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import { getLevelColor } from "@/lib/utils";

export default function AdminCourses() {
  const [search, setSearch] = useState("");
  const { data: courses, isLoading } = useGetCourses();
  const updateMutation = useUpdateCourse();
  const deleteMutation = useDeleteCourse();
  const queryClient = useQueryClient();

  const filtered = courses?.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggle = async (id: number, isActive: boolean) => {
    await updateMutation.mutateAsync({ id, data: { isActive: !isActive } });
    queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
  };

  const handleDelete = async (id: number) => {
    if (confirm("Bu kursu silmek istediğinize emin misiniz?")) {
      await deleteMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display text-foreground">Kurs Yönetimi</h1>
          <p className="text-muted-foreground mt-1">Tüm platform kurslarını görüntüleyin ve yönetin.</p>
        </div>
        <div className="w-full sm:w-64">
          <Input
            placeholder="Kurs ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-10"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary/50 text-muted-foreground">
                <tr>
                  <th className="px-6 py-4 font-semibold">Kurs</th>
                  <th className="px-6 py-4 font-semibold">Seviye</th>
                  <th className="px-6 py-4 font-semibold">Kayıtlı</th>
                  <th className="px-6 py-4 font-semibold">Ücret</th>
                  <th className="px-6 py-4 font-semibold">Durum</th>
                  <th className="px-6 py-4 font-semibold text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground animate-pulse">Kurslar yükleniyor...</td></tr>
                ) : filtered?.map(course => (
                  <tr key={course.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <BookOpen className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{course.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{course.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge className={getLevelColor(course.level)}>{course.level}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Users size={15} />
                        <span>{course.enrolledCount || 0}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {course.price ? `₺${course.price}` : 'Ücretsiz'}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={course.isActive ? 'success' : 'secondary'}>
                        {course.isActive ? 'Aktif' : 'Pasif'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggle(course.id, course.isActive)}
                        title={course.isActive ? 'Pasife Al' : 'Aktifleştir'}
                      >
                        {course.isActive ? <ToggleRight className="text-green-500" size={20} /> : <ToggleLeft size={20} />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(course.id)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
