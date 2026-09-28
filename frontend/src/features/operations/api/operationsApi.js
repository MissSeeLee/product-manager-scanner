import { request } from "../../../shared/lib/http";

function queryString(params = {}) {
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

export async function getOperations(params = {}) {
  const result = await request(`/api/operations${queryString(params)}`);
  return result?.data ?? [];
}

export async function getOperationsSummary() {
  const result = await request("/api/operations/summary");
  return result?.data ?? {
    overdue: 0,
    dueToday: 0,
    claim: 0,
    recent: [],
  };
}

export async function getOperation(id) {
  const result = await request(`/api/operations/${id}`);
  return result?.data ?? null;
}

export async function validateOperation(type, assetIds) {
  const result = await request("/api/operations/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, assetIds }),
  });

  return result?.data ?? { rows: [], summary: { total: 0, eligible: 0, ineligible: 0 } };
}

export function createOperation(payload) {
  return request("/api/operations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
