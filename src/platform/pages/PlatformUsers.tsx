import { useState } from "react";

interface PlatformUser {
  id: number;
  fullName: string;
  email: string;
  role:
    | "Super Admin"
    | "Platform Admin"
    | "Support"
    | "Finance";

  status:
    | "Active"
    | "Suspended";

  mfa: boolean;

  lastLogin: string;

  createdAt: string;
}

export default function PlatformUsers() {
  const [search, setSearch] = useState("");

  const [users] = useState<PlatformUser[]>([
    {
      id: 1,
      fullName: "Dennis Odhiambo",
      email: "dennis@ziya.co.ke",
      role: "Super Admin",
      status: "Active",
      mfa: true,
      lastLogin: "Today 09:20",
      createdAt: "2026-01-03",
    },
    {
      id: 2,
      fullName: "Grace Wanjiku",
      email: "grace@ziya.co.ke",
      role: "Platform Admin",
      status: "Active",
      mfa: true,
      lastLogin: "Today 08:15",
      createdAt: "2026-02-11",
    },
    {
      id: 3,
      fullName: "Brian Otieno",
      email: "brian@ziya.co.ke",
      role: "Support",
      status: "Active",
      mfa: false,
      lastLogin: "Yesterday",
      createdAt: "2026-03-02",
    },
    {
      id: 4,
      fullName: "Mercy Njeri",
      email: "mercy@ziya.co.ke",
      role: "Finance",
      status: "Suspended",
      mfa: true,
      lastLogin: "3 days ago",
      createdAt: "2026-01-28",
    },
  ]);

  return (
    <div className="space-y-8">

      {/* ======================================
          PAGE HEADER
      ====================================== */}

      <div className="flex items-center justify-between">

        <div>

          <h1 className="text-3xl font-bold text-white">
            Platform Users
          </h1>

          <p className="mt-2 text-slate-400">
            Manage administrators and internal users of
            the Ziya Financial Operating System.
          </p>

        </div>

        <button className="rounded-xl bg-amber-500 px-6 py-3 font-semibold text-black hover:bg-amber-400">

          + Invite User

        </button>

      </div>

      {/* ======================================
          KPI CARDS
      ====================================== */}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-slate-400">
            Total Users
          </p>

          <h2 className="mt-4 text-4xl font-bold text-white">
            {users.length}
          </h2>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-slate-400">
            Active Users
          </p>

          <h2 className="mt-4 text-4xl font-bold text-emerald-400">

            {
              users.filter(
                (u) => u.status === "Active"
              ).length
            }

          </h2>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-slate-400">
            MFA Enabled
          </p>

          <h2 className="mt-4 text-4xl font-bold text-blue-400">

            {
              users.filter(
                (u) => u.mfa
              ).length
            }

          </h2>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <p className="text-slate-400">
            Suspended
          </p>

          <h2 className="mt-4 text-4xl font-bold text-red-400">

            {
              users.filter(
                (u) => u.status === "Suspended"
              ).length
            }

          </h2>

        </div>

      </div>      {/* ======================================
          SEARCH & FILTER TOOLBAR
      ====================================== */}

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

        <div className="grid gap-4 lg:grid-cols-12">

          <div className="lg:col-span-5">

            <label className="mb-2 block text-sm text-slate-400">
              Search User
            </label>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none transition focus:border-amber-500"
            />

          </div>

          <div className="lg:col-span-2">

            <label className="mb-2 block text-sm text-slate-400">
              Role
            </label>

            <select className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white">

              <option>All Roles</option>
              <option>Super Admin</option>
              <option>Platform Admin</option>
              <option>Support</option>
              <option>Finance</option>

            </select>

          </div>

          <div className="lg:col-span-2">

            <label className="mb-2 block text-sm text-slate-400">
              Status
            </label>

            <select className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white">

              <option>All Status</option>
              <option>Active</option>
              <option>Suspended</option>

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

      {/* ======================================
          PLATFORM USERS TABLE
      ====================================== */}

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">

        <div className="overflow-x-auto">

          <table className="min-w-full">

            <thead className="border-b border-slate-800 bg-slate-950">

              <tr>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  User
                </th>

                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  Role
                </th>

                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                  MFA
                </th>

                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                  Status
                </th>

                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">
                  Last Login
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

              {users
                .filter((user) =>
                  user.fullName
                    .toLowerCase()
                    .includes(search.toLowerCase()) ||
                  user.email
                    .toLowerCase()
                    .includes(search.toLowerCase())
                )
                .map((user) => (                  <tr
                    key={user.id}
                    className="border-b border-slate-800 transition hover:bg-slate-800/40"
                  >

                    <td className="px-6 py-5">

                      <div>

                        <p className="font-semibold text-white">
                          {user.fullName}
                        </p>

                        <p className="mt-1 text-sm text-slate-400">
                          {user.email}
                        </p>

                      </div>

                    </td>

                    <td className="px-6 py-5">

                      <span className="rounded-full bg-blue-900/40 px-3 py-1 text-sm font-medium text-blue-300">
                        {user.role}
                      </span>

                    </td>

                    <td className="px-6 py-5 text-center">

                      {user.mfa ? (

                        <span className="rounded-full bg-emerald-900/40 px-3 py-1 text-sm font-semibold text-emerald-300">
                          Enabled
                        </span>

                      ) : (

                        <span className="rounded-full bg-red-900/40 px-3 py-1 text-sm font-semibold text-red-300">
                          Disabled
                        </span>

                      )}

                    </td>

                    <td className="px-6 py-5 text-center">

                      <span
                        className={`rounded-full px-3 py-1 text-sm font-semibold ${
                          user.status === "Active"
                            ? "bg-emerald-900/40 text-emerald-300"
                            : "bg-red-900/40 text-red-300"
                        }`}
                      >
                        {user.status}
                      </span>

                    </td>

                    <td className="px-6 py-5 text-center text-slate-300">
                      {user.lastLogin}
                    </td>

                    <td className="px-6 py-5 text-center text-slate-300">
                      {user.createdAt}
                    </td>

                    <td className="px-6 py-5">

                      <div className="flex justify-center gap-2">

                        <button className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white transition hover:bg-slate-700">
                          View
                        </button>

                        <button className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-black transition hover:bg-amber-400">
                          Edit
                        </button>

                        <button className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white transition hover:bg-indigo-500">
                          Reset MFA
                        </button>

                        <button className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white transition hover:bg-red-500">
                          Suspend
                        </button>

                      </div>

                    </td>

                  </tr>

                ))}

            </tbody>

          </table>

        </div>

      </div>      {/* ======================================
          TABLE FOOTER
      ====================================== */}

      <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 lg:flex-row">

        <div>

          <p className="text-sm text-slate-400">
            Showing
            <span className="mx-1 font-semibold text-white">
              {
                users.filter(
                  (user) =>
                    user.fullName
                      .toLowerCase()
                      .includes(search.toLowerCase()) ||
                    user.email
                      .toLowerCase()
                      .includes(search.toLowerCase())
                ).length
              }
            </span>

            of

            <span className="mx-1 font-semibold text-white">
              {users.length}
            </span>

            platform users
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