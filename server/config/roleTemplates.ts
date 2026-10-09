/* =========================================================
   ZIYA FOS — STANDARD ROLE PERMISSION TEMPLATES

   SECURITY MODEL
   ---------------------------------------------------------
   1. These permissions define STANDARD roles only.
   2. Standard-role permissions are server-controlled.
   3. Invitation/member supplied permissions MUST NOT expand
      a standard role.
   4. Only CUSTOM roles may use explicitly stored permissions.
   5. Unknown roles must fail closed.
   6. OWNER is handled separately by the authorization layer
      and is intentionally NOT represented here.
   7. Frontend visibility is NOT security. Every protected API
      operation must independently enforce its permission.
========================================================= */


/* =========================================================
   SHARED ACCOUNTING OPERATIONS PERMISSIONS

   ACCOUNTANT
   JUNIOR_ACCOUNTANT
   FINANCE_OFFICER

   These three roles intentionally have the same operational
   access.

   IMPORTANT:
   This is permission-template sharing only. It does NOT mean
   one role inherits another role's privileges.

   The three roles remain separate role identities.
========================================================= */

const ACCOUNTING_OPERATIONS_PERMISSIONS = [
  /* -------------------------------------------------------
     Chart of Accounts

     Accounting operations can VIEW accounts but cannot
     create, modify, or delete the Chart of Accounts.

     Those administrative capabilities remain with
     FINANCE_MANAGER.
  ------------------------------------------------------- */

  "account.view",

  /* -------------------------------------------------------
     Accounts Payable
  ------------------------------------------------------- */

  "accountsPayable.create",
  "accountsPayable.view",

  /* -------------------------------------------------------
     Accounts Receivable
  ------------------------------------------------------- */

  "accountsReceivable.create",
  "accountsReceivable.view",

  /* -------------------------------------------------------
     Banking
  ------------------------------------------------------- */

  "bankAccount.view",

  "bankPayment.create",
  "bankPayment.view",

  /* -------------------------------------------------------
     Expenses
  ------------------------------------------------------- */

  "expense.create",
  "expense.view",

  /* -------------------------------------------------------
     Invoicing
  ------------------------------------------------------- */

  "invoice.create",
  "invoice.view",

  /* -------------------------------------------------------
     Journal Entries
  ------------------------------------------------------- */

  "journal.create",
  "journal.update",
  "journal.view",

  /* -------------------------------------------------------
     General Ledger
  ------------------------------------------------------- */

  "ledger.view",

  /* -------------------------------------------------------
     M-Pesa
  ------------------------------------------------------- */

  "mpesa.view",

  /* -------------------------------------------------------
     Financial Reports
  ------------------------------------------------------- */

  "reports.view",

  /* -------------------------------------------------------
     Vendors
  ------------------------------------------------------- */

  "vendor.view",
] as const;


/* =========================================================
   ROLE TEMPLATES

   SECURITY PRINCIPLE

   A role is a capability boundary.

   The permissions below are the ONLY permissions granted
   automatically to the corresponding standard role.

   Do not add permissions here merely because a frontend page
   exists.

   Every permission must correspond to a protected backend
   operation.
========================================================= */

export const ROLE_TEMPLATES = {

  /* =======================================================
     FINANCE MANAGER

     Broad financial management access plus tenant-level
     user administration and tenant security management.

     This is the highest STANDARD financial role.

     OWNER remains separate and is handled by the
     authorization layer.
  ======================================================= */

  FINANCE_MANAGER: [
    /* Chart of Accounts */
    "account.create",
    "account.update",
    "account.view",

    /* Accounts Payable */
    "accountsPayable.approve",
    "accountsPayable.create",
    "accountsPayable.payment",
    "accountsPayable.view",

    /* Accounts Receivable */
    "accountsReceivable.approve",
    "accountsReceivable.create",
    "accountsReceivable.payment",
    "accountsReceivable.update",
    "accountsReceivable.view",

    /* Banking */
    "bankAccount.create",
    "bankAccount.view",

    "bankPayment.create",
    "bankPayment.view",

    /* Expenses */
    "expense.create",
    "expense.view",

    /* Invoices */
    "invoice.create",
    "invoice.view",

    /* Journal */
    "journal.approve",
    "journal.create",
    "journal.post",
    "journal.update",
    "journal.view",

    /* General Ledger */
    "ledger.view",

    /* M-Pesa */
    "mpesa.create",
    "mpesa.view",

    /* Reports */
    "reports.view",

    /* Vendors */
    "vendor.create",
    "vendor.status",
    "vendor.update",
    "vendor.view",

    /* -----------------------------------------------------
       Tenant User Administration
    ----------------------------------------------------- */

    "users.view",
    "users.create",
    "users.manageAccess",
    "users.manageStatus",

    /* -----------------------------------------------------
       Tenant Security Administration
    ----------------------------------------------------- */

    "security.sessions.view",
    "security.sessions.revoke",
  ] as const,


  /* =======================================================
     ACCOUNTANT

     Full operational accounting access according to the
     approved accounting-operations baseline.

     IMPORTANT:
     Does NOT receive:
       account.create
       account.update
       journal.post
       journal.approve
       users.manageAccess
       users.manageStatus
       security.sessions.revoke
  ======================================================= */

  ACCOUNTANT: [
    ...ACCOUNTING_OPERATIONS_PERMISSIONS,
  ],


  /* =======================================================
     JUNIOR ACCOUNTANT

     Same operational permission boundary as ACCOUNTANT.

     The distinction between Accountant and Junior Accountant
     is therefore organizational/job-title based rather than
     an arbitrary hidden permission difference.

     If the business later requires Junior Accountant to have
     fewer capabilities, create a dedicated template rather
     than silently modifying authorization elsewhere.
  ======================================================= */

  JUNIOR_ACCOUNTANT: [
    ...ACCOUNTING_OPERATIONS_PERMISSIONS,
  ],


  /* =======================================================
     FINANCE OFFICER

     Same operational permission boundary as ACCOUNTANT and
     JUNIOR_ACCOUNTANT.
  ======================================================= */

  FINANCE_OFFICER: [
    ...ACCOUNTING_OPERATIONS_PERMISSIONS,
  ],


  /* =======================================================
     ACCOUNTS PAYABLE

     Dedicated AP operational access.
  ======================================================= */

  ACCOUNTS_PAYABLE: [
    "accountsPayable.create",
    "accountsPayable.view",

    "expense.create",
    "expense.view",

    "vendor.create",
    "vendor.update",
    "vendor.view",

    "bankAccount.view",

    "bankPayment.create",
    "bankPayment.view",
  ] as const,


  /* =======================================================
     ACCOUNTS RECEIVABLE

     Dedicated AR operational access.
  ======================================================= */

  ACCOUNTS_RECEIVABLE: [
    "accountsReceivable.create",
    "accountsReceivable.update",
    "accountsReceivable.view",

    "invoice.create",
    "invoice.view",

    "bankAccount.view",

    "mpesa.view",

    "reports.view",
  ] as const,


  /* =======================================================
     PROCUREMENT OFFICER

     Procurement-related operational access without
     unrestricted financial administration.
  ======================================================= */

  PROCUREMENT_OFFICER: [
    /* Procurement */
    "procurement.create",
    "procurement.view",
    "procurement.update",
    "procurement.status",

    /* Accounts Payable */
    "accountsPayable.create",
    "accountsPayable.view",

    /* Expenses */
    "expense.create",
    "expense.view",

    /* Vendors */
    "vendor.create",
    "vendor.update",
    "vendor.view",

    /* Banking */
    "bankAccount.view",
    "bankPayment.view",

    /* Invoices */
    "invoice.view",

    /* Reports */
    "reports.view",
  ] as const,


  /* =======================================================
     HR MANAGER

     Employee and payroll administration.
  ======================================================= */

  HR_MANAGER: [
    /* Employees */
    "employee.create",
    "employee.update",
    "employee.view",

    /* Payroll */
    "payroll.create",
    "payroll.update",
    "payroll.view",

    /* Reports */
    "reports.view",
  ] as const,


  /* =======================================================
     ASSET MANAGER

     Company asset lifecycle and assignments.

     Employee permissions are limited to employee records
     required for asset custody.

     No payroll permissions are granted.
  ======================================================= */

  ASSET_MANAGER: [
    /* Assets */
    "asset.create",
    "asset.update",
    "asset.delete",
    "asset.view",

    /* Asset assignments */
    "assetAssignment.create",
    "assetAssignment.update",
    "assetAssignment.view",

    /* Employees required for asset custody */
    "employee.create",
    "employee.update",
    "employee.view",

    /* Reports */
    "reports.view",
  ] as const,


  /* =======================================================
     AUDITOR

     STRICTLY READ-ONLY.

     SECURITY REQUIREMENT:
     There MUST NOT be any create/update/delete/post/approve/
     payment/manage/revoke permission in this template.

     An Auditor may inspect tenant financial information and
     permitted security/user visibility, but cannot modify
     tenant data.
  ======================================================= */

  AUDITOR: [
    /* Chart of Accounts */
    "account.view",

    /* Accounts Payable */
    "accountsPayable.view",

    /* Accounts Receivable */
    "accountsReceivable.view",

    /* Banking */
    "bankAccount.view",
    "bankPayment.view",

    /* Expenses */
    "expense.view",

    /* Invoices */
    "invoice.view",

    /* Journal */
    "journal.view",

    /* General Ledger */
    "ledger.view",

    /* M-Pesa */
    "mpesa.view",

    /* Reports */
    "reports.view",

    /* Vendors */
    "vendor.view",

    /* Tenant users — visibility only */
    "users.view",

    /* Tenant security — visibility only */
    "security.sessions.view",
  ] as const,


  /* =======================================================
     VIEWER

     General read-only financial access.

     No user administration.
     No security administration.
     No write permissions.
  ======================================================= */

  VIEWER: [
    /* Chart of Accounts */
    "account.view",

    /* Accounts Payable */
    "accountsPayable.view",

    /* Accounts Receivable */
    "accountsReceivable.view",

    /* Banking */
    "bankAccount.view",

    /* Expenses */
    "expense.view",

    /* Invoices */
    "invoice.view",

    /* Journal */
    "journal.view",

    /* General Ledger */
    "ledger.view",

    /* Reports */
    "reports.view",

    /* Vendors */
    "vendor.view",
  ] as const,

} as const;


/* =========================================================
   ROLE TYPES
========================================================= */

export type RoleTemplate =
  keyof typeof ROLE_TEMPLATES;


/* =========================================================
   AVAILABLE STANDARD ROLES
========================================================= */

export const ROLE_TEMPLATE_NAMES =
  Object.keys(
    ROLE_TEMPLATES,
  ) as RoleTemplate[];


/* =========================================================
   ROLE VALIDATION
========================================================= */

/**
 * Returns true only for explicitly defined standard roles.
 *
 * CUSTOM is intentionally NOT a role template.
 * OWNER is intentionally NOT a role template.
 *
 * This prevents either role from being accidentally treated
 * as an ordinary standard-role permission set.
 */
export function isRoleTemplate(
  role: string,
): role is RoleTemplate {
  if (typeof role !== "string") {
    return false;
  }

  return Object.prototype.hasOwnProperty.call(
    ROLE_TEMPLATES,
    role.trim().toUpperCase(),
  );
}


/* =========================================================
   GET ROLE PERMISSIONS
========================================================= */

/**
 * Returns a defensive copy of the permissions belonging to
 * a standard role.
 *
 * Callers cannot mutate ROLE_TEMPLATES through the returned
 * array.
 *
 * SECURITY:
 * This function accepts ONLY standard roles.
 * OWNER and CUSTOM must be handled by the authorization
 * service.
 */
export function getRoleTemplatePermissions(
  role: RoleTemplate,
): string[] {
  const normalizedRole =
    role.trim().toUpperCase() as RoleTemplate;

  if (!isRoleTemplate(normalizedRole)) {
    return [];
  }

  return [
    ...ROLE_TEMPLATES[normalizedRole],
  ];
}


/* =========================================================
   READ-ONLY ROLE HELPERS
========================================================= */

/**
 * These roles are intentionally read-only.
 *
 * This helper can be used by validation/tests to ensure a
 * read-only role never receives a write permission.
 */
export const READ_ONLY_ROLES = [
  "AUDITOR",
  "VIEWER",
] as const;

export type ReadOnlyRole =
  typeof READ_ONLY_ROLES[number];


/**
 * Check whether a role is explicitly read-only.
 */
export function isReadOnlyRole(
  role: string,
): role is ReadOnlyRole {
  if (typeof role !== "string") {
    return false;
  }

  return (
    READ_ONLY_ROLES as readonly string[]
  ).includes(
    role.trim().toUpperCase(),
  );
}


/* =========================================================
   STANDARD ROLE SECURITY VALIDATION
========================================================= */

/**
 * These are permission suffixes that represent mutating
 * operations.
 *
 * This is NOT the authorization check itself.
 *
 * It exists as a defensive validation layer so the role
 * configuration cannot accidentally make AUDITOR/VIEWER
 * writable.
 */
const WRITE_PERMISSION_ACTIONS = new Set([
  "create",
  "update",
  "delete",
  "post",
  "approve",
  "payment",
  "status",
  "manageAccess",
  "manageStatus",
  "revoke",
]);


/**
 * Determine whether a permission represents a mutation.
 */
export function isWritePermission(
  permission: string,
): boolean {
  if (typeof permission !== "string") {
    return false;
  }

  const normalized =
    permission.trim();

  const separatorIndex =
    normalized.lastIndexOf(".");

  if (separatorIndex === -1) {
    return false;
  }

  const action =
    normalized.slice(
      separatorIndex + 1,
    );

  return WRITE_PERMISSION_ACTIONS.has(
    action,
  );
}


/**
 * Validate that a standard role template is internally
 * consistent.
 *
 * Read-only roles are forbidden from containing write
 * permissions.
 *
 * This can be called by startup validation/tests.
 */
export function validateRoleTemplates(): void {
  for (const role of ROLE_TEMPLATE_NAMES) {
    const permissions =
      getRoleTemplatePermissions(role);

    if (isReadOnlyRole(role)) {
      const invalidPermissions =
        permissions.filter(
          isWritePermission,
        );

      if (invalidPermissions.length > 0) {
        throw new Error(
          `SECURITY CONFIGURATION ERROR: ` +
          `${role} contains write permissions: ` +
          invalidPermissions.join(", "),
        );
      }
    }

    /* No wildcard is allowed inside standard role templates. */
    if (permissions.includes("*")) {
      throw new Error(
        `SECURITY CONFIGURATION ERROR: ` +
        `standard role ${role} cannot contain wildcard permission "*"`,
      );
    }

    /* Reject empty/invalid permission strings. */
    const invalidPermissions =
      permissions.filter(
        (permission) =>
          typeof permission !== "string" ||
          permission.trim().length === 0,
      );

    if (invalidPermissions.length > 0) {
      throw new Error(
        `SECURITY CONFIGURATION ERROR: ` +
        `${role} contains invalid permissions`,
      );
    }
  }
}


/* =========================================================
   STARTUP CONFIGURATION VALIDATION
========================================================= */

/**
 * Execute role-template validation when this module is
 * loaded.
 *
 * This means a deployment cannot silently start with an
 * invalid Auditor/Viewer configuration.
 */
validateRoleTemplates();
