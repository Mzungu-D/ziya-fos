/**
 * =========================================================
 * ZIYA FOS — ROLE TEMPLATES
 * =========================================================
 *
 * File:
 *   server/config/roleTemplates.ts
 *
 * Purpose:
 *   Defines the standard tenant roles and the permissions
 *   assigned to each role.
 *
 * SECURITY PRINCIPLES:
 *
 * 1. These templates are server-side defaults.
 * 2. The frontend MUST NOT be trusted to define permissions.
 * 3. When a standard role is assigned, permissions should be
 *    derived from this file on the backend.
 * 4. A user must never receive permissions outside the scope
 *    of the role/module they are being assigned.
 * 5. OWNER is NOT defined here.
 *    OWNER is a protected organization-level role and is
 *    handled separately by the authorization system.
 * 6. Asset Manager may VIEW employees only because an employee
 *    must be selected when assigning an asset.
 * 7. Asset Manager cannot create, update, delete, or manage
 *    employee records.
 * 8. HR Manager owns employee and payroll management.
 * 9. Finance roles own financial modules.
 * 10. Read-only roles must not receive write permissions.
 *
 * IMPORTANT:
 *   Keep permission names synchronized with the permissions
 *   enforced by:
 *
 *   - server/middleware/permission.middleware.ts
 *   - backend routes
 *   - backend controllers
 *   - frontend RequirePermission guards
 *
 * =========================================================
 */

export const ROLE_TEMPLATES = {
  /* =======================================================
     FINANCE MANAGER
     =======================================================

     Primary responsibility:
     - Finance operations
     - Financial administration
     - Approval workflows
     - Tenant user/access administration
     - Tax operations
     - Financial reporting

     This role is intentionally broad within finance.

     It does NOT automatically receive:
     - HR employee management
     - Payroll management
     - Asset management
     - Procurement management
     - Arbitrary custom permissions
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

    /* Bank Payments */
    "bankPayment.create",
    "bankPayment.view",

    /* Expenses */
    "expense.create",
    "expense.view",

    /* Invoicing */
    "invoice.create",
    "invoice.view",

    /* Journal Entries */
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

    /* Financial Reports */
    "reports.view",

    /* Vendors */
    "vendor.create",
    "vendor.status",
    "vendor.update",
    "vendor.view",

    /* Tenant User Management */
    "users.view",
    "users.create",
    "users.manageAccess",
    "users.manageStatus",

    /* Security */
    "security.sessions.view",
    "security.sessions.revoke",

    /* Tax */
    "tax.view",
    "tax.create",
    "tax.file",
    "tax.payment",
  ],

  /* =======================================================
     ACCOUNTANT
     =======================================================

     Primary responsibility:
     - Day-to-day accounting
     - Journals
     - Ledger
     - AP/AR
     - Expenses
     - Invoicing
     - Tax
     - Financial reports

     Does NOT receive:
     - User administration
     - Security administration
     - Journal approval/posting authority
     - Broad tenant administration
  ======================================================= */

  ACCOUNTANT: [
    /* Chart of Accounts */
    "account.view",

    /* Accounts Payable */
    "accountsPayable.create",
    "accountsPayable.view",

    /* Accounts Receivable */
    "accountsReceivable.create",
    "accountsReceivable.update",
    "accountsReceivable.view",

    /* Banking */
    "bankAccount.view",

    /* Bank Payments */
    "bankPayment.create",
    "bankPayment.view",

    /* Expenses */
    "expense.create",
    "expense.view",

    /* Invoicing */
    "invoice.create",
    "invoice.view",

    /* Journal Entries */
    "journal.create",
    "journal.update",
    "journal.view",

    /* General Ledger */
    "ledger.view",

    /* M-Pesa */
    "mpesa.view",

    /* Financial Reports */
    "reports.view",

    /* Vendors */
    "vendor.view",

    /* Tax */
    "tax.view",
    "tax.create",
    "tax.file",
    "tax.payment",
  ],

  /* =======================================================
     FINANCE OFFICER
     =======================================================

     Primary responsibility:
     - Operational finance
     - Expenses
     - AP/AR
     - Banking
     - Journals
     - Invoices
     - Basic tax operations
     - Financial reporting
  ======================================================= */

  FINANCE_OFFICER: [
    /* Chart of Accounts */
    "account.view",

    /* Accounts Payable */
    "accountsPayable.create",
    "accountsPayable.view",

    /* Accounts Receivable */
    "accountsReceivable.create",
    "accountsReceivable.view",

    /* Banking */
    "bankAccount.view",

    /* Bank Payments */
    "bankPayment.create",
    "bankPayment.view",

    /* Expenses */
    "expense.create",
    "expense.view",

    /* Invoicing */
    "invoice.create",
    "invoice.view",

    /* Journal Entries */
    "journal.create",
    "journal.update",
    "journal.view",

    /* General Ledger */
    "ledger.view",

    /* M-Pesa */
    "mpesa.view",

    /* Financial Reports */
    "reports.view",

    /* Vendors */
    "vendor.view",

    /* Tax */
    "tax.view",
    "tax.create",
  ],

  /* =======================================================
     ACCOUNTS PAYABLE
     =======================================================

     Primary responsibility:
     - Supplier bills
     - Vendors
     - Expenses related to AP
     - Bank payment processing

     This role should remain focused on money owed to
     suppliers and related operational workflows.
  ======================================================= */

  ACCOUNTS_PAYABLE: [
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

    /* Bank Payments */
    "bankPayment.create",
    "bankPayment.view",
  ],

  /* =======================================================
     ACCOUNTS RECEIVABLE
     =======================================================

     Primary responsibility:
     - Customer receivables
     - Customer invoices
     - Receivable payments
     - M-Pesa visibility

     This role does not receive general accounting
     administration permissions.
  ======================================================= */

  ACCOUNTS_RECEIVABLE: [
    /* Accounts Receivable */
    "accountsReceivable.create",
    "accountsReceivable.update",
    "accountsReceivable.view",

    /* Invoicing */
    "invoice.create",
    "invoice.view",

    /* Banking */
    "bankAccount.view",

    /* M-Pesa */
    "mpesa.view",

    /* Financial Reports */
    "reports.view",
  ],

  /* =======================================================
     PROCUREMENT OFFICER
     =======================================================

     Primary responsibility:
     - Procurement workflows
     - Supplier/vendor management
     - Procurement-related AP
     - Procurement expenses
     - Purchase documentation

     This role should not receive HR, payroll, asset,
     or tenant administration permissions.
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

    /* Bank Payments */
    "bankPayment.view",

    /* Invoices */
    "invoice.view",

    /* Financial Reports */
    "reports.view",
  ],

  /* =======================================================
     HR MANAGER
     =======================================================

     Primary responsibility:
     - Employee records
     - Payroll
     - HR reporting

     HR owns employee master records.

     Therefore HR Manager receives:
     - employee.create
     - employee.update
     - employee.view

     HR Manager does NOT receive:
     - asset management
     - asset assignment
     - finance administration
     - user administration
  ======================================================= */

  HR_MANAGER: [
    /* Employee Management */
    "employee.create",
    "employee.update",
    "employee.view",

    /* Payroll */
    "payroll.create",
    "payroll.update",
    "payroll.view",

    /* HR Reports */
    "reports.view",
  ],

  /* =======================================================
     ASSET MANAGER
     =======================================================

     Primary responsibility:
     - Fixed assets
     - Asset records
     - Asset assignments
     - Asset custody

     IMPORTANT SECURITY BOUNDARY:

     Asset Manager can VIEW employees only because an employee
     is required when assigning an asset.

     Asset Manager MUST NOT:
     - Create employees
     - Update employees
     - Delete employees
     - Manage payroll
     - Manage HR records

     Employee master data remains under HR Manager.

     Also intentionally excluded:
     - reports.view

     This prevents the Asset Manager from receiving broad
     financial/organizational reporting access simply because
     they manage assets.
  ======================================================= */

  ASSET_MANAGER: [
    /* Fixed Assets */
    "asset.create",
    "asset.update",
    "asset.delete",
    "asset.view",

    /* Asset Assignments */
    "assetAssignment.create",
    "assetAssignment.update",
    "assetAssignment.view",

    /*
     * Employee lookup only.
     *
     * Required for:
     * - Searching employees
     * - Selecting employees during asset assignment
     * - Viewing the minimum employee information required
     *   for custody/assignment workflows
     *
     * This does NOT grant:
     * - employee.create
     * - employee.update
     * - employee.delete
     */
    "employee.view",
  ],

  /* =======================================================
     AUDITOR
     =======================================================

     Primary responsibility:
     - Read-only financial review
     - Audit visibility
     - Security/session visibility
     - Tax visibility

     Auditor receives no normal financial write permissions.
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

    /* Bank Payments */
    "bankPayment.view",

    /* Expenses */
    "expense.view",

    /* Invoices */
    "invoice.view",

    /* Journal Entries */
    "journal.view",

    /* General Ledger */
    "ledger.view",

    /* M-Pesa */
    "mpesa.view",

    /* Financial Reports */
    "reports.view",

    /* Vendors */
    "vendor.view",

    /* User Visibility */
    "users.view",

    /* Security Visibility */
    "security.sessions.view",

    /* Tax Visibility */
    "tax.view",
  ],

  /* =======================================================
     VIEWER
     =======================================================

     Primary responsibility:
     - Read-only access to selected financial information.

     No create/update/delete/approve/payment permissions.

     This role is intentionally restricted.
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

    /* Journal Entries */
    "journal.view",

    /* General Ledger */
    "ledger.view",

    /* Financial Reports */
    "reports.view",

    /* Vendors */
    "vendor.view",
  ],
} as const;

/* =========================================================
   ROLE TEMPLATE TYPES
   ========================================================= */

/**
 * All supported standard tenant roles.
 *
 * OWNER is intentionally excluded.
 * OWNER is a protected organization-level role and is handled
 * by the tenant authorization layer rather than this template.
 */
export type RoleTemplate = keyof typeof ROLE_TEMPLATES;

/* =========================================================
   ROLE TEMPLATE NAMES
   ========================================================= */

/**
 * Returns the list of supported standard roles.
 *
 * This is useful for:
 * - invitation forms
 * - role selectors
 * - backend validation
 * - API validation
 *
 * Do not use frontend-supplied role names without validating
 * them against this list/server-side helper.
 */
export const ROLE_TEMPLATE_NAMES = Object.keys(
  ROLE_TEMPLATES
) as RoleTemplate[];

/* =========================================================
   ROLE VALIDATION
   ========================================================= */

/**
 * Determines whether a string is a supported standard role.
 *
 * Example:
 *
 * isRoleTemplate("HR_MANAGER")        // true
 * isRoleTemplate("ASSET_MANAGER")     // true
 * isRoleTemplate("OWNER")             // false
 * isRoleTemplate("SUPER_ADMIN")       // false
 */
export function isRoleTemplate(
  role: string
): role is RoleTemplate {
  return Object.prototype.hasOwnProperty.call(
    ROLE_TEMPLATES,
    role
  );
}

/* =========================================================
   GET ROLE PERMISSIONS
   ========================================================= */

/**
 * Returns a fresh permissions array for the requested role.
 *
 * IMPORTANT:
 *
 * A new array is returned rather than the underlying readonly
 * tuple. This prevents callers from accidentally mutating the
 * role template itself.
 *
 * Example:
 *
 * const permissions =
 *   getRoleTemplatePermissions("ASSET_MANAGER");
 *
 * The returned permissions will include:
 *
 * - asset.create
 * - asset.update
 * - asset.delete
 * - asset.view
 * - assetAssignment.create
 * - assetAssignment.update
 * - assetAssignment.view
 * - employee.view
 *
 * It will NOT include:
 *
 * - employee.create
 * - employee.update
 * - payroll.create
 * - payroll.update
 */
export function getRoleTemplatePermissions(
  role: RoleTemplate
): string[] {
  return [...ROLE_TEMPLATES[role]];
}