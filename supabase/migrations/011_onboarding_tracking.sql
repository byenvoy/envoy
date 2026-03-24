ALTER TABLE organizations
  ADD COLUMN onboarding_completed_at timestamptz,
  ADD COLUMN onboarding_step integer NOT NULL DEFAULT 1;
