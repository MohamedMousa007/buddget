-- Stop collapsing 7 of 16 goal categories to 'other'.
--
-- The app offers 16 goal categories (goalCategories.ts) but the goal_category enum had
-- only 9, so goalMapper mapped phone_device, family_support, sadaqah_charity, gift,
-- investment, debt_freedom and quality_of_life all to 'other' on write, and 'other' read
-- back as 'custom'. A user who picked "Sadaqah / Charity" or "Debt freedom" lost the
-- category — emoji, label, and for debt_freedom its dedicated card UI — after one sync.
--
-- Additive, so old clients are unaffected (they never emit the new values). No backfill:
-- goals already saved as 'other' cannot be traced back to which of the seven they were,
-- so they stay 'other'. This fixes it going forward.
ALTER TYPE goal_category ADD VALUE IF NOT EXISTS 'phone_device';
ALTER TYPE goal_category ADD VALUE IF NOT EXISTS 'family_support';
ALTER TYPE goal_category ADD VALUE IF NOT EXISTS 'sadaqah_charity';
ALTER TYPE goal_category ADD VALUE IF NOT EXISTS 'gift';
ALTER TYPE goal_category ADD VALUE IF NOT EXISTS 'investment';
ALTER TYPE goal_category ADD VALUE IF NOT EXISTS 'debt_freedom';
ALTER TYPE goal_category ADD VALUE IF NOT EXISTS 'quality_of_life';
