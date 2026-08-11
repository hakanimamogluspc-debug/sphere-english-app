# Sphere English LMS

## Overview

Sphere English LMS is a full-stack English Learning Management System designed to provide a comprehensive learning experience. It features role-based dashboards for administrators, teachers, students, and corporate clients, offering tailored functionalities for each user type. The platform supports course management from A1 to C2 CEFR levels, live class scheduling, interactive quizzes, and robust progress tracking with gamification elements like points, streaks, and badges. It also issues verifiable certificates and includes communication tools such as messaging and leaderboards.

A key differentiator is its integration of advanced AI features, including an AI Simulation Mode with sector-aware business coaches, AI-powered conversational practice (Whisper, GPT-4o, TTS), real-time grammar and vocabulary analysis, and personalized learning paths. The system aims to enhance English language proficiency through adaptive, engaging, and data-driven methods, catering to individual learners and corporate training needs. Its business vision is to deliver a cutting-edge, personalized English learning experience with significant market potential in both individual and corporate education sectors.

## User Preferences

I want to see the key architectural and technical decisions clearly outlined. I prefer to have all the necessary context at the beginning of the file to understand the project's foundation. Please ensure that all information about external dependencies is accurate and directly relevant to what is integrated into the system.

## System Architecture

The Sphere English LMS is built as a pnpm monorepo, utilizing Node.js 24 and TypeScript 5.9. The backend is powered by Express 5, with PostgreSQL and Drizzle ORM for data persistence. Authentication is handled via JWT, and Zod is used for validation. API code generation leverages Orval from an OpenAPI specification. The frontend is developed with React, Vite, shadcn/ui, and TailwindCSS for a modern and responsive UI/UX. State management is managed by TanStack React Query, routing by wouter, charts by Recharts, and animations by Framer Motion. The application uses esbuild for CJS bundling.

The project structure organizes code into `artifacts` for deployable units (API server, React frontend, mockup sandbox) and `lib` for shared components like API specifications, generated API clients, Zod schemas, and database configurations.

**Key Features and Implementations:**

-   **Role-Based Dashboards:** Distinct dashboards for Admin, Teacher, Student, and Corporate roles, each with specific functionalities and data access.
-   **Course Management:** A structured system for creating, managing, and enrolling in courses categorized by CEFR levels (A1-C2).
-   **Gamification:** Points, streaks, and badges are integrated to motivate students and track their progress, encouraging continuous engagement.
-   **Certificate Verification:** Certificates are issued with QR codes for secure online verification.
-   **AI Studio:** Eight key AI features powered by `gpt-4o-mini` are integrated for personalized learning:
    -   **Pronunciation Coach:** Provides CEFR estimates, identifies weak areas, and offers recommendations.
    -   **Smart Notifications:** Triggers alerts for streaks, inactivity, level-ups, and new assessments.
    -   **Interview Simulator:** Multi-turn job interview practice with contextual feedback.
    -   **Presentation Simulator:** Slide-deck-driven practice with structured feedback.
    -   **Smart Quiz Generator:** AI generates personalized quizzes from text or topics, providing detailed reports including CEFR fit and study plans.
    -   **Personal AI Tutor:** A ChatGPT-style tutor with persistent memory, covering six focus areas.
    -   **Adaptive Learning Path:** Aggregates user activity into a personalized 4-week study plan with daily steps.
    -   **Corporate AI Performance Report:** Manager dashboard with cohort metrics, CEFR distribution, activity volumes, and AI-generated executive summaries and recommendations.
    -   **CEFR Level-Pass Exams (A1–C2):** Six-level proficiency exams sourced from the Oxford Business Result Placement Test (Q1-60) plus 6 additional C1 and 12 C2 questions in the same style. 70% pass threshold; passing a level higher than the user's current level atomically promotes their `current_level`. Server-side hardening: lock-bypass guard on submit, dedupe-by-questionId grading (prevents score inflation via repeated payloads), monotonic conditional UPDATE for promotion, and a 30-second per-level submit cooldown. Routes: `GET /api/level-exams`, `GET /api/level-exams/:level`, `POST /api/level-exams/:level/submit`. Stored in `level_exam_attempts` table; the question bank lives in code (`artifacts/api-server/src/lib/level-exam-bank.ts`).
-   **UI/UX Design:** Employs shadcn/ui and TailwindCSS for a consistent and modern look. Brand colors include a primary navy (`#102b6a`) and an accent turquoise (`#0f9ee0`).
-   **Database Schema:** A 14-table PostgreSQL schema manages users, courses, modules, lessons, enrollments, live classes, quizzes, certificates, messages, and announcements.
-   **Auth Flow:** JWT-based authentication with tokens stored in `localStorage` and injected into API requests.
-   **Marketing Site (`www.sphereenglish.com`):** A separate Next.js 15.1 application using Payload CMS v3 for content management. It features CMS-driven pages for solutions and blog posts, with a fallback to Notion for blog content if Payload is empty.

## External Dependencies

-   **Database:** PostgreSQL
-   **ORM:** Drizzle ORM
-   **Authentication:** JWT (jsonwebtoken, bcryptjs)
-   **Validation:** Zod
-   **API Codegen:** Orval
-   **Frontend Libraries:** React, Vite, shadcn/ui, TailwindCSS, TanStack React Query, wouter, Recharts, Framer Motion
-   **AI Services:** OpenAI's GPT-4o, Whisper (for speech-to-text), and Text-to-Speech (TTS)
-   **Deployment Platform:** Easypanel (Nixpacks build)
-   **Email Service:** Resend (for smart notifications)
-   **Content Management System (CMS):** Payload CMS v3 (for marketing site)
-   **Legacy Blog Fallback:** Notion API (for blog content on marketing site)
-   **Image Processing:** Sharp (used in Payload CMS for media resizing)