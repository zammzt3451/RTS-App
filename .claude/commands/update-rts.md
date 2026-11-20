---
description: Update the running RTS-App to the latest code and verify it
---
Update RTS-App using the "Updating later" section of `deploy/DEPLOY.md`.
Before pulling, run `deploy/backup.sh` once. After rebuilding, confirm `/healthz` responds locally and at https://rts.thewanderingowl.net, and that the trip planner still responds. Report what changed (`git log --oneline` for the new commits).
