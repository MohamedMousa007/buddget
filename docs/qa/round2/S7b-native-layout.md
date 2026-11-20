# S7b Native layout (2026-11-20)

Status: BLOCKED on tooling, no device pass done yet. Static audit only.

## Blocker
- iOS: every simulator device is "unavailable, runtime profile not found" (iOS 26.5 runtime not installed; `simctl list runtimes` is empty). Xcode 27.1.
- Android: SDK has `platforms/android-36` only. No `emulator`, no `adb`, no `system-images`, no AVD.
- Needed from owner: install an iOS simulator runtime (Xcode > Settings > Components) and the Android Emulator + one system image + AVD (a phone, plus a tablet if wanted). Then a one-line yes to build to the simulator/emulator.

## Static audit (no device yet; every row needs on-device confirmation)
| Screen | Device / text size | Observation | Verdict | Screenshot |
|---|---|---|---|---|
| Root text scale (iOS) | all, Dynamic Type | `BuddgetViewController` sets root font to `UIFontMetrics` body scaled, capped 1.5x, so rem text scales. px-sized text and fixed boxes do not. | OK by design; verify caps | pending |
| Goals ring `SegmentExtra` | iPhone, 1.5x | 44px ring, centre label `0.75rem` (18px at 1.5x), 3 digits "100" is about 32px in a 36px inner circle. | Suspect, tight | pending |
| `MilestoneCheerSheet` ring | iPhone, 1.5x | 120px ring, centre `30px` fixed, does not scale. | OK | pending |
| `QuotaWheel` | any | 26px ring in a 44px IconButton, no centre text. | OK | pending |
| iPad orientations | iPad | Info.plist allows all four orientations on iPad, portrait only on iPhone. Layout on wide viewports not yet seen. | Needs device | pending |
| Android text scale | emulator, font 1.3 | No `textZoom` handling found in `android/app/src` or `capacitor.config.ts`; WebView default applies. | Needs device | pending |
| `CategoryGrid` (`src/lib/constants/categoryGrid.ts`) | all | 22 hardcoded hex accents in the data file, icons unique. Owner approval needed before any change; none made. | Report only | n/a |
| SMS setup + Shortcuts step | iPhone | `components/onboarding/SmsTrackingGuide.tsx`, `sms/ShortcutsScenes.tsx` not yet exercised. | Needs device | pending |

## Open for the cloud runner
None yet (no code changed).
