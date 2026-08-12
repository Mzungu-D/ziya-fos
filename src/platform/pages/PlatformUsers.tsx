import React, { useCallback, useEffect, useState } from "react";
import {
  CheckCircle,
  Clock,
  Globe,
  Loader2,
  Lock,
  Search,
  Shield,
  UserCheck,
  UserX,
  Users,
  XCircle,
} from "lucide-react";

import {
  getUsers,
  deactivateUser,
  activateUser,
  unlockUser,
} from "../../services/platformUsers";

import type { PlatformUserSummary } from "../../services/platformUsers";

/* ─── helpers ─────────────────────────────────────────── */

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-KE", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/* ─── status badge ─────────────────────────────────────── */

function StatusBadge({ isActive, locked }: { isActive: boolean; locked: boolean }) {
  if (locked) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FEF3C7] px-2.5 py-1 text-xs font-semibold text-[#D97706]">
        <Lock size={10} /> Locked
      </span>
    );
  }
  return isActive ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#DCFCE7] px-2.5 py-1 text-xs font-semibold text-[#16A34A]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FEE2E2] px-2.5 py-1 text-xs font-semibold text-[#DC2626]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#DC2626]" /> Inactive
    </span>
  );
}

/* ─── role badge ───────────────────────────────────────── */

function RoleBadge({ platformRole }: { platformRole: string | null }) {
  return platformRole === "PLATFORM_ADMIN" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#EDE9FE] px-2.5 py-0.5 text-xs font-medium text-[#6D28D9]">
      <Shield size={10} /> Platform Admin
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-[#F1F5F9] px-2.5 py-0.5 text-xs font-medium text-[#475569]">
      Tenant User
    </span>
  );
}

/* ─── stat card ────────────────────────────────────────── */

function StatCard({
  label, value, icon, color = "#20243A",
}: {
  label: string; value: number | string; icon: React.ReactNode; color?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">
      <div className="mb-3" style={{ color }}>{icon}</div>
      <p className="text-sm text-[#666B84]">{label}</p>
      <p className="mt-1 text-3xl font-bold" style={{ color }}>{value}</p>
    </div>
  );
}

/* ─── confirm modal ────────────────────────────────────── */

function ConfirmModal({
  title, message, confirmLabel, confirmClass, onConfirm, onCancel, loading,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  confirmClass: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-base font-bold text-[#20243A]">{title}</h2>
        <p className="mt-2 text-sm text-[#666B84]">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl border border-[#ECECF3] px-5 py-2.5 text-sm font-medium text-[#666B84] transition hover:bg-[#F8F9FC] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white transition disabled:opacity-50 ${confirmClass}`}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── action type ──────────────────────────────────────── */

type ActionType = "deactivate" | "activate" | "unlock";

interface PendingAction {
  type:   ActionType;
  userId: string;
  name:   string;
}

/* ─── main page ────────────────────────────────────────── */

export default function PlatformUsers() {
  const [users, setUsers]       = useState<PlatformUserSummary[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const [q,      setQ]      = useState("");
  const [role,   setRole]   = useState("");
  const [status, setStatus] = useState("");
  const [page,   setPage]   = useState(1);

  const [pending, setPending]   = useState<PendingAction | null>(null);
  const [actioning, setActioning] = useState(false);
  const [toast, setToast]       = useState<{ ok: boolean; text: string } | null>(null);

  const LIMIT = 20;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getUsers({ q, role, status, page, limit: LIMIT });
      setUsers(res.users);
      setTotal(res.pagination.total);
    } catch {
      setError("Unable to load users.");
    } finally {
      setLoading(false);
    }
  }, [q, role, status, page]);

  useEffect(() => { void load(); }, [load]);

  /* reset page when filters change */
  useEffect(() => { setPage(1); }, [q, role, status]);

  function showToast(ok: boolean, text: string) {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleConfirm() {
    if (!pending) return;
    setActioning(true);
    try {
      if (pending.type === "deactivate") await deactivateUser(pending.userId);
      if (pending.type === "activate")   await activateUser(pending.userId);
      if (pending.type === "unlock")     await unlockUser(pending.userId);

      const msg =
        pending.type === "deactivate" ? `${pending.name} deactivated.` :
        pending.type === "activate"   ? `${pending.name} activated.`   :
                                        `${pending.name} unlocked.`;
      showToast(true, msg);
      setPending(null);
      await load();
    } catch (e: unknown) {
      showToast(false, e instanceof Error ? e.message : "Action failed.");
    } finally {
      setActioning(false);
    }
  }

  /* derived stats */
  const activeCount  = users.filter((u) => u.isActive).length;
  const adminCount   = users.filter((u) => u.platformRole === "PLATFORM_ADMIN").length;
  const lockedCount  = users.filter((u) => u.lockedUntil && new Date(u.lockedUntil) > new Date()).length;
  const pages        = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#20243A]">Users & Access</h1>
        <p className="mt-1 text-sm text-[#94A3B8]">
          Manage platform administrators and all tenant users across Ziya FOS.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Users"       value={total}       icon={<Users     size={20} />} color="#20243A" />
        <StatCard label="Active"            value={activeCount} icon={<UserCheck size={20} />} color="#16A34A" />
        <StatCard label="Platform Admins"   value={adminCount}  icon={<Shield    size={20} />} color="#6D28D9" />
        <StatCard label="Locked Accounts"   value={lockedCount} icon={<Lock      size={20} />} color={lockedCount > 0 ? "#D97706" : "#94A3B8"} />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 rounded-2xl border border-[#ECECF3] bg-white p-4 shadow-sm">

        {/* Search */}
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or email..."
            className="h-10 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] pl-9 pr-3 text-sm outline-none transition focus:border-[#20243A]"
          />
        </div>

        {/* Role filter */}
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="h-10 rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3 text-sm text-[#475569] outline-none focus:border-[#20243A]"
        >
          <option value="">All Roles</option>
          <option value="PLATFORM_ADMIN">Platform Admin</option>
          <option value="tenant">Tenant User</option>
        </select>

        {/* Status filter */}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3 text-sm text-[#475569] outline-none focus:border-[#20243A]"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Toast */}
      {toast !== null && (
        <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${toast.ok ? "bg-[#F0FDF4] text-[#16A34A]" : "bg-[#FEF2F2] text-[#DC2626]"}`}>
          {toast.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
          {toast.text}
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-[#ECECF3] bg-white shadow-sm">

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 size={24} className="animate-spin text-[#20243A]" />
          </div>
        ) : error ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <XCircle size={32} className="text-[#EF4444]" />
            <p className="text-sm text-[#666B84]">{error}</p>
            <button onClick={load} className="text-sm font-medium text-[#20243A] hover:underline">Retry</button>
          </div>
        ) : users.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <Users size={32} className="text-[#C7CCD9]" />
            <p className="text-sm text-[#666B84]">No users found.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#F1F5F9]">
                {["User", "Role", "Organization(s)", "Status", "Last Login", "Joined", "Actions"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F8F9FC]">
              {users.map((user) => {
                const isLocked = !!user.lockedUntil && new Date(user.lockedUntil) > new Date();
                return (
                  <tr key={user.id} className="group transition hover:bg-[#F8F9FC]">

                    {/* User */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#EDE9FE] text-xs font-bold text-[#20243A]">
                          {initials(user.name)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#20243A]">{user.name}</p>
                          <p className="text-xs text-[#94A3B8]">{user.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-5 py-3.5">
                      <RoleBadge platformRole={user.platformRole} />
                    </td>

                    {/* Organizations */}
                    <td className="px-5 py-3.5">
                      {user.memberships.length === 0 ? (
                        <span className="text-xs text-[#C7CCD9]">None</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {user.memberships.slice(0, 2).map((m) => (
                            <span key={m.id} className="flex items-center gap-1 text-xs text-[#475569]">
                              <Globe size={10} className="text-[#94A3B8]" />
                              {m.organization.name}
                            </span>
                          ))}
                          {user.memberships.length > 2 && (
                            <span className="text-xs text-[#94A3B8]">+{user.memberships.length - 2} more</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <StatusBadge isActive={user.isActive} locked={isLocked} />
                    </td>

                    {/* Last Login */}
                    <td className="px-5 py-3.5 text-xs text-[#666B84]">
                      {user.lastLoginAt ? (
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {fmtDateTime(user.lastLoginAt)}
                        </span>
                      ) : (
                        <span className="text-[#C7CCD9]">Never</span>
                      )}
                    </td>

                    {/* Joined */}
                    <td className="px-5 py-3.5 text-xs text-[#666B84]">
                      {fmtDate(user.createdAt)}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                        {isLocked && (
                          <button
                            onClick={() => setPending({ type: "unlock", userId: user.id, name: user.name })}
                            title="Unlock"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#D97706] transition hover:bg-[#FEF3C7]"
                          >
                            <Lock size={14} />
                          </button>
                        )}
                        {user.isActive ? (
                          <button
                            onClick={() => setPending({ type: "deactivate", userId: user.id, name: user.name })}
                            title="Deactivate"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#94A3B8] transition hover:bg-[#FEF2F2] hover:text-[#DC2626]"
                          >
                            <UserX size={14} />
                          </button>
                        ) : (
                          <button
                            onClick={() => setPending({ type: "activate", userId: user.id, name: user.name })}
                            title="Activate"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#94A3B8] transition hover:bg-[#F0FDF4] hover:text-[#16A34A]"
                          >
                            <UserCheck size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {!loading && pages > 1 && (
          <div className="flex items-center justify-between border-t border-[#F1F5F9] px-5 py-3">
            <p className="text-xs text-[#94A3B8]">
              Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total} users
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-[#ECECF3] px-3 py-1.5 text-xs font-medium text-[#475569] transition hover:bg-[#F8F9FC] disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-[#94A3B8]">Page {page} of {pages}</span>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="rounded-lg border border-[#ECECF3] px-3 py-1.5 text-xs font-medium text-[#475569] transition hover:bg-[#F8F9FC] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm modal */}
      {pending !== null && (
        <ConfirmModal
          title={
            pending.type === "deactivate" ? "Deactivate User" :
            pending.type === "activate"   ? "Activate User"   :
                                           "Unlock Account"
          }
          message={
            pending.type === "deactivate"
              ? `This will block ${pending.name} from logging in. You can reactivate them at any time.`
              : pending.type === "activate"
              ? `This will restore ${pending.name}'s access to the platform.`
              : `This will clear the login lockout for ${pending.name} and reset their failed attempt counter.`
          }
          confirmLabel={
            pending.type === "deactivate" ? "Deactivate" :
            pending.type === "activate"   ? "Activate"   :
                                           "Unlock"
          }
          confirmClass={
            pending.type === "deactivate"
              ? "bg-[#DC2626] hover:bg-[#B91C1C]"
              : "bg-[#20243A] hover:bg-[#5B4DE0]"
          }
          onConfirm={handleConfirm}
          onCancel={() => setPending(null)}
          loading={actioning}
        />
      )}
    </div>
  );
}
