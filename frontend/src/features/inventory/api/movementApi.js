import { request } from "../../../shared/lib/http"


// --------------------------------------------------
// ISSUE
// IN_STOCK → IN_USE
// --------------------------------------------------

export async function issueInventory(id, data) {
  return request(
    `/api/inventory-items/${id}/issue`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  )
}


// --------------------------------------------------
// MOVE
// IN_STOCK / IN_USE / CLAIM
// status ไม่เปลี่ยน
// --------------------------------------------------

export async function moveInventory(id, data) {
  return request(
    `/api/inventory-items/${id}/move`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  )
}


// --------------------------------------------------
// CLAIM
// IN_STOCK / IN_USE → CLAIM
// --------------------------------------------------

export async function claimInventory(id, data) {
  return request(
    `/api/inventory-items/${id}/claim`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  )
}


// --------------------------------------------------
// CLAIM RETURN
// CLAIM → IN_STOCK
// --------------------------------------------------

export async function claimReturnInventory(id, data) {
  return request(
    `/api/inventory-items/${id}/claim-return`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  )
}


// --------------------------------------------------
// REPLACED
// CLAIM → REPLACED
// สร้าง Serial ใหม่เป็น IN_STOCK
// --------------------------------------------------

export async function replaceInventory(id, data) {
  return request(
    `/api/inventory-items/${id}/replaced`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  )
}


// --------------------------------------------------
// RETIRE
// IN_STOCK / IN_USE / CLAIM → RETIRED
// --------------------------------------------------

export async function retireInventory(id, data) {
  return request(
    `/api/inventory-items/${id}/retire`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  )
}


// --------------------------------------------------
// MOVEMENT HISTORY
// --------------------------------------------------

export async function getMovementHistory(id) {
  const result = await request(
    `/api/inventory-items/${id}/movements`
  )

  return result?.data ?? {
    item: null,
    movements: [],
  }
}