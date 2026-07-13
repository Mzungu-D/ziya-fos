import {
  Plus,
  Building2,
  Search,
  TrendingUp,
} from "lucide-react";

const companies = [
  {
    company: "Mombasa Fresh Foods Ltd",
    industry: "Agriculture",
    funding: "KES 2,500,000",
    outstanding: "KES 1,200,000",
    status: "Active",
  },
  {
    company: "Coast Logistics Ltd",
    industry: "Transport",
    funding: "KES 5,000,000",
    outstanding: "KES 3,800,000",
    status: "Active",
  },
  {
    company: "Blue Ocean Traders",
    industry: "Retail",
    funding: "KES 800,000",
    outstanding: "KES 0",
    status: "Closed",
  },
];

export default function PortfolioCompanies() {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Portfolio Companies
          </h1>

          <p className="text-slate-400 mt-2">
            Manage businesses and enterprises funded by Ziya.
          </p>
        </div>

        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white">
          <Plus size={18} />
          Add Company
        </button>
      </div>

      {/* Search */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center bg-slate-900 rounded-lg px-3">
          <Search size={18} className="text-slate-500" />

          <input
            type="text"
            placeholder="Search companies..."
            className="bg-transparent outline-none px-3 py-3 text-white flex-1"
          />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
          <p className="text-slate-400">Portfolio Size</p>
          <h2 className="text-3xl font-bold text-white mt-2">
            KES 8,300,000
          </h2>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
          <p className="text-slate-400">Outstanding Balance</p>
          <h2 className="text-3xl font-bold text-yellow-400 mt-2">
            KES 5,000,000
          </h2>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
          <p className="text-slate-400">Active Companies</p>
          <h2 className="text-3xl font-bold text-green-400 mt-2">
            2
          </h2>
        </div>
      </div>

      {/* Companies */}
      <div className="grid grid-cols-2 gap-6">
        {companies.map((company) => (
          <div
            key={company.company}
            className="bg-[#111827] border border-slate-800 rounded-2xl p-6 hover:border-blue-500 transition-all"
          >
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Building2 size={28} className="text-blue-400" />
              </div>

              <div>
                <h2 className="text-xl text-white font-semibold">
                  {company.company}
                </h2>

                <p className="text-slate-400">
                  {company.industry}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-slate-400">
                Funding Amount:
                <span className="text-white ml-2">
                  {company.funding}
                </span>
              </p>

              <p className="text-slate-400">
                Outstanding:
                <span className="text-yellow-400 ml-2">
                  {company.outstanding}
                </span>
              </p>
            </div>

            <div className="mt-5 flex justify-between items-center">
              <span
                className={`px-3 py-1 rounded-full text-sm ${
                  company.status === "Active"
                    ? "bg-green-500/20 text-green-400"
                    : "bg-slate-500/20 text-slate-400"
                }`}
              >
                {company.status}
              </span>

              <TrendingUp className="text-blue-400" />
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}