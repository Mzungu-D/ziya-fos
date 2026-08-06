import {
  Activity,
  BarChart3,
  Building2,
  CreditCard,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

import SidebarItem from "./components/SidebarItem";
import zayi from "../assets/zayi.jpg";

export default function PlatformSidebar() {
  return (
    <aside className="flex h-screen w-[280px] flex-col border-r border-[#E7EAF3] bg-[#081325]">

      {/* Logo */}

      <div className="border-b border-[#1A2740] px-7 py-7">

        <div className="flex items-center gap-4">

          <img
            src={zayi}
            alt="Ziya FOS"
            className="h-14 w-14 object-contain"
          />

          <div>

            <h1 className="text-xl font-bold tracking-wide text-white">
              ZIYA FOS
            </h1>

            <p className="mt-1 text-sm text-slate-400">
              Platform Administration
            </p>

          </div>

        </div>

      </div>

      {/* MAIN */}

      <div className="px-7 pt-7 pb-3">

        <p className="text-xs font-semibold uppercase tracking-[0.20em] text-slate-500">
          Main
        </p>

      </div>

      <nav className="space-y-1 px-4">

        <SidebarItem
          to="/platform"
          label="Dashboard"
          icon={LayoutDashboard}
        />

        <SidebarItem
          to="/platform/organizations"
          label="Organizations"
          icon={Building2}
        />

        <SidebarItem
          to="/platform/users"
          label="Users & Access"
          icon={Users}
        />

        <SidebarItem
          to="/platform/subscriptions"
          label="Subscriptions"
          icon={CreditCard}
        />

        <SidebarItem
          to="/platform/billing"
          label="Billing & Revenue"
          icon={CreditCard}
        />

        <SidebarItem
          to="/platform/licensing"
          label="Licensing"
          icon={ShieldCheck}
        />

        <SidebarItem
          to="/platform/reports"
          label="Reports & Analytics"
          icon={BarChart3}
        />

      </nav>

      {/* SYSTEM */}

      <div className="px-7 pt-8 pb-3">

        <p className="text-xs font-semibold uppercase tracking-[0.20em] text-slate-500">
          System
        </p>

      </div>

      <nav className="space-y-1 px-4">

        <SidebarItem
          to="/platform/audit-logs"
          label="Audit Logs"
          icon={FileText}
        />

        <SidebarItem
          to="/platform/settings"
          label="System Settings"
          icon={Settings}
        />

        <SidebarItem
          to="/platform/system-health"
          label="System Health"
          icon={Activity}
        />

        <SidebarItem
          to="/platform/support"
          label="Support"
          icon={LifeBuoy}
        />

      </nav>

      <div className="mt-auto border-t border-[#1A2740] p-5">

        {/* User */}

        <div className="flex items-center gap-3 rounded-2xl bg-[#13213A] p-3">

          <img
            src={zayi}
            alt="Platform Admin"
            className="h-11 w-11 rounded-full object-cover"
          />

          <div className="flex-1">

            <h3 className="text-sm font-semibold text-white">
              Platform Admin
            </h3>

            <p className="text-xs text-slate-400">
              Super Administrator
            </p>

          </div>

        </div>

        {/* Logout */}

        <button className="mt-4 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-300 transition-all duration-200 hover:bg-[#13213A] hover:text-white">

          <LogOut size={18} />

          <span>Logout</span>

        </button>

      </div>

    </aside>
  );
}