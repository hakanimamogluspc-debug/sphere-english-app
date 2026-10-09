-- =====================================================================
-- Placement Test Question Bank — 2026-10-09
--
-- Non-destructive, idempotent. Mevcut 60 hardcoded sorunun DB'ye
-- taşınması ve attempt tablosunun oluşturulması. Mevcut
-- level_exam_attempts tablosu dokunulmaz.
--
-- Çalıştırma (Easypanel sphere-api container shell):
--   psql "$DATABASE_URL" -f lib/db/migrations/202610_placement_test_question_bank.sql
-- =====================================================================

BEGIN;

-- 1. placement_questions
CREATE TABLE IF NOT EXISTS placement_questions (
  id              SERIAL PRIMARY KEY,
  order_index     INTEGER NOT NULL,
  text            TEXT NOT NULL,
  options         JSONB NOT NULL,
  correct_option  VARCHAR(1) NOT NULL,
  cefr_level      VARCHAR(2) NOT NULL,
  skill           VARCHAR(32),
  difficulty      INTEGER,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS placement_questions_order_unique
  ON placement_questions (order_index);
CREATE INDEX IF NOT EXISTS placement_questions_active_idx
  ON placement_questions (is_active, order_index);
CREATE INDEX IF NOT EXISTS placement_questions_level_idx
  ON placement_questions (cefr_level);

-- 2. placement_test_attempts
CREATE TABLE IF NOT EXISTS placement_test_attempts (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score             INTEGER NOT NULL,
  total             INTEGER NOT NULL,
  cefr_level        VARCHAR(2) NOT NULL,
  started_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  duration_seconds  INTEGER,
  question_results  JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS placement_test_attempts_user_idx
  ON placement_test_attempts (user_id);
CREATE INDEX IF NOT EXISTS placement_test_attempts_level_idx
  ON placement_test_attempts (cefr_level);
CREATE INDEX IF NOT EXISTS placement_test_attempts_completed_idx
  ON placement_test_attempts (completed_at);

-- 3. Seed 60 soru (idempotent: order_index unique olduğundan tekrar
--    çalıştırılırsa olanlar atlanır)
INSERT INTO placement_questions (order_index, text, options, correct_option, cefr_level)
VALUES
  (1, 'My name ___ Richard Smith.', '{"A":"is","B":"are","C":"am"}'::jsonb, 'A', 'A1'),
  (2, 'I''m from ___.', '{"A":"Italy","B":"Italian","C":"the Italy"}'::jsonb, 'A', 'A1'),
  (3, '___ company is Microsoft.', '{"A":"She","B":"She''s","C":"Her"}'::jsonb, 'C', 'A1'),
  (4, 'Person 1: ___ are you? Person 2: Very well, thanks.', '{"A":"What","B":"Who","C":"How"}'::jsonb, 'C', 'A1'),
  (5, 'BMW ___ cars.', '{"A":"produces","B":"provides","C":"employs"}'::jsonb, 'A', 'A1'),
  (6, 'We ___ three factories.', '{"A":"has","B":"have","C":"are"}'::jsonb, 'B', 'A1'),
  (7, 'Person 1: Do you work for an English company? Person 2: No, I ___. It''s French.', '{"A":"do","B":"doesn''t","C":"don''t"}'::jsonb, 'C', 'A1'),
  (8, 'Person 1: ___ you spell that, please? Person 2: Sure. It''s A-L-A-N.', '{"A":"Can","B":"Do","C":"Are"}'::jsonb, 'A', 'A1'),
  (9, 'There ___ four international airports near London.', '{"A":"is","B":"are","C":"have"}'::jsonb, 'B', 'A1'),
  (10, 'A: ___ you like a coffee? B: Yes, please.', '{"A":"Do","B":"Could","C":"Would"}'::jsonb, 'C', 'A1'),
  (11, 'I deal ___ customers every day.', '{"A":"for","B":"in","C":"with"}'::jsonb, 'C', 'A1'),
  (12, 'Can we ___ a meeting?', '{"A":"available","B":"appoint","C":"arrange"}'::jsonb, 'C', 'A1'),
  (13, 'Our products are ___ than our main competitor''s.', '{"A":"cheap","B":"cheaper","C":"cheapest"}'::jsonb, 'B', 'A2'),
  (14, 'We need to ___ a solution to this problem.', '{"A":"attend","B":"make","C":"find"}'::jsonb, 'C', 'A2'),
  (15, 'What ___ on at the moment?', '{"A":"are you working","B":"do you work","C":"did you work"}'::jsonb, 'A', 'A2'),
  (16, 'How do you ___ about that idea?', '{"A":"think","B":"agree","C":"feel"}'::jsonb, 'C', 'A2'),
  (17, 'The plane leaves from ___ eighteen.', '{"A":"seat","B":"platform","C":"gate"}'::jsonb, 'C', 'A2'),
  (18, 'I have a ___ schedule this week.', '{"A":"busy","B":"fast","C":"time"}'::jsonb, 'A', 'A2'),
  (19, 'She''s ___ you an email.', '{"A":"sent","B":"send","C":"sended"}'::jsonb, 'A', 'A2'),
  (20, 'I''m ___, but she''s not here today.', '{"A":"sorry","B":"afraid","C":"apologize"}'::jsonb, 'A', 'A2'),
  (21, 'When ___ the company?', '{"A":"joined you","B":"did you join","C":"did you joined"}'::jsonb, 'B', 'A2'),
  (22, 'Can I ___ an order for 30 chairs?', '{"A":"place","B":"buy","C":"quote"}'::jsonb, 'A', 'A2'),
  (23, 'First of all, I ___ you a little bit about me.', '{"A":"tell","B":"''m going to tell","C":"''m telling"}'::jsonb, 'B', 'A2'),
  (24, 'English ___ all over the world.', '{"A":"speaks","B":"has spoken","C":"is spoken"}'::jsonb, 'C', 'A2'),
  (25, 'Did you ___ the deadline?', '{"A":"get","B":"reach","C":"meet"}'::jsonb, 'C', 'A2'),
  (26, 'I ___ him here recently.', '{"A":"didn''t see","B":"haven''t seen","C":"don''t see"}'::jsonb, 'B', 'A2'),
  (27, 'The new system ___ me focus on more important jobs.', '{"A":"lets","B":"allows","C":"gets"}'::jsonb, 'A', 'B1'),
  (28, 'This website isn''t as easy to use ___ the other one.', '{"A":"as","B":"than","C":"more"}'::jsonb, 'A', 'B1'),
  (29, 'I''ll call you back as soon as I ___ something.', '{"A":"''m hearing","B":"''ll hear","C":"hear"}'::jsonb, 'C', 'B1'),
  (30, 'You ___ press this button. It''s dangerous.', '{"A":"mustn''t","B":"don''t have to","C":"needn''t"}'::jsonb, 'A', 'B1'),
  (31, 'Your visitor ___ for over an hour. He''s in your room now.', '{"A":"is waiting","B":"has waited","C":"has been waiting"}'::jsonb, 'C', 'B1'),
  (32, 'The two companies plan to form a joint ___.', '{"A":"venture","B":"alliance","C":"forces"}'::jsonb, 'A', 'B1'),
  (33, 'If we changed the colour, we ___ more.', '{"A":"sell","B":"''ll sell","C":"''d sell"}'::jsonb, 'C', 'B1'),
  (34, 'When they have finished making the first ___, we can do some tests on it.', '{"A":"breakthrough","B":"prototype","C":"invention"}'::jsonb, 'B', 'B1'),
  (35, 'He ___ to leave the company by his boss.', '{"A":"''s been asked","B":"''s asked","C":"asked"}'::jsonb, 'A', 'B1'),
  (36, 'I''m surprised he''s late. He''s normally so ___.', '{"A":"hard-working","B":"patient","C":"punctual"}'::jsonb, 'C', 'B1'),
  (37, 'Hello, Alison. I ___ the office actually. Can I call you back tomorrow?', '{"A":"left","B":"''d just left","C":"was just leaving"}'::jsonb, 'C', 'B1'),
  (38, '___ the delays with the trains, we all still arrived on time.', '{"A":"Although","B":"Even though","C":"Despite"}'::jsonb, 'C', 'B1'),
  (39, 'My favourite perk in my job is ___.', '{"A":"my salary","B":"my company car","C":"the overtime"}'::jsonb, 'B', 'B1'),
  (40, 'James is away, ___?', '{"A":"isn''t he","B":"doesn''t he","C":"is he"}'::jsonb, 'A', 'B1'),
  (41, 'I seem to have run ___ of money. Can you lend me some?', '{"A":"out","B":"low","C":"ahead"}'::jsonb, 'A', 'B2'),
  (42, 'If you don''t like this idea, then come ___ with something better.', '{"A":"across","B":"in","C":"up"}'::jsonb, 'C', 'B2'),
  (43, '___ speak to them about our idea earlier today?', '{"A":"Were you able to","B":"Did you succeed in","C":"Did you manage"}'::jsonb, 'A', 'B2'),
  (44, 'Our most ___ customer has been with us for over 25 years.', '{"A":"loyal","B":"courteous","C":"attentive"}'::jsonb, 'A', 'B2'),
  (45, 'Do you know what time ___?', '{"A":"is it","B":"it is","C":"does it"}'::jsonb, 'B', 'B2'),
  (46, 'Let''s ___ up a list of action points.', '{"A":"take","B":"draw","C":"set"}'::jsonb, 'B', 'B2'),
  (47, 'We have very ___ information about you. Tell us about yourself.', '{"A":"little","B":"few","C":"plenty"}'::jsonb, 'A', 'B2'),
  (48, 'We''ve looked at the history, so now let''s ___ to our current activities.', '{"A":"turn on","B":"notice","C":"move on"}'::jsonb, 'C', 'B2'),
  (49, 'Many women feel that they hit a glass ___ on the corporate ladder.', '{"A":"roof","B":"attic","C":"ceiling"}'::jsonb, 'C', 'B2'),
  (50, 'Today, we need to ___ on a date for the launch and promotion.', '{"A":"discuss","B":"meet","C":"decide"}'::jsonb, 'C', 'B2'),
  (51, 'What they are asking is ___ ridiculous.', '{"A":"very","B":"absolutely","C":"such"}'::jsonb, 'B', 'B2'),
  (52, 'There''s a real ___ in the market for this kind of service, I think.', '{"A":"gap","B":"break","C":"miss"}'::jsonb, 'A', 'B2'),
  (53, 'Shirley is very calm and down to ___.', '{"A":"key","B":"world","C":"earth"}'::jsonb, 'C', 'B2'),
  (54, 'The pros definitely ___ the cons.', '{"A":"outcome","B":"outweigh","C":"outlook"}'::jsonb, 'B', 'B2'),
  (55, 'I think you should broaden your ___ and look for a new job.', '{"A":"horizons","B":"views","C":"positions"}'::jsonb, 'A', 'C1'),
  (56, 'If you ___ I''m sure you would have got the job.', '{"A":"applied","B":"would apply","C":"had applied"}'::jsonb, 'C', 'C1'),
  (57, 'Am I getting my point ___ clearly enough?', '{"A":"along","B":"across","C":"around"}'::jsonb, 'B', 'C1'),
  (58, 'There isn''t a ___ of purpose to the meeting.', '{"A":"feel","B":"sense","C":"reason"}'::jsonb, 'B', 'C1'),
  (59, 'Let me ___ you in on some of the background.', '{"A":"fill","B":"pack","C":"add"}'::jsonb, 'A', 'C1'),
  (60, 'It''s difficult to ___ what the reaction might be to this proposal.', '{"A":"weigh","B":"gauge","C":"measure"}'::jsonb, 'B', 'C1')

ON CONFLICT (order_index) DO NOTHING;

COMMIT;
