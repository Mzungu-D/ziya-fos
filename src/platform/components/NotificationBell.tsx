import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Building2, CheckCircle, X } from "lucide-react";
import { getAuthToken } from "../../lib/auth";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface PendingNotification {
  id:        string;
  type:      string;
  title:     string;
  message:   string;
  resourceId: string;
  createdAt: string;
}

interface NotificationSummary {
  unreadCount:   number;
  notifications: PendingNotification[];
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

export default function NotificationBell() {
  const navigate = useNavigate();
  const ref      = useRef<HTMLDivElement>(null);

  const [open,  setOpen]  = useState(false);
  const [data,  setData]  = useState<NotificationSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const res   = await fetch(`${API_BASE}/api/platform/notifications/summary`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) setData(await res.json());
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  /* Poll every 30 seconds */
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  /* Close on outside click */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const count = data?.unreadCount ?? 0;

  function handleApprove(orgId: string) {
    setOpen(false);
    navigate(`/platform/organizations/${orgId}`);
  }

  return (
    <div ref={ref} className="relative">

      {/* Bell button */}
      <button
        onClick={() => { setOpen((o) => !o); if (!open) fetchNotifications(); }}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-[#666B84] transition-colors hover:bg-[#F1F5F9] hover:text-[#20243A]"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold leading-none text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-11 z-50 w-[360px] overflow-hidden rounded-2xl border border-[#ECECF3] bg-white shadow-xl">

          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#ECECF3] px-4 py-3">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-[#20243A]" />
              <span className="text-sm font-semibold text-[#20243A]">Notifications</span>
              {count > 0 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                  {count} pending
                </span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-[#94A3B8] hover:text-[#20243A]"
            >
              <X size={14} />
            </button>
          </div>

          {/* Body */}
          <div className="max-h-[380px] overflow-y-auto">

            {loading && (
              <div className="flex items-center justify-center py-10">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#D4AF37] border-t-transparent" />
              </div>
            )}

            {!loading && count === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-12">
                <CheckCircle size={32} className="text-[#22C55E]" />
                <p className="text-sm font-medium text-[#475569]">All caught up!</p>
                <p className="text-xs text-[#94A3B8]">No pending approvals right now.</p>
              </div>
            )}

            {!loading && data?.notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleApprove(n.resourceId)}
                className="flex w-full items-start gap-3 border-b border-[#F1F5F9] px-4 py-3.5 text-left transition-colors hover:bg-[#FFFBEB] last:border-0"
              >
                {/* Icon */}
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#D4AF37]/10">
                  <Building2 size={15} className="text-[#D4AF37]" />
                </div>

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#20243A]">{n.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-[#666B84] line-clamp-2">
                    {n.message}
                  </p>
                  <p className="mt-1 text-[10px] text-[#94A3B8]">{timeAgo(n.createdAt)}</p>
                </div>

                {/* Badge */}
                <span className="mt-1 shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  Review
                </span>
              </button>
            ))}
          </div>

          {/* Footer */}
          {count > 0 && (
            <div className="border-t border-[#ECECF3] px-4 py-3">
              <button
                onClick={() => { setOpen(false); navigate("/platform/organizations?status=PENDING"); }}
                className="w-full rounded-xl bg-[#0D9488] py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#2e3450]"
              >
                View all pending organisations →
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
