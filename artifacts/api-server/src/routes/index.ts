import { Router, type IRouter } from "express";
import healthRouter from "./health";
import apiSpecRouter from "./api-spec";
import authRouter from "./auth";
import usersRouter from "./users";
import coursesRouter from "./courses";
import modulesRouter from "./modules";
import lessonsRouter from "./lessons";
import liveClassesRouter from "./live-classes";
import quizzesRouter from "./quizzes";
import progressRouter from "./progress";
import certificatesRouter from "./certificates";
import messagesRouter from "./messages";
import leaderboardRouter from "./leaderboard";
import dashboardRouter from "./dashboard";
import corporateRouter from "./corporate";
import adminCompaniesRouter from "./admin-companies";
import adminGroupsRouter from "./admin-groups";
import adminSpeakingClubsRouter from "./admin-speaking-clubs";
import adminAnalyticsRouter from "./admin-analytics";
import contentEngineRouter from "./content-engine";
import teacherRouter from "./teacher";
import quizImportRouter from "./quiz-import";
import studentRouter from "./student";
import forumRouter from "./forum";
import materialsRouter from "./materials";
import pronunciationRouter from "./pronunciation";
import writingRouter from "./writing";
import marketingRouter from "./marketing";
import outreachRouter from "./outreach";
import chatbotRouter from "./chatbot";
import chatbotEmbedRouter from "./chatbot-embed";
import activityRouter from "./activity";
import featureSettingsRouter from "./feature-settings";
import vocabGameRouter from "./vocab-game";
import grammarCoachRouter from "./grammar-coach";
import placementTestRouter from "./placement-test";
import simulationRouter from "./simulation";
import presenceRouter from "./presence";
import notificationsRouter from "./notifications";
import interviewRouter from "./interview";
import presentationRouter from "./presentation";
import aiQuizRouter from "./ai-quiz";
import tutorRouter from "./tutor";
import learningPathRouter from "./learning-path";
import corporateAiReportRouter from "./corporate-ai-report";
import levelExamsRouter from "./level-exams";
import subscriptionRouter from "./subscription";
import adminSubscriptionsRouter from "./admin-subscriptions";
import paymentRouter from "./payment";
import internalPaymentRouter from "./internal-payment";
import teacherApplicationsRouter from "./teacher-applications";
import ebooksRouter from "./ebooks";
import adminEbooksRouter from "./admin-ebooks";
import adminEbookPurchasesRouter from "./admin-ebook-purchases";
import ebookPurchaseRouter from "./ebook-purchase";
import cartRouter from "./cart";
import scenesRouter from "./scenes";
import webAnalyticsRouter from "./web-analytics";
import accountSetupRouter from "./account-setup";
import instagramWebhookRouter from "./instagram-webhook";
import adminInstagramBotRouter from "./admin-instagram-bot";
import whatsappWebhookRouter from "./whatsapp-webhook";
import adminWhatsappBotRouter from "./admin-whatsapp-bot";
import affiliateRouter from "./affiliate";
import adminAffiliatesRouter from "./admin-affiliates";
import couponsRouter from "./coupons";
import adminBackupsRouter from "./admin-backups";
import adminSmokeTestsRouter from "./admin-smoke-tests";
import adminNotificationsTestRouter from "./admin-notifications-test";
import adminEbookHealthRouter from "./admin-ebook-health";
import bundlesRouter from "./bundles";
import adminBundlesRouter from "./admin-bundles";
import adminInvoicesRouter from "./admin-invoices";
import metaCatalogFeedRouter from "./meta-catalog-feed";
import adminMailTemplatesRouter from "./admin-mail-templates";
import mailAssetsRouter from "./mail-assets";
import demoRouter from "./demo";
import adminContentArticlesRouter from "./admin-content-articles";
import contentArticlesRouter from "./content-articles";
import myReportRouter from "./my-report";
import dictionaryRouter from "./dictionary";
import adminScenesRouter from "./admin-scenes";
import adminCareerRouter from "./admin-career";
import { requireSubscription } from "../middlewares/require-subscription";
import { authMiddleware } from "../middlewares/auth";

const proGuard = [authMiddleware, requireSubscription];

const router: IRouter = Router();

router.use(healthRouter);
router.use(apiSpecRouter);
router.use(authRouter);
router.use(corporateRouter);
router.use(adminCompaniesRouter);
router.use(adminGroupsRouter);
router.use(adminSpeakingClubsRouter);
router.use(adminAnalyticsRouter);
router.use(contentEngineRouter);
router.use(teacherRouter);
router.use(quizImportRouter);
router.use(studentRouter);
router.use(forumRouter);
router.use(usersRouter);
router.use(coursesRouter);
router.use(modulesRouter);
router.use(lessonsRouter);
router.use(liveClassesRouter);
router.use(quizzesRouter);
router.use(progressRouter);
router.use(certificatesRouter);
router.use(messagesRouter);
router.use(leaderboardRouter);
router.use(dashboardRouter);
router.use(materialsRouter);
router.use(subscriptionRouter);
router.use(adminSubscriptionsRouter);
router.use("/payment", paymentRouter);
router.use(internalPaymentRouter);
router.use(teacherApplicationsRouter);
// ebookPurchaseRouter'ı ebooksRouter'dan ÖNCE mount et — /ebooks/download
// path'i ebooksRouter'ın /ebooks/:slug route'una yakalanmasın diye
router.use(ebookPurchaseRouter);
// Cart router — /internal/cart/pre-create, /internal/cart/activate, /order/:orderId
// ebooksRouter'dan ÖNCE mount — /order/:orderId path'i kimseye yakalanmasın
router.use(cartRouter);
router.use(ebooksRouter);
// Health check + smoke + bildirim test gibi spesifik admin endpoint'leri,
// adminEbooks'tan ÖNCE mount edilmeli — :id parametresi non-numeric path'leri yakalar
router.use(adminEbookHealthRouter);
// Bundles — /bundles/featured spesifik route + /admin/bundles CRUD
// bundlesRouter'ı ebooksRouter'dan ÖNCE mount edelim ki /bundles/:slug slug
// route'una yakalanmasın diye reserved guard'ı zaten var ama order da önemli
router.use(bundlesRouter);
router.use(adminBundlesRouter);
router.use(adminInvoicesRouter);
router.use(metaCatalogFeedRouter);
router.use(adminMailTemplatesRouter);
router.use(mailAssetsRouter);
router.use(demoRouter);
router.use(adminContentArticlesRouter);
router.use(contentArticlesRouter);
router.use(myReportRouter);
router.use(dictionaryRouter);
router.use(adminScenesRouter);
router.use(adminCareerRouter);
router.use(adminEbooksRouter);
router.use(adminEbookPurchasesRouter);
router.use(webAnalyticsRouter);
router.use(accountSetupRouter);
router.use(instagramWebhookRouter);
router.use(adminInstagramBotRouter);
router.use(whatsappWebhookRouter);
router.use(adminWhatsappBotRouter);
router.use(affiliateRouter);
router.use(adminAffiliatesRouter);
router.use(couponsRouter);
router.use(adminBackupsRouter);
router.use(adminSmokeTestsRouter);
router.use(adminNotificationsTestRouter);
router.use(adminEbookHealthRouter);
// PUBLIC (kendi auth'unu yapan) router'lar — proGuard'dan ÖNCE mount et
// Çünkü router.use(proGuard, X) path-less mount'tur ve middleware HER request'te
// çalışır; chatbot /chat'e ulaşmadan önce requireSubscription 401 atıyordu.
router.use(marketingRouter);
router.use(outreachRouter);
router.use(chatbotRouter);
router.use(chatbotEmbedRouter);
// Speaking role-play sahneleri — authMiddleware endpoint bazında + free tier quota
router.use(scenesRouter);
router.use(activityRouter);
router.use(featureSettingsRouter);
router.use(placementTestRouter);
router.use(presenceRouter);
router.use(notificationsRouter);
router.use(corporateAiReportRouter);
router.use(levelExamsRouter);

// PRO (login + abonelik) router'lar — EN SONA, path-less proGuard mount'ları
router.use(proGuard, pronunciationRouter);
router.use(proGuard, writingRouter);
router.use(proGuard, vocabGameRouter);
router.use(proGuard, grammarCoachRouter);
router.use(proGuard, simulationRouter);
router.use(proGuard, interviewRouter);
router.use(proGuard, presentationRouter);
router.use(proGuard, aiQuizRouter);
router.use(proGuard, tutorRouter);
router.use(proGuard, learningPathRouter);

export default router;
