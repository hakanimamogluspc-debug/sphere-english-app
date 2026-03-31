import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "./hooks/use-auth";
import "./lib/fetch-interceptor";

import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import Dashboard from "./pages/dashboard";
import CourseList from "./pages/courses/CourseList";
import CourseDetail from "./pages/courses/CourseDetail";
import AdminUsers from "./pages/admin/Users";
import AdminCourses from "./pages/admin/Courses";
import Announcements from "./pages/admin/Announcements";
import LiveClasses from "./pages/live-classes/LiveClasses";
import Quizzes from "./pages/quizzes/Quizzes";
import ProgressPage from "./pages/progress/Progress";
import Leaderboard from "./pages/leaderboard/Leaderboard";
import Certificates from "./pages/certificates/Certificates";
import Messages from "./pages/messages/Messages";
import Profile from "./pages/profile/Profile";
import TeacherCourses from "./pages/teacher/TeacherCourses";
import TeacherStudents from "./pages/teacher/TeacherStudents";
import TeacherProgress from "./pages/teacher/TeacherProgress";
import TeacherQuizzes from "./pages/teacher/TeacherQuizzes";
import TeacherSpeakingClub from "./pages/teacher/TeacherSpeakingClub";
import TeacherMessages from "./pages/teacher/TeacherMessages";
import TeacherLiveClasses from "./pages/teacher/TeacherLiveClasses";
import TeacherMaterials from "./pages/teacher/TeacherMaterials";
import AdminCompanies from "./pages/admin/Companies";
import AdminGroups from "./pages/admin/Groups";
import AdminTeachers from "./pages/admin/Teachers";
import AdminLiveClasses from "./pages/admin/AdminLiveClasses";
import AdminMaterials from "./pages/admin/AdminMaterials";
import AdminSpeakingClub from "./pages/admin/SpeakingClub";
import AdminMarketing from "./pages/admin/Marketing";
import CorporateDashboard from "./pages/corporate/CorporateDashboard";
import CorporateStudents from "./pages/corporate/CorporateStudents";
import CorporateReports from "./pages/corporate/CorporateReports";
import StudentSpeakingClub from "./pages/student/StudentSpeakingClub";
import StudentMaterials from "./pages/student/StudentMaterials";
import Forum from "./pages/student/Forum";
import PronunciationCoach from "./pages/student/PronunciationCoach";
import WritingCoach from "./pages/student/WritingCoach";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
  }
});

function ProtectedRoute({ component: Component, allowedRoles }: { component: any, allowedRoles?: string[] }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  
  if (isLoading) return (
    <div className="h-screen w-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full" />
        <p className="text-muted-foreground text-sm font-medium">Loading...</p>
      </div>
    </div>
  );
  if (!isAuthenticated) return <Redirect to="/login" />;
  if (allowedRoles && user && !allowedRoles.includes(user.role)) return <Redirect to="/dashboard" />;
  
  return <Component />;
}

function LayoutWrapper({ component: Component, allowedRoles }: { component: any, allowedRoles?: string[] }) {
  return (
    <ProtectedRoute 
      allowedRoles={allowedRoles}
      component={() => (
        <DashboardLayout>
          <Component />
        </DashboardLayout>
      )} 
    />
  );
}

function Router() {
  const { isAuthenticated, user } = useAuth();
  const [location] = useLocation();

  if (isAuthenticated && location === "/") {
    if (user?.role === "corporate") return <Redirect to="/corporate/dashboard" />;
    return <Redirect to="/dashboard" />;
  }

  return (
    <Switch>
      {/* Public */}
      <Route path="/"><Redirect to="/login" /></Route>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />

      {/* Common Protected */}
      <Route path="/dashboard"><LayoutWrapper component={Dashboard} /></Route>
      <Route path="/messages"><LayoutWrapper component={Messages} /></Route>
      <Route path="/profile"><LayoutWrapper component={Profile} /></Route>

      {/* Student Routes */}
      <Route path="/courses"><LayoutWrapper component={CourseList} /></Route>
      <Route path="/courses/:id"><LayoutWrapper component={CourseDetail} /></Route>
      <Route path="/progress"><LayoutWrapper component={ProgressPage} /></Route>
      <Route path="/live-classes"><LayoutWrapper component={LiveClasses} /></Route>
      <Route path="/quizzes"><LayoutWrapper component={Quizzes} /></Route>
      <Route path="/leaderboard"><LayoutWrapper component={Leaderboard} /></Route>
      <Route path="/certificates"><LayoutWrapper component={Certificates} /></Route>
      <Route path="/student/speaking-club"><LayoutWrapper component={StudentSpeakingClub} allowedRoles={['student']} /></Route>
      <Route path="/student/materials"><LayoutWrapper component={StudentMaterials} allowedRoles={['student']} /></Route>
      <Route path="/student/pronunciation-coach"><LayoutWrapper component={PronunciationCoach} allowedRoles={['student']} /></Route>
      <Route path="/student/writing-coach"><LayoutWrapper component={WritingCoach} allowedRoles={['student']} /></Route>
      <Route path="/forum"><LayoutWrapper component={Forum} /></Route>

      {/* Teacher Routes */}
      <Route path="/teacher/courses"><LayoutWrapper component={TeacherCourses} allowedRoles={['teacher', 'admin']} /></Route>
      <Route path="/teacher/live-classes"><LayoutWrapper component={TeacherLiveClasses} allowedRoles={['teacher', 'admin']} /></Route>
      <Route path="/teacher/materials"><LayoutWrapper component={TeacherMaterials} allowedRoles={['teacher', 'admin']} /></Route>
      <Route path="/teacher/students"><LayoutWrapper component={TeacherStudents} allowedRoles={['teacher', 'admin']} /></Route>
      <Route path="/teacher/progress"><LayoutWrapper component={TeacherProgress} allowedRoles={['teacher', 'admin']} /></Route>
      <Route path="/teacher/quizzes"><LayoutWrapper component={TeacherQuizzes} allowedRoles={['teacher', 'admin']} /></Route>
      <Route path="/teacher/speaking-club"><LayoutWrapper component={TeacherSpeakingClub} allowedRoles={['teacher', 'admin']} /></Route>
      <Route path="/teacher/messages"><LayoutWrapper component={TeacherMessages} allowedRoles={['teacher', 'admin']} /></Route>

      {/* Admin Routes */}
      <Route path="/admin/companies"><LayoutWrapper component={AdminCompanies} allowedRoles={['admin']} /></Route>
      <Route path="/admin/users"><LayoutWrapper component={AdminUsers} allowedRoles={['admin']} /></Route>
      <Route path="/admin/teachers"><LayoutWrapper component={AdminTeachers} allowedRoles={['admin']} /></Route>
      <Route path="/admin/groups"><LayoutWrapper component={AdminGroups} allowedRoles={['admin']} /></Route>
      <Route path="/admin/courses"><LayoutWrapper component={AdminCourses} allowedRoles={['admin']} /></Route>
      <Route path="/admin/live-classes"><LayoutWrapper component={AdminLiveClasses} allowedRoles={['admin']} /></Route>
      <Route path="/admin/materials"><LayoutWrapper component={AdminMaterials} allowedRoles={['admin']} /></Route>
      <Route path="/admin/speaking-club"><LayoutWrapper component={AdminSpeakingClub} allowedRoles={['admin']} /></Route>
      <Route path="/admin/announcements"><LayoutWrapper component={Announcements} allowedRoles={['admin']} /></Route>
      <Route path="/admin/reports"><LayoutWrapper component={ProgressPage} allowedRoles={['admin']} /></Route>
      <Route path="/admin/marketing"><LayoutWrapper component={AdminMarketing} allowedRoles={['admin']} /></Route>

      {/* Corporate Routes */}
      <Route path="/corporate/dashboard"><LayoutWrapper component={CorporateDashboard} allowedRoles={['corporate', 'admin']} /></Route>
      <Route path="/corporate/students"><LayoutWrapper component={CorporateStudents} allowedRoles={['corporate', 'admin']} /></Route>
      <Route path="/corporate/reports"><LayoutWrapper component={CorporateReports} allowedRoles={['corporate', 'admin']} /></Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
