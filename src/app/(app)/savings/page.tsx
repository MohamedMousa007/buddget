/**
 * `/savings` — kept as an alias of `/wealth`.
 *
 * Savings and Investment were merged into one page (see docs/IA_MASTER_PLAN.md).
 * This route stays so existing deep links, bookmarks and any push notification that
 * still points at `/savings` land on the merged page instead of a 404.
 */
export { default } from '@/app/(app)/wealth/page'
