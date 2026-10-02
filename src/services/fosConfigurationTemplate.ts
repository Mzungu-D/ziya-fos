import { getAuthToken } from "../lib/auth";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAuthToken();

  const response = await fetch(`${API_BASE}${endpoint}`, {
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
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ??
        data?.error ??
        "FOS configuration request failed.",
    );
  }

  return data;
}

export interface TemplateTenant {
  id: string;
  name: string;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  templateVersion: number;
}

export interface TemplateStatus {
  success: boolean;
  source: {
    id: string;
    name: string;
    status: string;
    templateKey: string | null;
    templateVersion: number;
  };
  latestVersion: number;
  tenants: TemplateTenant[];
}

export interface TemplateSnapshot {
  schemaVersion: number;
  sourceOrganizationId: string;
  sourceOrganizationName: string;
  accounts: Array<{
    code: string;
    name: string;
    type: string;
    description: string | null;
    parentCode: string | null;
  }>;
  rolePermissions: Array<{
    role: string;
    permissions: string[];
  }>;
}

export interface Organization {
  id: string;
  name: string;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
}

export async function getTemplateStatus() {
  return request<TemplateStatus>(
    "/api/platform/fos-configuration-template/status",
  );
}

export async function getPlatformOrganizations() {
  return request<{
    success: boolean;
    count: number;
    organizations: Organization[];
  }>("/api/platform/organizations");
}

export async function bootstrapFosTemplate(
  demoOrganizationId: string,
) {
  return request<{
    success: boolean;
    template: TemplateSnapshot;
  }>("/api/platform/fos-configuration-template/bootstrap", {
    method: "POST",
    body: JSON.stringify({ demoOrganizationId }),
  });
}

export async function publishFosTemplate(
  sourceOrganizationId: string,
) {
  return request<{
    success: boolean;
    template: TemplateSnapshot;
  }>("/api/platform/fos-configuration-template/publish", {
    method: "POST",
    body: JSON.stringify({ sourceOrganizationId }),
  });
}

export async function reconcileFosTenants() {
  return request<{
    success: boolean;
    templateVersion: number;
    sourceOrganizationId: string;
    processed: number;
    succeeded: number;
    failed: number;
    skipped: number;
    results: Array<Record<string, unknown>>;
  }>("/api/platform/fos-configuration-template/reconcile", {
    method: "POST",
  });
}
