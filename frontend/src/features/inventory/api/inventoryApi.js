import { request } from "../../../shared/lib/http"


// --------------------------------------------------
// INVENTORY LIST
// GET /api/inventory-items
// --------------------------------------------------

export async function getInventoryItems() {
  const result = await request("/api/inventory-items")

  return result?.data ?? []
}


// --------------------------------------------------
// INVENTORY DETAIL
// GET /api/inventory-items/:id
// --------------------------------------------------

export async function getInventoryItemById(id) {
  const result = await request(
    `/api/inventory-items/${id}`
  )

  return result?.data ?? null
}


// --------------------------------------------------
// FIND BY SERIAL NUMBER
// GET /api/inventory-items/serial/:serial
// --------------------------------------------------

export async function getInventoryItemBySerial(serial) {
  const cleanSerial = serial.trim()

  const result = await request(
    `/api/inventory-items/serial/${encodeURIComponent(cleanSerial)}`
  )

  return result?.data ?? null
}


// --------------------------------------------------
// CREATE INVENTORY ITEM
// POST /api/inventory-items
// --------------------------------------------------

export async function createInventoryItem(data) {
  return request("/api/inventory-items", {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(data),
  })
}


// --------------------------------------------------
// UPDATE INVENTORY METADATA
// PUT /api/inventory-items/:id
//
// NOTE:
// status/location ต้องไม่แก้ผ่าน API นี้
// ต้องใช้ Movement API
// --------------------------------------------------

export async function updateInventoryItem(
  id,
  data
) {
  return request(
    `/api/inventory-items/${id}`,
    {
      method: "PUT",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(data),
    }
  )
}