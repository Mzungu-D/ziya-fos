import {
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  MapPin,
  TrendingUp,
  AlertTriangle,
  DollarSign,
} from "lucide-react";

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function ViewPortfolioCompany() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`http://localhost:5000/api/portfolio-companies/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setCompany(data.company);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen text-white">
        Loading Company...
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex justify-center items-center h-screen text-red-400">
        Company not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">

          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700"
          >
            <ArrowLeft className="text-white" />
          </button>

          <div>
            <h1 className="text-3xl font-bold text-white">
              {company.companyName}
            </h1>
            <p className="text-slate-400">Portfolio Company Details</p>
          </div>

        </div>
      </div>

      {/* Company Information */}
      <div className="grid grid-cols-2 gap-6">

        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">

          <div className="flex items-center gap-3 mb-5">
            <Building2 className="text-blue-400" />
            <h2 className="text-xl font-semibold text-white">
              Company Information
            </h2>
          </div>

          <div className="space-y-4 text-sm">

            <div className="flex justify-between">
              <span className="text-slate-400">Company Code</span>
              <span className="text-white">{company.companyCode}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">Industry</span>
              <span className="text-white">{company.industry || "-"}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">Business Type</span>
              <span className="text-white">{company.businessType || "-"}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400 flex items-center gap-2">
                <Phone size={16} /> Phone
              </span>
              <span className="text-white">{company.phoneNumber || "-"}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400 flex items-center gap-2">
                <Mail size={16} /> Email
              </span>
              <span className="text-white">{company.email || "-"}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400 flex items-center gap-2">
                <MapPin size={16} /> Address
              </span>
              <span className="text-white">{company.address || "-"}</span>
            </div>

          </div>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">

          <div className="flex items-center gap-3 mb-5">
            <DollarSign className="text-green-400" />
            <h2 className="text-xl font-semibold text-white">
              Investment & Performance
            </h2>
          </div>

          <div className="space-y-4 text-sm">

            <div className="flex justify-between">
              <span className="text-slate-400">Investment Amount</span>
              <span className="text-green-400 font-semibold">
                KES {(company.investmentAmount || 0).toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">Current Valuation</span>
              <span className="text-white">
                KES {(company.currentValuation || 0).toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">Expected Return</span>
              <span className="text-blue-400">
                {company.expectedReturn || "-"}%
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">Ownership</span>
              <span className="text-white">
                {company.ownershipPercentage || "-"}%
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400 flex items-center gap-2">
                <TrendingUp size={16} /> Risk Rating
              </span>
              <span className="text-yellow-400">
                {company.riskRating || "N/A"}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400 flex items-center gap-2">
                <AlertTriangle size={16} /> Status
              </span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  company.status === "ACTIVE"
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {company.status}
              </span>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}