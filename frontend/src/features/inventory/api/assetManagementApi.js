import { request } from "../../../shared/lib/http";

export function createAtomicIntake(payload) {
  return request("/api/inventory-items/intake-v2", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function getAssetIntake(id) {
  const result = await request(`/api/inventory-items/${id}/intake`);
  return result?.data ?? null;
}

export async function getAssetChangeHistory(id) {
  const result = await request(`/api/inventory-items/${id}/change-history`);
  return result?.data ?? [];
}

export function updateAsset(id, payload) {
  return request(`/api/inventory-items/${id}/edit`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function updateAssetMetadata(id, payload) {
  return request(`/api/inventory-items/${id}/metadata`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function correctAssetIntake(id, payload) {
  return request(`/api/inventory-items/${id}/intake-correction`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function voidAssetRegistration(id, reason = "ลบอุปกรณ์") {
  return request(`/api/inventory-items/${id}/void`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}
