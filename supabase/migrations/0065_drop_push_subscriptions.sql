-- Migration 0065: drop the legacy web-push (VAPID) subscription table.
-- Web push is removed; web now uses the in-app notification center and native
-- devices use push_tokens (FCM/APNs). push_subscriptions is no longer written
-- or read by any code.
DROP TABLE IF EXISTS public.push_subscriptions CASCADE;
