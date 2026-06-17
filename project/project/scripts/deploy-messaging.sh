#!/usr/bin/env bash
set -euo pipefail

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI not found. Install with: npm i -g supabase" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Deploying messaging schema and functions..."

supabase db push
supabase functions deploy \
  start-store-conversation \
  send-store-message \
  mark-store-conversation-read \
  create-support-thread \
  send-support-message \
  mark-support-thread-read \
  admin-create-announcement \
  mark-announcement-read \
  admin-send-direct-message

echo "Messaging deployment complete."
