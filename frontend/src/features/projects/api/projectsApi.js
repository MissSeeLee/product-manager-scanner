import { request } from "../../../shared/lib/http";

export async function getProjects({ status = "" } = {}) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const result = await request(`/api/projects${query}`);
  return result?.data ?? [];
}

export async function getProject(id) {
  const result = await request(`/api/projects/${id}`);
  return result?.data ?? null;
}

export function createProject(payload) {
  return request("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function updateProject(id, payload) {
  return request(`/api/projects/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
