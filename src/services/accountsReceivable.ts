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

const API_URL = "/api/accounts-receivable";

/* =========================================================
   AUTH
========================================================= */

const getAuthToken = (): string | null => {
  return (
    localStorage.getItem("token") ??
    sessionStorage.getItem("token")
  );
};

/* =========================================================
   REQUEST
========================================================= */

const request = async <T>(
  url: string,
  options: RequestInit = {}
): Promise<T> => {
  const token = getAuthToken();

  const response = await fetch(url, {
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

  const data: unknown = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    if (
      data &&
      typeof data === "object" &&
      "message" in data &&
      typeof data.message === "string"
    ) {
      message = data.message;
    }

    throw new Error(message);
  }

  return data as T;
};

/* =========================================================
   GET RECEIVABLES
========================================================= */

export const fetchReceivables =
  async (): Promise<ReceivablesResponse> => {
    return request<ReceivablesResponse>(
      API_URL
    );
  };

/* =========================================================
   GET RECEIVABLE
========================================================= */

export const fetchReceivableById = async (
  id: string
): Promise<ReceivableResponse> => {
  return request<ReceivableResponse>(
    `${API_URL}/${encodeURIComponent(id)}`
  );
};

/* =========================================================
   CREATE RECEIVABLE
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
   UPDATE RECEIVABLE
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
   APPROVE RECEIVABLE
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
   DELETE RECEIVABLE
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