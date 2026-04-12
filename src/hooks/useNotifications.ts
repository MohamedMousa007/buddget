/**
 * App notifications: local budget/debt nudges plus server inbox (invites).
 * Re-exports the combined hook from `@/lib/notifications/useNotifications`.
 */
export {
  useNotifications,
  type AppNotification,
  type ServerNotificationRow,
} from '@/lib/notifications/useNotifications'
