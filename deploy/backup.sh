#!/bin/sh
# Back up RTS-App data (SQLite + uploads) to a dated tarball.
# Usage: ./backup.sh [destination-folder]   e.g. add to cron: 15 3 * * * /path/to/deploy/backup.sh /backups/rts
set -eu
cd "$(dirname "$0")"
DATA="${RTS_DATA_DIR:-./data}"
DEST="${1:-./backups}"
mkdir -p "$DEST"
STAMP=$(date +%Y-%m-%d_%H%M)
# Consistent SQLite snapshot from inside the container, then archive.
docker exec rts-app node --disable-warning=ExperimentalWarning -e "const{DatabaseSync}=require('node:sqlite');new DatabaseSync('/data/rts.sqlite').exec(\"VACUUM INTO '/data/rts-backup.sqlite'\")"
tar -czf "$DEST/rts-$STAMP.tar.gz" -C "$DATA" rts-backup.sqlite uploads
rm -f "$DATA/rts-backup.sqlite"
# Keep the 30 most recent backups.
ls -1t "$DEST"/rts-*.tar.gz 2>/dev/null | tail -n +31 | xargs -r rm -f
echo "Backup written: $DEST/rts-$STAMP.tar.gz"
