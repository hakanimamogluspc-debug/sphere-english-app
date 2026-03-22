import { useState } from "react";
import { useGetMyCourses, useCreateCourse, useGetCourse } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@/components/ui/core";
import { BookOpen, Plus, Users, Clock, ChevronRight, Video, FileText } from "lucide-react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getLevelColor } from "@/lib/utils";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

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
          price: parseFloat(data.price) || 0,
          isActive: true,
        }
      });
      toast({ title: "Course Created!", description: "Your course is now live." });
      queryClient.invalidateQueries({ queryKey: ["/api/courses/my-courses"] });
      setShowCreate(false);
      reset();
    } catch {
      toast({ title: "Error", description: "Could not create course.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display">My Courses</h1>
          <p className="text-muted-foreground mt-1">Manage your courses, modules, and lessons.</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="flex items-center gap-2">
          <Plus size={18} /> Create Course
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map(i => <Card key={i} className="h-48 animate-pulse bg-secondary/50" />)}
        </div>
      ) : courses?.length === 0 ? (
        <Card>
          <CardContent className="py-20 text-center">
            <BookOpen className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-bold mb-2">No courses yet</h3>
            <p className="text-muted-foreground mb-6">Create your first course to start teaching.</p>
            <Button onClick={() => setShowCreate(true)}>Create Your First Course</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {courses?.map(course => (
            <Card key={course.id} className="flex flex-col hover:-translate-y-1 transition-transform duration-300">
              <div className="h-36 bg-gradient-to-br from-primary/10 to-accent/10 relative overflow-hidden rounded-t-xl">
                {course.imageUrl && <img src={course.imageUrl} alt={course.title} className="w-full h-full object-cover" />}
                <div className="absolute top-3 right-3">
                  <Badge className={getLevelColor(course.level)}>{course.level}</Badge>
                </div>
                <div className="absolute bottom-3 left-3">
                  <Badge className={course.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                    {course.isActive ? "Active" : "Draft"}
                  </Badge>
                </div>
              </div>
              <CardContent className="p-6 flex flex-col flex-1">
                <h3 className="text-lg font-bold font-display mb-2">{course.title}</h3>
                <p className="text-muted-foreground text-sm line-clamp-2 mb-4 flex-1">{course.description}</p>
                <div className="flex items-center gap-6 text-sm text-muted-foreground mb-4">
                  <span className="flex items-center gap-1.5"><Users size={14} /> {course.enrolledCount || 0} students</span>
                  <span className="flex items-center gap-1.5"><BookOpen size={14} /> {course.totalLessons || 0} lessons</span>
                  <span className="flex items-center gap-1.5">${course.price || 0}</span>
                </div>
                <div className="flex gap-3 border-t border-border pt-4">
                  <Link href={`/courses/${course.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">View Course</Button>
                  </Link>
                  <Button size="sm" className="flex-1 flex items-center gap-1">
                    Edit <ChevronRight size={14} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create a New Course</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div>
              <Label>Course Title</Label>
              <Input {...register("title", { required: true })} placeholder="e.g. Business English for Professionals" className="mt-1" />
            </div>
            <div>
              <Label>Description</Label>
              <textarea
                {...register("description")}
                placeholder="What will students learn?"
                rows={3}
                className="mt-1 w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Level</Label>
                <select {...register("level", { required: true })} className="mt-1 w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-background">
                  {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <Label>Price (USD)</Label>
                <Input type="number" step="0.01" {...register("price")} defaultValue={0} placeholder="0.00" className="mt-1" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={createMutation.isPending} className="flex-1">
                {createMutation.isPending ? "Creating..." : "Create Course"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
