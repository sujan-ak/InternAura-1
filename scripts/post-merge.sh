#!/bin/bash
set -e
pnpm install --frozen-lockfile

# FIX (gap #19): this was `pnpm --filter db push`. pnpm filters by PACKAGE NAME,
# and the package is named "@workspace/db" — so `--filter db` matched nothing and
# this post-merge migration hook has always been a silent no-op.
pnpm --filter @workspace/db push
