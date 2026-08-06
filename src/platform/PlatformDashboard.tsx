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
import StatusBadge from "./components/StatusBadge";

export default function PlatformDashboard() {
  return (
    <div className="space-y-6">

      <PageHeader
        title="Platform Dashboard"
        subtitle="Manage organizations, subscriptions and platform operations."
      />

      <InfoBanner
        title="Revenue & Licensing Summary"
        description="Monitor platform revenue, subscription performance, enterprise licensing and overall commercial health across all organizations."
      />

      {/* KPI */}

      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">

        <StatCard
          title="Organizations"
          value="125"
          change="+12% this month"
          icon={Building2}
          iconBg="#EEF4FF"
          iconColor="#2563EB"
        />

        <StatCard
          title="Platform Users"
          value="1,284"
          change="+18% this month"
          icon={Users}
          iconBg="#F3F0FF"
          iconColor="#6D5DF6"
        />

        <StatCard
          title="Subscriptions"
          value="118"
          change="+9% this month"
          icon={CreditCard}
          iconBg="#FFF8E1"
          iconColor="#D97706"
        />

        <StatCard
          title="Monthly Revenue"
          value="KES 3.8M"
          change="+22% this month"
          icon={DollarSign}
          iconBg="#ECFDF3"
          iconColor="#16A34A"
        />

      </section>

      {/* Table + Chart */}

      <section className="grid gap-6 xl:grid-cols-12">

        {/* Organizations */}

        <div className="xl:col-span-8 rounded-3xl border border-[#ECECF3] bg-white shadow-sm">

          <div className="flex items-center justify-between border-b border-[#ECECF3] px-6 py-5">

            <div>

              <h2 className="text-lg font-semibold text-[#20243A]">
                Recent Organizations
              </h2>

              <p className="mt-1 text-sm text-[#666B84]">
                Recently onboarded organizations
              </p>

            </div>

            <button className="rounded-xl bg-[#F3F0FF] px-4 py-2 text-sm font-semibold text-[#6D5DF6] transition hover:bg-[#ECE8FF]">
              View All
            </button>

          </div>

          <table className="w-full">

            <thead>

              <tr className="border-b border-[#ECECF3]">

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-500">
                  Organization
                </th>

                <th className="text-left text-sm font-semibold text-slate-500">
                  Plan
                </th>

                <th className="text-left text-sm font-semibold text-slate-500">
                  Users
                </th>

                <th className="text-left text-sm font-semibold text-slate-500">
                  Status
                </th>

              </tr>

            </thead>

            <tbody>

              {[
                ["Ziya Bridge","Enterprise","145","Active"],
                ["Alpha Finance","Professional","63","Active"],
                ["Coastal Capital","Starter","19","Trial"],
                ["Blue Horizon","Professional","42","Active"],
              ].map(([name,plan,users,status]) => (

                <tr
                  key={name}
                  className="border-b border-[#F3F4F6] last:border-0"
                >

                  <td className="px-6 py-5">

                    <div>

                      <p className="font-semibold text-[#20243A]">
                        {name}
                      </p>

                      <p className="text-sm text-slate-500">
                        Kenya
                      </p>

                    </div>

                  </td>

                  <td className="text-[#20243A]">
                    {plan}
                  </td>

                  <td className="text-[#20243A]">
                    {users}
                  </td>

                  <td>

                    <StatusBadge
                      status={
                        status as
                          | "Active"
                          | "Trial"
                      }
                    />

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

        {/* Chart */}

        <div className="xl:col-span-4">

          <SubscriptionChart />

        </div>

      </section>

    </div>
  );
}