import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./hooks/use-auth";
import "./lib/fetch-interceptor";
import { useEffect, lazy, Suspense, type ReactNode, type ComponentType } from "react";
import { API } from "@/lib/api-url";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { SubscriptionProvider } from "./lib/subscription-context";
import { withProGate } from "./components/subscription/ProGate";
import ErrorBoundary from "./components/ErrorBoundary";
import { useRouteTitle } from "./hooks/useRouteTitle";

// ─── Lazy-loaded pages — bundle başına bir chunk, ilk yüklemeyi hızlandırır ──
const NotFound        = lazy(() => import("@/pages/not-found"));
const Login           = lazy(() => import("./pages/auth/Login"));
const Register        = lazy(() => import("./pages/auth/Register"));
const SetupPassword   = lazy(() => import("./pages/SetupPassword"));
const ForgotPassword  = lazy(() => import("./pages/ForgotPassword"));
const Dashboard       = lazy(() => import("./pages/dashboard"));
const CourseList      = lazy(() => import("./pages/courses/CourseList"));
const CourseDetail    = lazy(() => import("./pages/courses/CourseDetail"));
const LessonPlayer    = lazy(() => import("./pages/courses/LessonPlayer"));

// Admin
const AdminUsers          = lazy(() => import("./pages/admin/Users"));
const AdminAnalytics      = lazy(() => import("./pages/admin/Analytics"));
const AdminContentEngine  = lazy(() => import("./pages/admin/ContentEngine"));
const AdminTeacherApps    = lazy(() => import("./pages/admin/TeacherApplications"));
const AdminEbooks         = lazy(() => import("./pages/admin/AdminEbooks"));
const AdminEbookForm      = lazy(() => import("./pages/admin/AdminEbookForm"));
const AdminEbookPurchases = lazy(() => import("./pages/admin/AdminEbookPurchases"));
const AdminCourses        = lazy(() => import("./pages/admin/Courses"));
const Announcements       = lazy(() => import("./pages/admin/Announcements"));
const AdminCompanies      = lazy(() => import("./pages/admin/Companies"));
const AdminGroups         = lazy(() => import("./pages/admin/Groups"));
const AdminTeachers       = lazy(() => import("./pages/admin/Teachers"));
const AdminStudents       = lazy(() => import("./pages/admin/Students"));
const AdminLiveClasses    = lazy(() => import("./pages/admin/AdminLiveClasses"));
const AdminMaterials      = lazy(() => import("./pages/admin/AdminMaterials"));
const AdminSpeakingClub   = lazy(() => import("./pages/admin/SpeakingClub"));
const AdminMarketing      = lazy(() => import("./pages/admin/Marketing"));
const WebAnalytics        = lazy(() => import("./pages/admin/WebAnalytics"));
const AdminInstagramBot   = lazy(() => import("./pages/admin/AdminInstagramBot"));
const AdminWhatsAppBot    = lazy(() => import("./pages/admin/AdminWhatsAppBot"));
const AdminAffiliates     = lazy(() => import("./pages/admin/AdminAffiliates"));
const AdminCoupons        = lazy(() => import("./pages/admin/AdminCoupons"));
const AdminBackups        = lazy(() => import("./pages/admin/AdminBackups"));
const AdminSmokeTests     = lazy(() => import("./pages/admin/AdminSmokeTests"));
const AdminBundles        = lazy(() => import("./pages/admin/AdminBundles"));
const Partner             = lazy(() => import("./pages/Partner"));
const PartnerApply        = lazy(() => import("./pages/PartnerApply"));
const AdminChatbotFaqs    = lazy(() => import("./pages/admin/ChatbotFaqs"));
const MebReport           = lazy(() => import("./pages/admin/MebReport"));
const AdminModules        = lazy(() => import("./pages/admin/AdminModules"));
const AdminSubscriptions  = lazy(() => import("./pages/admin/AdminSubscriptions"));

// Common
const LiveClasses   = lazy(() => import("./pages/live-classes/LiveClasses"));
const Quizzes       = lazy(() => import("./pages/quizzes/Quizzes"));
const ProgressPage  = lazy(() => import("./pages/progress/Progress"));
const Leaderboard   = lazy(() => import("./pages/leaderboard/Leaderboard"));
const Certificates  = lazy(() => import("./pages/certificates/Certificates"));
const Messages      = lazy(() => import("./pages/messages/Messages"));
const Profile       = lazy(() => import("./pages/profile/Profile"));

// Teacher
const TeacherCourses        = lazy(() => import("./pages/teacher/TeacherCourses"));
const TeacherStudents       = lazy(() => import("./pages/teacher/TeacherStudents"));
const TeacherProgress       = lazy(() => import("./pages/teacher/TeacherProgress"));
const TeacherQuizzes        = lazy(() => import("./pages/teacher/TeacherQuizzes"));
const TeacherSpeakingClub   = lazy(() => import("./pages/teacher/TeacherSpeakingClub"));
const TeacherMessages       = lazy(() => import("./pages/teacher/TeacherMessages"));
const TeacherLiveClasses    = lazy(() => import("./pages/teacher/TeacherLiveClasses"));
const TeacherMaterials      = lazy(() => import("./pages/teacher/TeacherMaterials"));

// Corporate
const CorporateDashboard  = lazy(() => import("./pages/corporate/CorporateDashboard"));
const CorporateStudents   = lazy(() => import("./pages/corporate/CorporateStudents"));
const CorporateReports    = lazy(() => import("./pages/corporate/CorporateReports"));
const CorporateAIReport   = lazy(() => import("./pages/corporate/CorporateAIReport"));

// Student
const LevelExams              = lazy(() => import("./pages/student/LevelExams"));
const LevelExamTaking         = lazy(() => import("./pages/student/LevelExamTaking"));
const StudentSpeakingClub     = lazy(() => import("./pages/student/StudentSpeakingClub"));
const StudentMaterials        = lazy(() => import("./pages/student/StudentMaterials"));
const Forum                   = lazy(() => import("./pages/student/Forum"));
const PronunciationCoach      = lazy(() => import("./pages/student/PronunciationCoach"));
const WritingCoach            = lazy(() => import("./pages/student/WritingCoach"));
const VocabGame               = lazy(() => import("./pages/student/VocabGame"));
const GrammarCoach            = lazy(() => import("./pages/student/GrammarCoach"));
const SimulationMode          = lazy(() => import("./pages/student/SimulationMode"));
const StudentSettings         = lazy(() => import("./pages/student/StudentSettings"));
const InterviewSimulator      = lazy(() => import("./pages/student/InterviewSimulator"));
const PresentationSimulator   = lazy(() => import("./pages/student/PresentationSimulator"));
const AIQuizGenerator         = lazy(() => import("./pages/student/AIQuizGenerator"));
const AITutor                 = lazy(() => import("./pages/student/AITutor"));
const LearningPath            = lazy(() => import("./pages/student/LearningPath"));
const SpeakingScenes          = lazy(() => import("./pages/student/SpeakingScenes"));
const SpeakingSceneRunner     = lazy(() => import("./pages/student/SpeakingSceneRunner"));
const AIStudio                = lazy(() => import("./pages/AIStudio"));
const PlacementTest           = lazy(() => import("./pages/PlacementTest"));
const Subscription            = lazy(() => import("./pages/student/Subscription"));

// Pro gate sarmalanmış versiyonlar — withProGate plain ComponentType bekliyor
const PronunciationCoachPro    = withProGate(PronunciationCoach    as ComponentType<any>, "student-pronunciation-coach", "Telaffuz Koçu");
const WritingCoachPro          = withProGate(WritingCoach          as ComponentType<any>, "student-writing-coach",        "Yazma Koçu");
const VocabGamePro             = withProGate(VocabGame             as ComponentType<any>, "student-vocab-game",           "Kelime Oyunu");
const GrammarCoachPro          = withProGate(GrammarCoach          as ComponentType<any>, "student-grammar-coach",        "Dilbilgisi Koçu");
const SimulationModePro        = withProGate(SimulationMode        as ComponentType<any>, "student-simulation-mode",      "İş Senaryoları");
const InterviewSimulatorPro    = withProGate(InterviewSimulator    as ComponentType<any>, "student-interview-sim",        "Mülakat Simülatörü");
const PresentationSimulatorPro = withProGate(PresentationSimulator as ComponentType<any>, "student-presentation-sim",     "Sunum Simülatörü");
const AIQuizGeneratorPro       = withProGate(AIQuizGenerator       as ComponentType<any>, "student-ai-quiz",              "Akıllı Quiz Üretici");
const AITutorPro               = withProGate(AITutor               as ComponentType<any>, "student-ai-tutor",             "Kişisel AI Öğretmen");
const LearningPathPro          = withProGate(LearningPath          as ComponentType<any>, "student-learning-path",        "Adaptif Öğrenme Yolu");

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
  }
});

function PageLoader() {
  return (
    <div className="h-screen w-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full" />
        <p className="text-muted-foreground text-sm font-medium">Loading...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ component: Component, allowedRoles, skipPlacementCheck }: { component: any, allowedRoles?: string[], skipPlacementCheck?: boolean }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [location] = useLocation();

  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return <Redirect to="/login" />;
  if (allowedRoles && user && !allowedRoles.includes(user.role)) return <Redirect to="/dashboard" />;

  if (
    !skipPlacementCheck &&
    user?.role === "student" &&
    !user?.company &&
    user?.placementTestCompleted === false &&
    location !== "/placement-test"
  ) {
    return <Redirect to="/placement-test" />;
  }

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

function PlacementTestRoute() {
  const { user, isLoading, isAuthenticated } = useAuth();
  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <PlacementTest />;
}

function Router() {
  const { isAuthenticated, user } = useAuth();
  const [location] = useLocation();

  // Browser sekme başlığını route'a göre güncel tut
  useRouteTitle();

  if (isAuthenticated && location === "/") {
    if (user?.role === "corporate") return <Redirect to="/corporate/dashboard" />;
    if (user?.role === "student" && !user?.company && user?.placementTestCompleted === false) return <Redirect to="/placement-test" />;
    return <Redirect to="/dashboard" />;
  }

  // Direct URL session-loss fix: placement test tamamlanmamış öğrenci
  // farklı sayfaya gitmeye çalışırsa /placement-test'e yönlendir (login'e değil)
  if (
    isAuthenticated &&
    user?.role === "student" &&
    !user?.company &&
    user?.placementTestCompleted === false &&
    location !== "/placement-test" &&
    !location.startsWith("/student/level-exams") &&
    !location.startsWith("/profile") &&
    !location.startsWith("/logout")
  ) {
    return <Redirect to="/placement-test" />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        {/* Public */}
        <Route path="/"><Redirect to="/login" /></Route>
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/sifre-belirle" component={SetupPassword} />
        <Route path="/sifremi-unuttum" component={ForgotPassword} />
        <Route path="/ai-studio" component={AIStudio} />
        <Route path="/placement-test" component={PlacementTestRoute} />

        {/* Common Protected */}
        <Route path="/dashboard"><LayoutWrapper component={Dashboard} /></Route>
        <Route path="/messages"><LayoutWrapper component={Messages} /></Route>
        <Route path="/profile"><LayoutWrapper component={Profile} /></Route>

        {/* Student Routes */}
        <Route path="/courses"><LayoutWrapper component={CourseList} /></Route>
        <Route path="/courses/:courseId/lessons/:lessonId"><LayoutWrapper component={LessonPlayer} /></Route>
        <Route path="/courses/:id"><LayoutWrapper component={CourseDetail} /></Route>
        <Route path="/progress"><LayoutWrapper component={ProgressPage} /></Route>
        <Route path="/live-classes"><LayoutWrapper component={LiveClasses} /></Route>
        <Route path="/quizzes"><LayoutWrapper component={Quizzes} /></Route>
        <Route path="/leaderboard"><LayoutWrapper component={Leaderboard} /></Route>
        <Route path="/certificates"><LayoutWrapper component={Certificates} /></Route>
        <Route path="/student/speaking-club"><LayoutWrapper component={StudentSpeakingClub} allowedRoles={['student']} /></Route>
        <Route path="/student/materials"><LayoutWrapper component={StudentMaterials} allowedRoles={['student']} /></Route>
        <Route path="/student/subscription"><LayoutWrapper component={Subscription} allowedRoles={['student', 'admin']} /></Route>
        <Route path="/student/pronunciation-coach"><LayoutWrapper component={PronunciationCoachPro} allowedRoles={['student', 'admin']} /></Route>
        <Route path="/student/writing-coach"><LayoutWrapper component={WritingCoachPro} allowedRoles={['student', 'admin']} /></Route>
        <Route path="/student/vocab-game"><LayoutWrapper component={VocabGamePro} allowedRoles={['student', 'admin']} /></Route>
        <Route path="/student/grammar-coach"><LayoutWrapper component={GrammarCoachPro} allowedRoles={['student', 'admin']} /></Route>
        <Route path="/student/simulation-mode"><LayoutWrapper component={SimulationModePro} allowedRoles={['student', 'admin']} /></Route>
        <Route path="/student/settings"><LayoutWrapper component={StudentSettings} allowedRoles={['student']} /></Route>
        <Route path="/student/interview-sim"><LayoutWrapper component={InterviewSimulatorPro} allowedRoles={['student', 'admin']} /></Route>
        <Route path="/student/presentation-sim"><LayoutWrapper component={PresentationSimulatorPro} allowedRoles={['student', 'admin']} /></Route>
        <Route path="/student/ai-quiz"><LayoutWrapper component={AIQuizGeneratorPro} allowedRoles={['student', 'admin']} /></Route>
        <Route path="/student/ai-tutor"><LayoutWrapper component={AITutorPro} allowedRoles={['student', 'admin']} /></Route>
        <Route path="/student/learning-path"><LayoutWrapper component={LearningPathPro} allowedRoles={['student', 'admin']} /></Route>
        {/* Speaking role-play sahneleri — free tier de erişebilir (endpoint içinde quota kontrolü) */}
        <Route path="/student/speaking-scenes"><LayoutWrapper component={SpeakingScenes} allowedRoles={['student', 'admin']} /></Route>
        <Route path="/student/speaking-scenes/:slug"><LayoutWrapper component={SpeakingSceneRunner} allowedRoles={['student', 'admin']} /></Route>
        <Route path="/student/level-exams"><LayoutWrapper component={LevelExams} allowedRoles={['student', 'admin']} /></Route>
        <Route path="/student/level-exams/:level"><LayoutWrapper component={LevelExamTaking} allowedRoles={['student', 'admin']} /></Route>
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
        <Route path="/admin/analytics"><LayoutWrapper component={AdminAnalytics} allowedRoles={['admin']} /></Route>
        <Route path="/admin/content-engine"><LayoutWrapper component={AdminContentEngine} allowedRoles={['admin']} /></Route>
        <Route path="/admin/teacher-applications"><LayoutWrapper component={AdminTeacherApps} allowedRoles={['admin']} /></Route>
        <Route path="/admin/ebooks"><LayoutWrapper component={AdminEbooks} allowedRoles={['admin']} /></Route>
        <Route path="/admin/ebooks/yeni"><LayoutWrapper component={AdminEbookForm} allowedRoles={['admin']} /></Route>
        <Route path="/admin/ebook-purchases"><LayoutWrapper component={AdminEbookPurchases} allowedRoles={['admin']} /></Route>
        <Route path="/admin/ebooks/:id"><LayoutWrapper component={AdminEbookForm} allowedRoles={['admin']} /></Route>
        <Route path="/admin/teachers"><LayoutWrapper component={AdminTeachers} allowedRoles={['admin']} /></Route>
        <Route path="/admin/students"><LayoutWrapper component={AdminStudents} allowedRoles={['admin']} /></Route>
        <Route path="/admin/groups"><LayoutWrapper component={AdminGroups} allowedRoles={['admin']} /></Route>
        <Route path="/admin/courses"><LayoutWrapper component={AdminCourses} allowedRoles={['admin']} /></Route>
        <Route path="/admin/live-classes"><LayoutWrapper component={AdminLiveClasses} allowedRoles={['admin']} /></Route>
        <Route path="/admin/materials"><LayoutWrapper component={AdminMaterials} allowedRoles={['admin']} /></Route>
        <Route path="/admin/speaking-club"><LayoutWrapper component={AdminSpeakingClub} allowedRoles={['admin']} /></Route>
        <Route path="/admin/announcements"><LayoutWrapper component={Announcements} allowedRoles={['admin']} /></Route>
        <Route path="/admin/reports"><LayoutWrapper component={ProgressPage} allowedRoles={['admin']} /></Route>
        <Route path="/admin/meb-report"><LayoutWrapper component={MebReport} allowedRoles={['admin']} /></Route>
        <Route path="/admin/marketing"><LayoutWrapper component={AdminMarketing} allowedRoles={['admin']} /></Route>
        <Route path="/admin/web-analytics"><LayoutWrapper component={WebAnalytics} allowedRoles={['admin']} /></Route>
        <Route path="/admin/instagram-bot"><LayoutWrapper component={AdminInstagramBot} allowedRoles={['admin']} /></Route>
        <Route path="/admin/whatsapp-bot"><LayoutWrapper component={AdminWhatsAppBot} allowedRoles={['admin']} /></Route>
        <Route path="/admin/affiliates"><LayoutWrapper component={AdminAffiliates} allowedRoles={['admin']} /></Route>
        <Route path="/admin/coupons"><LayoutWrapper component={AdminCoupons} allowedRoles={['admin']} /></Route>
        <Route path="/admin/backups"><LayoutWrapper component={AdminBackups} allowedRoles={['admin']} /></Route>
        <Route path="/admin/smoke-tests"><LayoutWrapper component={AdminSmokeTests} allowedRoles={['admin']} /></Route>
        <Route path="/admin/bundles"><LayoutWrapper component={AdminBundles} allowedRoles={['admin']} /></Route>
        <Route path="/partner/apply"><LayoutWrapper component={PartnerApply} /></Route>
        <Route path="/partner"><LayoutWrapper component={Partner} /></Route>
        <Route path="/admin/chatbot"><LayoutWrapper component={AdminChatbotFaqs} allowedRoles={['admin']} /></Route>
        <Route path="/admin/modules"><LayoutWrapper component={AdminModules} allowedRoles={['admin']} /></Route>
        <Route path="/admin/subscriptions"><LayoutWrapper component={AdminSubscriptions} allowedRoles={['admin']} /></Route>

        {/* Corporate Routes */}
        <Route path="/corporate/dashboard"><LayoutWrapper component={CorporateDashboard} allowedRoles={['corporate', 'admin']} /></Route>
        <Route path="/corporate/students"><LayoutWrapper component={CorporateStudents} allowedRoles={['corporate', 'admin']} /></Route>
        <Route path="/corporate/reports"><LayoutWrapper component={CorporateReports} allowedRoles={['corporate', 'admin']} /></Route>
        <Route path="/corporate/ai-report"><LayoutWrapper component={CorporateAIReport} allowedRoles={['corporate', 'admin']} /></Route>

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function HeartbeatProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [location] = useLocation();

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const sendHeartbeat = () => {
      const token = localStorage.getItem("sphere_token");
      if (!token) return;
      fetch(`${API}/presence/heartbeat`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email,
          role: user.role,
          page: window.location.pathname,
        }),
      }).catch(() => {});
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 60_000);
    return () => clearInterval(interval);
  }, [isAuthenticated, user, location]);

  return <>{children}</>;
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthProvider>
              <SubscriptionProvider>
                <HeartbeatProvider>
                  <Router />
                </HeartbeatProvider>
              </SubscriptionProvider>
            </AuthProvider>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
