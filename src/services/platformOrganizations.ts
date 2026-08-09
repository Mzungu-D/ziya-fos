const API_BASE = import.meta.env.VITE_API_URL ?? "";
import { authenticatedFetch, getAuthToken } from "../lib/auth";

const getToken = getAuthToken;

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  const response = await authenticatedFetch(
    `${API_BASE}${endpoint}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {}),
        ...(options.headers ?? {}),
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ?? "Request failed."
    );
  }

  return data;
}

/* ===========================================================
   TYPES
=========================================================== */

export interface Organization {
  id: string;
  name: string;
  slug: string;
  legalName?: string;
  registrationNumber?: string;
  email?: string;
  phoneNumber?: string;
  country: string;
  currency: string;
  logoUrl?: string;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationListResponse {
  success: boolean;
  count: number;
  organizations: Organization[];
}

/* ===========================================================
   GET ORGANIZATIONS
=========================================================== */

export async function getOrganizations(
  status?: "PENDING" | "ACTIVE" | "SUSPENDED"
) {
  const query = status
    ? `?status=${status}`
    : "";

  return request<OrganizationListResponse>(
    `/api/platform/organizations${query}`
  );
}

/* ===========================================================
   GET SINGLE ORGANIZATION
=========================================================== */

export async function getOrganization(
  organizationId: string
) {
  return request(
    `/api/platform/organizations/${organizationId}`
  );
}

/* ===========================================================
   CREATE ORGANIZATION
=========================================================== */

export async function createOrganization(
  payload: unknown
) {
  return request(
    "/api/platform/organizations",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

/* ===========================================================
   APPROVE
=========================================================== */

export async function approveOrganization(
  organizationId: string
) {
  return request(
    `/api/platform/organizations/${organizationId}/approve`,
    {
      method: "PATCH",
    }
  );
}

/* ===========================================================
   SUSPEND
=========================================================== */

export async function suspendOrganization(
  organizationId: string
) {
  return request(
    `/api/platform/organizations/${organizationId}/suspend`,
    {
      method: "PATCH",
    }
  );
}

/* ===========================================================
   ACTIVATE
=========================================================== */

export async function activateOrganization(
  organizationId: string
) {
  return request(
    `/api/platform/organizations/${organizationId}/activate`,
    {
      method: "PATCH",
    }
  );
}

/* ===========================================================
   DELETE ORGANIZATION
=========================================================== */

export async function deleteOrganization(
  organizationId: string
) {
  return request(
    `/api/platform/organizations/${organizationId}`,
    {
      method: "DELETE",
    }
  );
}
