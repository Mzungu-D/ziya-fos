import {
  authenticatedFetch,
  getAuthToken,
} from "../lib/auth";

/* =========================================================
   TYPES
========================================================= */

export interface Invoice {
  id: string;

  invoiceNumber: string;

  customerName: string;

  customerEmail:
    | string
    | null;

  customerPhone:
    | string
    | null;

  description: string;

  subtotal:
    | number
    | string;

  taxAmount:
    | number
    | string;

  totalAmount:
    | number
    | string;

  issueDate: string;

  dueDate: string;

  paymentStatus: string;

  status?: string;

  outstandingBalance:
    | number
    | string;

  createdAt?: string;

  updatedAt?: string;
}

export interface InvoiceInput {
  invoiceNumber: string;

  customerName: string;

  customerEmail?:
    | string
    | null;

  customerPhone?:
    | string
    | null;

  description?: string;

  subtotal: number;

  taxAmount: number;

  totalAmount: number;

  issueDate: string;

  dueDate: string;
}

export interface InvoiceResponse {
  success: boolean;

  message?: string;

  invoice?: Invoice;

  receivable?: unknown;
}

export interface InvoicesResponse {
  success: boolean;

  message?: string;

  invoices?: Invoice[];

  meta?: {
    organizationId: string;

    count: number;
  };
}

/* =========================================================
   API
========================================================= */

const API_URL =
  "/api/invoices";

/* =========================================================
   REQUEST HELPER
========================================================= */

const request = async <T>(
  url: string,
  options: RequestInit = {}
): Promise<T> => {
  const token =
    getAuthToken();

  if (!token) {
    throw new Error(
      "Authentication required."
    );
  }

  const response =
    await authenticatedFetch(
      url,
      {
        ...options,

        headers: {
          Accept:
            "application/json",

          ...(options.body
            ? {
                "Content-Type":
                  "application/json",
              }
            : {}),

          ...(options.headers || {}),
        },
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
        "Invoice request failed."
    );
  }

  return data as T;
};

/* =========================================================
   FETCH ALL INVOICES
========================================================= */

export const fetchInvoices =
  async (): Promise<InvoicesResponse> => {
    return request<InvoicesResponse>(
      API_URL
    );
  };

/* =========================================================
   FETCH ONE INVOICE
========================================================= */

export const fetchInvoiceById =
  async (
    id: string
  ): Promise<InvoiceResponse> => {
    return request<InvoiceResponse>(
      `${API_URL}/${id}`
    );
  };

/* =========================================================
   CREATE INVOICE
========================================================= */

export const createInvoice =
  async (
    input: InvoiceInput
  ): Promise<InvoiceResponse> => {
    return request<InvoiceResponse>(
      API_URL,
      {
        method: "POST",

        body: JSON.stringify(
          input
        ),
      }
    );
  };