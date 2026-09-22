import { request } from "../../../shared/lib/http";

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    searchParams.set(key, String(value));
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export async function getInventoryItems(params = {}) {
  return request(`/api/inventory-items${buildQuery(params)}`);
}


export async function getInventorySummary() {
  const result = await request("/api/inventory-items/summary");
  return result?.data ?? {
    total: 0,
    IN_STOCK: 0,
    IN_USE: 0,
    CLAIM: 0,
    REPLACED: 0,
    RETIRED: 0,
  };
}

export async function getInventoryFilterOptions() {
  const result = await request("/api/inventory-items/filter-options");
  return result?.data ?? {
    statuses: [],
    locations: [],
    brands: [],
  };
}

export async function getInventoryItemById(id) {
  const result = await request(`/api/inventory-items/${id}`);
  return result?.data ?? null;
}

export async function getInventoryItemBySerial(serial) {
  const encoded = encodeURIComponent(serial);
  const result = await request(`/api/inventory-items/serial/${encoded}`);
  return result?.data ?? null;
}

export function createInventoryItem(payload) {
  return request("/api/inventory-items", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function updateInventoryItem(id, payload) {
  return request(`/api/inventory-items/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function validateBulkInventory(rows) {
  return request("/api/inventory-items/bulk/validate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ rows }),
  });
}

export function importBulkInventory(rows) {
  return request("/api/inventory-items/bulk", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ rows }),
  });
}
