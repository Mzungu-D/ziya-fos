import { CalendarDays, Clock, Building2 } from "lucide-react";
import { getGreeting } from "../../../utils/greeting";
import { formatCurrentDate } from "../../../utils/date";

interface WelcomeBannerProps {
  firstName?: string;
  organizationName?: string;
  lastLogin?: string;
  version?: string;
}

export default function WelcomeBanner({
  firstName = "User",
  organizationName = "Organization",
  lastLogin = "Today",
  version = "1.0.0",
}: WelcomeBannerProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white">
            {getGreeting()}, {firstName} 👋
          </h1>

          <p className="mt-3 text-slate-400">
            Welcome back to{" "}
            <span className="font-semibold text-amber-400">
              {organizationName}
            </span>
          </p>

          <div className="mt-6 flex flex-wrap gap-5 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <CalendarDays size={16} />
              {formatCurrentDate()}
            </div>

            <div className="flex items-center gap-2">
              <Clock size={16} />
              {lastLogin}
            </div>

            <div className="flex items-center gap-2">
              <Building2 size={16} />
              Version {version}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-6">
          <p className="text-sm text-amber-400">Platform Status</p>

          <h2 className="mt-2 text-3xl font-bold text-white">
            Operational
          </h2>
        </div>
      </div>
    </div>
  );
}