-- 0117 — Goals v3 adds a Business save-for category.
ALTER TYPE goal_category ADD VALUE IF NOT EXISTS 'business';
