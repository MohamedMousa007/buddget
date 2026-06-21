#!/usr/bin/env bash
# On-demand kick for the Linear release bot (e.g. from an iOS Shortcut over SSH).
# Safe to call anytime: the launchd job's mkdir lock prevents overlap with a
# scheduled run. Returns immediately; the drain runs in the background.
exec /bin/bash "/Users/mohamedmousa/Desktop/Budget Manager/buddget/scripts/linear-bot.sh"
