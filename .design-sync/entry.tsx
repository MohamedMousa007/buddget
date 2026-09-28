// design-sync entry: Buddget has no library build (it is a Next.js app), so this
// file is the hand-authored barrel the converter bundles. Keep it in sync with
// `componentSrcMap` in config.json — that map is what gets a preview card; anything
// exported here is importable by the design agent whether or not it has a card.

// ── ui primitives ───────────────────────────────────────────────────────────
export { Badge } from '@/components/ui/badge'
export { Button } from '@/components/ui/button'
export { Input } from '@/components/ui/input'
export { Label } from '@/components/ui/label'
export { Textarea } from '@/components/ui/textarea'
export { Switch } from '@/components/ui/switch'
export { Separator } from '@/components/ui/separator'
export * from '@/components/ui/progress'
export * from '@/components/ui/tabs'
export * from '@/components/ui/sheet'
export * from '@/components/ui/dialog'
export * from '@/components/ui/popover'
export * from '@/components/ui/tooltip'
export * from '@/components/ui/select'
export * from '@/components/ui/dropdown-menu'
export * from '@/components/ui/scroll-area'

// ── ui composites ───────────────────────────────────────────────────────────
export { AmountField } from '@/components/ui/AmountField'
export { CardActionMenu } from '@/components/ui/CardActionMenu'
export { ColorSwatchRow } from '@/components/ui/ColorSwatchRow'
export { CountrySelect } from '@/components/ui/CountrySelect'
export { CurrencyField, FiatCurrencyField, DebtCurrencyField } from '@/components/ui/CurrencyField'
export { CurrencyLabel } from '@/components/ui/CurrencyLabel'
export { CurrencySheet } from '@/components/ui/CurrencySheet'
export { DatePickerField } from '@/components/ui/DatePickerField'
export { UnifiedDatePicker } from '@/components/ui/UnifiedDatePicker'
export { EmptyState } from '@/components/ui/EmptyState'
export { LanguageToggle } from '@/components/ui/LanguageToggle'
export { MoneyDisplay } from '@/components/ui/MoneyDisplay'
export { MonthYearPicker } from '@/components/ui/MonthYearPicker'
export { NumberPad } from '@/components/ui/NumberPad'
export { OfflineBanner } from '@/components/ui/OfflineBanner'
export { SelectField } from '@/components/ui/SelectField'
export { SkeletonList } from '@/components/ui/SkeletonList'
export { UpdateToast } from '@/components/ui/UpdateToast'
export { ActionToastProvider } from '@/components/ui/ActionToast'

// ── transactions / expenses ─────────────────────────────────────────────────
export { TransactionRow } from '@/components/transactions/TransactionRow'
export { SwipeToDelete } from '@/components/expenses/SwipeToDelete'
export { ExpenseFilters } from '@/components/expenses/ExpenseFilters'

// ── income ──────────────────────────────────────────────────────────────────
export { AccountChip } from '@/components/features/income/AccountChip'
export { IncomePaydayGrid } from '@/components/features/income/IncomePaydayGrid'
export { IncomeSourceTypePicker } from '@/components/features/income/IncomeSourceTypePicker'
export { IncomeTemplatePicker } from '@/components/features/income/IncomeTemplatePicker'
export { IncomeTypeChipSlider } from '@/components/features/income/IncomeTypeChipSlider'
export { IncomeTypeIcon } from '@/components/features/income/IncomeTypeIcon'
export { PaydayTimeline } from '@/components/features/income/PaydayTimeline'
export { RecurringIncomeCard } from '@/components/features/income/RecurringIncomeCard'
export { RecurringIncomeCarousel } from '@/components/features/income/RecurringIncomeCarousel'

// ── dashboard ───────────────────────────────────────────────────────────────
// The dashboard is mid-redesign and deliberately OUT of the synced surface (no preview
// cards) — designs built from it would inherit a look that is about to change. CategoryIcon
// stays exported because the TransactionRow preview composes it as an expense glyph.
export { CategoryIcon } from '@/components/dashboard/CategoryIcon'

// ── income design primitives (exported for composition, no preview cards) ──
// The canonical accent/tint pair and the glass surface every income component is built on.
// Previews and designs should use these rather than re-hardcoding the accents.
export { incomeTypeColors } from '@/components/features/income/IncomeTypeIcon'
export { GLASS_CARD, heroCardStyle } from '@/components/features/income/incomeGlass'

// ── i18n provider (used as cfg.provider if previews ever need a locale) ─────
export { LocaleProvider } from '@/lib/i18n'
