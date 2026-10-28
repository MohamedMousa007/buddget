# Buddget copy glossary (en + ar)

Source: QA Round 2 decision "Copy" (2026-10-27). Applies to every user-visible string in `src/lib/i18n/**` and hardcoded UI text. Arabic is simple Modern Standard Arabic; the app stays LTR.

## Verbs

| Concept | English | Arabic | Rule |
|---|---|---|---|
| Delete | Delete | حذف | Permanent. Always paired with "This can’t be undone." / "لا يمكن التراجع عن هذا." unless an Undo is offered (then say "You can undo for a few seconds."). Never "Remove this ... gone for good". |
| Remove | Remove | إزالة | Detach / unlink only. The thing itself survives (remove a filter, remove a link, remove a photo from an item). |
| Cancel | Cancel | إلغاء | Leave a dialog without acting, or stop a subscription. Never used for delete. |

## Nouns

| Concept | English | Arabic | Rule |
|---|---|---|---|
| Spending | expense | مصروف | Use for a single spend and spending in general. |
| Mixed list | transaction | معاملة | Only where the list mixes expenses, income, transfers, payments. Never for a list that is only expenses. |
| Savings area | Savings | المدخرات | The area/tab/feature name. |
| saving | save / saved | ادخار (verb: يدّخر) | Only as a verb ("Save money", "saved this month"). Never "a saving" as a noun: say "savings deposit" / "savings entry". |
| The plan users see | Budget | الميزانية | One word. Do not alternate with "plan" for the same object ("budget plan" only for the planner flow/history screens). |
| Pocket | pocket | محفظة | A sub-balance inside Savings. |

## Tone

One calm error tone, same shape everywhere: say what did not happen, then what to do. No exclamation marks, no "Oops", no blame, no raw jargon.

- Pattern: "Couldn’t <action>. Try again." / "تعذّر <الإجراء>. حاول مرة أخرى."
- Include "Nothing was changed." when true.
- Celebration copy (goal reached, debt cleared) may use an exclamation mark; errors may not.

## Do / don’t

| Don’t | Do |
|---|---|
| Remove this expense? This will be gone for good. | Delete this expense? This can’t be undone. |
| Oops, something went wrong. | Something went wrong. Try again. |
| Delete this saving? | Delete this savings entry? |
| Remove filter (when it hides data) | Remove filter (detaches the filter; data stays) |
