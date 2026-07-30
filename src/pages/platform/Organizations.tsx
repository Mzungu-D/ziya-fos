import { useNavigate } from "react-router-dom";
import {
  Building2,
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";

interface Organization {
  id: number;
  name: string;
  industry: string;
  users: number;
  country: string;
  status: "Active" | "Pending" | "Suspended";
}

const organizations: Organization[] = [
  {
    id: 1,
    name: "Ziya Bridge",
    industry: "Financial Services",
    users: 126,
    country: "Kenya",
    status: "Active",
  },
  {
    id: 2,
    name: "Mombasa SACCO",
    industry: "Microfinance",
    users: 58,
    country: "Kenya",
    status: "Active",
  },
  {
    id: 3,
    name: "Coast Traders",
    industry: "Retail",
    users: 32,
    country: "Kenya",
    status: "Pending",
  },
  {
    id: 4,
    name: "Future Holdings",
    industry: "Investment",
    users: 19,
    country: "Uganda",
    status: "Suspended",
  },
];

export default function Organizations() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">

      {/* Header */}

      <div className="flex items-center justify-between">

        <div>
          <h1 className="text-3xl font-bold text-white">
            Organizations
          </h1>

          <p className="mt-1 text-slate-400">
            Manage all organizations using Ziya FOS.
          </p>
        </div>

        <button
          onClick={() => navigate("/platform/organizations/new")}
          className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 font-medium text-black transition hover:bg-amber-400"
        >
          <Plus size={18} />
          New Organization
        </button>

      </div>

      {/* Search */}

      <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">

        <Search className="text-slate-500" size={18} />

        <input
          type="text"
          placeholder="Search organizations..."
          className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
        />

      </div>

      {/* Table */}

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">

        <table className="w-full">

          <thead className="border-b border-slate-800 bg-slate-800">

            <tr>

              <th className="px-6 py-4 text-left text-sm text-slate-400">
                Organization
              </th>

              <th className="px-6 py-4 text-left text-sm text-slate-400">
                Industry
              </th>

              <th className="px-6 py-4 text-left text-sm text-slate-400">
                Users
              </th>

              <th className="px-6 py-4 text-left text-sm text-slate-400">
                Country
              </th>

              <th className="px-6 py-4 text-left text-sm text-slate-400">
                Status
              </th>

              <th className="px-6 py-4 text-center text-sm text-slate-400">
                Actions
              </th>

            </tr>

          </thead>

          <tbody>

            {organizations.map((organization) => (

              <tr
                key={organization.id}
                className="border-b border-slate-800 hover:bg-slate-800"
              >

                <td className="px-6 py-5">

                  <div className="flex items-center gap-3">

                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10">

                      <Building2 className="text-amber-400" size={22} />

                    </div>

                    <div>

                      <p className="font-medium text-white">
                        {organization.name}
                      </p>

                    </div>

                  </div>

                </td>

                <td className="px-6 py-5 text-slate-300">
                  {organization.industry}
                </td>

                <td className="px-6 py-5 text-slate-300">
                  {organization.users}
                </td>

                <td className="px-6 py-5 text-slate-300">
                  {organization.country}
                </td>

                <td className="px-6 py-5">

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      organization.status === "Active"
                        ? "bg-green-500/20 text-green-400"
                        : organization.status === "Pending"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {organization.status}
                  </span>

                </td>

                <td className="px-6 py-5">

                  <div className="flex justify-center gap-4">

                    <button
                      onClick={() =>
                        navigate(`/platform/organizations/${organization.id}`)
                      }
                    >
                      <Eye
                        className="text-blue-400 hover:text-blue-300"
                        size={19}
                      />
                    </button>

                    <button>
                      <Pencil
                        className="text-yellow-400 hover:text-yellow-300"
                        size={19}
                      />
                    </button>

                    <button>
                      <Trash2
                        className="text-red-400 hover:text-red-300"
                        size={19}
                      />
                    </button>

                  </div>

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>
  );
}