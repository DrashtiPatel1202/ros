import assert from "node:assert/strict"
import test from "node:test"
import { pool } from "./db.ts"
import { cancelOrder, createOrder, getOrder, OrderError, updateOrder } from "./orders.ts"

test("save is idempotent, then the order can be changed and cancelled", async () => {
  const item = await pool.query<{ id: string; price_paise: number }>(
    "SELECT id, price_paise FROM menu_items WHERE is_available ORDER BY id LIMIT 1",
  )
  const outlet = await pool.query<{ id: string; tax_rate_bps: number }>(
    "SELECT id, tax_rate_bps FROM outlets ORDER BY id LIMIT 1",
  )
  const menuItemId = Number(item.rows[0]?.id)
  const price = item.rows[0]?.price_paise
  const outletId = Number(outlet.rows[0]?.id)
  const taxRateBps = outlet.rows[0]?.tax_rate_bps
  assert.ok(menuItemId && price !== undefined && outletId && taxRateBps !== undefined)

  const draft = {
    orderType: "pickup" as const,
    customerName: "Integration guest",
    lines: [{ menuItemId, qty: 2, note: "mild" }],
  }
  const key = `test-${crypto.randomUUID()}`
  let orderId = 0
  try {
    const created = await createOrder(pool, outletId, key, draft)
    orderId = created.body.id
    assert.equal(created.status, 201)
    assert.equal(created.body.subtotalPaise, price * 2)
    assert.equal(created.body.taxPaise, Math.round((price * 2 * taxRateBps) / 10_000))
    const saved = await getOrder(pool, outletId, created.body.id)
    assert.equal(saved?.lines[0]?.note, "mild")

    const replay = await createOrder(pool, outletId, key, draft)
    assert.equal(replay.body.id, created.body.id)

    await assert.rejects(
      () => createOrder(pool, outletId, key, { ...draft, note: "changed" }),
      (error: unknown) => error instanceof OrderError && error.code === "IDEMPOTENCY_CONFLICT",
    )

    const updated = await updateOrder(pool, outletId, created.body.id, created.body.version, {
      ...draft,
      lines: [{ menuItemId, qty: 1 }],
    })
    assert.equal(updated.itemCount, 1)
    assert.equal(updated.version, created.body.version + 1)

    await assert.rejects(
      () => cancelOrder(pool, outletId, created.body.id, created.body.version),
      (error: unknown) => error instanceof OrderError && error.code === "VERSION_CONFLICT",
    )
    await cancelOrder(pool, outletId, created.body.id, updated.version)
    const loaded = await getOrder(pool, outletId, created.body.id)
    assert.equal(loaded?.status, "cancelled")
    assert.equal(loaded?.lines[0]?.note, null)
  } finally {
    if (orderId) {
      await pool.query("DELETE FROM order_items WHERE order_id = $1", [orderId])
      await pool.query("DELETE FROM orders WHERE id = $1", [orderId])
    }
    await pool.query("DELETE FROM idempotency_keys WHERE key = $1", [`${outletId}:${key}`])
    await pool.end()
  }
})
