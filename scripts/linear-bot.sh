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

# Single-flight lock. Reclaim if stale (>2h: a prior run hung or crashed).
if ! mkdir "$LOCKDIR" 2>/dev/null; then
  if [ -n "$(find "$LOCKDIR" -maxdepth 0 -mmin +120 2>/dev/null)" ]; then
    rmdir "$LOCKDIR" 2>/dev/null && mkdir "$LOCKDIR" 2>/dev/null || { echo "$(date) lock busy, skip" >>"$LOG"; exit 0; }
  else
    echo "$(date) lock busy, skip" >>"$LOG"; exit 0
  fi
fi
trap 'rmdir "$LOCKDIR" 2>/dev/null' EXIT

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
