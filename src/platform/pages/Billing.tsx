import { useState } from "react";

export default function Billing() {
  const [overview] = useState({
    organizations: 268,
    activeSubscriptions: 221,
    complimentaryLicenses: 18,
    enterpriseContracts: 9,
    monthlyRevenue: "$48,750",
    annualRevenue: "$585,000",
  });

  return (
    <div className="space-y-8">

      {/* ===========================================
          PAGE HEADER
      =========================================== */}

      <div className="flex items-center justify-between">

        <div>

          <h1 className="text-3xl font-bold text-white">
            Revenue, Subscription & Licensing
          </h1>

          <p className="mt-2 text-slate-400">
            Manage subscriptions, licensing, enterprise contracts,
            complimentary organizations and commercial operations
            across the Ziya Financial Operating System Platform.
          </p>

        </div>

        <button className="rounded-xl bg-amber-500 px-6 py-3 font-semibold text-black hover:bg-amber-400 transition">
          Create Subscription Plan
        </button>

      </div>

      {/* ===========================================
          PLATFORM OVERVIEW
      =========================================== */}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-6">

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-sm text-slate-400">
            Organizations
          </p>

          <h2 className="mt-4 text-4xl font-bold text-white">
            {overview.organizations}
          </h2>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-sm text-slate-400">
            Active Plans
          </p>

          <h2 className="mt-4 text-4xl font-bold text-emerald-400">
            {overview.activeSubscriptions}
          </h2>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-sm text-slate-400">
            Complimentary
          </p>

          <h2 className="mt-4 text-4xl font-bold text-blue-400">
            {overview.complimentaryLicenses}
          </h2>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-sm text-slate-400">
            Enterprise
          </p>

          <h2 className="mt-4 text-4xl font-bold text-purple-400">
            {overview.enterpriseContracts}
          </h2>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-sm text-slate-400">
            Monthly Revenue
          </p>

          <h2 className="mt-4 text-3xl font-bold text-emerald-400">
            {overview.monthlyRevenue}
          </h2>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-sm text-slate-400">
            Annual Revenue
          </p>

          <h2 className="mt-4 text-3xl font-bold text-emerald-400">
            {overview.annualRevenue}
          </h2>

        </div>

      </div>      {/* ===========================================
          SUBSCRIPTION PLANS
      =========================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <div className="flex items-center justify-between">

          <div>

            <h2 className="text-2xl font-semibold text-white">
              Subscription Plans
            </h2>

            <p className="mt-2 text-slate-400">
              Commercial plans available to organizations using
              the Ziya Financial Operating System.
            </p>

          </div>

          <button className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-500">
            New Plan
          </button>

        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-4">

          {/* Starter */}

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6">

            <h3 className="text-xl font-bold text-white">
              Starter
            </h3>

            <p className="mt-4 text-4xl font-bold text-emerald-400">
              Free
            </p>

            <p className="mt-2 text-sm text-slate-400">
              Small businesses beginning with Ziya FOS.
            </p>

            <button className="mt-8 w-full rounded-lg bg-slate-800 py-3 text-white hover:bg-slate-700">
              Manage Plan
            </button>

          </div>

          {/* Professional */}

          <div className="rounded-2xl border border-blue-700 bg-slate-950 p-6">

            <h3 className="text-xl font-bold text-white">
              Professional
            </h3>

            <p className="mt-4 text-4xl font-bold text-blue-400">
              Monthly
            </p>

            <p className="mt-2 text-sm text-slate-400">
              Designed for growing organizations.
            </p>

            <button className="mt-8 w-full rounded-lg bg-blue-600 py-3 text-white hover:bg-blue-500">
              Manage Plan
            </button>

          </div>

          {/* Enterprise */}

          <div className="rounded-2xl border border-purple-700 bg-slate-950 p-6">

            <h3 className="text-xl font-bold text-white">
              Enterprise
            </h3>

            <p className="mt-4 text-4xl font-bold text-purple-400">
              Custom
            </p>

            <p className="mt-2 text-sm text-slate-400">
              Tailored contracts for enterprise customers.
            </p>

            <button className="mt-8 w-full rounded-lg bg-purple-600 py-3 text-white hover:bg-purple-500">
              Manage Plan
            </button>

          </div>

          {/* Partner */}

          <div className="rounded-2xl border border-amber-700 bg-slate-950 p-6">

            <h3 className="text-xl font-bold text-white">
              Strategic Partner
            </h3>

            <p className="mt-4 text-4xl font-bold text-amber-400">
              Custom
            </p>

            <p className="mt-2 text-sm text-slate-400">
              Long-term partner agreements managed by Ziya.
            </p>

            <button className="mt-8 w-full rounded-lg bg-amber-500 py-3 font-semibold text-black hover:bg-amber-400">
              Manage Plan
            </button>

          </div>

        </div>

      </section>

      {/* ===========================================
          LICENSE MANAGEMENT
      =========================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <div className="flex items-center justify-between">

          <div>

            <h2 className="text-2xl font-semibold text-white">
              License Management
            </h2>

            <p className="mt-2 text-slate-400">
              Control platform access independently of billing.
            </p>

          </div>

          <button className="rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-500">
            Create License
          </button>

        </div>

        <div className="mt-8 overflow-hidden rounded-xl border border-slate-800">

          <table className="min-w-full">

            <thead className="bg-slate-950">

              <tr>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  License Type
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  Billing
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  Platform Access
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  Typical Usage
                </th>

              </tr>

            </thead>

            <tbody>

              <tr className="border-t border-slate-800">

                <td className="px-6 py-5 font-medium text-white">
                  Complimentary
                </td>

                <td className="px-6 py-5 text-blue-300">
                  Free
                </td>

                <td className="px-6 py-5 text-emerald-400">
                  Enabled
                </td>

                <td className="px-6 py-5 text-slate-300">
                  NGOs, pilot customers, strategic onboarding.
                </td>

              </tr>

              <tr className="border-t border-slate-800">

                <td className="px-6 py-5 font-medium text-white">
                  Paid Subscription
                </td>

                <td className="px-6 py-5 text-emerald-400">
                  Active
                </td>

                <td className="px-6 py-5 text-emerald-400">
                  Enabled
                </td>

                <td className="px-6 py-5 text-slate-300">
                  Standard commercial organizations.
                </td>

              </tr>

              <tr className="border-t border-slate-800">

                <td className="px-6 py-5 font-medium text-white">
                  Enterprise Contract
                </td>

                <td className="px-6 py-5 text-purple-400">
                  Contract
                </td>

                <td className="px-6 py-5 text-emerald-400">
                  Enabled
                </td>

                <td className="px-6 py-5 text-slate-300">
                  Custom pricing and negotiated agreements.
                </td>

              </tr>

              <tr className="border-t border-slate-800">

                <td className="px-6 py-5 font-medium text-white">
                  Internal
                </td>

                <td className="px-6 py-5 text-amber-400">
                  Not Billed
                </td>

                <td className="px-6 py-5 text-emerald-400">
                  Enabled
                </td>

                <td className="px-6 py-5 text-slate-300">
                  Ziya internal testing and development environments.
                </td>

              </tr>

            </tbody>

          </table>

        </div>

      </section>      {/* ===========================================
          ORGANIZATION SUBSCRIPTIONS
      =========================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <div className="flex items-center justify-between">

          <div>

            <h2 className="text-2xl font-semibold text-white">
              Organization Subscription Management
            </h2>

            <p className="mt-2 text-slate-400">
              Manage commercial relationships, licensing, billing status
              and platform access for every organization.
            </p>

          </div>

          <button className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-500">
            Add Organization Plan
          </button>

        </div>

        <div className="mt-8 overflow-hidden rounded-xl border border-slate-800">

          <table className="min-w-full">

            <thead className="bg-slate-950">

              <tr>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  Organization
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  Subscription Plan
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  License
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  Billing Status
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  Renewal
                </th>

                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                  Actions
                </th>

              </tr>

            </thead>

            <tbody>

              {/* Ziya Bridge */}

              <tr className="border-t border-slate-800">

                <td className="px-6 py-5">

                  <div>

                    <p className="font-semibold text-white">
                      Ziya Bridge
                    </p>

                    <p className="text-sm text-slate-500">
                      Internal Platform
                    </p>

                  </div>

                </td>

                <td className="px-6 py-5 text-white">
                  Enterprise
                </td>

                <td className="px-6 py-5">

                  <span className="rounded-full bg-amber-900/40 px-3 py-1 text-sm font-semibold text-amber-300">
                    Internal
                  </span>

                </td>

                <td className="px-6 py-5 text-slate-300">
                  Not Billed
                </td>

                <td className="px-6 py-5 text-slate-300">
                  —
                </td>

                <td className="px-6 py-5 text-center">

                  <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500">
                    Manage
                  </button>

                </td>

              </tr>

              {/* Example Customer */}

              <tr className="border-t border-slate-800">

                <td className="px-6 py-5">

                  <div>

                    <p className="font-semibold text-white">
                      Coast Logistics Ltd
                    </p>

                    <p className="text-sm text-slate-500">
                      Active Organization
                    </p>

                  </div>

                </td>

                <td className="px-6 py-5 text-white">
                  Professional
                </td>

                <td className="px-6 py-5">

                  <span className="rounded-full bg-emerald-900/40 px-3 py-1 text-sm font-semibold text-emerald-300">
                    Paid
                  </span>

                </td>

                <td className="px-6 py-5 text-emerald-400">
                  Active
                </td>

                <td className="px-6 py-5 text-slate-300">
                  15 Sep 2026
                </td>

                <td className="px-6 py-5 text-center">

                  <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500">
                    Manage
                  </button>

                </td>

              </tr>

              {/* Complimentary */}

              <tr className="border-t border-slate-800">

                <td className="px-6 py-5">

                  <div>

                    <p className="font-semibold text-white">
                      Kenya Red Cross
                    </p>

                    <p className="text-sm text-slate-500">
                      Strategic Partner
                    </p>

                  </div>

                </td>

                <td className="px-6 py-5 text-white">
                  Enterprise
                </td>

                <td className="px-6 py-5">

                  <span className="rounded-full bg-blue-900/40 px-3 py-1 text-sm font-semibold text-blue-300">
                    Complimentary
                  </span>

                </td>

                <td className="px-6 py-5 text-blue-300">
                  Active
                </td>

                <td className="px-6 py-5 text-slate-300">
                  Unlimited
                </td>

                <td className="px-6 py-5 text-center">

                  <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500">
                    Manage
                  </button>

                </td>

              </tr>

            </tbody>

          </table>

        </div>

      </section>      {/* ===========================================
          ORGANIZATION LICENSING & FEATURE ACCESS
      =========================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <div className="flex items-center justify-between">

          <div>

            <h2 className="text-2xl font-semibold text-white">
              Organization Licensing & Feature Access
            </h2>

            <p className="mt-2 text-slate-400">
              Configure product access, operational limits and platform
              capabilities independently of subscription billing.
            </p>

          </div>

          <button className="rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-500">
            Create License Profile
          </button>

        </div>

        <div className="mt-8 overflow-hidden rounded-xl border border-slate-800">

          <table className="min-w-full">

            <thead className="bg-slate-950">

              <tr>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  Feature
                </th>

                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                  Current Limit
                </th>

                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                  Status
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  Description
                </th>

              </tr>

            </thead>

            <tbody>

              <tr className="border-t border-slate-800">
                <td className="px-6 py-5 font-medium text-white">Platform Users</td>
                <td className="px-6 py-5 text-center text-white">Unlimited</td>
                <td className="px-6 py-5 text-center text-emerald-400">Enabled</td>
                <td className="px-6 py-5 text-slate-300">
                  Maximum number of licensed users.
                </td>
              </tr>

              <tr className="border-t border-slate-800">
                <td className="px-6 py-5 font-medium text-white">Branches</td>
                <td className="px-6 py-5 text-center text-white">Unlimited</td>
                <td className="px-6 py-5 text-center text-emerald-400">Enabled</td>
                <td className="px-6 py-5 text-slate-300">
                  Multi-branch operations.
                </td>
              </tr>

              <tr className="border-t border-slate-800">
                <td className="px-6 py-5 font-medium text-white">Storage</td>
                <td className="px-6 py-5 text-center text-white">2 TB</td>
                <td className="px-6 py-5 text-center text-emerald-400">Enabled</td>
                <td className="px-6 py-5 text-slate-300">
                  Document and report storage allocation.
                </td>
              </tr>

              <tr className="border-t border-slate-800">
                <td className="px-6 py-5 font-medium text-white">AI Assistant</td>
                <td className="px-6 py-5 text-center text-white">Unlimited</td>
                <td className="px-6 py-5 text-center text-emerald-400">Enabled</td>
                <td className="px-6 py-5 text-slate-300">
                  Access to Ziya AI and intelligent automation.
                </td>
              </tr>

              <tr className="border-t border-slate-800">
                <td className="px-6 py-5 font-medium text-white">API Access</td>
                <td className="px-6 py-5 text-center text-white">Enabled</td>
                <td className="px-6 py-5 text-center text-emerald-400">Enabled</td>
                <td className="px-6 py-5 text-slate-300">
                  Secure API integrations.
                </td>
              </tr>

              <tr className="border-t border-slate-800">
                <td className="px-6 py-5 font-medium text-white">Bank Integrations</td>
                <td className="px-6 py-5 text-center text-white">Unlimited</td>
                <td className="px-6 py-5 text-center text-emerald-400">Enabled</td>
                <td className="px-6 py-5 text-slate-300">
                  Connect supported banking partners.
                </td>
              </tr>

              <tr className="border-t border-slate-800">
                <td className="px-6 py-5 font-medium text-white">M-Pesa Integration</td>
                <td className="px-6 py-5 text-center text-white">Enabled</td>
                <td className="px-6 py-5 text-center text-emerald-400">Enabled</td>
                <td className="px-6 py-5 text-slate-300">
                  Mobile money connectivity.
                </td>
              </tr>

              <tr className="border-t border-slate-800">
                <td className="px-6 py-5 font-medium text-white">Custom Branding</td>
                <td className="px-6 py-5 text-center text-white">Available</td>
                <td className="px-6 py-5 text-center text-emerald-400">Enabled</td>
                <td className="px-6 py-5 text-slate-300">
                  Organization logo and custom identity.
                </td>
              </tr>

            </tbody>

          </table>

        </div>

      </section>

      {/* ===========================================
          REVENUE PLATFORM SUMMARY
      =========================================== */}

      <section className="rounded-2xl border border-emerald-800 bg-emerald-950/20 p-8">

        <h2 className="text-2xl font-semibold text-emerald-400">
          Revenue & Licensing Summary
        </h2>

        <p className="mt-4 text-slate-300">
          The Billing module is the commercial engine of Ziya Financial Operating System.
          It manages subscription plans, enterprise contracts, complimentary organizations,
          licensing, feature access and commercial operations at the platform level.
          Business transactions, accounting records and financial activities remain
          within each organization's workspace and are intentionally separated from
          platform administration.
        </p>

      </section>

    </div>
  );
}