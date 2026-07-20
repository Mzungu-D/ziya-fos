import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Building2, Search, Eye, Pencil, Trash2 } from "lucide-react";
import AddCompanyModal from "../components/portfolio/AddCompanyModal";

export default function PortfolioCompanies() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<any[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [search, setSearch] = useState("");

  const loadCompanies = () => {
    fetch("http://localhost:5000/api/portfolio-companies")
      .then((res) => res.json())
      .then((data) => setCompanies(data.companies || []))
      .catch((err) => console.error(err));
  };

  const deleteCompany = async (id: string) => {
    const confirmed = window.confirm("Are you sure you want to delete this company?");
    if (!confirmed) return;

    try {
      const response = await fetch(
        `http://localhost:5000/api/portfolio-companies/${id}`,
        { method: "DELETE" }
      );
      if (!response.ok) throw new Error("Failed to delete company.");
      loadCompanies();
    } catch (error) {
      console.error(error);
      alert("Unable to delete company.");
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  const filteredCompanies = companies.filter((company) =>
    company.companyName?.toLowerCase().includes(search.toLowerCase())
  );

  const riskColor = (rating: string) => {
    if (rating === "HIGH") return "text-red-400";
    if (rating === "MEDIUM") return "text-yellow-400";
    return "text-green-400";
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Portfolio Companies</h1>
          <p className="text-slate-400 mt-1">
            Manage businesses and enterprises funded by Ziya.
          </p>
        </div>

        <button
          onClick={() => setOpenModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white transition"
        >
          <Plus size={18} />
          Add Company
        </button>
      </div>

      {/* Search */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center gap-2 bg-slate-900 rounded-lg px-3">
          <Search size={18} className="text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search companies..."
            className="bg-transparent outline-none px-2 py-3 text-white flex-1 placeholder:text-slate-600"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
          <p className="text-slate-400 text-sm">Portfolio Size</p>
          <h2 className="text-3xl font-bold text-white mt-2">{companies.length}</h2>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
          <p className="text-slate-400 text-sm">Total Investment</p>
          <h2 className="text-3xl font-bold text-yellow-400 mt-2">
            KES{" "}
            {companies
              .reduce((sum, c) => sum + (c.investmentAmount || 0), 0)
              .toLocaleString()}
          </h2>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
          <p className="text-slate-400 text-sm">Active Companies</p>
          <h2 className="text-3xl font-bold text-green-400 mt-2">
            {companies.filter((c) => c.status === "ACTIVE").length}
          </h2>
        </div>
      </div>

      {/* Company Cards */}
      {filteredCompanies.length === 0 ? (
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
          <Building2 size={48} className="text-slate-700 mb-4" />
          <p className="text-slate-400 text-lg">No companies found.</p>
          <p className="text-slate-600 text-sm mt-1">
            {search ? "Try a different search term." : "Click \"Add Company\" to get started."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {filteredCompanies.map((company) => (
            <div
              key={company.id}
              className="bg-[#111827] border border-slate-800 rounded-2xl p-6 hover:border-blue-500 transition-all duration-300"
            >
              {/* Card Header */}
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Building2 size={28} className="text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">{company.companyName}</h2>
                  <p className="text-slate-400 text-sm">{company.industry || "Unknown Industry"}</p>
                </div>
              </div>

              {/* Card Details */}
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Company Code</span>
                  <span className="text-white font-medium">{company.companyCode || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Contact Person</span>
                  <span className="text-white">{company.contactPerson || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Phone Number</span>
                  <span className="text-white">{company.phoneNumber || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Investment</span>
                  <span className="text-green-400 font-semibold">
                    KES {(company.investmentAmount || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Risk Rating</span>
                  <span className={`font-semibold ${riskColor(company.riskRating)}`}>
                    {company.riskRating || "N/A"}
                  </span>
                </div>
              </div>

              {/* Card Footer */}
              <div className="mt-6 flex justify-between items-center">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    company.status === "ACTIVE"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {company.status}
                </span>

                <div className="flex items-center gap-4">
                  <Link
                    to={`/dashboard/portfolio-companies/${company.id}`}
                    title="View Company"
                    className="text-blue-400 hover:text-blue-300 transition"
                  >
                    <Eye size={20} />
                  </Link>

                  <button
                    title="Edit Company"
                    onClick={() =>
                      navigate(`/dashboard/edit-portfolio-company/${company.id}`)
                    }
                    className="text-yellow-400 hover:text-yellow-300 transition"
                  >
                    <Pencil size={20} />
                  </button>

                  <button
                    title="Delete Company"
                    onClick={() => deleteCompany(company.id)}
                    className="text-red-500 hover:text-red-400 transition"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddCompanyModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        onSuccess={() => {
          loadCompanies();
          setOpenModal(false);
        }}
      />

    </div>
  );
}