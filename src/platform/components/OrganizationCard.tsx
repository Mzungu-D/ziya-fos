import {
  Building2,
  ChevronRight,
  Globe,
  Users,
} from "lucide-react";

import zayi from "../../assets/zayi.jpg";
import StatusBadge from "./StatusBadge";
import PrimaryButton from "./PrimaryButton";

interface OrganizationCardProps {
  id: string;
  name: string;
  country: string;
  currency: string;
  memberCount: number;
  logoUrl?: string | null;
  status:
    | "ACTIVE"
    | "PENDING"
    | "SUSPENDED";
}

export default function OrganizationCard({
  name,
  country,
  currency,
  memberCount,
  logoUrl,
  status,
}: OrganizationCardProps) {
  return (
    <div className="group rounded-2xl border border-[#ECECF3] bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">

      {/* Header */}

      <div className="flex items-start justify-between">

        <div className="flex items-center gap-4">

          <img
            src={logoUrl || zayi}
            alt={name}
            className="h-14 w-14 rounded-2xl border border-[#ECECF3] object-cover"
          />

          <div>

            <h3 className="text-lg font-semibold text-[#20243A]">
              {name}
            </h3>

            <p className="mt-1 text-sm text-[#666B84]">
              {country}
            </p>

          </div>

        </div>

        <StatusBadge status={status} />

      </div>

      {/* Divider */}

      <div className="my-6 h-px bg-[#ECECF3]" />

      {/* Statistics */}

      <div className="grid grid-cols-3 gap-5">

        <div>

          <div className="flex items-center gap-2">

            <Globe
              size={16}
              className="text-[#6D5DF6]"
            />

            <span className="text-xs uppercase tracking-wide text-[#94A3B8]">
              Currency
            </span>

          </div>

          <p className="mt-2 font-semibold text-[#20243A]">
            {currency}
          </p>

        </div>

        <div>

          <div className="flex items-center gap-2">

            <Users
              size={16}
              className="text-[#6D5DF6]"
            />

            <span className="text-xs uppercase tracking-wide text-[#94A3B8]">
              Members
            </span>

          </div>

          <p className="mt-2 font-semibold text-[#20243A]">
            {memberCount}
          </p>

        </div>

        <div>

          <div className="flex items-center gap-2">

            <Building2
              size={16}
              className="text-[#16A34A]"
            />

            <span className="text-xs uppercase tracking-wide text-[#94A3B8]">
              Status
            </span>

          </div>

          <div className="mt-2">
            <StatusBadge status={status} />
          </div>

        </div>

      </div>

      {/* Footer */}

      <div className="mt-6 flex items-center justify-between border-t border-[#ECECF3] pt-5">

        <PrimaryButton>
          Open Workspace
        </PrimaryButton>

        <button
          className="flex items-center gap-2 text-sm font-semibold text-[#6D5DF6] transition hover:text-[#5A4BE8]"
        >
          View Details

          <ChevronRight size={17} />
        </button>

      </div>

    </div>
  );
}