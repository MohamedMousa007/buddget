import { describe, expect, it } from 'vitest'
import { ar } from '@/lib/i18n/dictionaries/ar'
import { onboardingCopyAr } from '@/lib/i18n/onboardingCopy'
import { voiceCopyAr } from '@/lib/i18n/voiceCopy'
import { budgetBlocksCopyAr } from '@/lib/i18n/budgetPage/blocksCopy'

// TZL-5: count nouns agree with the number (1, 2, 3-10, 11+) because every one goes through arCount.
describe('Arabic count agreement', () => {
  it('days', () => {
    expect(ar.dashboard.heroPaceDaysLeft(3)).toBe('متبقي 3 أيام')
    expect(ar.dashboard.heroPaceDaysLeft(11)).toBe('متبقي 11 يومًا')
    expect(ar.dashboard.heroPaceDaysLeft(2)).toBe('متبقي يومين')
    expect(ar.income.daysLateChip(3)).toBe('متأخر 3 أيام')
    expect(ar.income.daysLateChip(11)).toBe('متأخر 11 يومًا')
    expect(ar.serverNotifications.causeStale(3)).toBe('لم يتم فتحه منذ 3 أيام')
    expect(ar.goals.home.statusDue(3)).toBe('مستحق خلال 3 أيام')
    expect(ar.prompts.lateTitle('X', 11)).toBe('X · متأخر 11 يومًا')
    expect(onboardingCopyAr.flow.daysToPayday(3)).toBe('3 أيام حتى الراتب')
    expect(onboardingCopyAr.flow.daysToPayday(2)).toBe('يومين حتى الراتب')
  })
  it('months, accounts, cards, messages, transactions', () => {
    expect(ar.goals.achievedView.onTime(11)).toContain('11 شهرًا')
    expect(ar.goals.achievedView.early(3, 11)).toContain('قبل 11 شهرًا')
    expect(budgetBlocksCopyAr.safety.ofTarget(11)).toBe('من 11 شهرًا')
    expect(ar.accountsPage.accountsCount(11)).toBe('11 حسابًا')
    expect(ar.accountsPage.accountsCount(3)).toBe('3 حسابات')
    expect(ar.accountsPage.cardsCount(2)).toBe('بطاقتين')
    expect(ar.smsReview.chip(11)).toBe('11 معاملة بحاجة لمراجعتك')
    expect(ar.smsTracking.pendingQueued(3)).toBe('3 رسائل بانتظار المزامنة')
    expect(voiceCopyAr.recap.transactionsCount(11)).toBe('11 معاملة')
    expect(voiceCopyAr.recap.transactionsCount(2)).toBe('معاملتين')
  })
})
