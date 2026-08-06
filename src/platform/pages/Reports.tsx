import {
  BarChart3,
  Download,
  FileBarChart2,
  Search,
  TrendingUp,
  Users,
} from "lucide-react";

import PageHeader from "../components/PageHeader";
import PrimaryButton from "../components/PrimaryButton";

const reports = [
  {
    id: 1,
    title: "Monthly Revenue Report",
    category: "Financial",
    generated: "06 Aug 2026",
    author: "Platform Admin",
  },
  {
    id: 2,
    title: "Organization Growth",
    category: "Analytics",
    generated: "05 Aug 2026",
    author: "System",
  },
  {
    id: 3,
    title: "User Activity Report",
    category: "Users",
    generated: "04 Aug 2026",
    author: "Platform Admin",
  },
  {
    id: 4,
    title: "Subscription Summary",
    category: "Billing",
    generated: "03 Aug 2026",
    author: "System",
  },
];

export default function Reports() {
  return (
    <div className="space-y-6">

      <PageHeader
        title="Reports & Analytics"
        subtitle="Business intelligence and platform reporting."
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
            placeholder="Search reports..."
            className="h-12 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] pl-12 pr-4 text-sm outline-none focus:border-[#6D5DF6]"
          />

        </div>

        <PrimaryButton>

          <Download size={18} />

          <span className="ml-2">
            Export Reports
          </span>

        </PrimaryButton>

      </div>

      {/* KPI */}

      <div className="grid grid-cols-4 gap-5">

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">

          <FileBarChart2 className="mb-3 text-[#6D5DF6]" />

          <p className="text-sm text-[#666B84]">
            Reports
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#20243A]">
            84
          </h2>

        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">

          <TrendingUp className="mb-3 text-[#16A34A]" />

          <p className="text-sm text-[#666B84]">
            Revenue Growth
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#16A34A]">
            +22%
          </h2>

        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">

          <Users className="mb-3 text-[#2563EB]" />

          <p className="text-sm text-[#666B84]">
            Organizations
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#20243A]">
            125
          </h2>

        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">

          <BarChart3 className="mb-3 text-[#F59E0B]" />

          <p className="text-sm text-[#666B84]">
            Dashboards
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#20243A]">
            12
          </h2>

        </div>

      </div>

      {/* Reports Table */}

      <div className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white shadow-sm">

        <table className="w-full">

          <thead className="bg-[#FAFBFD]">

            <tr>

              <th className="px-6 py-4 text-left text-xs font-semibold uppercase text-[#94A3B8]">
                Report
              </th>

              <th className="text-left text-xs font-semibold uppercase text-[#94A3B8]">
                Category
              </th>

              <th className="text-left text-xs font-semibold uppercase text-[#94A3B8]">
                Generated
              </th>

              <th className="text-left text-xs font-semibold uppercase text-[#94A3B8]">
                Author
              </th>

            </tr>

          </thead>

          <tbody>

            {reports.map((report) => (

              <tr
                key={report.id}
                className="border-t border-[#F1F5F9] hover:bg-[#FAFBFD]"
              >

                <td className="px-6 py-5 font-medium text-[#20243A]">
                  {report.title}
                </td>

                <td>{report.category}</td>

                <td>{report.generated}</td>

                <td>{report.author}</td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>
  );
}