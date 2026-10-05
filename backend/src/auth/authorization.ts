import { AppError } from "../domain/errors.js";
import type { AuthenticatedUser, UserLineRole } from "../domain/types.js";

const ROLE_LEVEL: Record<UserLineRole, number> = {
  VIEWER: 1,
  OPERATOR: 2,
  ADMIN: 3,
};

export function isGlobalAdmin(user: AuthenticatedUser): boolean {
  return user.lineAccess.some((access) => access.role === "ADMIN");
}

export function requireGlobalAdmin(user: AuthenticatedUser): void {
  if (!isGlobalAdmin(user)) {
    throw new AppError(403, "INSUFFICIENT_ROLE", "No tienes permisos para administrar líneas");
  }
}

export function requireLineRole(user: AuthenticatedUser, lineId: string, minimumRole: UserLineRole): void {
  if (isGlobalAdmin(user)) return;
  const access = user.lineAccess.find((item) => item.lineId === lineId);
  if (!access) throw new AppError(404, "RESOURCE_NOT_FOUND", "Recurso no encontrado");
  if (ROLE_LEVEL[access.role] < ROLE_LEVEL[minimumRole]) {
    throw new AppError(403, "INSUFFICIENT_ROLE", "No tienes permisos suficientes para esta acción");
  }
}

export function filterAccessibleLineIds(user: AuthenticatedUser): Set<string> | null {
  return isGlobalAdmin(user) ? null : new Set(user.lineAccess.map((access) => access.lineId));
}
