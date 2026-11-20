# Native test requirements

A browser test does not prove any of these. None has been run. This Mac had no iOS simulator runtime and no Android emulator as of 2026-11-20 (S7b was blocked on that), so each row needs either a simulator runtime installed or the owner's own phone.

Every app change reaches a phone only through a native build, which is started only on the owner's explicit request.

| ID | What to check | Needs | Pass when |
|---|---|---|---|
| BDG-008 | Shortcut automation runs on a real bank SMS and on a test text | real iPhone with a SIM; Shortcuts cannot be driven in the simulator | Settings shows "Set up" before any run; after a run it shows the switch; "Not confirmed yet" turns into confirmed after the first SMS reaches the server; the pill shows this phone's last SMS |
| BDG-008 | Reinstall | real iPhone | after delete and reinstall the phone is "not confirmed" until its next SMS, and is not silently off against the account preference |
| BDG-008 | Two iPhones on one account | two iPhones | each shows its own last SMS |
| BDG-008 | Guide X button | simulator is enough | X sits inside the header row on a notched iPhone and on an SE |
| BDG-019 | "Keep Pro" with a sandbox account | real iPhone or TestFlight, after the store setup is done | tap shows loading, the Apple sheet opens, cancel returns cleanly, success shows only after the server row is store-sourced, Restore works |
| BDG-020 | Manage subscription and cancel | same | Apple's page opens for the right subscription; the app shows "cancelled" only after the store event arrives |
| BDG-014 | Keyboard in the Buddgy chat | iPhone and Android, simulator is enough | composer and last message stay visible; no jump; restores on close; the orb is where it was |
| BDG-017 | Edge swipe back | iPhone | swipe from the left edge goes back on the six screens; does not fire on horizontal scrollers; closes a sheet first; does nothing with no history; mirrors in Arabic |
| BDG-003 | Card flip | iPhone (WebKit) | on Invite, Pro, Rewards tier and Founders: only one face visible, both directions, no mirrored text |
| BDG-018 | Buddgy drag | iPhone and Android | follows the finger, springs to the nearest edge, never under the tab bar, FAB, keyboard or notch |

## What cannot be verified at all
- That a Shortcut exists, was deleted or is switched off. iOS exposes none of this; no Apple page was found that states it, so the claim is unsourced. The app can only observe a run.
- A real App Store renewal, refund or billing-retry cycle before the products are approved; sandbox approximates them.
- Google Play billing: not configured.
