-- Free-text installment provider brand (e.g. valU, Sympl, Souhoola) beyond the
-- coarse installment_provider enum, so the redesign can show the real provider.
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS installment_provider_name text;
COMMENT ON COLUMN public.debts.installment_provider_name IS 'Free-text provider brand slug matched to the client-side provider catalogue; enum installment_provider kept for coarse category.';
