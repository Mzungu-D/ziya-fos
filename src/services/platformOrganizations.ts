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
          ? { Authorization: `Bearer ${token}` }
          : {}),
        ...(options.headers ?? {}),
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message ?? "Request failed.");
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
  taxNumber?: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  country: string;
  currency: string;
  logoUrl?: string;
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED";
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember {
  id: string;
  userId: string;
  role: string;
  isActive: boolean;
  isDefault: boolean;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    phoneNumber?: string;
    lastLoginAt?: string;
  };
}

export interface OrganizationDetails extends Organization {
  members: OrganizationMember[];
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
  status?: "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED"
) {
  const query = status ? `?status=${status}` : "";
  return request<OrganizationListResponse>(
    `/api/platform/organizations${query}`
  );
}

/* ===========================================================
   GET SINGLE ORGANIZATION (with members)
=========================================================== */

export async function getOrganization(organizationId: string) {
  return request<{
    success: boolean;
    organization: OrganizationDetails;
  }>(`/api/platform/organizations/${organizationId}`);
}

/* ===========================================================
   UPDATE ORGANIZATION
=========================================================== */

export async function updateOrganization(
  organizationId: string,
  data: {
    name?: string;
    legalName?: string;
    registrationNumber?: string;
    taxNumber?: string;
    email?: string;
    phoneNumber?: string;
    address?: string;
    currency?: string;
    logoUrl?: string;
  }
) {
  return request<{
    success: boolean;
    organization: Organization;
  }>(`/api/platform/organizations/${organizationId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/* ===========================================================
   CREATE ORGANIZATION
=========================================================== */

export async function createOrganization(payload: unknown) {
  return request(`/api/platform/organizations`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* ===========================================================
   APPROVE ORGANIZATION
   Transition: PENDING → ACTIVE
=========================================================== */

export async function approveOrganization(organizationId: string) {
  return request(
    `/api/platform/organizations/${organizationId}/approve`,
    { method: "PATCH" }
  );
}

/* ===========================================================
   REJECT ORGANIZATION
   Transition: PENDING → REJECTED
=========================================================== */

export async function rejectOrganization(
  organizationId: string,
  reason?: string
) {
  return request(
    `/api/platform/organizations/${organizationId}/reject`,
    {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    }
  );
}

/* ===========================================================
   SUSPEND ORGANIZATION
   Transition: ACTIVE → SUSPENDED
=========================================================== */

export async function suspendOrganization(organizationId: string) {
  return request(
    `/api/platform/organizations/${organizationId}/suspend`,
    { method: "PATCH" }
  );
}

/* ===========================================================
   ACTIVATE ORGANIZATION
   Transition: SUSPENDED → ACTIVE
=========================================================== */

export async function activateOrganization(organizationId: string) {
  return request(
    `/api/platform/organizations/${organizationId}/activate`,
    { method: "PATCH" }
  );
}

/* ===========================================================
   DELETE ORGANIZATION
=========================================================== */

export async function deleteOrganization(organizationId: string) {
  return request(
    `/api/platform/organizations/${organizationId}`,
    { method: "DELETE" }
  );
}