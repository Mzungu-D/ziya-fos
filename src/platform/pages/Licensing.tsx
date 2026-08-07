import {
  ShieldCheck,
  Search,
  Plus,
  Building2,
  KeyRound,
  BadgeCheck,
} from "lucide-react";

import PageHeader from "../components/PageHeader";
import PrimaryButton from "../components/PrimaryButton";

const licenses = [
  {
    organization: "Ziya Bridge",
    license: "Enterprise",
    seats: 145,
    expires: "15 Dec 2027",
    status: "Active",
  },
  {
    organization: "Alpha Finance",
    license: "Professional",
    seats: 63,
    expires: "02 Jun 2027",
    status: "Active",
  },
  {
    organization: "Coastal Capital",
    license: "Starter",
    seats: 19,
    expires: "12 Sept 2026",
    status: "Trial",
  },
  {
    organization: "Blue Horizon",
    license: "Professional",
    seats: 42,
    expires: "30 Aug 2026",
    status: "Expired",
  },
];

export default function Licensing() {
  return (
    <div className="space-y-8">

      <PageHeader
        title="Licensing"
        subtitle="Manage platform licenses, organization entitlements and feature access."
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
            placeholder="Search licenses..."
            className="h-12 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] pl-12 pr-4 text-sm outline-none focus:border-[#D4AF37]"
          />

        </div>

        <PrimaryButton>

          <Plus size={18} />

          <span className="ml-2">
            Issue License
          </span>

        </PrimaryButton>

      </div>

      {/* Statistics */}

      <div className="grid grid-cols-4 gap-5">

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

          <ShieldCheck
            size={28}
            className="text-[#D4AF37]"
          />

          <p className="mt-4 text-sm text-[#666B84]">
            Active Licenses
          </p>

          <h2 className="mt-2 text-4xl font-bold text-[#20243A]">
            221
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

          <KeyRound
            size={28}
            className="text-green-600"
          />

          <p className="mt-4 text-sm text-[#666B84]">
            License Keys
          </p>

          <h2 className="mt-2 text-4xl font-bold text-green-600">
            268
          </h2>

        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

          <BadgeCheck
            size={28}
            className="text-purple-600"
          />

          <p className="mt-4 text-sm text-[#666B84]">
            Compliance
          </p>

          <h2 className="mt-2 text-4xl font-bold text-purple-600">
            100%
          </h2>

        </div>

      </div>

      {/* Licensing Table */}

      <div className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white shadow-sm">

        <div className="border-b border-[#ECECF3] bg-[#F8F9FC] px-6 py-5">

          <h2 className="text-xl font-bold text-[#20243A]">
            Organization Licenses
          </h2>

        </div>

        <table className="w-full">

          <thead className="bg-[#F8F9FC]">

            <tr className="text-left text-sm text-[#666B84]">

              <th className="px-6 py-4">
                Organization
              </th>

              <th className="px-6 py-4">
                License
              </th>

              <th className="px-6 py-4">
                Seats
              </th>

              <th className="px-6 py-4">
                Expiry
              </th>

              <th className="px-6 py-4">
                Status
              </th>

            </tr>

          </thead>

          <tbody>

            {licenses.map((license) => (

              <tr
                key={license.organization}
                className="border-t border-[#ECECF3] hover:bg-[#F8F9FC]"
              >

                <td className="px-6 py-5 font-semibold text-[#20243A]">
                  {license.organization}
                </td>

                <td className="px-6 py-5 text-[#666B84]">
                  {license.license}
                </td>

                <td className="px-6 py-5 text-[#20243A]">
                  {license.seats}
                </td>

                <td className="px-6 py-5 text-[#666B84]">
                  {license.expires}
                </td>

                <td className="px-6 py-5">

                  <span
                    className={`rounded-full px-4 py-2 text-xs font-semibold ${
                      license.status === "Active"
                        ? "bg-green-100 text-green-700"
                        : license.status === "Trial"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {license.status}
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