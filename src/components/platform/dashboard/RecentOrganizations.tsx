import { Building2, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Organization {
  id: number;
  name: string;
  industry: string;
  users: number;
  status: "Active" | "Pending";
}

const organizations: Organization[] = [
  {
    id: 1,
    name: "Ziya Bridge",
    industry: "Financial Services",
    users: 126,
    status: "Active",
  },
  {
    id: 2,
    name: "Mombasa SACCO",
    industry: "Microfinance",
    users: 58,
    status: "Active",
  },
  {
    id: 3,
    name: "Coast Traders",
    industry: "Retail",
    users: 34,
    status: "Pending",
  },
  {
    id: 4,
    name: "Future Holdings",
    industry: "Investment",
    users: 19,
    status: "Active",
  },
];

export default function RecentOrganizations() {
  const navigate = useNavigate();

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">
            Recent Organizations
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Newly onboarded organizations.
          </p>
        </div>

        <button
          onClick={() => navigate("/platform/organizations")}
          className="flex items-center gap-2 text-sm font-medium text-amber-400 hover:text-amber-300"
        >
          View All
          <ArrowRight size={16} />
        </button>
      </div>

      <div className="space-y-4">
        {organizations.map((organization) => (
          <div
            key={organization.id}
            className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-800 p-4"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
                <Building2 className="h-6 w-6 text-amber-400" />
              </div>

              <div>
                <h3 className="font-medium text-white">
                  {organization.name}
                </h3>

                <p className="text-sm text-slate-400">
                  {organization.industry}
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className="font-semibold text-white">
                {organization.users} Users
              </p>

              <span
                className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                  organization.status === "Active"
                    ? "bg-green-500/20 text-green-400"
                    : "bg-yellow-500/20 text-yellow-400"
                }`}
              >
                {organization.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}