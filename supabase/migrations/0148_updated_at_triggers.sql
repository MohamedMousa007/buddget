-- Delta sync keys on updated_at; these two tables never bumped it server-side, so a changed row could be missed.
DROP TRIGGER IF EXISTS trg_receipts_updated_at ON public.receipts;
CREATE TRIGGER trg_receipts_updated_at BEFORE UPDATE ON public.receipts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_buddgy_memories_updated_at ON public.buddgy_memories;
CREATE TRIGGER trg_buddgy_memories_updated_at BEFORE UPDATE ON public.buddgy_memories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
