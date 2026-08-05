import { useState } from "react";

interface Organization {
  id: number;
  name: string;
  industry: string;
  country: string;
  plan: "Starter" | "Professional" | "Enterprise";
  users: number;
  storage: string;
  status: "Active" | "Trial" | "Suspended";
  createdAt: string;
}

export default function Organizations() {
  const [search, setSearch] = useState("");

  const [organizations] = useState<Organization[]>([
    {
      id: 1,
      name: "Ziya Bridge",
      industry: "Financial Services",
      country: "Kenya",
      plan: "Enterprise",
      users: 84,
      storage: "82 GB",
      status: "Active",
      createdAt: "2026-01-12",
    },
    {
      id: 2,
      name: "Alpha Holdings",
      industry: "Investment",
      country: "Kenya",
      plan: "Professional",
      users: 31,
      storage: "16 GB",
      status: "Active",
      createdAt: "2026-02-03",
    },
    {
      id: 3,
      name: "Coast Logistics",
      industry: "Logistics",
      country: "Kenya",
      plan: "Starter",
      users: 12,
      storage: "5 GB",
      status: "Trial",
      createdAt: "2026-07-28",
    },
    {
      id: 4,
      name: "Mombasa Retail Group",
      industry: "Retail",
      country: "Kenya",
      plan: "Professional",
      users: 45,
      storage: "22 GB",
      status: "Suspended",
      createdAt: "2025-12-11",
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
            Organizations
          </h1>

          <p className="mt-2 text-slate-400">
            Manage every organization running on the
            Ziya Financial Operating System.
          </p>

        </div>

        <button className="rounded-xl bg-amber-500 px-6 py-3 font-semibold text-black transition hover:bg-amber-400">
          + New Organization
        </button>

      </div>

      {/* ===========================================
          KPI CARDS
      =========================================== */}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-sm text-slate-400">
            Total Organizations
          </p>

          <h2 className="mt-4 text-4xl font-bold text-white">
            {organizations.length}
          </h2>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-sm text-slate-400">
            Active
          </p>

          <h2 className="mt-4 text-4xl font-bold text-emerald-400">
            {
              organizations.filter(
                (o) => o.status === "Active"
              ).length
            }
          </h2>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-sm text-slate-400">
            Trial
          </p>

          <h2 className="mt-4 text-4xl font-bold text-blue-400">
            {
              organizations.filter(
                (o) => o.status === "Trial"
              ).length
            }
          </h2>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-sm text-slate-400">
            Suspended
          </p>

          <h2 className="mt-4 text-4xl font-bold text-red-400">
            {
              organizations.filter(
                (o) => o.status === "Suspended"
              ).length
            }
          </h2>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-sm text-slate-400">
            Monthly Revenue
          </p>

          <h2 className="mt-4 text-4xl font-bold text-amber-400">
            KES 4.8M
          </h2>

        </div>

      </div>      {/* ===========================================
          SEARCH & ACTION TOOLBAR
      =========================================== */}

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

        <div className="grid gap-4 lg:grid-cols-12">

          <div className="lg:col-span-5">

            <label className="mb-2 block text-sm text-slate-400">
              Search Organization
            </label>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search organization..."
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none transition focus:border-amber-500"
            />

          </div>

          <div className="lg:col-span-2">

            <label className="mb-2 block text-sm text-slate-400">
              Status
            </label>

            <select className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white">

              <option>All</option>
              <option>Active</option>
              <option>Trial</option>
              <option>Suspended</option>

            </select>

          </div>

          <div className="lg:col-span-2">

            <label className="mb-2 block text-sm text-slate-400">
              Plan
            </label>

            <select className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white">

              <option>All</option>
              <option>Starter</option>
              <option>Professional</option>
              <option>Enterprise</option>

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

      </div>

      {/* ===========================================
          ORGANIZATIONS TABLE
      =========================================== */}

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">

        <div className="overflow-x-auto">

          <table className="min-w-full">

            <thead className="border-b border-slate-800 bg-slate-950">

              <tr>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  Organization
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  Industry
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  Country
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  Plan
                </th>

                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                  Users
                </th>

                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                  Storage
                </th>

                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                  Status
                </th>

                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                  Created
                </th>

                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                  Actions
                </th>

              </tr>

            </thead>

            <tbody>

              {organizations
                .filter((organization) =>
                  organization.name
                    .toLowerCase()
                    .includes(search.toLowerCase())
                )
                .map((organization) => (                  <tr
                    key={organization.id}
                    className="border-b border-slate-800 hover:bg-slate-800/40 transition"
                  >

                    <td className="px-6 py-5">

                      <div>

                        <p className="font-semibold text-white">
                          {organization.name}
                        </p>

                        <p className="mt-1 text-sm text-slate-400">
                          ID #{organization.id}
                        </p>

                      </div>

                    </td>

                    <td className="px-6 py-5 text-slate-300">
                      {organization.industry}
                    </td>

                    <td className="px-6 py-5 text-slate-300">
                      {organization.country}
                    </td>

                    <td className="px-6 py-5">

                      <span className="rounded-full bg-blue-900/40 px-3 py-1 text-sm font-medium text-blue-300">
                        {organization.plan}
                      </span>

                    </td>

                    <td className="px-6 py-5 text-center font-semibold text-white">
                      {organization.users}
                    </td>

                    <td className="px-6 py-5 text-center text-slate-300">
                      {organization.storage}
                    </td>

                    <td className="px-6 py-5 text-center">

                      <span
                        className={`rounded-full px-3 py-1 text-sm font-semibold ${
                          organization.status === "Active"
                            ? "bg-emerald-900/40 text-emerald-300"
                            : organization.status === "Trial"
                            ? "bg-blue-900/40 text-blue-300"
                            : "bg-red-900/40 text-red-300"
                        }`}
                      >
                        {organization.status}
                      </span>

                    </td>

                    <td className="px-6 py-5 text-center text-slate-300">
                      {organization.createdAt}
                    </td>

                    <td className="px-6 py-5">

                      <div className="flex justify-center gap-2">

                        <button className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white hover:bg-slate-700">
                          View
                        </button>

                        <button className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-black hover:bg-amber-400">
                          Manage
                        </button>

                        <button className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-500">
                          Suspend
                        </button>

                      </div>

                    </td>

                  </tr>

                ))}

            </tbody>

          </table>

        </div>

      </div>      {/* ===========================================
          TABLE FOOTER
      =========================================== */}

      <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 lg:flex-row">

        <div>

          <p className="text-sm text-slate-400">
            Showing
            <span className="mx-1 font-semibold text-white">
              {organizations.filter((organization) =>
                organization.name
                  .toLowerCase()
                  .includes(search.toLowerCase())
              ).length}
            </span>
            of
            <span className="mx-1 font-semibold text-white">
              {organizations.length}
            </span>
            organizations
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

    </div>
  );
}