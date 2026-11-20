# Council review

Method: the `ecc:council` skill. Four voices: Architect (the lead, in context), and Skeptic, Pragmatist and Critic as fresh agents that saw only `council-packet.md`, with no recommendation in it. The Architect's positions below were written **before** the other voices answered.

## Architect positions (written first)

| # | Decision | Position | Main risk in it |
|---|---|---|---|
| D1 | SMS setup truth | B. Four derived states plus one column. Finish may end as "Not confirmed yet"; a run while tracking is off does not count as set up. No server-side claim: a prior collecting iPhone on the account is already visible from existing device rows. | Users who never get a bank SMS stay "not confirmed" for days and think it is broken. |
| D2 | "Chat is getting long" | B. Decouple spend from history, drop the note, cut the prefix by sending only the tools the intent needs. No summary system yet: the longest real chat is 7 turns. | Picking tools by intent can hide the tool the model needed. |
| D3 | Action confirmation | B. Effect class per tool, card names the destination, consent per chat and destination, chat closes on navigation. An explicit "open X" navigates at once. | Judging "explicit" from model output is fuzzy. |
| D4 | Buddgy drag | A. | Hint adds one more first-run prompt. |
| D5 | Invite image and expiry | B at most; no expiry. Zero completed referrals, and expiry adds a table, a check and a dead-link state for no proven gain. | Missing a growth lever. |
| D6 | Cancel | A. | People get lost on Apple's page. |
| D7 | Multi-store | D now, B before a second store sells. | B slips and Android is switched on without it. |
| D8 | Settings sync | C. Store `system`, and bring settings under the existing edit-stamp rule. Not field-level merge. | Old builds meeting a `system` value; whole-row stamp still loses one of two different fields edited on two devices. |
| D9 | Turn outcome | A, server only. Free: provider error, timeout, empty reply, safety block with no text, stream cut or Stop before any text. Charged: any visible text, including a written refusal and a Stop after partial text. | A turn that ends in write proposals has no final answer frame. |

## The other three voices (raw positions, shortened)

| # | Skeptic | Pragmatist | Critic |
|---|---|---|---|
| D1 | B. Finish must not wait. A run while off **counts** as wired: the action ran, so the Shortcut exists. Asks whether the new column is needed at all (derive from the log). | B. Finish as "Not confirmed yet". A run while off counts as wired, not as healthy. Backfill the column on day one or working phones show "Not confirmed". | B. Never "Automation active". A run counts as wired, not collecting. "Days since last SMS" will look broken for light spenders; say "waiting for your next bank SMS". |
| D2 | A only. The problem is invented: the note fires on spend. Cost is a separate budget question. | A plus tools-by-intent. No caching, summaries or retrieval. | A now; tools-by-intent only if numbers show it pays. The silent wipe on reload and after 30 idle minutes loses context far more often than any cap. |
| D3 | B without "do it here". Explicit "open X" navigates at once. Navigation is reversible, closer to a read than a write. | Same. Closing the chat on navigate fixes "chat on top" by deletion. | B. Explicit "open X" navigates and closes, with a one-tap way back to the chat. "Do it here" doubles paths; leave it out until a real chat path exists. |
| D4 | A without the hint. The safe-area and keyboard limits are the real bug. | A without the hint. | A without the hint; add a small dead zone or velocity check near the middle. |
| D5 | A, and build a real landing page: 0 of 51 points to a dead-end link, cause unknown. | A now, image later. A friend on day four hits a dead end. | A; image only after a landing page; reject expiry. Fake urgency in a money app reads as a scam. |
| D6 | A. Depends on the webhook pipeline, which delivers nothing today. | A. Trial users need "trial ends on X", not cancel steps. | A. Add a timeout line and a refresh to "waiting for the store". Equal-weight buttons matter for App Store review. |
| D7 | D; defer guard and reconcile until a second store is live; write it as a launch gate. No webhooks landing is the real P0. | D; expose `store` now, defer the rest. | D; fix the webhook pipeline first. Order by event time, not arrival. |
| D8 | B now, C only if stale overwrites are seen. E (device-local theme) may be the right product choice. | B now. Check old builds parse `system`. C changes the sync contract for old builds. | **C.** B alone still lets a stale device flip the theme back. Once a stale-write trigger lands, check old builds fail quietly. |
| D9 | A. Free and charged lists as the Architect's. Needs a server timeout to close a turn whose last call never ends. Asks whether outage charges should be refunded. | A. Same lists. Retry must reuse the turn id. A turn whose tools already wrote data, then failed, must not be free. | A. Same lists. A charged written refusal will feel unfair. |

## Verdicts

### D1. SMS setup truth
- **Consensus:** B. Finish never blocks and never says "Automation active"; it says "Not confirmed yet" until the first SMS from this phone.
- **Changed the Architect's position:** all three say a Shortcut run **does** count as wired, because a run is the only proof iOS ever gives that the Shortcut exists. Accepted. A run is stronger evidence than tapping the last button.
- **Strongest dissent:** Skeptic doubts the new column. Rejected: deriving it means a `min()` over a growing log table on a screen load, which the database-load rules forbid, and retention can delete the evidence. The column is kept and backfilled from the log in the same migration (Pragmatist).
- **Premise check:** the owner's rule "completion only by the last button or a confirmed skip" is replaced by "wired = a run was seen; claimed = the button or the skip". This is an **owner decision**, because it departs from the brief.
- **Recommendation:** B with backfill; health copy is neutral ("No bank SMS from this phone since …"), never "deleted" or "broken".

### D2. "Chat is getting long"
- **Consensus:** A now: stop trimming history by spend and remove the note. No summaries, no retrieval.
- **Changed the Architect's position:** tools-by-intent moves from "now" to a measured second slice (two voices against doing it blind).
- **What the voices missed:** with A alone, the 60,000-unit hard cap is still about 8 calls away, and the client ignores the roll. So the hard roll must carry the existing recap silently, and the client must handle it; otherwise the same loss returns one step later.
- **Strongest dissent:** Critic: the 30-minute idle wipe and the wipe on reload lose more context than any cap. Put to the owner as its own decision.
- **Recommendation:** A, plus silent carry-over at the hard roll; measure cached share and units per call before and after; tools-by-intent only if the numbers justify it.

### D3. Action confirmation
- **Consensus:** B. Consent per chat and per destination; the card names the destination; the chat closes when it navigates; an explicit "open X" navigates at once.
- **Strongest dissent:** all three reject "do it here" until a chat path exists. The owner asked for "Build my budget here in Buddgy". **Owner decision**: ship the choice card with "Open Budget Builder" and "Not now" first, and add "Build it here" only if the existing budget tools can do it.
- **Recommendation:** B; closing the chat must keep the conversation so the orb reopens it.

### D4. Buddgy drag
- **Consensus:** A. **Changed the Architect's position:** no one-time hint (three against). Safe-area and keyboard limits ship in the same change; a small dead zone near the middle.

### D5. Invite image and expiry
- **Consensus:** no expiry (unanimous). Copy fixes now.
- **Changed the Architect's position:** the image waits. Three voices independently point at the missing landing page as the likely reason for 0 completed referrals out of 51 codes. That cause is **not proven**.
- **Recommendation:** fix the copy and the Arabic labels now; put "landing page first, image second, no expiry" to the owner.

### D6. Cancel
- **Consensus:** A, unanimous. Trial users get "your trial ends on …, you will not be charged". "Waiting for the store" needs a refresh and a timeout line. It cannot ship before the webhook pipeline delivers events.

### D7. Multi-store
- **Consensus:** D, unanimous. Expose `store` now; guard, ownership and reconcile become a **written launch gate** for switching on a second store. Finishing the store and webhook setup comes before any of it.

### D8. Settings sync
- **Split:** Skeptic and Pragmatist say B now, C only on evidence; Critic and Architect said C.
- **Changed the Architect's position:** to "B now, C gated by a test". Reasons: a stale-write trigger changes the contract for builds already in the field, and there is no proof yet that a stale device overwrites settings once the sync branch is merged. A two-device test decides it.
- **Strongest dissent (kept):** Critic: B alone can still let an older device flip the theme back.
- **Not solvable by either option:** builds already installed keep uploading `dark` for System until they are updated.
- **Recommendation:** B, plus a two-device settings test after the sync merge; build C only if that test fails.

### D9. Turn outcome and charging policy
- **Consensus:** A, unanimous: the server decides. Free: provider error, timeout, empty reply, safety block with no text, stream cut or Stop before any text. Charged: any visible text.
- **Added by the voices and accepted:** Retry reuses the turn id; a server timeout closes a turn whose last call never ends; a turn whose actions were applied is charged even if its last call failed.
- **Strongest dissent:** Critic: charging a written refusal feels unfair. **Owner decision.**
- **Open question from the Skeptic:** refund the November outage? Live rows show no failed call charged in the last 14 days; older counters cannot be reconstructed. A one-time reset of the testers' AI windows is cheap. **Owner decision.**
