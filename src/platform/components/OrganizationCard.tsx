import { useState } from "react";
import {
  Building2,
  Check,
  ChevronRight,
  Globe,
  Loader2,
  Trash2,
  Users,
  X,
} from "lucide-react";

import StatusBadge   from "./StatusBadge";
import PrimaryButton from "./PrimaryButton";

interface OrganizationCardProps {
  id:          string;
  name:        string;
  country:     string;
  currency:    string;
  memberCount: number;
  logoUrl?:    string | null;
  status:      "ACTIVE" | "PENDING" | "SUSPENDED" | "REJECTED";

  onOpenWorkspace?: (id: string) => void;
  onViewDetails?:  (id: string) => void;
  onDelete?:       (id: string) => void;
  onApprove?:      (id: string) => Promise<void>;
  onReject?:       (id: string) => Promise<void>;
}

function OrgAvatar({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        className="h-14 w-14 rounded-2xl border border-[#ECECF3] object-cover"
      />
    );
  }

  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#ECECF3] bg-[#20243A] text-lg font-bold text-[#D4AF37]">
      {initials}
    </div>
  );
}

export default function OrganizationCard({
  id,
  name,
  country,
  currency,
  memberCount,
  logoUrl,
  status,
  onOpenWorkspace,
  onViewDetails,
  onDelete,
  onApprove,
  onReject,
}: OrganizationCardProps) {
  const [approving,   setApproving]   = useState(false);
  const [rejecting,   setRejecting]   = useState(false);
  const [actionError, setActionError] = useState("");

  async function handleApprove() {
    if (!onApprove) return;
    setApproving(true);
    setActionError("");
    try {
      await onApprove(id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to approve.");
    } finally {
      setApproving(false);
    }
  }

  async function handleReject() {
    if (!onReject) return;
    setRejecting(true);
    setActionError("");
    try {
      await onReject(id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to reject.");
    } finally {
      setRejecting(false);
    }
  }

  const isPending = status === "PENDING";
  const isActive  = status === "ACTIVE";
  const isBusy    = approving || rejecting;

  return (
    <div className="group rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <OrgAvatar name={name} logoUrl={logoUrl} />
          <div>
            <h3 className="text-lg font-semibold text-[#20243A]">{name}</h3>
            <p className="mt-1 text-sm text-[#666B84]">{country}</p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="my-6 h-px bg-[#ECECF3]" />

      <div className="grid grid-cols-3 gap-5">
        <div>
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-[#20243A]" />
            <span className="text-xs uppercase tracking-wide text-[#94A3B8]">Currency</span>
          </div>
          <p className="mt-2 font-semibold text-[#20243A]">{currency}</p>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <Users size={16} className="text-[#20243A]" />
            <span className="text-xs uppercase tracking-wide text-[#94A3B8]">Members</span>
          </div>
          <p className="mt-2 font-semibold text-[#20243A]">{memberCount}</p>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-[#16A34A]" />
            <span className="text-xs uppercase tracking-wide text-[#94A3B8]">Status</span>
          </div>
          <div className="mt-2">
            <StatusBadge status={status} />
          </div>
        </div>
      </div>

      {actionError && (
        <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">
          {actionError}
        </p>
      )}

      <div className="mt-6 h-px bg-[#ECECF3]" />

      {isPending ? (
        <div className="mt-5 flex gap-3">
          <button
            onClick={handleApprove}
            disabled={isBusy}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#16A34A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#15803D] disabled:opacity-60"
          >
            {approving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            Approve
          </button>
          <button
            onClick={handleReject}
            disabled={isBusy}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-60"
          >
            {rejecting ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />}
            Reject
          </button>
          <button
            onClick={() => onViewDetails?.(id)}
            disabled={isBusy}
            className="flex items-center justify-center rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3 py-2.5 text-[#666B84] transition hover:bg-[#F1F5F9] disabled:opacity-60"
            title="View details"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      ) : (
        <div className="mt-5 flex items-center justify-between">
          <div className="flex gap-2">
            {onDelete && (
              <button
                onClick={() => onDelete(id)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#ECECF3] text-[#94A3B8] transition hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            )}
            {onViewDetails && (
              <button
                onClick={() => onViewDetails(id)}
                className="flex h-9 items-center gap-2 rounded-xl border border-[#ECECF3] px-3 text-sm text-[#666B84] transition hover:bg-[#F8F9FC]"
              >
                Details <ChevronRight size={14} />
              </button>
            )}
          </div>
          {isActive && onOpenWorkspace && (
            <PrimaryButton onClick={() => onOpenWorkspace(id)}>
              Open Workspace
            </PrimaryButton>
          )}
        </div>
      )}
    </div>
  );
}
