import { authenticatedFetch } from "../lib/auth";

export interface ExpenseVendor {
  id: string;
  vendorCode: string;
  name: string;
  status?: string | null;
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
  currency: string;
}

export interface ExpenseApproval {
  id: string;
  module: string;
  description: string;
  amount: number;
  requestedBy: string;
  status: string;
  approvedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExpenseJournalLine {
  id?: string;
  lineNumber: number;
  accountId: string;
  memo?: string | null;
  debit: number;
  credit: number;
  account?: ExpenseAccount | null;
}

export interface ExpenseJournalEntry {
  id: string;
  reference: string;
  description: string;
  amount: number;
  status: string;
  transactionDate: string;
  postedAt?: string | null;
  postedBy?: string | null;
  lines?: ExpenseJournalLine[];
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
  vendor?: ExpenseVendor | null;
  expenseAccount?: ExpenseAccount | null;
  paymentAccount?: ExpenseAccount | null;
  bankAccount?: ExpenseBankAccount | null;
  approval?: ExpenseApproval | null;
  journalEntry?: ExpenseJournalEntry | null;
}

export interface ExpenseInput {
  category: string;
  description: string;
  amount: number;
  currency?: string;
  expenseDate: string;
  vendorId?: string;
  expenseAccountId: string;
  paymentAccountId?: string;
  bankAccountId?: string;
  paymentMethod?: string;
}

export interface ExpensePaymentInput {
  paymentDate?: string;
  paymentReference: string;
  paymentMethod: string;
  bankAccountId?: string;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  expense?: T;
  expenses?: T[];
  approval?: unknown;
  journalEntry?: unknown;
}

async function parseResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const data = (await response.json().catch(() => ({}))) as ApiResponse<T>;

  if (!response.ok || data.success === false) {
    throw new Error(data.message || "Expense request failed.");
  }

  return data;
}

export async function fetchExpenses(): Promise<Expense[]> {
  const response = await authenticatedFetch("/api/expenses", {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const data = await parseResponse<Expense>(response);
  return Array.isArray(data.expenses) ? data.expenses : [];
}

export async function fetchExpenseById(id: string): Promise<Expense> {
  const response = await authenticatedFetch(
    `/api/expenses/${encodeURIComponent(id)}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  const data = await parseResponse<Expense>(response);

  if (!data.expense) {
    throw new Error("Expense was not returned by the server.");
  }

  return data.expense;
}

export async function createExpense(input: ExpenseInput): Promise<Expense> {
  const response = await authenticatedFetch("/api/expenses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(input),
  });

  const data = await parseResponse<Expense>(response);

  if (!data.expense) {
    throw new Error("Expense was not returned after creation.");
  }

  return data.expense;
}

export async function submitExpense(id: string): Promise<Expense> {
  const response = await authenticatedFetch(
    `/api/expenses/${encodeURIComponent(id)}/submit`,
    {
      method: "POST",
      headers: { Accept: "application/json" },
    }
  );

  const data = await parseResponse<Expense>(response);

  if (!data.expense) {
    throw new Error("Expense was not returned after submission.");
  }

  return data.expense;
}


export async function approveExpense(id: string): Promise<unknown> {
  const response = await authenticatedFetch(
    `/api/approvals/${encodeURIComponent(id)}/approve`,
    {
      method: "PATCH",
      headers: { Accept: "application/json" },
    }
  );

  const data = await parseResponse<{
    approval?: unknown;
  }>(response);

  return data.approval;
}
export async function postExpense(id: string): Promise<Expense> {
  const response = await authenticatedFetch(
    `/api/expenses/${encodeURIComponent(id)}/post`,
    {
      method: "POST",
      headers: { Accept: "application/json" },
    }
  );

  const data = await parseResponse<Expense>(response);

  if (!data.expense) {
    throw new Error("Expense was not returned after posting.");
  }

  return data.expense;
}

export async function recordExpensePayment(
  id: string,
  input: ExpensePaymentInput
): Promise<Expense> {
  const response = await authenticatedFetch(
    `/api/expenses/${encodeURIComponent(id)}/payment`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(input),
    }
  );

  const data = await parseResponse<Expense>(response);

  if (!data.expense) {
    throw new Error("Expense was not returned after payment recording.");
  }

  return data.expense;
}

export async function deleteExpense(id: string): Promise<void> {
  const response = await authenticatedFetch(
    `/api/expenses/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: { Accept: "application/json" },
    }
  );

  await parseResponse<never>(response);
}
