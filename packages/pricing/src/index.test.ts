import assert from "node:assert/strict"
import test from "node:test"
import { summarize } from "./index.ts"

test("flat GST rounds half up to the paisa", () => {
  const bill = summarize(
    [
      { unitPricePaise: 12_550, qty: 2 },
      { unitPricePaise: 4_000, qty: 1 },
    ],
    500,
  )
  assert.equal(bill.itemCount, 3)
  assert.equal(bill.subtotalPaise, 29_100)
  assert.equal(bill.taxPaise, 1_455)
  assert.equal(bill.totalPaise, 30_555)
})

test("zero tax leaves the subtotal unchanged", () => {
  const bill = summarize([{ unitPricePaise: 100, qty: 1 }], 0)
  assert.equal(bill.taxPaise, 0)
  assert.equal(bill.totalPaise, 100)
})

test("rejects a quantity of zero", () => {
  assert.throws(() => summarize([{ unitPricePaise: 100, qty: 0 }], 500))
})