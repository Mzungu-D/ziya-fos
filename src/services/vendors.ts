export type VendorStatus = "ACTIVE" | "INACTIVE";

export interface Vendor {
  id: string;
  vendorCode: string;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  address: string | null;
  taxNumber: string | null;
  status: VendorStatus;
  createdAt: string;
  updatedAt: string;
}

export interface VendorInput {
  vendorCode: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  taxNumber?: string;
}

interface VendorsResponse {
  success: boolean;
  count: number;
  vendors: Vendor[];
}

interface VendorResponse {
  success: boolean;
  message?: string;
  vendor: Vendor;
}

interface MessageResponse {
  success: boolean;
  message?: string;
}

const API_URL = "/api/vendors";

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
   API REQUEST
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
   GET ALL VENDORS
========================================================= */

export const getVendors =
  async (): Promise<Vendor[]> => {
    const response =
      await request<VendorsResponse>(API_URL);

    return response.vendors;
  };

/* =========================================================
   GET SINGLE VENDOR
========================================================= */

export const getVendorById = async (
  id: string
): Promise<Vendor> => {
  const response =
    await request<VendorResponse>(
      `${API_URL}/${encodeURIComponent(id)}`
    );

  return response.vendor;
};

/* =========================================================
   CREATE VENDOR
========================================================= */

export const createVendor = async (
  input: VendorInput
): Promise<Vendor> => {
  const response =
    await request<VendorResponse>(API_URL, {
      method: "POST",

      body: JSON.stringify(input),
    });

  return response.vendor;
};

/* =========================================================
   UPDATE VENDOR
========================================================= */

export const updateVendor = async (
  id: string,
  input: VendorInput
): Promise<Vendor> => {
  const response =
    await request<VendorResponse>(
      `${API_URL}/${encodeURIComponent(id)}`,
      {
        method: "PATCH",

        body: JSON.stringify(input),
      }
    );

  return response.vendor;
};

/* =========================================================
   UPDATE STATUS
========================================================= */

export const updateVendorStatus = async (
  id: string,
  status: VendorStatus
): Promise<Vendor> => {
  const response =
    await request<VendorResponse>(
      `${API_URL}/${encodeURIComponent(id)}/status`,
      {
        method: "PATCH",

        body: JSON.stringify({
          status,
        }),
      }
    );

  return response.vendor;
};

/* =========================================================
   DELETE VENDOR
========================================================= */

export const deleteVendor = async (
  id: string
): Promise<string> => {
  const response =
    await request<MessageResponse>(
      `${API_URL}/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
      }
    );

  return (
    response.message ??
    "Vendor deleted successfully"
  );
};