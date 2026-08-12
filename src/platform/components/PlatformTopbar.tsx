import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Loader2, Search, Settings, X } from "lucide-react";

import ProfileDropdown from "./ProfileDropdown";
import { getNotificationSummary } from "../../services/platformNotifications";
import type { NotificationItem, NotificationSummary } from "../../services/platformNotifications";

function severityCfg(severity: NotificationItem["severity"]) {
  if (severity === "high")
    return { dot: "bg-red-500",    bg: "hover:bg-red-50",    text: "text-red-700",    badge: "bg-red-100 text-red-700"       };
  if (severity === "medium")
    return { dot: "bg-orange-400", bg: "hover:bg-orange-50", text: "text-orange-700", badge: "bg-orange-100 text-orange-700" };
  return   { dot: "bg-slate-400",  bg: "hover:bg-slate-50",  text: "text-slate-600",  badge: "bg-slate-100 text-slate-500"   };
}

function NotificationPanel({
  data, dismissed, onDismiss, onClose, onNavigate,
}: {
  data:       NotificationSummary;
  dismissed:  Set<string>;
  onDismiss:  (type: string) => void;
  onClose:    () => void;
  onNavigate: (link: string) => void;
}) {
  const visible = data.items.filter((item) => !dismissed.has(item.type));
  const count   = visible.length;

  return (
    <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[380px] rounded-2xl border border-[#ECECF3] bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-[#F1F5F9] px-5 py-4">
        <div>
          <p className="text-sm font-bold text-[#20243A]">Notifications</p>
          <p className="text-xs text-[#94A3B8]">
            {count === 0 ? "All clear — nothing needs attention"
              : `${count} item${count !== 1 ? "s" : ""} need${count === 1 ? "s" : ""} attention`}
          </p>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-[#94A3B8] hover:bg-[#F8F9FC] hover:text-[#475569]">
          <X size={16} />
        </button>
      </div>

      <div className="max-h-[380px] overflow-y-auto py-2">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Bell size={28} className="text-[#ECECF3]" />
            <p className="text-sm font-medium text-[#94A3B8]">No active notifications</p>
            <p className="text-xs text-[#CBD5E1]">Everything is running smoothly</p>
          </div>
        ) : (
          visible.map((item) => {
            const cfg = severityCfg(item.severity);
            return (
              <div key={item.type} className={`flex w-full items-start gap-3 px-5 py-3.5 transition-colors ${cfg.bg}`}>
                <button
                  onClick={() => { onDismiss(item.type); onNavigate(item.link); onClose(); }}
                  className="flex flex-1 items-start gap-3 text-left"
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} />
                  <span className={`flex-1 text-sm leading-snug ${cfg.text}`}>{item.label}</span>
                </button>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cfg.badge}`}>
                  {item.severity}
                </span>
                <button
                  onClick={() => onDismiss(item.type)}
                  title="Dismiss"
                  className="shrink-0 rounded-md p-0.5 text-[#94A3B8] hover:bg-white hover:text-[#475569]"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {visible.length > 0 && (
        <div className="flex items-center justify-between border-t border-[#F1F5F9] px-5 py-3">
          <button
            onClick={() => { onNavigate("/platform/support"); onClose(); }}
            className="text-xs font-semibold text-[#20243A] hover:underline"
          >
            View all support tickets →
          </button>
          <button
            onClick={() => data.items.forEach((i) => onDismiss(i.type))}
            className="text-xs text-[#94A3B8] hover:text-[#475569]"
          >
            Dismiss all
          </button>
        </div>
      )}
    </div>
  );
}

export default function PlatformTopbar() {
  const navigate = useNavigate();

  const [notifData, setNotifData] = useState<NotificationSummary | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const panelRef                  = useRef<HTMLDivElement>(null);
  const pollRef                   = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchNotifications() {
    try {
      const r = await getNotificationSummary();
      setNotifData((prev) => {
        if (prev && r.notifications.total !== prev.total) setDismissed(new Set());
        return r.notifications;
      });
    } catch { /* keep previous data */ }
    finally { setLoading(false); }
  }

  useEffect(() => {
    void fetchNotifications();
    pollRef.current = setInterval(() => void fetchNotifications(), 60_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    if (!panelOpen) return;
    function handleOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setPanelOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [panelOpen]);

  function dismissType(type: string) {
    setDismissed((prev) => new Set([...prev, type]));
  }

  const visibleCount = notifData
    ? notifData.items.filter((i) => !dismissed.has(i.type)).length
    : 0;

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-[#ECECF3] bg-white px-8">
      <div className="relative w-[460px]">
        <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
        <input
          type="text"
          placeholder="Search organizations, users, subscriptions..."
          className="h-14 w-full rounded-2xl border border-[#ECECF3] bg-[#F8F9FC] pl-14 pr-20 text-sm text-[#20243A] placeholder:text-[#94A3B8] outline-none transition-all duration-200 focus:border-[#0D9488] focus:bg-white focus:ring-2 focus:ring-[#0D9488]/10"
        />
        <div className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg border border-[#ECECF3] bg-white px-2 py-1 text-xs font-medium text-[#666B84] shadow-sm">
          Ctrl K
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Bell */}
        <div ref={panelRef} className="relative">
          <button
            onClick={() => setPanelOpen((p) => !p)}
            className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-[#ECECF3] bg-white shadow-sm transition-all duration-200 hover:bg-[#F8F9FC]"
          >
            {loading
              ? <Loader2 size={18} className="animate-spin text-[#94A3B8]" />
              : <Bell size={20} className={visibleCount > 0 ? "text-[#20243A]" : "text-[#94A3B8]"} />}
            {!loading && visibleCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#EF4444] px-1 text-[10px] font-bold leading-none text-white shadow-sm">
                {visibleCount > 99 ? "99+" : visibleCount}
              </span>
            )}
          </button>
          {panelOpen && notifData && (
            <NotificationPanel
              data={notifData}
              dismissed={dismissed}
              onDismiss={dismissType}
              onClose={() => setPanelOpen(false)}
              onNavigate={(link) => navigate(link)}
            />
          )}
        </div>

        {/* Settings */}
        <button
          onClick={() => navigate("/platform/settings")}
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#ECECF3] bg-white shadow-sm transition-all duration-200 hover:bg-[#F8F9FC]"
        >
          <Settings size={20} className="text-[#475569]" />
        </button>

        <ProfileDropdown />
      </div>
    </header>
  );
}

