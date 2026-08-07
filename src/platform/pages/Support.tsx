import {
  LifeBuoy,
  Search,
  Plus,
  Ticket,
  Clock,
  CheckCircle,
} from "lucide-react";

import PageHeader from "../components/PageHeader";
import PrimaryButton from "../components/PrimaryButton";

const tickets = [
  {
    id: 1,
    organization: "Ziya Bridge",
    subject: "Unable to access dashboard",
    priority: "High",
    status: "Open",
    updated: "10 mins ago",
  },
  {
    id: 2,
    organization: "Alpha Finance",
    subject: "Billing inquiry",
    priority: "Medium",
    status: "In Progress",
    updated: "1 hour ago",
  },
  {
    id: 3,
    organization: "Coastal Capital",
    subject: "User account creation",
    priority: "Low",
    status: "Resolved",
    updated: "Yesterday",
  },
  {
    id: 4,
    organization: "Blue Horizon",
    subject: "License activation",
    priority: "High",
    status: "Open",
    updated: "2 hours ago",
  },
];

export default function Support() {
  return (
    <div className="space-y-8">

      <PageHeader
        title="Support Center"
        subtitle="Manage customer support requests, incidents and platform assistance."
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
            placeholder="Search support tickets..."
            className="h-12 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] pl-12 pr-4 text-sm outline-none focus:border-[#D4AF37]"
          />

        </div>

        <PrimaryButton>

          <Plus size={18} />

          <span className="ml-2">
            New Ticket
          </span>

        </PrimaryButton>

      </div>

      {/* Statistics */}

      <div className="grid grid-cols-4 gap-5">

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

          <Ticket
            size={28}
            className="text-[#D4AF37]"
          />

          <p className="mt-4 text-sm text-[#666B84]">
            Open Tickets
          </p>

          <h2 className="mt-2 text-4xl font-bold text-[#20243A]">
            34
          </h2>

        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

          <Clock
            size={28}
            className="text-blue-600"
          />

          <p className="mt-4 text-sm text-[#666B84]">
            Pending
          </p>

          <h2 className="mt-2 text-4xl font-bold text-blue-600">
            12
          </h2>

        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

          <CheckCircle
            size={28}
            className="text-green-600"
          />

          <p className="mt-4 text-sm text-[#666B84]">
            Resolved Today
          </p>

          <h2 className="mt-2 text-4xl font-bold text-green-600">
            18
          </h2>

        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm">

          <LifeBuoy
            size={28}
            className="text-purple-600"
          />

          <p className="mt-4 text-sm text-[#666B84]">
            Support Agents
          </p>

          <h2 className="mt-2 text-4xl font-bold text-[#20243A]">
            9
          </h2>

        </div>

      </div>

      {/* Tickets Table */}

      <div className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white shadow-sm">

        <div className="border-b border-[#ECECF3] bg-[#F8F9FC] px-6 py-5">

          <h2 className="text-xl font-bold text-[#20243A]">
            Recent Support Tickets
          </h2>

        </div>

        <table className="w-full">

          <thead className="bg-[#F8F9FC]">

            <tr className="text-left text-sm text-[#666B84]">

              <th className="px-6 py-4">
                Organization
              </th>

              <th className="px-6 py-4">
                Subject
              </th>

              <th className="px-6 py-4">
                Priority
              </th>

              <th className="px-6 py-4">
                Status
              </th>

              <th className="px-6 py-4">
                Last Updated
              </th>

            </tr>

          </thead>

          <tbody>

            {tickets.map((ticket) => (

              <tr
                key={ticket.id}
                className="border-t border-[#ECECF3] hover:bg-[#F8F9FC]"
              >

                <td className="px-6 py-5 font-semibold text-[#20243A]">
                  {ticket.organization}
                </td>

                <td className="px-6 py-5 text-[#666B84]">
                  {ticket.subject}
                </td>

                <td className="px-6 py-5">

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      ticket.priority === "High"
                        ? "bg-red-100 text-red-700"
                        : ticket.priority === "Medium"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {ticket.priority}
                  </span>

                </td>

                <td className="px-6 py-5">

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      ticket.status === "Resolved"
                        ? "bg-green-100 text-green-700"
                        : ticket.status === "In Progress"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-orange-100 text-orange-700"
                    }`}
                  >
                    {ticket.status}
                  </span>

                </td>

                <td className="px-6 py-5 text-[#666B84]">
                  {ticket.updated}
                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>
  );
}