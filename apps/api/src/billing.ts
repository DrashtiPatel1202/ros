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
  await pool.query(
    `INSERT INTO outlets (name, timezone, currency, tax_rate_bps)
     SELECT 'Harbour Cloud Kitchen', timezone, currency, tax_rate_bps
     FROM outlets
     WHERE NOT EXISTS (SELECT 1 FROM outlets WHERE name = 'Harbour Cloud Kitchen')
     ORDER BY id
     LIMIT 1`,
  )
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

export async function checkBillingPassword(adminId: number, password: string) {
  const found = await pool.query<{ password_hash: string }>("SELECT password_hash FROM billing_admins WHERE id = $1", [adminId])
  const hash = found.rows[0]?.password_hash
  return Boolean(hash && verifyPassword(password, hash))
}

export async function registerBillingRoutes(app: FastifyInstance) {
  await ensureBillingAdmin()

  app.get("/api/v1/billing/session", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    return publicSession(session)
  })

  app.get("/api/v1/billing/outlets", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const rows = await pool.query<{ id: string; name: string; timezone: string }>(
      "SELECT id, name, timezone FROM outlets ORDER BY name",
    )
    return {
      rows: rows.rows.map((row) => ({
        id: Number(row.id),
        name: row.name,
        timezone: row.timezone,
        current: Number(row.id) === session.outletId,
      })),
    }
  })

  app.post("/api/v1/billing/session/outlet", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const parsed = z.object({ outletId: z.number().int().positive() }).safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Choose a kitchen.")
    const outlet = await pool.query<{ id: string; name: string; timezone: string }>(
      "SELECT id, name, timezone FROM outlets WHERE id = $1",
      [parsed.data.outletId],
    )
    if (!outlet.rowCount) return sendError(reply, 404, "NOT_FOUND", "That kitchen is not available.")
    session.outletId = Number(outlet.rows[0]!.id)
    session.outletName = outlet.rows[0]!.name
    session.timezone = outlet.rows[0]!.timezone
    await pool.query("UPDATE billing_admins SET outlet_id = $2 WHERE id = $1", [session.adminId, session.outletId])
    const token = readToken(request)
    if (token) await redis.set(`billing-session:${token}`, JSON.stringify(session), "EX", 60 * 60 * 12)
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

    const bounds = await pool.query<{ from_date: Date; to_date: Date; today: Date }>(
      `WITH b AS (SELECT (now() AT TIME ZONE $2)::date AS today)
       SELECT today,
         CASE $1
           WHEN 'yesterday' THEN today - 1
           WHEN 'last_7' THEN today - 6
           WHEN 'last_30' THEN today - 29
           WHEN 'this_month' THEN date_trunc('month', today)::date
           WHEN 'last_month' THEN (date_trunc('month', today) - interval '1 month')::date
           ELSE today
         END AS from_date,
         CASE $1
           WHEN 'yesterday' THEN today - 1
           WHEN 'last_month' THEN (date_trunc('month', today)::date - 1)
           ELSE today
         END AS to_date
       FROM b`,
      [range, session.timezone],
    )
    const fromDate = bounds.rows[0]!.from_date
    const toDate = bounds.rows[0]!.to_date
    const today = bounds.rows[0]!.today
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
                : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(today)

    const settled = await pool.query<{
      order_type: string
      payment_type: string
      total_paise: string
      discount_paise: string
      tax_paise: string
      paid_paise: string
      customer_phone: string | null
      business_date: Date
      created_at: Date
      settled_at: Date | null
    }>(
      `SELECT order_type, payment_type, total_paise, discount_paise, tax_paise, paid_paise,
              customer_phone, business_date, created_at, settled_at
       FROM orders
       WHERE outlet_id = $1 AND status = 'settled' AND business_date BETWEEN $2 AND $3`,
      [session.outletId, fromDate, toDate],
    )
    const rows = settled.rows
    const totalPaise = rows.reduce((sum, row) => sum + Number(row.total_paise), 0)
    const shareOf = (amount: number) => (totalPaise ? Math.round((amount / totalPaise) * 1000) / 10 : 0)
    const tenderOf = (row: (typeof rows)[number]) => {
      if (row.payment_type === "cash") return "Cash"
      if (row.payment_type === "card") return "Card"
      if (row.payment_type === "upi" || row.payment_type === "online") return "Online"
      if (row.payment_type === "due") return "Due Payment"
      if (row.payment_type === "not_paid") return "Not paid"
      return "Other"
    }
    const tenderLabels = ["Cash", "Card", "Other", "Due Payment", "Not paid", "Online"]
    const byTender = tenderLabels.map((label) => {
      const amountPaise = rows.filter((row) => tenderOf(row) === label).reduce((sum, row) => sum + Number(row.total_paise), 0)
      return { label, amountPaise, share: shareOf(amountPaise) }
    })
    const channelMeta = [
      { key: "dine_in" as const, label: "Dine In" },
      { key: "pickup" as const, label: "Pick Up" },
      { key: "delivery" as const, label: "Delivery" },
    ]
    const byChannel = channelMeta.map((channel) => {
      const mine = rows.filter((row) => row.order_type === channel.key)
      const amounts = mine.map((row) => Number(row.total_paise))
      const channelTotal = amounts.reduce((sum, amount) => sum + amount, 0)
      const minutes = mine
        .filter((row) => row.settled_at)
        .map((row) => (new Date(row.settled_at!).getTime() - new Date(row.created_at).getTime()) / 60000)
      return {
        ...channel,
        totalPaise: channelTotal,
        orderCount: mine.length,
        share: totalPaise ? Math.round((channelTotal / totalPaise) * 1000) / 10 : 0,
        minPaise: amounts.length ? Math.min(...amounts) : 0,
        avgPaise: amounts.length ? Math.round(channelTotal / amounts.length) : 0,
        maxPaise: amounts.length ? Math.max(...amounts) : 0,
        discountPaise: mine.reduce((sum, row) => sum + Number(row.discount_paise), 0),
        taxPaise: mine.reduce((sum, row) => sum + Number(row.tax_paise), 0),
        ttaMinutes: minutes.length ? Math.round(minutes.reduce((sum, value) => sum + value, 0) / minutes.length) : 0,
      }
    })
    const singleDay = range === "today" || range === "yesterday"
    const hourLabels = ["12 AM", "4 AM", "8 AM", "12 PM", "4 PM", "8 PM"]
    const chart = singleDay
      ? {
          categories: hourLabels,
          dineIn: [0, 0, 0, 0, 0, 0],
          pickup: [0, 0, 0, 0, 0, 0],
          delivery: [0, 0, 0, 0, 0, 0],
        }
      : {
          categories: [] as string[],
          dineIn: [] as number[],
          pickup: [] as number[],
          delivery: [] as number[],
        }
    if (singleDay) {
      for (const row of rows) {
        const hour = new Date(row.settled_at ?? row.created_at).getHours()
        const bucket = hour < 4 ? 0 : hour < 8 ? 1 : hour < 12 ? 2 : hour < 16 ? 3 : hour < 20 ? 4 : 5
        const rupees = Number(row.total_paise) / 100
        if (row.order_type === "dine_in") chart.dineIn[bucket] += rupees
        else if (row.order_type === "pickup") chart.pickup[bucket] += rupees
        else chart.delivery[bucket] += rupees
      }
    } else {
      const dayKey = (value: Date) => {
        const date = new Date(value)
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
      }
      const days: string[] = []
      for (let cursor = new Date(fromDate); cursor <= new Date(toDate); cursor.setDate(cursor.getDate() + 1)) {
        days.push(dayKey(cursor))
      }
      chart.categories = days.map((day) => day.slice(8) + "/" + day.slice(5, 7))
      const blank = () => days.map(() => 0)
      chart.dineIn = blank()
      chart.pickup = blank()
      chart.delivery = blank()
      for (const row of rows) {
        const key = dayKey(new Date(row.business_date))
        const index = days.indexOf(key)
        if (index < 0) continue
        const rupees = Number(row.total_paise) / 100
        if (row.order_type === "dine_in") chart.dineIn[index] += rupees
        else if (row.order_type === "pickup") chart.pickup[index] += rupees
        else chart.delivery[index] += rupees
      }
    }
    const phones = rows.map((row) => row.customer_phone?.trim()).filter((phone): phone is string => Boolean(phone))
    const phoneCounts = new Map<string, number>()
    for (const phone of phones) phoneCounts.set(phone, (phoneCounts.get(phone) ?? 0) + 1)
    const repeat = [...phoneCounts.values()].filter((count) => count > 1).length
    const onlineRows = await pool.query<{ client: string; total_paise: number; payment: string | null }>(
      `SELECT o.client, o.total_paise, b.payment_type AS payment
       FROM online_orders o
       LEFT JOIN orders b ON b.id = o.order_id
       WHERE o.outlet_id = $1 AND o.created_at::date BETWEEN $2 AND $3 AND o.status <> 'cancelled'`,
      [session.outletId, fromDate, toDate],
    )
    const platforms = new Map<string, { name: string; orders: number; prepaid: number; cod: number; revenuePaise: number }>()
    for (const row of onlineRows.rows) {
      const current = platforms.get(row.client) ?? { name: row.client, orders: 0, prepaid: 0, cod: 0, revenuePaise: 0 }
      current.orders += 1
      current.revenuePaise += Number(row.total_paise)
      if (row.payment === "cash" || row.payment == null) current.cod += 1
      else current.prepaid += 1
      platforms.set(row.client, current)
    }
    const cash = await pool.query<{ kind: string; amount: string }>(
      `SELECT kind, COALESCE(SUM(amount_paise), 0)::bigint AS amount
       FROM cash_entries
       WHERE outlet_id = $1 AND removed_at IS NULL AND business_date BETWEEN $2 AND $3
       GROUP BY kind`,
      [session.outletId, fromDate, toDate],
    )
    const cashOf = (kind: string) => Number(cash.rows.find((row) => row.kind === kind)?.amount ?? 0)
    const items = await pool.query<{ name: string; qty: string; total: string }>(
      `SELECT oi.item_name AS name, SUM(oi.qty)::int AS qty, SUM(oi.line_total_paise)::bigint AS total
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE o.outlet_id = $1 AND o.status = 'settled' AND o.business_date BETWEEN $2 AND $3
       GROUP BY oi.item_name ORDER BY SUM(oi.qty) DESC LIMIT 8`,
      [session.outletId, fromDate, toDate],
    )
    const lastSale = await pool.query<{ business_date: Date | null }>(
      `SELECT MAX(business_date) AS business_date FROM orders WHERE outlet_id = $1 AND status = 'settled'`,
      [session.outletId],
    )
    const last = lastSale.rows[0]?.business_date
    const daysAgo = last ? Math.max(0, Math.round((new Date(today).getTime() - new Date(last).getTime()) / 86400000)) : 0
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    return {
      sync: { posDaysAgo: daysAgo, ordersDaysAgo: daysAgo },
      sales: { dateLabel, totalPaise, orderCount: rows.length, byTender, byChannel, chart },
      online: {
        totalOrders: onlineRows.rowCount ?? 0,
        prepaid: [...platforms.values()].reduce((sum, row) => sum + row.prepaid, 0),
        cod: [...platforms.values()].reduce((sum, row) => sum + row.cod, 0),
        revenuePaise: [...platforms.values()].reduce((sum, row) => sum + row.revenuePaise, 0),
        platforms: [...platforms.values()],
      },
      items: items.rows.map((row) => ({ name: row.name, qty: Number(row.qty), totalPaise: Number(row.total) })),
      actionCenter: actions,
      snapshotReady: true,
      snapshotDate: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(yesterday),
      expenses: { expensePaise: cashOf("expense"), withdrawalPaise: cashOf("withdrawal"), topupPaise: cashOf("topup") },
      retentionPct: phoneCounts.size ? Math.round((repeat / phoneCounts.size) * 100) : 0,
      risk: {
        unverifiedPaise: rows.filter((row) => row.payment_type === "due" || Number(row.paid_paise) < Number(row.total_paise)).reduce((sum, row) => sum + Number(row.total_paise), 0),
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
