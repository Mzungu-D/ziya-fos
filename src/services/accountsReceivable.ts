import {
  authenticatedFetch,
  getAuthToken,
} from "../lib/auth";

/* =========================================================
   API CONFIGURATION
   ========================================================= */

const API_URL = "/api/accounts-receivable";

/* =========================================================
   TYPES
   ========================================================= */

export type ReceivablePaymentStatus =
  | "UNPAID"
  | "PARTIALLY_PAID"
  | "PARTIAL"
  | "PAID"
  | string;

export type ReceivableStatus =
  | "PENDING"
  | "APPROVED"
  | string;

export type ReceivableStatusFilter =
  | "ALL"
  | "PENDING APPROVAL"
  | "APPROVED"
  | "OUTSTANDING"
  | "PARTIALLY PAID"
  | "PAID"
  | "OVERDUE";

export type ReceivableAgingFilter =
  | "ALL"
  | "CURRENT"
  | "1-30 DAYS"
  | "31-60 DAYS"
  | "61-90 DAYS"
  | "90+ DAYS";

/* =========================================================
   RECEIVABLE
   ========================================================= */

export interface Receivable {
  id: string;

  invoiceNumber: string;

  customerName: string;

  description: string;

  amount: number;

  outstandingBalance: number;

  dueDate: string;

  paymentStatus: ReceivablePaymentStatus;

  status: ReceivableStatus;

  approvedBy: string | null;

  createdAt: string;

  updatedAt: string;
}

/* =========================================================
   INPUTS
   ========================================================= */

export interface ReceivableInput {
  invoiceNumber: string;

  customerName: string;

  description: string;

  amount: number;

  dueDate: string;
}

export interface ReceivablePaymentInput {
  amount: number;
}

/* =========================================================
   PAGINATION
   ========================================================= */

export interface ReceivablePagination {
  page: number;

  pageSize: number;

  total: number;

  totalPages: number;
}

/* =========================================================
   SUMMARY
   ========================================================= */

export interface ReceivableSummary {
  totalInvoiced: number;

  totalOutstanding: number;

  totalCollected: number;

  totalOverdue: number;

  overdueCount: number;
}

/* =========================================================
   RESPONSE TYPES
   ========================================================= */

export interface ReceivablesResponse {
  success: boolean;

  message?: string;

  count?: number;

  receivables: Receivable[];

  pagination?: ReceivablePagination;

  summary?: ReceivableSummary;
}

export interface ReceivableResponse {
  success: boolean;

  message?: string;

  receivable: Receivable;
}

export interface MessageResponse {
  success: boolean;

  message?: string;
}

/* =========================================================
   QUERY
   ========================================================= */

export interface FetchReceivablesParams {
  page?: number;

  pageSize?: number;

  search?: string;

  status?: ReceivableStatusFilter;

  aging?: ReceivableAgingFilter;
}

/* =========================================================
   API ERROR
   ========================================================= */

export class AccountsReceivableApiError extends Error {
  status: number;

  constructor(
    message: string,
    status: number
  ) {
    super(message);

    this.name =
      "AccountsReceivableApiError";

    this.status = status;
  }
}

/* =========================================================
   REQUEST HELPER
   ========================================================= */

const request = async <T>(
  url: string,
  options: RequestInit = {}
): Promise<T> => {
  const token = getAuthToken();

  const headers = new Headers(
    options.headers
  );

  headers.set(
    "Accept",
    "application/json"
  );

  if (options.body) {
    headers.set(
      "Content-Type",
      "application/json"
    );
  }

  if (token) {
    headers.set(
      "Authorization",
      `Bearer ${token}`
    );
  }

  const response =
    await authenticatedFetch(url, {
      ...options,
      headers,
    });

  let payload: unknown = null;

  const contentType =
    response.headers.get(
      "content-type"
    ) ?? "";

  if (
    contentType.includes(
      "application/json"
    )
  ) {
    try {
      payload =
        await response.json();
    } catch {
      payload = null;
    }
  } else {
    try {
      const text =
        await response.text();

      payload = text
        ? { message: text }
        : null;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof (
        payload as {
          message?: unknown;
        }
      ).message === "string"
        ? (
            payload as {
              message: string;
            }
          ).message
        : `Request failed with status ${response.status}`;

    throw new AccountsReceivableApiError(
      message,
      response.status
    );
  }

  return payload as T;
};

/* =========================================================
   QUERY BUILDER
   ========================================================= */

const buildQueryString = (
  params: FetchReceivablesParams = {}
): string => {
  const query =
    new URLSearchParams();

  if (
    params.page !== undefined
  ) {
    query.set(
      "page",
      String(params.page)
    );
  }

  if (
    params.pageSize !== undefined
  ) {
    query.set(
      "pageSize",
      String(params.pageSize)
    );
  }

  if (
    params.search &&
    params.search.trim()
  ) {
    query.set(
      "search",
      params.search.trim()
    );
  }

  if (
    params.status &&
    params.status !== "ALL"
  ) {
    query.set(
      "status",
      params.status
    );
  }

  if (
    params.aging &&
    params.aging !== "ALL"
  ) {
    query.set(
      "aging",
      params.aging
    );
  }

  const queryString =
    query.toString();

  return queryString
    ? `?${queryString}`
    : "";
};

/* =========================================================
   FETCH RECEIVABLES
   ========================================================= */

/**
 * Fetches a paginated list of customer
 * receivables from the server.
 *
 * Filtering and pagination are intentionally
 * performed server-side so the client does not
 * need to load the entire receivables portfolio.
 */
export const fetchReceivables = async (
  params: FetchReceivablesParams = {}
): Promise<ReceivablesResponse> => {
  const queryString =
    buildQueryString(params);

  return request<ReceivablesResponse>(
    `${API_URL}${queryString}`
  );
};

/* =========================================================
   FETCH SINGLE RECEIVABLE
   ========================================================= */

export const fetchReceivableById =
  async (
    id: string
  ): Promise<ReceivableResponse> => {
    if (!id?.trim()) {
      throw new Error(
        "Receivable ID is required."
      );
    }

    return request<ReceivableResponse>(
      `${API_URL}/${encodeURIComponent(
        id
      )}`
    );
  };

/* =========================================================
   CREATE RECEIVABLE
   ========================================================= */

export const createReceivable =
  async (
    input: ReceivableInput
  ): Promise<ReceivableResponse> => {
    return request<ReceivableResponse>(
      API_URL,
      {
        method: "POST",

        body: JSON.stringify(
          input
        ),
      }
    );
  };

/* =========================================================
   UPDATE RECEIVABLE
   ========================================================= */

export const updateReceivable =
  async (
    id: string,
    input: ReceivableInput
  ): Promise<ReceivableResponse> => {
    if (!id?.trim()) {
      throw new Error(
        "Receivable ID is required."
      );
    }

    return request<ReceivableResponse>(
      `${API_URL}/${encodeURIComponent(
        id
      )}`,
      {
        method: "PATCH",

        body: JSON.stringify(
          input
        ),
      }
    );
  };

/* =========================================================
   APPROVE RECEIVABLE
   ========================================================= */

export const approveReceivable =
  async (
    id: string
  ): Promise<ReceivableResponse> => {
    if (!id?.trim()) {
      throw new Error(
        "Receivable ID is required."
      );
    }

    return request<ReceivableResponse>(
      `${API_URL}/${encodeURIComponent(
        id
      )}/approve`,
      {
        method: "PATCH",
      }
    );
  };

/* =========================================================
   RECORD PAYMENT
   ========================================================= */

/**
 * Records a payment against the receivable.
 *
 * The server is responsible for:
 * - validating the payment
 * - preventing overpayment
 * - calculating the remaining balance
 * - updating payment status
 * - synchronising the related invoice
 */
export const recordReceivablePayment =
  async (
    id: string,
    amount: number
  ): Promise<ReceivableResponse> => {
    if (!id?.trim()) {
      throw new Error(
        "Receivable ID is required."
      );
    }

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      throw new Error(
        "Payment amount must be greater than zero."
      );
    }

    return request<ReceivableResponse>(
      `${API_URL}/${encodeURIComponent(
        id
      )}/payment`,
      {
        method: "POST",

        body: JSON.stringify({
          amount,
        }),
      }
    );
  };

/* =========================================================
   DELETE RECEIVABLE
   ========================================================= */

export const deleteReceivable =
  async (
    id: string
  ): Promise<MessageResponse> => {
    if (!id?.trim()) {
      throw new Error(
        "Receivable ID is required."
      );
    }

    return request<MessageResponse>(
      `${API_URL}/${encodeURIComponent(
        id
      )}`,
      {
        method: "DELETE",
      }
    );
  };

/* =========================================================
   PAGINATION HELPERS
   ========================================================= */

/**
 * Normalizes pagination returned by the API.
 *
 * This protects the UI from older API responses
 * that may not yet include pagination metadata.
 */
export const normalizeReceivablePagination =
  (
    response: ReceivablesResponse,
    fallbackPage = 1,
    fallbackPageSize = 25
  ): ReceivablePagination => {
    const pagination =
      response.pagination;

    if (pagination) {
      return {
        page:
          Number.isFinite(
            pagination.page
          ) &&
          pagination.page > 0
            ? pagination.page
            : fallbackPage,

        pageSize:
          Number.isFinite(
            pagination.pageSize
          ) &&
          pagination.pageSize > 0
            ? pagination.pageSize
            : fallbackPageSize,

        total:
          Number.isFinite(
            pagination.total
          ) &&
          pagination.total >= 0
            ? pagination.total
            : response.count ?? 0,

        totalPages:
          Number.isFinite(
            pagination.totalPages
          ) &&
          pagination.totalPages > 0
            ? pagination.totalPages
            : Math.max(
                1,
                Math.ceil(
                  (response.count ?? 0) /
                    fallbackPageSize
                )
              ),
      };
    }

    const total =
      response.count ??
      response.receivables.length;

    return {
      page: fallbackPage,

      pageSize: fallbackPageSize,

      total,

      totalPages: Math.max(
        1,
        Math.ceil(
          total / fallbackPageSize
        )
      ),
    };
  };

/* =========================================================
   SUMMARY HELPERS
   ========================================================= */

/**
 * Returns a safe summary object when the
 * API does not provide summary metadata.
 */
export const normalizeReceivableSummary =
  (
    response: ReceivablesResponse
  ): ReceivableSummary => {
    if (response.summary) {
      return {
        totalInvoiced:
          Number(
            response.summary
              .totalInvoiced
          ) || 0,

        totalOutstanding:
          Number(
            response.summary
              .totalOutstanding
          ) || 0,

        totalCollected:
          Number(
            response.summary
              .totalCollected
          ) || 0,

        totalOverdue:
          Number(
            response.summary
              .totalOverdue
          ) || 0,

        overdueCount:
          Number(
            response.summary
              .overdueCount
          ) || 0,
      };
    }

    const totalInvoiced =
      response.receivables.reduce(
        (
          total,
          receivable
        ) =>
          total +
          Number(
            receivable.amount
          ),
        0
      );

    const totalOutstanding =
      response.receivables.reduce(
        (
          total,
          receivable
        ) =>
          total +
          Number(
            receivable
              .outstandingBalance
          ),
        0
      );

    const totalCollected =
      Math.max(
        0,
        totalInvoiced -
          totalOutstanding
      );

    return {
      totalInvoiced,

      totalOutstanding,

      totalCollected,

      totalOverdue: 0,

      overdueCount: 0,
    };
  };

/* =========================================================
   RECEIVABLE CALCULATIONS
   ========================================================= */

/**
 * Calculates the amount already collected
 * against a receivable.
 */
export const getReceivableCollectedAmount =
  (
    receivable: Receivable
  ): number => {
    const amount =
      Number(
        receivable.amount
      ) || 0;

    const outstanding =
      Number(
        receivable
          .outstandingBalance
      ) || 0;

    return Math.max(
      0,
      amount - outstanding
    );
  };

/**
 * Returns whether a receivable has been
 * fully paid.
 */
export const isReceivablePaid = (
  receivable: Receivable
): boolean => {
  return (
    Number(
      receivable
        .outstandingBalance
    ) <= 0 ||
    receivable.paymentStatus
      .toUpperCase() === "PAID"
  );
};

/**
 * Returns whether a receivable has been
 * partially paid.
 */
export const isReceivablePartiallyPaid =
  (
    receivable: Receivable
  ): boolean => {
    const outstanding =
      Number(
        receivable
          .outstandingBalance
      ) || 0;

    const amount =
      Number(
        receivable.amount
      ) || 0;

    return (
      outstanding > 0 &&
      outstanding < amount
    );
  };

/**
 * Returns whether the receivable is overdue.
 *
 * Fully paid invoices are never considered
 * overdue even when their original due date
 * has passed.
 */
export const isReceivableOverdue = (
  receivable: Receivable,
  referenceDate = new Date()
): boolean => {
  if (
    isReceivablePaid(
      receivable
    )
  ) {
    return false;
  }

  const dueDate =
    new Date(
      receivable.dueDate
    );

  if (
    Number.isNaN(
      dueDate.getTime()
    )
  ) {
    return false;
  }

  return (
    dueDate.getTime() <
    referenceDate.getTime()
  );
};

/**
 * Calculates days overdue.
 */
export const getReceivableDaysOverdue =
  (
    receivable: Receivable,
    referenceDate = new Date()
  ): number => {
    if (
      !isReceivableOverdue(
        receivable,
        referenceDate
      )
    ) {
      return 0;
    }

    const dueDate =
      new Date(
        receivable.dueDate
      );

    const millisecondsPerDay =
      1000 * 60 * 60 * 24;

    return Math.max(
      0,
      Math.floor(
        (
          referenceDate.getTime() -
          dueDate.getTime()
        ) /
          millisecondsPerDay
      )
    );
  };

/* =========================================================
   EFFECTIVE STATUS
   ========================================================= */

/**
 * Resolves the display/accounting status
 * from the current receivable state.
 *
 * Server values remain authoritative.
 * This helper is intended for UI presentation.
 */
export const getEffectiveReceivableStatus =
  (
    receivable: Receivable,
    referenceDate = new Date()
  ): string => {
    const outstanding =
      Number(
        receivable
          .outstandingBalance
      ) || 0;

    const amount =
      Number(
        receivable.amount
      ) || 0;

    if (
      outstanding <= 0 ||
      receivable.paymentStatus
        .toUpperCase() === "PAID"
    ) {
      return "PAID";
    }

    if (
      outstanding > 0 &&
      outstanding < amount
    ) {
      return "PARTIALLY PAID";
    }

    if (
      receivable.status
        .toUpperCase() !==
        "APPROVED"
    ) {
      return "PENDING APPROVAL";
    }

    if (
      isReceivableOverdue(
        receivable,
        referenceDate
      )
    ) {
      return "OVERDUE";
    }

    return "OUTSTANDING";
  };

/* =========================================================
   AGING BUCKET
   ========================================================= */

/**
 * Determines the aging bucket for an
 * outstanding receivable.
 */
export const getReceivableAgingBucket =
  (
    receivable: Receivable,
    referenceDate = new Date()
  ): ReceivableAgingFilter => {
    if (
      isReceivablePaid(
        receivable
      )
    ) {
      return "ALL";
    }

    const dueDate =
      new Date(
        receivable.dueDate
      );

    if (
      Number.isNaN(
        dueDate.getTime()
      )
    ) {
      return "ALL";
    }

    if (
      dueDate.getTime() >=
      referenceDate.getTime()
    ) {
      return "CURRENT";
    }

    const daysOverdue =
      getReceivableDaysOverdue(
        receivable,
        referenceDate
      );

    if (daysOverdue <= 30) {
      return "1-30 DAYS";
    }

    if (daysOverdue <= 60) {
      return "31-60 DAYS";
    }

    if (daysOverdue <= 90) {
      return "61-90 DAYS";
    }

    return "90+ DAYS";
  };

/* =========================================================
   CURRENCY HELPERS
   ========================================================= */

export const formatReceivableCurrency =
  (
    amount: number
  ): string => {
    return new Intl.NumberFormat(
      "en-KE",
      {
        style: "currency",
        currency: "KES",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    ).format(
      Number(amount) || 0
    );
  };

/* =========================================================
   DATE HELPERS
   ========================================================= */

export const formatReceivableDate =
  (
    value: string
  ): string => {
    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "—";
    }

    return new Intl.DateTimeFormat(
      "en-KE",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    ).format(date);
  };

/* =========================================================
   EXPORT
   ========================================================= */

export default {
  fetchReceivables,

  fetchReceivableById,

  createReceivable,

  updateReceivable,

  approveReceivable,

  recordReceivablePayment,

  deleteReceivable,

  normalizeReceivablePagination,

  normalizeReceivableSummary,

  getReceivableCollectedAmount,

  isReceivablePaid,

  isReceivablePartiallyPaid,

  isReceivableOverdue,

  getReceivableDaysOverdue,

  getEffectiveReceivableStatus,

  getReceivableAgingBucket,

  formatReceivableCurrency,

  formatReceivableDate,
};