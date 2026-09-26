import {
  getRoleTemplatePermissions,
  isRoleTemplate,
} from "../config/roleTemplates";

/**
 * Single source of truth for effective tenant permissions.
 *
 * OWNER:
 *   Full access inside the current tenant only.
 *
 * Standard roles:
 *   Permissions come from the current server-side role template.
 *
 * CUSTOM:
 *   Permissions stored on the tenant membership are authoritative.
 *
 * Unknown roles:
 *   Fail closed.
 */
export function normalizePermissions(
  permissions: unknown
): string[] {
  if (!Array.isArray(permissions)) {
    return [];
  }

  return [
    ...new Set(
      permissions
        .filter(
          (permission): permission is string =>
            typeof permission === "string"
        )
        .map((permission) => permission.trim())
        .filter((permission) => permission.length > 0)
    ),
  ];
}

export function resolveEffectivePermissions(
  role: unknown,
  storedPermissions: unknown
): string[] {
  const normalizedRole =
    typeof role === "string"
      ? role.trim().toUpperCase()
      : "";

  if (normalizedRole === "OWNER") {
    return ["*"];
  }

  if (isRoleTemplate(normalizedRole)) {
    return getRoleTemplatePermissions(normalizedRole);
  }

  if (normalizedRole === "CUSTOM") {
    const permissions =
      normalizePermissions(storedPermissions);

    // Never allow CUSTOM to become a wildcard.
    return permissions.filter(
      (permission) => permission !== "*"
    );
  }

  // Unknown roles fail closed.
  return [];
}

export function hasPermission(
  permissions: string[],
  requiredPermission: string
): boolean {
  return (
    permissions.includes("*") ||
    permissions.includes(requiredPermission)
  );
}
