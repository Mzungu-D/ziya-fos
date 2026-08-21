export const ROLE_TEMPLATES = {
  /* =========================================================
     FINANCE MANAGER

     Broad financial management access plus tenant
     user administration.
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
  ],

  /* =========================================================
     ACCOUNTANT
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
    "accountsPayable.create",
    "accountsPayable.view",

    "expense.create",
    "expense.view",

    "vendor.create",
    "vendor.update",
    "vendor.view",

    "bankAccount.view",

    "bankPayment.view",

    "invoice.view",

    "reports.view",
  ],

  /* =========================================================
     HR MANAGER

     Employee and payroll administration.
  ========================================================= */

  HR_MANAGER: [
    "employee.create",
    "employee.update",
    "employee.view",

    "payroll.create",
    "payroll.update",
    "payroll.view",

    "reports.view",
  ],

  /* =========================================================
     ASSET MANAGER

     Company asset lifecycle and assignments.
  ========================================================= */

  ASSET_MANAGER: [
    "asset.create",
    "asset.update",
    "asset.delete",
    "asset.view",

    "assetAssignment.create",
    "assetAssignment.update",
    "assetAssignment.view",

    "reports.view",
  ],

  /* =========================================================
     AUDITOR

     Read-only financial and user visibility.
  ========================================================= */

  AUDITOR: [
    "account.view",

    "accountsPayable.view",
    "accountsReceivable.view",

    "bankAccount.view",

    "bankPayment.view",

    "expense.view",

    "invoice.view",

    "journal.view",

    "ledger.view",

    "mpesa.view",

    "reports.view",

    "vendor.view",

    "users.view",
  ],

  /* =========================================================
     VIEWER

     General read-only financial access.
  ========================================================= */

  VIEWER: [
    "account.view",

    "accountsPayable.view",
    "accountsReceivable.view",

    "bankAccount.view",

    "expense.view",

    "invoice.view",

    "journal.view",

    "ledger.view",

    "reports.view",

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
    ROLE_TEMPLATES
  ) as RoleTemplate[];

/* =========================================================
   ROLE VALIDATION
========================================================= */

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

   Always returns a new array so callers cannot mutate
   the server-side role template.
========================================================= */

export function getRoleTemplatePermissions(
  role: RoleTemplate
): string[] {
  return [
    ...ROLE_TEMPLATES[role],
  ];
}