# Sphere English LMS

## Overview

Full-stack English Learning Management System (LMS) built as a pnpm monorepo. Features role-based dashboards for admin/teacher/student/corporate, course management with A1-C2 levels, live class scheduling, quizzes, progress tracking with gamification (points, streaks, badges), certificates with QR verification, messaging, leaderboards, a vocab game (Kelime Oyunu) with 407 words and AI-powered Turkish hints, and an AI Simulation Mode (İş Simülasyonu) with 12 sector-aware business coaches, voice-first conversation via Whisper + GPT-4o + TTS, real-time grammar/vocab analysis per turn, and a session report screen.

### Sphere AI Studio (8 features completed May 2026)
The full AI roadmap for personalized learning + corporate analytics is live, all powered by `gpt-4o-mini`:
- **T001 Telaffuz Koçu** — CEFR estimate + weak areas + recommendations after each pronunciation session.
- **T002 Smart Notifications** — Streak-risk, inactivity, level-up, new assessment triggers across email (Resend) + in-app bell.
- **T003 Mülakat Simülatörü** — Multi-turn job interview practice with role/company context and final report.
- **T004 Sunum Simülatörü** — Slide-deck-driven presentation practice with structured feedback.
- **T005 Akıllı Quiz Üretici** — `/student/ai-quiz`. AI generates personalized quizzes from a topic OR pasted text (vocab/grammar/comprehension; MC/TF/fill-blank). Final report includes CEFR-fit, category bars, weak areas, study plan, encouragement. Output strictly length-clipped before persisting.
- **T006 Kişisel AI Öğretmen** — `/student/ai-tutor`. ChatGPT-style Turkish English tutor with 6 focus areas, persistent memory (background fact extraction, max 25 facts), 20-message context window (DB-side ORDER BY desc + LIMIT — no full-history scan), auto-generated conversation titles.
- **T007 Adaptive Learning Path** — `/student/learning-path`. Aggregates the user's full activity snapshot (last 5 pronunciations, 3 interviews, 3 presentations, 5 quizzes, tutor memory) into a 4-week plan with 4–5 day-level steps per week, each linked to an in-app feature route. Step toggle, weekly progress bars, regenerate flow.
- **T008 Corporate AI Performans Raporu** — `/corporate/ai-report`. Manager dashboard aggregating cohort metrics across the company (CEFR distribution, 7d/30d active, avg streak/points, activity volumes, avg scores, top performers, top weak areas) — all activity queries windowed to last 90 days. Plus AI executive summary in Turkish with 3–5 insights and 3–5 manager recommendations. Authorization: `corporate` role bound to own `companyId`; `admin` may pass `?companyId=`.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: JWT (jsonwebtoken + bcryptjs)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Frontend**: React + Vite + shadcn/ui + TailwindCSS
- **State management**: TanStack React Query
- **Routing**: wouter
- **Charts**: Recharts
- **Animations**: Framer Motion
- **Build**: esbuild (CJS bundle)

## Structure

```text
workspace/
├── artifacts/
│   ├── api-server/          # Express API server (port 8080, proxied at /api)
│   ├── sphere-english/      # React + Vite frontend (previewPath: /)
│   └── mockup-sandbox/      # Component preview server
├── lib/
│   ├── api-spec/            # OpenAPI spec + Orval codegen config
│   ├── api-client-react/    # Generated React Query hooks from OpenAPI
│   ├── api-zod/             # Generated Zod schemas from OpenAPI
│   └── db/                  # Drizzle ORM schema + DB connection
└── scripts/                 # Utility scripts
```

## Production Deployment (Easypanel)

- **Platform**: Easypanel (Nixpacks build)
- **URL**: `https://sphere-english-sphere-english-app.svc7un.easypanel.host`
- **Target domain**: `app.sphereenglish.com` (DNS A record → `46.224.223.19`)
- **GitHub repo**: `github.com/hakanimamogluspc-debug/sphere-english-app` (branch: main)
- **Easypanel project**: `sphere-english` / service: `sphere-english-app`
- **Port**: 3000 (Traefik domain target must be set to 3000)
- **Database**: `postgres://postgres:***@sphere-english_sphere-db:5432/sphere-english?sslmode=disable`

### Easypanel Start Command (in Komut field):
```
/usr/local/bin/pnpm --filter @workspace/db push --force; node --enable-source-maps artifacts/api-server/dist/index.mjs
```
The server automatically seeds the database (admin/teacher/student accounts + courses) on first startup.

### Known Fixes Applied:
- Express 5 wildcard route: `"*"` → `"/{*splat}"` 
- DATABASE_URL is optional at startup (server doesn't crash without it)
- `drizzle.config.ts` uses relative schema path (no `__dirname`)
- Seed logic embedded in `artifacts/api-server/src/seed.ts`, called from `index.ts`

### Test Credentials:
- Admin: `admin@sphereenglish.com` / `admin123`
- Teacher: `sarah.johnson@sphereenglish.com` / `teacher123`
- Student: `alice@example.com` / `student123`

## Key Files

| File | Purpose |
|------|---------|
| `lib/api-spec/openapi.yaml` | Master OpenAPI spec (40+ endpoints) |
| `lib/db/src/schema/index.ts` | Database schema (14 tables) |
| `artifacts/api-server/src/routes/index.ts` | All Express route handlers |
| `artifacts/api-server/src/middlewares/auth.ts` | JWT auth middleware |
| `artifacts/sphere-english/src/App.tsx` | Frontend router with all routes |
| `artifacts/sphere-english/src/hooks/use-auth.tsx` | Auth context hook |
| `artifacts/sphere-english/src/components/layout/DashboardLayout.tsx` | Role-based sidebar |

## Database Schema (14 tables)

- `users` — auth, roles (admin/teacher/student), points, streak, level
- `courses` — A1-C2 English courses with pricing
- `modules` — course sections
- `lessons` — video/document/text lessons per module
- `enrollments` — student-course relationships
- `lesson_progress` — per-lesson completion tracking
- `live_classes` — scheduled live sessions (group/one-on-one)
- `live_class_attendance` — who attended which class
- `quizzes` — assessments with questions (multiple choice, true/false, fill-in-blank)
- `questions` — quiz questions with options and correct answers
- `quiz_attempts` — student quiz submissions and scores
- `certificates` — issued certificates with QR codes
- `messages` — student-teacher direct messaging
- `announcements` — platform-wide or role-targeted announcements

## Frontend Pages

### Public
- `/` — Landing page with hero, features, pricing
- `/login` — Login with JWT, stores token in localStorage
- `/register` — Registration form

### Student Routes
- `/dashboard` — Stats (points, streak, courses, classes), progress chart, recent activity, level display
- `/courses` — Course catalog with search and level filters
- `/courses/:id` — Course detail with curriculum accordion, enroll button
- `/live-classes` — Upcoming & past sessions, join/open meeting buttons
- `/quizzes` — Quiz list + interactive quiz taker with multiple question types
- `/progress` — Progress charts, skill radar, achievement badges, level XP bar
- `/leaderboard` — Top 3 podium + full rankings table with streaks
- `/certificates` — Certificate display with QR verification and download
- `/messages` — Real-time-style chat with conversation list + message view
- `/profile` — Profile edit form + stats display + security section

### Teacher Routes
- `/dashboard` — Quick stats + "Create Course" / "Schedule Class" actions
- `/teacher/courses` — Course management, create new courses
- `/teacher/live-classes` — Live session scheduling with modal form
- `/teacher/students` — **Own students only** (data isolation via group_members); group accordion, add/remove students, group-wide announcement broadcast
- `/teacher/progress` — Student progress tracker: quiz attempts, average scores, streak/points per student
- `/teacher/quizzes` — Quiz creator (multiple_choice/true_false/fill_blank), attempts viewer per quiz
- `/teacher/speaking-club` — View assigned Speaking Club events + full participant list modal
- `/messages` — Chat (send to any user); group announce via `/teacher/students`

### Admin Routes
- `/dashboard` — System overview (total users, courses, enrollments, certificates)
- `/admin/users` — User management table with role badges
- `/admin/courses` — Course management with active/inactive toggle and delete
- `/admin/announcements` — Post announcements with priority and audience targeting
- `/admin/groups` — Group/class management: create, assign teacher, CRUD
- `/admin/speaking-club` — Speaking Club event management: create, assign teacher, set capacity/level/link

## API Endpoints (40+)

- `POST /api/auth/register` — Register new user
- `POST /api/auth/login` — Login, returns JWT token
- `GET /api/auth/me` — Get current user profile
- `GET/POST /api/users` — List/create users (admin)
- `PATCH/DELETE /api/users/:id` — Update/delete user
- `GET/POST /api/courses` — List/create courses
- `GET /api/courses/my-courses` — Current user's courses
- `GET /api/courses/:id` — Course with modules and lessons
- `POST /api/courses/:id/enroll` — Enroll in course
- `POST /api/modules` — Create module
- `POST /api/lessons` — Create lesson
- `POST /api/lessons/:id/complete` — Mark lesson complete
- `GET /api/live-classes` — List live classes
- `POST /api/live-classes` — Create live class
- `POST /api/live-classes/:id/join` — Join live class
- `GET/POST /api/quizzes` — List/create quizzes
- `GET /api/quizzes/:id` — Get quiz with questions
- `POST /api/quizzes/:id/submit` — Submit quiz answers
- `GET /api/progress/me` — Get my learning progress
- `GET /api/leaderboard` — Get leaderboard rankings
- `GET /api/certificates` — Get my certificates
- `GET /api/certificates/verify/:qrCode` — Verify certificate
- `GET/POST /api/messages` — Get/send messages
- `GET /api/messages/conversation/:userId` — Get conversation
- `GET/POST /api/announcements` — List/create announcements
- `GET /api/dashboard/stats` — Student/teacher dashboard stats
- `GET /api/admin/dashboard` — Admin overview stats

## Auth Flow

1. Login → server returns `{ token, user }`
2. Token stored in `localStorage` as `sphere_token`
3. Token injected into all API requests via `lib/fetch-interceptor.ts`
4. JWT middleware extracts `userId` and `userRole` on protected routes
5. `AuthProvider` in React keeps user state synchronized via `/api/auth/me`

## Demo Accounts

| Role    | Email                           | Password    |
|---------|--------------------------------|-------------|
| Admin   | admin@sphereenglish.com        | admin123    |
| Teacher | sarah.johnson@sphereenglish.com | teacher123  |
| Teacher | michael.brown@sphereenglish.com | teacher123  |
| Student | alice@example.com              | student123  |
| Student | bob@example.com                | student123  |
| Student | ceren@example.com              | student123  |

## Brand Colors

- Primary (navy): HSL `220 74% 24%` (#102b6a)
- Accent (turquoise): HSL `201 83% 49%` (#0f9ee0)
- Sidebar background uses CSS variable `--sidebar`

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (set by Replit)
- `JWT_SECRET` — JWT signing secret (fallback: `sphere-english-secret-key-2024`)
- `PORT` — Server port (default 8080 for API)

---

## Marketing Site (www.sphereenglish.com)

Separate Next.js 15.1 app at `artifacts/www/` deployed to **EasyPanel** with its own GitHub repo `hakanimamogluspc-debug/sphereenglish-www`.

### Payload CMS v3 (embedded)

- **Admin URL**: `/admin` (e.g., `https://www.sphereenglish.com/admin`)
- **Database**: Same PostgreSQL as LMS, **separate `payload` schema** (auto-created via `push: true`)
- **Auth**: First-user setup wizard creates initial admin on first `/admin` visit
- **Collections**:
  - `users` — auth-protected admin users
  - `media` — file uploads → `public/media/` (3 sizes: thumbnail, card, tablet via sharp)
  - `solutions` — 13 Çözüm sayfaları (slug, title, category, body, highlights, ctaText)
  - `blog-posts` — blog yazıları (status: Draft/Published, hero image, related solutions)
- **Globals**:
  - `home-page` — Ana sayfa içeriği, 5 sekmeli (Hero, Neden Biz, Modüller, AI Koçlar, SSS)

### CMS-driven pages

| Route | Source | Component |
|-------|--------|-----------|
| `/home` | `home-page` global | `HomePage` server component → passes `data` prop to client sections |
| `/cozumler/[slug]` | `solutions` collection | Server component, `revalidate: 60` |

All section components (HeroSection, NedenBizSection, ModuleGrid, AICoachesSection, FAQSection) accept optional `data` prop and **fall back to hardcoded defaults** if CMS is empty.

### Seed endpoint

POST `/api/seed-cms` with header `x-seed-token: $SEED_TOKEN` (default `dev-seed-only` in dev).
- Idempotent: skips solutions that already exist
- Always upserts the HomePage global
- Source data: `src/payload/seed-data.ts`

### Required env vars (production)

| Var | Required | Purpose |
|---|---|---|
| `DATABASE_URI` | ✅ | PostgreSQL connection string (same as LMS) |
| `PAYLOAD_SECRET` | ✅ | Min 16 chars; **app fails to boot without it in prod** |
| `SEED_TOKEN` | ✅ if seeding | Required to call `/api/seed-cms` in prod (no default fallback) |
| `PAYLOAD_DB_PUSH` | First deploy only | Set to `true` once to auto-create the `payload` schema, then remove |
| `NOTION_API_KEY`, `NOTION_DATABASE_ID` | Optional | Legacy blog fallback — used only when Payload `blog-posts` is empty |

### Blog (Payload-first, Notion fallback)

`/blog` and `/blog/[slug]` query Payload `blog-posts` (status=Published) first.
If empty or unavailable, gracefully fall back to legacy Notion content.
Payload Lexical content is rendered via `src/payload/lexical-render.tsx`.

### Files

| File | Purpose |
|------|---------|
| `artifacts/www/payload.config.ts` | Payload root config (DB, collections, globals, sharp) |
| `artifacts/www/src/payload/api.ts` | Cached server helpers: `fetchHomePage`, `fetchSolution`, etc |
| `artifacts/www/src/payload/seed-data.ts` | Hardcoded migration source |
| `artifacts/www/src/app/(payload)/admin/[[...segments]]/page.tsx` | Admin UI mount |
| `artifacts/www/src/app/(payload)/api/[...slug]/route.ts` | Payload REST + Local API |
| `artifacts/www/src/app/api/seed-cms/route.ts` | One-time seed trigger |
| `artifacts/www/src/payload/lexical-render.tsx` | Lexical → JSX renderer for CMS blog content |
| `artifacts/www/src/app/blog/page.tsx` | Blog list (Payload-first, Notion fallback) |
| `artifacts/www/src/app/blog/[slug]/page.tsx` | Blog detail (Payload-first, Notion fallback) |

### GitHub deploy (EasyPanel)

Repo: `hakanimamogluspc-debug/sphereenglish-www` → branch `main`.
EasyPanel auto-deploys on push. Latest commit pushed via REST Trees API (no git CLI).
