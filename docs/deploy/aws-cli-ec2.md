# AWS CLI for this EC2 instance

Use a **dedicated AWS profile** on your Mac for the account that owns instance **`i-0f52ce14972819c0b`** (region **`eu-north-1`**, security group name **`launch-wizard-1`**).

Your laptop’s default `aws` profile may point at another account (e.g. `InvalidInstanceID.NotFound`). This profile avoids that.

---

## 1. Create an IAM user (AWS Console)

In the **same AWS account** where the EC2 instance was launched:

1. **IAM** → **Users** → **Create user** (e.g. `ros-deploy-mac`).
2. **Attach permissions** — pick one:

   **Option A (narrow, recommended)** — inline policy:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "ec2:DescribeInstances",
           "ec2:DescribeSecurityGroups",
           "ec2:AuthorizeSecurityGroupIngress",
           "ec2:RevokeSecurityGroupIngress"
         ],
         "Resource": "*"
       }
     ]
   }
   ```

   **Option B (console only)** — skip CLI; open **EC2** → **Instances** → **Security** → security group → **Edit inbound rules** (see step 4 below).

3. **Create access key** → **Local code / CLI** → save **Access key ID** and **Secret access key** once (store in a password manager; never commit to git).

---

## 2. Project-only profile (this repo)

Credentials live under **`CREDS/`** (gitignored), not in `~/.aws`. Your global AWS default is unchanged.

```bash
cd /path/to/REA-POS
source scripts/use-aws-ros.sh
```

That sets `AWS_PROFILE=ros-ec2`, `AWS_CONFIG_FILE`, and `AWS_SHARED_CREDENTIALS_FILE` to `CREDS/aws-config.ini` and `CREDS/aws-credentials.ini`.

To add or rotate keys, edit `CREDS/aws-credentials.ini` or copy from `CREDS/aws-creds.txt` (never commit).

**Do not** run `aws configure` without a profile name on this machine if you want to keep a separate default account for other work.

---

## 3. Verify you’re on the right account

```bash
source scripts/use-aws-ros.sh

aws sts get-caller-identity
aws ec2 describe-instances \
  --region eu-north-1 \
  --instance-ids i-0f52ce14972819c0b \
  --query 'Reservations[0].Instances[0].{State:State.Name,PublicIp:PublicIpAddress,SG:SecurityGroups}' \
  --output table
```

If `describe-instances` fails with **NotFound**, the keys are for the wrong account or region.

---

## 4. Open inbound **5432** for your IP only

Your current public IPv4 (check before each change if you’re on a new network):

```bash
MY_IP=$(curl -sS https://ipv4.icanhazip.com)
echo "$MY_IP"
```

Get security group ID:

```bash
SG_ID=$(aws ec2 describe-instances \
  --region eu-north-1 \
  --instance-ids i-0f52ce14972819c0b \
  --query 'Reservations[0].Instances[0].SecurityGroups[0].GroupId' \
  --output text)
echo "$SG_ID"
```

Add Postgres rule (replace if rule already exists):

```bash
aws ec2 authorize-security-group-ingress \
  --region eu-north-1 \
  --group-id "$SG_ID" \
  --protocol tcp \
  --port 5432 \
  --cidr "${MY_IP}/32" \
  --tag-specifications 'ResourceType=security-group-rule,Tags=[{Key=Name,Value=ros-pg-from-mac}]'
```

**Optional — billing UI on the internet:**

```bash
aws ec2 authorize-security-group-ingress \
  --region eu-north-1 \
  --group-id "$SG_ID" \
  --protocol tcp \
  --port 80 \
  --cidr "${MY_IP}/32"
```

**Console alternative:** EC2 → **Security Groups** → `launch-wizard-1` → **Inbound rules** → Add: **PostgreSQL**, port **5432**, source **My IP**.

---

## 5. Server Postgres (SSH — not AWS)

Security group only opens the firewall. On the instance you still need:

- `listen_addresses = '*'` in `postgresql.conf`
- `pg_hba.conf` line for your IP with **scram-sha-256**
- Strong password for role **`rea_app`** in `/home/ec2-user/ros/.env` and repo `.env` (gitignored)

After you run step 3 successfully, ask in chat to apply DB password + remote listen on the server, or follow the checklist in [ec2-ros.md](./ec2-ros.md).

---

## 6. Local repo `.env` (hybrid dev)

Connection strings are in **`CREDS/ros-dev.env`** (copy to **`.env`** at repo root). The API loads `.env` automatically.

```bash
cp .env.example .env   # then align with CREDS/ros-dev.env
npm run dev:clone
```

See [local-hybrid-dev.md](./local-hybrid-dev.md).

---

## What to paste here (no secrets)

When the profile works, you can share:

- `aws sts get-caller-identity` (account ID + ARN)
- Output of the `describe-instances` table (state, public IP, SG id)

Do **not** paste access keys or database passwords in chat.