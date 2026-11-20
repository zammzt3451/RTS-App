# Deploy runbook — rts.thewanderingowl.net

This runbook is written for **Claude Code running on the web server**, and works just as well for a person.
The server already hosts another site (the trip planner). **That site must keep working throughout.**

Target: RTS-App served at `https://rts.thewanderingowl.net`, behind the web server that's already there.

## Ground rules

- **Never** stop, restart, or reconfigure the trip planner or any other existing site. Only *add* a new site block and *reload* the proxy.
- Before editing any existing config file, copy it to `<file>.bak-<date>`.
- Always run the proxy's config test (`nginx -t`, `caddy validate`, `apachectl configtest`) **before** reloading. If the test fails, undo your change and stop.
- Ask the user before you install packages, open firewall ports, edit an existing file, or run `certbot`.
- Don't set the app password and don't print secrets. The user sets the password in the browser.
- If anything is unclear (for example, which proxy serves port 443), report what you found and ask. Don't guess.

## 1 · Preflight

```sh
uname -a; cat /etc/os-release | head -3
docker --version && docker compose version   # Compose v2 is required (v2.24+ if using the Traefik override)
git --version
```
If Docker or Compose v2 is missing, tell the user and ask before installing.

## 2 · Discover the existing web server

```sh
sudo ss -ltnp '( sport = :80 or sport = :443 )'
systemctl is-active nginx caddy apache2 httpd 2>/dev/null
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
```
Work out which of these owns ports 80/443:

| Found | Use |
|---|---|
| nginx on the host | `proxy/nginx.conf` |
| Caddy on the host | `proxy/Caddyfile` |
| Apache on the host | `proxy/apache.conf` |
| Traefik in Docker | `proxy/traefik.compose.override.yml` |
| nginx or Caddy **in Docker** | Same snippet, but put `rts-app` on the proxy's Docker network and proxy to `rts-app:3000` instead of `127.0.0.1:PORT` |

Find where the trip planner's site config lives (for example `sudo nginx -T | grep -n server_name`, or the Caddyfile path). Note its domain. Then record a baseline: `curl -sI https://<trip-planner-domain> | head -1`.

## 3 · DNS

```sh
getent ahosts rts.thewanderingowl.net || echo "no DNS record yet"
curl -s https://ifconfig.me; echo
```
`rts.thewanderingowl.net` must resolve to this server, the same way the trip planner's domain does. If it doesn't, tell the user to add an **A record** (or a CNAME to the trip planner's hostname) at their DNS provider, then continue with steps 4–5 while it propagates.

## 4 · Get the code and configure

```sh
sudo mkdir -p /opt/rts-app && sudo chown "$USER" /opt/rts-app
git clone https://github.com/zammzt3451/RTS-App.git /opt/rts-app
cd /opt/rts-app/deploy
cp .env.example .env
```
Then:
- **Port:** check that `RTS_PORT` (default 3070) is free with `ss -ltn | grep :3070`. If it's taken, choose another free port and use it everywhere below.
- **IDs:** set `RTS_UID` / `RTS_GID` to the output of `id -u` / `id -g`.
- **Data folder:** `mkdir -p data && chmod 700 data`. It must be owned by `RTS_UID`.

## 5 · Build and start

```sh
docker compose up -d --build
sleep 3
curl -fsS http://127.0.0.1:3070/healthz        # expect {"ok":true}
docker compose logs app | grep -i "setup code"
```
If the health check fails, read `docker compose logs app` and fix it before touching the proxy.

## 6 · Add the site to the proxy

Copy the matching snippet from `deploy/proxy/` and change the port if you picked a different one.

- **nginx:** copy to `/etc/nginx/sites-available/rts.thewanderingowl.net`, then symlink it into `sites-enabled/` (or use `/etc/nginx/conf.d/rts.conf` if that's how this server is organised). Run `sudo nginx -t && sudo systemctl reload nginx`.
- **Caddy:** append the block to the existing Caddyfile (back it up first). Run `caddy validate --config <path> && sudo systemctl reload caddy`, or reload the container.
- **Apache:** run `sudo a2enmod proxy proxy_http headers`, copy the file, `sudo a2ensite rts.thewanderingowl.net`, then `sudo apachectl configtest && sudo systemctl reload apache2`.
- **Traefik:** `docker compose -f compose.yml -f proxy/traefik.compose.override.yml up -d`, with `TRAEFIK_NETWORK` and `TRAEFIK_CERTRESOLVER` set in `.env` to match the existing Traefik setup.

## 7 · HTTPS

- **nginx / Apache:** ask the user, then run `sudo certbot --nginx -d rts.thewanderingowl.net` (or `--apache`). Choose to redirect HTTP to HTTPS. If certbot isn't installed, ask before installing it.
- **Caddy / Traefik:** certificates are automatic once DNS resolves.

The app sets `Secure` cookies, so login only works over HTTPS. That's expected.

## 8 · Verify

```sh
curl -sI https://rts.thewanderingowl.net | head -1                    # expect 200
curl -s  https://rts.thewanderingowl.net/healthz                       # {"ok":true}
curl -sI https://<trip-planner-domain> | head -1                       # must match the step 2 baseline
```

## 9 · Hand over

Tell the user:
1. Open **https://rts.thewanderingowl.net**
2. Enter the one-time **setup code** (from `docker compose logs app`, or `SETUP_CODE` in `.env`)
3. Choose a username and password (10+ characters). This first account is the **site admin**. Step Zero starts right away.
4. To add people: More → **Site admin** → *Create invite code*.

## 10 · Backups (offer this)

```sh
cd /opt/rts-app/deploy && ./backup.sh /var/backups/rts      # test it once
# Nightly at 03:15 (add with: crontab -e)
15 3 * * * /opt/rts-app/deploy/backup.sh /var/backups/rts >/dev/null 2>&1
```
Ask the user before adding the cron entry. Backups hold their private journal, so keep the folder at `chmod 700`.

## 11 · Report

Finish with a short summary for the user: the proxy type, the port, the files you created or changed (with backup paths), HTTPS status, the backup schedule, and confirmation that the trip planner still responds.

---

## Updating later

```sh
cd /opt/rts-app && git pull && cd deploy && docker compose up -d --build
curl -fsS http://127.0.0.1:3070/healthz
```
Data in `deploy/data` is kept across updates.

**Upgrading from the single-user version:** on first start the app backs up the old database (`data/rts-before-multiuser-*.sqlite`), then moves everything into an admin account. The username comes from `ADMIN_USERNAME` in `.env` (default `admin`), and the password stays the same. Tell the user their username, and check `docker compose logs app` for the "Moved existing data" line.

## Rolling back / removing

```sh
cd /opt/rts-app/deploy && docker compose down          # stops the app, keeps data
```
Remove the site block you added (or restore its `.bak-` copy), run the config test, then reload the proxy. Nothing else on the server was changed.
