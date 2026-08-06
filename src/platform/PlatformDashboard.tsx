import {
  Building2,
  CreditCard,
  DollarSign,
  Users,
} from "lucide-react";

import PageHeader from "./components/PageHeader";
import InfoBanner from "./components/InfoBanner";
import StatCard from "./components/StatCard";
import SubscriptionChart from "./components/SubscriptionChart";
import DataTable from "./components/DataTable";
import type { TableRow } from "./components/DataTable";

const organizations: TableRow[] = [
  {
    id: 1,
    name: "Ziya Bridge",
    location: "Mombasa, Kenya",
    plan: "Enterprise",
    users: 145,
    status: "Active",
  },
  {
    id: 2,
    name: "Alpha Finance",
    location: "Nairobi, Kenya",
    plan: "Professional",
    users: 63,
    status: "Active",
  },
  {
    id: 3,
    name: "Coastal Capital",
    location: "Mombasa, Kenya",
    plan: "Starter",
    users: 19,
    status: "Trial",
  },
  {
    id: 4,
    name: "Blue Horizon",
    location: "Kisumu, Kenya",
    plan: "Professional",
    users: 42,
    status: "Active",
  },
];

export default function PlatformDashboard() {
  return (
    <div className="space-y-6">

      <PageHeader
        title="Platform Dashboard"
        subtitle="Manage organizations, subscriptions and platform operations."
      />

      <InfoBanner
        title="Revenue & Licensing Summary"
        description="Monitor platform revenue, subscription performance, licensing and commercial health across all organizations."
      />

      {/* KPI Cards */}

      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">

        <StatCard
          title="Organizations"
          value="125"
          change="+12%"
          icon={Building2}
          iconBg="#EEF4FF"
          iconColor="#2563EB"
        />

        <StatCard
          title="Platform Users"
          value="1,284"
          change="+18%"
          icon={Users}
          iconBg="#F3F0FF"
          iconColor="#6D5DF6"
        />

        <StatCard
          title="Subscriptions"
          value="118"
          change="+9%"
          icon={CreditCard}
          iconBg="#FFF8E1"
          iconColor="#D97706"
        />

        <StatCard
          title="Monthly Revenue"
          value="KES 3.8M"
          change="+22%"
          icon={DollarSign}
          iconBg="#ECFDF3"
          iconColor="#16A34A"
        />

      </section>

      {/* Main Content */}

      <section className="grid gap-6 xl:grid-cols-12">

        <div className="xl:col-span-8">

          <DataTable
            title="Recent Organizations"
            subtitle="Latest organizations onboarded onto Ziya FOS"
            rows={organizations}
          />

        </div>

        <div className="xl:col-span-4">

          <SubscriptionChart />

        </div>

      </section>

    </div>
  );
}