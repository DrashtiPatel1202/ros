import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto"
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"
import { pool } from "./db.ts"
import { redis } from "./redis.ts"
import { sendError } from "./http.ts"

const COOKIE = "rea_billing_session"
const DEMO_EMAIL = "demo@harbour.kitchen"
const DEMO_PASSWORD = "demo1234"

type BillingSession = {
  adminId: number
  adminName: string
  email: string
  twoFactorEnabled: boolean
  outletId: number
  outletName: string
  brandCount: number
  timezone: string
  appVersion: string
}

function hashPassword(password: string, salt = randomBytes(16)): string {
  const hash = scryptSync(password, salt, 32)
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`
}

function verifyPassword(password: string, stored: string): boolean {
  const [kind, saltB64, hashB64] = stored.split("$")
  if (kind !== "scrypt" || !saltB64 || !hashB64) return false
  const expected = Buffer.from(hashB64, "base64")
  const actual = scryptSync(password, Buffer.from(saltB64, "base64"), expected.length)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function readToken(request: FastifyRequest): string | null {
  const header = request.headers.cookie
  if (!header) return null
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=")
    if (name === COOKIE) return decodeURIComponent(rest.join("="))
  }
  return null
}

async function readSession(request: FastifyRequest): Promise<BillingSession | null> {
  const token = readToken(request)
  if (!token) return null
  const raw = await redis.get(`billing-session:${token}`)
  if (!raw) return null
  return JSON.parse(raw) as BillingSession
}

async function writeSession(reply: FastifyReply, session: BillingSession) {
  const token = randomBytes(32).toString("base64url")
  await redis.set(`billing-session:${token}`, JSON.stringify(session), "EX", 60 * 60 * 12)
  reply.header(
    "set-cookie",
    `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 12}`,
  )
}

async function clearSession(request: FastifyRequest, reply: FastifyReply) {
  const token = readToken(request)
  if (token) await redis.del(`billing-session:${token}`)
  reply.header("set-cookie", `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`)
}

function publicSession(session: BillingSession) {
  return {
    adminName: session.adminName,
    email: session.email,
    twoFactorEnabled: session.twoFactorEnabled,
    outlet: {
      id: session.outletId,
      name: session.outletName,
      brandCount: session.brandCount,
      timezone: session.timezone,
    },
    appVersion: session.appVersion,
  }
}

async function requireBilling(request: FastifyRequest, reply: FastifyReply) {
  const session = await readSession(request)
  if (!session) {
    await sendError(reply, 401, "UNAUTHENTICATED", "Sign in to continue.")
    return null
  }
  return session
}

export async function ensureBillingAdmin() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS billing_admins (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      outlet_id bigint NOT NULL REFERENCES outlets (id),
      display_name text NOT NULL,
      email text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      two_factor_enabled boolean NOT NULL DEFAULT false,
      dismissed_actions text[] NOT NULL DEFAULT '{}',
      fssai text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  const existing = await pool.query("SELECT id FROM billing_admins WHERE email = $1", [DEMO_EMAIL])
  if (!existing.rowCount) {
    const outlet = await pool.query<{ id: string }>("SELECT id FROM outlets ORDER BY id LIMIT 1")
    if (!outlet.rowCount) return
    await pool.query(
      `INSERT INTO billing_admins (outlet_id, display_name, email, password_hash)
       VALUES ($1, 'Floor manager', $2, $3)`,
      [outlet.rows[0]!.id, DEMO_EMAIL, hashPassword(DEMO_PASSWORD)],
    )
  }
}

export async function registerBillingRoutes(app: FastifyInstance) {
  await ensureBillingAdmin()

  app.get("/api/v1/billing/session", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    return publicSession(session)
  })

  app.post("/api/v1/billing/session/identify", async (request, reply) => {
    const parsed = z.object({ identifier: z.string().trim().min(3).max(120) }).safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Enter email or mobile number")
    const identifier = parsed.data.identifier.toLowerCase()
    const found = await pool.query("SELECT email FROM billing_admins WHERE lower(email) = $1", [identifier])
    if (!found.rowCount && !/^\+?\d{10,15}$/.test(parsed.data.identifier.replace(/\s/g, ""))) {
      return sendError(reply, 404, "NOT_FOUND", "We couldn't find an account with that email or mobile.")
    }
    const email = found.rows[0]?.email ?? DEMO_EMAIL
    const [user, domain] = email.split("@")
    const masked = `${user.slice(0, 2)}***@${domain}`
    return { ok: true, maskedHint: found.rowCount ? masked : parsed.data.identifier }
  })

  app.post("/api/v1/billing/session", async (request, reply) => {
    const parsed = z
      .object({
        identifier: z.string().trim().min(3),
        password: z.string().min(4),
      })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Email/mobile and password are required")

    const ip = request.ip
    const attempts = await redis.incr(`billing-login:${ip}`)
    if (attempts === 1) await redis.expire(`billing-login:${ip}`, 15 * 60)
    if (attempts > 10) return sendError(reply, 429, "RATE_LIMITED", "Too many tries. Wait a few minutes.")

    const found = await pool.query<{
      id: string
      display_name: string
      email: string
      password_hash: string
      two_factor_enabled: boolean
      outlet_id: string
      name: string
      timezone: string
    }>(
      `SELECT a.id, a.display_name, a.email, a.password_hash, a.two_factor_enabled,
              o.id AS outlet_id, o.name, o.timezone
       FROM billing_admins a
       JOIN outlets o ON o.id = a.outlet_id
       WHERE lower(a.email) = lower($1)
       LIMIT 1`,
      [parsed.data.identifier],
    )
    const admin = found.rows[0]
    if (!admin || !verifyPassword(parsed.data.password, admin.password_hash)) {
      return sendError(reply, 401, "BAD_CREDENTIALS", "Email/mobile or password is incorrect.")
    }
    await redis.del(`billing-login:${ip}`)
    const session: BillingSession = {
      adminId: Number(admin.id),
      adminName: admin.display_name,
      email: admin.email,
      twoFactorEnabled: admin.two_factor_enabled,
      outletId: Number(admin.outlet_id),
      outletName: admin.name,
      brandCount: 0,
      timezone: admin.timezone,
      appVersion: "129.0.1",
    }
    await writeSession(reply, session)
    return publicSession(session)
  })

  app.delete("/api/v1/billing/session", async (request, reply) => {
    await clearSession(request, reply)
    return { ok: true }
  })

  app.put("/api/v1/billing/profile", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const parsed = z
      .object({
        twoFactorEnabled: z.boolean().optional(),
        currentPassword: z.string().optional(),
        newPassword: z.string().min(6).optional(),
      })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Invalid profile update")

    if (parsed.data.newPassword) {
      const row = await pool.query<{ password_hash: string }>(
        "SELECT password_hash FROM billing_admins WHERE id = $1",
        [session.adminId],
      )
      if (!row.rows[0] || !verifyPassword(parsed.data.currentPassword ?? "", row.rows[0].password_hash)) {
        return sendError(reply, 401, "BAD_PASSWORD", "Current password is incorrect.")
      }
      await pool.query("UPDATE billing_admins SET password_hash = $2 WHERE id = $1", [
        session.adminId,
        hashPassword(parsed.data.newPassword),
      ])
    }
    if (typeof parsed.data.twoFactorEnabled === "boolean") {
      await pool.query("UPDATE billing_admins SET two_factor_enabled = $2 WHERE id = $1", [
        session.adminId,
        parsed.data.twoFactorEnabled,
      ])
      session.twoFactorEnabled = parsed.data.twoFactorEnabled
    }
    const token = readToken(request)
    if (token) await redis.set(`billing-session:${token}`, JSON.stringify(session), "EX", 60 * 60 * 12)
    return publicSession(session)
  })

  app.get("/api/v1/billing/dashboard", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    reply.header("cache-control", "private, max-age=15")
    const range = String((request.query as { range?: string }).range ?? "today")
    const admin = await pool.query<{ dismissed_actions: string[] | null; fssai: string | null }>(
      "SELECT dismissed_actions, fssai FROM billing_admins WHERE id = $1",
      [session.adminId],
    )
    const dismissed = new Set(admin.rows[0]?.dismissed_actions ?? [])
    const actions = [
      {
        id: "missing-photos",
        title: "Items missing photos",
        detail: "Add photos so online channels look complete.",
      },
      {
        id: "fssai",
        title: "FSSAI Lic No.",
        detail: "Add your FSSAI licence number for compliance.",
      },
      {
        id: "tax-config",
        title: "Tax Configuration",
        detail: "Some items still need tax assignment.",
      },
    ].filter((item) => !dismissed.has(item.id) && !(item.id === "fssai" && admin.rows[0]?.fssai))

    const dateLabel =
      range === "yesterday"
        ? "Yesterday"
        : range === "last_7"
          ? "Last 7 Days"
          : range === "last_30"
            ? "Last 30 Days"
            : range === "this_month"
              ? "This Month"
              : range === "last_month"
                ? "Last Month"
                : new Intl.DateTimeFormat("en-GB", {
                    day: "numeric",
                    month: "short",
                  }).format(new Date())

    return {
      sync: { posDaysAgo: 1545, ordersDaysAgo: 1624 },
      sales: {
        dateLabel,
        totalPaise: 0,
        orderCount: 0,
        byTender: [
          { label: "Cash", amountPaise: 0, share: 0 },
          { label: "Card", amountPaise: 0, share: 0 },
          { label: "Other", amountPaise: 0, share: 0 },
          { label: "Due Payment", amountPaise: 0, share: 0 },
          { label: "Not paid", amountPaise: 0, share: 0 },
          { label: "Online", amountPaise: 0, share: 0 },
        ],
        byChannel: [
          {
            key: "dine_in",
            label: "Dine In",
            totalPaise: 0,
            orderCount: 0,
            share: 0,
            minPaise: 0,
            avgPaise: 0,
            maxPaise: 0,
            discountPaise: 0,
            taxPaise: 0,
            ttaMinutes: 0,
          },
          {
            key: "pickup",
            label: "Pick Up",
            totalPaise: 0,
            orderCount: 0,
            share: 0,
            minPaise: 0,
            avgPaise: 0,
            maxPaise: 0,
            discountPaise: 0,
            taxPaise: 0,
            ttaMinutes: 0,
          },
          {
            key: "delivery",
            label: "Delivery",
            totalPaise: 0,
            orderCount: 0,
            share: 0,
            minPaise: 0,
            avgPaise: 0,
            maxPaise: 0,
            discountPaise: 0,
            taxPaise: 0,
            ttaMinutes: 0,
          },
        ],
        chart: {
          categories: ["12 AM", "4 AM", "8 AM", "12 PM", "4 PM", "8 PM"],
          dineIn: [0, 0, 0, 0, 0, 0],
          pickup: [0, 0, 0, 0, 0, 0],
          delivery: [0, 0, 0, 0, 0, 0],
        },
      },
      online: { totalOrders: 0, prepaid: 0, cod: 0, revenuePaise: 0, platforms: [] },
      actionCenter: actions,
      snapshotReady: true,
      snapshotDate: "18th November, 2026",
      expenses: { expensePaise: 0, withdrawalPaise: 0, topupPaise: 0 },
      retentionPct: 0,
      risk: {
        unverifiedPaise: 0,
        checks: ["payment matched to bill", "billed = collected", "every bill has payment"],
      },
    }
  })

  app.post("/api/v1/billing/dashboard/fssai", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const parsed = z.object({ fssai: z.string().trim().min(5).max(40) }).safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Enter a valid FSSAI number")
    await pool.query("UPDATE billing_admins SET fssai = $2 WHERE id = $1", [session.adminId, parsed.data.fssai])
    return { ok: true }
  })

  app.post("/api/v1/billing/dashboard/actions/:id/dismiss", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const id = (request.params as { id: string }).id
    await pool.query(
      `UPDATE billing_admins
       SET dismissed_actions = array(SELECT DISTINCT unnest(dismissed_actions || $2::text[]))
       WHERE id = $1`,
      [session.adminId, [id]],
    )
    return { ok: true }
  })
}
