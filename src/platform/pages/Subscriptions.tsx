import { Plus, Search, CreditCard, TrendingUp, Building2 } from "lucide-react";

import PageHeader from "../components/PageHeader";
import PrimaryButton from "../components/PrimaryButton";

const subscriptions = [
  {
    organization: "Ziya Bridge",
    plan: "Enterprise",
    billing: "KES 12.5M",
    renewal: "15 Aug 2026",
    status: "Active",
  },
  {
    organization: "Alpha Finance",
    plan: "Professional",
    billing: "KES 3.9M",
    renewal: "22 Aug 2026",
    status: "Active",
  },
  {
    organization: "Coastal Capital",
    plan: "Starter",
    billing: "KES 850K",
    renewal: "02 Sept 2026",
    status: "Trial",
  },
  {
    organization: "Blue Horizon",
    plan: "Professional",
    billing: "KES 2.6M",
    renewal: "12 Sept 2026",
    status: "Expired",
  },
];

export default function Subscriptions() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Subscription Management"
        subtitle="Manage subscription plans, active subscriptions, renewals and recurring revenue across all organizations."
      />

      {/* Toolbar */}

      <div className="flex items-center justify-between rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">
        <div className="relative w-[420px]">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            type="text"
            placeholder="Search subscriptions..."
            className="h-12 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] pl-12 pr-4 text-sm outline-none focus:border-[#D4AF37]"
          />
        </div>

        <PrimaryButton>
          <Plus size={18} />
          <span className="ml-2">New Subscription</span>
        </PrimaryButton>
      </div>

      {/* Summary Cards */}

      <div className="grid grid-cols-4 gap-5">
        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
          <CreditCard
            size={28}
            className="text-[#D4AF37]"
          />

          <p className="mt-4 text-sm text-[#666B84]">
            Active Subscriptions
          </p>

          <h2 className="mt-2 text-4xl font-bold text-[#20243A]">
            221
          </h2>
        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
          <TrendingUp
            size={28}
            className="text-green-600"
          />

          <p className="mt-4 text-sm text-[#666B84]">
            Monthly Revenue
          </p>

          <h2 className="mt-2 text-4xl font-bold text-green-600">
            KES 48.75M
          </h2>
        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
          <Building2
            size={28}
            className="text-blue-600"
          />

          <p className="mt-4 text-sm text-[#666B84]">
            Organizations
          </p>

          <h2 className="mt-2 text-4xl font-bold text-[#20243A]">
            268
          </h2>
        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">
          <TrendingUp
            size={28}
            className="text-purple-600"
          />

          <p className="mt-4 text-sm text-[#666B84]">
            Growth
          </p>

          <h2 className="mt-2 text-4xl font-bold text-purple-600">
            +18%
          </h2>
        </div>
      </div>

      {/* Table */}

      <div className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white shadow-sm">
        <div className="border-b border-[#ECECF3] bg-[#F8F9FC] px-6 py-5">
          <h2 className="text-xl font-bold text-[#20243A]">
            Active Subscriptions
          </h2>
        </div>

        <table className="w-full">
          <thead className="bg-[#F8F9FC] text-left">
            <tr className="text-sm text-[#666B84]">
              <th className="px-6 py-4">Organization</th>
              <th className="px-6 py-4">Plan</th>
              <th className="px-6 py-4">Billing</th>
              <th className="px-6 py-4">Renewal</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>

          <tbody>
            {subscriptions.map((subscription) => (
              <tr
                key={subscription.organization}
                className="border-t border-[#ECECF3] hover:bg-[#F8F9FC]"
              >
                <td className="px-6 py-5 font-semibold text-[#20243A]">
                  {subscription.organization}
                </td>

                <td className="px-6 py-5 text-[#666B84]">
                  {subscription.plan}
                </td>

                <td className="px-6 py-5 font-semibold text-green-600">
                  {subscription.billing}
                </td>

                <td className="px-6 py-5 text-[#666B84]">
                  {subscription.renewal}
                </td>

                <td className="px-6 py-5">
                  <span
                    className={`rounded-full px-4 py-2 text-xs font-semibold ${
                      subscription.status === "Active"
                        ? "bg-green-100 text-green-700"
                        : subscription.status === "Trial"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {subscription.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}