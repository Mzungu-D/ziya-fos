import {
  CreditCard,
  Search,
  Plus,
  Calendar,
  DollarSign,
  Users,
  TrendingUp,
} from "lucide-react";

export default function Subscriptions() {
  return (
    <div className="space-y-8">

      {/* Header */}

      <div className="flex items-center justify-between">

        <div>

          <h1 className="text-3xl font-bold text-white">
            Subscription Management
          </h1>

          <p className="mt-2 text-slate-400">
            Manage subscription plans, active subscriptions, renewals,
            upgrades and recurring revenue across all organizations.
          </p>

        </div>

        <button className="rounded-xl bg-amber-500 px-6 py-3 font-semibold text-black transition hover:bg-amber-400">
          <Plus className="mr-2 inline h-5 w-5" />
          New Subscription
        </button>

      </div>

      {/* Search */}

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">

        <div className="relative">

          <Search className="absolute left-4 top-4 h-5 w-5 text-slate-500" />

          <input
            type="text"
            placeholder="Search subscriptions..."
            className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-12 pr-4 text-white outline-none focus:border-amber-500"
          />

        </div>

      </div>

      {/* KPIs */}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <CreditCard className="mb-4 text-amber-400" />

          <p className="text-sm text-slate-400">
            Active Subscriptions
          </p>

          <h2 className="mt-3 text-4xl font-bold text-white">
            221
          </h2>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <DollarSign className="mb-4 text-emerald-400" />

          <p className="text-sm text-slate-400">
            Monthly Revenue
          </p>

          <h2 className="mt-3 text-4xl font-bold text-emerald-400">
            $48,750
          </h2>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <Users className="mb-4 text-blue-400" />

          <p className="text-sm text-slate-400">
            Organizations
          </p>

          <h2 className="mt-3 text-4xl font-bold text-white">
            268
          </h2>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <TrendingUp className="mb-4 text-purple-400" />

          <p className="text-sm text-slate-400">
            Growth
          </p>

          <h2 className="mt-3 text-4xl font-bold text-purple-400">
            +18%
          </h2>

        </div>

      </div>

      {/* Table */}

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">

        <div className="border-b border-slate-800 px-8 py-6">

          <h2 className="text-2xl font-semibold text-white">
            Active Subscriptions
          </h2>

        </div>

        <table className="w-full">

          <thead className="bg-slate-950">

            <tr>

              <th className="px-6 py-4 text-left text-slate-400">
                Organization
              </th>

              <th className="px-6 py-4 text-left text-slate-400">
                Plan
              </th>

              <th className="px-6 py-4 text-left text-slate-400">
                Billing
              </th>

              <th className="px-6 py-4 text-left text-slate-400">
                Renewal
              </th>

              <th className="px-6 py-4 text-left text-slate-400">
                Status
              </th>

            </tr>

          </thead>

          <tbody>

            {[
              {
                org: "Ziya Bridge",
                plan: "Enterprise",
                billing: "$12,500",
                renewal: "15 Aug 2026",
                status: "Active",
              },
              {
                org: "Alpha Finance",
                plan: "Professional",
                billing: "$2,800",
                renewal: "22 Aug 2026",
                status: "Active",
              },
              {
                org: "Coastal Capital",
                plan: "Starter",
                billing: "Free",
                renewal: "Always",
                status: "Trial",
              },
            ].map((item) => (

              <tr
                key={item.org}
                className="border-t border-slate-800"
              >

                <td className="px-6 py-5 font-medium text-white">
                  {item.org}
                </td>

                <td className="px-6 py-5 text-slate-300">
                  {item.plan}
                </td>

                <td className="px-6 py-5 text-emerald-400">
                  {item.billing}
                </td>

                <td className="px-6 py-5 text-slate-300">
                  <Calendar className="mr-2 inline h-4 w-4" />
                  {item.renewal}
                </td>

                <td className="px-6 py-5">

                  <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-sm text-emerald-400">
                    {item.status}
                  </span>

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </section>

    </div>
  );
}