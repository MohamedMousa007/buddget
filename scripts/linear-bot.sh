#!/usr/bin/env bash
# Unattended driver for the Linear release bot. Invoked hourly by launchd.
# Single-flight via a mkdir lock; logs to .claude/linear-bot.log.
set -uo pipefail

ROOT="/Users/mohamedmousa/Desktop/Budget Manager/buddget"
LOG="$ROOT/.claude/linear-bot.log"
LOCKDIR="/tmp/buddget-linear-bot.lock"

# Toolchain PATH (launchd does not load the login shell profile).
export PATH="/Users/mohamedmousa/.local/bin:/Users/mohamedmousa/.nvm/versions/node/v24.12.0/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"

cd "$ROOT" || exit 1

# Single-flight lock with self-heal. The owner writes its PID into the lockdir.
# A SIGKILL (e.g. a foreground run hitting a tool timeout) skips the EXIT trap
# and orphans the lock; rather than block every run for 2h, a contending run
# reclaims the lock the moment it sees the owner PID is dead. Belt-and-braces:
# if the owner is somehow still alive but has run >2h, treat it as hung, kill it,
# and reclaim.
acquire_lock() { mkdir "$LOCKDIR" 2>/dev/null && echo $$ >"$LOCKDIR/pid"; }
if ! acquire_lock; then
  owner="$(cat "$LOCKDIR/pid" 2>/dev/null)"
  if [ -z "$owner" ] || ! kill -0 "$owner" 2>/dev/null; then
    reason="dead owner (${owner:-none})"
  elif [ -n "$(find "$LOCKDIR" -maxdepth 0 -mmin +120 2>/dev/null)" ]; then
    kill "$owner" 2>/dev/null; reason="hung owner ($owner, >2h)"
  else
    echo "$(date) lock busy (owner=$owner alive), skip" >>"$LOG"; exit 0
  fi
  rm -rf "$LOCKDIR"
  acquire_lock || { echo "$(date) lock busy, reclaim failed, skip" >>"$LOG"; exit 0; }
  echo "$(date) reclaimed stale lock: $reason" >>"$LOG"
fi
trap 'rm -rf "$LOCKDIR"' EXIT

echo "===== $(date) run start =====" >>"$LOG"

# Drain the queue: one fresh `claude` session per ticket (clean context = fewer
# tokens, higher accuracy). Stop when Linear reports NO_TICKETS, or on a run that
# produced neither DONE nor NO_TICKETS (a crash — avoid a runaway loop). MAX caps it.
MAX=25
for ((i = 1; i <= MAX; i++)); do
  echo "----- ticket iteration $i $(date) -----" >>"$LOG"
  OUT=$(claude -p "/linear-backlog" --model sonnet --dangerously-skip-permissions 2>&1)
  echo "$OUT" >>"$LOG"
  if grep -q "NO_TICKETS" <<<"$OUT"; then
    echo "queue empty, stopping" >>"$LOG"; break
  fi
  if ! grep -q "DONE " <<<"$OUT"; then
    echo "iteration produced no DONE/NO_TICKETS — stopping to avoid runaway" >>"$LOG"; break
  fi
done

echo "===== $(date) run end =====" >>"$LOG"
