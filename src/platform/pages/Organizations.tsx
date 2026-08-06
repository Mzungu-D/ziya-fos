import { Plus, Search } from "lucide-react";

import OrganizationCard from "../components/OrganizationCard";
import PageHeader from "../components/PageHeader";
import PrimaryButton from "../components/PrimaryButton";

const organizations = [
  {
    id: 1,
    name: "Ziya Bridge",
    location: "Mombasa, Kenya",
    plan: "Enterprise",
    users: 145,
    revenue: "KES 2.4M",
    status: "Active" as const,
  },
  {
    id: 2,
    name: "Alpha Finance",
    location: "Nairobi, Kenya",
    plan: "Professional",
    users: 63,
    revenue: "KES 860K",
    status: "Active" as const,
  },
  {
    id: 3,
    name: "Coastal Capital",
    location: "Mombasa, Kenya",
    plan: "Starter",
    users: 19,
    revenue: "KES 210K",
    status: "Trial" as const,
  },
  {
    id: 4,
    name: "Blue Horizon",
    location: "Kisumu, Kenya",
    plan: "Professional",
    users: 42,
    revenue: "KES 590K",
    status: "Active" as const,
  },
];

export default function Organizations() {
  return (
    <div className="space-y-6">

      <PageHeader
        title="Organizations"
        subtitle="Manage all organizations using the Ziya Financial Operating System."
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
            placeholder="Search organizations..."
            className="h-12 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] pl-12 pr-4 text-sm outline-none focus:border-[#6D5DF6]"
          />

        </div>

        <PrimaryButton>

          <Plus size={18} />

          <span className="ml-2">
            New Organization
          </span>

        </PrimaryButton>

      </div>

      {/* Summary */}

      <div className="grid grid-cols-4 gap-5">

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">

          <p className="text-sm text-[#666B84]">
            Total Organizations
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#20243A]">
            125
          </h2>

        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">

          <p className="text-sm text-[#666B84]">
            Active
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#16A34A]">
            118
          </h2>

        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">

          <p className="text-sm text-[#666B84]">
            Trial
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#F59E0B]">
            5
          </h2>

        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">

          <p className="text-sm text-[#666B84]">
            Suspended
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#EF4444]">
            2
          </h2>

        </div>

      </div>

      {/* Organization Cards */}

      <div className="grid grid-cols-2 gap-6">

        {organizations.map((organization) => (

          <OrganizationCard
            key={organization.id}
            name={organization.name}
            location={organization.location}
            plan={organization.plan}
            users={organization.users}
            revenue={organization.revenue}
            status={organization.status}
          />

        ))}

      </div>

    </div>
  );
}