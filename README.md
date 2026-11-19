# RTS-App · Transurfing, Book I

A personal Reality Transurfing practice RPG. It's a self-hosted web app for one person.

It **practices** Transurfing and doesn't gamify attainment. XP ("practice") counts awareness, intention and reflection only. There are no streaks, no fail states and nothing overdue. A day you don't log is simply *unrecorded*.

## What's inside

| Page | What it does |
|---|---|
| **Step Zero** | Guided first run. Each goal passes six gates: mine, an end, a comfortable slide, held calmly, my own life (Freiling), and an enjoyable door. Release any goal at any time. |
| **Quest Board** | Four weekly invitations built from your goals. Accept, decline, or let go. They dissolve when the week turns. |
| **Check-In** | Morning: presence, the plait, then a frame declared and released. Evening: mirror work. You can fill in the past 7 days. |
| **Slide Album** | Target and process slides with images and present-tense notes. Mark one "Feels off" to revisit it, or "Arrived" with the real photo and date. |
| **The Tale** | Original prologue plus 12 chapters, each sealed until you reach its level. Each chapter has a one-time Trial (+30). |
| **Chronicle** | Your mirror journal. |
| **Observatory** | Honest stats from real recorded data only. |
| **Realm & Hall** | The journey map and your portrait in 12 forms of growing radiance. |

Levels: 0 → 100 → 200 → 600 → 1,200 → 2,000 → 3,000 → 4,200 → 5,800 → 7,800 → 10,200 → 13,000 (about 12–15 months of steady practice). Reaching level 12 opens the Book II (Tufti) hook. Everything you've earned carries over.

## Privacy

This repo holds **code only**. Your goals, journal and photos live in `./data` on your server, which is git-ignored. Settings → *Download export* gives you a full JSON backup.

## Deploy (home server, Docker)

1. **DNS:** point a hostname (e.g. a DDNS name) at your home's public IP.
2. **Router:** forward ports **80** and **443** to the server. (On UniFi: Settings → Firewall & Security → Port Forwarding.)
3. **On the server:**
   ```sh
   git clone https://github.com/zammzt3451/RTS-App.git && cd RTS-App
   cp .env.example .env      # set DOMAIN=your.hostname
   docker compose up -d --build
   docker compose logs app   # shows your one-time setup code
   ```
4. Open `https://your.hostname`, enter the setup code and choose a password. Caddy gets the HTTPS certificate automatically.

**Update:** `git pull && docker compose up -d --build`
**Back up:** copy the `./data` folder.

## Security notes

- Single-user password (scrypt hash). Session cookies are HttpOnly, Secure and SameSite=Strict.
- Login is rate-limited (5 failures per 15 minutes per IP).
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
