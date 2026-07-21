#!/usr/bin/env bash
set -e

# NFR-R3: Backup-restore rehearsal script
# This script standardizes the quarterly rehearsal process using Supabase PITR.

echo "=== Supabase Point-in-Time Recovery Rehearsal ==="
echo ""
echo "This is an interactive guide for the quarterly database restore rehearsal."
echo "Follow these steps explicitly:"
echo ""
echo "1. Log in to the Supabase Dashboard -> Database -> Backups."
echo "2. Select 'Point in Time Recovery'."
echo "3. Choose a recovery point (e.g., exactly 2 hours ago)."
echo "4. Restore to a NEW project (select your 'Staging' or 'Dry-run' project)."
echo "5. Wait for the restore to complete."
echo "6. Update DATABASE_URL_SEED in your local packages/db/.env to point to this restored database."
echo "7. Run \`pnpm run test:e2e\` to verify data and schema integrity."
echo ""
echo "If tests pass and data matches expectations, document the success."
echo "Did the rehearsal succeed? Log it in scripts/ops/restore-log.md."
