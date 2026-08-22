-- Baseline Migration: Schema creation mirroring Drizzle ORM models
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Action Enum for Interactions
DO $$ BEGIN
  CREATE TYPE action AS ENUM ('view', 'save', 'skip', 'apply', 'like');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Students Table
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  degree TEXT NOT NULL,
  year TEXT NOT NULL,
  career_goal TEXT NOT NULL,
  location TEXT NOT NULL,
  work_mode TEXT NOT NULL,
  stipend_preference TEXT NOT NULL,
  interests TEXT[],
  skills JSONB
);

-- Internships Table
CREATE TABLE IF NOT EXISTS internships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  description TEXT NOT NULL,
  domain TEXT NOT NULL,
  location TEXT NOT NULL,
  work_mode TEXT NOT NULL,
  duration TEXT NOT NULL,
  stipend TEXT NOT NULL,
  education TEXT,
  required_skills TEXT[] NOT NULL,
  preferred_skills TEXT[] NOT NULL,
  experience_level TEXT NOT NULL
);

-- Interactions Table
CREATE TABLE IF NOT EXISTS interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  internship_id UUID NOT NULL REFERENCES internships(id) ON DELETE CASCADE,
  action action NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Recommendations Table
CREATE TABLE IF NOT EXISTS recommendations (
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  internship_id UUID NOT NULL REFERENCES internships(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL,
  reasons JSONB,
  skill_gap JSONB,
  PRIMARY KEY (student_id, internship_id)
);
