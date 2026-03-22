# Sphere English LMS

## Overview

Full-stack English Learning Management System (LMS) built as a pnpm monorepo. Features role-based dashboards for admin/teacher/student, course management with A1-C2 levels, live class scheduling, quizzes, progress tracking with gamification (points, streaks, badges), certificates with QR verification, messaging, and leaderboards.

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
