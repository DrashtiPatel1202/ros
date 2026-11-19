import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { checkBillingPassword } from "./billing.ts"
import { requireBilling } from "./billingAuth.ts"
import { pool } from "./db.ts"
import { sendError } from "./http.ts"

const NEXT_STATUS: Record<string, string> = {
  waiting: "accepted",
  accepted: "preparing_kot",
  preparing_kot: "preparing_bill",
  preparing_bill: "food_ready",
  food_ready: "dispatched",
  dispatched: "delivered",
}

async function ensureOperations() {
  const sqlPath = join(dirname(fileURLToPath(import.meta.url)), "../sql/007_gaps.sql")
  await pool.query(readFileSync(sqlPath, "utf8"))
}

function isoDate(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export async function registerOperationsRoutes(app: FastifyInstance) {
  await ensureOperations()

  app.get("/api/v1/billing/online-orders", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const q = request.query as { status?: string; client?: string; orderNo?: string }
    const rows = await pool.query(
      `SELECT id, client, client_order_id, status, customer_name, customer_phone, rider_name, otp,
              total_paise, note, order_id, created_at
       FROM online_orders
       WHERE outlet_id = $1
         AND ($2::text IS NULL OR status = $2)
         AND ($3::text IS NULL OR client = $3)
         AND ($4::text IS NULL OR client_order_id ILIKE '%' || $4 || '%')
       ORDER BY created_at DESC LIMIT 100`,
      [session.outletId, q.status && q.status !== "all" ? q.status : null, q.client && q.client !== "all" ? q.client : null, q.orderNo?.trim() || null],
    )
    return {
      rows: rows.rows.map((row) => ({
        id: Number(row.id),
        client: row.client as string,
        clientOrderId: row.client_order_id as string,
        status: row.status as string,
        customerName: row.customer_name as string,
        customerPhone: row.customer_phone as string,
        riderName: row.rider_name as string,
        otp: row.otp as string,
        totalPaise: Number(row.total_paise),
        note: row.note as string,
        orderId: row.order_id == null ? null : Number(row.order_id),
        createdAt: new Date(row.created_at as string).toISOString(),
      })),
    }
  })

  app.post("/api/v1/billing/online-orders", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const parsed = z
      .object({
        client: z.enum(["Zomato", "Swiggy", "Website", "Magicpin"]),
        clientOrderId: z.string().trim().min(1).max(40),
        customerName: z.string().trim().max(80).default(""),
        customerPhone: z.string().trim().max(20).default(""),
        note: z.string().trim().max(200).default(""),
        lines: z.array(z.object({ menuItemId: z.number().int().positive(), qty: z.number().int().min(1).max(99) })).min(1).max(20),
      })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Channel, order number and at least one item are required.")
    const ids = parsed.data.lines.map((line) => line.menuItemId)
    const found = await pool.query<{ id: string; name: string; price_paise: number }>(
      `SELECT id, name, price_paise FROM menu_items WHERE outlet_id = $1 AND id = ANY($2::bigint[]) AND is_available`,
      [session.outletId, ids],
    )
    const byId = new Map(found.rows.map((row) => [Number(row.id), row]))
    const items = []
    let subtotal = 0
    for (const line of parsed.data.lines) {
      const item = byId.get(line.menuItemId)
      if (!item) return sendError(reply, 409, "ITEM_UNAVAILABLE", "One of those dishes is no longer available")
      const lineTotal = item.price_paise * line.qty
      subtotal += lineTotal
      items.push({ menuItemId: line.menuItemId, name: item.name, qty: line.qty, unitPricePaise: item.price_paise, lineTotalPaise: lineTotal })
    }
    const tax = await pool.query<{ tax_rate_bps: number }>("SELECT tax_rate_bps FROM outlets WHERE id = $1", [session.outletId])
    const taxPaise = Math.round((subtotal * (tax.rows[0]?.tax_rate_bps ?? 500)) / 10_000)
    const total = subtotal + taxPaise
    try {
      const row = await pool.query(
        `INSERT INTO online_orders (outlet_id, client, client_order_id, status, customer_name, customer_phone, total_paise, items, note)
         VALUES ($1,$2,$3,'waiting',$4,$5,$6,$7::jsonb,$8) RETURNING id`,
        [session.outletId, parsed.data.client, parsed.data.clientOrderId, parsed.data.customerName, parsed.data.customerPhone, total, JSON.stringify(items), parsed.data.note],
      )
      return { id: Number(row.rows[0]!.id), totalPaise: total }
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "23505") {
        return sendError(reply, 409, "DUPLICATE", "That channel order number is already recorded.")
      }
      throw error
    }
  })

  app.post("/api/v1/billing/online-orders/:id/advance", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const id = Number((request.params as { id: string }).id)
    const parsed = z.object({ riderName: z.string().trim().max(80).optional(), otp: z.string().trim().max(8).optional() }).safeParse(request.body ?? {})
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Check the rider details.")
    const current = await pool.query<{ status: string }>("SELECT status FROM online_orders WHERE id = $1 AND outlet_id = $2", [id, session.outletId])
    if (!current.rowCount) return sendError(reply, 404, "NOT_FOUND", "Online order not found.")
    const next = NEXT_STATUS[current.rows[0]!.status]
    if (!next) return sendError(reply, 409, "ORDER_CLOSED", "This order cannot move forward.")
    await pool.query(
      `UPDATE online_orders SET status = $3, rider_name = COALESCE($4, rider_name), otp = COALESCE($5, otp) WHERE id = $1 AND outlet_id = $2`,
      [id, session.outletId, next, parsed.data.riderName || null, parsed.data.otp || null],
    )
    return { status: next }
  })

  app.post("/api/v1/billing/online-orders/:id/cancel", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const id = Number((request.params as { id: string }).id)
    const updated = await pool.query(
      `UPDATE online_orders SET status = 'cancelled'
       WHERE id = $1 AND outlet_id = $2 AND status IN ('waiting', 'accepted') RETURNING id`,
      [id, session.outletId],
    )
    if (!updated.rowCount) return sendError(reply, 409, "ORDER_CLOSED", "Only a waiting or accepted order can be cancelled.")
    return { ok: true }
  })

  app.post("/api/v1/billing/online-orders/:id/invoice", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const id = Number((request.params as { id: string }).id)
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      const online = await client.query<{
        status: string
        customer_name: string
        customer_phone: string
        total_paise: number
        items: { menuItemId: number; name: string; qty: number; unitPricePaise: number; lineTotalPaise: number }[]
        order_id: string | null
        client: string
        client_order_id: string
      }>(
        `SELECT status, customer_name, customer_phone, total_paise, items, order_id, client, client_order_id
         FROM online_orders WHERE id = $1 AND outlet_id = $2 FOR UPDATE`,
        [id, session.outletId],
      )
      const row = online.rows[0]
      if (!row) {
        await client.query("ROLLBACK")
        return sendError(reply, 404, "NOT_FOUND", "Online order not found.")
      }
      if (row.order_id) {
        await client.query("ROLLBACK")
        return { orderId: Number(row.order_id) }
      }
      const outlet = await client.query<{ tax_rate_bps: number; timezone: string }>("SELECT tax_rate_bps, timezone FROM outlets WHERE id = $1", [session.outletId])
      const businessDate = new Date().toLocaleDateString("en-CA", { timeZone: outlet.rows[0]?.timezone ?? "Asia/Kolkata" })
      const number = await client.query<{ last_no: number }>(
        `INSERT INTO order_counters (outlet_id, business_date, last_no) VALUES ($1, $2, 1)
         ON CONFLICT (outlet_id, business_date) DO UPDATE SET last_no = order_counters.last_no + 1 RETURNING last_no`,
        [session.outletId, businessDate],
      )
      const subtotal = row.items.reduce((sum, line) => sum + line.lineTotalPaise, 0)
      const taxPaise = Math.round((subtotal * (outlet.rows[0]?.tax_rate_bps ?? 500)) / 10_000)
      const inserted = await client.query(
        `INSERT INTO orders (
           outlet_id, order_no, business_date, order_type, status, customer_name, customer_phone,
           note, payment_type, paid_paise, item_count, subtotal_paise, tax_paise, total_paise, biller_name, printed_at
         ) VALUES ($1,$2,$3,'delivery','printed',$4,$5,$6,'online',$7,$8,$9,$10,$11,$12,now()) RETURNING id`,
        [
          session.outletId,
          number.rows[0]!.last_no,
          businessDate,
          row.customer_name,
          row.customer_phone,
          `${row.client} ${row.client_order_id}`,
          subtotal + taxPaise,
          row.items.reduce((sum, line) => sum + line.qty, 0),
          subtotal,
          taxPaise,
          subtotal + taxPaise,
          session.adminName,
        ],
      )
      const orderId = Number(inserted.rows[0]!.id)
      for (const [index, line] of row.items.entries()) {
        await client.query(
          `INSERT INTO order_items (order_id, outlet_id, menu_item_id, item_name, unit_price_paise, qty, line_total_paise, sort_rank)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [orderId, session.outletId, line.menuItemId, line.name, line.unitPricePaise, line.qty, line.lineTotalPaise, index],
        )
      }
      await client.query(`UPDATE online_orders SET order_id = $2, status = CASE WHEN status IN ('waiting','accepted','preparing_kot') THEN 'preparing_bill' ELSE status END WHERE id = $1`, [id, orderId])
      await client.query("COMMIT")
      return { orderId }
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  })

  app.get("/api/v1/billing/day-end", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const rows = await pool.query(
      `SELECT id, business_date, biller_name, order_count, total_paise, cash_paise, card_paise, upi_paise, other_paise, closed_at
       FROM day_ends WHERE outlet_id = $1 ORDER BY business_date DESC LIMIT 60`,
      [session.outletId],
    )
    const open = await pool.query<{ business_date: Date; orders: string; total: string; cash: string; card: string; upi: string; other: string }>(
      `SELECT (now() AT TIME ZONE $2)::date AS business_date,
              count(*)::int AS orders,
              COALESCE(SUM(total_paise), 0)::bigint AS total,
              COALESCE(SUM(total_paise) FILTER (WHERE payment_type = 'cash'), 0)::bigint AS cash,
              COALESCE(SUM(total_paise) FILTER (WHERE payment_type = 'card'), 0)::bigint AS card,
              COALESCE(SUM(total_paise) FILTER (WHERE payment_type IN ('upi','online')), 0)::bigint AS upi,
              COALESCE(SUM(total_paise) FILTER (WHERE payment_type NOT IN ('cash','card','upi','online')), 0)::bigint AS other
       FROM orders
       WHERE outlet_id = $1 AND status = 'settled' AND business_date = (now() AT TIME ZONE $2)::date`,
      [session.outletId, session.timezone],
    )
    const preview = open.rows[0]!
    return {
      today: {
        businessDate: isoDate(new Date(preview.business_date)),
        orderCount: Number(preview.orders),
        totalPaise: Number(preview.total),
        cashPaise: Number(preview.cash),
        cardPaise: Number(preview.card),
        upiPaise: Number(preview.upi),
        otherPaise: Number(preview.other),
        closed: rows.rows.some((row) => isoDate(new Date(row.business_date as Date)) === isoDate(new Date(preview.business_date))),
      },
      rows: rows.rows.map((row) => ({
        id: Number(row.id),
        businessDate: isoDate(new Date(row.business_date as Date)),
        billerName: row.biller_name as string,
        orderCount: row.order_count as number,
        totalPaise: Number(row.total_paise),
        cashPaise: Number(row.cash_paise),
        cardPaise: Number(row.card_paise),
        upiPaise: Number(row.upi_paise),
        otherPaise: Number(row.other_paise),
        closedAt: new Date(row.closed_at as string).toISOString(),
      })),
    }
  })

  app.post("/api/v1/billing/day-end", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const totals = await pool.query<{ orders: string; total: string; cash: string; card: string; upi: string; other: string; business_date: Date }>(
      `SELECT (now() AT TIME ZONE $2)::date AS business_date,
              count(*)::int AS orders,
              COALESCE(SUM(total_paise), 0)::bigint AS total,
              COALESCE(SUM(total_paise) FILTER (WHERE payment_type = 'cash'), 0)::bigint AS cash,
              COALESCE(SUM(total_paise) FILTER (WHERE payment_type = 'card'), 0)::bigint AS card,
              COALESCE(SUM(total_paise) FILTER (WHERE payment_type IN ('upi','online')), 0)::bigint AS upi,
              COALESCE(SUM(total_paise) FILTER (WHERE payment_type NOT IN ('cash','card','upi','online')), 0)::bigint AS other
       FROM orders WHERE outlet_id = $1 AND status = 'settled' AND business_date = (now() AT TIME ZONE $2)::date`,
      [session.outletId, session.timezone],
    )
    const row = totals.rows[0]!
    try {
      const saved = await pool.query(
        `INSERT INTO day_ends (outlet_id, business_date, biller_name, order_count, total_paise, cash_paise, card_paise, upi_paise, other_paise)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [session.outletId, row.business_date, session.adminName, row.orders, row.total, row.cash, row.card, row.upi, row.other],
      )
      return { id: Number(saved.rows[0]!.id) }
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "23505") {
        return sendError(reply, 409, "DUPLICATE", "Today is already closed.")
      }
      throw error
    }
  })

  app.delete("/api/v1/billing/day-end/:id", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const id = Number((request.params as { id: string }).id)
    const parsed = z.object({ password: z.string().min(4) }).safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Enter the account password to remove a day end.")
    if (!(await checkBillingPassword(session.adminId, parsed.data.password))) {
      return sendError(reply, 401, "BAD_CREDENTIALS", "Password is incorrect.")
    }
    const removed = await pool.query("DELETE FROM day_ends WHERE id = $1 AND outlet_id = $2 RETURNING id", [id, session.outletId])
    if (!removed.rowCount) return sendError(reply, 404, "NOT_FOUND", "Day end not found.")
    return { ok: true }
  })

  app.get("/api/v1/billing/deliveries", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const rows = await pool.query(
      `SELECT id, order_no, business_date, status, customer_name, customer_phone, total_paise, delivery_provider, created_at
       FROM orders
       WHERE outlet_id = $1 AND order_type = 'delivery'
       ORDER BY created_at DESC LIMIT 100`,
      [session.outletId],
    )
    const chart = await pool.query<{ day: Date; orders: string; delivered: string }>(
      `SELECT business_date AS day,
              count(*)::int AS orders,
              count(*) FILTER (WHERE status = 'settled')::int AS delivered
       FROM orders
       WHERE outlet_id = $1 AND order_type = 'delivery' AND business_date >= (now() AT TIME ZONE $2)::date - 6
       GROUP BY business_date ORDER BY business_date`,
      [session.outletId, session.timezone],
    )
    return {
      rows: rows.rows.map((row) => ({
        id: Number(row.id),
        orderNo: row.order_no as number,
        businessDate: isoDate(new Date(row.business_date as Date)),
        status: row.status as string,
        customerName: (row.customer_name as string | null) ?? "",
        customerPhone: (row.customer_phone as string | null) ?? "",
        totalPaise: Number(row.total_paise),
        provider: (row.delivery_provider as string | null) ?? "",
      })),
      chart: chart.rows.map((row) => ({
        day: isoDate(new Date(row.day)),
        orders: Number(row.orders),
        delivered: Number(row.delivered),
      })),
    }
  })

  app.put("/api/v1/billing/deliveries/:id", async (request, reply) => {
    const session = await requireBilling(request, reply)
    if (!session) return
    const id = Number((request.params as { id: string }).id)
    const parsed = z.object({ provider: z.string().trim().max(40) }).safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, "VALIDATION", "Choose a delivery provider.")
    const updated = await pool.query(
      `UPDATE orders SET delivery_provider = $3 WHERE id = $1 AND outlet_id = $2 AND order_type = 'delivery' RETURNING id`,
      [id, session.outletId, parsed.data.provider],
    )
    if (!updated.rowCount) return sendError(reply, 404, "NOT_FOUND", "Delivery order not found.")
    return { ok: true }
  })
}
