import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CheckCircle,
  Clock,
  Eye,
  Globe,
  Loader2,
  Mail,
  Phone,
  Shield,
  Users,
  XCircle,
} from "lucide-react";

import {
  getOrganization,
  approveOrganization,
  suspendOrganization,
  activateOrganization,
} from "../../services/platformOrganizations";

import type { OrganizationDetails } from "../../services/platformOrganizations";

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

const STATUS_CFG: Record<
  string,
  { bg: string; text: string; dot: string; label: string }
> = {
  ACTIVE:    { bg: "bg-[#DCFCE7]", text: "text-[#16A34A]", dot: "bg-[#16A34A]", label: "Active"         },
  PENDING:   { bg: "bg-[#FEF9C3]", text: "text-[#CA8A04]", dot: "bg-[#CA8A04]", label: "Pending Review" },
  SUSPENDED: { bg: "bg-[#FEE2E2]", text: "text-[#DC2626]", dot: "bg-[#DC2626]", label: "Suspended"      },
};

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CFG[status] ?? {
    bg: "bg-[#F1F5F9]",
    text: "text-[#64748B]",
    dot: "bg-[#94A3B8]",
    label: status,
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

function OrgAvatar({ org, size = 52 }: { org: OrganizationDetails; size?: number }) {
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

function StatCard({
  label,
  value,
  sub,
  color = "#20243A",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-[#94A3B8]">{label}</p>
      <p className="mt-2 text-3xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="mt-1 text-xs text-[#94A3B8]">{sub}</p>}
    </div>
  );
}

function ConfigItem({
  label,
  value,
  icon,
}: {
  label: string;
  value?: string | null;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-[#F8F9FC] px-4 py-3">
      <span className="flex items-center gap-2 text-xs text-[#94A3B8]">
        {icon}
        {label}
      </span>
      <span className="text-xs font-medium text-[#20243A]">
        {value != null && value !== "" ? value : <span className="text-[#C7CCD9]">Not set</span>}
      </span>
    </div>
  );
}

export default function PlatformOrganizationWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [org, setOrg] = useState<OrganizationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actioning, setActioning] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (id) void load(id);
  }, [id]);

  async function load(oid: string) {
    try {
      setLoading(true);
      setFetchError(null);
      const res = await getOrganization(oid);
      setOrg(res.organization);
    } catch {
      setFetchError("Unable to load workspace.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action: "approve" | "suspend" | "activate") {
    if (!id) return;
    setActioning(true);
    setActionMsg(null);
    try {
      if (action === "approve")      await approveOrganization(id);
      else if (action === "suspend") await suspendOrganization(id);
      else                           await activateOrganization(id);

      const text =
        action === "approve" ? "Organization approved."  :
        action === "suspend" ? "Organization suspended." :
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
        <p className="text-sm text-[#666B84]">{fetchError ?? "Workspace not found."}</p>
        <button
          onClick={() => navigate("/platform/organizations")}
          className="text-sm font-medium text-[#20243A] hover:underline"
        >
          Back to Organizations
        </button>
      </div>
    );
  }

  const activeMembers   = org.members.filter((m) => m.isActive).length;
  const inactiveMembers = org.members.length - activeMembers;
  const owners          = org.members.filter((m) => m.role === "OWNER");

  return (
    <div className="space-y-5">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
        <button onClick={() => navigate("/platform/organizations")} className="transition hover:text-[#20243A]">
          Organizations
        </button>
        <span>/</span>
        <button onClick={() => navigate(`/platform/organizations/${org.id}`)} className="transition hover:text-[#20243A]">
          {org.name}
        </button>
        <span>/</span>
        <span className="font-medium text-[#20243A]">Workspace</span>
      </div>

      {/* Header */}
      <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/platform/organizations/${org.id}`)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#ECECF3] text-[#94A3B8] transition hover:bg-[#F8F9FC] hover:text-[#20243A]"
            >
              <ArrowLeft size={16} />
            </button>
            <OrgAvatar org={org} size={52} />
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-[#20243A]">{org.name}</h1>
                <StatusBadge status={org.status} />
              </div>
              <p className="mt-0.5 text-sm text-[#94A3B8]">Workspace Overview · @{org.slug}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/platform/organizations/${org.id}`)}
              className="inline-flex items-center gap-2 rounded-xl border border-[#ECECF3] bg-white px-4 py-2 text-sm font-medium text-[#20243A] transition hover:bg-[#F8F9FC]"
            >
              <Eye size={14} />
              View Details
            </button>
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
          </div>
        </div>

        {actionMsg !== null && (
          <div className={`mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${actionMsg.ok ? "bg-[#F0FDF4] text-[#16A34A]" : "bg-[#FEF2F2] text-[#DC2626]"}`}>
            {actionMsg.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
            {actionMsg.text}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Members"    value={org.memberCount}  sub="registered users"  color="#20243A" />
        <StatCard label="Active Members"   value={activeMembers}    sub="currently active"  color="#16A34A" />
        <StatCard label="Inactive Members" value={inactiveMembers}  sub="access disabled"   color={inactiveMembers > 0 ? "#EF4444" : "#94A3B8"} />
        <StatCard label="Currency"         value={org.currency}     sub={org.country}       color="#20243A" />
      </div>

      {/* Config + Members */}
      <div className="grid grid-cols-3 gap-5">

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
            Workspace Configuration
          </p>
          <div className="space-y-2">
            <ConfigItem label="Organization" value={org.name}        icon={<Building2 size={13} />} />
            <ConfigItem label="Country"      value={org.country}     icon={<Globe     size={13} />} />
            <ConfigItem label="Email"        value={org.email}       icon={<Mail      size={13} />} />
            <ConfigItem label="Phone"        value={org.phoneNumber} icon={<Phone     size={13} />} />
            <ConfigItem label="Created"      value={fmtDate(org.createdAt)} icon={<Clock size={13} />} />
          </div>
          <div className="mt-5 border-t border-[#F1F5F9] pt-4">
            <button
              onClick={() => navigate(`/platform/organizations/${org.id}`)}
              className="flex w-full items-center gap-2 rounded-xl border border-[#ECECF3] px-4 py-2.5 text-sm font-medium text-[#20243A] transition hover:bg-[#F8F9FC]"
            >
              <Shield size={14} className="text-[#20243A]" />
              Edit Organization Details
            </button>
          </div>
        </div>

        <div className="col-span-2 rounded-2xl border border-[#ECECF3] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#F1F5F9] px-6 py-4">
            <h2 className="text-sm font-semibold text-[#20243A]">Workspace Members</h2>
            <span className="rounded-full bg-[#F1F5F9] px-2.5 py-0.5 text-xs font-medium text-[#666B84]">
              {org.memberCount} total
            </span>
          </div>

          {org.members.length === 0 ? (
            <div className="py-12 text-center">
              <Users size={28} className="mx-auto text-[#C7CCD9]" />
              <p className="mt-3 text-sm text-[#666B84]">No members yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F8F9FC]">
              {org.members.slice(0, 8).map((m) => (
                <div key={m.id} className="flex items-center justify-between px-6 py-3.5 transition hover:bg-[#F8F9FC]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EDE9FE] text-xs font-bold text-[#20243A]">
                      {initials(m.user.name)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#20243A]">{m.user.name}</p>
                      <p className="text-xs text-[#94A3B8]">{m.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[#94A3B8]">{m.role}</span>
                    <span className={`h-2 w-2 rounded-full ${m.isActive ? "bg-[#16A34A]" : "bg-[#E5E7EB]"}`} />
                  </div>
                </div>
              ))}
              {org.members.length > 8 && (
                <div className="px-6 py-3 text-center">
                  <button
                    onClick={() => navigate(`/platform/organizations/${org.id}`)}
                    className="text-sm font-medium text-[#20243A] hover:underline"
                  >
                    View all {org.memberCount} members →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Owners */}
      {owners.length > 0 && (
        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
            Organization Owners
          </p>
          <div className="grid grid-cols-3 gap-4">
            {owners.map((owner) => (
              <div key={owner.id} className="flex items-center gap-4 rounded-xl border border-[#ECECF3] p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#EDE9FE] text-sm font-bold text-[#20243A]">
                  {initials(owner.user.name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#20243A]">{owner.user.name}</p>
                  <p className="truncate text-xs text-[#94A3B8]">{owner.user.email}</p>
                  {owner.user.lastLoginAt && (
                    <p className="mt-0.5 text-xs text-[#C7CCD9]">Last login {fmtDate(owner.user.lastLoginAt)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Platform notice */}
      <div className="rounded-2xl border border-[#E0E7FF] bg-[#EEF2FF] p-5">
        <div className="flex items-start gap-3">
          <Shield size={16} className="mt-0.5 flex-shrink-0 text-[#20243A]" />
          <div>
            <p className="text-sm font-semibold text-[#3730A3]">Platform Administration View</p>
            <p className="mt-1 text-sm text-[#4F46E5]">
              You are viewing this workspace as a platform administrator. You have read access to
              workspace configuration and member data. To access the organization's financial workspace,
              a user with an active membership must sign in with their tenant credentials.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

