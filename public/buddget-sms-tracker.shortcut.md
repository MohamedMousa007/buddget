# Buddget SMS tracker — iOS Shortcut build guide

iOS Shortcuts are stored as a binary `.shortcut` package signed by Apple's
Shortcuts app. We can't generate one from a browser or repo, so this is a
ready-to-paste, step-by-step recipe. Build once and it will fan every bank SMS
into your Buddget account automatically.

The Shortcut is **Egypt-first**: the trigger keywords default to Egyptian bank
phrasing and the EGP currency, with UAE / GCC keywords mixed in.

---

## Prerequisites

- iOS 16 or later.
- Buddget account (sign in once at <https://buddget.app>).
- Your bearer token from `/setup/ios-sms` (tap **Reveal** then **Copy**).

## 1. Create the Personal Automation

1. Open the **Shortcuts** app → **Automation** tab.
2. Tap **+ New Automation** → **Personal Automation** → **Message**.
3. **Sender** → Any.
4. **Message contains** → paste each keyword on its own line:

```
EGP
جنيه
تم خصم
تم سحب
تم دفع
عملية شراء
debited
spent at
transaction of
purchase of
withdrawn
AED
SAR
QAR
KWD
OMR
BHD
```

5. **Run** → toggle **Run Without Asking** ON. Tap **Next**.

## 2. Add the actions

Inside the new Shortcut, add these actions in order:

### 2.1 Get Contents of URL

- **URL**: `https://buddget.app/api/sms/parse`
- **Method**: `POST`
- **Headers**:
  - `Authorization`: `Bearer YOUR_TOKEN_HERE`
  - `Content-Type`: `application/json`
- **Request Body**: JSON
  - `message` → Magic Variable **Message Body**
  - `sender`  → Magic Variable **Sender**
  - `source`  → string `sms`

### 2.2 Show Notification (optional but recommended)

- Title: `Buddget`
- Body: `Logged your expense ✓`

### 2.3 Stop Shortcut

Tap **Done** to save.

## 3. Test it

Send yourself a test SMS that contains one of the keywords (e.g.
`Test EGP 50 spent at Talabat`). Buddget will parse the message and either:

- **Auto-add** the expense (confidence ≥ 0.8), or
- **Push you a confirm prompt** (confidence 0.6–0.8).

Anything below 0.6 is logged for review without creating an expense.

## 4. Rotate / revoke

- Open **Buddget → Settings → SMS auto-tracking → Rotate token** to generate
  a new bearer token. Update the Shortcut's `Authorization` header.
- Disable the Shortcut entirely from the Shortcuts app to stop forwarding
  messages without losing your Buddget data.

## Troubleshooting

| Problem                                 | Fix                                                                          |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| Shortcut never fires                    | The keyword list isn't matched. Add the exact phrase your bank uses.         |
| 401 Unauthorized                        | Token is wrong or rotated. Copy the latest one from `/setup/ios-sms`.        |
| Receives but no expense added           | Buddget treated the SMS as low-confidence. Check Settings → SMS log.         |
| Currency parsed wrong                   | Force currency by adding `EGP` to the SMS body when forwarding manually.     |

## Privacy

Forwarded SMS bodies are stored only as long as needed to dedupe transactions,
then trimmed. Nothing is shared with third parties. Toggle SMS auto-tracking
OFF in Buddget Settings to stop ingest immediately and clear the queue.
