import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Users,
  Globe,
  Mail,
  Phone,
  MapPin,
  Calendar,
  ShieldCheck,
  Pencil,
} from "lucide-react";

export default function OrganizationDetails() {
  const navigate = useNavigate();
  const { organizationId } = useParams();

  return (
    <div className="space-y-6">

      {/* Header */}

      <div className="flex items-center justify-between">

        <div>

          <button
            onClick={() => navigate(-1)}
            className="mb-4 flex items-center gap-2 text-slate-400 hover:text-white"
          >
            <ArrowLeft size={18} />
            Back
          </button>

          <h1 className="text-3xl font-bold text-white">
            Organization Details
          </h1>

          <p className="mt-2 text-slate-400">
            Organization ID: {organizationId}
          </p>

        </div>

        <button
          className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 font-medium text-black transition hover:bg-amber-400"
        >
          <Pencil size={18} />
          Edit Organization
        </button>

      </div>

      {/* Organization Card */}

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8">

        <div className="flex items-center gap-5">

          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-500/10">

            <Building2
              className="text-amber-400"
              size={40}
            />

          </div>

          <div>

            <h2 className="text-2xl font-bold text-white">
              Ziya Bridge
            </h2>

            <p className="text-slate-400">
              Financial Services
            </p>

          </div>

        </div>

      </div>

      {/* Details */}

      <div className="grid gap-6 lg:grid-cols-2">

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <h2 className="mb-6 text-xl font-semibold text-white">
            General Information
          </h2>

          <div className="space-y-5">

            <InfoRow
              icon={<Mail size={18} />}
              label="Email"
              value="info@ziya.co.ke"
            />

            <InfoRow
              icon={<Phone size={18} />}
              label="Phone"
              value="+254700000000"
            />

            <InfoRow
              icon={<Globe size={18} />}
              label="Website"
              value="https://ziya.co.ke"
            />

            <InfoRow
              icon={<MapPin size={18} />}
              label="Country"
              value="Kenya"
            />

          </div>

        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

          <h2 className="mb-6 text-xl font-semibold text-white">
            Statistics
          </h2>

          <div className="space-y-5">

            <InfoRow
              icon={<Users size={18} />}
              label="Users"
              value="126"
            />

            <InfoRow
              icon={<ShieldCheck size={18} />}
              label="Status"
              value="Active"
            />

            <InfoRow
              icon={<Calendar size={18} />}
              label="Created"
              value="15 July 2026"
            />

            <InfoRow
              icon={<Building2 size={18} />}
              label="Subscription"
              value="Enterprise"
            />

          </div>

        </div>

      </div>

    </div>
  );
}

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function InfoRow({
  icon,
  label,
  value,
}: InfoRowProps) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800 pb-4">

      <div className="flex items-center gap-3 text-slate-400">

        {icon}

        {label}

      </div>

      <span className="font-medium text-white">
        {value}
      </span>

    </div>
  );
}