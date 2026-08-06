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
        `group flex items-center gap-4 rounded-2xl px-4 py-3 transition-all duration-200 ${
          isActive
            ? "bg-[#D4AF37] text-[#081325] shadow-md"
            : "text-slate-300 hover:bg-[#162238] hover:text-white"
        }`
      }
    >
      <Icon size={20} strokeWidth={2} />

      <span className="text-[15px] font-medium">
        {label}
      </span>
    </NavLink>
  );
}