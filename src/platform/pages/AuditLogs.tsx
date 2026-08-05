import { useState } from "react";

interface PlatformAuditLog {
  id: number;
  timestamp: string;
  administrator: string;
  module:
    | "Platform"
    | "Organization"
    | "Security"
    | "Authentication"
    | "Infrastructure"
    | "Billing"
    | "AI";

  activity: string;

  severity:
    | "Information"
    | "Warning"
    | "Critical";

  ipAddress: string;
}

export default function AuditLogs() {
  const [search, setSearch] = useState("");

  const [logs] = useState<PlatformAuditLog[]>([
    {
      id: 10001,
      timestamp: "2026-08-05 08:15",
      administrator: "Dennis Odhiambo",
      module: "Authentication",
      activity: "Super Administrator signed in",
      severity: "Information",
      ipAddress: "102.68.xxx.xxx",
    },
    {
      id: 10002,
      timestamp: "2026-08-05 08:42",
      administrator: "Grace Wanjiku",
      module: "Organization",
      activity: "Created new organization",
      severity: "Information",
      ipAddress: "41.89.xxx.xxx",
    },
    {
      id: 10003,
      timestamp: "2026-08-05 09:03",
      administrator: "Dennis Odhiambo",
      module: "Platform",
      activity: "Updated platform configuration",
      severity: "Warning",
      ipAddress: "102.68.xxx.xxx",
    },
    {
      id: 10004,
      timestamp: "2026-08-05 09:21",
      administrator: "System",
      module: "Infrastructure",
      activity: "Automatic database backup completed",
      severity: "Information",
      ipAddress: "-",
    },
    {
      id: 10005,
      timestamp: "2026-08-05 09:48",
      administrator: "System",
      module: "Security",
      activity: "Blocked suspicious IP address",
      severity: "Critical",
      ipAddress: "197.248.xxx.xxx",
    },
  ]);

  return (
    <div className="space-y-8">

      {/* ===========================================
          PAGE HEADER
      =========================================== */}

      <div className="flex items-center justify-between">

        <div>

          <h1 className="text-3xl font-bold text-white">
            Platform Audit Logs
          </h1>

          <p className="mt-2 text-slate-400">
            Monitor every administrative action performed
            within the Ziya Financial Operating System Platform.
          </p>

        </div>

        <button className="rounded-xl bg-amber-500 px-6 py-3 font-semibold text-black hover:bg-amber-400 transition">
          Export Logs
        </button>

      </div>

      {/* ===========================================
          PLATFORM OVERVIEW
      =========================================== */}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-sm text-slate-400">
            Total Events
          </p>

          <h2 className="mt-4 text-4xl font-bold text-white">
            14,832
          </h2>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-sm text-slate-400">
            Organizations Created
          </p>

          <h2 className="mt-4 text-4xl font-bold text-blue-400">
            126
          </h2>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-sm text-slate-400">
            Security Events
          </p>

          <h2 className="mt-4 text-4xl font-bold text-red-400">
            18
          </h2>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-sm text-slate-400">
            Infrastructure Events
          </p>

          <h2 className="mt-4 text-4xl font-bold text-purple-400">
            242
          </h2>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-sm text-slate-400">
            Platform Status
          </p>

          <h2 className="mt-4 text-4xl font-bold text-emerald-400">
            Healthy
          </h2>

        </div>

      </div>      {/* ===========================================
          SEARCH & FILTERS
      =========================================== */}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

        <div className="grid gap-4 lg:grid-cols-12">

          <div className="lg:col-span-5">

            <label className="mb-2 block text-sm text-slate-400">
              Search Platform Activity
            </label>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search administrator, module or activity..."
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none transition focus:border-amber-500"
            />

          </div>

          <div className="lg:col-span-2">

            <label className="mb-2 block text-sm text-slate-400">
              Module
            </label>

            <select className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white">

              <option>All Modules</option>
              <option>Platform</option>
              <option>Organization</option>
              <option>Authentication</option>
              <option>Security</option>
              <option>Infrastructure</option>
              <option>Billing</option>
              <option>AI</option>

            </select>

          </div>

          <div className="lg:col-span-2">

            <label className="mb-2 block text-sm text-slate-400">
              Severity
            </label>

            <select className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white">

              <option>All</option>
              <option>Information</option>
              <option>Warning</option>
              <option>Critical</option>

            </select>

          </div>

          <div className="lg:col-span-3 flex items-end gap-3">

            <button className="flex-1 rounded-xl bg-slate-800 px-5 py-3 font-medium text-white transition hover:bg-slate-700">
              Refresh
            </button>

            <button className="flex-1 rounded-xl bg-blue-600 px-5 py-3 font-medium text-white transition hover:bg-blue-500">
              Export
            </button>

          </div>

        </div>

      </section>

      {/* ===========================================
          PLATFORM AUDIT TABLE
      =========================================== */}

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">

        <div className="overflow-x-auto">

          <table className="min-w-full">

            <thead className="border-b border-slate-800 bg-slate-950">

              <tr>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  Time
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  Administrator
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  Module
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  Activity
                </th>

                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                  Severity
                </th>

                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                  IP Address
                </th>

                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                  Actions
                </th>

              </tr>

            </thead>

            <tbody>

              {logs
                .filter((log) =>
                  log.administrator
                    .toLowerCase()
                    .includes(search.toLowerCase()) ||
                  log.activity
                    .toLowerCase()
                    .includes(search.toLowerCase()) ||
                  log.module
                    .toLowerCase()
                    .includes(search.toLowerCase())
                )
                .map((log) => (                  <tr
                    key={log.id}
                    className="border-b border-slate-800 transition hover:bg-slate-800/40"
                  >

                    <td className="px-6 py-5 text-slate-300 whitespace-nowrap">
                      {log.timestamp}
                    </td>

                    <td className="px-6 py-5">

                      <div>

                        <p className="font-semibold text-white">
                          {log.administrator}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Event #{log.id}
                        </p>

                      </div>

                    </td>

                    <td className="px-6 py-5">

                      <span className="rounded-full bg-slate-800 px-3 py-1 text-sm font-medium text-blue-300">
                        {log.module}
                      </span>

                    </td>

                    <td className="px-6 py-5 text-slate-300">
                      {log.activity}
                    </td>

                    <td className="px-6 py-5 text-center">

                      <span
                        className={`rounded-full px-3 py-1 text-sm font-semibold ${
                          log.severity === "Information"
                            ? "bg-emerald-900/40 text-emerald-300"
                            : log.severity === "Warning"
                            ? "bg-amber-900/40 text-amber-300"
                            : "bg-red-900/40 text-red-300"
                        }`}
                      >
                        {log.severity}
                      </span>

                    </td>

                    <td className="px-6 py-5 text-center text-slate-300">
                      {log.ipAddress}
                    </td>

                    <td className="px-6 py-5">

                      <div className="flex justify-center gap-2">

                        <button className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700">
                          View
                        </button>

                        <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-500">
                          Details
                        </button>

                      </div>

                    </td>

                  </tr>

                ))}

            </tbody>

          </table>

        </div>

      </section>

      {/* ===========================================
          PLATFORM EVENT SUMMARY
      =========================================== */}

      <section className="grid gap-6 lg:grid-cols-3">

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <h3 className="text-lg font-semibold text-white">
            Authentication
          </h3>

          <p className="mt-3 text-sm text-slate-400">
            Platform logins, MFA events, password resets,
            session creation and session termination.
          </p>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <h3 className="text-lg font-semibold text-white">
            Organization Events
          </h3>

          <p className="mt-3 text-sm text-slate-400">
            Organization creation, suspension,
            activation, subscription updates
            and lifecycle management.
          </p>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <h3 className="text-lg font-semibold text-white">
            Infrastructure
          </h3>

          <p className="mt-3 text-sm text-slate-400">
            Railway deployments, backups,
            cache operations, API availability
            and scheduled maintenance.
          </p>

        </div>

      </section>      {/* ===========================================
          TABLE FOOTER
      =========================================== */}

      <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 lg:flex-row">

        <div>

          <p className="text-sm text-slate-400">

            Showing

            <span className="mx-1 font-semibold text-white">

              {
                logs.filter(
                  (log) =>
                    log.administrator
                      .toLowerCase()
                      .includes(search.toLowerCase()) ||
                    log.activity
                      .toLowerCase()
                      .includes(search.toLowerCase()) ||
                    log.module
                      .toLowerCase()
                      .includes(search.toLowerCase())
                ).length
              }

            </span>

            of

            <span className="mx-1 font-semibold text-white">
              {logs.length}
            </span>

            platform events

          </p>

        </div>

        <div className="flex items-center gap-2">

          <button className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-white transition hover:bg-slate-700">
            Previous
          </button>

          <button className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black">
            1
          </button>

          <button className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-white transition hover:bg-slate-700">
            2
          </button>

          <button className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-white transition hover:bg-slate-700">
            3
          </button>

          <button className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-white transition hover:bg-slate-700">
            Next
          </button>

        </div>

      </div>

      {/* ===========================================
          PLATFORM AUDIT INFORMATION
      =========================================== */}

      <section className="rounded-2xl border border-blue-800 bg-blue-950/20 p-8">

        <h2 className="text-2xl font-semibold text-blue-400">
          Platform Audit Coverage
        </h2>

        <p className="mt-4 text-slate-300">
          This audit console records only platform-level administrative
          operations performed within the Ziya Financial Operating System.
          Tenant accounting, finance, procurement, HR, customer activities,
          and organization-specific transactions are audited separately
          within each tenant workspace.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">

            <h3 className="font-semibold text-white">
              Authentication
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              Login, logout, MFA, password resets and session management.
            </p>

          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">

            <h3 className="font-semibold text-white">
              Organizations
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              Organization provisioning, activation,
              suspension and subscription lifecycle.
            </p>

          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">

            <h3 className="font-semibold text-white">
              Infrastructure
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              Deployments, backups, database maintenance,
              cache operations and platform services.
            </p>

          </div>

        </div>

      </section>

    </div>
  );
}