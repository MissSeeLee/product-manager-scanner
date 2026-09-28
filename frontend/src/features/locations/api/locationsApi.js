async function locationRequest(url, options = {}) {
  let response;

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch {
    const error = new Error("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
    error.code = "NETWORK_ERROR";
    error.status = 0;
    throw error;
  }

  const contentType = response.headers.get("content-type") || "";
  let result;

  if (contentType.includes("application/json")) {
    result = await response.json();
  } else {
    const text = await response.text();
    result = text ? { message: text } : null;
  }

  if (!response.ok) {
    const error = new Error(
      result?.message || "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
    );

    error.code = result?.code || "REQUEST_FAILED";
    error.status = response.status;
    error.data = result?.data || null;
    throw error;
  }

  return result;
}

export async function getLocations({ includeInactive = false } = {}) {
  const query = includeInactive ? "?includeInactive=1" : "";
  const result = await locationRequest(`/api/locations${query}`);

  return Array.isArray(result?.data) ? result.data : [];
}

export function createLocation(payload) {
  return locationRequest("/api/locations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateLocation(id, payload) {
  return locationRequest(`/api/locations/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function setLocationActive(id, isActive) {
  return locationRequest(`/api/locations/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ isActive }),
  });
}

export function deleteLocation(id) {
  return locationRequest(`/api/locations/${id}`, {
    method: "DELETE",
  });
}