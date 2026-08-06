import {
  Plus,
  Search,
  Shield,
  UserCheck,
  Users,
} from "lucide-react";

import PageHeader from "../components/PageHeader";
import PrimaryButton from "../components/PrimaryButton";
import StatusBadge from "../components/StatusBadge";
import zayi from "../../assets/zayi.jpg";

const users = [
  {
    id: 1,
    name: "Dennis Odhiambo",
    email: "admin@ziya.co.ke",
    role: "Super Administrator",
    organization: "Ziya Bridge",
    status: "Active" as const,
  },
  {
    id: 2,
    name: "Sarah Wanjiku",
    email: "finance@alpha.co.ke",
    role: "Finance Manager",
    organization: "Alpha Finance",
    status: "Active" as const,
  },
  {
    id: 3,
    name: "John Mwangi",
    email: "admin@coastal.co.ke",
    role: "Administrator",
    organization: "Coastal Capital",
    status: "Trial" as const,
  },
  {
    id: 4,
    name: "Faith Achieng",
    email: "finance@blue.co.ke",
    role: "Accountant",
    organization: "Blue Horizon",
    status: "Active" as const,
  },
];

export default function PlatformUsers() {
  return (
    <div className="space-y-6">

      <PageHeader
        title="Users & Access"
        subtitle="Manage platform administrators and organization users."
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
            placeholder="Search users..."
            className="h-12 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] pl-12 pr-4 text-sm outline-none focus:border-[#6D5DF6]"
          />

        </div>

        <PrimaryButton>

          <Plus size={18} />

          <span className="ml-2">
            Add User
          </span>

        </PrimaryButton>

      </div>

      {/* Statistics */}

      <div className="grid grid-cols-4 gap-5">

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">

          <Users className="mb-3 text-[#6D5DF6]" />

          <p className="text-sm text-[#666B84]">
            Total Users
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#20243A]">
            1,284
          </h2>

        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">

          <UserCheck className="mb-3 text-[#16A34A]" />

          <p className="text-sm text-[#666B84]">
            Active Users
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#16A34A]">
            1,201
          </h2>

        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">

          <Shield className="mb-3 text-[#F59E0B]" />

          <p className="text-sm text-[#666B84]">
            Administrators
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#20243A]">
            46
          </h2>

        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">

          <Shield className="mb-3 text-[#2563EB]" />

          <p className="text-sm text-[#666B84]">
            Roles
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#20243A]">
            8
          </h2>

        </div>

      </div>

      {/* Users Table */}

      <div className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white shadow-sm">

        <table className="w-full">

          <thead className="bg-[#FAFBFD]">

            <tr>

              <th className="px-6 py-4 text-left text-xs font-semibold uppercase text-[#94A3B8]">
                User
              </th>

              <th className="text-left text-xs font-semibold uppercase text-[#94A3B8]">
                Organization
              </th>

              <th className="text-left text-xs font-semibold uppercase text-[#94A3B8]">
                Role
              </th>

              <th className="text-left text-xs font-semibold uppercase text-[#94A3B8]">
                Status
              </th>

            </tr>

          </thead>

          <tbody>

            {users.map((user) => (

              <tr
                key={user.id}
                className="border-t border-[#F1F5F9] hover:bg-[#FAFBFD]"
              >

                <td className="px-6 py-5">

                  <div className="flex items-center gap-4">

                    <img
                      src={zayi}
                      alt={user.name}
                      className="h-11 w-11 rounded-full object-cover"
                    />

                    <div>

                      <p className="font-semibold text-[#20243A]">
                        {user.name}
                      </p>

                      <p className="text-sm text-[#666B84]">
                        {user.email}
                      </p>

                    </div>

                  </div>

                </td>

                <td>{user.organization}</td>

                <td>{user.role}</td>

                <td>

                  <StatusBadge
                    status={user.status}
                  />

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>
  );
}