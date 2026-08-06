import {
  Building2,
  CreditCard,
  DollarSign,
  Search,
  TrendingUp,
} from "lucide-react";

import PageHeader from "../components/PageHeader";
import InfoBanner from "../components/InfoBanner";
import PrimaryButton from "../components/PrimaryButton";
import StatCard from "../components/StatCard";

export default function Billing() {
  return (
    <div className="space-y-6">

      <PageHeader
        title="Billing & Revenue"
        subtitle="Manage subscriptions, licensing, invoices and commercial performance across the Ziya Financial Operating System."
      />

      <InfoBanner
        title="Commercial Operations"
        description="Monitor recurring revenue, enterprise subscriptions, licensing, invoices and platform-wide commercial performance."
      />

      {/* Toolbar */}

      <div className="flex items-center justify-between rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">

        <div className="relative w-[420px]">

          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8]"
          />

          <input
            type="text"
            placeholder="Search subscriptions, invoices..."
            className="h-12 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] pl-12 pr-4 text-sm text-[#20243A] outline-none transition-all duration-200 placeholder:text-[#94A3B8] focus:border-[#C6A052] focus:bg-white"
          />

        </div>

        <PrimaryButton>
          Create Subscription Plan
        </PrimaryButton>

      </div>

      {/* KPI Cards */}

      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">

        <StatCard
          title="Monthly Revenue"
          value="KES 3.8M"
          change="+22% this month"
          icon={DollarSign}
          iconBg="#FEF3C7"
          iconColor="#C6A052"
        />

        <StatCard
          title="Annual Revenue"
          value="KES 45.6M"
          change="+18% YoY"
          icon={TrendingUp}
          iconBg="#ECFDF3"
          iconColor="#16A34A"
        />

        <StatCard
          title="Active Subscriptions"
          value="118"
          change="+9 this month"
          icon={CreditCard}
          iconBg="#EEF4FF"
          iconColor="#2563EB"
        />

        <StatCard
          title="Enterprise Clients"
          value="24"
          change="+3 this quarter"
          icon={Building2}
          iconBg="#F3F0FF"
          iconColor="#6D5DF6"
        />

      </section>      {/* Subscription Plans */}

      <section className="rounded-3xl border border-[#ECECF3] bg-white p-8 shadow-sm">

        <div className="mb-8 flex items-center justify-between">

          <div>

            <h2 className="text-2xl font-semibold text-[#20243A]">
              Subscription Plans
            </h2>

            <p className="mt-2 text-sm text-[#666B84]">
              Commercial plans available for organizations using Ziya Financial
              Operating System.
            </p>

          </div>

          <PrimaryButton>
            New Plan
          </PrimaryButton>

        </div>

        <div className="grid gap-6 xl:grid-cols-4">

          {/* Starter */}

          <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 transition hover:shadow-lg">

            <div className="mb-5">

              <span className="rounded-full bg-[#F8F9FC] px-3 py-1 text-xs font-semibold text-[#666B84]">
                Starter
              </span>

            </div>

            <h3 className="text-3xl font-bold text-[#20243A]">
              Free
            </h3>

            <p className="mt-3 text-sm leading-6 text-[#666B84]">
              Perfect for startups and small businesses beginning with Ziya FOS.
            </p>

            <ul className="mt-6 space-y-3 text-sm text-[#20243A]">

              <li>✓ Up to 5 Users</li>

              <li>✓ Core Accounting</li>

              <li>✓ Financial Reports</li>

              <li>✓ Email Support</li>

            </ul>

            <button className="mt-8 w-full rounded-xl border border-[#ECECF3] py-3 font-semibold text-[#20243A] transition hover:bg-[#F8F9FC]">
              Manage Plan
            </button>

          </div>

          {/* Professional */}

          <div className="rounded-2xl border-2 border-[#C6A052] bg-white p-6 shadow-lg">

            <div className="mb-5 flex items-center justify-between">

              <span className="rounded-full bg-[#FFF7E6] px-3 py-1 text-xs font-semibold text-[#C6A052]">
                Professional
              </span>

              <span className="rounded-full bg-[#C6A052] px-3 py-1 text-xs font-semibold text-white">
                Popular
              </span>

            </div>

            <h3 className="text-3xl font-bold text-[#20243A]">
              KES 15,000
            </h3>

            <p className="mt-1 text-sm text-[#666B84]">
              per month
            </p>

            <ul className="mt-6 space-y-3 text-sm text-[#20243A]">

              <li>✓ Unlimited Users</li>

              <li>✓ AI Insights</li>

              <li>✓ Bank Integration</li>

              <li>✓ M-Pesa Integration</li>

              <li>✓ Priority Support</li>

            </ul>

            <button className="mt-8 w-full rounded-xl bg-[#C6A052] py-3 font-semibold text-white transition hover:bg-[#B38D43]">
              Manage Plan
            </button>

          </div>

          {/* Enterprise */}

          <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 transition hover:shadow-lg">

            <div className="mb-5">

              <span className="rounded-full bg-[#EEF4FF] px-3 py-1 text-xs font-semibold text-[#2563EB]">
                Enterprise
              </span>

            </div>

            <h3 className="text-3xl font-bold text-[#20243A]">
              Custom
            </h3>

            <p className="mt-3 text-sm leading-6 text-[#666B84]">
              Tailored pricing for large organizations and enterprise deployments.
            </p>

            <ul className="mt-6 space-y-3 text-sm text-[#20243A]">

              <li>✓ Unlimited Everything</li>

              <li>✓ Multi-Tenancy</li>

              <li>✓ Dedicated Support</li>

              <li>✓ SLA & Custom Branding</li>

            </ul>

            <button className="mt-8 w-full rounded-xl border border-[#ECECF3] py-3 font-semibold text-[#20243A] transition hover:bg-[#F8F9FC]">
              Contact Sales
            </button>

          </div>

          {/* Complimentary */}

          <div className="rounded-2xl border border-[#ECECF3] bg-[#F8F9FC] p-6">

            <div className="mb-5">

              <span className="rounded-full bg-[#ECFDF3] px-3 py-1 text-xs font-semibold text-[#16A34A]">
                Complimentary
              </span>

            </div>

            <h3 className="text-3xl font-bold text-[#16A34A]">
              Free
            </h3>

            <p className="mt-3 text-sm leading-6 text-[#666B84]">
              Reserved for strategic partners and approved organizations.
            </p>

            <ul className="mt-6 space-y-3 text-sm text-[#20243A]">

              <li>✓ Full Platform Access</li>

              <li>✓ Organization Branding</li>

              <li>✓ Dedicated Success Team</li>

              <li>✓ Annual Review</li>

            </ul>

            <button className="mt-8 w-full rounded-xl border border-[#16A34A] py-3 font-semibold text-[#16A34A] transition hover:bg-[#ECFDF3]">
              View Details
            </button>

          </div>

        </div>

      </section>      {/* Recent Invoices */}

      <section className="rounded-3xl border border-[#ECECF3] bg-white shadow-sm">

        <div className="flex items-center justify-between border-b border-[#ECECF3] px-8 py-6">

          <div>

            <h2 className="text-2xl font-semibold text-[#20243A]">
              Recent Invoices
            </h2>

            <p className="mt-2 text-sm text-[#666B84]">
              Latest subscription payments across all organizations.
            </p>

          </div>

          <button className="rounded-xl border border-[#ECECF3] px-5 py-3 font-semibold text-[#20243A] transition hover:bg-[#F8F9FC]">
            View All
          </button>

        </div>

        <div className="overflow-x-auto">

          <table className="w-full">

            <thead className="bg-[#FAFBFD]">

              <tr>

                <th className="px-8 py-4 text-left text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                  Organization
                </th>

                <th className="text-left text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                  Plan
                </th>

                <th className="text-left text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                  Invoice
                </th>

                <th className="text-left text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                  Amount
                </th>

                <th className="text-left text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                  Due Date
                </th>

                <th className="text-left text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                  Status
                </th>

              </tr>

            </thead>

            <tbody>

              {[
                {
                  org: "Ziya Bridge",
                  plan: "Enterprise",
                  invoice: "INV-0001",
                  amount: "KES 420,000",
                  due: "01 Aug 2026",
                  status: "Paid",
                },
                {
                  org: "Alpha Finance",
                  plan: "Professional",
                  invoice: "INV-0002",
                  amount: "KES 95,000",
                  due: "03 Aug 2026",
                  status: "Paid",
                },
                {
                  org: "Blue Horizon",
                  plan: "Professional",
                  invoice: "INV-0003",
                  amount: "KES 90,000",
                  due: "05 Aug 2026",
                  status: "Pending",
                },
                {
                  org: "Coastal Capital",
                  plan: "Starter",
                  invoice: "INV-0004",
                  amount: "KES 35,000",
                  due: "08 Aug 2026",
                  status: "Trial",
                },
                {
                  org: "Future Holdings",
                  plan: "Enterprise",
                  invoice: "INV-0005",
                  amount: "KES 580,000",
                  due: "12 Aug 2026",
                  status: "Paid",
                },
              ].map((invoice) => (

                <tr
                  key={invoice.invoice}
                  className="border-t border-[#F1F5F9] transition hover:bg-[#FAFBFD]"
                >

                  <td className="px-8 py-5">

                    <div>

                      <p className="font-semibold text-[#20243A]">
                        {invoice.org}
                      </p>

                      <p className="mt-1 text-sm text-[#94A3B8]">
                        {invoice.invoice}
                      </p>

                    </div>

                  </td>

                  <td className="font-medium text-[#20243A]">
                    {invoice.plan}
                  </td>

                  <td className="text-[#20243A]">
                    {invoice.invoice}
                  </td>

                  <td className="font-semibold text-[#20243A]">
                    {invoice.amount}
                  </td>

                  <td className="text-[#666B84]">
                    {invoice.due}
                  </td>

                  <td>

                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        invoice.status === "Paid"
                          ? "bg-[#ECFDF3] text-[#16A34A]"
                          : invoice.status === "Pending"
                          ? "bg-[#FFF7E6] text-[#C6A052]"
                          : "bg-[#EEF4FF] text-[#2563EB]"
                      }`}
                    >
                      {invoice.status}
                    </span>

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </section>      {/* Revenue Analytics */}

      <section className="grid gap-6 xl:grid-cols-12">

        {/* Revenue Trend */}

        <div className="xl:col-span-8 rounded-3xl border border-[#ECECF3] bg-white p-8 shadow-sm">

          <div className="flex items-center justify-between">

            <div>

              <h2 className="text-2xl font-semibold text-[#20243A]">
                Revenue Trend
              </h2>

              <p className="mt-2 text-sm text-[#666B84]">
                Monthly recurring revenue performance.
              </p>

            </div>

            <button className="rounded-xl border border-[#ECECF3] px-5 py-3 text-sm font-semibold text-[#20243A] transition hover:bg-[#F8F9FC]">
              Last 12 Months
            </button>

          </div>

          <div className="mt-10 flex h-[320px] items-end justify-between gap-4">

            {[
              42, 48, 55, 61, 66, 71,
              76, 82, 88, 94, 97, 100,
            ].map((height, index) => (

              <div
                key={index}
                className="flex flex-1 flex-col items-center"
              >

                <div
                  className="w-full rounded-t-xl bg-gradient-to-t from-[#C6A052] to-[#E5C46B]"
                  style={{
                    height: `${height}%`,
                  }}
                />

                <span className="mt-3 text-xs text-[#94A3B8]">
                  {
                    [
                      "Jan",
                      "Feb",
                      "Mar",
                      "Apr",
                      "May",
                      "Jun",
                      "Jul",
                      "Aug",
                      "Sep",
                      "Oct",
                      "Nov",
                      "Dec",
                    ][index]
                  }
                </span>

              </div>

            ))}

          </div>

        </div>

        {/* Revenue Summary */}

        <div className="xl:col-span-4 rounded-3xl border border-[#ECECF3] bg-white p-8 shadow-sm">

          <h2 className="text-2xl font-semibold text-[#20243A]">
            Revenue Summary
          </h2>

          <div className="mt-8 space-y-6">

            <div className="flex items-center justify-between">

              <span className="text-[#666B84]">
                Monthly Revenue
              </span>

              <span className="font-semibold text-[#20243A]">
                KES 3.8M
              </span>

            </div>

            <div className="flex items-center justify-between">

              <span className="text-[#666B84]">
                Annual Revenue
              </span>

              <span className="font-semibold text-[#20243A]">
                KES 45.6M
              </span>

            </div>

            <div className="flex items-center justify-between">

              <span className="text-[#666B84]">
                Active Plans
              </span>

              <span className="font-semibold text-[#20243A]">
                118
              </span>

            </div>

            <div className="flex items-center justify-between">

              <span className="text-[#666B84]">
                Enterprise Clients
              </span>

              <span className="font-semibold text-[#20243A]">
                24
              </span>

            </div>

            <div className="flex items-center justify-between">

              <span className="text-[#666B84]">
                Growth Rate
              </span>

              <span className="font-semibold text-[#16A34A]">
                +22%
              </span>

            </div>

          </div>

          <button className="mt-10 w-full rounded-xl bg-[#C6A052] py-3 font-semibold text-white transition hover:bg-[#B38D43]">
            Export Revenue Report
          </button>

        </div>

      </section>

      {/* Licensing Summary */}

      <section className="rounded-3xl border border-[#ECECF3] bg-white p-8 shadow-sm">

        <h2 className="text-2xl font-semibold text-[#20243A]">
          Licensing Summary
        </h2>

        <p className="mt-4 max-w-4xl leading-8 text-[#666B84]">

          Ziya Financial Operating System operates as a commercial
          multi-tenant SaaS platform. Organizations subscribe to
          different licensing plans based on their operational
          requirements. Platform Billing manages subscription plans,
          recurring invoices, enterprise agreements, complimentary
          organizations, feature licensing and commercial reporting,
          while every organization's accounting records remain
          completely isolated within its own workspace.

        </p>

      </section>

    </div>
  );
}