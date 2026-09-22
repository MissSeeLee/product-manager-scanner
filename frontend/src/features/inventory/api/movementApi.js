import { request } from "../../../shared/lib/http";

function postMovement(id, action, payload) {
  return request(`/api/inventory-items/${id}/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function issueInventory(id, payload) {
  return postMovement(id, "issue", payload);
}

export function returnInventory(id, payload) {
  return postMovement(id, "return", payload);
}

export function moveInventory(id, payload) {
  return postMovement(id, "move", payload);
}

export function claimInventory(id, payload) {
  return postMovement(id, "claim", payload);
}

export function claimReturnInventory(id, payload) {
  return postMovement(id, "claim-return", payload);
}

export function replaceInventory(id, payload) {
  return postMovement(id, "replaced", payload);
}

export function retireInventory(id, payload) {
  return postMovement(id, "retire", payload);
}

export async function getMovementHistory(id) {
  const result = await request(`/api/inventory-items/${id}/movements`);
  return result?.data ?? [];
}
