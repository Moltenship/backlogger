#!/usr/bin/env bash
set -euo pipefail

case "${VERCEL_ENV:-}" in
  production)
    bunx convex deploy --cmd "bun run build" --cmd-url-env-var-name VITE_CONVEX_URL
    ;;
  preview)
    bunx convex dev --once
    bun run build
    ;;
  *)
    bun run build
    ;;
esac
