import { NavLink } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

interface SidebarItemProps {
  to: string;
  label: string;
  icon: LucideIcon;
}

export default function SidebarItem({
  to,
  label,
  icon: Icon,
}: SidebarItemProps) {
  return (
    <NavLink
      to={to}
      end={to === "/platform"}
      className={({ isActive }) =>
        [
          "group flex items-center gap-4 rounded-2xl px-4 py-3 transition-all duration-200",
          isActive
            ? "bg-white text-[#081325] shadow-sm"
            : "text-slate-400 hover:bg-[#13213A] hover:text-white",
        ].join(" ")
      }
    >
      <Icon
        size={20}
        strokeWidth={2}
        className="transition-colors"
      />

      <span className="flex-1 text-[14px] font-medium tracking-[0.01em]">
        {label}
      </span>
    </NavLink>
  );
}