import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, Settings, Shield, User } from "lucide-react";

import zayi from "../../assets/zayi.jpg";
import { clearAuthenticatedSession, getAuthToken } from "../../lib/auth";

export default function ProfileDropdown() {
  const [open, setOpen] = useState(false);
  const navigate         = useNavigate();
  const dropdownRef      = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  function go(path: string) {
    setOpen(false);
    navigate(path);
  }

  const handleLogout = async () => {
    setOpen(false);
    const token = getAuthToken();
    try {
      if (token) {
        await fetch("/api/auth/logout", {
          method:  "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
      }
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      clearAuthenticatedSession();
      navigate("/login", { replace: true });
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 rounded-2xl border border-[#ECECF3] bg-white px-4 py-2 shadow-sm transition hover:bg-[#F8F9FC]"
      >
        <img src={zayi} alt="Platform Admin" className="h-11 w-11 rounded-full object-cover" />
        <div className="text-left">
          <h3 className="text-sm font-semibold text-[#20243A]">Platform Admin</h3>
          <p className="text-xs text-[#666B84]">Super Administrator</p>
        </div>
        <ChevronDown size={18} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-3 w-72 overflow-hidden rounded-2xl border border-[#ECECF3] bg-white shadow-2xl">
          {/* Header */}
          <div className="border-b border-[#ECECF3] p-5">
            <div className="flex items-center gap-4">
              <img src={zayi} alt="Platform Admin" className="h-14 w-14 rounded-full object-cover" />
              <div>
                <h3 className="font-semibold text-[#20243A]">Platform Admin</h3>
                <p className="text-sm text-[#666B84]">admin@ziya.co.ke</p>
                <span className="mt-1 inline-block rounded-full bg-[#F3F0FF] px-2 py-0.5 text-[10px] font-semibold text-[#6D5DF6]">
                  Super Administrator
                </span>
              </div>
            </div>
          </div>

          {/* Menu */}
          <div className="p-2">
            <button
              onClick={() => go("/platform/profile")}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-[#20243A] transition hover:bg-[#F8F9FC]"
            >
              <User size={18} className="text-[#6D5DF6]" />
              <div>
                <p className="font-medium">My Profile</p>
                <p className="text-xs text-[#94A3B8]">Account details & password</p>
              </div>
            </button>

            <button
              onClick={() => go("/platform/security")}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-[#20243A] transition hover:bg-[#F8F9FC]"
            >
              <Shield size={18} className="text-[#16A34A]" />
              <div>
                <p className="font-medium">Security</p>
                <p className="text-xs text-[#94A3B8]">Access control & audit</p>
              </div>
            </button>

            <button
              onClick={() => go("/platform/settings")}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-[#20243A] transition hover:bg-[#F8F9FC]"
            >
              <Settings size={18} className="text-[#D97706]" />
              <div>
                <p className="font-medium">Settings</p>
                <p className="text-xs text-[#94A3B8]">Platform configuration</p>
              </div>
            </button>
          </div>

          {/* Sign Out */}
          <div className="border-t border-[#ECECF3] p-2">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              <LogOut size={18} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}