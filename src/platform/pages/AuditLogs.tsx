import {
  Download,
  FileClock,
  Search,
  ShieldCheck,
} from "lucide-react";

import PageHeader from "../components/PageHeader";
import PrimaryButton from "../components/PrimaryButton";

const logs = [
  {
    id: 1,
    user: "Dennis Odhiambo",
    action: "Created Organization",
    target: "Alpha Finance",
    date: "06 Aug 2026",
    ip: "197.xxx.xxx.xxx",
  },
  {
    id: 2,
    user: "Platform Admin",
    action: "Updated Billing Plan",
    target: "Ziya Bridge",
    date: "06 Aug 2026",
    ip: "197.xxx.xxx.xxx",
  },
  {
    id: 3,
    user: "System",
    action: "Automatic Backup",
    target: "Platform Database",
    date: "05 Aug 2026",
    ip: "Internal",
  },
  {
    id: 4,
    user: "Sarah Wanjiku",
    action: "Invited New User",
    target: "Alpha Finance",
    date: "05 Aug 2026",
    ip: "102.xxx.xxx.xxx",
  },
];

export default function AuditLogs() {
  return (
    <div className="space-y-6">

      <PageHeader
        title="Audit Logs"
        subtitle="Track every activity across the Ziya FOS Platform."
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
            placeholder="Search activity..."
            className="h-12 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] pl-12 pr-4 text-sm outline-none focus:border-[#6D5DF6]"
          />

        </div>

        <PrimaryButton>

          <Download size={18} />

          <span className="ml-2">
            Export Logs
          </span>

        </PrimaryButton>

      </div>

      {/* KPI */}

      <div className="grid grid-cols-3 gap-5">

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">

          <FileClock className="mb-3 text-[#6D5DF6]" />

          <p className="text-sm text-[#666B84]">
            Events Today
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#20243A]">
            324
          </h2>

        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">

          <ShieldCheck className="mb-3 text-[#16A34A]" />

          <p className="text-sm text-[#666B84]">
            Security Events
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#20243A]">
            18
          </h2>

        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">

          <FileClock className="mb-3 text-[#F59E0B]" />

          <p className="text-sm text-[#666B84]">
            Total Logs
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#20243A]">
            58,214
          </h2>

        </div>

      </div>

      {/* Table */}

      <div className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white shadow-sm">

        <table className="w-full">

          <thead className="bg-[#FAFBFD]">

            <tr>

              <th className="px-6 py-4 text-left text-xs font-semibold uppercase text-[#94A3B8]">
                User
              </th>

              <th className="text-left text-xs font-semibold uppercase text-[#94A3B8]">
                Action
              </th>

              <th className="text-left text-xs font-semibold uppercase text-[#94A3B8]">
                Target
              </th>

              <th className="text-left text-xs font-semibold uppercase text-[#94A3B8]">
                Date
              </th>

              <th className="text-left text-xs font-semibold uppercase text-[#94A3B8]">
                IP Address
              </th>

            </tr>

          </thead>

          <tbody>

            {logs.map((log) => (

              <tr
                key={log.id}
                className="border-t border-[#F1F5F9] hover:bg-[#FAFBFD]"
              >

                <td className="px-6 py-5 font-medium text-[#20243A]">
                  {log.user}
                </td>

                <td>{log.action}</td>

                <td>{log.target}</td>

                <td>{log.date}</td>

                <td>{log.ip}</td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>
  );
}