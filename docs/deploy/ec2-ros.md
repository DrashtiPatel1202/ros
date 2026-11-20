# EC2 deployment (ros)

## Server layout

| Path | Purpose |
| --- | --- |
| `/home/ec2-user/ros` | Git clone `https://github.com/DrashtiPatel1202/ros.git` |
| `/home/ec2-user/ros/.env` | `DATABASE_URL`, `REDIS_URL`, `PORT` |
| `/home/ec2-user/DATABASE_CREDENTIALS.txt` | DB user/password (on server only) |
| `systemd: ros-api` | `npm run start -w @rea/api` |
| `nginx` | Serves `apps/billing/dist`, proxies `/api/` → `:4000` |

## Services

```bash
sudo systemctl status ros-api nginx postgresql redis6
curl http://127.0.0.1:4000/api/v1/health
```

## Update after push

```bash
cd ~/ros && git pull && npm ci --include=dev && npm run db:setup && npm run build -w @rea/billing
sudo systemctl restart ros-api
```

## AWS security group

CLI is not configured for this EC2 account in the repo yet. Use **[aws-cli-ec2.md](./aws-cli-ec2.md)** to create IAM user + `ros-ec2` profile, then open **TCP 5432** (and **80** if needed) for **your IP only**.

Instance: `i-0f52ce14972819c0b` · Region: `eu-north-1` · SG name: `launch-wizard-1` · Public IP: `13.60.15.181`.

## Local dev using server DB + Redis

**Layout:** Vite billing + API on your Mac; **Postgres** and **Redis** on EC2 (`13.60.15.181`). Security group allows **5432** and **6379** from your IPv4 only.

1. Connection strings are in **`CREDS/ros-dev.env`** (copy to **`.env`** at repo root).
2. API loads `.env` automatically (`apps/api/src/loadEnv.ts`).
3. Start:

```bash
npm run dev:clone
```

Use **`http://127.0.0.1:5174`**. Billing: `demo@harbour.kitchen` / `demo1234`.

If your public IP changes, re-run the ingress rules in [aws-cli-ec2.md](./aws-cli-ec2.md) (ports 5432, 6379).