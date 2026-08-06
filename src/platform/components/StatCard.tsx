import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}

export default function StatCard({
  title,
  value,
  change,
  icon: Icon,
  iconBg,
  iconColor,
}: StatCardProps) {
  return (
    <div className="rounded-3xl border border-[#ECECF3] bg-white p-7 shadow-sm transition-all duration-200 hover:shadow-md">

      <div className="flex items-start justify-between">

        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ backgroundColor: iconBg }}
        >
          <Icon
            size={30}
            color={iconColor}
            strokeWidth={2}
          />
        </div>

        <button className="text-slate-400 hover:text-slate-700">
          ⋮
        </button>

      </div>

      <p className="mt-6 text-base font-medium text-slate-500">
        {title}
      </p>

      <h2 className="mt-2 text-5xl font-bold text-[#20243A]">
        {value}
      </h2>

      <p className="mt-5 text-base font-medium text-emerald-500">
        ↑ {change}
      </p>

    </div>
  );
}