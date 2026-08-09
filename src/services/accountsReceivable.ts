/* =========================================================
   TYPES
========================================================= */

export interface Receivable {
  id: string;
  invoiceNumber: string;
  customerName: string;
  description: string;
  amount: number;
  outstandingBalance: number;
  dueDate: string;
  paymentStatus: string;
  status: string;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReceivableInput {
  invoiceNumber: string;
  customerName: string;
  description: string;
  amount: number;
  dueDate: string;
}

export interface ReceivablesResponse {
  success: boolean;
  message?: string;
  count?: number;
  receivables: Receivable[];
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
   API
========================================================= */

const API_URL = "/api/accounts-receivable";

/* =========================================================
   AUTH
========================================================= */

import { authenticatedFetch, getAuthToken } from "../lib/auth";

/* =========================================================
   REQUEST
========================================================= */

const request = async <T>(
  url: string,
  options: RequestInit = {}
): Promise<T> => {
  const token = getAuthToken();

  const response = await authenticatedFetch(url, {
    ...options,

    headers: {
      Accept: "application/json",

      ...(options.body
        ? {
            "Content-Type": "application/json",
          }
        : {}),

      ...(token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {}),

      ...options.headers,
    },
  });

  const contentType =
    response.headers.get("content-type") ?? "";

  let data: unknown = null;

  if (contentType.includes("application/json")) {
    data = await response.json().catch(() => null);
  }

  if (!response.ok) {
    let message =
      `Request failed (${response.status})`;

    if (
      data &&
      typeof data === "object" &&
      "message" in data &&
      typeof data.message === "string"
    ) {
      message = data.message;
    }

    if (response.status === 401) {
      message =
        "Your session has expired. Please sign in again.";
    }

    if (response.status === 403) {
      message =
        "You do not have permission to perform this action.";
    }

    if (response.status === 404) {
      message =
        typeof data === "object" &&
        data !== null &&
        "message" in data &&
        typeof data.message === "string"
          ? data.message
          : "The requested receivable was not found.";
    }

    throw new Error(message);
  }

  if (data === null) {
    throw new Error(
      "The server returned an invalid response."
    );
  }

  return data as T;
};

/* =========================================================
   GET ALL
========================================================= */

export const fetchReceivables =
  async (): Promise<ReceivablesResponse> => {
    return request<ReceivablesResponse>(
      API_URL
    );
  };

/* =========================================================
   GET ONE
========================================================= */

export const fetchReceivableById = async (
  id: string
): Promise<ReceivableResponse> => {
  return request<ReceivableResponse>(
    `${API_URL}/${encodeURIComponent(id)}`
  );
};

/* =========================================================
   CREATE
========================================================= */

export const createReceivable = async (
  input: ReceivableInput
): Promise<ReceivableResponse> => {
  return request<ReceivableResponse>(
    API_URL,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
};

/* =========================================================
   UPDATE
========================================================= */

export const updateReceivable = async (
  id: string,
  input: ReceivableInput
): Promise<ReceivableResponse> => {
  return request<ReceivableResponse>(
    `${API_URL}/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
};

/* =========================================================
   APPROVE
========================================================= */

export const approveReceivable = async (
  id: string
): Promise<ReceivableResponse> => {
  return request<ReceivableResponse>(
    `${API_URL}/${encodeURIComponent(id)}/approve`,
    {
      method: "PATCH",
    }
  );
};

/* =========================================================
   RECORD PAYMENT
========================================================= */

export const recordReceivablePayment = async (
  id: string,
  amount: number
): Promise<ReceivableResponse> => {
  return request<ReceivableResponse>(
    `${API_URL}/${encodeURIComponent(id)}/payment`,
    {
      method: "POST",

      body: JSON.stringify({
        amount,
      }),
    }
  );
};

/* =========================================================
   DELETE
========================================================= */

export const deleteReceivable = async (
  id: string
): Promise<MessageResponse> => {
  return request<MessageResponse>(
    `${API_URL}/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    }
  );
};
