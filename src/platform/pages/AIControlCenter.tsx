import { useState } from "react";

export default function AIControlCenter() {
  const [platform] = useState({
    aiEngine: "Operational",
    organizationsUsingAI: 214,
    aiRequestsToday: 18492,
    aiAvailability: "99.99%",
    averageResponse: "1.2 sec",
    activePolicies: 16,
  });

  return (
    <div className="space-y-8">

      {/* ===========================================
          PAGE HEADER
      =========================================== */}

      <div className="flex items-center justify-between">

        <div>

          <h1 className="text-3xl font-bold text-white">
            AI Control Center
          </h1>

          <p className="mt-2 text-slate-400">
            Govern, monitor and operate the Ziya AI Platform
            powering every organization using Ziya Financial
            Operating System.
          </p>

        </div>

        <button className="rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white hover:bg-violet-500">
          AI Configuration
        </button>

      </div>

      {/* ===========================================
          AI PLATFORM OVERVIEW
      =========================================== */}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-6">

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-sm text-slate-400">
            AI Engine
          </p>

          <h2 className="mt-4 text-3xl font-bold text-emerald-400">
            {platform.aiEngine}
          </h2>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-sm text-slate-400">
            AI Organizations
          </p>

          <h2 className="mt-4 text-3xl font-bold text-white">
            {platform.organizationsUsingAI}
          </h2>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-sm text-slate-400">
            Requests Today
          </p>

          <h2 className="mt-4 text-3xl font-bold text-blue-400">
            {platform.aiRequestsToday}
          </h2>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-sm text-slate-400">
            Availability
          </p>

          <h2 className="mt-4 text-3xl font-bold text-emerald-400">
            {platform.aiAvailability}
          </h2>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-sm text-slate-400">
            Avg Response
          </p>

          <h2 className="mt-4 text-3xl font-bold text-white">
            {platform.averageResponse}
          </h2>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-sm text-slate-400">
            AI Policies
          </p>

          <h2 className="mt-4 text-3xl font-bold text-violet-400">
            {platform.activePolicies}
          </h2>

        </div>

      </div>      {/* ===========================================
          AI CAPABILITY MANAGEMENT
      =========================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <div className="flex items-center justify-between">

          <div>

            <h2 className="text-2xl font-semibold text-white">
              AI Capability Management
            </h2>

            <p className="mt-2 text-slate-400">
              Enable, disable and manage AI capabilities available across
              the Ziya Financial Operating System platform.
            </p>

          </div>

          <button className="rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white hover:bg-violet-500">
            Add Capability
          </button>

        </div>

        <div className="mt-8 overflow-hidden rounded-xl border border-slate-800">

          <table className="min-w-full">

            <thead className="bg-slate-950">

              <tr>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  Capability
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  Category
                </th>

                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                  Status
                </th>

                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                  Organizations
                </th>

                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                  Actions
                </th>

              </tr>

            </thead>

            <tbody>

              <tr className="border-t border-slate-800">

                <td className="px-6 py-5 font-medium text-white">
                  Financial Forecasting
                </td>

                <td className="px-6 py-5 text-slate-300">
                  Finance
                </td>

                <td className="px-6 py-5 text-center">
                  <span className="rounded-full bg-emerald-900/40 px-3 py-1 text-sm font-semibold text-emerald-300">
                    Enabled
                  </span>
                </td>

                <td className="px-6 py-5 text-center text-white">
                  214
                </td>

                <td className="px-6 py-5 text-center">
                  <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500">
                    Configure
                  </button>
                </td>

              </tr>

              <tr className="border-t border-slate-800">

                <td className="px-6 py-5 font-medium text-white">
                  Fraud Detection
                </td>

                <td className="px-6 py-5 text-slate-300">
                  Risk
                </td>

                <td className="px-6 py-5 text-center">
                  <span className="rounded-full bg-emerald-900/40 px-3 py-1 text-sm font-semibold text-emerald-300">
                    Enabled
                  </span>
                </td>

                <td className="px-6 py-5 text-center text-white">
                  214
                </td>

                <td className="px-6 py-5 text-center">
                  <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500">
                    Configure
                  </button>
                </td>

              </tr>

              <tr className="border-t border-slate-800">

                <td className="px-6 py-5 font-medium text-white">
                  Procurement Advisor
                </td>

                <td className="px-6 py-5 text-slate-300">
                  Procurement
                </td>

                <td className="px-6 py-5 text-center">
                  <span className="rounded-full bg-amber-900/40 px-3 py-1 text-sm font-semibold text-amber-300">
                    Beta
                  </span>
                </td>

                <td className="px-6 py-5 text-center text-white">
                  18
                </td>

                <td className="px-6 py-5 text-center">
                  <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500">
                    Configure
                  </button>
                </td>

              </tr>

              <tr className="border-t border-slate-800">

                <td className="px-6 py-5 font-medium text-white">
                  Executive Insights
                </td>

                <td className="px-6 py-5 text-slate-300">
                  Executive
                </td>

                <td className="px-6 py-5 text-center">
                  <span className="rounded-full bg-blue-900/40 px-3 py-1 text-sm font-semibold text-blue-300">
                    Pilot
                  </span>
                </td>

                <td className="px-6 py-5 text-center text-white">
                  6
                </td>

                <td className="px-6 py-5 text-center">
                  <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500">
                    Configure
                  </button>
                </td>

              </tr>

            </tbody>

          </table>

        </div>

      </section>

      {/* ===========================================
          AI FEATURE ROLLOUT
      =========================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <div className="flex items-center justify-between">

          <div>

            <h2 className="text-2xl font-semibold text-white">
              AI Feature Rollout
            </h2>

            <p className="mt-2 text-slate-400">
              Control which subscription plans can access specific AI capabilities.
            </p>

          </div>

          <button className="rounded-xl bg-slate-800 px-6 py-3 font-semibold text-white hover:bg-slate-700">
            Manage Rollout
          </button>

        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">
            <h3 className="font-semibold text-white">Starter</h3>
            <p className="mt-3 text-sm text-slate-400">
              Core AI assistant and basic insights.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">
            <h3 className="font-semibold text-white">Professional</h3>
            <p className="mt-3 text-sm text-slate-400">
              Forecasting, reporting and fraud detection.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">
            <h3 className="font-semibold text-white">Enterprise</h3>
            <p className="mt-3 text-sm text-slate-400">
              Full AI suite with advanced analytics and automation.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">
            <h3 className="font-semibold text-white">Strategic Partner</h3>
            <p className="mt-3 text-sm text-slate-400">
              Custom AI capabilities defined by partnership agreements.
            </p>
          </div>

        </div>

      </section>      {/* ===========================================
          AI GOVERNANCE
      =========================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <div className="flex items-center justify-between">

          <div>

            <h2 className="text-2xl font-semibold text-white">
              AI Governance
            </h2>

            <p className="mt-2 text-slate-400">
              Define governance rules, deployment policies and operational
              controls for the Ziya AI Platform.
            </p>

          </div>

          <button className="rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white hover:bg-violet-500">
            New Policy
          </button>

        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-4">

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">

            <h3 className="font-semibold text-white">
              Active Policies
            </h3>

            <h2 className="mt-4 text-4xl font-bold text-violet-400">
              16
            </h2>

            <p className="mt-3 text-sm text-slate-400">
              Platform AI governance policies currently enforced.
            </p>

          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">

            <h3 className="font-semibold text-white">
              Prompt Templates
            </h3>

            <h2 className="mt-4 text-4xl font-bold text-blue-400">
              82
            </h2>

            <p className="mt-3 text-sm text-slate-400">
              Production-approved prompt templates.
            </p>

          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">

            <h3 className="font-semibold text-white">
              Knowledge Sources
            </h3>

            <h2 className="mt-4 text-4xl font-bold text-emerald-400">
              27
            </h2>

            <p className="mt-3 text-sm text-slate-400">
              Approved knowledge repositories used by Ziya AI.
            </p>

          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">

            <h3 className="font-semibold text-white">
              Compliance
            </h3>

            <h2 className="mt-4 text-4xl font-bold text-emerald-400">
              Compliant
            </h2>

            <p className="mt-3 text-sm text-slate-400">
              AI governance rules are fully enforced.
            </p>

          </div>

        </div>

      </section>

      {/* ===========================================
          KNOWLEDGE & PROMPT MANAGEMENT
      =========================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <div className="flex items-center justify-between">

          <div>

            <h2 className="text-2xl font-semibold text-white">
              Knowledge & Prompt Management
            </h2>

            <p className="mt-2 text-slate-400">
              Manage approved knowledge sources and prompt templates
              used by Ziya AI across the platform.
            </p>

          </div>

          <button className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-500">
            Create Prompt
          </button>

        </div>

        <div className="mt-8 overflow-hidden rounded-xl border border-slate-800">

          <table className="min-w-full">

            <thead className="bg-slate-950">

              <tr>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  Resource
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  Category
                </th>

                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                  Version
                </th>

                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                  Status
                </th>

                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                  Actions
                </th>

              </tr>

            </thead>

            <tbody>

              <tr className="border-t border-slate-800">

                <td className="px-6 py-5 font-medium text-white">
                  Financial Forecast Prompt
                </td>

                <td className="px-6 py-5 text-slate-300">
                  Forecasting
                </td>

                <td className="px-6 py-5 text-center text-white">
                  v2.3
                </td>

                <td className="px-6 py-5 text-center">
                  <span className="rounded-full bg-emerald-900/40 px-3 py-1 text-sm font-semibold text-emerald-300">
                    Production
                  </span>
                </td>

                <td className="px-6 py-5 text-center">
                  <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500">
                    Edit
                  </button>
                </td>

              </tr>

              <tr className="border-t border-slate-800">

                <td className="px-6 py-5 font-medium text-white">
                  Fraud Detection Rules
                </td>

                <td className="px-6 py-5 text-slate-300">
                  Risk
                </td>

                <td className="px-6 py-5 text-center text-white">
                  v1.8
                </td>

                <td className="px-6 py-5 text-center">
                  <span className="rounded-full bg-emerald-900/40 px-3 py-1 text-sm font-semibold text-emerald-300">
                    Production
                  </span>
                </td>

                <td className="px-6 py-5 text-center">
                  <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500">
                    Edit
                  </button>
                </td>

              </tr>

              <tr className="border-t border-slate-800">

                <td className="px-6 py-5 font-medium text-white">
                  Executive Insights Prompt
                </td>

                <td className="px-6 py-5 text-slate-300">
                  Executive
                </td>

                <td className="px-6 py-5 text-center text-white">
                  Beta
                </td>

                <td className="px-6 py-5 text-center">
                  <span className="rounded-full bg-amber-900/40 px-3 py-1 text-sm font-semibold text-amber-300">
                    Testing
                  </span>
                </td>

                <td className="px-6 py-5 text-center">
                  <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500">
                    Review
                  </button>
                </td>

              </tr>

            </tbody>

          </table>

        </div>

      </section>      {/* ===========================================
          AI OPERATIONS CENTER
      =========================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <div className="flex items-center justify-between">

          <div>

            <h2 className="text-2xl font-semibold text-white">
              AI Operations Center
            </h2>

            <p className="mt-2 text-slate-400">
              Monitor operational health, capacity, performance and
              platform-wide AI services.
            </p>

          </div>

          <button className="rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white hover:bg-violet-500">
            View Live Monitoring
          </button>

        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-4">

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">

            <h3 className="font-semibold text-white">
              Platform Health
            </h3>

            <h2 className="mt-5 text-4xl font-bold text-emerald-400">
              Healthy
            </h2>

            <p className="mt-3 text-sm text-slate-400">
              All AI services are operating normally.
            </p>

          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">

            <h3 className="font-semibold text-white">
              Capacity
            </h3>

            <h2 className="mt-5 text-4xl font-bold text-blue-400">
              68%
            </h2>

            <p className="mt-3 text-sm text-slate-400">
              Current platform AI capacity utilization.
            </p>

          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">

            <h3 className="font-semibold text-white">
              Incidents
            </h3>

            <h2 className="mt-5 text-4xl font-bold text-emerald-400">
              0
            </h2>

            <p className="mt-3 text-sm text-slate-400">
              No active AI incidents detected.
            </p>

          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">

            <h3 className="font-semibold text-white">
              AI Satisfaction
            </h3>

            <h2 className="mt-5 text-4xl font-bold text-amber-400">
              98.7%
            </h2>

            <p className="mt-3 text-sm text-slate-400">
              Overall platform AI quality score.
            </p>

          </div>

        </div>

      </section>

      {/* ===========================================
          ORGANIZATION AI LICENSING
      =========================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <div className="flex items-center justify-between">

          <div>

            <h2 className="text-2xl font-semibold text-white">
              Organization AI Licensing
            </h2>

            <p className="mt-2 text-slate-400">
              Control AI capabilities available to each organization
              based on licensing and subscription policies.
            </p>

          </div>

          <button className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-500">
            Manage AI Licenses
          </button>

        </div>

        <div className="mt-8 overflow-hidden rounded-xl border border-slate-800">

          <table className="min-w-full">

            <thead className="bg-slate-950">

              <tr>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  AI Capability
                </th>

                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                  Starter
                </th>

                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                  Professional
                </th>

                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                  Enterprise
                </th>

                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                  Strategic Partner
                </th>

              </tr>

            </thead>

            <tbody>

              <tr className="border-t border-slate-800">
                <td className="px-6 py-5 text-white">Financial Forecasting</td>
                <td className="text-center text-red-400">—</td>
                <td className="text-center text-emerald-400">✓</td>
                <td className="text-center text-emerald-400">✓</td>
                <td className="text-center text-emerald-400">✓</td>
              </tr>

              <tr className="border-t border-slate-800">
                <td className="px-6 py-5 text-white">Fraud Detection</td>
                <td className="text-center text-red-400">—</td>
                <td className="text-center text-emerald-400">✓</td>
                <td className="text-center text-emerald-400">✓</td>
                <td className="text-center text-emerald-400">✓</td>
              </tr>

              <tr className="border-t border-slate-800">
                <td className="px-6 py-5 text-white">Executive Insights</td>
                <td className="text-center text-red-400">—</td>
                <td className="text-center text-red-400">—</td>
                <td className="text-center text-emerald-400">✓</td>
                <td className="text-center text-emerald-400">✓</td>
              </tr>

              <tr className="border-t border-slate-800">
                <td className="px-6 py-5 text-white">Procurement Advisor</td>
                <td className="text-center text-red-400">—</td>
                <td className="text-center text-amber-400">Beta</td>
                <td className="text-center text-emerald-400">✓</td>
                <td className="text-center text-emerald-400">✓</td>
              </tr>

            </tbody>

          </table>

        </div>

      </section>

      {/* ===========================================
          AI CONTROL CENTER SUMMARY
      =========================================== */}

      <section className="rounded-2xl border border-violet-800 bg-violet-950/20 p-8">

        <h2 className="text-2xl font-semibold text-violet-300">
          Ziya AI Platform Summary
        </h2>

        <p className="mt-4 text-slate-300 leading-8">
          The AI Control Center governs the Ziya AI Platform at the platform
          level. It manages AI capabilities, governance, operational health,
          rollout strategies, knowledge resources and organization licensing.
          Financial forecasting, accounting assistance, business insights,
          procurement recommendations and other day-to-day AI interactions
          remain within each organization's workspace. This separation ensures
          centralized governance while allowing every organization to use
          Ziya AI securely within its own environment.
        </p>

      </section>

    </div>
  );
}