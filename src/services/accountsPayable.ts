/* =========================================================
   ACCOUNTS PAYABLE TYPES
========================================================= */

export interface PayableVendor {
  id: string;
  name: string;
  vendorCode?: string;
  status?: string;
}

export interface Payable {
  id: string;
  invoiceNumber: string;
  vendorId: string;
  description: string;
  amount: number;
  outstandingBalance: number;
  dueDate: string;
  paymentStatus: string;
  status: string;
  approvedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
  vendor?: PayableVendor;
}

export interface CreatePayableInput {
  invoiceNumber: string;
  vendorId: string;
  description: string;
  amount: number;
  dueDate: string;
}

export interface PayablesResponse {
  success: boolean;
  count?: number;
  payables: Payable[];
  message?: string;
}

export interface PayableResponse {
  success: boolean;
  payable: Payable;
  message?: string;
}

export interface DeletePayableResponse {
  success: boolean;
  message: string;
}

/* =========================================================
   API ENDPOINT
========================================================= */

const ACCOUNTS_PAYABLE_ENDPOINT =
  "/api/accounts-payable";

/* =========================================================
   AUTHENTICATION
========================================================= */

import { authenticatedFetch, getAuthToken } from "../lib/auth";

/* =========================================================
   API RESPONSE HANDLER
========================================================= */

const handleResponse = async <T>(
  response: Response
): Promise<T> => {
  const data: unknown = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "message" in data &&
      typeof data.message === "string"
        ? data.message
        : `Request failed (${response.status})`;

    throw new Error(message);
  }

  return data as T;
};

/* =========================================================
   GET ALL PAYABLES
========================================================= */

export const fetchPayables =
  async (): Promise<PayablesResponse> => {
    const token = getAuthToken();

    const response = await authenticatedFetch(
      ACCOUNTS_PAYABLE_ENDPOINT,
      {
        method: "GET",

        headers: {
          Accept: "application/json",

          ...(token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {}),
        },
      }
    );

    return handleResponse<PayablesResponse>(
      response
    );
  };

/* =========================================================
   GET SINGLE PAYABLE
========================================================= */

export const fetchPayableById = async (
  id: string
): Promise<PayableResponse> => {
  if (!id.trim()) {
    throw new Error(
      "Payable ID is required."
    );
  }

  const token = getAuthToken();

  const response = await authenticatedFetch(
    `${ACCOUNTS_PAYABLE_ENDPOINT}/${encodeURIComponent(
      id
    )}`,
    {
      method: "GET",

      headers: {
        Accept: "application/json",

        ...(token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {}),
      },
    }
  );

  return handleResponse<PayableResponse>(
    response
  );
};

/* =========================================================
   CREATE PAYABLE
========================================================= */

export const createPayable = async (
  input: CreatePayableInput
): Promise<PayableResponse> => {
  const token = getAuthToken();

  const response = await authenticatedFetch(
    ACCOUNTS_PAYABLE_ENDPOINT,
    {
      method: "POST",

      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",

        ...(token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {}),
      },

      body: JSON.stringify({
        invoiceNumber:
          input.invoiceNumber.trim(),

        vendorId:
          input.vendorId,

        description:
          input.description.trim(),

        amount:
          input.amount,

        dueDate:
          input.dueDate,
      }),
    }
  );

  return handleResponse<PayableResponse>(
    response
  );
};

/* =========================================================
   APPROVE PAYABLE
========================================================= */

export const approvePayable = async (
  id: string
): Promise<PayableResponse> => {
  if (!id.trim()) {
    throw new Error(
      "Payable ID is required."
    );
  }

  const token = getAuthToken();

  const response = await authenticatedFetch(
    `${ACCOUNTS_PAYABLE_ENDPOINT}/${encodeURIComponent(
      id
    )}/approve`,
    {
      method: "PATCH",

      headers: {
        Accept: "application/json",

        ...(token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {}),
      },
    }
  );

  return handleResponse<PayableResponse>(
    response
  );
};

/* =========================================================
   RECORD SUPPLIER PAYMENT
========================================================= */

export const recordPayablePayment = async (
  id: string,
  paymentAmount: number
): Promise<PayableResponse> => {
  if (!id.trim()) {
    throw new Error(
      "Payable ID is required."
    );
  }

  if (
    !Number.isFinite(paymentAmount) ||
    paymentAmount <= 0
  ) {
    throw new Error(
      "Payment amount must be greater than zero."
    );
  }

  const token = getAuthToken();

  const response = await authenticatedFetch(
    `${ACCOUNTS_PAYABLE_ENDPOINT}/${encodeURIComponent(
      id
    )}/payment`,
    {
      method: "PATCH",

      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",

        ...(token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {}),
      },

      body: JSON.stringify({
        paymentAmount,
      }),
    }
  );

  return handleResponse<PayableResponse>(
    response
  );
};

/* =========================================================
   DELETE PAYABLE
========================================================= */

export const deletePayable = async (
  id: string
): Promise<DeletePayableResponse> => {
  if (!id.trim()) {
    throw new Error(
      "Payable ID is required."
    );
  }

  const token = getAuthToken();

  const response = await authenticatedFetch(
    `${ACCOUNTS_PAYABLE_ENDPOINT}/${encodeURIComponent(
      id
    )}`,
    {
      method: "DELETE",

      headers: {
        Accept: "application/json",

        ...(token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {}),
      },
    }
  );

  return handleResponse<DeletePayableResponse>(
    response
  );
};
