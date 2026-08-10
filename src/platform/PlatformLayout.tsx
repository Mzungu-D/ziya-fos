import { useState, useEffect, useRef } from "react";
import { Outlet, useNavigate, Link } from "react-router-dom";
import { Settings, LogOut, User, ChevronDown } from "lucide-react";

import PlatformSidebar   from "./PlatformSidebar";
import NotificationBell  from "./components/NotificationBell";
import { getAuthToken }  from "../lib/auth";

/* ─── decode JWT user info ───────────────────────────────── */
function getUserFromToken(): { name: string; email: string; role: string } {
  try {
    const token = getAuthToken();
    if (!token) return { name: "Platform Admin", email: "", role: "PLATFORM_ADMIN" };
    const payload = JSON.parse(atob(token.split(".")[1]));
    return {
      name:  payload.name  ?? "Platform Admin",
      email: payload.email ?? "",
      role:  payload.platformRole ?? payload.role ?? "PLATFORM_ADMIN",
    };
  } catch {
    return { name: "Platform Admin", email: "", role: "PLATFORM_ADMIN" };
  }
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/* ─── user menu ──────────────────────────────────────────── */
function UserMenu() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref             = useRef<HTMLDivElement>(null);
  const user            = getUserFromToken();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleLogout() {
    localStorage.removeItem("token");
    sessionStorage.clear();
    navigate("/login");
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-[#F1F5F9]"
      >
        {/* Avatar */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#20243A] text-xs font-bold text-[#D4AF37]">
          {getInitials(user.name)}
        </div>
        {/* Info */}
        <div className="text-left hidden sm:block">
          <p className="text-xs font-semibold leading-tight text-[#20243A]">{user.name}</p>
          <p className="text-[10px] leading-tight text-[#94A3B8]">Super Administrator</p>
        </div>
        <ChevronDown size={14} className={`text-[#94A3B8] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-52 overflow-hidden rounded-2xl border border-[#ECECF3] bg-white shadow-xl">
          {/* Header */}
          <div className="border-b border-[#F1F5F9] px-4 py-3">
            <p className="truncate text-sm font-semibold text-[#20243A]">{user.name}</p>
            <p className="truncate text-xs text-[#94A3B8]">{user.email}</p>
          </div>

          {/* Items */}
          <div className="p-1.5">
            <Link
              to="/platform/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-[#475569] transition-colors hover:bg-[#F8F9FC] hover:text-[#20243A]"
            >
              <User size={14} />
              My Profile
            </Link>
            <Link
              to="/platform/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-[#475569] transition-colors hover:bg-[#F8F9FC] hover:text-[#20243A]"
            >
              <Settings size={14} />
              Settings
            </Link>
            <div className="my-1 border-t border-[#F1F5F9]" />
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-red-500 transition-colors hover:bg-red-50"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── topbar ─────────────────────────────────────────────── */
function PlatformTopbar() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-[#ECECF3] bg-white px-6">

      {/* Search */}
      <div className="flex flex-1 items-center gap-2 rounded-xl border border-[#ECECF3] bg-[#F8F9FC] px-3 py-2 text-sm text-[#94A3B8] max-w-md">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <span className="flex-1 text-xs">Search organisations, users, subscriptions…</span>
        <kbd className="rounded border border-[#DDDDE8] bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#94A3B8]">
          Ctrl K
        </kbd>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Notification bell */}
        <NotificationBell />

        {/* Settings */}
        <Link
          to="/platform/settings"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-[#666B84] transition-colors hover:bg-[#F1F5F9] hover:text-[#20243A]"
          aria-label="Settings"
        >
          <Settings size={17} />
        </Link>

        {/* Divider */}
        <div className="mx-1 h-5 w-px bg-[#ECECF3]" />

        {/* User menu */}
        <UserMenu />
      </div>
    </header>
  );
}

/* ─── layout ─────────────────────────────────────────────── */
export default function PlatformLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F9FC]">

      {/* Sidebar */}
      <PlatformSidebar />

      {/* Workspace */}
      <section className="flex min-w-0 flex-1 flex-col">

        {/* Top Navigation */}
        <PlatformTopbar />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-[#F8F9FC]">
          <div className="mx-auto w-full max-w-[1700px] px-10 py-8">
            <Outlet />
          </div>
        </main>

      </section>
    </div>
  );
}