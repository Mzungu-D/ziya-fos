import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CheckCircle,
  Clock,
  Edit2,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  Search,
  Shield,
  Users,
  X,
  XCircle,
} from "lucide-react";

import {
  getOrganization,
  updateOrganization,
  approveOrganization,
  suspendOrganization,
  activateOrganization,
} from "../../services/platformOrganizations";

import type {
  OrganizationDetails,
  OrganizationMember,
} from "../../services/platformOrganizations";

/* ─── helpers ─────────────────────────────────────────── */

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/* ─── status badge ─────────────────────────────────────── */

const STATUS_CFG: Record<
  string,
  { bg: string; text: string; dot: string; label: string }
> = {
  ACTIVE:    { bg: "bg-[#DCFCE7]", text: "text-[#16A34A]", dot: "bg-[#16A34A]", label: "Active"    },
  PENDING:   { bg: "bg-[#FEF9C3]", text: "text-[#CA8A04]", dot: "bg-[#CA8A04]", label: "Pending"   },
  SUSPENDED: { bg: "bg-[#FEE2E2]", text: "text-[#DC2626]", dot: "bg-[#DC2626]", label: "Suspended" },
};

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CFG[status] ?? {
    bg: "bg-[#F1F5F9]",
    text: "text-[#64748B]",
    dot: "bg-[#94A3B8]",
    label: status,
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${c.bg} ${c.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

/* ─── role badge ───────────────────────────────────────── */

const ROLE_CFG: Record<string, string> = {
  OWNER:  "bg-[#EDE9FE] text-[#6D28D9]",
  ADMIN:  "bg-[#DBEAFE] text-[#1D4ED8]",
  MEMBER: "bg-[#F1F5F9] text-[#475569]",
  VIEWER: "bg-[#F0FDF4] text-[#15803D]",
};

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        ROLE_CFG[role] ?? "bg-[#F1F5F9] text-[#475569]"
      }`}
    >
      {role}
    </span>
  );
}

/* ─── org avatar ───────────────────────────────────────── */

function OrgAvatar({
  org,
  size = 60,
}: {
  org: OrganizationDetails;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  if (org.logoUrl && !failed) {
    return (
      <img
        src={org.logoUrl}
        alt={org.name}
        onError={() => setFailed(true)}
        className="rounded-xl border border-[#ECECF3] object-contain"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="flex items-center justify-center rounded-xl bg-[#0D9488] font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.28 }}
    >
      {initials(org.name)}
    </div>
  );
}

/* ─── detail row ───────────────────────────────────────── */

function DetailRow({
  label,
  value,
  icon,
}: {
  label: string;
  value?: string | null;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[#F8F9FC] py-2.5 last:border-0">
      <span className="text-xs text-[#94A3B8]">{label}</span>
      <span className="flex items-center gap-1.5 text-sm font-medium text-[#20243A]">
        {icon}
        {value != null && value !== "" ? (
          value
        ) : (
          <span className="text-[#C7CCD9]">—</span>
        )}
      </span>
    </div>
  );
}

/* ─── form field ───────────────────────────────────────── */

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-[#475569]">
        {label}
        {required && <span className="ml-0.5 text-[#EF4444]">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3 text-sm outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
      />
    </div>
  );
}

/* ─── member row ───────────────────────────────────────── */

function MemberRow({ member }: { member: OrganizationMember }) {
  return (
    <tr className="transition hover:bg-[#F8F9FC]">
      <td className="px-6 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EDE9FE] text-xs font-bold text-[#20243A]">
            {initials(member.user.name)}
          </div>
          <div>
            <p className="text-sm font-medium text-[#20243A]">
              {member.user.name}
            </p>
            <p className="text-xs text-[#94A3B8]">{member.user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-3.5">
        <RoleBadge role={member.role} />
      </td>
      <td className="px-6 py-3.5">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            member.isActive
              ? "bg-[#DCFCE7] text-[#16A34A]"
              : "bg-[#FEE2E2] text-[#DC2626]"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              member.isActive ? "bg-[#16A34A]" : "bg-[#DC2626]"
            }`}
          />
          {member.isActive ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-6 py-3.5 text-sm text-[#666B84]">
        {fmtDate(member.joinedAt)}
      </td>
      <td className="px-6 py-3.5 text-sm text-[#666B84]">
        {member.user.lastLoginAt ? (
          fmtDate(member.user.lastLoginAt)
        ) : (
          <span className="text-[#C7CCD9]">Never</span>
        )}
      </td>
    </tr>
  );
}

/* ─── main page ────────────────────────────────────────── */

type Tab = "overview" | "members" | "settings";

export default function PlatformOrganizationDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [org, setOrg] = useState<OrganizationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  const [actioning, setActioning] = useState(false);
  const [actionMsg, setActionMsg] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const [form, setForm] = useState({
    name: "",
    legalName: "",
    registrationNumber: "",
    taxNumber: "",
    email: "",
    phoneNumber: "",
    address: "",
    currency: "",
    logoUrl: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const [memberQ, setMemberQ] = useState("");

  useEffect(() => {
    if (id) void load(id);
  }, [id]);

  async function load(oid: string) {
    try {
      setLoading(true);
      setFetchError(null);
      const res = await getOrganization(oid);
      setOrg(res.organization);
      const o = res.organization;
      setForm({
        name:               o.name               ?? "",
        legalName:          o.legalName          ?? "",
        registrationNumber: o.registrationNumber ?? "",
        taxNumber:          o.taxNumber          ?? "",
        email:              o.email              ?? "",
        phoneNumber:        o.phoneNumber        ?? "",
        address:            o.address            ?? "",
        currency:           o.currency           ?? "",
        logoUrl:            o.logoUrl            ?? "",
      });
    } catch {
      setFetchError("Unable to load organization.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action: "approve" | "suspend" | "activate") {
    if (!id) return;
    setActioning(true);
    setActionMsg(null);
    try {
      if (action === "approve")       await approveOrganization(id);
      else if (action === "suspend")  await suspendOrganization(id);
      else                            await activateOrganization(id);

      const text =
        action === "approve"  ? "Organization approved."   :
        action === "suspend"  ? "Organization suspended."  :
                                "Organization reactivated.";

      setActionMsg({ ok: true, text });
      await load(id);
      setTimeout(() => setActionMsg(null), 3500);
    } catch {
      setActionMsg({ ok: false, text: "Action failed. Please try again." });
    } finally {
      setActioning(false);
    }
  }

  async function handleSave() {
    if (!id) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await updateOrganization(id, form);
      setSaveMsg({ ok: true, text: "Changes saved." });
      await load(id);
      setTimeout(() => setSaveMsg(null), 3500);
    } catch {
      setSaveMsg({ ok: false, text: "Save failed. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  const filteredMembers = (org?.members ?? []).filter((m) => {
    const q = memberQ.toLowerCase();
    return (
      !q ||
      m.user.name.toLowerCase().includes(q) ||
      m.user.email.toLowerCase().includes(q) ||
      m.role.toLowerCase().includes(q)
    );
  });

  /* ── loading ─────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex h-80 items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[#20243A]" />
      </div>
    );
  }

  if (fetchError || !org) {
    return (
      <div className="flex h-80 flex-col items-center justify-center gap-3 text-center">
        <XCircle size={36} className="text-[#EF4444]" />
        <p className="text-sm text-[#666B84]">
          {fetchError ?? "Organization not found."}
        </p>
        <button
          onClick={() => navigate("/platform/organizations")}
          className="text-sm font-medium text-[#20243A] hover:underline"
        >
          Back to Organizations
        </button>
      </div>
    );
  }

  /* ── render ──────────────────────────────────────────── */

  return (
    <div className="space-y-5">

      {/* Back */}
      <button
        onClick={() => navigate("/platform/organizations")}
        className="inline-flex items-center gap-1.5 text-sm text-[#94A3B8] transition hover:text-[#20243A]"
      >
        <ArrowLeft size={14} />
        Organizations
      </button>

      {/* ── HEADER CARD ── */}
      <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">

          {/* Left: logo + info */}
          <div className="flex items-center gap-5">
            <OrgAvatar org={org} size={60} />
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-[#20243A]">
                  {org.name}
                </h1>
                <StatusBadge status={org.status} />
              </div>
              <p className="mt-1 text-sm text-[#94A3B8]">
                @{org.slug}
                {org.legalName && (
                  <span className="ml-3 text-[#C7CCD9]">· {org.legalName}</span>
                )}
              </p>
              <div className="mt-2 flex items-center gap-4 text-xs text-[#94A3B8]">
                <span className="flex items-center gap-1">
                  <Users size={11} />
                  {org.memberCount} member{org.memberCount !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1">
                  <Globe size={11} />
                  {org.country}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  Joined {fmtDate(org.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-2">
            {org.status === "PENDING" && (
              <button
                onClick={() => handleAction("approve")}
                disabled={actioning}
                className="inline-flex items-center gap-2 rounded-xl bg-[#16A34A] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#15803D] disabled:opacity-50"
              >
                <CheckCircle size={14} />
                Approve
              </button>
            )}
            {org.status === "ACTIVE" && (
              <button
                onClick={() => handleAction("suspend")}
                disabled={actioning}
                className="inline-flex items-center gap-2 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-2 text-sm font-medium text-[#DC2626] transition hover:bg-[#FEE2E2] disabled:opacity-50"
              >
                <XCircle size={14} />
                Suspend
              </button>
            )}
            {org.status === "SUSPENDED" && (
              <button
                onClick={() => handleAction("activate")}
                disabled={actioning}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0D9488] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#5B4DE0] disabled:opacity-50"
              >
                <CheckCircle size={14} />
                Reactivate
              </button>
            )}
            <button
              onClick={() => navigate(`/platform/workspace/${org.id}`)}
              className="inline-flex items-center gap-2 rounded-xl border border-[#ECECF3] bg-white px-4 py-2 text-sm font-medium text-[#20243A] transition hover:bg-[#F8F9FC]"
            >
              <ExternalLink size={14} />
              Workspace
            </button>
            <button
              onClick={() => setTab("settings")}
              className="inline-flex items-center gap-2 rounded-xl border border-[#ECECF3] bg-white px-4 py-2 text-sm font-medium text-[#20243A] transition hover:bg-[#F8F9FC]"
            >
              <Edit2 size={14} />
              Edit
            </button>
          </div>
        </div>

        {/* Action feedback */}
        {actionMsg !== null && (
          <div
            className={`mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
              actionMsg.ok
                ? "bg-[#F0FDF4] text-[#16A34A]"
                : "bg-[#FEF2F2] text-[#DC2626]"
            }`}
          >
            {actionMsg.ok ? (
              <CheckCircle size={15} />
            ) : (
              <XCircle size={15} />
            )}
            {actionMsg.text}
          </div>
        )}
      </div>

      {/* ── TABS ── */}
      <div className="flex gap-1 rounded-2xl border border-[#ECECF3] bg-white p-1.5 shadow-sm">
        {(
          [
            { key: "overview", label: "Overview", Icon: Building2 },
            { key: "members",  label: "Members",  Icon: Users     },
            { key: "settings", label: "Settings", Icon: Shield    },
          ] as { key: Tab; label: string; Icon: React.ElementType }[]
        ).map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition ${
              tab === key
                ? "bg-[#0D9488] text-white shadow-sm"
                : "text-[#666B84] hover:bg-[#F8F9FC]"
            }`}
          >
            <Icon size={14} />
            {label}
            {key === "members" && (
              <span
                className={`ml-1 rounded-full px-2 py-0.5 text-xs ${
                  tab === "members"
                    ? "bg-white/20 text-white"
                    : "bg-[#F1F5F9] text-[#666B84]"
                }`}
              >
                {org.memberCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === "overview" && (
        <div className="grid grid-cols-2 gap-5">

          <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
              Organization Details
            </p>
            <div className="space-y-0.5">
              <DetailRow label="Legal Name"           value={org.legalName} />
              <DetailRow label="Registration Number"  value={org.registrationNumber} />
              <DetailRow label="Tax Number (KRA PIN)" value={org.taxNumber} />
              <DetailRow
                label="Country"
                value={org.country}
                icon={<Globe size={13} />}
              />
              <DetailRow label="Currency" value={org.currency} />
            </div>
          </div>

          <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
              Contact Information
            </p>
            <div className="space-y-0.5">
              <DetailRow
                label="Email"
                value={org.email}
                icon={<Mail size={13} />}
              />
              <DetailRow
                label="Phone"
                value={org.phoneNumber}
                icon={<Phone size={13} />}
              />
              <DetailRow
                label="Address"
                value={org.address}
                icon={<MapPin size={13} />}
              />
            </div>
          </div>

          <div className="col-span-2 rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
              Platform Information
            </p>
            <div className="grid grid-cols-4 gap-6">
              <div>
                <p className="text-xs text-[#94A3B8]">Status</p>
                <div className="mt-2">
                  <StatusBadge status={org.status} />
                </div>
              </div>
              <div>
                <p className="text-xs text-[#94A3B8]">Members</p>
                <p className="mt-2 text-2xl font-bold text-[#20243A]">
                  {org.memberCount}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#94A3B8]">Registered</p>
                <p className="mt-2 text-sm font-medium text-[#20243A]">
                  {fmtDate(org.createdAt)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#94A3B8]">Last Updated</p>
                <p className="mt-2 text-sm font-medium text-[#20243A]">
                  {fmtDate(org.updatedAt)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MEMBERS TAB ── */}
      {tab === "members" && (
        <div className="rounded-2xl border border-[#ECECF3] bg-white shadow-sm">
          <div className="border-b border-[#F1F5F9] px-5 py-4">
            <div className="relative max-w-sm">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
              />
              <input
                type="text"
                value={memberQ}
                onChange={(e) => setMemberQ(e.target.value)}
                placeholder="Search members..."
                className="h-9 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] pl-9 pr-3 text-sm outline-none transition focus:border-[#0D9488]"
              />
            </div>
          </div>

          {filteredMembers.length === 0 ? (
            <div className="py-16 text-center">
              <Users size={28} className="mx-auto text-[#C7CCD9]" />
              <p className="mt-3 text-sm text-[#666B84]">No members found.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F1F5F9]">
                  {["Member", "Role", "Status", "Joined", "Last Login"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#94A3B8]"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F8F9FC]">
                {filteredMembers.map((m) => (
                  <MemberRow key={m.id} member={m} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── SETTINGS TAB ── */}
      {tab === "settings" && (
        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
          <p className="mb-5 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
            Edit Organization
          </p>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Organization Name"
              required
              value={form.name}
              onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            />
            <Field
              label="Legal Name"
              value={form.legalName}
              onChange={(v) => setForm((f) => ({ ...f, legalName: v }))}
            />
            <Field
              label="Registration Number"
              value={form.registrationNumber}
              onChange={(v) =>
                setForm((f) => ({ ...f, registrationNumber: v }))
              }
            />
            <Field
              label="Tax Number (KRA PIN)"
              value={form.taxNumber}
              onChange={(v) => setForm((f) => ({ ...f, taxNumber: v }))}
            />
            <Field
              label="Email"
              type="email"
              value={form.email}
              onChange={(v) => setForm((f) => ({ ...f, email: v }))}
            />
            <Field
              label="Phone Number"
              value={form.phoneNumber}
              onChange={(v) => setForm((f) => ({ ...f, phoneNumber: v }))}
            />
            <Field
              label="Address"
              value={form.address}
              onChange={(v) => setForm((f) => ({ ...f, address: v }))}
            />
            <Field
              label="Currency"
              value={form.currency}
              onChange={(v) => setForm((f) => ({ ...f, currency: v }))}
            />

            {/* Logo URL with live preview */}
            <div className="col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[#475569]">
                Organization Logo URL
              </label>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-[#ECECF3] bg-[#F8F9FC]">
                  {form.logoUrl ? (
                    <img
                      src={form.logoUrl}
                      alt="preview"
                      className="h-9 w-9 rounded-lg object-contain"
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
                  onChange={(e) =>
                    setForm((f) => ({ ...f, logoUrl: e.target.value }))
                  }
                  placeholder="https://example.com/logo.png"
                  className="h-10 flex-1 rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3 text-sm outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
                />
              </div>
              <p className="mt-1.5 text-xs text-[#94A3B8]">
                Each organization shows its own logo — not the Ziya platform logo.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 flex items-center justify-between border-t border-[#F1F5F9] pt-5">
            <div>
              {saveMsg !== null && (
                <span
                  className={`flex items-center gap-2 text-sm ${
                    saveMsg.ok ? "text-[#16A34A]" : "text-[#DC2626]"
                  }`}
                >
                  {saveMsg.ok ? (
                    <CheckCircle size={14} />
                  ) : (
                    <X size={14} />
                  )}
                  {saveMsg.text}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setTab("overview")}
                className="rounded-xl border border-[#ECECF3] px-5 py-2.5 text-sm font-medium text-[#666B84] transition hover:bg-[#F8F9FC]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0D9488] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#5B4DE0] disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

