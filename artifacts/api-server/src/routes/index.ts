import { Router, type IRouter } from "express";
import healthRouter from "./health";
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

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(corporateRouter);
router.use(adminCompaniesRouter);
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

export default router;
