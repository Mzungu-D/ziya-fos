import { MoreHorizontal } from "lucide-react";
import StatusBadge from "./StatusBadge";
import zayi from "../../assets/logo/zayi.png";

export interface TableRow {
  id: number;
  name: string;
  location: string;
  plan: string;
  users: number;
  status: "Active" | "Inactive" | "Trial" | "Suspended";
}

interface DataTableProps {
  title: string;
  subtitle: string;
  rows: TableRow[];
}

export default function DataTable({
  title,
  subtitle,
  rows,
}: DataTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white shadow-sm">

      {/* Header */}

      <div className="flex items-center justify-between border-b border-[#ECECF3] px-6 py-5">

        <div>

          <h2 className="text-lg font-semibold text-[#20243A]">
            {title}
          </h2>

          <p className="mt-1 text-sm text-[#666B84]">
            {subtitle}
          </p>

        </div>

        <button className="rounded-xl bg-[#F3F0FF] px-4 py-2 text-sm font-semibold text-[#6D5DF6] transition hover:bg-[#ECE8FF]">
          View All
        </button>

      </div>

      {/* Table */}

      <table className="w-full">

        <thead className="bg-[#FAFBFD]">

          <tr>

            <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
              Organization
            </th>

            <th className="text-left text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
              Plan
            </th>

            <th className="text-left text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
              Users
            </th>

            <th className="text-left text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
              Status
            </th>

            <th className="w-16" />

          </tr>

        </thead>

        <tbody>

          {rows.map((row) => (

            <tr
              key={row.id}
              className="border-t border-[#F1F5F9] transition hover:bg-[#FAFBFD]"
            >

              <td className="px-6 py-5">

                <div className="flex items-center gap-4">

                  <img
                    src={zayi}
                    alt={row.name}
                    className="h-11 w-11 rounded-xl object-cover"
                  />

                  <div>

                    <p className="font-semibold text-[#20243A]">
                      {row.name}
                    </p>

                    <p className="text-sm text-[#64748B]">
                      {row.location}
                    </p>

                  </div>

                </div>

              </td>

              <td className="font-medium text-[#20243A]">
                {row.plan}
              </td>

              <td className="text-[#20243A]">
                {row.users}
              </td>

              <td>

                <StatusBadge
                  status={row.status}
                />

              </td>

              <td>

                <button className="rounded-lg p-2 transition hover:bg-[#F1F5F9]">

                  <MoreHorizontal
                    size={18}
                    className="text-[#64748B]"
                  />

                </button>

              </td>

            </tr>

          ))}

        </tbody>

      </table>

      {/* Footer */}

      <div className="flex items-center justify-between border-t border-[#ECECF3] bg-[#FAFBFD] px-6 py-4">

        <p className="text-sm text-[#64748B]">
          Showing {rows.length} organizations
        </p>

        <div className="flex items-center gap-2">

          <button className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm transition hover:bg-white">
            Previous
          </button>

          <button className="rounded-lg bg-[#6D5DF6] px-4 py-2 text-sm font-semibold text-white">
            1
          </button>

          <button className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm transition hover:bg-white">
            Next
          </button>

        </div>

      </div>

    </div>
  );
}