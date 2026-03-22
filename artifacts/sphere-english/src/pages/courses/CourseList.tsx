import { useGetCourses } from "@workspace/api-client-react";
import { Card, CardContent, Badge, Button, Input } from "@/components/ui/core";
import { Link } from "wouter";
import { BookOpen, Search, Users, Clock } from "lucide-react";
import { useState } from "react";
import { getLevelColor } from "@/lib/utils";

export default function CourseList() {
  const [search, setSearch] = useState("");
  const { data: courses, isLoading } = useGetCourses();

  const filteredCourses = courses?.filter(c => 
    c.title.toLowerCase().includes(search.toLowerCase()) || 
    c.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display text-foreground">Course Catalog</h1>
          <p className="text-muted-foreground mt-1">Discover courses tailored to your level.</p>
        </div>
        <div className="w-full sm:w-72">
          <Input 
            icon={<Search size={18} />} 
            placeholder="Search courses..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => (
            <Card key={i} className="h-80 animate-pulse bg-secondary/50" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses?.map((course) => (
            <Card key={course.id} className="overflow-hidden flex flex-col group hover:-translate-y-1 transition-transform duration-300">
              <div className="h-48 relative bg-secondary overflow-hidden">
                <img 
                  src={course.imageUrl || `${import.meta.env.BASE_URL}images/course-placeholder.png`} 
                  alt={course.title} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute top-4 right-4">
                  <Badge className={getLevelColor(course.level)}>{course.level}</Badge>
                </div>
              </div>
              <CardContent className="p-6 flex flex-col flex-1">
                <h3 className="text-xl font-bold font-display mb-2 line-clamp-2">{course.title}</h3>
                <p className="text-muted-foreground text-sm line-clamp-2 mb-4 flex-1">{course.description}</p>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
                  <div className="flex items-center gap-1"><BookOpen size={16}/> {course.totalLessons} Lessons</div>
                  <div className="flex items-center gap-1"><Users size={16}/> {course.enrolledCount} Enrolled</div>
                </div>
                
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-border">
                  <span className="font-semibold">{course.price ? `$${course.price}` : 'Free'}</span>
                  <Link href={`/courses/${course.id}`}>
                    <Button variant="outline" size="sm">View Details</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {filteredCourses?.length === 0 && (
        <div className="text-center py-20 bg-card rounded-2xl border border-border">
          <BookOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-bold mb-2">No courses found</h3>
          <p className="text-muted-foreground">Try adjusting your search terms.</p>
        </div>
      )}
    </div>
  );
}
