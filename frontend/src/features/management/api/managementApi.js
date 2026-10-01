import { request } from "../../../shared/lib/http";

export async function getManagedProducts({ includeInactive = true } = {}) {
  const query = includeInactive ? "?includeInactive=1" : "";
  const result = await request(`/api/ux/products${query}`);
  return result?.data ?? [];
}


export function updateManagedProduct(id, payload) {
  return request(`/api/ux/products/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function setManagedProductActive(id, isActive, reason) {
  return request(`/api/ux/products/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isActive, reason }),
  });
}

export async function getManagedLocations() {
  const result = await request("/api/ux/locations");
  return result?.data ?? [];
}

export async function getManagedProjects() {
  const result = await request("/api/ux/projects");
  return result?.data ?? [];
}

export function setManagedProjectStatus(id, status, reason) {
  return request(`/api/ux/projects/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, reason }),
  });
}


export function deleteManagedProject(id) {
  return request(`/api/projects/${id}`, {
    method: "DELETE",
  });
}


export function deleteManagedProduct(id) {
  return request(`/api/ux/products/${id}`, {
    method: "DELETE",
  });
}
