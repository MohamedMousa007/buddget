#!/usr/bin/env bash
# Nightly encrypted backup of the production database (the free plan has none).
# Dumps schema + data of public/auth/storage, encrypts with AES-256, keeps the newest 14, writes to $BACKUP_DIR.
# Install: docs/launch/DB-load-phaseA.md ("Nightly backup"). Never prints the connection string or key.
#
# Config (first match wins): environment, then ~/.config/buddget/backup.env, which may set:
#   BACKUP_DB_URL   postgres:// session-pooler URI of the production database (with password). Recommended: uses local pg_dump.
#   BACKUP_DIR      default ~/Backups/buddget
#   BACKUP_KEY_FILE default ~/.config/buddget/backup.key  (a long random passphrase, chmod 600; lose it and the backups are unreadable)
#   BACKUP_KEEP     default 14
# Without BACKUP_DB_URL it falls back to `supabase db dump --linked` (needs Docker and `supabase link`).
set -euo pipefail

[ -f "$HOME/.config/buddget/backup.env" ] && . "$HOME/.config/buddget/backup.env"
BACKUP_DIR="${BACKUP_DIR:-$HOME/Backups/buddget}"
BACKUP_KEY_FILE="${BACKUP_KEY_FILE:-$HOME/.config/buddget/backup.key}"
BACKUP_KEEP="${BACKUP_KEEP:-14}"
PATH="/opt/homebrew/bin:/opt/homebrew/opt/postgresql@16/bin:/usr/local/bin:$PATH"

[ -r "$BACKUP_KEY_FILE" ] || { echo "backup: key file $BACKUP_KEY_FILE missing" >&2; exit 1; }
mkdir -p "$BACKUP_DIR"; chmod 700 "$BACKUP_DIR"

stamp="$(date +%Y%m%d-%H%M%S)"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
dump="$tmp/buddget-$stamp.dump"

if [ -n "${BACKUP_DB_URL:-}" ]; then
  # Custom format is compressed and restorable selectively: pg_restore -d <target> file.dump
  pg_dump --format=custom --no-owner --no-privileges -n public -n auth -n storage -n vault "$BACKUP_DB_URL" -f "$dump"
else
  supabase db dump --linked -f "$tmp/schema.sql" >/dev/null
  supabase db dump --linked --data-only -f "$tmp/data.sql" >/dev/null
  supabase db dump --linked --role-only -f "$tmp/roles.sql" >/dev/null || true
  tar -C "$tmp" -cf "$dump" schema.sql data.sql $( [ -s "$tmp/roles.sql" ] && echo roles.sql )
fi

out="$BACKUP_DIR/buddget-$stamp.dump.enc"
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -in "$dump" -out "$out" -pass "file:$BACKUP_KEY_FILE"
chmod 600 "$out"
[ -s "$out" ] || { echo "backup: empty output" >&2; exit 1; }

# keep the newest N
ls -1t "$BACKUP_DIR"/buddget-*.dump.enc | tail -n +"$((BACKUP_KEEP + 1))" | while read -r f; do rm -f -- "$f"; done
echo "backup ok: $(basename "$out") ($(du -h "$out" | cut -f1)), kept $(ls -1 "$BACKUP_DIR"/buddget-*.dump.enc | wc -l | tr -d ' ')"
# Restore:  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in FILE.enc -out FILE.dump -pass file:$BACKUP_KEY_FILE
