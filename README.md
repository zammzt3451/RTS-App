# RTS-App · Transurfing, Book I

A Reality Transurfing practice RPG. It's a self-hosted web app for you and the people you invite. Each person's goals, journal and images are private to them.

It **practices** Transurfing and doesn't gamify attainment. XP ("practice") counts awareness, intention and reflection only. There are no streaks, no fail states and nothing overdue. A day you don't log is simply *unrecorded*.

## What's inside

| Page | What it does |
|---|---|
| **Step Zero** | Guided first run, following Ch. X *Goals and Doors*: one **main goal** first, then optional extras. Each passes six gates: is it mine ("Do I really need it?" and the let-go test), an end not a means, the comfort test (shyness vs. heavy tension), importance, my own life (Frailing), and the door (which can wait). Release any goal at any time. |
| **Quest Board** | Four weekly invitations built from your goals. Accept, decline, or let go. They dissolve when the week turns. |
| **Check-In** | Morning: wake up in the movie, then switch on your **frame** (Ch. XIX). Evening: the mirror, coordinating intention on any setback, and the amalgam "My world takes care of me". You can fill in the past 7 days. |
| **Slide Album** | Target slides (goal already achieved, no route) with a named frame, and process slides (the current step taking shape). Mark one "Feels off" to revisit it, or "Arrived" with the real photo and date. |
| **The Tale** | Original prologue plus 12 chapters, each sealed until you reach its level. Each chapter has a one-time Trial (+30). |
| **Chronicle** | Your mirror journal. |
| **Observatory** | Honest stats from real recorded data only. |
| **Realm & Hall** | The journey map and your portrait in 12 forms of growing radiance. |

Levels: 0 → 100 → 200 → 600 → 1,200 → 2,000 → 3,000 → 4,200 → 5,800 → 7,800 → 10,200 → 13,000 (about 12–15 months of steady practice). Reaching level 12 opens the Book II (Tufti) hook. Everything you've earned carries over.

## Source

The practice logic follows *Reality Transurfing, Steps I–V*. Ideas from Zeland's later Tufti books (such as the plait) are held back for Book II.

## Accounts

- **First run:** enter the setup code from the logs, then create the admin account (username + password).
- **Inviting people:** More → **Site admin** → *Create invite code*. Share the code or link; it works once and expires after 7 days. They choose their own username and password.
- **Site admin** can kick (sign out everywhere), block/unblock, issue password-reset codes, grant or remove admin rights, and delete accounts. Admins manage accounts only — they can't see anyone's entries.
- **Upgrading from the single-user version:** existing data moves into an admin account named by `ADMIN_USERNAME` (default `admin`) with your existing password. A backup of the old database is saved first (`rts-before-multiuser-*.sqlite` in the data folder).

## Privacy

This repo holds **code only**. Your goals, journal and photos live in `./data` on your server, which is git-ignored. Settings → *Download export* gives you a full JSON backup.

## Deploy

### Option A — alongside other sites (rts.thewanderingowl.net)

Use **`deploy/`** when the server already runs a web server (nginx, Caddy, Apache or Traefik). The app listens on localhost, and your existing proxy adds the `rts.thewanderingowl.net` site and HTTPS.

**With Claude Code on the server**, paste:

> Clone https://github.com/zammzt3451/RTS-App to /opt/rts-app, then follow deploy/DEPLOY.md to deploy it at rts.thewanderingowl.net. Don't touch my other sites.

After that, run `/deploy-rts` again or `/update-rts` from inside `/opt/rts-app`. By hand: follow [`deploy/DEPLOY.md`](deploy/DEPLOY.md).

### Option B — standalone box

The root `docker-compose.yml` bundles its own Caddy on ports 80/443. Use it only on a machine with no other web server: copy `.env.example` to `.env`, set `DOMAIN`, create `./data` owned by UID 1000, then run `docker compose up -d --build`.

**Back up:** `deploy/backup.sh`, or copy the data folder.

## Security notes

- Per-user accounts with scrypt password hashes; every query is scoped to the signed-in user, and uploads are served only to their owner. Session cookies are HttpOnly, Secure and SameSite=Strict.
- Login, invite and reset codes are rate-limited (5 failures per 15 minutes per IP and per username).
- Uploads are checked by file signature and served only to a signed-in session.
- Strict Content-Security-Policy. Zero npm dependencies: only Node's built-in `http`, `crypto` and `sqlite`.

## Local development

```sh
npm run dev   # http://localhost:3000, setup code: devsetup
```
Needs Node 22.13+.

## Later: AI images

Slides keep a *style* field (Storybook / Photorealistic), and every portrait form accepts its own image. That leaves room to add an image-generation provider later without changing your data.

---
The Tale and the companion's lines are original writing in the spirit of Vadim Zeland's Transurfing. Nothing is quoted from the books.
