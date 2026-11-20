# Hybrid local dev (Mac API/UI + EC2 data)

| Runs on Mac | Runs on EC2 |
| --- | --- |
| `npm run dev:clone` (API `:4000`, billing `:5174`) | PostgreSQL `:5432`, Redis `:6379` |
| `.env` at repo root | `~/ros/.env` (localhost URLs for production API) |

## Files

- **`CREDS/ros-dev.env`** — remote `DATABASE_URL` and `REDIS_URL` (gitignored).
- **`.env`** — copy of the above for `loadEnv.ts` (gitignored).

After rotating passwords on the server, update both files and `~/ros/.env` on EC2 (use `127.0.0.1` for host there).

## Commands

```bash
cd /Users/jaypatel/Documents/REA-POS
cp CREDS/ros-dev.env .env   # if you change creds
npm run dev:clone
```

## Verify

```bash
curl http://127.0.0.1:4000/api/v1/health
# expect: {"ok":true,"db":"up","redis":"up"}
```

## AWS profile (security group / IP changes)

```bash
source scripts/use-aws-ros.sh
MY_IP=$(curl -sS https://ipv4.icanhazip.com)
# … authorize 5432 and 6379 from ${MY_IP}/32 — see aws-cli-ec2.md
```