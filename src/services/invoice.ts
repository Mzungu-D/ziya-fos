import {
  authenticatedFetch,
  getAuthToken,
} from "../lib/auth";

/* =========================================================
   TYPES
========================================================= */

export type InvoiceStatus =
  | "DRAFT"
  | "POSTED"
  | "VOID";

export type InvoicePaymentStatus =
  | "UNPAID"
  | "PARTIALLY_PAID"
  | "PAID";

export interface InvoiceLine {
  id: string;
  invoiceId: string;

  accountId: string | null;
  account?: {
    id: string;
    code: string;
    name: string;
    type?: string;
  } | null;

  description: string;
  quantity: number | string;
  unitPrice: number | string;
  discountAmount: number | string;
  taxRate: number | string;
  taxAmount: number | string;
  lineSubtotal: number | string;
  lineTotal: number | string;
  lineNumber: number;

  createdAt?: string;
  updatedAt?: string;
}

export interface InvoiceCustomer {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string | null;
}

export interface Invoice {
  id: string;

  invoiceNumber: string;

  customerId?: string | null;

  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;

  customer?: InvoiceCustomer | null;

  description: string;

  subtotal: number | string;
  taxAmount: number | string;
  totalAmount: number | string;

  issueDate: string;
  dueDate: string;

  paymentStatus: InvoicePaymentStatus | string;

  status: InvoiceStatus | string;

  outstandingBalance: number | string;

  invoiceLines?: InvoiceLine[];

  createdAt?: string;
  updatedAt?: string;
}

/* =========================================================
   INVOICE LINE INPUT
========================================================= */

export interface InvoiceLineInput {
  accountId?: string | null;

  description: string;

  quantity: number;

  unitPrice: number;

  discountAmount?: number;

  taxRate?: number;
}

/* =========================================================
   CREATE INVOICE INPUT
========================================================= */

export interface CreateInvoiceInput {
  customerId?: string | null;

  customerName: string;

  customerEmail?: string | null;

  customerPhone?: string | null;

  description?: string;

  issueDate: string;

  dueDate: string;

  lines: InvoiceLineInput[];
}

/* =========================================================
   UPDATE INVOICE INPUT
========================================================= */

export interface UpdateInvoiceInput {
  customerId?: string | null;

  customerName?: string;

  customerEmail?: string | null;

  customerPhone?: string | null;

  description?: string;

  issueDate?: string;

  dueDate?: string;

  lines?: InvoiceLineInput[];
}

/* =========================================================
   LIST FILTERS
========================================================= */

export interface InvoiceListFilters {
  page?: number;

  limit?: number;

  search?: string;

  status?: InvoiceStatus | string;

  paymentStatus?: InvoicePaymentStatus | string;
}

/* =========================================================
   PAGINATION
========================================================= */

export interface InvoicePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/* =========================================================
   API RESPONSES
========================================================= */

export interface InvoiceResponse {
  success: boolean;

  message?: string;

  invoice?: Invoice;

  receivable?: unknown;

  journalEntry?: unknown;
}

export interface InvoicesResponse {
  success: boolean;

  message?: string;

  invoices?: Invoice[];

  meta?: {
    organizationId?: string;
    count?: number;

    pagination?: InvoicePagination;

    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface InvoiceStats {
  totalInvoices: number;

  draftInvoices: number;

  postedInvoices: number;

  voidInvoices: number;

  totalInvoiced: number;

  outstanding: number;

  collected: number;

  overdue: number;

  unpaidCount: number;

  partiallyPaidCount: number;

  paidCount: number;
}

export interface InvoiceStatsResponse {
  success: boolean;

  message?: string;

  stats?: InvoiceStats;
}

/* =========================================================
   API
========================================================= */

const API_URL = "/api/invoices";

/* =========================================================
   REQUEST HELPER
========================================================= */

const request = async <T>(
  url: string,
  options: RequestInit = {}
): Promise<T> => {
  const token = getAuthToken();

  if (!token) {
    throw new Error("Authentication required.");
  }

  const response = await authenticatedFetch(url, {
    ...options,

    headers: {
      Accept: "application/json",

      ...(options.body
        ? {
            "Content-Type": "application/json",
          }
        : {}),

      ...(options.headers || {}),
    },
  });

  let data: unknown = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof (data as { message?: unknown }).message ===
        "string"
        ? (data as { message: string }).message
        : "Invoice request failed.";

    throw new Error(message);
  }

  return data as T;
};

/* =========================================================
   QUERY BUILDER
========================================================= */

const buildQueryString = (
  filters: InvoiceListFilters = {}
): string => {
  const params = new URLSearchParams();

  if (
    filters.page !== undefined &&
    Number.isFinite(filters.page)
  ) {
    params.set(
      "page",
      String(Math.max(1, Math.floor(filters.page)))
    );
  }

  if (
    filters.limit !== undefined &&
    Number.isFinite(filters.limit)
  ) {
    params.set(
      "limit",
      String(
        Math.min(
          100,
          Math.max(1, Math.floor(filters.limit))
        )
      )
    );
  }

  if (filters.search?.trim()) {
    params.set(
      "search",
      filters.search.trim()
    );
  }

  if (filters.status?.trim()) {
    params.set(
      "status",
      filters.status.trim()
    );
  }

  if (filters.paymentStatus?.trim()) {
    params.set(
      "paymentStatus",
      filters.paymentStatus.trim()
    );
  }

  const query = params.toString();

  return query ? `?${query}` : "";
};

/* =========================================================
   FETCH INVOICES
========================================================= */

export const fetchInvoices = async (
  filters: InvoiceListFilters = {}
): Promise<InvoicesResponse> => {
  return request<InvoicesResponse>(
    `${API_URL}${buildQueryString(filters)}`
  );
};

/* =========================================================
   FETCH ONE INVOICE
========================================================= */

export const fetchInvoiceById = async (
  id: string
): Promise<InvoiceResponse> => {
  if (!id.trim()) {
    throw new Error("Invoice ID is required.");
  }

  return request<InvoiceResponse>(
    `${API_URL}/${encodeURIComponent(id)}`
  );
};

/* =========================================================
   CREATE INVOICE
========================================================= */

export const createInvoice = async (
  input: CreateInvoiceInput
): Promise<InvoiceResponse> => {
  return request<InvoiceResponse>(
    API_URL,
    {
      method: "POST",

      body: JSON.stringify(input),
    }
  );
};

/* =========================================================
   UPDATE DRAFT INVOICE
========================================================= */

export const updateInvoice = async (
  id: string,
  input: UpdateInvoiceInput
): Promise<InvoiceResponse> => {
  if (!id.trim()) {
    throw new Error("Invoice ID is required.");
  }

  return request<InvoiceResponse>(
    `${API_URL}/${encodeURIComponent(id)}`,
    {
      method: "PATCH",

      body: JSON.stringify(input),
    }
  );
};

/* =========================================================
   FINALIZE / POST INVOICE
========================================================= */

export const finalizeInvoice = async (
  id: string
): Promise<InvoiceResponse> => {
  if (!id.trim()) {
    throw new Error("Invoice ID is required.");
  }

  return request<InvoiceResponse>(
    `${API_URL}/${encodeURIComponent(id)}/finalize`,
    {
      method: "POST",
    }
  );
};

/* =========================================================
   VOID POSTED INVOICE
========================================================= */

export const voidInvoice = async (
  id: string
): Promise<InvoiceResponse> => {
  if (!id.trim()) {
    throw new Error("Invoice ID is required.");
  }

  return request<InvoiceResponse>(
    `${API_URL}/${encodeURIComponent(id)}/void`,
    {
      method: "POST",
    }
  );
};

/* =========================================================
   DELETE DRAFT INVOICE
========================================================= */

export const deleteInvoice = async (
  id: string
): Promise<InvoiceResponse> => {
  if (!id.trim()) {
    throw new Error("Invoice ID is required.");
  }

  return request<InvoiceResponse>(
    `${API_URL}/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    }
  );
};

/* =========================================================
   FETCH INVOICE STATISTICS
========================================================= */

export const fetchInvoiceStats =
  async (): Promise<InvoiceStatsResponse> => {
    return request<InvoiceStatsResponse>(
      `${API_URL}/stats`
    );
  };