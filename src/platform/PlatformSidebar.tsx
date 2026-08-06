import {
  BarChart3,
  Building2,
  CreditCard,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  Settings,
  ShieldCheck,
  Users,
  Activity,
} from "lucide-react";

import SidebarItem from "./components/SidebarItem";

export default function PlatformSidebar() {
  return (
    <aside className="flex h-screen w-[290px] flex-col bg-[#081325] text-white">

      {/* Logo */}

      <div className="border-b border-white/10 px-7 py-7">

        <div className="flex items-center gap-4">

          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#D4AF37] text-2xl font-bold text-[#081325]">
            Z
          </div>

          <div>

            <h1 className="text-2xl font-bold tracking-wide">
              ZIYA FOS
            </h1>

            <p className="text-sm text-slate-400">
              Platform Administration
            </p>

          </div>

        </div>

      </div>

      {/* Navigation */}

      <nav className="flex-1 space-y-2 overflow-y-auto px-5 py-6">

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

      </nav>

      {/* Bottom */}

      <div className="border-t border-white/10 p-5 space-y-2">

        <SidebarItem
          to="/platform/support"
          label="Support"
          icon={LifeBuoy}
        />

        <SidebarItem
          to="/platform/system-health"
          label="System Health"
          icon={Activity}
        />

        <div className="mt-5 flex items-center gap-4 rounded-2xl bg-white/5 p-4">

          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#D4AF37] font-bold text-[#081325]">
            Z
          </div>

          <div>

            <h3 className="font-semibold">
              Platform Admin
            </h3>

            <p className="text-sm text-slate-400">
              Super Administrator
            </p>

          </div>

        </div>

      </div>

    </aside>
  );
}