import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  PlusCircle,
  FileText,
  Settings,
  User,
  LogOut,
} from "lucide-react";

export default function PlatformSidebar() {
  return (
    <aside className="w-72 bg-[#0B1220] border-r border-slate-800 flex flex-col min-h-screen">

      {/* Logo */}
      <div className="px-6 py-8 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white">
          Ziya FOS
        </h1>

        <p className="text-sm text-amber-400 mt-1">
          Platform Workspace
        </p>

        <p className="text-xs text-slate-500 mt-2">
          Financial Operating System
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2">

        <MenuItem
          icon={LayoutDashboard}
          text="Overview"
          path="/platform"
        />

        <MenuItem
          icon={Building2}
          text="Organizations"
          path="/platform/organizations"
        />

        <MenuItem
          icon={PlusCircle}
          text="Provision Organization"
          path="/platform/organizations/new"
        />

        <MenuItem
          icon={FileText}
          text="Audit Logs"
          path="/platform/audit-logs"
        />

        <MenuItem
          icon={Settings}
          text="Platform Settings"
          path="/platform/settings"
        />

        <MenuItem
          icon={User}
          text="My Profile"
          path="/platform/profile"
        />

      </nav>

      {/* Footer */}
      <div className="border-t border-slate-800 p-4">

        <NavLink
          to="/login"
          className="flex items-center gap-3 rounded-xl px-4 py-3 text-red-400 hover:bg-red-500/10 transition"
        >
          <LogOut size={18} />
          Logout
        </NavLink>

      </div>

    </aside>
  );
}

function MenuItem({
  icon: Icon,
  text,
  path,
}: {
  icon: any;
  text: string;
  path: string;
}) {
  return (
    <NavLink
      to={path}
      end={path === "/platform"}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-4 py-3 transition-all ${
          isActive
            ? "bg-amber-500 text-black font-semibold"
            : "text-slate-400 hover:bg-slate-800 hover:text-white"
        }`
      }
    >
      <Icon size={18} />
      {text}
    </NavLink>
  );
}