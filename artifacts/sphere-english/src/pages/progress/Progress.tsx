import { useGetMyProgress } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui/core";
import { useAuth } from "@/hooks/use-auth";
import { TrendingUp, BookOpen, CheckCircle, Star, Flame, Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from "recharts";
import { getLevelColor } from "@/lib/utils";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const BADGES = [
  { id: "first_lesson", name: "First Steps", icon: "🌱", description: "Complete your first lesson", earned: true },
  { id: "streak_7", name: "Week Warrior", icon: "🔥", description: "7-day study streak", earned: false },
  { id: "quiz_master", name: "Quiz Master", icon: "🧠", description: "Score 100% on a quiz", earned: false },
  { id: "social", name: "Social Learner", icon: "💬", description: "Send 10 messages", earned: false },
  { id: "course_complete", name: "Course Champion", icon: "🏆", description: "Complete a full course", earned: false },
  { id: "fast_learner", name: "Fast Learner", icon: "⚡", description: "Complete 3 lessons in a day", earned: false },
];

const SKILL_DATA = [
  { skill: "Reading", level: 70 },
  { skill: "Writing", level: 55 },
  { skill: "Listening", level: 80 },
  { skill: "Speaking", level: 45 },
  { skill: "Grammar", level: 65 },
  { skill: "Vocabulary", level: 75 },
];

export default function ProgressPage() {
  const { user } = useAuth();
  const { data: progress, isLoading } = useGetMyProgress();

  const levelIndex = LEVELS.indexOf(user?.currentLevel || "A1");
  const nextLevel = LEVELS[levelIndex + 1];
  const pointsPerLevel = 500;
  const levelProgress = ((user?.totalPoints || 0) % pointsPerLevel / pointsPerLevel) * 100;

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => <Card key={i} className="h-32 animate-pulse bg-secondary/50" />)}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-display">My Progress</h1>
        <p className="text-muted-foreground mt-1">Track your English learning journey.</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-white border-0">
          <CardContent className="p-5">
            <Star className="h-6 w-6 mb-2 text-yellow-300" />
            <div className="text-3xl font-bold font-display">{user?.totalPoints || 0}</div>
            <div className="text-white/70 text-sm">Total Points</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0">
          <CardContent className="p-5">
            <Flame className="h-6 w-6 mb-2" />
            <div className="text-3xl font-bold font-display">{user?.streak || 0}</div>
            <div className="text-white/70 text-sm">Day Streak</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <BookOpen className="h-6 w-6 mb-2 text-primary" />
            <div className="text-3xl font-bold font-display">{progress?.courseProgress?.length || 0}</div>
            <div className="text-muted-foreground text-sm">Courses</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <CheckCircle className="h-6 w-6 mb-2 text-green-600" />
            <div className="text-3xl font-bold font-display">
              {progress?.courseProgress?.reduce((acc, c) => acc + (c.completedLessons || 0), 0) || 0}
            </div>
            <div className="text-muted-foreground text-sm">Lessons Done</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Weekly Activity Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-accent" /> Weekly Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {progress?.weeklyActivity && progress.weeklyActivity.length > 0 ? (
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={progress.weeklyActivity}>
                      <defs>
                        <linearGradient id="prog" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tickFormatter={v => new Date(v).toLocaleDateString("en-US", { weekday: "short" })} />
                      <YAxis axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15)" }} />
                      <Area type="monotone" dataKey="pointsEarned" stroke="hsl(var(--accent))" strokeWidth={3} fill="url(#prog)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Zap className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p>Complete lessons to see your activity chart.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Course Progress */}
          <Card>
            <CardHeader>
              <CardTitle>Course Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {progress?.courseProgress?.map(course => (
                <div key={course.courseId}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-semibold text-foreground">{course.courseTitle}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{course.completedLessons}/{course.totalLessons} lessons</span>
                    </div>
                    <span className="text-sm font-bold text-primary">{Math.round(course.percentage)}%</span>
                  </div>
                  <div className="h-3 bg-secondary rounded-full overflow-hidden border border-border/50">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-1000"
                      style={{ width: `${course.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
              {(!progress?.courseProgress || progress.courseProgress.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>Enroll in a course to track your progress.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          {/* Level Progress */}
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-primary to-primary/80 p-6 text-center text-white">
              <div className="w-20 h-20 mx-auto bg-white/20 rounded-full flex items-center justify-center mb-3 border-4 border-white/30">
                <span className="text-3xl font-bold font-display">{user?.currentLevel || "A1"}</span>
              </div>
              <h3 className="text-lg font-bold">Current Level</h3>
              <p className="text-white/70 text-sm">{user?.totalPoints || 0} total points</p>
            </div>
            {nextLevel && (
              <CardContent className="p-5">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium">{user?.currentLevel}</span>
                  <span className="text-muted-foreground">→ {nextLevel}</span>
                </div>
                <Progress value={levelProgress} className="h-3" />
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  {pointsPerLevel - ((user?.totalPoints || 0) % pointsPerLevel)} more points to {nextLevel}
                </p>
              </CardContent>
            )}
          </Card>

          {/* Skill Radar */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Skills Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={SKILL_DATA}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Radar dataKey="level" stroke="hsl(var(--accent))" fill="hsl(var(--accent))" fillOpacity={0.2} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Badges */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Achievements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {BADGES.map(badge => (
                  <div key={badge.id} title={badge.description} className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${badge.earned ? 'bg-yellow-50 border-yellow-200' : 'bg-secondary/50 border-border opacity-50 grayscale'}`}>
                    <span className="text-2xl">{badge.icon}</span>
                    <span className="text-xs font-medium text-center leading-tight">{badge.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
