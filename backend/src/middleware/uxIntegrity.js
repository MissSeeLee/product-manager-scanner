import pool from "../db.js";

function cleanText(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text || null;
}

function actorName(user) {
  return cleanText(user?.displayName) || cleanText(user?.username) || "Unknown User";
}

async function getLocationLookup(values) {
  const cleaned = [...new Set(
    values
      .map(cleanText)
      .filter(Boolean)
      .map((value) => value.toLowerCase()),
  )];

  if (cleaned.length === 0) return new Map();

  const result = await pool.query(
    `
      SELECT location_name, location_code
      FROM locations
      WHERE is_active = true
        AND (
          LOWER(location_name) = ANY($1::text[])
          OR LOWER(COALESCE(location_code, '')) = ANY($1::text[])
        )
    `,
    [cleaned],
  );

  const lookup = new Map();
  for (const row of result.rows) {
    lookup.set(String(row.location_name).toLowerCase(), row.location_name);
    if (row.location_code) {
      lookup.set(String(row.location_code).toLowerCase(), row.location_name);
    }
  }
  return lookup;
}

async function canonicalLocation(value) {
  const clean = cleanText(value);
  if (!clean) return null;
  const lookup = await getLocationLookup([clean]);
  return lookup.get(clean.toLowerCase());
}

function rejectLocation(res, locations) {
  return res.status(400).json({
    code: "LOCATION_NOT_FOUND_OR_INACTIVE",
    message:
      "สถานที่ไม่อยู่ใน Location Master หรือถูกปิดใช้งาน กรุณาเลือกสถานที่จากรายการ",
    data: { locations },
  });
}

async function canonicalizeRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const lookup = await getLocationLookup(list.map((row) => row?.currentLocation));
  const invalid = [];

  for (const row of list) {
    const raw = cleanText(row?.currentLocation);
    if (!raw) continue;
    const canonical = lookup.get(raw.toLowerCase());
    if (!canonical) {
      invalid.push(raw);
    } else {
      row.currentLocation = canonical;
    }
  }
  return [...new Set(invalid)];
}

async function getInactiveProductIds(values) {
  const ids = [...new Set(
    values
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0),
  )];

  if (ids.length === 0) return [];

  const result = await pool.query(
    `
      SELECT id
      FROM products
      WHERE id = ANY($1::bigint[])
        AND is_active = false
    `,
    [ids],
  );

  return result.rows.map((row) => Number(row.id));
}

function rejectInactiveProducts(res, productIds) {
  return res.status(409).json({
    code: "PRODUCT_INACTIVE",
    message:
      "มีรุ่นสินค้าที่ถูก Archive อยู่ในรายการ กรุณาเปิดใช้งานรุ่นเดิมหรือเลือกรุ่นอื่น",
    data: { productIds },
  });
}

export async function uxIntegrityGuard(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

  try {
    const path = req.path || "";
    const method = req.method.toUpperCase();

    // Lifecycle actor is always the authenticated account, never arbitrary text.
    if (
      (path === "/operations" && method === "POST") ||
      (/^\/inventory-items\/\d+\/(move|claim|claim-return|replaced|retire)$/.test(path) &&
        method === "POST")
    ) {
      req.body = req.body || {};
      req.body.performedBy = actorName(req.user);
    }

    // Canonical operation destination.
    if (path === "/operations" && method === "POST") {
      const raw = cleanText(req.body?.destinationLocation);
      if (raw) {
        const canonical = await canonicalLocation(raw);
        if (!canonical) return rejectLocation(res, [raw]);
        req.body.destinationLocation = canonical;
      }
    }

    // Canonical lifecycle destination.
    if (
      /^\/inventory-items\/\d+\/(move|claim|claim-return|replaced)$/.test(path) &&
      method === "POST"
    ) {
      const raw = cleanText(req.body?.toLocation);
      if (raw) {
        const canonical = await canonicalLocation(raw);
        if (!canonical) return rejectLocation(res, [raw]);
        req.body.toLocation = canonical;
      }
    }

    // Legacy single intake remains valid, but Location and Product must
    // resolve to active master data.
    if (path === "/inventory-items" && method === "POST") {
      const raw = cleanText(req.body?.currentLocation);
      if (raw) {
        const canonical = await canonicalLocation(raw);
        if (!canonical) return rejectLocation(res, [raw]);
        req.body.currentLocation = canonical;
      }

      const inactive = await getInactiveProductIds([req.body?.productId]);
      if (inactive.length > 0) return rejectInactiveProducts(res, inactive);
    }

    // New atomic intake.
    if (path === "/inventory-items/intake-v2" && method === "POST") {
      const raw = cleanText(req.body?.inventory?.currentLocation);
      if (raw) {
        const canonical = await canonicalLocation(raw);
        if (!canonical) return rejectLocation(res, [raw]);
        req.body.inventory.currentLocation = canonical;
      }
    }

    // CSV / quick batch: no free-text location drift and no archived Product.
    if (
      ["/inventory-items/bulk", "/inventory-items/bulk/validate"].includes(path) &&
      method === "POST"
    ) {
      const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
      const invalid = await canonicalizeRows(rows);
      if (invalid.length > 0) return rejectLocation(res, invalid);

      const inactive = await getInactiveProductIds(
        rows.map((row) => row?.productId),
      );
      if (inactive.length > 0) return rejectInactiveProducts(res, inactive);
    }

    // Correct RECEIVE origin.
    if (
      /^\/inventory-items\/\d+\/intake-correction$/.test(path) &&
      method === "PUT"
    ) {
      const raw = cleanText(req.body?.currentLocation);
      if (raw) {
        const canonical = await canonicalLocation(raw);
        if (!canonical) return rejectLocation(res, [raw]);
        req.body.currentLocation = canonical;
      }
    }

    // Project default location in both legacy and V2 management calls.
    if (
      (
        /^\/projects(?:\/\d+)?$/.test(path) ||
        /^\/ux\/projects\/\d+$/.test(path)
      ) &&
      ["POST", "PUT"].includes(method)
    ) {
      const raw = cleanText(req.body?.defaultLocation);
      if (raw) {
        const canonical = await canonicalLocation(raw);
        if (!canonical) return rejectLocation(res, [raw]);
        req.body.defaultLocation = canonical;
      }
    }

    return next();
  } catch (error) {
    console.error("UX integrity guard failed:", error);
    return res.status(500).json({
      code: "UX_INTEGRITY_GUARD_FAILED",
      message: "ไม่สามารถตรวจสอบความถูกต้องของข้อมูลก่อนบันทึกได้",
    });
  }
}
