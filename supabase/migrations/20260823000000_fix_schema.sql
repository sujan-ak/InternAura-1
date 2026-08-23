-- ============================================================================
-- InternAura schema repair — fixes gaps #4, #8, #9, #19
--
-- Apply with:  psql "$DATABASE_URL" -f 001_fix_schema.sql
-- Or commit as supabase/migrations/20260823000000_fix_schema.sql
--
-- CONTEXT: three sources of truth currently disagree —
--   supabase/migrations/20260822000000_baseline.sql  (no auth_user_id, no
--                                                     assessments, no embeddings)
--   lib/db/src/index.ts ensureTables()               (has all three)
--   lib/db/src/schema/*.ts                            (has all three)
-- The committed migration cannot build a working DB. This reconciles it.
--
-- After applying, DELETE ensureTables() from lib/db/src/index.ts and the
-- `await ensureTables()` call at the top of all 9 route handlers.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Bring the baseline up to what the code actually expects
-- ---------------------------------------------------------------------------

ALTER TABLE students    ADD COLUMN IF NOT EXISTS auth_user_id     UUID;
ALTER TABLE internships ADD COLUMN IF NOT EXISTS embedding_vector JSONB;

CREATE TABLE IF NOT EXISTS assessments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID REFERENCES students(id) ON DELETE CASCADE,
  auth_user_id     UUID,
  skill            TEXT,
  title            TEXT,
  skill_name       TEXT,
  weighted_score   NUMERIC NOT NULL,
  proficiency_tier TEXT    NOT NULL,
  completed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 2. Constraints the code assumed but never had (gap #19)
-- ---------------------------------------------------------------------------

-- Without this, POST /students' select-then-branch upsert raced under concurrent
-- onboarding submits and could create two profiles for one account. Clean up any
-- existing duplicates first, keeping the row with the most skills.
WITH ranked AS (
  SELECT id, auth_user_id,
         ROW_NUMBER() OVER (
           PARTITION BY auth_user_id
           ORDER BY COALESCE(jsonb_array_length(skills), 0) DESC, id
         ) AS rn
  FROM students
  WHERE auth_user_id IS NOT NULL
)
DELETE FROM students s USING ranked r WHERE s.id = r.id AND r.rn > 1;

DROP INDEX IF EXISTS students_auth_user_id_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS students_auth_user_id_uniq
  ON students (auth_user_id);

-- One assessment row per (student, skill). Retakes previously APPENDED, and
-- /recommendations averaged every attempt scoring >= 60 — so grinding retakes
-- ratcheted the ATS score up permanently. Keep the best score.
DELETE FROM assessments a
USING assessments b
WHERE a.student_id = b.student_id
  AND a.skill = b.skill
  AND a.student_id IS NOT NULL
  AND (a.weighted_score < b.weighted_score
-- Ensure legacy table columns from older seeds are nullable
ALTER TABLE assessments ALTER COLUMN difficulty_level DROP NOT NULL;
ALTER TABLE assessments ALTER COLUMN blueprint DROP NOT NULL;
ALTER TABLE assessments ALTER COLUMN pass_percentage DROP NOT NULL;
ALTER TABLE assessments ALTER COLUMN created_at DROP NOT NULL;
ALTER TABLE assessments ALTER COLUMN updated_at DROP NOT NULL;

DROP INDEX IF EXISTS assessments_student_skill_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS assessments_student_skill_uniq
  ON assessments (student_id, skill);

-- One interaction row per (student, internship, action) — makes save/apply
-- idempotent so tap-spam can no longer inflate counts or the behaviour band.
-- Collapse existing duplicates, keeping the most recent.
DELETE FROM interactions a
USING interactions b
WHERE a.student_id = b.student_id
  AND a.internship_id = b.internship_id
  AND a.action = b.action
  AND (a.created_at < b.created_at OR (a.created_at = b.created_at AND a.id > b.id));

CREATE UNIQUE INDEX IF NOT EXISTS interactions_student_internship_action_uniq
  ON interactions (student_id, internship_id, action);

-- Every interaction read filters on student_id and there was no index.
CREATE INDEX IF NOT EXISTS interactions_student_id_idx  ON interactions (student_id);
CREATE INDEX IF NOT EXISTS assessments_student_id_idx   ON assessments  (student_id);
CREATE INDEX IF NOT EXISTS students_auth_user_id_idx    ON students     (auth_user_id);

-- ---------------------------------------------------------------------------
-- 3. External listings (gap #4)
--
-- Adzuna results have ids like "adzuna-4718392", which are not UUIDs, so saving
-- one violated interactions.internship_id's FK and returned an unexplained 500.
-- Importing a listing here mints a real UUID, after which it saves like any
-- other internship and shows up in the Saved tab.
-- ---------------------------------------------------------------------------

ALTER TABLE internships ADD COLUMN IF NOT EXISTS source        TEXT NOT NULL DEFAULT 'internal';
ALTER TABLE internships ADD COLUMN IF NOT EXISTS external_id   TEXT;
ALTER TABLE internships ADD COLUMN IF NOT EXISTS redirect_url  TEXT;
ALTER TABLE internships ADD COLUMN IF NOT EXISTS imported_at   TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS internships_source_external_id_uniq
  ON internships (source, external_id) WHERE external_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. Row Level Security (gap #9)
--
-- There were NO policies and RLS was never enabled, while the anon key is
-- hardcoded in three committed scripts and the project ref is in
-- artifacts/internaura/lib/supabase.ts. Anyone with the repo could read and
-- write these tables directly via the Data API, bypassing Express entirely.
--
-- The API server uses the service-role key and bypasses RLS, so these policies
-- only constrain direct client access — which is exactly what we want.
-- ---------------------------------------------------------------------------

ALTER TABLE students     ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE internships  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS students_own_row ON students;
CREATE POLICY students_own_row ON students
  FOR ALL TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS interactions_own_rows ON interactions;
CREATE POLICY interactions_own_rows ON interactions
  FOR ALL TO authenticated
  USING (student_id IN (SELECT id FROM students WHERE auth_user_id = auth.uid()))
  WITH CHECK (student_id IN (SELECT id FROM students WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS assessments_own_rows ON assessments;
CREATE POLICY assessments_own_rows ON assessments
  FOR ALL TO authenticated
  USING (student_id IN (SELECT id FROM students WHERE auth_user_id = auth.uid()))
  WITH CHECK (student_id IN (SELECT id FROM students WHERE auth_user_id = auth.uid()));

-- Internships are a public catalogue: readable by all, writable only by the
-- service role (which bypasses RLS anyway).
DROP POLICY IF EXISTS internships_read_all ON internships;
CREATE POLICY internships_read_all ON internships
  FOR SELECT TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 5. Drizzle/DDL drift: the schema declares timestamp() without withTimezone
--    while the DDL created TIMESTAMPTZ. Make the schema match the database:
--    interactions.createdAt -> timestamp("created_at", { withTimezone: true })
-- ---------------------------------------------------------------------------

COMMIT;
