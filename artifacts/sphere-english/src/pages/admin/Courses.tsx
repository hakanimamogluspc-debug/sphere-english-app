import { useGetCourses, useUpdateCourse, useDeleteCourse } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@/components/ui/core";
import { BookOpen, Users, Search, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getLevelColor } from "@/lib/utils";

export default function AdminCourses() {
  const { data: courses, isLoading } = useGetCourses();
  const updateMutation = useUpdateCourse();
  const deleteMutation = useDeleteCourse();
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const filtered = courses?.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.level.toLowerCase().includes(search.toLowerCase())
  );

  const toggleActive = async (id: number, current: boolean) => {
    try {
      await updateMutation.mutateAsync({ id, data: { isActive: !current } });
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      toast({ title: `Course ${!current ? "activated" : "deactivated"}` });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const deleteCourse = async (id: number) => {
    if (!confirm("Delete this course? This cannot be undone.")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      toast({ title: "Course deleted." });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display">Course Management</h1>
          <p className="text-muted-foreground mt-1">Manage all courses on the platform.</p>
        </div>
        <div className="w-full sm:w-72">
          <Input icon={<Search size={16} />} placeholder="Search courses..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y divide-border">
              {[1,2,3,4].map(i => <div key={i} className="h-20 animate-pulse bg-secondary/30 m-4 rounded-xl" />)}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered?.map(course => (
                <div key={course.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 hover:bg-secondary/20 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <BookOpen className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-foreground">{course.title}</span>
                        <Badge className={getLevelColor(course.level)}>{course.level}</Badge>
                        <Badge className={course.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                          {course.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Users size={13} /> {course.enrolledCount || 0} enrolled</span>
                        <span className="flex items-center gap-1"><BookOpen size={13} /> {course.totalLessons || 0} lessons</span>
                        <span>${course.price || 0}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(course.id, course.isActive)} title={course.isActive ? "Deactivate" : "Activate"}>
                      {course.isActive ? <ToggleRight className="h-5 w-5 text-green-600" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteCourse(course.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              ))}
              {filtered?.length === 0 && (
                <div className="py-12 text-center text-muted-foreground">No courses found.</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
