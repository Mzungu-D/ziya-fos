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
};

const formatRole = (role: string) =>
  role
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

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

      const [userResult, roleResult] = await Promise.all([
        api("/api/users"),
        api("/api/roles"),
      ]);

      setUsers(userResult.users || []);
      setRoles((roleResult.roles || []).filter((r: Role) => r.role !== "OWNER"));
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

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#F7F8FC]">
        <RefreshCw className="animate-spin text-[#20243A]" size={22} />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#F7F8FC] p-8 text-[#20243A]">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm text-[#777C91]">
              <a href="/dashboard/settings" className="hover:text-[#20243A]">
                Settings
              </a>
              <span>/</span>
              <span>Users & Access</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              Users & Access
            </h1>
            <p className="mt-2 text-[#666B84]">
              Control who can access this organization's FOS workspace.
            </p>
          </div>

          <button
            onClick={openInvite}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#20243A] px-5 py-3 text-sm font-semibold text-white shadow-sm"
          >
            <UserPlus size={17} />
            Invite user
          </button>
        </div>

        {error && (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <X size={17} />
            <span>{error}</span>
            <button className="ml-auto font-bold" onClick={() => setError("")}>
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            <CheckCircle2 size={17} />
            <span>{success}</span>
            <button className="ml-auto font-bold" onClick={() => setSuccess("")}>
              ×
            </button>
          </div>
        )}

        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[#E6E8F0] bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8FA5]">
              Total users
            </p>
            <p className="mt-2 text-2xl font-bold">{users.length}</p>
          </div>
          <div className="rounded-2xl border border-[#E6E8F0] bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8FA5]">
              Active users
            </p>
            <p className="mt-2 text-2xl font-bold">
              {users.filter((u) => u.membershipActive && u.accountActive).length}
            </p>
          </div>
          <div className="rounded-2xl border border-[#E6E8F0] bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8FA5]">
              Custom access
            </p>
            <p className="mt-2 text-2xl font-bold">
              {users.filter((u) => u.role === "CUSTOM").length}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#E6E8F0] bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-[#E6E8F0] p-5 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users..."
                className="w-full rounded-xl border border-[#DDE0EA] px-4 py-3 text-sm outline-none focus:border-[#20243A]"
              />
            </div>

            <button
              onClick={load}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#DDE0EA] px-4 py-3 text-sm font-semibold"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F8F9FC] text-xs uppercase tracking-wide text-[#8A8FA5]">
                <tr>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Access</th>
                  <th className="px-6 py-4">Joined</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.membershipId} className="border-t border-[#EEF0F5]">
                    <td className="px-6 py-5">
                      <div className="font-semibold">{user.name}</div>
                      <div className="mt-1 text-xs text-[#8A8FA5]">{user.email}</div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="inline-flex items-center gap-2 rounded-lg bg-[#F1F2F7] px-3 py-1.5 text-xs font-semibold">
                        <Shield size={13} />
                        {formatRole(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      {user.membershipActive && user.accountActive ? (
                        <span className="inline-flex items-center gap-1.5 text-green-700">
                          <UserCheck size={15} />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-red-700">
                          <UserX size={15} />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-[#666B84]">
                      {new Date(user.joinedAt).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEdit(user)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#DDE0EA] px-3 py-2 text-xs font-semibold hover:bg-[#F7F8FC]"
                        >
                          <Pencil size={14} />
                          Manage
                        </button>
                        <button
                          onClick={() => changeStatus(user)}
                          disabled={saving || user.role === "OWNER"}
                          className="rounded-lg border border-[#DDE0EA] p-2 disabled:opacity-40"
                          title={user.membershipActive ? "Deactivate" : "Activate"}
                        >
                          <MoreHorizontal size={16} />
                        </button>
                        <button
                          onClick={() => removeUser(user)}
                          disabled={saving || user.role === "OWNER"}
                          className="rounded-lg border border-red-200 p-2 text-red-600 disabled:opacity-40"
                          title="Remove user"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-[#8A8FA5]">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {(inviteOpen || editUser) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E6E8F0] p-6">
              <div>
                <h2 className="text-xl font-bold">
                  {editUser ? "Manage user access" : "Invite user"}
                </h2>
                <p className="mt-1 text-sm text-[#666B84]">
                  {editUser
                    ? "Update this user's organization role and permissions."
                    : "Send a secure invitation to join this organization."}
                </p>
              </div>
              <button
                onClick={() => {
                  setInviteOpen(false);
                  setEditUser(null);
                }}
                className="rounded-lg p-2 hover:bg-[#F5F6FA]"
              >
                <X size={19} />
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label>
                  <span className="mb-2 block text-sm font-semibold">Full name</span>
                  <input
                    value={form.name}
                    disabled={!!editUser}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-xl border border-[#DDE0EA] px-4 py-3 outline-none focus:border-[#20243A] disabled:bg-[#F5F6FA]"
                  />
                </label>

                <label>
                  <span className="mb-2 block text-sm font-semibold">Email</span>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3.5 text-[#8A8FA5]" size={17} />
                    <input
                      value={form.email}
                      disabled={!!editUser}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full rounded-xl border border-[#DDE0EA] py-3 pl-10 pr-4 outline-none focus:border-[#20243A] disabled:bg-[#F5F6FA]"
                    />
                  </div>
                </label>
              </div>

              {!editUser && (
                <label>
                  <span className="mb-2 block text-sm font-semibold">
                    Phone number <span className="font-normal text-[#8A8FA5]">(optional)</span>
                  </span>
                  <input
                    value={form.phoneNumber}
                    onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                    className="w-full rounded-xl border border-[#DDE0EA] px-4 py-3 outline-none focus:border-[#20243A]"
                  />
                </label>
              )}

              <label>
                <span className="mb-2 block text-sm font-semibold">Role</span>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      role: e.target.value,
                      permissions: [],
                    })
                  }
                  className="w-full rounded-xl border border-[#DDE0EA] bg-white px-4 py-3 outline-none focus:border-[#20243A]"
                >
                  {roles.map((role) => (
                    <option key={role.role} value={role.role}>
                      {formatRole(role.role)}
                    </option>
                  ))}
                </select>
              </label>

              {form.role !== "CUSTOM" && selectedRole && (
                <div className="rounded-xl border border-[#E6E8F0] bg-[#F8F9FC] p-4">
                  <div className="mb-3 text-sm font-semibold">
                    Included permissions
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {selectedRole.permissions.map((permission) => (
                      <div
                        key={permission}
                        className="flex items-center gap-2 text-xs text-[#555B72]"
                      >
                        <CheckCircle2 size={14} className="text-green-600" />
                        {PERMISSION_LABELS[permission] || permission}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {form.role === "CUSTOM" && (
                <div className="rounded-xl border border-[#E6E8F0] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Custom permissions</p>
                      <p className="mt-1 text-xs text-[#8A8FA5]">
                        Select exactly what this user can access.
                      </p>
                    </div>
                    <span className="rounded-full bg-[#F1F2F7] px-3 py-1 text-xs font-semibold">
                      {form.permissions.length} selected
                    </span>
                  </div>

                  <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
                    {customPermissions.map((permission) => (
                      <label
                        key={permission}
                        className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#EEF0F5] p-3 hover:bg-[#F8F9FC]"
                      >
                        <input
                          type="checkbox"
                          checked={form.permissions.includes(permission)}
                          onChange={() => togglePermission(permission)}
                          className="h-4 w-4"
                        />
                        <span className="text-xs">
                          {PERMISSION_LABELS[permission] || permission}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-[#E6E8F0] p-6">
              <button
                onClick={() => {
                  setInviteOpen(false);
                  setEditUser(null);
                }}
                className="rounded-xl border border-[#DDE0EA] px-5 py-3 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                disabled={saving}
                onClick={editUser ? saveAccess : submitInvite}
                className="inline-flex items-center gap-2 rounded-xl bg-[#20243A] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving && <RefreshCw size={16} className="animate-spin" />}
                {editUser ? "Save access" : "Send invitation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

