import { authenticatedFetch } from "../lib/auth";

export interface ExpenseVendor {
  id: string;
  name: string;
  vendorCode?: string;
  email?: string | null;
  phone?: string | null;
}

export interface ExpenseAccount {
  id: string;
  code: string;
  name: string;
  type: string;
}

export interface ExpenseBankAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  currency?: string | null;
}

export interface ExpenseApproval {
  id: string;
  module: string;
  description: string;
  amount: number;
  requestedBy: string;
  status: string;
  createdAt: string;
  organizationId: string;
}

export interface ExpenseJournalEntry {
  id: string;
  reference: string;
  status: string;
  transactionDate: string;
}

export interface Expense {
  id: string;
  expenseCode: string;
  vendorId?: string | null;
  category: string;
  description: string;
  amount: number;
  currency: string;
  expenseDate: string;

  status: string;

  paymentStatus: string;
  paymentMethod?: string | null;
  paymentDate?: string | null;
  paymentReference?: string | null;

  approvedBy?: string | null;

  expenseAccountId?: string | null;
  paymentAccountId?: string | null;
  bankAccountId?: string | null;

  approvalId?: string | null;
  journalEntryId?: string | null;

  createdAt: string;
  updatedAt: string;
  organizationId: string;

  vendor?: ExpenseVendor | null;
  expenseAccount?: ExpenseAccount | null;
  paymentAccount?: ExpenseAccount | null;
  bankAccount?: ExpenseBankAccount | null;
  approval?: ExpenseApproval | null;
  journalEntry?: ExpenseJournalEntry | null;
}

export interface ExpenseInput {
  vendorId?: string;
  category: string;
  description: string;
  amount: number;
  currency?: string;
  expenseDate: string;

  expenseAccountId: string;
  paymentAccountId?: string;
  bankAccountId?: string;
  paymentMethod?: string;
}

export interface ExpensePaymentInput {
  paymentDate?: string;
  paymentReference?: string;
  paymentMethod?: string;
  bankAccountId?: string;
}

/* =========================================================
   GET EXPENSES
========================================================= */

export async function fetchExpenses(): Promise<Expense[]> {
  const response = await authenticatedFetch(
    "/api/expenses"
  );

  if (!response.ok) {
    throw new Error(
      "Failed to load expenses."
    );
  }

  const data = await response.json();

  return data.expenses ?? [];
}

/* =========================================================
   GET ONE EXPENSE
========================================================= */

export async function fetchExpenseById(
  id: string
): Promise<Expense> {
  const response = await authenticatedFetch(
    `/api/expenses/${id}`
  );

  if (!response.ok) {
    throw new Error(
      "Failed to load expense."
    );
  }

  const data = await response.json();

  return data.expense;
}

/* =========================================================
   CREATE EXPENSE
========================================================= */

export async function createExpense(
  input: ExpenseInput
): Promise<Expense> {
  const response = await authenticatedFetch(
    "/api/expenses",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Failed to create expense."
    );
  }

  return data.expense;
}

/* =========================================================
   SUBMIT EXPENSE
========================================================= */

export async function submitExpense(
  id: string
): Promise<Expense> {
  const response = await authenticatedFetch(
    `/api/expenses/${id}/submit`,
    {
      method: "PATCH",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Failed to submit expense."
    );
  }

  return data.expense;
}

/* =========================================================
   POST EXPENSE
========================================================= */

export async function postExpense(
  id: string
): Promise<Expense> {
  const response = await authenticatedFetch(
    `/api/expenses/${id}/post`,
    {
      method: "PATCH",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Failed to post expense."
    );
  }

  return data.expense;
}

/* =========================================================
   RECORD PAYMENT
========================================================= */

export async function recordExpensePayment(
  id: string,
  paymentData: ExpensePaymentInput
): Promise<Expense> {
  const response = await authenticatedFetch(
    `/api/expenses/${id}/payment`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paymentData),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Failed to record expense payment."
    );
  }

  return data.expense;
}

/* =========================================================
   DELETE EXPENSE
========================================================= */

export async function deleteExpense(
  id: string
): Promise<void> {
  const response = await authenticatedFetch(
    `/api/expenses/${id}`,
    {
      method: "DELETE",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Failed to delete expense."
    );
  }
}
