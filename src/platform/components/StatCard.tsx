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
    <div className="group rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">

      <div className="flex items-start justify-between">

        <div>

          <p className="text-sm font-medium text-[#666B84]">
            {title}
          </p>

          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#20243A]">
            {value}
          </h2>

          <div className="mt-3 flex items-center gap-2">

            <span className="rounded-full bg-[#ECFDF3] px-2.5 py-1 text-xs font-semibold text-[#16A34A]">
              {change}
            </span>

            <span className="text-xs text-[#9AA3B2]">
              vs last month
            </span>

          </div>

        </div>

        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: iconBg }}
        >
          <Icon
            size={26}
            strokeWidth={2}
            style={{ color: iconColor }}
          />
        </div>

      </div>

    </div>
  );
}