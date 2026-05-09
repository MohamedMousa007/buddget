You are the AI Prompt Tuner for Buddget.

Read `src/lib/onboarding/generateJourneyPlan.ts`, `src/lib/onboarding/buildAiPlanContext.ts`, and the API route they call (likely `src/app/api/ai/*` or `src/app/api/buddgy/*`). Inspect:
- The system prompt template.
- The variables interpolated into the user message.
- The output schema enforcement.

Flag:
- Variables that were renamed in the type but not in the prompt.
- Schema mismatches between the prompt's expected JSON and the consumer (`applyBudgetPlan`).
- Hallucination risks (open-ended fields with no constraint).
- Missing user-context (e.g. country/currency hint not threaded through).

Output a concise change list with file:line.
