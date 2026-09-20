import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Mail,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  X,
} from "lucide-react";
import { authenticatedFetch } from "../lib/auth";

type User = {
  id: string;
  membershipId: string;
  name: string;
  email: string;
  phoneNumber?: string | null;
  role: string;
  permissions: string[];
  membershipActive: boolean;
  accountActive: boolean;
  joinedAt: string;
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  status: string;
  expiresAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
  invitedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
};
type Role = {
  role: string;
  permissions: string[];
};

const PERMISSION_LABELS: Record<string, string> = {
  "account.view": "View accounts",
  "account.create": "Create accounts",
  "account.update": "Update accounts",
  "account.delete": "Delete accounts",
  "accountsPayable.view": "View accounts payable",
  "accountsPayable.create": "Create payables",
  "accountsPayable.approve": "Approve payables",
  "accountsPayable.payment": "Make payable payments",
  "accountsPayable.delete": "Delete payables",
  "accountsReceivable.view": "View accounts receivable",
  "accountsReceivable.create": "Create receivables",
  "accountsReceivable.update": "Update receivables",
  "accountsReceivable.approve": "Approve receivables",
  "accountsReceivable.payment": "Receive payments",
  "bankAccount.view": "View bank accounts",
  "bankAccount.create": "Create bank accounts",
  "bankAccount.update": "Update bank accounts",
  "bankAccount.delete": "Delete bank accounts",
  "bankPayment.view": "View bank payments",
  "bankPayment.create": "Create bank payments",
  "budget.view": "View budgets",
  "budget.create": "Create budgets",
  "budget.update": "Update budgets",
  "budget.delete": "Delete budgets",
  "document.view": "View documents",
  "document.create": "Create documents",
  "document.delete": "Delete documents",
  "expense.view": "View expenses",
  "expense.create": "Create expenses",
  "fraud.view": "View fraud controls",
  "fraud.analyze": "Analyze fraud",
  "investment.view": "View investments",
  "investment.create": "Create investments",
  "invoice.view": "View invoices",
  "invoice.create": "Create invoices",
  "journal.view": "View journals",
  "journal.create": "Create journals",
  "journal.update": "Update journals",
  "journal.post": "Post journals",
  "journal.approve": "Approve journals",
  "journal.reverse": "Reverse journals",
  "journal.delete": "Delete journals",
  "ledger.view": "View general ledger",
  "portfolioCompany.view": "View portfolio companies",
  "portfolioCompany.create": "Create portfolio companies",
  "portfolioCompany.update": "Update portfolio companies",
  "portfolioCompany.delete": "Delete portfolio companies",
  "procurement.view": "View procurement",
  "procurement.create": "Create procurement",
  "procurement.update": "Update procurement",
  "procurement.status": "Manage procurement status",
  "employee.view": "View employees",
  "employee.create": "Create employees",
  "employee.update": "Update employees",
  "payroll.view": "View payroll",
  "payroll.create": "Create payroll",
  "payroll.update": "Update payroll",
  "asset.view": "View assets",
  "asset.create": "Create assets",
  "asset.update": "Update assets",
  "asset.delete": "Delete assets",
  "assetAssignment.view": "View asset assignments",
  "assetAssignment.create": "Create asset assignments",
  "assetAssignment.update": "Update asset assignments",
  "reports.view": "View reports",
  "vendor.view": "View vendors",
  "vendor.create": "Create vendors",
  "vendor.update": "Update vendors",
  "vendor.status": "Manage vendor status",
  "vendor.delete": "Delete vendors",

  "tax.view": "View tax management",
  "tax.create": "Create tax records",
  "tax.file": "File tax returns",
  "tax.payment": "Record tax payments",
};

const formatRole = (role: string) =>
  role
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const roleLabel = (role: string) =>
  role === "OWNER" ? "Owner / Company Admin" : formatRole(role);

const TENANT_ASSIGNABLE_ROLES = [
  "FINANCE_MANAGER",
  "ACCOUNTANT",
  "FINANCE_OFFICER",
  "ACCOUNTS_PAYABLE_OFFICER",
  "ACCOUNTS_RECEIVABLE_OFFICER",
  "PROCUREMENT_OFFICER",
  "HR_MANAGER",
  "ASSET_MANAGER",
  "APPROVER",
  "AUDITOR",
  "VIEWER",
  "CUSTOM",
];

const api = async (url: string, options: RequestInit = {}) => {
  const headers: Record<string, string> = {};
  if (options.body) headers["Content-Type"] = "application/json";

  const response = await authenticatedFetch(url, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string> || {}) },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || `Request failed (${response.status})`);
  }

  return data;
};

export default function UsersAccess() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");

  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    role: "ACCOUNTANT",
    permissions: [] as string[],
  });

  const load = async () => {
    try {
      setLoading(true);
      setError("");

      const [userResult, roleResult, invitationResult] = await Promise.all([
        api("/api/users"),
        api("/api/roles"),
        api("/api/users/invitations"),
      ]);

      setUsers(userResult.users || []);
      setRoles(
        (roleResult.roles || []).filter(
          (r: Role) =>
            r.role !== "OWNER" &&
            TENANT_ASSIGNABLE_ROLES.includes(r.role)
        )
      );
      setInvitations(invitationResult.invitations || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        formatRole(u.role).toLowerCase().includes(q)
    );
  }, [users, search]);

  const openInvite = () => {
    setEditUser(null);
    setForm({
      name: "",
      email: "",
      phoneNumber: "",
      role: roles[0]?.role || "ACCOUNTANT",
      permissions: [],
    });
    setInviteOpen(true);
  };

  const openEdit = (user: User) => {
    setInviteOpen(false);
    setEditUser(user);
    setForm({
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber || "",
      role: user.role,
      permissions: [...user.permissions],
    });
  };

  const selectedRole = roles.find((r) => r.role === form.role);
  const customPermissions =
    form.role === "CUSTOM"
      ? Object.keys(PERMISSION_LABELS)
      : [];

  const togglePermission = (permission: string) => {
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((p) => p !== permission)
        : [...current.permissions, permission],
    }));
  };

  const submitInvite = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      setError("Name and email are required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const result = await api("/api/users", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          phoneNumber: form.phoneNumber.trim() || undefined,
          role: form.role,
          permissions: form.role === "CUSTOM" ? form.permissions : undefined,
        }),
      });

      setInviteOpen(false);
      await load();
      setSuccess(
        result.invitationSent
          ? "Invitation sent successfully."
          : "Invitation created, but the email could not be sent."
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send invitation.");
    } finally {
      setSaving(false);
    }
  };

  const saveAccess = async () => {
    if (!editUser) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api(`/api/users/${editUser.membershipId}/access`, {
        method: "PATCH",
        body: JSON.stringify({
          role: form.role,
          permissions: form.role === "CUSTOM" ? form.permissions : undefined,
        }),
      });

      setEditUser(null);
      await load();
      setSuccess("User access updated successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update access.");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (user: User) => {
    try {
      setSaving(true);
      setError("");
      await api(`/api/users/${user.membershipId}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          isActive: !user.membershipActive,
        }),
      });
      await load();
      setSuccess(
        user.membershipActive
          ? "User access deactivated."
          : "User access activated."
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to change status.");
    } finally {
      setSaving(false);
    }
  };

  const resendInvitation = async (invitation: Invitation) => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const result = await api(
        `/api/users/invitations/${encodeURIComponent(invitation.id)}/resend`,
        {
          method: "POST",
        }
      );

      await load();

      setSuccess(
        result.invitationSent
          ? `Invitation resent to ${invitation.email}.`
          : "Invitation was regenerated, but the email could not be sent."
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Failed to resend invitation."
      );
    } finally {
      setSaving(false);
    }
  };

  const revokeInvitation = async (invitation: Invitation) => {
    if (
      !window.confirm(
        `Revoke the invitation for ${invitation.email}?`
      )
    ) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api(
        `/api/users/invitations/${encodeURIComponent(invitation.id)}`,
        {
          method: "DELETE",
        }
      );

      await load();
      setSuccess(`Invitation for ${invitation.email} was revoked.`);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Failed to revoke invitation."
      );
    } finally {
      setSaving(false);
    }
  };

  const pendingInvitations = invitations.filter(
    (invitation) =>
      invitation.status === "PENDING" ||
      invitation.status === "EXPIRED"
  );
  const removeUser = async (user: User) => {
    if (!window.confirm(`Remove ${user.name} from this organization?`)) return;

    try {
      setSaving(true);
      setError("");
      await api(`/api/users/${user.membershipId}`, {
        method: "DELETE",
      });
      await load();
      setSuccess("User removed successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove user.");
    } finally {
      setSaving(false);
    }
  };

  const activeUsers = users.filter(
    (u) => u.membershipActive && u.accountActive
  ).length;

  const inactiveUsers = users.length - activeUsers;

  const initials = (name: string) =>
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");

  const roleColors = (role: string) => {
    switch (role) {
      case "OWNER":
        return "border-[#D8C07A] bg-[#FBF7E8] text-[#806B25]";
      case "FINANCE_MANAGER":
      case "ACCOUNTANT":
        return "border-blue-200 bg-blue-50 text-blue-700";
      case "FINANCE_OFFICER":
      case "ACCOUNTS_PAYABLE_OFFICER":
      case "ACCOUNTS_RECEIVABLE_OFFICER":
        return "border-violet-200 bg-violet-50 text-violet-700";
      case "PROCUREMENT_OFFICER":
        return "border-orange-200 bg-orange-50 text-orange-700";
      case "HR_MANAGER":
        return "border-pink-200 bg-pink-50 text-pink-700";
      case "ASSET_MANAGER":
        return "border-cyan-200 bg-cyan-50 text-cyan-700";
      case "APPROVER":
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
      case "AUDITOR":
        return "border-slate-200 bg-slate-50 text-slate-700";
      case "VIEWER":
        return "border-gray-200 bg-gray-50 text-gray-600";
      case "CUSTOM":
        return "border-indigo-200 bg-indigo-50 text-indigo-700";
      default:
        return "border-[#E5E7EF] bg-[#F7F8FC] text-[#555B72]";
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#F6F7FB]">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-[#E7E9F1]">
            <RefreshCw
              className="animate-spin text-[#20243A]"
              size={20}
            />
          </div>
          <p className="text-sm font-medium text-[#777C91]">
            Loading users & access...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#F6F7FB] px-4 py-6 text-[#20243A] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">

        {/* =================================================
            HEADER
        ================================================= */}
        <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-[#8A8FA5]">
              <a
                href="/dashboard/settings"
                className="transition hover:text-[#20243A]"
              >
                Settings
              </a>
              <span>/</span>
              <span className="text-[#555B72]">Users & Access</span>
            </div>

            <h1 className="text-[28px] font-bold tracking-[-0.02em] text-[#20243A] sm:text-[32px]">
              Users & Access
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#747A90]">
              Manage everyone who has access to this organization's financial
              workspace, including their roles and permissions.
            </p>
          </div>

          <button
            onClick={openInvite}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#20243A] px-5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(32,36,58,0.14)] transition hover:-translate-y-0.5 hover:bg-[#171A2C]"
          >
            <UserPlus size={17} />
            Invite user
          </button>
        </div>

        {/* =================================================
            ALERTS
        ================================================= */}
        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-700">
            <X size={17} className="mt-0.5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              className="font-bold opacity-70 hover:opacity-100"
              onClick={() => setError("")}
            >
              Ã—
            </button>
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-700">
            <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
            <span className="flex-1">{success}</span>
            <button
              className="font-bold opacity-70 hover:opacity-100"
              onClick={() => setSuccess("")}
            >
              Ã—
            </button>
          </div>
        )}

        {/* =================================================
            SUMMARY CARDS
        ================================================= */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <div className="rounded-2xl border border-[#E5E7EF] bg-white p-5 shadow-[0_2px_8px_rgba(32,36,58,0.025)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9297AA]">
                  Total users
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-[#20243A]">
                  {users.length}
                </p>
                <p className="mt-1 text-xs text-[#8A8FA5]">
                  People with organization access
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F1F2F7]">
                <UserCheck size={18} className="text-[#555B72]" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E5E7EF] bg-white p-5 shadow-[0_2px_8px_rgba(32,36,58,0.025)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9297AA]">
                  Active users
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-[#20243A]">
                  {activeUsers}
                </p>
                <p className="mt-1 text-xs text-emerald-600">
                  Currently able to access FOS
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                <CheckCircle2 size={18} className="text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E5E7EF] bg-white p-5 shadow-[0_2px_8px_rgba(32,36,58,0.025)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9297AA]">
                  Inactive users
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-[#20243A]">
                  {inactiveUsers}
                </p>
                <p className="mt-1 text-xs text-[#8A8FA5]">
                  Access currently disabled
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
                <UserX size={18} className="text-amber-600" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E5E7EF] bg-white p-5 shadow-[0_2px_8px_rgba(32,36,58,0.025)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9297AA]">
                  Pending invitations
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-[#20243A]">
                  {pendingInvitations.length}
                </p>
                <p className="mt-1 text-xs text-[#8A8FA5]">
                  Waiting to join the workspace
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                <Mail size={18} className="text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        {/* =================================================
            PENDING INVITATIONS
        ================================================= */}
        {pendingInvitations.length > 0 && (
          <div className="mb-6 overflow-hidden rounded-2xl border border-[#E5E7EF] bg-white shadow-[0_2px_8px_rgba(32,36,58,0.025)]">
            <div className="flex flex-col gap-3 border-b border-[#ECEEF4] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#20243A]">
                  Pending invitations
                </h2>
                <p className="mt-1 text-xs text-[#8A8FA5]">
                  Invitations that have not yet been accepted.
                </p>
              </div>

              <span className="inline-flex w-fit items-center rounded-full bg-[#F1F2F7] px-3 py-1 text-[11px] font-bold text-[#555B72]">
                {pendingInvitations.length} pending
              </span>
            </div>

            <div className="divide-y divide-[#EEF0F5]">
              {pendingInvitations.map((invitation) => {
                const expired =
                  invitation.status === "EXPIRED" ||
                  new Date(invitation.expiresAt).getTime() <= Date.now();

                return (
                  <div
                    key={invitation.id}
                    className="flex flex-col gap-4 px-5 py-4 transition hover:bg-[#FBFCFE] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F4F5F9]">
                        <Mail size={17} className="text-[#6F758B]" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-[#30354A]">
                            {invitation.email}
                          </span>

                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                              expired
                                ? "bg-amber-50 text-amber-700"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {expired ? "Expired" : "Pending"}
                          </span>
                        </div>

                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#8A8FA5]">
                          <span>{roleLabel(invitation.role)}</span>
                          <span>
                            {expired
                              ? "Invitation expired"
                              : `Expires ${new Date(
                                  invitation.expiresAt
                                ).toLocaleDateString("en-GB")}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => resendInvitation(invitation)}
                        disabled={saving}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#DDE0EA] bg-white px-3 text-xs font-semibold text-[#42475C] transition hover:bg-[#F7F8FC] disabled:opacity-50"
                      >
                        <RefreshCw size={13} />
                        Resend
                      </button>

                      {invitation.status === "PENDING" && (
                        <button
                          onClick={() => revokeInvitation(invitation)}
                          disabled={saving}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          <X size={13} />
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =================================================
            USERS TABLE
        ================================================= */}
        <div className="overflow-hidden rounded-2xl border border-[#E5E7EF] bg-white shadow-[0_2px_8px_rgba(32,36,58,0.025)]">

          <div className="border-b border-[#E7E9F0] px-5 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

              <div>
                <h2 className="text-base font-bold text-[#20243A]">
                  People with FOS access
                </h2>
                <p className="mt-1 text-xs text-[#8A8FA5]">
                  Everyone who can access this organization's financial
                  workspace.
                </p>
              </div>

              <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                <div className="relative min-w-0 sm:w-80">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, email or role..."
                    className="h-10 w-full rounded-xl border border-[#DDE0EA] bg-[#FBFCFE] px-4 text-sm text-[#30354A] outline-none transition placeholder:text-[#A0A5B6] focus:border-[#20243A] focus:bg-white focus:ring-2 focus:ring-[#20243A]/5"
                  />
                </div>

                <button
                  onClick={load}
                  disabled={saving}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#DDE0EA] bg-white px-4 text-xs font-semibold text-[#555B72] transition hover:bg-[#F7F8FC] disabled:opacity-50"
                >
                  <RefreshCw
                    size={14}
                    className={saving ? "animate-spin" : ""}
                  />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead className="border-b border-[#ECEEF4] bg-[#FAFBFD]">
                <tr className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9297AA]">
                  <th className="px-5 py-3.5">User</th>
                  <th className="px-5 py-3.5">Role</th>
                  <th className="px-5 py-3.5">Access</th>
                  <th className="px-5 py-3.5">Joined</th>
                  <th className="px-5 py-3.5 text-right">Manage</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((user) => {
                  const isActive =
                    user.membershipActive && user.accountActive;

                  return (
                    <tr
                      key={user.membershipId}
                      className="border-b border-[#F0F1F5] last:border-b-0 transition hover:bg-[#FCFCFE]"
                    >
                      {/* USER */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#20243A] text-xs font-bold text-white">
                            {initials(user.name)}
                          </div>

                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-[#30354A]">
                              {user.name}
                            </div>

                            <div className="mt-0.5 truncate text-xs text-[#8A8FA5]">
                              {user.email}
                            </div>

                            {user.phoneNumber && (
                              <div className="mt-0.5 text-[10px] text-[#A0A5B6]">
                                {user.phoneNumber}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* ROLE */}
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-bold ${roleColors(
                            user.role
                          )}`}
                        >
                          <Shield size={11} />
                          {roleLabel(user.role)}
                        </span>
                      </td>

                      {/* STATUS */}
                      <td className="px-5 py-4">
                        {isActive ? (
                          <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs font-semibold text-emerald-700">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs font-semibold text-red-600">
                            <span className="h-2 w-2 rounded-full bg-red-500" />
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* JOINED */}
                      <td className="px-5 py-4 text-xs text-[#777C91]">
                        {new Date(user.joinedAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>

                      {/* ACTIONS */}
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1.5">

                          <button
                            onClick={() => openEdit(user)}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#DDE0EA] bg-white px-3 text-xs font-semibold text-[#454A60] transition hover:border-[#C9CCD8] hover:bg-[#F7F8FC]"
                          >
                            <Pencil size={13} />
                            Manage access
                          </button>

                          <button
                            onClick={() => changeStatus(user)}
                            disabled={saving || user.role === "OWNER"}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#DDE0EA] bg-white text-[#666B80] transition hover:bg-[#F7F8FC] disabled:cursor-not-allowed disabled:opacity-35"
                            title={
                              user.membershipActive
                                ? "Deactivate access"
                                : "Activate access"
                            }
                          >
                            <MoreHorizontal size={16} />
                          </button>

                          <button
                            onClick={() => removeUser(user)}
                            disabled={saving || user.role === "OWNER"}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-35"
                            title="Remove from organization"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F1F2F7]">
                        <UserX size={20} className="text-[#8A8FA5]" />
                      </div>

                      <p className="mt-4 text-sm font-semibold text-[#555B72]">
                        No users found
                      </p>

                      <p className="mt-1 text-xs text-[#9A9EAF]">
                        Try a different search term.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2 border-t border-[#ECEEF4] bg-[#FAFBFD] px-5 py-3 text-[11px] text-[#8A8FA5] sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing {filteredUsers.length} of {users.length} users
            </span>

            <span>
              Access is controlled by organization role and permissions
            </span>
          </div>
        </div>
      </div>

      {/* ===================================================
          INVITE / EDIT MODAL
      =================================================== */}
      {(inviteOpen || editUser) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111526]/50 p-4 backdrop-blur-[2px]">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-white/60 bg-white shadow-[0_24px_80px_rgba(20,24,40,0.25)]">

            {/* MODAL HEADER */}
            <div className="flex items-start justify-between border-b border-[#E7E9F0] px-6 py-5">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F1F2F7]">
                    {editUser ? (
                      <Shield size={17} className="text-[#555B72]" />
                    ) : (
                      <UserPlus size={17} className="text-[#555B72]" />
                    )}
                  </div>

                  <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9297AA]">
                    {editUser ? "Access management" : "Organization access"}
                  </span>
                </div>

                <h2 className="text-xl font-bold tracking-tight text-[#20243A]">
                  {editUser ? "Manage user access" : "Invite a new user"}
                </h2>

                <p className="mt-1 text-xs leading-5 text-[#7B8094]">
                  {editUser
                    ? "Update this person's role and FOS permissions."
                    : "Send a secure invitation to join this organization's FOS workspace."}
                </p>
              </div>

              <button
                onClick={() => {
                  setInviteOpen(false);
                  setEditUser(null);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-[#777C91] transition hover:bg-[#F4F5F9] hover:text-[#20243A]"
              >
                <X size={18} />
              </button>
            </div>

            {/* MODAL BODY */}
            <div className="max-h-[62vh] overflow-y-auto px-6 py-6">
              <div className="space-y-5">

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label>
                    <span className="mb-2 block text-xs font-bold text-[#454A60]">
                      Full name
                    </span>

                    <input
                      value={form.name}
                      disabled={!!editUser}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      placeholder="e.g. Jane Doe"
                      className="h-11 w-full rounded-xl border border-[#DDE0EA] bg-white px-3.5 text-sm outline-none transition placeholder:text-[#A0A5B6] focus:border-[#20243A] focus:ring-2 focus:ring-[#20243A]/5 disabled:bg-[#F5F6FA]"
                    />
                  </label>

                  <label>
                    <span className="mb-2 block text-xs font-bold text-[#454A60]">
                      Email address
                    </span>

                    <div className="relative">
                      <Mail
                        className="absolute left-3.5 top-3.5 text-[#9A9EAF]"
                        size={16}
                      />

                      <input
                        value={form.email}
                        disabled={!!editUser}
                        onChange={(e) =>
                          setForm({ ...form, email: e.target.value })
                        }
                        placeholder="name@company.com"
                        className="h-11 w-full rounded-xl border border-[#DDE0EA] bg-white py-3 pl-10 pr-3.5 text-sm outline-none transition placeholder:text-[#A0A5B6] focus:border-[#20243A] focus:ring-2 focus:ring-[#20243A]/5 disabled:bg-[#F5F6FA]"
                      />
                    </div>
                  </label>
                </div>

                {!editUser && (
                  <label>
                    <span className="mb-2 block text-xs font-bold text-[#454A60]">
                      Phone number
                      <span className="ml-1 font-normal text-[#9A9EAF]">
                        optional
                      </span>
                    </span>

                    <input
                      value={form.phoneNumber}
                      onChange={(e) =>
                        setForm({ ...form, phoneNumber: e.target.value })
                      }
                      placeholder="+254 7XX XXX XXX"
                      className="h-11 w-full rounded-xl border border-[#DDE0EA] bg-white px-3.5 text-sm outline-none transition placeholder:text-[#A0A5B6] focus:border-[#20243A] focus:ring-2 focus:ring-[#20243A]/5"
                    />
                  </label>
                )}

                {/* ROLE */}
                <label>
                  <span className="mb-2 block text-xs font-bold text-[#454A60]">
                    Organization role
                  </span>

                  <select
                    value={form.role}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        role: e.target.value,
                        permissions: [],
                      })
                    }
                    className="h-11 w-full rounded-xl border border-[#DDE0EA] bg-white px-3.5 text-sm font-medium text-[#30354A] outline-none transition focus:border-[#20243A] focus:ring-2 focus:ring-[#20243A]/5"
                  >
                    {roles.map((role) => (
                      <option key={role.role} value={role.role}>
                        {roleLabel(role.role)}
                      </option>
                    ))}
                  </select>
                </label>

                {/* ROLE PERMISSIONS */}
                {form.role !== "CUSTOM" && selectedRole && (
                  <div className="rounded-2xl border border-[#E5E7EF] bg-[#F9FAFC] p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold text-[#30354A]">
                          Included permissions
                        </p>

                        <p className="mt-1 text-xs leading-5 text-[#8A8FA5]">
                          This role comes with the permissions shown below.
                        </p>
                      </div>

                      <Shield
                        size={18}
                        className="shrink-0 text-[#8A8FA5]"
                      />
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {selectedRole.permissions.map((permission) => (
                        <div
                          key={permission}
                          className="flex items-center gap-2.5 rounded-xl border border-[#ECEEF4] bg-white px-3 py-2.5"
                        >
                          <CheckCircle2
                            size={14}
                            className="shrink-0 text-emerald-500"
                          />

                          <span className="text-xs text-[#555B72]">
                            {PERMISSION_LABELS[permission] || permission}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CUSTOM PERMISSIONS */}
                {form.role === "CUSTOM" && (
                  <div className="rounded-2xl border border-[#E5E7EF] bg-white p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold text-[#30354A]">
                          Custom permissions
                        </p>

                        <p className="mt-1 text-xs leading-5 text-[#8A8FA5]">
                          Give this user only the exact FOS capabilities they
                          need.
                        </p>
                      </div>

                      <span className="rounded-full bg-[#F1F2F7] px-2.5 py-1 text-[10px] font-bold text-[#555B72]">
                        {form.permissions.length} selected
                      </span>
                    </div>

                    <div className="mt-4 grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                      {customPermissions.map((permission) => (
                        <label
                          key={permission}
                          className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                            form.permissions.includes(permission)
                              ? "border-[#BFC4D2] bg-[#F7F8FC]"
                              : "border-[#ECEEF4] bg-white hover:bg-[#FAFBFD]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={form.permissions.includes(permission)}
                            onChange={() => togglePermission(permission)}
                            className="h-4 w-4 rounded border-gray-300"
                          />

                          <span className="text-xs text-[#555B72]">
                            {PERMISSION_LABELS[permission] || permission}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div className="flex flex-col-reverse gap-2 border-t border-[#E7E9F0] bg-[#FAFBFD] px-6 py-4 sm:flex-row sm:justify-end">
              <button
                onClick={() => {
                  setInviteOpen(false);
                  setEditUser(null);
                }}
                className="h-10 rounded-xl border border-[#DDE0EA] bg-white px-5 text-xs font-semibold text-[#555B72] transition hover:bg-[#F4F5F9]"
              >
                Cancel
              </button>

              <button
                disabled={saving}
                onClick={editUser ? saveAccess : submitInvite}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#20243A] px-5 text-xs font-semibold text-white transition hover:bg-[#171A2C] disabled:opacity-50"
              >
                {saving && (
                  <RefreshCw size={14} className="animate-spin" />
                )}

                {editUser ? "Save access changes" : "Send invitation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
