import {
  CheckCircle2,
  AlertTriangle,
  Database,
  Server,
  ShieldCheck,
  Mail,
  MessageSquare,
  HardDrive,
} from "lucide-react";

interface ServiceStatus {
  name: string;
  status: "Operational" | "Warning";
  uptime: string;
  icon: React.ElementType;
}

const services: ServiceStatus[] = [
  {
    name: "API Server",
    status: "Operational",
    uptime: "99.99%",
    icon: Server,
  },
  {
    name: "Database",
    status: "Operational",
    uptime: "99.98%",
    icon: Database,
  },
  {
    name: "Authentication",
    status: "Operational",
    uptime: "100%",
    icon: ShieldCheck,
  },
  {
    name: "Email Service",
    status: "Operational",
    uptime: "99.97%",
    icon: Mail,
  },
  {
    name: "SMS Gateway",
    status: "Operational",
    uptime: "99.94%",
    icon: MessageSquare,
  },
  {
    name: "Storage",
    status: "Operational",
    uptime: "100%",
    icon: HardDrive,
  },
];

export default function SystemHealth() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">
            Platform Health
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Live health status of core platform services.
          </p>
        </div>

        <div className="rounded-full bg-green-500/10 px-4 py-2 text-sm font-semibold text-green-400">
          All Systems Operational
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {services.map((service) => {
          const Icon = service.icon;

          return (
            <div
              key={service.name}
              className="rounded-xl border border-slate-800 bg-slate-800 p-5 transition hover:border-amber-500"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
                  <Icon className="h-6 w-6 text-amber-400" />
                </div>

                {service.status === "Operational" ? (
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-400" />
                )}
              </div>

              <h3 className="font-semibold text-white">
                {service.name}
              </h3>

              <p className="mt-2 text-sm text-slate-400">
                Status
              </p>

              <p className="font-medium text-green-400">
                {service.status}
              </p>

              <div className="mt-4 flex items-center justify-between border-t border-slate-700 pt-4">
                <span className="text-sm text-slate-400">
                  Uptime
                </span>

                <span className="font-semibold text-white">
                  {service.uptime}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}