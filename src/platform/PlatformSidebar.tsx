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

export default function PlatformSidebar() {
  return (
    <aside className="flex h-screen w-[270px] flex-col border-r border-[#1A2740] bg-[#081325]">

      {/* Logo */}

      <div className="px-7 py-8">

        <div className="flex items-center gap-4">

          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white">

            <span className="text-xl font-bold text-[#081325]">
              Z
            </span>

          </div>

          <div>

            <h1 className="text-xl font-bold tracking-wide text-white">
              ZIYA FOS
            </h1>

            <p className="text-xs text-slate-400">
              Platform Administration
            </p>

          </div>

        </div>

      </div>

      {/* MAIN */}

      <div className="px-7 pb-3">

        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Main
        </p>

      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-4">

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

      <div className="px-7 pb-3 pt-6">

        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          System
        </p>

      </div>

      <div className="space-y-1 px-4">

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

      </div>

      {/* Profile */}

      <div className="mt-auto border-t border-[#1A2740] p-5">

        <div className="flex items-center gap-3">

          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#6D5DF6] font-semibold text-white">
            Z
          </div>

          <div className="flex-1">

            <h3 className="text-sm font-semibold text-white">
              Platform Admin
            </h3>

            <p className="text-xs text-slate-400">
              Super Administrator
            </p>

          </div>

        </div>

        <button className="mt-5 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-300 transition hover:bg-[#13213A] hover:text-white">

          <LogOut size={18} />

          Logout

        </button>

      </div>

    </aside>
  );
}