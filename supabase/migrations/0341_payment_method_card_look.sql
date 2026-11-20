-- Card faces (owner-approved redesign, 2026-11-20): a card is drawn in one of two styles ('metal', 'bank') and one of 16
-- named themes. `color` stays the hex every other reader uses (avatars, tints); the app writes the theme's first stop
-- into it. NULL in either column = a card saved before this: the app maps its colour to the nearest theme, style 'bank'.
ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS card_style text,
  ADD COLUMN IF NOT EXISTS card_theme text;

ALTER TABLE public.payment_methods DROP CONSTRAINT IF EXISTS payment_methods_card_style_check;
ALTER TABLE public.payment_methods
  ADD CONSTRAINT payment_methods_card_style_check CHECK (card_style IS NULL OR card_style IN ('metal', 'bank'));

ALTER TABLE public.payment_methods DROP CONSTRAINT IF EXISTS payment_methods_card_theme_check;
ALTER TABLE public.payment_methods
  ADD CONSTRAINT payment_methods_card_theme_check CHECK (card_theme IS NULL OR char_length(card_theme) <= 32);
