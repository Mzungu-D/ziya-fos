import {
  getRoleTemplatePermissions,
  isRoleTemplate,
} from "../config/roleTemplates";

export type AuthorizationRole =
  | "OWNER"
  | "FINANCE_MANAGER"
  | "ACCOUNTANT"
  | "JUNIOR_ACCOUNTANT"
  | "FINANCE_OFFICER"
  | "SENIOR_ACCOUNTANT"
  | "ACCOUNTS_PAYABLE"
  | "ACCOUNTS_RECEIVABLE"
  | "PROCUREMENT_OFFICER"
  | "HR_MANAGER"
  | "ASSET_MANAGER"
  | "AUDITOR"
  | "VIEWER"
  | "CUSTOM";

export interface AuthorizationMembership {
  role: string | null | undefined;
  permissions?: string[] | null;
  isActive?: boolean;
}

const OWNER_PERMISSION = "*";

/**
 * Normalize permission strings.
 *
 * Security rule:
 * - Ignore null/undefined/non-string values.
 * - Trim whitespace.
 * - Remove empty permissions.
 * - Remove duplicates.
 */
export function normalizePermissions(
  permissions: unknown,
): string[] {
  if (!Array.isArray(permissions)) {
    return [];
  }

  return Array.from(
    new Set(
      permissions
        .filter(
          (permission): permission is string =>
            typeof permission === "string",
        )
        .map((permission) => permission.trim())
        .filter(Boolean),
    ),
  );
}

/**
 * Normalize a role.
 *
 * Roles are stored as strings in the database, so authorization must
 * never trust arbitrary casing or whitespace.
 */
export function normalizeRole(
  role: unknown,
): string {
  if (typeof role !== "string") {
    return "";
  }

  return role.trim().toUpperCase();
}

/**
 * Resolve the effective permissions for the CURRENT tenant membership.
 *
 * Security model:
 *
 * OWNER
 *   -> full access within the current tenant.
 *
 * STANDARD ROLE
 *   -> permissions come ONLY from roleTemplates.ts.
 *
 * CUSTOM
 *   -> permissions come ONLY from the membership's explicit permissions.
 *
 * UNKNOWN ROLE
 *   -> NO permissions.
 *
 * Important:
 * Stored permissions must NOT override a standard role template.
 * Otherwise an Auditor could potentially be invited with an Auditor role
 * while receiving arbitrary write permissions.
 */
export function resolveEffectivePermissions(
  membership: AuthorizationMembership,
): string[] {
  const role = normalizeRole(membership.role);

  if (!role) {
    return [];
  }

  if (role === "OWNER") {
    return [OWNER_PERMISSION];
  }

  if (isRoleTemplate(role)) {
    return normalizePermissions(
      getRoleTemplatePermissions(role),
    );
  }

  if (role === "CUSTOM") {
    return normalizePermissions(
      membership.permissions,
    );
  }

  /**
   * Fail closed.
   *
   * NEVER return membership.permissions here.
   *
   * An unknown or unsupported role must not inherit permissions
   * simply because permissions happened to be stored on the membership.
   */
  return [];
}

/**
 * Check whether a permission is present.
 *
 * "*" is only meaningful when it has already been granted by the
 * authorization resolver, currently OWNER.
 */
export function hasPermission(
  permissions: unknown,
  requiredPermission: string,
): boolean {
  const normalizedPermissions =
    normalizePermissions(permissions);

  const normalizedRequiredPermission =
    typeof requiredPermission === "string"
      ? requiredPermission.trim()
      : "";

  if (!normalizedRequiredPermission) {
    return false;
  }

  if (normalizedPermissions.includes(OWNER_PERMISSION)) {
    return true;
  }

  return normalizedPermissions.includes(
    normalizedRequiredPermission,
  );
}

/**
 * Check multiple permissions using ANY semantics.
 *
 * Useful for endpoints where possession of one of several permissions
 * is sufficient.
 */
export function hasAnyPermission(
  permissions: unknown,
  requiredPermissions: string[],
): boolean {
  if (!Array.isArray(requiredPermissions)) {
    return false;
  }

  return requiredPermissions.some((permission) =>
    hasPermission(permissions, permission),
  );
}

/**
 * Check multiple permissions using ALL semantics.
 *
 * Useful for operations that require multiple capabilities.
 */
export function hasAllPermissions(
  permissions: unknown,
  requiredPermissions: string[],
): boolean {
  if (!Array.isArray(requiredPermissions)) {
    return false;
  }

  return requiredPermissions.every((permission) =>
    hasPermission(permissions, permission),
  );
}

/**
 * Resolve and immediately test a membership permission.
 *
 * This is useful when a controller has already loaded the current
 * OrganizationMember from the database.
 */
export function membershipHasPermission(
  membership: AuthorizationMembership,
  requiredPermission: string,
): boolean {
  const effectivePermissions =
    resolveEffectivePermissions(membership);

  return hasPermission(
    effectivePermissions,
    requiredPermission,
  );
}

/**
 * Return a safe authorization snapshot.
 *
 * This can be used by authentication/session code without exposing
 * internal membership objects.
 */
export function buildAuthorizationSnapshot(
  membership: AuthorizationMembership,
) {
  const role = normalizeRole(membership.role);

  const permissions =
    resolveEffectivePermissions(membership);

  return {
    role,
    permissions,
    isOwner: role === "OWNER",
  };
}