import { request } from "../../../shared/lib/http";

export async function getCurrentUser() {
  const result = await request("/api/auth/me");
  return result.data;
}

export async function login(username, password) {
  const result = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return result.data.user;
}

export async function logout() {
  return request("/api/auth/logout", { method: "POST" });
}

export async function changePassword(currentPassword, newPassword) {
  return request("/api/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
