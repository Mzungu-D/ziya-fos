import {
  Building2,
  CreditCard,
  DollarSign,
  Users,
} from "lucide-react";

import PageHeader from "./components/PageHeader";
import InfoBanner from "./components/InfoBanner";
import StatCard from "./components/StatCard";
import DataCard from "./components/DataCard";
import PrimaryButton from "./components/PrimaryButton";

export default function PlatformDashboard() {
  return (
    <div className="space-y-8">

      <PageHeader
        title="Platform Dashboard"
        subtitle="Welcome to the Ziya Financial Operating System Platform Administration."
      />

      <InfoBanner
        title="Revenue & Licensing Summary"
        description="The Billing module is the commercial engine of Ziya Financial Operating System. It manages subscription plans, enterprise contracts, complimentary organizations, licensing, feature access and commercial operations at the platform level. Business transactions, accounting records and financial activities remain within each organization's workspace and are intentionally separated from platform administration."
      />

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-4">

        <StatCard
          title="Total Organizations"
          value="27"
          change="12% from last month"
          icon={Building2}
          iconBg="#F3F0FF"
          iconColor="#6D5DF6"
        />

        <StatCard
          title="Active Users"
          value="184"
          change="8% from last month"
          icon={Users}
          iconBg="#F3F0FF"
          iconColor="#6D5DF6"
        />

        <StatCard
          title="Active Subscriptions"
          value="24"
          change="6% from last month"
          icon={CreditCard}
          iconBg="#FFF6DD"
          iconColor="#C98A00"
        />

        <StatCard
          title="Monthly Revenue"
          value="KES 1.45M"
          change="18% from last month"
          icon={DollarSign}
          iconBg="#EAFBF2"
          iconColor="#16A34A"
        />

      </section>

      <section className="grid gap-6 xl:grid-cols-2">

        <DataCard
          title="Recent Organizations"
          action={
            <PrimaryButton>
              View All
            </PrimaryButton>
          }
        >

          <table className="w-full">

            <thead>

              <tr className="border-b border-[#ECECF3]">

                <th className="py-4 text-left text-sm font-semibold text-slate-500">
                  Organization
                </th>

                <th className="py-4 text-left text-sm font-semibold text-slate-500">
                  Status
                </th>

                <th className="py-4 text-left text-sm font-semibold text-slate-500">
                  Users
                </th>

                <th className="py-4 text-left text-sm font-semibold text-slate-500">
                  Subscription
                </th>

                <th className="py-4 text-left text-sm font-semibold text-slate-500">
                  Joined
                </th>

              </tr>

            </thead>

            <tbody>

              <tr className="border-b border-[#F3F4F6]">

                <td className="py-5 font-medium text-[#20243A]">
                  Sunrise Enterprises Ltd
                </td>

                <td className="py-5">
                  <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                    Active
                  </span>
                </td>

                <td className="py-5">
                  24
                </td>

                <td className="py-5">
                  Enterprise
                </td>

                <td className="py-5">
                  Jul 15, 2025
                </td>

              </tr>

              <tr className="border-b border-[#F3F4F6]">

                <td className="py-5 font-medium text-[#20243A]">
                  Alpha Solutions
                </td>

                <td className="py-5">
                  <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                    Active
                  </span>
                </td>

                <td className="py-5">
                  16
                </td>

                <td className="py-5">
                  Professional
                </td>

                <td className="py-5">
                  Jul 12, 2025
                </td>

              </tr>

              <tr className="border-b border-[#F3F4F6]">

                <td className="py-5 font-medium text-[#20243A]">
                  Greenfield Holdings
                </td>

                <td className="py-5">
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                    Trial
                  </span>
                </td>

                <td className="py-5">
                  7
                </td>

                <td className="py-5">
                  Starter
                </td>

                <td className="py-5">
                  Jul 10, 2025
                </td>

              </tr>

              <tr>

                <td className="py-5 font-medium text-[#20243A]">
                  Coastal Supplies Ltd
                </td>

                <td className="py-5">
                  <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                    Active
                  </span>
                </td>

                <td className="py-5">
                  11
                </td>

                <td className="py-5">
                  Professional
                </td>

                <td className="py-5">
                  Jul 08, 2025
                </td>

              </tr>

            </tbody>

          </table>

        </DataCard>

        <DataCard
          title="Subscription Overview"
          action={
            <PrimaryButton>
              View Report
            </PrimaryButton>
          }
        >

          <div className="flex flex-col items-center justify-center py-10">

            <div className="flex h-64 w-64 items-center justify-center rounded-full border-[28px] border-[#6D5DF6]">

              <div className="text-center">

                <h2 className="text-5xl font-bold text-[#20243A]">
                  24
                </h2>

                <p className="mt-2 text-slate-500">
                  Total
                </p>

              </div>

            </div>

            <div className="mt-10 w-full space-y-4">

              <div className="flex justify-between">

                <span className="text-slate-600">
                  Enterprise
                </span>

                <span className="font-semibold">
                  10 (41.7%)
                </span>

              </div>

              <div className="flex justify-between">

                <span className="text-slate-600">
                  Professional
                </span>

                <span className="font-semibold">
                  7 (29.2%)
                </span>

              </div>

              <div className="flex justify-between">

                <span className="text-slate-600">
                  Starter
                </span>

                <span className="font-semibold">
                  5 (20.8%)
                </span>

              </div>

              <div className="flex justify-between">

                <span className="text-slate-600">
                  Trial
                </span>

                <span className="font-semibold">
                  2 (8.3%)
                </span>

              </div>

            </div>

          </div>

        </DataCard>

      </section>

    </div>
  );
}