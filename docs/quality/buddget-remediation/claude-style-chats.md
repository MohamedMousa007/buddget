# Claude-style Buddgy chats (BDG-013, owner ruling 2026-11-20)

Mockups (approved chat screens): https://claude.ai/artifact/Fh1u8jwfpAara3z6oJVe3K#page-chats

## Behaviour
- **One chat continues.** Opening Buddgy shows the last chat and continues it, even after the app was closed. There is no 30-minute reset on the phone and no idle split on the server.
- **New chat starts fresh.** Nothing from other chats is sent.
- **Chat list in the pop-up:** New chat, search, groups (Today / Yesterday / Previous 7 days / Older), open, and delete with a confirm. A Memory row opens the existing Memories setting.
- **Delete removes the chat and its context.** The context lives only in the saved transcript on this phone. The server's `ai_chats` row holds counters, not content, and stays for usage accounting.
- **Memory is unchanged.** Facts learnt go through the existing `remember` / `forget_memory` tools and reach every chat.
- **Restoring after the app was closed:**
  - A pending proposal becomes `stale` and can't be applied.
  - A reply that was still streaming becomes a failed reply with Retry.
- **Usage stays low.** What the model gets is unchanged: the last few turns word for word plus the rule-built recap (`history.ts`). A chat past its turn or spend cap still rolls into a new server chat that carries the recap.

## Storage
- **Store:** zustand `persist`, key `buddget-buddgy-chats`, on the device only.
- **Shape:** `{ ownerId, activeId, chats: SavedChat[] }`
  - `SavedChat = { id, serverChatId, title, createdAt, updatedAt, items, tainted }`
- **Limits:**
  - At most 50 chats; the oldest goes first.
  - At most 80 items a chat; the oldest items go first.
  - The title is the first user message, trimmed to 48 characters.
- **When it writes:** only when no reply is streaming, so the phone's storage isn't written once per token.
- **Other accounts:** wiped on sign-out (`clearBudgetData`), and when a different user signs in (the `ownerId` doesn't match).

## Server
- **Migration 0340:** sets `ai_idle_minutes` to 43200 (30 days) on every plan, so the server no longer starts a new chat after 30 idle minutes.
- **Installed builds:** they still reset on the phone after 30 minutes and send no chat id, so nothing changes for them.

## Files
- **New:**
  - `src/lib/buddgy/client/savedChats.ts`: the pure helpers (restore, title, upsert, groups, search).
  - `src/lib/store/useBuddgyChats.ts`: the store.
  - `src/components/features/ai-chat/AIChatList.tsx`: the chat list.
- **Changed:** `src/hooks/useBuddgyChat.ts` (load, save, open, delete), `AIChat.tsx` and `AIChatHeader.tsx` (chats button, list view), `clearBudgetData.ts`.

## Tests
- **Unit:** the pure helpers (restore makes pending stale and streaming failed, caps, title, groups, owner wipe).
- **Migration:** a rolled-back proof on live: an idle chat 2 hours old continues instead of starting a new one.
- **Manual verification required:** the list, delete and reopen on a phone.
