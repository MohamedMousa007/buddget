# Strings (EN + AR)

Reuse existing keys where listed. New keys go in `src/lib/i18n/dictionaries/en.ts` and `ar.ts` (and the `Dictionary` type).

## Reused as-is
`smsReview.chip(count)`, `smsReview.title`, `smsReview.subtitle`, `smsReview.dismiss`, `settings.accountDetected`, `settings.linkCta`, `subscriptions.detectedTitle`, `subscriptions.detectedCta`, `income.receivedBtn`, `income.missedBtn`, `income.daysLateChip(n)`, `income.earlierPaydayFirst`, `common.offlineBanner`, `addIncome.addSubtitleOneTime`, `addIncome.howOftenLabel`, `addIncome.freqMonthly/Biweekly/Weekly`, `addIncome.paydayLabel`, `addIncome.labelPaymentMethod`, `addIncome.labelNotes`, `expenses.period*`, `expenses.clearFilters`, `expenses.showResults`, `modals.fabTileScan/Expense/Debt/Saving`, `paymentMethods.addMethod`.

## Changed
| Key | EN (new) | AR (new) |
|---|---|---|
| `modals.fabTileIncome` | Money in | دخل وارد |
| `modals.fabTileExpense` | Expense | مصروف |
| `modals.fabTileScan` | Receipt scan | مسح إيصال |
| `modals.fabTileDebt` | Debt payment | سداد دين |
| `modals.fabTileSaving` → `modals.fabTileWealth` | Wealth | الثروة |
| `modals.fabTileMethod` | Pay method | طريقة دفع |
| `modals.fabVoiceTip` | Tip: hold the + in the bottom bar to add by voice | نصيحة: اضغط مطولاً على + في الشريط السفلي للإضافة بالصوت |
| `addIncome.sheetTitle` (one-time) | Log money in | تسجيل دخل وارد |
| `addIncome.assignCardTitle` | Is this one of your paydays? | هل هذا من أيام القبض؟ |
| `addIncome.assignCardBody` | Link it so it counts toward that payday, not twice. | اربطه ليُحسب ضمن يوم القبض، وليس مرتين. |
| `addIncome.assignBtn` | Link | ربط |
| `addIncome.buttonSubmit` (payday) | Add payday | إضافة يوم قبض |
| `income.looksLikeTemplate(name)` | Looks like “{name}” — link it? | يبدو أنه "{name}" — ربطه؟ |

## New
| Key | EN | AR |
|---|---|---|
| `nav.flow` | Flow | المعاملات |
| `nav.paydays` | Paydays | أيام القبض |
| `paydays.newTitle` | New payday | يوم قبض جديد |
| `paydays.menuNew` | New | جديد |
| `prompts.snooze` | Snooze | تأجيل |
| `prompts.snoozedUntil(time)` | Snoozed · back at {time} | تم التأجيل · يعود الساعة {time} |
| `prompts.counter(i,n)` | {i} of {n} | {i} من {n} |
| `prompts.review` | Review | مراجعة |
| `prompts.linkIt` | Link it | اربطه |
| `prompts.keepSeparate` | Keep separate | إبقاؤه منفصلاً |
| `prompts.addCard` | Add card | إضافة بطاقة |
| `prompts.addAccount` | Add account | إضافة حساب |
| `prompts.addWallet` | Add wallet | إضافة محفظة |
| `prompts.linkExisting` | Link existing | ربط بموجود |
| `prompts.lateTitle(name,n)` | {name} · {n} days late | {name} · متأخر {n} أيام |
| `prompts.lateBody(amount,date)` | Expected {amount} on {date}. | المتوقع {amount} في {date}. |
| `prompts.matchBody(amount,date,payday)` | {amount} arrived {date}. Its payday was {payday}. | وصل {amount} في {date}. يوم القبض كان {payday}. |
| `status.offlinePending(n)` | Offline · {n} messages waiting to sync | غير متصل · {n} رسائل بانتظار المزامنة |
| `status.hiddenReturns` | Hidden · returns if still offline in 10 min | مخفي · يعود إذا بقيت غير متصل بعد 10 دقائق |
| `income.linkToPayday` | Link to a payday | ربط بيوم قبض |
| `income.unlink` | Unlink | إلغاء الربط |
| `income.arrivedDaysLate(n)` | Arrived {n} days late | وصل متأخراً {n} أيام |
| `income.makeRecurring` | Make this recurring | اجعله متكرراً |
| `income.openInPaydays` | Open in Paydays | فتح في أيام القبض |
| `income.detailsLabel` | Details | التفاصيل |
| `income.setAccount` | Set account | تحديد الحساب |
| `quickAdd.hintIncome` | Gift, refund, sale | هدية، استرداد، بيع |
| `quickAdd.hintExpense` | Cash or card | نقداً أو بطاقة |
| `quickAdd.hintScan` | Snap, we fill it | صوّره ونعبّئه لك |
| `quickAdd.hintDebt` | Log a payment | تسجيل دفعة |
| `quickAdd.hintWealth` | Save or invest | ادّخر أو استثمر |
| `quickAdd.hintMethod` | Card, bank, wallet | بطاقة، بنك، محفظة |
| `filters.dateRange` | Date range | نطاق التاريخ |
| `filters.amountHelp` | Only show transactions between these two amounts. | اعرض المعاملات بين هذين المبلغين فقط. |
| `filters.paymentMethod` | Payment method | طريقة الدفع |
| `filters.category` | Category | الفئة |
(Reused: `expenses.periodFrom/To`, `expenses.minimum/maximum`, `expenses.amountRange`, `expenses.selectMulti`, `expenses.resetAll`, `expenses.showResults`, `common.today/yesterday`.)

Have a native Arabic speaker review the AR column before release.
