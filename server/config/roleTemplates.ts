export const ROLE_TEMPLATES = {
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

    "users.view",
  ],

  ACCOUNTANT: [
    "account.view",

    "accountsPayable.create",
    "accountsPayable.view",

    "accountsReceivable.create",
    "accountsReceivable.update",
    "accountsReceivable.view",

    "bankAccount.view",

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

  ACCOUNTS_PAYABLE: [
    "accountsPayable.create",
    "accountsPayable.view",

    "expense.create",
    "expense.view",

    "vendor.create",
    "vendor.update",
    "vendor.view",

    "bankAccount.view",
  ],

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

  AUDITOR: [
    "account.view",

    "accountsPayable.view",
    "accountsReceivable.view",

    "bankAccount.view",

    "expense.view",

    "invoice.view",

    "journal.view",

    "ledger.view",

    "mpesa.view",

    "reports.view",

    "vendor.view",
  ],

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

export type RoleTemplate =
  keyof typeof ROLE_TEMPLATES;

export const ROLE_TEMPLATE_NAMES =
  Object.keys(
    ROLE_TEMPLATES
  ) as RoleTemplate[];

export function isRoleTemplate(
  role: string
): role is RoleTemplate {
  return role in ROLE_TEMPLATES;
}

export function getRoleTemplatePermissions(
  role: RoleTemplate
): string[] {
  return [
    ...ROLE_TEMPLATES[role],
  ];
}