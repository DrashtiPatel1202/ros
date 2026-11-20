export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export type BillingSession = {
  adminName: string
  email: string
  twoFactorEnabled: boolean
  outlet: {
    id: number
    name: string
    brandCount: number
    timezone: string
  }
  appVersion: string
}

export type DashboardData = {
  sync: { posDaysAgo: number; ordersDaysAgo: number }
  sales: {
    dateLabel: string
    totalPaise: number
    orderCount: number
    byTender: { label: string; amountPaise: number; share: number }[]
    byChannel: {
      key: "dine_in" | "pickup" | "delivery"
      label: string
      totalPaise: number
      orderCount: number
      share: number
      minPaise: number
      avgPaise: number
      maxPaise: number
      discountPaise: number
      taxPaise: number
      ttaMinutes: number
    }[]
    chart: { categories: string[]; dineIn: number[]; pickup: number[]; delivery: number[] }
  }
  online: {
    totalOrders: number
    prepaid: number
    cod: number
    revenuePaise: number
    platforms: { name: string; orders: number; prepaid: number; cod: number; revenuePaise: number }[]
  }
  items?: { name: string; qty: number; totalPaise: number }[]
  actionCenter: { id: string; title: string; detail: string; count: number; items: { id: number; name: string }[] }[]
  onboarding: {
    completed: number
    total: number
    steps: { id: string; label: string; done: boolean }[]
    taxes: { id: number; title: string; rateBps: number }[]
  }
  snapshotReady: boolean
  snapshotDate: string
  expenses: { expensePaise: number; withdrawalPaise: number; topupPaise: number }
  retentionPct: number
  risk: { unverifiedPaise: number; checks: string[] }
}

export function isAbortedRequest(caught: unknown) {
  return caught instanceof DOMException && caught.name === "AbortError"
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      credentials: "include",
      headers: {
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...init?.headers,
      },
    })
  } catch (caught) {
    if (isAbortedRequest(caught)) throw caught
    throw new ApiError(
      0,
      "NETWORK",
      "Billing API is not reachable. Run npm run dev:clone and open http://127.0.0.1:5174/.",
    )
  }
  const payload = (await response.json().catch(() => null)) as {
    message?: string
    error?: { code?: string; message?: string } | string
  } | null
  if (!response.ok) {
    const nested = payload?.error
    const message =
      nested && typeof nested === "object" && nested.message
        ? nested.message
        : typeof payload?.message === "string" && payload.message
          ? payload.message
          : "Something went wrong. Try again."
    const code = nested && typeof nested === "object" && nested.code ? nested.code : "ERROR"
    throw new ApiError(response.status, code, message)
  }
  return payload as T
}

export const api = {
  session: () => request<BillingSession>("/api/v1/billing/session"),
  outlets: () =>
    request<{ rows: { id: number; name: string; timezone: string; current: boolean }[] }>("/api/v1/billing/outlets"),
  switchOutlet: (outletId: number) =>
    request<BillingSession>("/api/v1/billing/session/outlet", {
      method: "POST",
      body: JSON.stringify({ outletId }),
    }),
  identify: (identifier: string) =>
    request<{ ok: true; maskedHint: string }>("/api/v1/billing/session/identify", {
      method: "POST",
      body: JSON.stringify({ identifier }),
    }),
  signIn: (identifier: string, password: string) =>
    request<BillingSession>("/api/v1/billing/session", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    }),
  signOut: () => request<{ ok: true }>("/api/v1/billing/session", { method: "DELETE" }),
  updateProfile: (body: { twoFactorEnabled?: boolean; currentPassword?: string; newPassword?: string }) =>
    request<BillingSession>("/api/v1/billing/profile", { method: "PUT", body: JSON.stringify(body) }),
  dashboard: (range: string) =>
    request<DashboardData>(`/api/v1/billing/dashboard?range=${encodeURIComponent(range)}`),
  saveFssai: (value: string) =>
    request<{ ok: true }>("/api/v1/billing/dashboard/fssai", {
      method: "POST",
      body: JSON.stringify({ fssai: value }),
    }),
  saveOnboardingItem: (id: number, body: { description?: string; imageUrl?: string }) =>
    request<{ ok: true }>(`/api/v1/billing/dashboard/items/${id}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  saveItemTax: (id: number, taxId: number) =>
    request<{ ok: true }>(`/api/v1/billing/dashboard/items/${id}/tax`, {
      method: "POST",
      body: JSON.stringify({ taxId }),
    }),
  dismissAction: (id: string) =>
    request<{ ok: true }>(`/api/v1/billing/dashboard/actions/${id}/dismiss`, { method: "POST" }),

  posBootstrap: () => request<PosBootstrap>("/api/v1/billing/pos/bootstrap"),
  posCreateOrder: (body: PosCreateBody) =>
    request<PosOrderDetail>("/api/v1/billing/pos/orders", { method: "POST", body: JSON.stringify(body) }),
  posUpdateOrder: (id: number, body: PosUpdateBody) =>
    request<PosOrderDetail>(`/api/v1/billing/pos/orders/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  posCancelOrder: (id: number, version: number, reason: string) =>
    request<{ ok: true }>(`/api/v1/billing/pos/orders/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ version, reason }),
    }),
  posOrder: (id: number) => request<PosOrderDetail>(`/api/v1/billing/pos/orders/${id}`),
  posLive: () => request<PosLiveResponse>("/api/v1/billing/pos/live"),
  posKots: (params: {
    status?: string
    orderType?: string
    tableNo?: string
    kotId?: string
    from?: string
    to?: string
    customer?: string
    modified?: string
    all?: string
  }) => {
    const q = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value && value !== "all") q.set(key, value)
    }
    const qs = q.toString()
    return request<{ businessDate: string; kots: PosKot[] }>(`/api/v1/billing/pos/kots${qs ? `?${qs}` : ""}`)
  },
  posMoveTable: (id: number, version: number, tableLabel: string) =>
    request<PosOrder>(`/api/v1/billing/pos/orders/${id}/move`, {
      method: "POST",
      body: JSON.stringify({ version, tableLabel }),
    }),
  config: () => request<OutletConfig>("/api/v1/billing/config"),
  saveConfig: (body: { section: string; value: unknown; outletName?: string; timezone?: string }) =>
    request<{ settings: OutletConfig["settings"] }>("/api/v1/billing/config", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  subOrderTypes: () => request<{ rows: { id: number; name: string; active: boolean }[] }>("/api/v1/billing/config/sub-order-types"),
  addSubOrderType: (name: string) =>
    request<{ id: number }>("/api/v1/billing/config/sub-order-types", { method: "POST", body: JSON.stringify({ name }) }),
  toggleSubOrderType: (id: number, active: boolean) =>
    request<{ ok: true }>(`/api/v1/billing/config/sub-order-types/${id}`, {
      method: "PUT",
      body: JSON.stringify({ active }),
    }),
  deleteSubOrderType: (id: number) =>
    request<{ ok: true }>(`/api/v1/billing/config/sub-order-types/${id}`, { method: "DELETE" }),
  deliveryDistances: () =>
    request<{ rows: { id: number; fromKm: number; toKm: number; chargePaise: number }[] }>(
      "/api/v1/billing/config/delivery-distances",
    ),
  addDeliveryDistance: (body: { fromKm: number; toKm: number; chargePaise: number }) =>
    request<{ id: number }>("/api/v1/billing/config/delivery-distances", { method: "POST", body: JSON.stringify(body) }),
  deleteDeliveryDistance: (id: number) =>
    request<{ ok: true }>(`/api/v1/billing/config/delivery-distances/${id}`, { method: "DELETE" }),
  areaCharges: () =>
    request<{ rows: { id: number; areaName: string; chargePaise: number; active: boolean }[] }>(
      "/api/v1/billing/config/area-charges",
    ),
  addAreaCharge: (areaName: string, chargePaise: number) =>
    request<{ id: number }>("/api/v1/billing/config/area-charges", {
      method: "POST",
      body: JSON.stringify({ areaName, chargePaise }),
    }),
  deleteAreaCharge: (id: number) =>
    request<{ ok: true }>(`/api/v1/billing/config/area-charges/${id}`, { method: "DELETE" }),
  floorPlans: () =>
    request<{ rows: { id: number; name: string; active: boolean; createdAt: string }[] }>(
      "/api/v1/billing/config/floor-plans",
    ),
  addFloorPlan: (name: string) =>
    request<{ id: number; name: string; active: boolean; createdAt: string }>("/api/v1/billing/config/floor-plans", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  updateFloorPlan: (id: number, body: { name?: string; active?: boolean }) =>
    request<{ ok: true }>(`/api/v1/billing/config/floor-plans/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteFloorPlan: (id: number) =>
    request<{ ok: true }>(`/api/v1/billing/config/floor-plans/${id}`, { method: "DELETE" }),
  saveTable: (body: { floorPlanId: number; area: string; tableNo: string; seats: number }) =>
    request<{ ok: true }>("/api/v1/billing/config/tables", { method: "POST", body: JSON.stringify(body) }),
  floorPlan: (floorPlanId: number) =>
    request<{
      floorPlanId: number
      floorPlanName: string
      tables: {
        id: number
        area: string
        tableNo: string
        seats: number
        x: number
        y: number
        width: number
        height: number
        shape: TableShape
        textSize: number
        placed: boolean
      }[]
      barriers: { id: number; x: number; y: number; width: number; height: number }[]
    }>(`/api/v1/billing/config/floor?floorPlanId=${floorPlanId}`),
  saveFloor: (body: {
    floorPlanId: number
    tables: {
      id: number
      x: number
      y: number
      width: number
      height: number
      shape: TableShape
      textSize: number
      placed: boolean
    }[]
    barriers: { x: number; y: number; width: number; height: number }[]
  }) => request<{ ok: true }>("/api/v1/billing/config/floor", { method: "PUT", body: JSON.stringify(body) }),
  removeTable: (id: number) => request<{ ok: true }>(`/api/v1/billing/config/tables/${id}`, { method: "DELETE" }),
  menuAdmin: () =>
    request<{
      categories: { id: number; name: string; sortRank: number; active: boolean; itemCount: number }[]
      items: {
        id: number
        categoryId: number
        name: string
        shortCode: string
        pricePaise: number
        dietary: "veg" | "non_veg" | "egg"
        available: boolean
      }[]
      variants: { id: number; name: string; pricePaise: number; active: boolean }[]
      itemVariants: { itemId: number; variantId: number; pricePaise: number | null }[]
      addonGroups: {
        id: number
        name: string
        minSelect: number
        maxSelect: number
        active: boolean
        items: { id: number; name: string; pricePaise: number; active: boolean }[]
      }[]
      itemAddonGroups: { itemId: number; groupId: number }[]
    }>("/api/v1/billing/menu"),
  addMenuCategory: (name: string) =>
    request<{ id: number }>("/api/v1/billing/menu/categories", { method: "POST", body: JSON.stringify({ name }) }),
  updateMenuCategory: (id: number, body: { name?: string; active?: boolean }) =>
    request<{ ok: true }>(`/api/v1/billing/menu/categories/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  addMenuItem: (body: {
    name: string
    categoryId: number
    pricePaise: number
    shortCode?: string
    dietary: "veg" | "non_veg" | "egg"
  }) => request<{ id: number }>("/api/v1/billing/menu/items", { method: "POST", body: JSON.stringify(body) }),
  updateMenuItem: (
    id: number,
    body: Partial<{
      name: string
      categoryId: number
      pricePaise: number
      shortCode: string
      dietary: "veg" | "non_veg" | "egg"
      available: boolean
    }>,
  ) => request<{ ok: true }>(`/api/v1/billing/menu/items/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  saveVariant: (body: { name: string; pricePaise: number }) =>
    request<{ id: number }>("/api/v1/billing/menu/variants", { method: "POST", body: JSON.stringify(body) }),
  assignVariants: (itemId: number, variantIds: number[]) =>
    request<{ ok: true }>(`/api/v1/billing/menu/items/${itemId}/variants`, { method: "PUT", body: JSON.stringify({ variantIds }) }),
  saveAddonGroup: (body: { name: string; minSelect: number; maxSelect: number }) =>
    request<{ id: number }>("/api/v1/billing/menu/addon-groups", { method: "POST", body: JSON.stringify(body) }),
  saveAddonItem: (groupId: number, body: { name: string; pricePaise: number }) =>
    request<{ id: number }>(`/api/v1/billing/menu/addon-groups/${groupId}/items`, { method: "POST", body: JSON.stringify(body) }),
  assignAddons: (itemId: number, groupIds: number[]) =>
    request<{ ok: true }>(`/api/v1/billing/menu/items/${itemId}/addons`, { method: "PUT", body: JSON.stringify({ groupIds }) }),
  onlineOrders: (params: { status?: string; client?: string; orderNo?: string }) => {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) if (value) query.set(key, value)
    return request<{
      rows: {
        id: number
        client: string
        clientOrderId: string
        status: string
        customerName: string
        customerPhone: string
        riderName: string
        otp: string
        totalPaise: number
        note: string
        orderId: number | null
        createdAt: string
      }[]
    }>(`/api/v1/billing/online-orders?${query}`)
  },
  createOnlineOrder: (body: {
    client: string
    clientOrderId: string
    customerName: string
    customerPhone: string
    note: string
    lines: { menuItemId: number; qty: number }[]
  }) => request<{ id: number; totalPaise: number }>("/api/v1/billing/online-orders", { method: "POST", body: JSON.stringify(body) }),
  advanceOnlineOrder: (id: number, body?: { riderName?: string; otp?: string }) =>
    request<{ status: string }>(`/api/v1/billing/online-orders/${id}/advance`, { method: "POST", body: JSON.stringify(body ?? {}) }),
  cancelOnlineOrder: (id: number) => request<{ ok: true }>(`/api/v1/billing/online-orders/${id}/cancel`, { method: "POST" }),
  invoiceOnlineOrder: (id: number) => request<{ orderId: number }>(`/api/v1/billing/online-orders/${id}/invoice`, { method: "POST" }),
  dayEnd: () =>
    request<{
      today: { businessDate: string; orderCount: number; totalPaise: number; cashPaise: number; cardPaise: number; upiPaise: number; otherPaise: number; closed: boolean }
      rows: { id: number; businessDate: string; billerName: string; orderCount: number; totalPaise: number; cashPaise: number; cardPaise: number; upiPaise: number; otherPaise: number; closedAt: string }[]
    }>("/api/v1/billing/day-end"),
  closeDay: () => request<{ id: number }>("/api/v1/billing/day-end", { method: "POST" }),
  removeDayEnd: (id: number, password: string) =>
    request<{ ok: true }>(`/api/v1/billing/day-end/${id}`, { method: "DELETE", body: JSON.stringify({ password }) }),
  deliveries: () =>
    request<{
      rows: { id: number; orderNo: number; businessDate: string; status: string; customerName: string; customerPhone: string; totalPaise: number; provider: string }[]
      chart: { day: string; orders: number; delivered: number }[]
    }>("/api/v1/billing/deliveries"),
  assignDelivery: (id: number, provider: string) =>
    request<{ ok: true }>(`/api/v1/billing/deliveries/${id}`, { method: "PUT", body: JSON.stringify({ provider }) }),
  taxes: () =>
    request<{
      rows: {
        id: number
        title: string
        kind: string
        mode: string
        rateBps: number
        orderTypes: string[]
        active: boolean
        isDefault: boolean
      }[]
    }>("/api/v1/billing/catalog/taxes"),
  addTax: (body: { title: string; kind: "gst" | "vat" | "custom"; mode: "forward" | "backward"; rateBps: number; isDefault: boolean }) =>
    request<{ id: number }>("/api/v1/billing/catalog/taxes", { method: "POST", body: JSON.stringify(body) }),
  updateTax: (id: number, body: { active?: boolean; isDefault?: boolean }) =>
    request<{ id: number }>(`/api/v1/billing/catalog/taxes/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  discounts: () =>
    request<{
      rows: {
        id: number
        title: string
        kind: "percentage" | "fixed"
        rateBps: number | null
        amountPaise: number | null
        appliesTo: string
        active: boolean
      }[]
    }>("/api/v1/billing/catalog/discounts"),
  addDiscount: (body: { title: string; kind: "percentage" | "fixed"; rateBps?: number; amountPaise?: number }) =>
    request<{ id: number }>("/api/v1/billing/catalog/discounts", { method: "POST", body: JSON.stringify(body) }),
  updateDiscount: (id: number, active: boolean) =>
    request<{ id: number }>(`/api/v1/billing/catalog/discounts/${id}`, { method: "PUT", body: JSON.stringify({ active }) }),
  inventory: () =>
    request<{
      materialCount: number
      stockValuePaise: number
      lowStockCount: number
      settings: { autoConsumption: boolean; revertOnCancel: boolean; avgCosting: boolean }
      recent: { id: number; type: string; docNo: number; status: string; totalPaise: number; businessDate: string }[]
    }>("/api/v1/billing/inventory"),
  inventoryMaterials: () =>
    request<{
      units: { id: number; name: string }[]
      categories: { id: number; name: string }[]
      materials: {
        id: number
        name: string
        onHand: number
        minQty: number
        avgCostPaise: number
        hsn: string
        active: boolean
        favorite: boolean
        categoryId: number | null
        categoryName: string
        unitId: number
        unitName: string
      }[]
    }>("/api/v1/billing/inventory/materials"),
  addInventoryCategory: (name: string) =>
    request<{ id: number }>("/api/v1/billing/inventory/categories", { method: "POST", body: JSON.stringify({ name }) }),
  addMaterial: (body: { name: string; unitId: number; categoryId?: number | null; minQty: number; hsn?: string }) =>
    request<{ id: number }>("/api/v1/billing/inventory/materials", { method: "POST", body: JSON.stringify(body) }),
  updateMaterial: (id: number, body: { active?: boolean; favorite?: boolean }) =>
    request<{ ok: true }>(`/api/v1/billing/inventory/materials/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  suppliers: () =>
    request<{ rows: { id: number; name: string; company: string; phone: string; active: boolean }[] }>(
      "/api/v1/billing/inventory/suppliers",
    ),
  addSupplier: (body: { name: string; company?: string; phone?: string }) =>
    request<{ id: number }>("/api/v1/billing/inventory/suppliers", { method: "POST", body: JSON.stringify(body) }),
  recipes: () =>
    request<{
      items: { id: number; name: string; category: string; lines: { materialId: number; name: string; qty: number }[] }[]
    }>("/api/v1/billing/inventory/recipes"),
  saveRecipe: (menuItemId: number, lines: { materialId: number; qty: number }[]) =>
    request<{ ok: true }>(`/api/v1/billing/inventory/recipes/${menuItemId}`, {
      method: "PUT",
      body: JSON.stringify({ lines }),
    }),
  inventoryDocs: (type: string) =>
    request<{
      rows: { id: number; docNo: number; status: string; totalPaise: number; note: string; businessDate: string; supplierName: string }[]
    }>(`/api/v1/billing/inventory/documents?type=${type}`),
  addInventoryDoc: (body: {
    type: "purchase" | "purchase_order" | "wastage" | "closing"
    supplierId?: number | null
    note?: string
    lines: { materialId: number; qty: number; unitCostPaise: number }[]
  }) => request<{ id: number; docNo: number }>("/api/v1/billing/inventory/documents", { method: "POST", body: JSON.stringify(body) }),
  saveInventorySettings: (body: { autoConsumption: boolean; revertOnCancel: boolean; avgCosting: boolean }) =>
    request<{ ok: true }>("/api/v1/billing/inventory/settings", { method: "PUT", body: JSON.stringify(body) }),
  staff: () =>
    request<{
      rows: {
        id: number
        name: string
        userType: string
        userName: string
        userCode: string
        phone: string
        passcode: string
        swipeCode: string
        active: boolean
      }[]
    }>("/api/v1/billing/management/staff"),
  addStaff: (body: {
    name: string
    userType: string
    userName: string
    userCode: string
    password: string
    phone?: string
    passcode: string
    swipeCode?: string
  }) => request<{ id: number }>("/api/v1/billing/management/staff", { method: "POST", body: JSON.stringify(body) }),
  updateStaff: (id: number, body: Record<string, unknown>) =>
    request<{ ok: true }>(`/api/v1/billing/management/staff/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  devices: () =>
    request<{
      rows: { id: number; name: string; kind: string; mappingCode: string; lastSeenAt: string | null; active: boolean }[]
    }>("/api/v1/billing/management/devices"),
  syncCode: (body: { password: string; name: string; kind: string }) =>
    request<{ id: number; mappingCode: string }>("/api/v1/billing/management/devices/sync-code", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  pairDevice: (body: { code: string; name?: string; kind?: string }) =>
    request<{ id: number; mappingCode: string }>("/api/v1/billing/management/devices/pair", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  setDeviceActive: (id: number, active: boolean) =>
    request<{ ok: true }>(`/api/v1/billing/management/devices/${id}`, { method: "PUT", body: JSON.stringify({ active }) }),
  audit: (params: { category?: string; from?: string; to?: string; q?: string }) => {
    const q = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) if (value) q.set(key, value)
    const qs = q.toString()
    return request<{
      categories: { category: string; count: number }[]
      rows: { id: number; actorName: string; source: string; category: string; action: string; summary: string; createdAt: string }[]
    }>(`/api/v1/billing/management/audit${qs ? `?${qs}` : ""}`)
  },
  gst: () =>
    request<{
      hasGst: boolean
      gstin: string
      legalName: string
      address: string
      state: string
      city: string
      pan: string
      cin: string
      zip: string
    }>("/api/v1/billing/management/gst"),
  saveGst: (body: {
    hasGst: boolean
    gstin: string
    legalName: string
    address: string
    state: string
    city: string
    pan: string
    cin: string
    zip: string
  }) => request<{ ok: true }>("/api/v1/billing/management/gst", { method: "PUT", body: JSON.stringify(body) }),
  banks: () =>
    request<{
      rows: { id: number; accountName: string; bankName: string; accountNo: string; ifsc: string; primary: boolean }[]
    }>("/api/v1/billing/management/banks"),
  addBank: (body: { accountName: string; bankName: string; accountNo: string; ifsc: string; primary?: boolean }) =>
    request<{ id: number }>("/api/v1/billing/management/banks", { method: "POST", body: JSON.stringify(body) }),
  deleteBank: (id: number) => request<{ ok: true }>(`/api/v1/billing/management/banks/${id}`, { method: "DELETE" }),
  cash: (kind: string) =>
    request<{
      heads: { id: number; title: string; active: boolean }[]
      entries: { id: number; title: string; amountPaise: number; note: string; businessDate: string; removed: boolean }[]
    }>(`/api/v1/billing/management/cash?kind=${kind}`),
  addCashHead: (kind: string, title: string) =>
    request<{ id: number }>("/api/v1/billing/management/cash/heads", { method: "POST", body: JSON.stringify({ kind, title }) }),
  addCashEntry: (body: { headId: number; amountPaise: number; note?: string; businessDate: string }) =>
    request<{ id: number }>("/api/v1/billing/management/cash/entries", { method: "POST", body: JSON.stringify(body) }),
  removeCashEntry: (id: number) =>
    request<{ ok: true }>(`/api/v1/billing/management/cash/entries/${id}`, { method: "DELETE" }),
  denominations: () =>
    request<{ rows: { id: number; label: string; valuePaise: number; available: boolean }[] }>(
      "/api/v1/billing/management/denominations",
    ),
  setDenomination: (id: number, available: boolean) =>
    request<{ ok: true }>(`/api/v1/billing/management/denominations/${id}`, {
      method: "PUT",
      body: JSON.stringify({ available }),
    }),
  payments: (params: { from?: string; to?: string; status?: string; provider?: string; orderNo?: string }) => {
    const q = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) if (value) q.set(key, value)
    const qs = q.toString()
    return request<{
      daily: { date: string; amountPaise: number }[]
      rows: {
        orderId: number
        orderNo: number
        businessDate: string
        provider: string
        amountPaise: number
        status: string
        settledAt: string | null
      }[]
    }>(`/api/v1/billing/management/payments${qs ? `?${qs}` : ""}`)
  },
  setPaymentStatus: (orderId: number, status: string) =>
    request<{ ok: true }>(`/api/v1/billing/management/payments/${orderId}`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),
  wallet: (phone?: string) =>
    request<{
      cards: {
        id: number
        phone: string
        cardNo: string
        holderName: string
        balancePaise: number
        status: string
        excludeReset: boolean
      }[]
      txns: { id: number; phone: string; kind: string; amountPaise: number; note: string; createdAt: string }[]
    }>(`/api/v1/billing/management/wallet${phone ? `?phone=${encodeURIComponent(phone)}` : ""}`),
  issueWallet: (body: { phone: string; cardNo: string; holderName?: string }) =>
    request<{ id: number }>("/api/v1/billing/management/wallet", { method: "POST", body: JSON.stringify(body) }),
  moveWallet: (id: number, body: { kind: "topup" | "redeem" | "refund"; amountPaise: number; note?: string }) =>
    request<{ ok: true }>(`/api/v1/billing/management/wallet/${id}/move`, { method: "POST", body: JSON.stringify(body) }),
  updateWallet: (id: number, body: { status?: string; reason?: string; excludeReset?: boolean }) =>
    request<{ ok: true }>(`/api/v1/billing/management/wallet/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  resetWallets: (password: string) =>
    request<{ ok: true }>("/api/v1/billing/management/wallet/reset", { method: "POST", body: JSON.stringify({ password }) }),
  recon: () =>
    request<{
      aggregatorConnected: boolean
      orders: { orderId: number; orderNo: number; businessDate: string; amountPaise: number; paymentType: string; customerName: string }[]
      disputes: { id: number; orderRef: string; channel: string; fromEmail: string; note: string; status: string; createdAt: string }[]
    }>("/api/v1/billing/management/recon"),
  addDispute: (body: { orderRef: string; channel: string; fromEmail: string; note?: string }) =>
    request<{ id: number }>("/api/v1/billing/management/recon/disputes", { method: "POST", body: JSON.stringify(body) }),
  serviceInvoices: (tab: string) =>
    request<{
      rows: {
        id: number
        tab: string
        title: string
        amountPaise: number
        paymentType: string
        proformaNo: string
        status: string
        cancelReason: string
        issuedOn: string
      }[]
    }>(`/api/v1/billing/management/invoices?tab=${tab}`),
  addServiceInvoice: (body: {
    tab: string
    title: string
    amountPaise: number
    paymentType: string
    proformaNo?: string
    issuedOn: string
  }) => request<{ id: number }>("/api/v1/billing/management/invoices", { method: "POST", body: JSON.stringify(body) }),
  cancelServiceInvoice: (id: number, reason: string) =>
    request<{ ok: true }>(`/api/v1/billing/management/invoices/${id}/cancel`, {
      method: "PUT",
      body: JSON.stringify({ reason }),
    }),
  loans: () =>
    request<{
      loans: { id: number; title: string; principalPaise: number; outstandingPaise: number; startedOn: string; status: string }[]
      invoices: { id: number; loanId: number; amountPaise: number; note: string; issuedOn: string }[]
    }>("/api/v1/billing/management/loans"),
  addLoan: (body: { title: string; principalPaise: number; startedOn: string }) =>
    request<{ id: number }>("/api/v1/billing/management/loans", { method: "POST", body: JSON.stringify(body) }),
  repayLoan: (id: number, amountPaise: number, note?: string) =>
    request<{ ok: true; outstandingPaise: number }>(`/api/v1/billing/management/loans/${id}/repay`, {
      method: "POST",
      body: JSON.stringify({ amountPaise, note }),
    }),
  supportNotes: () =>
    request<{
      categories: string[]
      rows: { id: number; supportNo: string; category: string; note: string; status: string; createdAt: string }[]
    }>("/api/v1/billing/management/support"),
  addSupportNote: (category: string, note: string) =>
    request<{ id: number; supportNo: string }>("/api/v1/billing/management/support", {
      method: "POST",
      body: JSON.stringify({ category, note }),
    }),
  notifications: () =>
    request<{
      unread: number
      rows: { id: number; title: string; body: string; read: boolean; createdAt: string }[]
    }>("/api/v1/billing/management/notifications"),
  addNotification: (title: string, body: string) =>
    request<{ id: number }>("/api/v1/billing/management/notifications", {
      method: "POST",
      body: JSON.stringify({ title, body }),
    }),
  readNotification: (id: number) =>
    request<{ ok: true }>(`/api/v1/billing/management/notifications/${id}/read`, { method: "PUT" }),
  services: () =>
    request<{
      rows: { id: number; code: string; name: string; blurb: string; category: string; enabled: boolean; storeId: string }[]
    }>("/api/v1/billing/management/services"),
  saveService: (id: number, body: { enabled: boolean; storeId?: string }) =>
    request<{ ok: true }>(`/api/v1/billing/management/services/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  posOrders: (params: PosOrderListParams) => {
    const q = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value && value !== "all") q.set(key, value)
    }
    const qs = q.toString()
    return request<{ orders: PosOrder[]; businessDate: string }>(
      `/api/v1/billing/pos/orders${qs ? `?${qs}` : ""}`,
    )
  },
}

export type OutletConfig = {
  outletName: string
  timezone: string
  settings: {
    outlet: Record<string, string>
    contact: Record<string, string>
    timings: {
      closingHour: string
      is24x7: boolean
      deliveryFrom: string
      deliveryTo: string
      slots: { name: string; from: string; to: string; days: string }[]
    }
    payment: { currency: string; customTypes: string[]; cardOptions: string[]; upiProviders: string[] }
    invoices: { name: string; prefix: string; nextNo: number; active: boolean }[]
    display: PosBootstrap["settings"] & {
      uiMode: string
      dineInLabel: string
      pickupLabel: string
      deliveryLabel: string
      showDineIn: boolean
      showPickup: boolean
      showDelivery: boolean
      itemSort: string
    }
    printLogo: { caption: string }
    calculations: Record<string, string | number | boolean>
    connected: Record<string, boolean>
    print: Record<string, string | boolean>
    customer: Record<string, string | number | boolean>
    online: Record<string, string | number | boolean>
    system: Record<string, string | number>
    notification: { dailySalesSms: boolean }
  }
}

export type TableShape = "circle" | "square" | "diamond" | "arch" | "rect" | "oval"
export type PosOrderType = "dine_in" | "pickup" | "delivery"
export type PosStatus = "saved" | "printed" | "settled" | "cancelled" | "complimentary" | "sales_return"
export type PosPaymentType = "not_paid" | "cash" | "card" | "upi" | "due" | "other" | "wallet" | "online" | "part"
export type PosAction = "save" | "kot" | "kot_print" | "save_print" | "settle"

export type PosBootstrap = {
  outlet: { id: number; name: string; taxRateBps: number; timezone: string; billerName: string }
  settings: {
    orderTypeLabels: Record<PosOrderType, string>
    showOrderTypes: Record<PosOrderType, boolean>
    paymentButtons: PosPaymentType[]
    defaultOrderType: PosOrderType
    defaultQty: number
    mergeDuplicateItems: boolean
    saveKotOnSaveBill: boolean
    defaultScreen: "tables" | "billing"
    showItemPrice: boolean
    personsMandatory: boolean
    orderInfoLabel: string
    discountLabel: string
  }
  categories: { id: number; name: string }[]
  items: {
    id: number
    categoryId: number
    name: string
    shortCode: string | null
    pricePaise: number
    dietary: "veg" | "non_veg" | "egg"
    variants?: { id: number; name: string; pricePaise: number }[]
    addonGroups?: {
      id: number
      name: string
      minSelect: number
      maxSelect: number
      items: { id: number; name: string; pricePaise: number }[]
    }[]
  }[]
  tables: {
    id: number
    area: string
    tableNo: string
    seats: number
    occupied: boolean
    orderId: number | null
    orderNo: number | null
    status: string | null
    totalPaise: number | null
    x: number
    y: number
    width: number
    height: number
    shape: string
    textSize: number
    placed: boolean
    covers: {
      letter: string
      label: string
      orderId: number
      orderNo: number
      status: string
      totalPaise: number
      customerName: string | null
    }[]
  }[]
  barriers: { id: number; x: number; y: number; width: number; height: number }[]
  discounts: {
    id: number
    title: string
    kind: "percentage" | "fixed"
    rateBps: number | null
    amountPaise: number | null
  }[]
}

export type PosOrder = {
  id: number
  orderNo: number
  status: PosStatus
  orderType: PosOrderType
  tableLabel: string | null
  customerName: string | null
  customerPhone: string | null
  pax: number
  note: string | null
  paymentType: PosPaymentType
  paidPaise: number
  changePaise: number
  itemCount: number
  subtotalPaise: number
  discountPaise: number
  taxPaise: number
  totalPaise: number
  kotNo: number | null
  version: number
  billerName: string | null
  cancelReason: string | null
  createdAt: string
  updatedAt: string
  printedAt: string | null
  settledAt: string | null
}

export type PosOrderLine = {
  menuItemId: number
  name: string
  unitPricePaise: number
  qty: number
  lineTotalPaise: number
  note: string | null
}

export type PosOrderDetail = PosOrder & { lines: PosOrderLine[] }

export type PosKot = {
  id: number
  kotNo: number
  status: "active" | "used_in_bill" | "cancelled" | "shifted"
  modified: boolean
  punchedAt: string
  businessDate: string
  orderId: number
  orderNo: number
  orderType: PosOrderType
  tableLabel: string | null
  customerName: string | null
  customerPhone: string | null
  items: { name: string; qty: number; note: string | null }[]
}

export type PosLiveResponse = {
  kpis: { runningOrderCount: number; runningAmountPaise: number; pendingOrders: number }
  orders: PosOrder[]
}

export type PosOrderListParams = {
  status?: string
  orderType?: string
  paymentType?: string
  invoiceId?: string
  customer?: string
  limit?: string
}

type PosDraft = {
  orderType: PosOrderType
  tableLabel?: string
  customerName?: string
  customerPhone?: string
  pax?: number
  note?: string
  discountPaise?: number
  lines: { menuItemId: number; qty: number; note?: string }[]
}

export type PosCreateBody = PosDraft & {
  action: PosAction
  paymentType?: PosPaymentType
  paidPaise?: number
  idempotencyKey: string
}

export type PosUpdateBody = PosDraft & {
  version: number
  action?: PosAction
  paymentType?: PosPaymentType
  paidPaise?: number
}

export const ORDER_TYPE_LABEL: Record<PosOrderType, string> = {
  dine_in: "Dine In",
  pickup: "Pick Up",
  delivery: "Delivery",
}

export const STATUS_LABEL: Record<PosStatus, string> = {
  saved: "Saved",
  printed: "Printed",
  settled: "Settled",
  cancelled: "Cancelled",
  complimentary: "Complimentary",
  sales_return: "Sales Return",
}

export const PAYMENT_LABEL: Record<PosPaymentType, string> = {
  not_paid: "Not Paid",
  cash: "Cash",
  card: "Card",
  upi: "UPI",
  due: "Due",
  other: "Other",
  wallet: "Wallet",
  online: "Online",
  part: "Part",
}

/** "1A" is guest A on table 1. A label with no letter stays as the table name. */
export function formatTableSeat(label: string): string {
  const letter = label.slice(-1)
  const tableNo = label.slice(0, -1)
  if (tableNo && /^[A-Z]$/.test(letter)) return `Table ${tableNo} · ${letter}`
  return `Table ${label}`
}

export function formatInr(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100)
}
