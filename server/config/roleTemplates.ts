export const TENANT_OWNER_OPERATIONAL_PERMISSIONS = [
  /* Tenant user administration */
  "users.view",
  "users.create",
  "users.manageAccess",
  "users.manageStatus",
  "users.delete",

  /* Chart of Accounts */
  "account.view",
  "account.create",
  "account.update",
  "account.delete",

  /* Accounts Payable */
  "accountsPayable.view",
  "accountsPayable.create",
  "accountsPayable.approve",
  "accountsPayable.payment",
  "accountsPayable.delete",

  /* Accounts Receivable */
  "accountsReceivable.view",
  "accountsReceivable.create",
  "accountsReceivable.approve",
  "accountsReceivable.payment",
  "accountsReceivable.update",
  "accountsReceivable.delete",

  /* Approvals */
  "approval.view",
  "approval.approve",
  "approval.reject",

  /* Bank Accounts */
  "bankAccount.view",
  "bankAccount.create",
  "bankAccount.update",
  "bankAccount.delete",

  /* Bank Payments */
  "bankPayment.view",
  "bankPayment.create",

  /* Budgets */
  "budget.view",
  "budget.create",
  "budget.update",
  "budget.delete",

  /* Documents */
  "document.view",
  "document.create",
  "document.delete",

  /* Expenses */
  "expense.view",
  "expense.create",

  /* Fraud */
  "fraud.view",
  "fraud.analyze",

  /* Investments */
  "investment.view",
  "investment.create",

  /* Invoices */
  "invoice.view",
  "invoice.create",

  /* Journals */
  "journal.view",
  "journal.create",
  "journal.update",
  "journal.post",
  "journal.approve",
  "journal.reverse",
  "journal.delete",

  /* General Ledger */
  "ledger.view",

  /* Portfolio Companies */
  "portfolioCompany.view",
  "portfolioCompany.create",
  "portfolioCompany.update",
  "portfolioCompany.delete",

  /* Reports */
  "reports.view",

  /* Vendors */
  "vendor.view",
  "vendor.create",
  "vendor.update",
  "vendor.status",
  "vendor.delete",

  /* Employees */
  "employee.view",
  "employee.create",
  "employee.update",
  "employee.delete",

  /* Payroll */
  "payroll.view",
  "payroll.create",
  "payroll.update",

  /* Procurement */
  "procurement.view",
  "procurement.create",
  "procurement.update",
  "procurement.status",

  /* Assets */
  "asset.view",
  "asset.create",
  "asset.update",
  "asset.delete",

  /* Asset Assignments */
  "assetAssignment.view",
  "assetAssignment.create",
  "assetAssignment.update",

  /* M-Pesa */
  "mpesa.view",
  "mpesa.create",

  /* Tax */
  "tax.view",
  "tax.file",
  "tax.payment",

  /* Tenant Session Security */
  "security.sessions.view",
  "security.sessions.revoke",
] as const;


/* =========================================================
   STANDARD TENANT ROLE TEMPLATES
========================================================= */

export const ROLE_TEMPLATES = {
  /* =========================================================
     FINANCE MANAGER

     Broad financial management access plus tenant
     user administration and tenant security management.
  ========================================================= */

  FINANCE_MANAGER: [
    "account.create",
    "account.update",
    "account.view",

    "accountsPayable.approve",
    "accountsPayable.create",
    "accountsPayable.payment",
    "accountsPayable.view",

    "accountsReceivable.approve",
    "accountsReceivable.create",
    "accountsReceivable.payment",
    "accountsReceivable.update",
    "accountsReceivable.view",

    "bankAccount.create",
    "bankAccount.view",

    "bankPayment.create",
    "bankPayment.view",

    "expense.create",
    "expense.view",

    "invoice.create",
    "invoice.view",

    "journal.approve",
    "journal.create",
    "journal.post",
    "journal.update",
    "journal.view",

    "ledger.view",

    "mpesa.create",
    "mpesa.view",

    "reports.view",

    "vendor.create",
    "vendor.status",
    "vendor.update",
    "vendor.view",

    /* Tenant user administration */
    "users.view",
    "users.create",
    "users.manageAccess",
    "users.manageStatus",

    /* Tenant security management */
    "security.sessions.view",
    "security.sessions.revoke",
  ],

  /* =========================================================
     ACCOUNTANT

     Financial operational access.
  ========================================================= */

  ACCOUNTANT: [
    "account.view",

    "accountsPayable.create",
    "accountsPayable.view",

    "accountsReceivable.create",
    "accountsReceivable.update",
    "accountsReceivable.view",

    "bankAccount.view",

    "bankPayment.create",
    "bankPayment.view",

    "expense.create",
    "expense.view",

    "invoice.create",
    "invoice.view",

    "journal.create",
    "journal.update",
    "journal.view",

    "ledger.view",

    "mpesa.view",

    "reports.view",

    "vendor.view",
  ],

  /* =========================================================
     FINANCE OFFICER

     Financial operational access.
  ========================================================= */

  FINANCE_OFFICER: [
    "account.view",

    "accountsPayable.create",
    "accountsPayable.view",

    "accountsReceivable.create",
    "accountsReceivable.view",

    "bankAccount.view",

    "bankPayment.create",
    "bankPayment.view",

    "expense.create",
    "expense.view",

    "invoice.create",
    "invoice.view",

    "journal.create",
    "journal.update",
    "journal.view",

    "ledger.view",

    "mpesa.view",

    "reports.view",

    "vendor.view",
  ],

  /* =========================================================
     SENIOR ACCOUNTANT

     Tenant owner-equivalent operational permissions.
     No global Platform Admin privileges.
  ========================================================= */

  SENIOR_ACCOUNTANT: [
    ...TENANT_OWNER_OPERATIONAL_PERMISSIONS,
  ],

  /* =========================================================
     CHIEF ACCOUNTANT

     Same tenant operational and administration permissions
     as Senior Accountant.
  ========================================================= */

  CHIEF_ACCOUNTANT: [
    ...TENANT_OWNER_OPERATIONAL_PERMISSIONS,
  ],

  /* =========================================================
     ACCOUNTS PAYABLE
  ========================================================= */

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
  ],

  /* =========================================================
     ACCOUNTS RECEIVABLE
  ========================================================= */

  ACCOUNTS_RECEIVABLE: [
    "accountsReceivable.create",
    "accountsReceivable.update",
    "accountsReceivable.view",

    "invoice.create",
    "invoice.view",

    "bankAccount.view",

    "mpesa.view",

    "reports.view",
  ],

  /* =========================================================
     PROCUREMENT OFFICER

     Procurement-related operational access without
     unrestricted financial administration.
  ========================================================= */

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
  ],

  /* =========================================================
     HR MANAGER

     Employee and payroll administration.
  ========================================================= */

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
  ],

  /* =========================================================
     ASSET MANAGER

     Company asset lifecycle and assignments.

     Employee records are limited to those required
     for asset custody.

     No payroll permissions are granted.
  ========================================================= */

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
  ],

  /* =========================================================
     AUDITOR

     STRICTLY READ-ONLY.

     An Auditor may inspect tenant financial information
     and permitted security/user visibility, but cannot
     modify tenant data.
  ========================================================= */

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

    /* Tenant users - visibility only */
    "users.view",

    /* Tenant security - visibility only */
    "security.sessions.view",
  ],

  /* =========================================================
     VIEWER

     General read-only financial access.

     No user administration.
     No security administration.
     No write permissions.
  ========================================================= */

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
  ],
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
    role.trim().toUpperCase() as ReadOnlyRole,
  );
}


/* =========================================================
   STANDARD ROLE SECURITY VALIDATION
========================================================= */

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
    normalized.slice(separatorIndex + 1);

  return WRITE_PERMISSION_ACTIONS.has(action);
}


/**
 * Validate standard role-template security.
 *
 * Auditor and Viewer must remain read-only.
 * Standard roles cannot contain wildcard permissions.
 */
export function validateRoleTemplates(): void {
  for (const role of ROLE_TEMPLATE_NAMES) {
    const permissions =
      getRoleTemplatePermissions(role);

    if (isReadOnlyRole(role)) {
      const invalidPermissions =
        permissions.filter(isWritePermission);

      if (invalidPermissions.length > 0) {
        throw new Error(
          `SECURITY CONFIGURATION ERROR: ` +
          `${role} contains write permissions: ` +
          invalidPermissions.join(", "),
        );
      }
    }

    if (permissions.includes("*")) {
      throw new Error(
        `SECURITY CONFIGURATION ERROR: ` +
        `standard role ${role} cannot contain wildcard permission "*"`,
      );
    }

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

validateRoleTemplates();
