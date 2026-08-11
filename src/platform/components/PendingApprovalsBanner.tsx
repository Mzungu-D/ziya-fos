import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, Building2 } from "lucide-react";
import { getAuthToken } from "../../lib/auth";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface PendingOrg {
  id:        string;
  name:      string;
  email:     string | null;
  country:   string;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function PendingApprovalsBanner() {
  const navigate = useNavigate();
  const [orgs, setOrgs]       = useState<PendingOrg[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    try {
      const token = getAuthToken();
      const res   = await fetch(`${API_BASE}/api/platform/dashboard/stats`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setOrgs(data.pendingApprovals ?? []);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch_();
    const t = setInterval(fetch_, 60_000);
    return () => clearInterval(t);
  }, [fetch_]);

  if (loading || orgs.length === 0) return null;

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50">

      {/* Title bar */}
      <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-100/60 px-5 py-3">
        <AlertTriangle size={16} className="text-amber-600" />
        <span className="text-sm font-semibold text-amber-800">
          {orgs.length} organisation{orgs.length > 1 ? "s" : ""} awaiting your approval
        </span>
        <button
          onClick={() => navigate("/platform/organizations?status=PENDING")}
          className="ml-auto flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900"
        >
          View all <ArrowRight size={12} />
        </button>
      </div>

      {/* List */}
      <div className="divide-y divide-amber-100">
        {orgs.slice(0, 5).map((org) => (
          <button
            key={org.id}
            onClick={() => navigate(`/platform/organizations/${org.id}`)}
            className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-amber-100/50"
          >
            {/* Avatar */}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#D4AF37]/20 text-sm font-bold text-[#D4AF37]">
              {org.name.charAt(0).toUpperCase()}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#20243A]">{org.name}</p>
              <p className="truncate text-xs text-[#666B84]">
                {org.email ?? "No email"} · {org.country} · Applied {timeAgo(org.createdAt)}
              </p>
            </div>

            {/* Action chip */}
            <div className="flex shrink-0 items-center gap-1 rounded-lg bg-[#D4AF37] px-3 py-1.5 text-xs font-semibold text-white">
              <Building2 size={11} />
              Approve
            </div>
          </button>
        ))}
      </div>

      {orgs.length > 5 && (
        <div className="border-t border-amber-200 px-5 py-2.5 text-center">
          <button
            onClick={() => navigate("/platform/organizations?status=PENDING")}
            className="text-xs font-semibold text-amber-700 hover:text-amber-900"
          >
            + {orgs.length - 5} more — view all →
          </button>
        </div>
      )}
    </div>
  );
}