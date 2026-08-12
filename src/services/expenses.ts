import { authenticatedFetch, getAuthToken } from "../lib/auth";

export interface Expense {
  id: string;
  expenseCode: string;
  category: string;
  description: string;
  amount: number;
  expenseDate: string;
  status: string;
  approvedBy: string | null;
  vendorId: string | null;
  vendor?: {
    id: string;
    vendorCode: string;
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseInput {
  expenseCode: string;
  category: string;
  description?: string;
  amount: number;
  expenseDate: string;
  vendorId?: string;
}

const authHeaders = () => {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const handleResponse = async (res: Response) => {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "message" in data
        ? String(data.message)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
};

export const fetchExpenses = async (): Promise<{
  expenses: Expense[];
}> => {
  const res = await authenticatedFetch("/api/expenses", {
    method: "GET",
    headers: authHeaders(),
  });
  return handleResponse(res);
};

export const createExpense = async (
  input: ExpenseInput
): Promise<{ expense: Expense; message?: string }> => {
  const res = await authenticatedFetch("/api/expenses", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  return handleResponse(res);
};