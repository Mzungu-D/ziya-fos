import {
  Building2,
  FileText,
  ShieldCheck,
  Settings,
  PlusCircle,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    {
      title: "Provision Organization",
      description: "Create a new tenant organization",
      icon: PlusCircle,
      path: "/platform/organizations/new",
    },
    {
      title: "Organizations",
      description: "View all registered organizations",
      icon: Building2,
      path: "/platform/organizations",
    },
    {
      title: "Audit Logs",
      description: "View platform activity logs",
      icon: FileText,
      path: "/platform/audit-logs",
    },
    {
      title: "System Health",
      description: "Monitor platform services",
      icon: ShieldCheck,
      path: "/platform/system-health",
    },
    {
      title: "Platform Users",
      description: "Manage platform administrators",
      icon: Users,
      path: "/platform/profile",
    },
    {
      title: "Settings",
      description: "Platform configuration",
      icon: Settings,
      path: "/platform/settings",
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">
          Quick Actions
        </h2>

        <p className="mt-1 text-sm text-slate-400">
          Frequently used administrative tasks.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <button
              key={action.title}
              onClick={() => navigate(action.path)}
              className="group rounded-xl border border-slate-700 bg-slate-800 p-5 text-left transition-all duration-200 hover:border-amber-500 hover:bg-slate-700"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 transition-all group-hover:bg-amber-500/20">
                <Icon className="h-6 w-6 text-amber-400" />
              </div>

              <h3 className="text-base font-semibold text-white">
                {action.title}
              </h3>

              <p className="mt-2 text-sm text-slate-400">
                {action.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}