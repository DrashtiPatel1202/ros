import { randomBytes } from "node:crypto"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { writeAudit } from "./audit.ts"
import { requireBilling, type BillingPrincipal } from "./billingAuth.ts"
import { verifyPin, hashPin } from "./crypto.ts"
import { pool } from "./db.ts"
import { sendError } from "./http.ts"

const STAFF_TYPES = ["billing", "delivery", "waiter", "captain", "online"] as const
const DEVICE_KINDS = ["billing", "feedback", "scan_qr", "android_pos", "kds", "captain"] as const
const CASH_KINDS = ["expense", "withdrawal", "topup"] as const
const PAYMENT_STATUSES = [
  "customer_paid",
  "provider_initiated",
  "provider_done",
  "transfer_initiated",
  "transferred",
  "failed",
  "refunded",
] as const
const INVOICE_TABS = ["pg", "swipe", "mdr", "hardware", "deposit", "monthly", "ledger"] as const
const SUPPORT_CATEGORIES = [
  "Installation",
  "Re-installation",
  "Printer Issue",
  "Billing Issue",
  "Payment Issue",
  "GST Issue",
  "Report Issue",
  "KOT Issue",
  "Inventory Issue",
  "Menu Issue",
  "Login Issue",
  "Training Issue",
] as const

export async function ensureManagementSchema() {
  const sqlPath = join(dirname(fileURLToPath(import.meta.url)), "../sql/006_management.sql")
  await pool.query(readFileSync(sqlPath, "utf8"))
  await pool.query(
    `INSERT INTO denominations (outlet_id, label, value_paise)
     SELECT o.id, d.label, d.value_paise
     FROM outlets o
     CROSS JOIN (VALUES
       ('₹2000', 200000), ('₹500', 50000), ('₹200', 20000), ('₹100', 10000),
       ('₹50', 5000), ('₹20', 2000), ('₹10', 1000), ('₹5', 500), ('₹2', 200), ('₹1', 100)
     ) AS d(label, value_paise)
     ON CONFLICT (outlet_id, value_paise) DO NOTHING`,
  )
}

function isoDate(value: unknown) {
  if (value instanceof Date) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, "0")
    const d = String(value.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }
  return String(value).slice(0, 10)
}

function num(value: unknown) {
  return Number(value)
}

async function guard(request: Parameters<typeof requireBilling>[0], reply: Parameters<typeof requireBilling>[1]) {
  return requireBilling(request, reply)
}

async function checkPassword(adminId: number, password: string) {
  const row = await pool.query<{ password_hash: string }>(
    "SELECT password_hash FROM billing_admins WHERE id = $1",
    [adminId],
  )
  return Boolean(row.rows[0] && verifyPin(password, row.rows[0].password_hash))
}

function code() {
  return randomBytes(4).toString("hex").toUpperCase()
}

export async function registerManagementRoutes(app: FastifyInstance) {
  await ensureManagementSchema()

  app.get("/api/v1/billing/management/staff", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const rows = await pool.query(
      `SELECT id, name, user_type, user_name, user_code, phone, passcode, swipe_code, is_active
       FROM staff_users WHERE outlet_id = $1 ORDER BY name`,
      [session.outletId],
    )
    return {
      rows: rows.rows.map((row) => ({
        id: num(row.id),
        name: row.name as string,
        userType: row.user_type as string,
        userName: row.user_name as string,
        userCode: row.user_code as string,
        phone: row.phone as string,
        passcode: row.passcode as string,
        swipeCode: row.swipe_code as string,
        active: row.is_active as boolean,
      })),
    }
  })

  app.post("/api/v1/billing/management/staff", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const parsed = z
      .object({
        name: z.string().trim().min(1).max(80),
        userType: z.enum(STAFF_TYPES),
        userName: z.string().trim().min(2).max(40),
        userCode: z.string().trim().min(1).max(20),
        password: z.string().min(4).max(80),
        phone: z.string().trim().max(20).optional(),
        passcode: z.string().regex(/^\d{4}$/, "Passcode is 4 digits"),
        swipeCode: z.string().trim().max(40).optional(),
      })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Check the billing user and try again.")
    try {
      const row = await pool.query(
        `INSERT INTO staff_users
           (outlet_id, name, user_type, user_name, user_code, password_hash, phone, passcode, swipe_code)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [
          session.outletId,
          parsed.data.name,
          parsed.data.userType,
          parsed.data.userName,
          parsed.data.userCode,
          hashPin(parsed.data.password),
          parsed.data.phone ?? "",
          parsed.data.passcode,
          parsed.data.swipeCode ?? "",
        ],
      )
      await writeAudit({
        outletId: session.outletId,
        actorName: session.adminName,
        category: "staff",
        action: "created",
        entityType: "staff_user",
        entityId: String(row.rows[0]!.id),
        summary: `Billing user ${parsed.data.name} (${parsed.data.userName}) added`,
      })
      return { id: num(row.rows[0]!.id) }
    } catch (error) {
      if (isUnique(error)) return sendError(reply, 409, "DUPLICATE", "User name or user code is already used.")
      throw error
    }
  })

  app.put("/api/v1/billing/management/staff/:id", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const id = Number((request.params as { id: string }).id)
    const parsed = z
      .object({
        name: z.string().trim().min(1).max(80).optional(),
        userType: z.enum(STAFF_TYPES).optional(),
        phone: z.string().trim().max(20).optional(),
        passcode: z.string().regex(/^\d{4}$/).optional(),
        swipeCode: z.string().trim().max(40).optional(),
        password: z.string().min(4).max(80).optional(),
        active: z.boolean().optional(),
      })
      .safeParse(request.body)
    if (!parsed.success || !Number.isInteger(id)) return sendError(reply, 400, "VALIDATION", "Check the billing user and try again.")
    const updated = await pool.query(
      `UPDATE staff_users SET
         name = COALESCE($3, name),
         user_type = COALESCE($4, user_type),
         phone = COALESCE($5, phone),
         passcode = COALESCE($6, passcode),
         swipe_code = COALESCE($7, swipe_code),
         password_hash = COALESCE($8, password_hash),
         is_active = COALESCE($9, is_active),
         updated_at = now()
       WHERE id = $1 AND outlet_id = $2`,
      [
        id,
        session.outletId,
        parsed.data.name ?? null,
        parsed.data.userType ?? null,
        parsed.data.phone ?? null,
        parsed.data.passcode ?? null,
        parsed.data.swipeCode ?? null,
        parsed.data.password ? hashPin(parsed.data.password) : null,
        parsed.data.active ?? null,
      ],
    )
    if (!updated.rowCount) return sendError(reply, 404, "NOT_FOUND", "Billing user not found.")
    await writeAudit({
      outletId: session.outletId,
      actorName: session.adminName,
      category: "staff",
      action: parsed.data.active === false ? "deactivated" : "updated",
      entityType: "staff_user",
      entityId: String(id),
      summary: `Billing user #${id} updated`,
    })
    return { ok: true }
  })

  app.get("/api/v1/billing/management/devices", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const rows = await pool.query(
      `SELECT id, name, kind, mapping_code, last_seen_at, is_active
       FROM devices WHERE outlet_id = $1 ORDER BY created_at DESC`,
      [session.outletId],
    )
    return {
      rows: rows.rows.map((row) => ({
        id: num(row.id),
        name: row.name as string,
        kind: row.kind as string,
        mappingCode: row.mapping_code as string,
        lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at as string).toISOString() : null,
        active: row.is_active as boolean,
      })),
    }
  })

  app.post("/api/v1/billing/management/devices/sync-code", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const parsed = z
      .object({
        password: z.string().min(4),
        name: z.string().trim().min(1).max(60).default("Billing terminal"),
        kind: z.enum(DEVICE_KINDS).default("billing"),
      })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Enter your login password to get a code.")
    if (!(await checkPassword(session.adminId, parsed.data.password))) {
      return sendError(reply, 401, "BAD_PASSWORD", "Password does not match.")
    }
    const mappingCode = code()
    const row = await pool.query(
      `INSERT INTO devices (outlet_id, name, kind, mapping_code) VALUES ($1,$2,$3,$4) RETURNING id`,
      [session.outletId, parsed.data.name, parsed.data.kind, mappingCode],
    )
    await audit(session, "device", "sync_code", `Sync code issued for ${parsed.data.name}`, "device", String(row.rows[0]!.id))
    return { id: num(row.rows[0]!.id), mappingCode }
  })

  app.post("/api/v1/billing/management/devices/pair", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const parsed = z
      .object({
        code: z.string().trim().min(4).max(20),
        name: z.string().trim().min(1).max(60).optional(),
        kind: z.enum(DEVICE_KINDS).default("android_pos"),
      })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Enter the mapping code shown on the device.")
    const mappingCode = parsed.data.code.toUpperCase()
    const existing = await pool.query<{ id: string; outlet_id: string }>(
      "SELECT id, outlet_id FROM devices WHERE mapping_code = $1",
      [mappingCode],
    )
    if (existing.rows[0] && num(existing.rows[0].outlet_id) !== session.outletId) {
      return sendError(reply, 409, "WRONG_OUTLET", "That code belongs to another outlet.")
    }
    if (existing.rows[0]) {
      await pool.query(
        "UPDATE devices SET is_active = true, last_seen_at = now() WHERE id = $1",
        [existing.rows[0].id],
      )
      await audit(session, "device", "paired", `Device ${mappingCode} mapped`, "device", String(existing.rows[0].id))
      return { id: num(existing.rows[0].id), mappingCode }
    }
    const row = await pool.query(
      `INSERT INTO devices (outlet_id, name, kind, mapping_code, last_seen_at)
       VALUES ($1,$2,$3,$4, now()) RETURNING id`,
      [session.outletId, parsed.data.name ?? "Mapped device", parsed.data.kind, mappingCode],
    )
    await audit(session, "device", "paired", `Device ${mappingCode} mapped`, "device", String(row.rows[0]!.id))
    return { id: num(row.rows[0]!.id), mappingCode }
  })

  app.put("/api/v1/billing/management/devices/:id", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const id = Number((request.params as { id: string }).id)
    const parsed = z.object({ active: z.boolean() }).safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Could not update the device.")
    const updated = await pool.query(
      "UPDATE devices SET is_active = $3 WHERE id = $1 AND outlet_id = $2",
      [id, session.outletId, parsed.data.active],
    )
    if (!updated.rowCount) return sendError(reply, 404, "NOT_FOUND", "Device not found.")
    return { ok: true }
  })

  app.get("/api/v1/billing/management/audit", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const query = request.query as { category?: string; from?: string; to?: string; q?: string }
    const rows = await pool.query(
      `SELECT id, actor_name, source, category, action, summary, created_at
       FROM audit_events
       WHERE outlet_id = $1
         AND created_at >= now() - interval '180 days'
         AND ($2::text IS NULL OR category = $2)
         AND ($3::date IS NULL OR created_at >= $3::date)
         AND ($4::date IS NULL OR created_at < ($4::date + 1))
         AND ($5::text IS NULL OR summary ILIKE '%' || $5 || '%')
       ORDER BY created_at DESC
       LIMIT 200`,
      [session.outletId, query.category || null, query.from || null, query.to || null, query.q || null],
    )
    const categories = await pool.query<{ category: string; count: string }>(
      `SELECT category, count(*)::int AS count
       FROM audit_events
       WHERE outlet_id = $1 AND created_at >= now() - interval '180 days'
       GROUP BY category ORDER BY category`,
      [session.outletId],
    )
    return {
      categories: categories.rows.map((row) => ({ category: row.category, count: num(row.count) })),
      rows: rows.rows.map(mapAudit),
    }
  })

  app.get("/api/v1/billing/management/gst", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const row = await pool.query("SELECT * FROM gst_profiles WHERE outlet_id = $1", [session.outletId])
    const found = row.rows[0]
    return {
      hasGst: found ? Boolean(found.has_gst) : true,
      gstin: (found?.gstin as string) ?? "",
      legalName: (found?.legal_name as string) ?? "",
      address: (found?.address as string) ?? "",
      state: (found?.state as string) ?? "",
      city: (found?.city as string) ?? "",
      pan: (found?.pan as string) ?? "",
      cin: (found?.cin as string) ?? "",
      zip: (found?.zip as string) ?? "",
    }
  })

  app.put("/api/v1/billing/management/gst", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const parsed = z
      .object({
        hasGst: z.boolean(),
        gstin: z.string().trim().max(20),
        legalName: z.string().trim().max(120),
        address: z.string().trim().max(240),
        state: z.string().trim().max(60),
        city: z.string().trim().max(60),
        pan: z.string().trim().max(20),
        cin: z.string().trim().max(30),
        zip: z.string().trim().max(12),
      })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Check the GST details and try again.")
    if (parsed.data.hasGst && parsed.data.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/i.test(parsed.data.gstin)) {
      return sendError(reply, 400, "VALIDATION", "GSTIN should be 15 characters, like 27AAAAA0000A1Z5.")
    }
    await pool.query(
      `INSERT INTO gst_profiles
         (outlet_id, has_gst, gstin, legal_name, address, state, city, pan, cin, zip)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (outlet_id) DO UPDATE SET
         has_gst = EXCLUDED.has_gst, gstin = EXCLUDED.gstin, legal_name = EXCLUDED.legal_name,
         address = EXCLUDED.address, state = EXCLUDED.state, city = EXCLUDED.city,
         pan = EXCLUDED.pan, cin = EXCLUDED.cin, zip = EXCLUDED.zip`,
      [
        session.outletId,
        parsed.data.hasGst,
        parsed.data.gstin.toUpperCase(),
        parsed.data.legalName,
        parsed.data.address,
        parsed.data.state,
        parsed.data.city,
        parsed.data.pan.toUpperCase(),
        parsed.data.cin,
        parsed.data.zip,
      ],
    )
    await audit(session, "gst", "updated", "GST information saved", "gst_profile", String(session.outletId))
    return { ok: true }
  })

  app.get("/api/v1/billing/management/banks", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const rows = await pool.query(
      `SELECT id, account_name, bank_name, account_no, ifsc, is_primary
       FROM bank_accounts WHERE outlet_id = $1 ORDER BY is_primary DESC, id`,
      [session.outletId],
    )
    return {
      rows: rows.rows.map((row) => ({
        id: num(row.id),
        accountName: row.account_name as string,
        bankName: row.bank_name as string,
        accountNo: row.account_no as string,
        ifsc: row.ifsc as string,
        primary: row.is_primary as boolean,
      })),
    }
  })

  app.post("/api/v1/billing/management/banks", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const parsed = z
      .object({
        accountName: z.string().trim().min(1).max(80),
        bankName: z.string().trim().min(1).max(80),
        accountNo: z.string().trim().min(6).max(30),
        ifsc: z.string().trim().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/i, "IFSC looks wrong"),
        primary: z.boolean().optional(),
      })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Check the bank account and try again.")
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      if (parsed.data.primary) {
        await client.query("UPDATE bank_accounts SET is_primary = false WHERE outlet_id = $1", [session.outletId])
      }
      const row = await client.query(
        `INSERT INTO bank_accounts (outlet_id, account_name, bank_name, account_no, ifsc, is_primary)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [
          session.outletId,
          parsed.data.accountName,
          parsed.data.bankName,
          parsed.data.accountNo,
          parsed.data.ifsc.toUpperCase(),
          parsed.data.primary ?? false,
        ],
      )
      await client.query("COMMIT")
      await audit(session, "bank", "created", `Bank ${parsed.data.bankName} added`, "bank_account", String(row.rows[0]!.id))
      return { id: num(row.rows[0]!.id) }
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  })

  app.delete("/api/v1/billing/management/banks/:id", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const id = Number((request.params as { id: string }).id)
    const removed = await pool.query("DELETE FROM bank_accounts WHERE id = $1 AND outlet_id = $2", [id, session.outletId])
    if (!removed.rowCount) return sendError(reply, 404, "NOT_FOUND", "Bank account not found.")
    await audit(session, "bank", "removed", `Bank account #${id} removed`, "bank_account", String(id))
    return { ok: true }
  })

  app.get("/api/v1/billing/management/cash", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const kind = (request.query as { kind?: string }).kind
    if (!CASH_KINDS.includes(kind as (typeof CASH_KINDS)[number])) {
      return sendError(reply, 400, "VALIDATION", "Pick expense, withdrawal, or cash top-up.")
    }
    const heads = await pool.query(
      "SELECT id, title, is_active FROM cash_heads WHERE outlet_id = $1 AND kind = $2 ORDER BY title",
      [session.outletId, kind],
    )
    const entries = await pool.query(
      `SELECT e.id, e.amount_paise, e.note, e.business_date, e.removed_at, h.title
       FROM cash_entries e JOIN cash_heads h ON h.id = e.head_id
       WHERE e.outlet_id = $1 AND e.kind = $2
       ORDER BY e.business_date DESC, e.id DESC LIMIT 200`,
      [session.outletId, kind],
    )
    return {
      heads: heads.rows.map((row) => ({ id: num(row.id), title: row.title as string, active: row.is_active as boolean })),
      entries: entries.rows.map((row) => ({
        id: num(row.id),
        title: row.title as string,
        amountPaise: num(row.amount_paise),
        note: row.note as string,
        businessDate: isoDate(row.business_date),
        removed: Boolean(row.removed_at),
      })),
    }
  })

  app.post("/api/v1/billing/management/cash/heads", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const parsed = z.object({ kind: z.enum(CASH_KINDS), title: z.string().trim().min(1).max(80) }).safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Enter a title for this head.")
    try {
      const row = await pool.query(
        `INSERT INTO cash_heads (outlet_id, kind, title) VALUES ($1,$2,$3) RETURNING id`,
        [session.outletId, parsed.data.kind, parsed.data.title],
      )
      return { id: num(row.rows[0]!.id) }
    } catch (error) {
      if (isUnique(error)) return sendError(reply, 409, "DUPLICATE", "That title already exists.")
      throw error
    }
  })

  app.post("/api/v1/billing/management/cash/entries", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const parsed = z
      .object({
        headId: z.number().int().positive(),
        amountPaise: z.number().int().positive().max(100_000_000),
        note: z.string().trim().max(200).optional(),
        businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Check the amount and date.")
    const head = await pool.query<{ kind: string; title: string }>(
      "SELECT kind, title FROM cash_heads WHERE id = $1 AND outlet_id = $2 AND is_active",
      [parsed.data.headId, session.outletId],
    )
    if (!head.rows[0]) return sendError(reply, 404, "NOT_FOUND", "Pick an active head.")
    const row = await pool.query(
      `INSERT INTO cash_entries (outlet_id, head_id, kind, amount_paise, note, business_date)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [
        session.outletId,
        parsed.data.headId,
        head.rows[0].kind,
        parsed.data.amountPaise,
        parsed.data.note ?? "",
        parsed.data.businessDate,
      ],
    )
    await audit(
      session,
      head.rows[0].kind === "topup" ? "cash_topup" : head.rows[0].kind,
      "created",
      `${head.rows[0].title} ₹${(parsed.data.amountPaise / 100).toFixed(2)} on ${parsed.data.businessDate}`,
      "cash_entry",
      String(row.rows[0]!.id),
    )
    return { id: num(row.rows[0]!.id) }
  })

  app.delete("/api/v1/billing/management/cash/entries/:id", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const id = Number((request.params as { id: string }).id)
    const row = await pool.query<{ kind: string }>(
      `UPDATE cash_entries SET removed_at = now()
       WHERE id = $1 AND outlet_id = $2 AND removed_at IS NULL
       RETURNING kind`,
      [id, session.outletId],
    )
    if (!row.rowCount) return sendError(reply, 404, "NOT_FOUND", "Entry not found.")
    const kind = row.rows[0]!.kind
    await audit(session, kind === "topup" ? "cash_topup" : kind, "removed", `Entry #${id} removed`, "cash_entry", String(id))
    return { ok: true }
  })

  app.get("/api/v1/billing/management/denominations", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const rows = await pool.query(
      "SELECT id, label, value_paise, is_available FROM denominations WHERE outlet_id = $1 ORDER BY value_paise DESC",
      [session.outletId],
    )
    return {
      rows: rows.rows.map((row) => ({
        id: num(row.id),
        label: row.label as string,
        valuePaise: num(row.value_paise),
        available: row.is_available as boolean,
      })),
    }
  })

  app.put("/api/v1/billing/management/denominations/:id", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const id = Number((request.params as { id: string }).id)
    const parsed = z.object({ available: z.boolean() }).safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Could not update the denomination.")
    const updated = await pool.query(
      "UPDATE denominations SET is_available = $3 WHERE id = $1 AND outlet_id = $2",
      [id, session.outletId, parsed.data.available],
    )
    if (!updated.rowCount) return sendError(reply, 404, "NOT_FOUND", "Denomination not found.")
    return { ok: true }
  })

  app.get("/api/v1/billing/management/payments", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const query = request.query as { from?: string; to?: string; status?: string; provider?: string; orderNo?: string }
    const rows = await pool.query(
      `SELECT o.id, o.order_no, o.business_date, o.payment_type, o.total_paise, o.settled_at,
              COALESCE(s.status, 'customer_paid') AS status
       FROM orders o
       LEFT JOIN payment_settlements s ON s.order_id = o.id AND s.outlet_id = o.outlet_id
       WHERE o.outlet_id = $1
         AND o.status = 'settled'
         AND o.payment_type IN ('card', 'upi', 'other', 'online')
         AND ($2::date IS NULL OR o.business_date >= $2::date)
         AND ($3::date IS NULL OR o.business_date <= $3::date)
         AND ($4::text IS NULL OR COALESCE(s.status, 'customer_paid') = $4)
         AND ($5::text IS NULL OR o.payment_type = $5)
         AND ($6::int IS NULL OR o.order_no = $6)
       ORDER BY o.settled_at DESC NULLS LAST
       LIMIT 200`,
      [
        session.outletId,
        query.from || null,
        query.to || null,
        query.status || null,
        query.provider || null,
        query.orderNo ? Number(query.orderNo) : null,
      ],
    )
    const daily = await pool.query(
      `SELECT business_date, COALESCE(SUM(total_paise), 0)::bigint AS amount
       FROM orders
       WHERE outlet_id = $1 AND status = 'settled'
         AND payment_type IN ('card', 'upi', 'other', 'online')
         AND business_date >= CURRENT_DATE - 14
       GROUP BY business_date ORDER BY business_date`,
      [session.outletId],
    )
    return {
      daily: daily.rows.map((row) => ({ date: isoDate(row.business_date), amountPaise: num(row.amount) })),
      rows: rows.rows.map((row) => ({
        orderId: num(row.id),
        orderNo: num(row.order_no),
        businessDate: isoDate(row.business_date),
        provider: row.payment_type as string,
        amountPaise: num(row.total_paise),
        status: row.status as string,
        settledAt: row.settled_at ? new Date(row.settled_at as string).toISOString() : null,
      })),
    }
  })

  app.put("/api/v1/billing/management/payments/:orderId", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const orderId = Number((request.params as { orderId: string }).orderId)
    const parsed = z.object({ status: z.enum(PAYMENT_STATUSES) }).safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Pick a payout status.")
    const order = await pool.query(
      `SELECT id FROM orders
       WHERE id = $1 AND outlet_id = $2 AND status = 'settled'
         AND payment_type IN ('card', 'upi', 'other', 'online')`,
      [orderId, session.outletId],
    )
    if (!order.rowCount) return sendError(reply, 404, "NOT_FOUND", "Digital payment not found.")
    await pool.query(
      `INSERT INTO payment_settlements (outlet_id, order_id, status)
       VALUES ($1,$2,$3)
       ON CONFLICT (outlet_id, order_id) DO UPDATE SET status = EXCLUDED.status, updated_at = now()`,
      [session.outletId, orderId, parsed.data.status],
    )
    await audit(session, "payment", "status", `Order #${orderId} payout marked ${parsed.data.status}`, "order", String(orderId))
    return { ok: true }
  })

  app.get("/api/v1/billing/management/wallet", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const phone = (request.query as { phone?: string }).phone?.trim()
    const cards = await pool.query(
      `SELECT id, phone, card_no, holder_name, balance_paise, status, exclude_reset
       FROM wallet_cards
       WHERE outlet_id = $1 AND ($2::text IS NULL OR phone ILIKE '%' || $2 || '%')
       ORDER BY phone`,
      [session.outletId, phone || null],
    )
    const txns = await pool.query(
      `SELECT t.id, t.kind, t.amount_paise, t.note, t.created_at, c.phone
       FROM wallet_txns t JOIN wallet_cards c ON c.id = t.card_id
       WHERE t.outlet_id = $1
       ORDER BY t.created_at DESC LIMIT 50`,
      [session.outletId],
    )
    return {
      cards: cards.rows.map((row) => ({
        id: num(row.id),
        phone: row.phone as string,
        cardNo: row.card_no as string,
        holderName: row.holder_name as string,
        balancePaise: num(row.balance_paise),
        status: row.status as string,
        excludeReset: row.exclude_reset as boolean,
      })),
      txns: txns.rows.map((row) => ({
        id: num(row.id),
        phone: row.phone as string,
        kind: row.kind as string,
        amountPaise: num(row.amount_paise),
        note: row.note as string,
        createdAt: new Date(row.created_at as string).toISOString(),
      })),
    }
  })

  app.post("/api/v1/billing/management/wallet", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const parsed = z
      .object({
        phone: z.string().trim().min(8).max(15),
        cardNo: z.string().trim().min(4).max(20),
        holderName: z.string().trim().max(80).optional(),
      })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Phone and card number are required.")
    try {
      const row = await pool.query(
        `INSERT INTO wallet_cards (outlet_id, phone, card_no, holder_name) VALUES ($1,$2,$3,$4) RETURNING id`,
        [session.outletId, parsed.data.phone, parsed.data.cardNo, parsed.data.holderName ?? ""],
      )
      await pool.query(
        `INSERT INTO wallet_txns (outlet_id, card_id, kind, amount_paise, note) VALUES ($1,$2,'issue',0,'Card issued')`,
        [session.outletId, row.rows[0]!.id],
      )
      return { id: num(row.rows[0]!.id) }
    } catch (error) {
      if (isUnique(error)) return sendError(reply, 409, "DUPLICATE", "That phone or card is already issued.")
      throw error
    }
  })

  app.post("/api/v1/billing/management/wallet/:id/move", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const id = Number((request.params as { id: string }).id)
    const parsed = z
      .object({
        kind: z.enum(["topup", "redeem", "refund"]),
        amountPaise: z.number().int().positive().max(100_000_000),
        note: z.string().trim().max(160).optional(),
      })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Enter an amount.")
    const delta = parsed.data.kind === "redeem" ? -parsed.data.amountPaise : parsed.data.amountPaise
    const moved = await moveWallet(session.outletId, id, delta, parsed.data.kind, parsed.data.note ?? "")
    if (moved === "missing") return sendError(reply, 404, "NOT_FOUND", "Card not found.")
    if (moved === "blocked") return sendError(reply, 409, "BLOCKED", "This card is not active.")
    if (moved === "short") return sendError(reply, 400, "INSUFFICIENT", "Balance is not enough.")
    await audit(session, "wallet", parsed.data.kind, `Card #${id} ${parsed.data.kind} ₹${(parsed.data.amountPaise / 100).toFixed(2)}`, "wallet_card", String(id))
    return { ok: true }
  })

  app.put("/api/v1/billing/management/wallet/:id", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const id = Number((request.params as { id: string }).id)
    const parsed = z
      .object({
        status: z.enum(["active", "inactive", "block"]).optional(),
        reason: z.string().trim().max(160).optional(),
        excludeReset: z.boolean().optional(),
      })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Could not update the card.")
    const updated = await pool.query(
      `UPDATE wallet_cards SET
         status = COALESCE($3, status),
         exclude_reset = COALESCE($4, exclude_reset)
       WHERE id = $1 AND outlet_id = $2`,
      [id, session.outletId, parsed.data.status ?? null, parsed.data.excludeReset ?? null],
    )
    if (!updated.rowCount) return sendError(reply, 404, "NOT_FOUND", "Card not found.")
    if (parsed.data.status) {
      await audit(session, "wallet", "status", `Card #${id} ${parsed.data.status}. ${parsed.data.reason ?? ""}`.trim(), "wallet_card", String(id))
    }
    return { ok: true }
  })

  app.post("/api/v1/billing/management/wallet/reset", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const parsed = z.object({ password: z.string().min(4) }).safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Confirm with your login password.")
    if (!(await checkPassword(session.adminId, parsed.data.password))) {
      return sendError(reply, 401, "BAD_PASSWORD", "Password does not match.")
    }
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      const cards = await client.query<{ id: string; balance_paise: string }>(
        `SELECT id, balance_paise FROM wallet_cards
         WHERE outlet_id = $1 AND NOT exclude_reset AND balance_paise > 0
         FOR UPDATE`,
        [session.outletId],
      )
      for (const card of cards.rows) {
        await client.query(
          `INSERT INTO wallet_txns (outlet_id, card_id, kind, amount_paise, note) VALUES ($1,$2,'reset',$3,'Balance reset')`,
          [session.outletId, card.id, card.balance_paise],
        )
      }
      await client.query(
        `UPDATE wallet_cards SET balance_paise = 0
         WHERE outlet_id = $1 AND NOT exclude_reset`,
        [session.outletId],
      )
      await client.query("COMMIT")
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
    await audit(session, "wallet", "reset", "Customer wallet balances reset", "wallet", String(session.outletId))
    return { ok: true }
  })

  app.get("/api/v1/billing/management/recon", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const orders = await pool.query(
      `SELECT id, order_no, business_date, total_paise, payment_type, customer_name
       FROM orders
       WHERE outlet_id = $1 AND status = 'settled' AND order_type = 'delivery'
       ORDER BY business_date DESC, id DESC LIMIT 100`,
      [session.outletId],
    )
    const disputes = await pool.query(
      `SELECT id, order_ref, channel, from_email, note, status, created_at
       FROM recon_disputes WHERE outlet_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [session.outletId],
    )
    const services = await pool.query<{ enabled: boolean }>(
      `SELECT os.enabled FROM outlet_services os
       JOIN marketplace_services ms ON ms.id = os.service_id
       WHERE os.outlet_id = $1 AND ms.code IN ('zomato', 'swiggy') AND os.enabled`,
      [session.outletId],
    )
    return {
      aggregatorConnected: services.rowCount > 0,
      orders: orders.rows.map((row) => ({
        orderId: num(row.id),
        orderNo: num(row.order_no),
        businessDate: isoDate(row.business_date),
        amountPaise: num(row.total_paise),
        paymentType: row.payment_type as string,
        customerName: (row.customer_name as string) ?? "",
      })),
      disputes: disputes.rows.map((row) => ({
        id: num(row.id),
        orderRef: row.order_ref as string,
        channel: row.channel as string,
        fromEmail: row.from_email as string,
        note: row.note as string,
        status: row.status as string,
        createdAt: new Date(row.created_at as string).toISOString(),
      })),
    }
  })

  app.post("/api/v1/billing/management/recon/disputes", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const parsed = z
      .object({
        orderRef: z.string().trim().min(1).max(40),
        channel: z.enum(["zomato", "swiggy", "website"]),
        fromEmail: z.string().trim().email(),
        note: z.string().trim().max(400).optional(),
      })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Order reference and a from-email are required.")
    const row = await pool.query(
      `INSERT INTO recon_disputes (outlet_id, order_ref, channel, from_email, note)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [session.outletId, parsed.data.orderRef, parsed.data.channel, parsed.data.fromEmail, parsed.data.note ?? ""],
    )
    await audit(session, "recon", "dispute", `Mismatch dispute for ${parsed.data.orderRef}`, "recon_dispute", String(row.rows[0]!.id))
    return { id: num(row.rows[0]!.id) }
  })

  app.get("/api/v1/billing/management/invoices", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const tab = (request.query as { tab?: string }).tab || "monthly"
    const rows = await pool.query(
      `SELECT id, tab, title, amount_paise, payment_type, proforma_no, status, cancel_reason, issued_on
       FROM service_invoices WHERE outlet_id = $1 AND tab = $2
       ORDER BY issued_on DESC, id DESC`,
      [session.outletId, tab],
    )
    return {
      rows: rows.rows.map((row) => ({
        id: num(row.id),
        tab: row.tab as string,
        title: row.title as string,
        amountPaise: num(row.amount_paise),
        paymentType: row.payment_type as string,
        proformaNo: row.proforma_no as string,
        status: row.status as string,
        cancelReason: row.cancel_reason as string,
        issuedOn: isoDate(row.issued_on),
      })),
    }
  })

  app.post("/api/v1/billing/management/invoices", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const parsed = z
      .object({
        tab: z.enum(INVOICE_TABS),
        title: z.string().trim().min(1).max(120),
        amountPaise: z.number().int().min(0).max(100_000_000),
        paymentType: z.enum(["online", "manual"]),
        proformaNo: z.string().trim().max(40).optional(),
        issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Check the invoice and try again.")
    const row = await pool.query(
      `INSERT INTO service_invoices (outlet_id, tab, title, amount_paise, payment_type, proforma_no, issued_on)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [
        session.outletId,
        parsed.data.tab,
        parsed.data.title,
        parsed.data.amountPaise,
        parsed.data.paymentType,
        parsed.data.proformaNo ?? "",
        parsed.data.issuedOn,
      ],
    )
    return { id: num(row.rows[0]!.id) }
  })

  app.put("/api/v1/billing/management/invoices/:id/cancel", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const id = Number((request.params as { id: string }).id)
    const parsed = z.object({ reason: z.string().trim().min(2).max(200) }).safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "A cancel reason is required.")
    const updated = await pool.query(
      `UPDATE service_invoices SET status = 'cancelled', cancel_reason = $3
       WHERE id = $1 AND outlet_id = $2 AND status = 'open'`,
      [id, session.outletId, parsed.data.reason],
    )
    if (!updated.rowCount) return sendError(reply, 404, "NOT_FOUND", "Open invoice not found.")
    return { ok: true }
  })

  app.get("/api/v1/billing/management/loans", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const loans = await pool.query(
      `SELECT id, title, principal_paise, outstanding_paise, started_on, status
       FROM loans WHERE outlet_id = $1 ORDER BY started_on DESC`,
      [session.outletId],
    )
    const invoices = await pool.query(
      `SELECT id, loan_id, amount_paise, note, issued_on
       FROM loan_invoices WHERE outlet_id = $1 ORDER BY issued_on DESC`,
      [session.outletId],
    )
    return {
      loans: loans.rows.map((row) => ({
        id: num(row.id),
        title: row.title as string,
        principalPaise: num(row.principal_paise),
        outstandingPaise: num(row.outstanding_paise),
        startedOn: isoDate(row.started_on),
        status: row.status as string,
      })),
      invoices: invoices.rows.map((row) => ({
        id: num(row.id),
        loanId: num(row.loan_id),
        amountPaise: num(row.amount_paise),
        note: row.note as string,
        issuedOn: isoDate(row.issued_on),
      })),
    }
  })

  app.post("/api/v1/billing/management/loans", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const parsed = z
      .object({
        title: z.string().trim().min(1).max(80),
        principalPaise: z.number().int().positive().max(1_000_000_000),
        startedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Enter the loan title and amount.")
    const row = await pool.query(
      `INSERT INTO loans (outlet_id, title, principal_paise, outstanding_paise, started_on)
       VALUES ($1,$2,$3,$3,$4) RETURNING id`,
      [session.outletId, parsed.data.title, parsed.data.principalPaise, parsed.data.startedOn],
    )
    return { id: num(row.rows[0]!.id) }
  })

  app.post("/api/v1/billing/management/loans/:id/repay", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const id = Number((request.params as { id: string }).id)
    const parsed = z
      .object({ amountPaise: z.number().int().positive(), note: z.string().trim().max(160).optional() })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Enter the repayment amount.")
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      const loan = await client.query<{ outstanding_paise: string }>(
        "SELECT outstanding_paise FROM loans WHERE id = $1 AND outlet_id = $2 FOR UPDATE",
        [id, session.outletId],
      )
      if (!loan.rows[0]) {
        await client.query("ROLLBACK")
        return sendError(reply, 404, "NOT_FOUND", "Loan not found.")
      }
      const outstanding = num(loan.rows[0].outstanding_paise)
      if (parsed.data.amountPaise > outstanding) {
        await client.query("ROLLBACK")
        return sendError(reply, 400, "OVERPAY", "Repayment is more than the outstanding amount.")
      }
      const next = outstanding - parsed.data.amountPaise
      await client.query(
        "UPDATE loans SET outstanding_paise = $3, status = $4 WHERE id = $1 AND outlet_id = $2",
        [id, session.outletId, next, next === 0 ? "closed" : "active"],
      )
      await client.query(
        `INSERT INTO loan_invoices (loan_id, outlet_id, amount_paise, note) VALUES ($1,$2,$3,$4)`,
        [id, session.outletId, parsed.data.amountPaise, parsed.data.note ?? ""],
      )
      await client.query("COMMIT")
      return { ok: true, outstandingPaise: next }
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  })

  app.get("/api/v1/billing/management/support", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const rows = await pool.query(
      `SELECT id, support_no, category, note, status, created_at
       FROM support_notes WHERE outlet_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [session.outletId],
    )
    return {
      categories: SUPPORT_CATEGORIES,
      rows: rows.rows.map((row) => ({
        id: num(row.id),
        supportNo: row.support_no as string,
        category: row.category as string,
        note: row.note as string,
        status: row.status as string,
        createdAt: new Date(row.created_at as string).toISOString(),
      })),
    }
  })

  app.post("/api/v1/billing/management/support", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const parsed = z
      .object({ category: z.string().trim().min(1).max(60), note: z.string().trim().min(2).max(500) })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Category and a note are required.")
    const count = await pool.query<{ n: string }>("SELECT count(*)::int AS n FROM support_notes WHERE outlet_id = $1", [
      session.outletId,
    ])
    const supportNo = `SUP-${String(num(count.rows[0]!.n) + 1).padStart(4, "0")}`
    const row = await pool.query(
      `INSERT INTO support_notes (outlet_id, support_no, category, note) VALUES ($1,$2,$3,$4) RETURNING id`,
      [session.outletId, supportNo, parsed.data.category, parsed.data.note],
    )
    await audit(session, "support", "created", `${supportNo}: ${parsed.data.category}`, "support_note", String(row.rows[0]!.id))
    return { id: num(row.rows[0]!.id), supportNo }
  })

  app.get("/api/v1/billing/management/notifications", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const rows = await pool.query(
      `SELECT id, title, body, is_read, created_at FROM notifications
       WHERE outlet_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [session.outletId],
    )
    const unread = await pool.query<{ n: string }>(
      "SELECT count(*)::int AS n FROM notifications WHERE outlet_id = $1 AND NOT is_read",
      [session.outletId],
    )
    return {
      unread: num(unread.rows[0]!.n),
      rows: rows.rows.map((row) => ({
        id: num(row.id),
        title: row.title as string,
        body: row.body as string,
        read: row.is_read as boolean,
        createdAt: new Date(row.created_at as string).toISOString(),
      })),
    }
  })

  app.post("/api/v1/billing/management/notifications", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const parsed = z
      .object({ title: z.string().trim().min(1).max(120), body: z.string().trim().max(400).optional() })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "A title is required.")
    const row = await pool.query(
      `INSERT INTO notifications (outlet_id, title, body) VALUES ($1,$2,$3) RETURNING id`,
      [session.outletId, parsed.data.title, parsed.data.body ?? ""],
    )
    return { id: num(row.rows[0]!.id) }
  })

  app.put("/api/v1/billing/management/notifications/:id/read", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const id = Number((request.params as { id: string }).id)
    await pool.query("UPDATE notifications SET is_read = true WHERE id = $1 AND outlet_id = $2", [id, session.outletId])
    return { ok: true }
  })

  app.get("/api/v1/billing/management/services", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const rows = await pool.query(
      `SELECT ms.id, ms.code, ms.name, ms.blurb, ms.category,
              COALESCE(os.enabled, false) AS enabled, COALESCE(os.store_id, '') AS store_id
       FROM marketplace_services ms
       LEFT JOIN outlet_services os ON os.service_id = ms.id AND os.outlet_id = $1
       ORDER BY ms.category, ms.name`,
      [session.outletId],
    )
    return {
      rows: rows.rows.map((row) => ({
        id: num(row.id),
        code: row.code as string,
        name: row.name as string,
        blurb: row.blurb as string,
        category: row.category as string,
        enabled: row.enabled as boolean,
        storeId: row.store_id as string,
      })),
    }
  })

  app.put("/api/v1/billing/management/services/:id", async (request, reply) => {
    const session = await guard(request, reply)
    if (!session) return
    const id = Number((request.params as { id: string }).id)
    const parsed = z
      .object({ enabled: z.boolean(), storeId: z.string().trim().max(80).optional() })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Could not update the service.")
    const service = await pool.query("SELECT id, name FROM marketplace_services WHERE id = $1", [id])
    if (!service.rowCount) return sendError(reply, 404, "NOT_FOUND", "Service not found.")
    await pool.query(
      `INSERT INTO outlet_services (outlet_id, service_id, enabled, store_id)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (outlet_id, service_id) DO UPDATE SET enabled = EXCLUDED.enabled, store_id = EXCLUDED.store_id`,
      [session.outletId, id, parsed.data.enabled, parsed.data.storeId ?? ""],
    )
    await audit(
      session,
      "marketplace",
      parsed.data.enabled ? "enabled" : "disabled",
      `${service.rows[0]!.name} ${parsed.data.enabled ? "enabled" : "disabled"}`,
      "service",
      String(id),
    )
    return { ok: true }
  })
}

function mapAudit(row: Record<string, unknown>) {
  return {
    id: num(row.id),
    actorName: row.actor_name as string,
    source: row.source as string,
    category: row.category as string,
    action: row.action as string,
    summary: row.summary as string,
    createdAt: new Date(row.created_at as string).toISOString(),
  }
}

async function audit(
  session: BillingPrincipal,
  category: string,
  action: string,
  summary: string,
  entityType: string,
  entityId: string,
) {
  await writeAudit({
    outletId: session.outletId,
    actorName: session.adminName,
    category,
    action,
    summary,
    entityType,
    entityId,
  })
}

function isUnique(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "23505"
}

async function moveWallet(outletId: number, cardId: number, delta: number, kind: string, note: string) {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const card = await client.query<{ balance_paise: string; status: string }>(
      "SELECT balance_paise, status FROM wallet_cards WHERE id = $1 AND outlet_id = $2 FOR UPDATE",
      [cardId, outletId],
    )
    if (!card.rows[0]) {
      await client.query("ROLLBACK")
      return "missing" as const
    }
    if (card.rows[0].status !== "active") {
      await client.query("ROLLBACK")
      return "blocked" as const
    }
    const next = num(card.rows[0].balance_paise) + delta
    if (next < 0) {
      await client.query("ROLLBACK")
      return "short" as const
    }
    await client.query("UPDATE wallet_cards SET balance_paise = $3 WHERE id = $1 AND outlet_id = $2", [cardId, outletId, next])
    await client.query(
      `INSERT INTO wallet_txns (outlet_id, card_id, kind, amount_paise, note) VALUES ($1,$2,$3,$4,$5)`,
      [outletId, cardId, kind, Math.abs(delta), note],
    )
    await client.query("COMMIT")
    return "ok" as const
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}
