#!/usr/bin/env bash
# Dispatch BOTH native release workflows (iOS -> TestFlight, Android -> APK on Drive).
# Builds run on GitHub Actions; no local Xcode / Android Studio needed.
# Usage: native-release.sh [label] [--force]
set -euo pipefail

LABEL=""
FORCE=false
for a in "$@"; do
  case "$a" in
    --force) FORCE=true ;;
    *) LABEL="$a" ;;
  esac
done

export GH_TOKEN="${GH_TOKEN:-$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill | sed -n 's/^password=//p')}"
REF="$(git rev-parse --abbrev-ref HEAD)"

# The workflows build what is on GitHub for $REF, not the local checkout: refuse to build stale code.
git fetch -q origin "$REF"
if ! git merge-base --is-ancestor HEAD "origin/$REF"; then
  echo "origin/$REF does not contain your HEAD ($(git rev-parse --short HEAD)). Push it first: git push origin HEAD:refs/heads/$REF" >&2
  exit 1
fi

gh workflow run ios-release.yml --ref "$REF" -f force="$FORCE"
gh workflow run android-release.yml --ref "$REF" -f force="$FORCE" -f label="$LABEL"

sleep 5
gh run list --limit 4 --json workflowName,url,status -q '.[] | "\(.workflowName)\t\(.status)\t\(.url)"'
