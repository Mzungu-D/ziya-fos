import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Building2,
  Users,
  ShieldCheck,
  Bell,
  Activity,
  Save,
  RefreshCw,
  LogOut,
  UserPlus,
  CheckCircle2,
  XCircle,
  Lock,
  Monitor,
  Smartphone,
  Globe2,
  AlertTriangle,
} from "lucide-react";

import {
  authenticatedFetch,
} from "../lib/auth";

/* =========================================================
   TYPES
========================================================= */

type SettingsTab =
  | "organization"
  | "users"
  | "security"
  | "notifications"
  | "audit";

type Organization = {
  id: string;
  name: string;
  slug: string;
  legalName?: string | null;
  registrationNumber?: string | null;
  taxNumber?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
  country?: string | null;
  currency?: string | null;
  logoUrl?: string | null;
  status?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type TenantUser = {
  id: string;
  membershipId: string;
  name: string;
  email: string;
  phoneNumber?: string | null;
  role: string;
  permissions: string[];
  membershipActive: boolean;
  accountActive: boolean;
  isDefault: boolean;
  joinedAt: string;
  membershipUpdatedAt: string;
  createdAt: string;
};

type SessionRecord = {
  id: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  isActive: boolean;
  rememberMe: boolean;
  current?: boolean;
};

type AuditRecord = {
  id: string;
  action: string;
  module: string;
  user: string;
  details?: string | null;
  createdAt: string;
};

type OrganizationResponse = {
  success: boolean;
  organization: Organization;
};

type UsersResponse = {
  success: boolean;
  users: TenantUser[];
};

type SessionsResponse = {
  success: boolean;
  sessions: SessionRecord[];
};

type AuditResponse = {
  success: boolean;
  auditLogs: AuditRecord[];
};

/* =========================================================
   API HELPER
========================================================= */

const apiRequest = async (
  url: string,
  options: RequestInit = {}
) => {
  /*
   * authenticatedFetch merges request headers using normal
   * object spreading. Always normalize HeadersInit to a plain
   * object before passing it to the authentication layer.
   * This guarantees JSON request bodies reach Express with the
   * correct Content-Type header.
   */
  const headers: Record<string, string> = {};

  if (options.headers instanceof Headers) {
    options.headers.forEach((value, key) => {
      headers[key] = value;
    });
  } else if (Array.isArray(options.headers)) {
    for (const [key, value] of options.headers) {
      headers[key] = value;
    }
  } else if (options.headers) {
    Object.assign(headers, options.headers);
  }

  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers['Content-Type'] &&
    !headers['content-type']
  ) {
    headers['Content-Type'] = 'application/json';
  }

  const response =
    await authenticatedFetch(
      url,
      {
        ...options,
        headers,
      }
    );

  const contentType =
    response.headers.get('content-type');

  let data: unknown = null;

  if (contentType?.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    data = text || null;
  }

  if (!response.ok) {
    const errorData =
      data && typeof data === 'object'
        ? (data as Record<string, unknown>)
        : null;

    const message =
      typeof errorData?.message === 'string'
        ? errorData.message
        : `Request failed with status ${response.status}`;

    throw new Error(message);
  }

  return data;
};

/* =========================================================
   HELPERS
========================================================= */

const formatDateTime = (
  value?: string
) => {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleString(
    "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  );
};

const formatRole = (
  role: string
) =>
  role
    .replace(
      /_/g,
      " "
    )
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );

const getDeviceIcon = (
  userAgent?: string | null
) => {
  const value =
    userAgent?.toLowerCase() ||
    "";

  if (
    value.includes(
      "mobile"
    ) ||
    value.includes(
      "android"
    ) ||
    value.includes(
      "iphone"
    )
  ) {
    return Smartphone;
  }

  return Monitor;
};

/* =========================================================
   COMPONENT
========================================================= */

export default function Settings() {
  const [activeTab, setActiveTab] =
    useState<SettingsTab>(
      "organization"
    );

  const [organization, setOrganization] =
    useState<Organization | null>(
      null
    );

  const [users, setUsers] =
    useState<TenantUser[]>(
      []
    );

  const [sessions, setSessions] =
    useState<SessionRecord[]>(
      []
    );

  const [auditLogs, setAuditLogs] =
    useState<AuditRecord[]>(
      []
    );

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [showAddUser, setShowAddUser] =
    useState(false);

  const [newUser, setNewUser] =
    useState({
      name: "",
      email: "",
      phoneNumber: "",
      role: "FINANCE_USER",
    });

  const [organizationForm, setOrganizationForm] =
    useState({
      name: "",
      legalName: "",
      registrationNumber: "",
      taxNumber: "",
      email: "",
      phoneNumber: "",
      address: "",
      country: "Kenya",
      currency: "KES",
    });

  /* =======================================================
     LOAD ORGANIZATION
  ======================================================= */

  const loadOrganization =
    async () => {
      const result =
        (await apiRequest(
          "/api/settings/organization"
        )) as OrganizationResponse;

      setOrganization(
        result.organization
      );

      setOrganizationForm({
        name:
          result.organization.name ||
          "",
        legalName:
          result.organization
            .legalName ||
          "",
        registrationNumber:
          result.organization
            .registrationNumber ||
          "",
        taxNumber:
          result.organization
            .taxNumber ||
          "",
        email:
          result.organization.email ||
          "",
        phoneNumber:
          result.organization
            .phoneNumber ||
          "",
        address:
          result.organization.address ||
          "",
        country:
          result.organization.country ||
          "Kenya",
        currency:
          result.organization.currency ||
          "KES",
      });
    };

  /* =======================================================
     LOAD USERS
  ======================================================= */

  const loadUsers =
    async () => {
      const result =
        (await apiRequest(
          "/api/users"
        )) as UsersResponse;

      setUsers(
        result.users || []
      );
    };

  /* =======================================================
     LOAD SECURITY SESSIONS
  ======================================================= */

  const loadSessions =
    async () => {
      const result =
        (await apiRequest(
          "/api/settings/security/sessions"
        )) as SessionsResponse;

      setSessions(
        result.sessions || []
      );
    };

  /* =======================================================
     LOAD AUDIT LOG
  ======================================================= */

  const loadAuditLogs =
    async () => {
      const result =
        (await apiRequest(
          "/api/settings/audit"
        )) as AuditResponse;

      setAuditLogs(
        result.auditLogs || []
      );
    };

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  const loadAll =
    async () => {
      setLoading(true);
      setError("");

      const results =
        await Promise.allSettled([
          loadOrganization(),
          loadUsers(),
          loadSessions(),
          loadAuditLogs(),
        ]);

      const failures =
        results.filter(
          (result) =>
            result.status ===
            "rejected"
        );

      if (failures.length > 0) {
        console.error(
          "TENANT SETTINGS LOAD ERRORS:",
          failures
        );

        const firstFailure =
          failures[0];

        if (
          firstFailure &&
          firstFailure.status ===
            "rejected"
        ) {
          setError(
            firstFailure.reason instanceof
              Error
              ? firstFailure.reason.message
              : "Some settings could not be loaded."
          );
        }
      }

      setLoading(false);
    };

  useEffect(() => {
    loadAll();
  }, []);

  /* =======================================================
     SAVE ORGANIZATION
  ======================================================= */

  const saveOrganization =
    async () => {
      try {
        setSaving(true);
        setError("");
        setSuccess("");

        const result =
          (await apiRequest(
            "/api/settings/organization",
            {
              method: "PATCH",
              body:
                JSON.stringify(
                  organizationForm
                ),
            }
          )) as OrganizationResponse;

        setOrganization(
          result.organization
        );

        setSuccess(
          "Organization settings saved successfully."
        );
      } catch (err: any) {
        console.error(
          "SAVE ORGANIZATION ERROR:",
          err
        );

        setError(
          err?.message ||
            "Failed to save organization settings."
        );
      } finally {
        setSaving(false);
      }
    };

  /* =======================================================
     ADD USER
  ======================================================= */

  const addUser =
    async () => {
      if (
        !newUser.name.trim() ||
        !newUser.email.trim()
      ) {
        setError(
          "Name and email are required."
        );
        return;
      }

      try {
        setSaving(true);
        setError("");
        setSuccess("");

        await apiRequest(
          "/api/users",
          {
            method: "POST",
            body:
              JSON.stringify({
                name:
                  newUser.name.trim(),
                email:
                  newUser.email
                    .trim()
                    .toLowerCase(),
                phoneNumber:
                  newUser.phoneNumber
                    .trim() ||
                  undefined,
                role:
                  newUser.role,
              }),
          }
        );

        setNewUser({
          name: "",
          email: "",
          phoneNumber: "",
          role: "FINANCE_USER",
        });

        setShowAddUser(
          false
        );

        await loadUsers();

        setSuccess(
          "User added successfully."
        );
      } catch (err: any) {
        console.error(
          "ADD USER ERROR:",
          err
        );

        setError(
          err?.message ||
            "Failed to add user."
        );
      } finally {
        setSaving(false);
      }
    };

  /* =======================================================
     REVOKE SESSION
  ======================================================= */

  const revokeSession =
    async (
      sessionId: string
    ) => {
      try {
        setError("");
        setSuccess("");

        await apiRequest(
          `/api/settings/security/sessions/${sessionId}`,
          {
            method: "DELETE",
          }
        );

        await loadSessions();

        setSuccess(
          "Session revoked successfully."
        );
      } catch (err: any) {
        console.error(
          "REVOKE SESSION ERROR:",
          err
        );

        setError(
          err?.message ||
            "Failed to revoke session."
        );
      }
    };

  /* =======================================================
     REVOKE OTHER SESSIONS
  ======================================================= */

  const revokeOtherSessions =
    async () => {
      try {
        setError("");
        setSuccess("");

        await apiRequest(
          "/api/settings/security/sessions",
          {
            method: "DELETE",
          }
        );

        await loadSessions();

        setSuccess(
          "All other sessions have been signed out."
        );
      } catch (err: any) {
        console.error(
          "REVOKE OTHER SESSIONS ERROR:",
          err
        );

        setError(
          err?.message ||
            "Failed to sign out other sessions."
        );
      }
    };

  /* =======================================================
     SUMMARY
  ======================================================= */

  const activeUsers =
    useMemo(
      () =>
        users.filter(
          (user) =>
            user.membershipActive &&
            user.accountActive
        ).length,
      [users]
    );

  const activeSessions =
    useMemo(
      () =>
        sessions.filter(
          (session) =>
            session.isActive
        ).length,
      [sessions]
    );

  /* =======================================================
     SIDEBAR
  ======================================================= */

  const tabs: {
    id: SettingsTab;
    label: string;
    description: string;
    icon: typeof Building2;
  }[] = [
    {
      id: "organization",
      label: "Organization",
      description:
        "Company information and defaults",
      icon: Building2,
    },
    {
      id: "users",
      label: "Users & Access",
      description:
        "Manage tenant users and permissions",
      icon: Users,
    },
    {
      id: "security",
      label: "Security",
      description:
        "Sessions and security controls",
      icon: ShieldCheck,
    },
    {
      id: "notifications",
      label: "Notifications",
      description:
        "Tenant notification preferences",
      icon: Bell,
    },
    {
      id: "audit",
      label: "Audit Log",
      description:
        "Activity inside this organization",
      icon: Activity,
    },
  ];

  /* =======================================================
     RENDER
  ======================================================= */

  if (loading) {
    return (
      <div className="min-h-full p-8 bg-[#F7F8FC]">
        <div className="flex items-center gap-3 text-[#666B84]">
          <RefreshCw
            className="animate-spin"
            size={20}
          />
          Loading tenant settings...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#F7F8FC] p-8 text-[#20243A]">
      {/* HEADER */}

      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          Settings
        </h1>

        <p className="mt-2 text-[#666B84]">
          Manage your organization's FOS
          configuration, users and security.
        </p>
      </div>

      {/* ALERTS */}

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle
            size={18}
            className="mt-0.5 shrink-0"
          />

          <span>{error}</span>

          <button
            type="button"
            className="ml-auto font-semibold"
            onClick={() =>
              setError("")
            }
          >
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          <CheckCircle2
            size={18}
            className="mt-0.5 shrink-0"
          />

          <span>{success}</span>

          <button
            type="button"
            className="ml-auto font-semibold"
            onClick={() =>
              setSuccess("")
            }
          >
            ×
          </button>
        </div>
      )}

      {/* SUMMARY */}

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[#E6E8F0] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#F3F0FF] p-3">
              <Building2
                size={20}
                className="text-[#20243A]"
              />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8FA5]">
                Organization
              </p>

              <p className="mt-1 font-semibold">
                {organization?.name ||
                  "Organization"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E6E8F0] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#F3F0FF] p-3">
              <Users
                size={20}
                className="text-[#20243A]"
              />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8FA5]">
                Active users
              </p>

              <p className="mt-1 text-xl font-bold">
                {activeUsers}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E6E8F0] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#F3F0FF] p-3">
              <ShieldCheck
                size={20}
                className="text-[#20243A]"
              />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8FA5]">
                Active sessions
              </p>

              <p className="mt-1 text-xl font-bold">
                {activeSessions}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN SETTINGS */}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* NAVIGATION */}

        <div className="h-fit rounded-2xl border border-[#E6E8F0] bg-white p-3 shadow-sm">
          {tabs.map(
            (tab) => {
              const Icon =
                tab.icon;

              const active =
                activeTab ===
                tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() =>
                    setActiveTab(
                      tab.id
                    )
                  }
                  className={`mb-1 flex w-full items-start gap-3 rounded-xl px-4 py-3 text-left transition ${
                    active
                      ? "bg-[#20243A] text-white"
                      : "text-[#555B72] hover:bg-[#F5F6FA]"
                  }`}
                >
                  <Icon
                    size={19}
                    className="mt-0.5 shrink-0"
                  />

                  <span>
                    <span className="block text-sm font-semibold">
                      {tab.label}
                    </span>

                    <span
                      className={`mt-0.5 block text-xs ${
                        active
                          ? "text-white/70"
                          : "text-[#8A8FA5]"
                      }`}
                    >
                      {
                        tab.description
                      }
                    </span>
                  </span>
                </button>
              );
            }
          )}
        </div>

        {/* CONTENT */}

        <div className="min-w-0">
          {/* ORGANIZATION */}

          {activeTab ===
            "organization" && (
            <section className="rounded-2xl border border-[#E6E8F0] bg-white shadow-sm">
              <div className="border-b border-[#E6E8F0] p-6">
                <h2 className="text-xl font-bold">
                  Organization
                </h2>

                <p className="mt-1 text-sm text-[#666B84]">
                  Manage the information and
                  defaults for this organization.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-5 p-6 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">
                    Organization name
                  </span>

                  <input
                    value={
                      organizationForm.name
                    }
                    onChange={(event) =>
                      setOrganizationForm(
                        (current) => ({
                          ...current,
                          name:
                            event.target
                              .value,
                        })
                      )
                    }
                    className="w-full rounded-xl border border-[#DDE0EA] px-4 py-3 outline-none focus:border-[#20243A]"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">
                    Legal name
                  </span>

                  <input
                    value={
                      organizationForm.legalName
                    }
                    onChange={(event) =>
                      setOrganizationForm(
                        (current) => ({
                          ...current,
                          legalName:
                            event.target
                              .value,
                        })
                      )
                    }
                    className="w-full rounded-xl border border-[#DDE0EA] px-4 py-3 outline-none focus:border-[#20243A]"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">
                    Registration number
                  </span>

                  <input
                    value={
                      organizationForm.registrationNumber
                    }
                    onChange={(event) =>
                      setOrganizationForm(
                        (current) => ({
                          ...current,
                          registrationNumber:
                            event.target
                              .value,
                        })
                      )
                    }
                    className="w-full rounded-xl border border-[#DDE0EA] px-4 py-3 outline-none focus:border-[#20243A]"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">
                    Tax number
                  </span>

                  <input
                    value={
                      organizationForm.taxNumber
                    }
                    onChange={(event) =>
                      setOrganizationForm(
                        (current) => ({
                          ...current,
                          taxNumber:
                            event.target
                              .value,
                        })
                      )
                    }
                    className="w-full rounded-xl border border-[#DDE0EA] px-4 py-3 outline-none focus:border-[#20243A]"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">
                    Email
                  </span>

                  <input
                    type="email"
                    value={
                      organizationForm.email
                    }
                    onChange={(event) =>
                      setOrganizationForm(
                        (current) => ({
                          ...current,
                          email:
                            event.target
                              .value,
                        })
                      )
                    }
                    className="w-full rounded-xl border border-[#DDE0EA] px-4 py-3 outline-none focus:border-[#20243A]"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">
                    Phone number
                  </span>

                  <input
                    value={
                      organizationForm.phoneNumber
                    }
                    onChange={(event) =>
                      setOrganizationForm(
                        (current) => ({
                          ...current,
                          phoneNumber:
                            event.target
                              .value,
                        })
                      )
                    }
                    className="w-full rounded-xl border border-[#DDE0EA] px-4 py-3 outline-none focus:border-[#20243A]"
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-semibold">
                    Address
                  </span>

                  <textarea
                    value={
                      organizationForm.address
                    }
                    onChange={(event) =>
                      setOrganizationForm(
                        (current) => ({
                          ...current,
                          address:
                            event.target
                              .value,
                        })
                      )
                    }
                    rows={3}
                    className="w-full rounded-xl border border-[#DDE0EA] px-4 py-3 outline-none focus:border-[#20243A]"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">
                    Country
                  </span>

                  <select
                    value={
                      organizationForm.country
                    }
                    onChange={(event) =>
                      setOrganizationForm(
                        (current) => ({
                          ...current,
                          country:
                            event.target
                              .value,
                        })
                      )
                    }
                    className="w-full rounded-xl border border-[#DDE0EA] bg-white px-4 py-3 outline-none focus:border-[#20243A]"
                  >
                    <option value="Kenya">
                      Kenya
                    </option>
                    <option value="Uganda">
                      Uganda
                    </option>
                    <option value="Tanzania">
                      Tanzania
                    </option>
                    <option value="Rwanda">
                      Rwanda
                    </option>
                    <option value="South Africa">
                      South Africa
                    </option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">
                    Currency
                  </span>

                  <select
                    value={
                      organizationForm.currency
                    }
                    onChange={(event) =>
                      setOrganizationForm(
                        (current) => ({
                          ...current,
                          currency:
                            event.target
                              .value,
                        })
                      )
                    }
                    className="w-full rounded-xl border border-[#DDE0EA] bg-white px-4 py-3 outline-none focus:border-[#20243A]"
                  >
                    <option value="KES">
                      KES — Kenyan Shilling
                    </option>
                    <option value="UGX">
                      UGX — Ugandan Shilling
                    </option>
                    <option value="TZS">
                      TZS — Tanzanian Shilling
                    </option>
                    <option value="RWF">
                      RWF — Rwandan Franc
                    </option>
                    <option value="USD">
                      USD — US Dollar
                    </option>
                  </select>
                </label>
              </div>

              <div className="flex justify-end border-t border-[#E6E8F0] p-6">
                <button
                  type="button"
                  disabled={saving}
                  onClick={
                    saveOrganization
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-[#20243A] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? (
                    <RefreshCw
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <Save
                      size={17}
                    />
                  )}

                  Save changes
                </button>
              </div>
            </section>
          )}

          {/* USERS */}

          {activeTab ===
            "users" && (
            <section className="rounded-2xl border border-[#E6E8F0] bg-white shadow-sm">
              <div className="flex flex-col gap-4 border-b border-[#E6E8F0] p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold">
                    Users & Access
                  </h2>

                  <p className="mt-1 text-sm text-[#666B84]">
                    Manage users belonging to this
                    organization.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowAddUser(
                      true
                    )
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#20243A] px-4 py-3 text-sm font-semibold text-white"
                >
                  <UserPlus
                    size={17}
                  />
                  Add user
                </button>
              </div>

              {showAddUser && (
                <div className="border-b border-[#E6E8F0] bg-[#F9FAFC] p-6">
                  <h3 className="font-semibold">
                    Add organization user
                  </h3>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <input
                      placeholder="Full name"
                      value={
                        newUser.name
                      }
                      onChange={(event) =>
                        setNewUser(
                          (current) => ({
                            ...current,
                            name:
                              event.target
                                .value,
                          })
                        )
                      }
                      className="rounded-xl border border-[#DDE0EA] bg-white px-4 py-3"
                    />

                    <input
                      type="email"
                      placeholder="Email address"
                      value={
                        newUser.email
                      }
                      onChange={(event) =>
                        setNewUser(
                          (current) => ({
                            ...current,
                            email:
                              event.target
                                .value,
                          })
                        )
                      }
                      className="rounded-xl border border-[#DDE0EA] bg-white px-4 py-3"
                    />

                    <input
                      placeholder="Phone number"
                      value={
                        newUser.phoneNumber
                      }
                      onChange={(event) =>
                        setNewUser(
                          (current) => ({
                            ...current,
                            phoneNumber:
                              event.target
                                .value,
                          })
                        )
                      }
                      className="rounded-xl border border-[#DDE0EA] bg-white px-4 py-3"
                    />

                    <select
                      value={
                        newUser.role
                      }
                      onChange={(event) =>
                        setNewUser(
                          (current) => ({
                            ...current,
                            role:
                              event.target
                                .value,
                          })
                        )
                      }
                      className="rounded-xl border border-[#DDE0EA] bg-white px-4 py-3"
                    >
                      <option value="FINANCE_USER">
                        Finance User
                      </option>
                      <option value="FINANCE_MANAGER">
                        Finance Manager
                      </option>
                      <option value="AUDITOR">
                        Auditor
                      </option>
                      <option value="PROCUREMENT_OFFICER">
                        Procurement Officer
                      </option>
                      <option value="CUSTOM">
                        Custom
                      </option>
                    </select>
                  </div>

                  <div className="mt-4 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setShowAddUser(
                          false
                        )
                      }
                      className="rounded-xl border border-[#DDE0EA] px-4 py-2.5 text-sm font-semibold"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={
                        addUser
                      }
                      className="rounded-xl bg-[#20243A] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Add user
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#F8F9FC] text-xs uppercase tracking-wide text-[#8A8FA5]">
                    <tr>
                      <th className="px-6 py-4">
                        User
                      </th>
                      <th className="px-6 py-4">
                        Role
                      </th>
                      <th className="px-6 py-4">
                        Status
                      </th>
                      <th className="px-6 py-4">
                        Joined
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {users.map(
                      (user) => (
                        <tr
                          key={
                            user.membershipId
                          }
                          className="border-t border-[#EEF0F5]"
                        >
                          <td className="px-6 py-4">
                            <div className="font-semibold">
                              {
                                user.name
                              }
                            </div>

                            <div className="text-xs text-[#8A8FA5]">
                              {
                                user.email
                              }
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <span className="rounded-lg bg-[#F1F2F7] px-2.5 py-1 text-xs font-semibold">
                              {formatRole(
                                user.role
                              )}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            {user.membershipActive &&
                            user.accountActive ? (
                              <span className="inline-flex items-center gap-1.5 text-green-700">
                                <CheckCircle2
                                  size={
                                    15
                                  }
                                />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-red-700">
                                <XCircle
                                  size={
                                    15
                                  }
                                />
                                Inactive
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-4 text-[#666B84]">
                            {formatDateTime(
                              user.joinedAt
                            )}
                          </td>
                        </tr>
                      )
                    )}

                    {users.length ===
                      0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-6 py-12 text-center text-[#8A8FA5]"
                        >
                          No users found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* SECURITY */}

          {activeTab ===
            "security" && (
            <section className="space-y-6">
              <div className="rounded-2xl border border-[#E6E8F0] bg-white shadow-sm">
                <div className="border-b border-[#E6E8F0] p-6">
                  <h2 className="text-xl font-bold">
                    Security
                  </h2>

                  <p className="mt-1 text-sm text-[#666B84]">
                    Review active sessions and protect
                    access to this tenant.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-3">
                  <div className="rounded-xl border border-[#E6E8F0] p-4">
                    <Lock
                      size={19}
                      className="mb-3"
                    />

                    <p className="text-sm font-semibold">
                      Tenant isolation
                    </p>

                    <p className="mt-1 text-xs text-[#777C91]">
                      Access is restricted to the
                      authenticated organization.
                    </p>

                    <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-green-700">
                      <CheckCircle2
                        size={14}
                      />
                      Protected
                    </span>
                  </div>

                  <div className="rounded-xl border border-[#E6E8F0] p-4">
                    <ShieldCheck
                      size={19}
                      className="mb-3"
                    />

                    <p className="text-sm font-semibold">
                      Session protection
                    </p>

                    <p className="mt-1 text-xs text-[#777C91]">
                      Active sessions are validated
                      against the server.
                    </p>

                    <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-green-700">
                      <CheckCircle2
                        size={14}
                      />
                      Protected
                    </span>
                  </div>

                  <div className="rounded-xl border border-[#E6E8F0] p-4">
                    <Activity
                      size={19}
                      className="mb-3"
                    />

                    <p className="text-sm font-semibold">
                      Audit activity
                    </p>

                    <p className="mt-1 text-xs text-[#777C91]">
                      Important tenant actions are
                      recorded.
                    </p>

                    <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-green-700">
                      <CheckCircle2
                        size={14}
                      />
                      Enabled
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#E6E8F0] bg-white shadow-sm">
                <div className="flex flex-col gap-4 border-b border-[#E6E8F0] p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold">
                      Active sessions
                    </h2>

                    <p className="mt-1 text-sm text-[#666B84]">
                      Review devices currently signed
                      into your account.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={
                      revokeOtherSessions
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                  >
                    <LogOut
                      size={16}
                    />
                    Sign out other sessions
                  </button>
                </div>

                <div className="divide-y divide-[#EEF0F5]">
                  {sessions.map(
                    (session) => {
                      const DeviceIcon =
                        getDeviceIcon(
                          session.userAgent
                        );

                      return (
                        <div
                          key={
                            session.id
                          }
                          className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex items-start gap-4">
                            <div className="rounded-xl bg-[#F3F4F8] p-3">
                              <DeviceIcon
                                size={
                                  20
                                }
                              />
                            </div>

                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold">
                                  {session.userAgent ||
                                    "Unknown device"}
                                </p>

                                {session.current && (
                                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                                    Current session
                                  </span>
                                )}
                              </div>

                              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#777C91]">
                                <span className="inline-flex items-center gap-1">
                                  <Globe2
                                    size={
                                      13
                                    }
                                  />
                                  {session.ipAddress ||
                                    "Unknown IP"}
                                </span>

                                <span>
                                  Last active:{" "}
                                  {formatDateTime(
                                    session.lastActiveAt
                                  )}
                                </span>

                                <span>
                                  Created:{" "}
                                  {formatDateTime(
                                    session.createdAt
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>

                          {!session.current && (
                            <button
                              type="button"
                              onClick={() =>
                                revokeSession(
                                  session.id
                                )
                              }
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                            >
                              <LogOut
                                size={
                                  15
                                }
                              />
                              Revoke
                            </button>
                          )}
                        </div>
                      );
                    }
                  )}

                  {sessions.length ===
                    0 && (
                    <div className="p-12 text-center text-sm text-[#8A8FA5]">
                      No active sessions found.
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* NOTIFICATIONS */}

          {activeTab ===
            "notifications" && (
            <section className="rounded-2xl border border-[#E6E8F0] bg-white shadow-sm">
              <div className="border-b border-[#E6E8F0] p-6">
                <h2 className="text-xl font-bold">
                  Notifications
                </h2>

                <p className="mt-1 text-sm text-[#666B84]">
                  Notification preferences for this
                  organization.
                </p>
              </div>

              <div className="space-y-4 p-6">
                {[
                  [
                    "Security alerts",
                    "Receive alerts about important security events.",
                  ],
                  [
                    "Approval notifications",
                    "Receive notifications when financial approvals require attention.",
                  ],
                  [
                    "Financial notifications",
                    "Receive important financial activity notifications.",
                  ],
                  [
                    "System notifications",
                    "Receive important FOS system notifications.",
                  ],
                ].map(
                  ([title, description]) => (
                    <div
                      key={title}
                      className="flex items-center justify-between rounded-xl border border-[#E6E8F0] p-4"
                    >
                      <div>
                        <p className="font-semibold">
                          {title}
                        </p>

                        <p className="mt-1 text-xs text-[#777C91]">
                          {description}
                        </p>
                      </div>

                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                        Enabled
                      </span>
                    </div>
                  )
                )}
              </div>
            </section>
          )}

          {/* AUDIT */}

          {activeTab ===
            "audit" && (
            <section className="rounded-2xl border border-[#E6E8F0] bg-white shadow-sm">
              <div className="border-b border-[#E6E8F0] p-6">
                <h2 className="text-xl font-bold">
                  Audit Log
                </h2>

                <p className="mt-1 text-sm text-[#666B84]">
                  Activity recorded inside this
                  organization.
                </p>
              </div>

              <div className="divide-y divide-[#EEF0F5]">
                {auditLogs.map(
                  (log) => (
                    <div
                      key={
                        log.id
                      }
                      className="p-6"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold">
                            {log.action}
                          </p>

                          <p className="mt-1 text-sm text-[#666B84]">
                            {log.user} ·{" "}
                            {log.module}
                          </p>

                          {log.details && (
                            <p className="mt-2 rounded-lg bg-[#F7F8FC] p-3 text-xs text-[#666B84]">
                              {
                                log.details
                              }
                            </p>
                          )}
                        </div>

                        <span className="text-xs text-[#8A8FA5]">
                          {formatDateTime(
                            log.createdAt
                          )}
                        </span>
                      </div>
                    </div>
                  )
                )}

                {auditLogs.length ===
                  0 && (
                  <div className="p-12 text-center text-sm text-[#8A8FA5]">
                    No tenant audit activity found.
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}