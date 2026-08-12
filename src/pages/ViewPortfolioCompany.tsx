import { ArrowLeft, Building2, Phone, Mail, MapPin, TrendingUp, AlertTriangle, DollarSign } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_URL } from "../lib/api";
import { authenticatedFetch } from "../lib/auth";

export default function ViewPortfolioCompany() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authenticatedFetch(`${API_URL}/api/portfolio-companies/${id}`)
      .then((res) => res.json())
      .then((data) => { setCompany(data.company); setLoading(false); })
      .catch((err) => { console.error(err); setLoading(false); });
  }, [id]);

  if (loading) return <div className="flex justify-center items-center h-screen text-[#20243A]">Loading Company...</div>;
  if (!company) return <div className="flex justify-center items-center h-screen text-red-400">Company not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg bg-[#F8F9FC] hover:bg-[#ECECF3]">
            <ArrowLeft className="text-[#20243A]" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-[#20243A]">{company.companyName}</h1>
            <p className="text-[#666B84]">Portfolio Company Details</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <Building2 className="text-[#20243A]" />
            <h2 className="text-xl font-semibold text-[#20243A]">Company Information</h2>
          </div>
          <div className="space-y-4 text-sm">
            <div className="flex justify-between"><span className="text-[#666B84]">Company Code</span><span className="text-[#20243A]">{company.companyCode}</span></div>
            <div className="flex justify-between"><span className="text-[#666B84]">Industry</span><span className="text-[#20243A]">{company.industry || "-"}</span></div>
            <div className="flex justify-between"><span className="text-[#666B84]">Business Type</span><span className="text-[#20243A]">{company.businessType || "-"}</span></div>
            <div className="flex justify-between"><span className="text-[#666B84] flex items-center gap-2"><Phone size={16} /> Phone</span><span className="text-[#20243A]">{company.phoneNumber || "-"}</span></div>
            <div className="flex justify-between"><span className="text-[#666B84] flex items-center gap-2"><Mail size={16} /> Email</span><span className="text-[#20243A]">{company.email || "-"}</span></div>
            <div className="flex justify-between"><span className="text-[#666B84] flex items-center gap-2"><MapPin size={16} /> Address</span><span className="text-[#20243A]">{company.address || "-"}</span></div>
          </div>
        </div>

        <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <DollarSign className="text-green-400" />
            <h2 className="text-xl font-semibold text-[#20243A]">Investment & Performance</h2>
          </div>
          <div className="space-y-4 text-sm">
            <div className="flex justify-between"><span className="text-[#666B84]">Investment Amount</span><span className="text-green-400 font-semibold">KES {(company.investmentAmount || 0).toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-[#666B84]">Current Valuation</span><span className="text-[#20243A]">KES {(company.currentValuation || 0).toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-[#666B84]">Expected Return</span><span className="text-[#20243A]">{company.expectedReturn || "-"}%</span></div>
            <div className="flex justify-between"><span className="text-[#666B84]">Ownership</span><span className="text-[#20243A]">{company.ownershipPercentage || "-"}%</span></div>
            <div className="flex justify-between"><span className="text-[#666B84] flex items-center gap-2"><TrendingUp size={16} /> Risk Rating</span><span className="text-yellow-400">{company.riskRating || "N/A"}</span></div>
            <div className="flex justify-between">
              <span className="text-[#666B84] flex items-center gap-2"><AlertTriangle size={16} /> Status</span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${company.status === "ACTIVE" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>{company.status}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

