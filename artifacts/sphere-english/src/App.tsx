import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "./hooks/use-auth";
import "./lib/fetch-interceptor";

import Landing from "./pages/public/Landing";
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
import CorporateDashboard from "./pages/corporate/CorporateDashboard";
import CorporateStudents from "./pages/corporate/CorporateStudents";
import CorporateReports from "./pages/corporate/CorporateReports";

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
      <Route path="/" component={Landing} />
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

      {/* Teacher Routes */}
      <Route path="/teacher/courses"><LayoutWrapper component={TeacherCourses} allowedRoles={['teacher', 'admin']} /></Route>
      <Route path="/teacher/live-classes"><LayoutWrapper component={LiveClasses} allowedRoles={['teacher', 'admin']} /></Route>
      <Route path="/teacher/students"><LayoutWrapper component={AdminUsers} allowedRoles={['teacher', 'admin']} /></Route>
      <Route path="/teacher/quizzes"><LayoutWrapper component={Quizzes} allowedRoles={['teacher', 'admin']} /></Route>

      {/* Admin Routes */}
      <Route path="/admin/users"><LayoutWrapper component={AdminUsers} allowedRoles={['admin']} /></Route>
      <Route path="/admin/courses"><LayoutWrapper component={AdminCourses} allowedRoles={['admin']} /></Route>
      <Route path="/admin/announcements"><LayoutWrapper component={Announcements} allowedRoles={['admin']} /></Route>
      <Route path="/admin/reports"><LayoutWrapper component={ProgressPage} allowedRoles={['admin']} /></Route>

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
