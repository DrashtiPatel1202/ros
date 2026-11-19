export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export type Session = {
  managerName: string
  outlet: { name: string; timezone: string; currency: string; taxRateBps: number }
}

export type MenuItem = {
  id: number
  categoryId?: number
  name: string
  shortCode: string | null
  pricePaise: number
  dietary: "veg" | "non_veg" | "egg"
}

export type OrderSummary = {
  id: number
  orderNo: number
  status: "open" | "cancelled"
  orderType: "dine_in" | "pickup" | "delivery"
  tableLabel: string | null
  customerName: string | null
  itemCount: number
  totalPaise: number
  createdAt: string
}

export type OrderDetail = OrderSummary & {
  note: string | null
  version: number
  subtotalPaise: number
  taxPaise: number
  lines: {
    menuItemId: number
    name: string
    unitPricePaise: number
    qty: number
    lineTotalPaise: number
    note: string | null
  }[]
}

export type SavedOrder = {
  id: number
  orderNo: number
  status: string
  version: number
  itemCount: number
  subtotalPaise: number
  taxPaise: number
  totalPaise: number
  createdAt: string
}

export type Draft = {
  orderType: OrderDetail["orderType"]
  tableLabel?: string
  customerName?: string
  note?: string
  lines: { menuItemId: number; qty: number; note?: string }[]
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  })
  if (response.status === 204) return undefined as T
  const payload = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null
  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error?.code ?? "ERROR",
      payload?.error?.message ?? "Something went wrong. Try again.",
    )
  }
  return payload as T
}

export const api = {
  session: () => request<Session>("/api/v1/session"),
  signIn: (pin: string) => request<Session>("/api/v1/session", { method: "POST", body: JSON.stringify({ pin }) }),
  signOut: () => request<{ ok: true }>("/api/v1/session", { method: "DELETE" }),
  categories: () => request<{ categories: { id: number; name: string }[] }>("/api/v1/menu/categories"),
  items: (categoryId: number) => request<{ items: MenuItem[] }>(`/api/v1/menu/items?categoryId=${categoryId}`),
  search: (q: string) => request<{ items: MenuItem[] }>(`/api/v1/menu/search?q=${encodeURIComponent(q)}`),
  orders: (status: string, cursor?: string) => {
    const params = new URLSearchParams({ limit: "30" })
    if (status) params.set("status", status)
    if (cursor) params.set("cursor", cursor)
    return request<{ orders: OrderSummary[]; nextCursor: string | null }>(`/api/v1/orders?${params}`)
  },
  order: (id: number) => request<OrderDetail>(`/api/v1/orders/${id}`),
  createOrder: (draft: Draft, idempotencyKey: string) =>
    request<SavedOrder>("/api/v1/orders", {
      method: "POST",
      body: JSON.stringify(draft),
      headers: { "idempotency-key": idempotencyKey },
    }),
  updateOrder: (id: number, draft: Draft & { version: number }) =>
    request<SavedOrder>(`/api/v1/orders/${id}`, { method: "PUT", body: JSON.stringify(draft) }),
  cancelOrder: (id: number, version: number) =>
    request<{ ok: true }>(`/api/v1/orders/${id}/cancel`, { method: "POST", body: JSON.stringify({ version }) }),
}

export const ORDER_TYPE_LABEL = {
  dine_in: "Dine in",
  pickup: "Pickup",
  delivery: "Delivery",
} as const
