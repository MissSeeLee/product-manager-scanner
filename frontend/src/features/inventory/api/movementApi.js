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

function postCanonicalOperation(type, id, payload) {
  return request("/api/operations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type,
      assetIds: [Number(id)],
      destinationLocation: payload?.toLocation,
      performedBy: payload?.performedBy,
      note: payload?.note,
      ...(type === "ISSUE"
        ? {
            projectId: payload?.projectId ?? null,
            responsiblePerson: payload?.responsiblePerson,
            expectedReturnDate: payload?.expectedReturnDate ?? null,
          }
        : {}),
      ...(type === "RETURN" && payload?.sourceOperationId
        ? { sourceOperationId: Number(payload.sourceOperationId) }
        : {}),
    }),
  });
}

export function issueInventory(id, payload) {
  return postCanonicalOperation("ISSUE", id, payload);
}

export function returnInventory(id, payload) {
  return postCanonicalOperation("RETURN", id, payload);
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
