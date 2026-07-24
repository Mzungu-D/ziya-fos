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

export interface VendorUpdateInput {
  vendorCode?: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  taxNumber?: string;
}

interface VendorsResponse {
  success: boolean;
  count?: number;
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

interface ErrorResponse {
  success?: boolean;
  message?: string;
  error?: string;
}

const API_URL = "/api/vendors";

/* =========================================================
   AUTH TOKEN
========================================================= */

const TOKEN_KEYS = [
  "token",
  "accessToken",
  "access_token",
  "authToken",
] as const;

function getStoredToken(): string | null {
  for (const key of TOKEN_KEYS) {
    const localValue = localStorage.getItem(key);

    if (
      localValue &&
      localValue !== "null" &&
      localValue !== "undefined"
    ) {
      return cleanToken(localValue);
    }

    const sessionValue = sessionStorage.getItem(key);

    if (
      sessionValue &&
      sessionValue !== "null" &&
      sessionValue !== "undefined"
    ) {
      return cleanToken(sessionValue);
    }
  }

  return null;
}

function cleanToken(token: string): string {
  const cleaned = token.trim();

  if (cleaned.toLowerCase().startsWith("bearer ")) {
    return cleaned.slice(7).trim();
  }

  return cleaned;
}

/* =========================================================
   RESPONSE HELPERS
========================================================= */

function getErrorMessage(
  data: unknown,
  status: number
): string {
  if (data && typeof data === "object") {
    const errorData = data as ErrorResponse;

    if (
      typeof errorData.message === "string" &&
      errorData.message.trim()
    ) {
      return errorData.message;
    }

    if (
      typeof errorData.error === "string" &&
      errorData.error.trim()
    ) {
      return errorData.error;
    }
  }

  switch (status) {
    case 400:
      return "Invalid vendor request.";

    case 401:
      return "Your session is invalid or has expired. Please sign in again.";

    case 403:
      return "You do not have permission to perform this action.";

    case 404:
      return "Vendor not found.";

    case 409:
      return "A vendor with these details already exists.";

    case 500:
      return "The server could not process the vendor request.";

    default:
      return `Vendor request failed (${status}).`;
  }
}

async function parseResponse(
  response: Response
): Promise<unknown> {
  const contentType =
    response.headers.get("content-type") ?? "";

  if (response.status === 204) {
    return null;
  }

  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }

  const text = await response.text().catch(() => "");

  return text || null;
}

/* =========================================================
   API REQUEST
========================================================= */

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();

  const headers = new Headers(options.headers);

  headers.set("Accept", "application/json");

  if (
    options.body !== undefined &&
    !(options.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;

  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: "same-origin",
    });
  } catch {
    throw new Error(
      "Unable to connect to Ziya FOS. Check the server connection and try again."
    );
  }

  const data = await parseResponse(response);

  if (!response.ok) {
    throw new Error(
      getErrorMessage(data, response.status)
    );
  }

  return data as T;
}

/* =========================================================
   VALIDATION
========================================================= */

function requireId(id: string): string {
  const value = id.trim();

  if (!value) {
    throw new Error("Vendor ID is required.");
  }

  return encodeURIComponent(value);
}

function validateVendorInput(
  input: VendorInput
): VendorInput {
  const vendorCode = input.vendorCode.trim();
  const name = input.name.trim();

  if (!vendorCode) {
    throw new Error("Vendor code is required.");
  }

  if (!name) {
    throw new Error("Vendor name is required.");
  }

  return {
    vendorCode,
    name,
    email: input.email?.trim() ?? "",
    phoneNumber: input.phoneNumber?.trim() ?? "",
    address: input.address?.trim() ?? "",
    taxNumber: input.taxNumber?.trim() ?? "",
  };
}

/* =========================================================
   GET ALL
========================================================= */

export async function getVendors(): Promise<Vendor[]> {
  const response =
    await request<VendorsResponse>(API_URL);

  if (!Array.isArray(response?.vendors)) {
    return [];
  }

  return response.vendors;
}

/* =========================================================
   GET ONE
========================================================= */

export async function getVendorById(
  id: string
): Promise<Vendor> {
  const vendorId = requireId(id);

  const response =
    await request<VendorResponse>(
      `${API_URL}/${vendorId}`
    );

  if (!response?.vendor) {
    throw new Error(
      "The server returned an invalid vendor response."
    );
  }

  return response.vendor;
}

/* =========================================================
   CREATE
========================================================= */

export async function createVendor(
  input: VendorInput
): Promise<Vendor> {
  const payload = validateVendorInput(input);

  const response =
    await request<VendorResponse>(API_URL, {
      method: "POST",
      body: JSON.stringify(payload),
    });

  if (!response?.vendor) {
    throw new Error(
      "Vendor was not returned by the server."
    );
  }

  return response.vendor;
}

/* =========================================================
   UPDATE
========================================================= */

export async function updateVendor(
  id: string,
  input: VendorUpdateInput
): Promise<Vendor> {
  const vendorId = requireId(id);

  const payload: VendorUpdateInput = {};

  if (input.vendorCode !== undefined) {
    const vendorCode = input.vendorCode.trim();

    if (!vendorCode) {
      throw new Error(
        "Vendor code cannot be empty."
      );
    }

    payload.vendorCode = vendorCode;
  }

  if (input.name !== undefined) {
    const name = input.name.trim();

    if (!name) {
      throw new Error(
        "Vendor name cannot be empty."
      );
    }

    payload.name = name;
  }

  if (input.email !== undefined) {
    payload.email = input.email.trim();
  }

  if (input.phoneNumber !== undefined) {
    payload.phoneNumber =
      input.phoneNumber.trim();
  }

  if (input.address !== undefined) {
    payload.address = input.address.trim();
  }

  if (input.taxNumber !== undefined) {
    payload.taxNumber =
      input.taxNumber.trim();
  }

  const response =
    await request<VendorResponse>(
      `${API_URL}/${vendorId}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      }
    );

  if (!response?.vendor) {
    throw new Error(
      "Updated vendor was not returned by the server."
    );
  }

  return response.vendor;
}

/* =========================================================
   STATUS
========================================================= */

export async function updateVendorStatus(
  id: string,
  status: VendorStatus
): Promise<Vendor> {
  const vendorId = requireId(id);

  if (
    status !== "ACTIVE" &&
    status !== "INACTIVE"
  ) {
    throw new Error("Invalid vendor status.");
  }

  const response =
    await request<VendorResponse>(
      `${API_URL}/${vendorId}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }
    );

  if (!response?.vendor) {
    throw new Error(
      "Updated vendor was not returned by the server."
    );
  }

  return response.vendor;
}

/* =========================================================
   DELETE
========================================================= */

export async function deleteVendor(
  id: string
): Promise<string> {
  const vendorId = requireId(id);

  const response =
    await request<MessageResponse | null>(
      `${API_URL}/${vendorId}`,
      {
        method: "DELETE",
      }
    );

  return (
    response?.message ??
    "Vendor deleted successfully."
  );
}