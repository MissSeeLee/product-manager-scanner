export class ApiError extends Error {
  constructor(
    message,
    { code = "REQUEST_FAILED", status = 0, data = null } = {},
  ) {
    super(message);

    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

export async function request(url, options = {}) {
  let response;

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้", {
      code: "NETWORK_ERROR",
      status: 0,
    });
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  let result = null;

  if (contentType.includes("application/json")) {
    try {
      result = await response.json();
    } catch {
      throw new ApiError("เซิร์ฟเวอร์ส่งข้อมูลกลับมาไม่ถูกต้อง", {
        code: "INVALID_RESPONSE",
        status: response.status,
      });
    }
  } else {
    const text = await response.text();

    if (text) {
      result = {
        message: text,
      };
    }
  }

  if (!response.ok) {
    throw new ApiError(
      result?.message || "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
      {
        code: result?.code || "REQUEST_FAILED",
        status: response.status,
        data: result,
      },
    );
  }

  return result;
}
