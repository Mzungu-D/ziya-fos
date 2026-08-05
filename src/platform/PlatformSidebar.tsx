import { NavLink } from "react-router-dom";

const menuItems = [
  {
    name: "Dashboard",
    path: "/platform",
  },
  {
    name: "Organizations",
    path: "/platform/organizations",
  },
  {
    name: "Platform Users",
    path: "/platform/users",
  },
  {
    name: "Platform Settings",
    path: "/platform/settings",
  },
  {
    name: "Security Center",
    path: "/platform/security",
  },
  {
    name: "Audit Logs",
    path: "/platform/audit-logs",
  },
  {
    name: "System Health",
    path: "/platform/system-health",
  },
  {
    name: "AI Control Center",
    path: "/platform/ai-control-center",
  },
  {
    name: "Integrations",
    path: "/platform/integrations",
  },
  {
    name: "Billing",
    path: "/platform/billing",
  },
];

export default function PlatformSidebar() {
  return (
    <aside className="flex h-screen w-72 flex-col border-r border-slate-800 bg-slate-900">

      <div className="border-b border-slate-800 p-6">

        <h1 className="text-3xl font-bold text-amber-400">
          Ziya FOS
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          Platform Administration
        </p>

      </div>

      <nav className="flex-1 overflow-y-auto p-4">

        <div className="space-y-2">

          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/platform"}
              className={({ isActive }) =>
                `block rounded-xl px-4 py-3 text-sm font-medium transition ${
                  isActive
                    ? "bg-slate-800 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              {item.name}
            </NavLink>
          ))}

        </div>

      </nav>

    </aside>
  );
}