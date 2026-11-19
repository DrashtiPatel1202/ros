export type PricedLine = {
  unitPricePaise: number
  qty: number
}

export type BillSummary = {
  itemCount: number
  subtotalPaise: number
  taxPaise: number
  totalPaise: number
}

/** Half-up integer tax. Prices are paise so the result is exact to one paisa. */
export function summarize(lines: PricedLine[], taxRateBps: number): BillSummary {
  if (!Number.isInteger(taxRateBps) || taxRateBps < 0 || taxRateBps > 10_000) {
    throw new Error("Tax rate is out of range")
  }
  let subtotalPaise = 0
  let itemCount = 0
  for (const line of lines) {
    if (!Number.isInteger(line.qty) || line.qty < 1) throw new Error("Quantity is invalid")
    if (!Number.isInteger(line.unitPricePaise) || line.unitPricePaise < 0) {
      throw new Error("Price is invalid")
    }
    const lineTotal = line.unitPricePaise * line.qty
    if (!Number.isSafeInteger(lineTotal)) throw new Error("Line total overflow")
    subtotalPaise += lineTotal
    itemCount += line.qty
  }
  if (!Number.isSafeInteger(subtotalPaise)) throw new Error("Subtotal overflow")
  const taxPaise = Math.round((subtotalPaise * taxRateBps) / 10_000)
  return {
    itemCount,
    subtotalPaise,
    taxPaise,
    totalPaise: subtotalPaise + taxPaise,
  }
}

export function formatInr(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100)
}