import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon: LucideIcon;
}

export default function StatCard({
  title,
  value,
  change,
  icon: Icon,
}: StatCardProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-sm transition-all duration-200 hover:border-amber-500/40 hover:shadow-lg">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400">{title}</p>

          <h2 className="mt-2 text-3xl font-bold text-white">
            {value}
          </h2>

          {change && (
            <p className="mt-2 text-sm font-medium text-emerald-400">
              {change}
            </p>
          )}
        </div>

        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
          <Icon className="h-6 w-6 text-amber-400" />
        </div>
      </div>
    </div>
  );
}