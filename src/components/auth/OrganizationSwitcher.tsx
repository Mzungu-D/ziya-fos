import { useEffect, useState } from "react";

import { authenticatedFetch, updateTenantSession } from "../../lib/auth";

interface Organization {
  id: string;
  name: string;
  isCurrent: boolean;
}

interface OrganizationsResponse {
  success: boolean;
  organizations?: Organization[];
  message?: string;
}

interface SwitchResponse {
  success: boolean;
  token?: string;
  organization?: unknown;
  message?: string;
}

export default function OrganizationSwitcher() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentId, setCurrentId] = useState("");
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    void authenticatedFetch("/api/organizations")
      .then(async (response) => {
        const data = (await response.json()) as OrganizationsResponse;
        if (!response.ok || !data.success) return;

        const available = data.organizations ?? [];
        setOrganizations(available);
        setCurrentId(available.find((item) => item.isCurrent)?.id ?? "");
      })
      .catch(() => {
        // The dashboard remains usable even if the optional selector fails.
      });
  }, []);

  async function switchOrganization(organizationId: string) {
    if (!organizationId || organizationId === currentId || switching) return;

    try {
      setSwitching(true);
      const response = await authenticatedFetch("/api/organizations/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      const data = (await response.json()) as SwitchResponse;

      if (!response.ok || !data.success || !data.token || !data.organization) {
        throw new Error(data.message || "Unable to switch organization.");
      }

      updateTenantSession(data.token, data.organization);
      window.location.assign("/dashboard");
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Unable to switch organization."
      );
      setCurrentId(currentId);
    } finally {
      setSwitching(false);
    }
  }

  if (organizations.length < 2) return null;

  return (
    <label className="mb-4 flex items-center justify-end gap-2 text-sm text-[#666B84]">
      Workspace
      <select
        value={currentId}
        disabled={switching}
        onChange={(event) => void switchOrganization(event.target.value)}
        className="rounded-lg border border-[#ECECF3] bg-white px-3 py-2 text-[#20243A] outline-none disabled:opacity-60"
      >
        {organizations.map((organization) => (
          <option key={organization.id} value={organization.id}>
            {organization.name}
          </option>
        ))}
      </select>
    </label>
  );
}
