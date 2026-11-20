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
