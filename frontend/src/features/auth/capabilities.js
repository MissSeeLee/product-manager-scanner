import { useAuth } from "./authContext";

const ROLE_CAPABILITIES = {
  ADMIN: new Set([
    "asset.intake",
    "asset.edit",
    "asset.correctIntake",
    "asset.void",
    "operations.execute",
    "scanner.use",
    "product.manage",
    "location.manage",
    "project.manage",
    "users.manage",
  ]),
  OPERATOR: new Set([
    "asset.intake",
    "asset.edit",
    "asset.correctIntake",
    "operations.execute",
    "scanner.use",
  ]),
  VIEWER: new Set(),
};

export function canRole(role, capability) {
  return ROLE_CAPABILITIES[role]?.has(capability) ?? false;
}

export function useCan(capability) {
  const { user } = useAuth();
  return canRole(user?.role, capability);
}
