import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  CheckCircle,
  ChevronDown,
  Globe,
  Loader2,
  Plus,
  Search,
  Trash2,
  Users,
  X,
  XCircle,
} from "lucide-react";

import {
  getOrganizations,
  createOrganization,
  deleteOrganization,
} from "../../services/platformOrganizations";

import type { Organization } from "../../services/platformOrganizations";

/* ─── helpers ─────────────────────────────────────────── */

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const STATUS_COLORS: Record<
  string,
  { bg: string; text: string; dot: string; label: string }
> = {
  ACTIVE: {
    bg: "bg-[#DCFCE7]",
    text: "text-[#16A34A]",
    dot: "bg-[#16A34A]",
    label: "Active",
  },
  PENDING: {
    bg: "bg-[#FEF9C3]",
    text: "text-[#CA8A04]",
    dot: "bg-[#CA8A04]",
    label: "Pending",
  },
  SUSPENDED: {
    bg: "bg-[#FEE2E2]",
    text: "text-[#DC2626]",
    dot: "bg-[#DC2626]",
    label: "Suspended",
  },
};

function StatusChip({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? {
    bg: "bg-[#F1F5F9]",
    text: "text-[#64748B]",
    dot: "bg-[#94A3B8]",
    label: status,
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${c.bg} ${c.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

function OrgAvatar({ org }: { org: Organization }) {
  const [imgFailed, setImgFailed] = useState(false);
  if (org.logoUrl && !imgFailed) {
    return (
      <img
        src={org.logoUrl}
        alt={org.name}
        onError={() => setImgFailed(true)}
        className="h-9 w-9 rounded-lg border border-[#ECECF3] object-contain"
      />
    );
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#6D5DF6] text-xs font-bold text-white">
      {initials(org.name)}
    </div>
  );
}

/* ─── empty state ──────────────────────────────────────── */

function EmptyState({
  filtered,
  onClear,
}: {
  filtered: boolean;
  onClear: () => void;
}) {
  return (
    <div className="py-20 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F1F5F9]">
        <Building2 size={24} className="text-[#C7CCD9]" />
      </div>
      <p className="mt-4 text-sm font-medium text-[#20243A]">
        {filtered ? "No organizations match your filters" : "No organizations yet"}
      </p>
      <p className="mt-1 text-xs text-[#94A3B8]">
        {filtered
          ? "Try adjusting your search or status filter."
          : "Create your first organization to get started."}
      </p>
      {filtered && (
        <button
          onClick={onClear}
          className="mt-4 text-xs font-medium text-[#6D5DF6] hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

/* ─── create modal ─────────────────────────────────────── */

const EMPTY_FORM = {
  name: "",
  country: "",
  currency: "",
  legalName: "",
  registrationNumber: "",
  taxNumber: "",
  email: "",
  phoneNumber: "",
  address: "",
  logoUrl: "",
};

function CreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  function set(key: keyof typeof EMPTY_FORM, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError("Organization name is required.");
      return;
    }
    if (!form.country.trim()) {
      setError("Country is required.");
      return;
    }
    if (!form.currency.trim()) {
      setError("Currency is required.");
      return;
    }

    setSaving(true);
    try {
      await createOrganization({
        name: form.name.trim(),
        country: form.country.trim(),
        currency: form.currency.trim(),
        legalName: form.legalName.trim() || undefined,
        registrationNumber: form.registrationNumber.trim() || undefined,
        taxNumber: form.taxNumber.trim() || undefined,
        email: form.email.trim() || undefined,
        phoneNumber: form.phoneNumber.trim() || undefined,
        address: form.address.trim() || undefined,
        logoUrl: form.logoUrl.trim() || undefined,
      });
      onCreated();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to create organization.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-[#ECECF3] bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#F1F5F9] px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-[#20243A]">
              New Organization
            </h2>
            <p className="mt-0.5 text-xs text-[#94A3B8]">
              New organizations start as Pending and must be approved.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#94A3B8] transition hover:bg-[#F1F5F9] hover:text-[#20243A]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="max-h-[70vh] overflow-y-auto px-6 py-5">

            {error && (
              <div className="mb-5 flex items-center gap-2 rounded-xl bg-[#FEF2F2] px-4 py-3 text-sm text-[#DC2626]">
                <XCircle size={15} className="flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Required */}
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
              Required
            </p>
            <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <ModalField
                  ref={nameRef}
                  label="Organization Name"
                  required
                  value={form.name}
                  onChange={(v) => set("name", v)}
                  placeholder="Acme Corp"
                />
              </div>
              <ModalField
                label="Country"
                required
                value={form.country}
                onChange={(v) => set("country", v)}
                placeholder="KE"
              />
              <ModalField
                label="Currency"
                required
                value={form.currency}
                onChange={(v) => set("currency", v)}
                placeholder="KES"
              />
            </div>

            {/* Optional */}
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
              Optional
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ModalField
                label="Legal Name"
                value={form.legalName}
                onChange={(v) => set("legalName", v)}
                placeholder="Acme Corporation Ltd"
              />
              <ModalField
                label="Registration Number"
                value={form.registrationNumber}
                onChange={(v) => set("registrationNumber", v)}
                placeholder="CPR/2021/..."
              />
              <ModalField
                label="Tax Number (KRA PIN)"
                value={form.taxNumber}
                onChange={(v) => set("taxNumber", v)}
                placeholder="A000000000Z"
              />
              <ModalField
                label="Email Address"
                type="email"
                value={form.email}
                onChange={(v) => set("email", v)}
                placeholder="finance@acme.co.ke"
              />
              <ModalField
                label="Phone Number"
                value={form.phoneNumber}
                onChange={(v) => set("phoneNumber", v)}
                placeholder="+254 700 000 000"
              />
              <ModalField
                label="Address"
                value={form.address}
                onChange={(v) => set("address", v)}
                placeholder="Nairobi, Kenya"
              />
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-[#475569]">
                  Logo URL
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-[#ECECF3] bg-[#F8F9FC]">
                    {form.logoUrl ? (
                      <img
                        src={form.logoUrl}
                        alt="preview"
                        className="h-8 w-8 rounded object-contain"
                        onError={(e) =>
                          ((e.target as HTMLImageElement).style.display = "none")
                        }
                      />
                    ) : (
                      <Building2 size={16} className="text-[#C7CCD9]" />
                    )}
                  </div>
                  <input
                    type="url"
                    value={form.logoUrl}
                    onChange={(e) => set("logoUrl", e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="h-10 flex-1 rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3 text-sm outline-none transition focus:border-[#6D5DF6] focus:ring-2 focus:ring-[#6D5DF6]/10"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-[#F1F5F9] px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-[#ECECF3] px-5 py-2.5 text-sm font-medium text-[#666B84] transition hover:bg-[#F8F9FC] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-[#6D5DF6] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#5B4DE0] disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus size={14} />
                  Create Organization
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const ModalField = React.forwardRef<
  HTMLInputElement,
  {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: string;
    required?: boolean;
  }
>(function ModalField(
  { label, value, onChange, placeholder, type = "text", required = false },
  ref
) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-[#475569]">
        {label}
        {required && <span className="ml-0.5 text-[#EF4444]">*</span>}
      </label>
      <input
        ref={ref}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3 text-sm outline-none transition focus:border-[#6D5DF6] focus:ring-2 focus:ring-[#6D5DF6]/10"
      />
    </div>
  );
});

/* ─── delete confirm ───────────────────────────────────── */

function DeleteModal({
  org,
  onClose,
  onDeleted,
}: {
  org: Organization;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setDeleting(true);
    setError(null);
    try {
      await deleteOrganization(org.id);
      onDeleted();
    } catch {
      setError("Delete failed. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-2xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FEF2F2]">
          <Trash2 size={20} className="text-[#DC2626]" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-[#20243A]">
          Delete organization?
        </h3>
        <p className="mt-2 text-sm text-[#666B84]">
          <span className="font-medium text-[#20243A]">{org.name}</span> and
          all its data will be permanently deleted. This cannot be undone.
        </p>
        {error && (
          <p className="mt-3 text-sm text-[#DC2626]">{error}</p>
        )}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={deleting}
            className="rounded-xl border border-[#ECECF3] px-5 py-2.5 text-sm font-medium text-[#666B84] transition hover:bg-[#F8F9FC] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-xl bg-[#DC2626] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#B91C1C] disabled:opacity-50"
          >
            {deleting ? (
              <><Loader2 size={14} className="animate-spin" /> Deleting...</>
            ) : (
              "Delete"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── main page ────────────────────────────────────────── */

import React from "react";

type StatusFilter = "ALL" | "ACTIVE" | "PENDING" | "SUSPENDED";

export default function Organizations() {
  const navigate = useNavigate();

  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Organization | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setFetchError(null);
      const res = await getOrganizations();
      setOrgs(res.organizations);
    } catch {
      setFetchError("Unable to load organizations. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  /* stats */
  const total = orgs.length;
  const active = orgs.filter((o) => o.status === "ACTIVE").length;
  const pending = orgs.filter((o) => o.status === "PENDING").length;
  const suspended = orgs.filter((o) => o.status === "SUSPENDED").length;

  /* filtered list */
  const filtered = orgs.filter((o) => {
    const matchStatus =
      statusFilter === "ALL" || o.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      o.name.toLowerCase().includes(q) ||
      o.slug.toLowerCase().includes(q) ||
      o.country.toLowerCase().includes(q) ||
      (o.email ?? "").toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const isFiltered = search !== "" || statusFilter !== "ALL";

  /* ── render ─────────────────────────────────────────── */

  return (
    <>
      <div className="space-y-6">

        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#20243A]">
              Organizations
            </h1>
            <p className="mt-1 text-sm text-[#666B84]">
              Manage all organizations on the Ziya Financial Operating System.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#6D5DF6] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#5B4DE0]"
          >
            <Plus size={15} />
            New Organization
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total", value: total, color: "#20243A" },
            { label: "Active", value: active, color: "#16A34A" },
            { label: "Pending", value: pending, color: "#CA8A04" },
            { label: "Suspended", value: suspended, color: "#DC2626" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="rounded-2xl border border-[#ECECF3] bg-white px-5 py-4 shadow-sm"
            >
              <p className="text-xs font-medium text-[#94A3B8]">{label}</p>
              <p
                className="mt-1.5 text-3xl font-bold"
                style={{ color }}
              >
                {loading ? "—" : value}
              </p>
            </div>
          ))}
        </div>

        {/* Table card */}
        <div className="rounded-2xl border border-[#ECECF3] bg-white shadow-sm">

          {/* Toolbar */}
          <div className="flex items-center gap-3 border-b border-[#F1F5F9] px-5 py-4">
            <div className="relative flex-1 max-w-sm">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search organizations..."
                className="h-9 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] pl-9 pr-4 text-sm outline-none transition focus:border-[#6D5DF6] focus:ring-2 focus:ring-[#6D5DF6]/10"
              />
            </div>

            {/* Status filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as StatusFilter)
                }
                className="h-9 appearance-none rounded-xl border border-[#ECECF3] bg-[#F8F9FC] pl-3 pr-8 text-sm text-[#20243A] outline-none transition focus:border-[#6D5DF6]"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="PENDING">Pending</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]"
              />
            </div>
          </div>

          {/* Loading */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2
                size={24}
                className="animate-spin text-[#6D5DF6]"
              />
            </div>
          ) : fetchError ? (
            <div className="py-20 text-center">
              <XCircle size={28} className="mx-auto text-[#EF4444]" />
              <p className="mt-3 text-sm text-[#666B84]">{fetchError}</p>
              <button
                onClick={load}
                className="mt-3 text-sm font-medium text-[#6D5DF6] hover:underline"
              >
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              filtered={isFiltered}
              onClear={() => {
                setSearch("");
                setStatusFilter("ALL");
              }}
            />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F1F5F9]">
                  {[
                    "Organization",
                    "Country",
                    "Currency",
                    "Members",
                    "Status",
                    "Created",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#94A3B8]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F8F9FC]">
                {filtered.map((org) => (
                  <OrgRow
                    key={org.id}
                    org={org}
                    onView={() =>
                      navigate(`/platform/organizations/${org.id}`)
                    }
                    onWorkspace={() =>
                      navigate(`/platform/workspace/${org.id}`)
                    }
                    onDelete={() => setDeleteTarget(org)}
                  />
                ))}
              </tbody>
            </table>
          )}

          {/* Footer count */}
          {!loading && !fetchError && filtered.length > 0 && (
            <div className="border-t border-[#F8F9FC] px-5 py-3">
              <p className="text-xs text-[#94A3B8]">
                Showing {filtered.length} of {total} organization
                {total !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            void load();
          }}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          org={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null);
            void load();
          }}
        />
      )}
    </>
  );
}

/* ─── table row ────────────────────────────────────────── */

function OrgRow({
  org,
  onView,
  onWorkspace,
  onDelete,
}: {
  org: Organization;
  onView: () => void;
  onWorkspace: () => void;
  onDelete: () => void;
}) {
  return (
    <tr className="group transition hover:bg-[#F8F9FC]">
      {/* Org */}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <OrgAvatar org={org} />
          <div>
            <button
              onClick={onView}
              className="text-sm font-semibold text-[#20243A] transition hover:text-[#6D5DF6]"
            >
              {org.name}
            </button>
            <p className="text-xs text-[#94A3B8]">@{org.slug}</p>
          </div>
        </div>
      </td>

      {/* Country */}
      <td className="px-5 py-3.5">
        <span className="inline-flex items-center gap-1.5 text-sm text-[#475569]">
          <Globe size={13} className="text-[#C7CCD9]" />
          {org.country}
        </span>
      </td>

      {/* Currency */}
      <td className="px-5 py-3.5 text-sm font-medium text-[#20243A]">
        {org.currency}
      </td>

      {/* Members */}
      <td className="px-5 py-3.5">
        <span className="inline-flex items-center gap-1.5 text-sm text-[#475569]">
          <Users size={13} className="text-[#C7CCD9]" />
          {org.memberCount}
        </span>
      </td>

      {/* Status */}
      <td className="px-5 py-3.5">
        <StatusChip status={org.status} />
      </td>

      {/* Created */}
      <td className="px-5 py-3.5 text-sm text-[#94A3B8]">
        {fmtDate(org.createdAt)}
      </td>

      {/* Actions */}
      <td className="px-5 py-3.5">
        <div className="flex items-center justify-end gap-1 opacity-0 transition group-hover:opacity-100">
          <ActionBtn
            label="Open Workspace"
            onClick={onWorkspace}
            variant="primary"
          />
          <ActionBtn label="View Details" onClick={onView} variant="ghost" />
          <button
            onClick={onDelete}
            title="Delete"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#94A3B8] transition hover:bg-[#FEF2F2] hover:text-[#DC2626]"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function ActionBtn({
  label,
  onClick,
  variant,
}: {
  label: string;
  onClick: () => void;
  variant: "primary" | "ghost";
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
        variant === "primary"
          ? "bg-[#6D5DF6] text-white hover:bg-[#5B4DE0]"
          : "border border-[#ECECF3] text-[#475569] hover:bg-[#F1F5F9]"
      }`}
    >
      {label}
    </button>
  );
}