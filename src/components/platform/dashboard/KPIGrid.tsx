import {
  Building2,
  Users,
  UserCheck,
  Activity,
  ShieldCheck,
  Wallet,
} from "lucide-react";

import StatCard from "../../common/StatCard";

export default function KPIGrid() {
  const stats = [
    {
      title: "Organizations",
      value: "42",
      change: "+5%",
      icon: Building2,
    },
    {
      title: "Users",
      value: "1,284",
      change: "+18%",
      icon: Users,
    },
    {
      title: "Pending Approvals",
      value: "7",
      change: "+2",
      icon: UserCheck,
    },
    {
      title: "Platform Health",
      value: "99.98%",
      change: "Healthy",
      icon: ShieldCheck,
    },
    {
      title: "Active Sessions",
      value: "316",
      change: "+21",
      icon: Activity,
    },
    {
      title: "Revenue",
      value: "KES 0",
      change: "Coming Soon",
      icon: Wallet,
    },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {stats.map((stat) => (
        <StatCard
          key={stat.title}
          title={stat.title}
          value={stat.value}
          change={stat.change}
          icon={stat.icon}
        />
      ))}
    </div>
  );
}