# ROS deployment & hybrid development

This folder documents how **ros** runs on AWS EC2 and how to develop locally while sharing **one** Postgres and Redis on the server.

## Architecture

| Layer | Local Mac | EC2 (`13.60.15.181`) |
| --- | --- | --- |
| Billing UI (Vite) | `:5174` | nginx `:80` (production build) |
| API (Fastify) | `:4000` | `ros-api` systemd `:4000` |
| PostgreSQL | — | `:5432` (`rea_pos`, user `rea_app`) |
| Redis | — | `:6379` (password required) |

**Hybrid dev (recommended):** run `npm run dev:clone` on the Mac; point `.env` at EC2 for `DATABASE_URL` and `REDIS_URL`. Sessions and cache use the same Redis as the server, so billing login state is consistent with shared DB data.

## Quick start (local + remote data)

1. Copy connection template: `cp .env.example .env` and fill passwords from **`CREDS/ros-dev.env`** (created when the server was provisioned; never commit).
2. Start:

   ```bash
   npm run dev:clone
   ```

3. Open **`http://127.0.0.1:5174`** — demo billing: `demo@harbour.kitchen` / `demo1234`.

4. Health check:

   ```bash
   curl http://127.0.0.1:4000/api/v1/health
   ```

The API loads repo-root `.env` via `apps/api/src/loadEnv.ts` (no manual `export` needed for normal dev).

## Guides

| Doc | Contents |
| --- | --- |
| [local-hybrid-dev.md](./local-hybrid-dev.md) | Day-to-day hybrid dev, credential files, IP changes |
| [ec2-ros.md](./ec2-ros.md) | Server layout, systemd, nginx, deploy updates |
| [aws-cli-ec2.md](./aws-cli-ec2.md) | Project-only AWS profile (`scripts/use-aws-ros.sh`), security group rules |

## AWS & secrets (not in git)

- **`CREDS/`** — PEM, AWS keys, `ros-dev.env` (gitignored).
- **`scripts/use-aws-ros.sh`** — sets `AWS_PROFILE=ros-ec2` using `CREDS/aws-*.ini` only (does not touch `~/.aws` default).
- Security group allows **5432** and **6379** from your IPv4 (`/32`). Update rules when your IP changes ([aws-cli-ec2.md](./aws-cli-ec2.md)).

## EC2 operations cheat sheet

```bash
ssh -i CREDS/roa.pem ec2-user@13.60.15.181
sudo systemctl status ros-api nginx postgresql redis6
cd ~/ros && git pull && npm ci --include=dev && npm run db:setup && npm run build -w @rea/billing
sudo systemctl restart ros-api
```

## Instance reference

| Item | Value |
| --- | --- |
| Region | `eu-north-1` |
| Instance ID | `i-0f52ce14972819c0b` |
| Security group | `launch-wizard-1` |
| Clone path on server | `/home/ec2-user/ros` |
| Git remote | `https://github.com/DrashtiPatel1202/ros.git` |