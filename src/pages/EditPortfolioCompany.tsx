import { ArrowLeft, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_URL } from "../lib/api";

export default function EditPortfolioCompany() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    companyCode: "", companyName: "", registrationNumber: "", kraPin: "",
    industry: "", businessType: "", contactPerson: "", phoneNumber: "",
    email: "", address: "", investmentType: "", investmentAmount: 0,
    ownershipPercentage: 0, expectedReturn: 0, investmentDate: "",
    currentValuation: 0, currentRevenue: 0, currentExpenses: 0,
    currentProfit: 0, riskRating: "LOW", repaymentStatus: "", status: "ACTIVE",
  });

  useEffect(() => {
    fetch(`${API_URL}/api/portfolio-companies/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setFormData({
          companyCode: data.company.companyCode || "",
          companyName: data.company.companyName || "",
          registrationNumber: data.company.registrationNumber || "",
          kraPin: data.company.kraPin || "",
          industry: data.company.industry || "",
          businessType: data.company.businessType || "",
          contactPerson: data.company.contactPerson || "",
          phoneNumber: data.company.phoneNumber || "",
          email: data.company.email || "",
          address: data.company.address || "",
          investmentType: data.company.investmentType || "",
          investmentAmount: data.company.investmentAmount || 0,
          ownershipPercentage: data.company.ownershipPercentage || 0,
          expectedReturn: data.company.expectedReturn || 0,
          investmentDate: data.company.investmentDate ? data.company.investmentDate.substring(0, 10) : "",
          currentValuation: data.company.currentValuation || 0,
          currentRevenue: data.company.currentRevenue || 0,
          currentExpenses: data.company.currentExpenses || 0,
          currentProfit: data.company.currentProfit || 0,
          riskRating: data.company.riskRating || "LOW",
          repaymentStatus: data.company.repaymentStatus || "",
          status: data.company.status || "ACTIVE",
        });
        setLoading(false);
      })
      .catch((err) => { console.error(err); setLoading(false); });
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: e.target.type === "number" ? Number(value) : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const response = await fetch(`${API_URL}/api/portfolio-companies/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!response.ok) throw new Error("Failed to update company");
      alert("Company updated successfully.");
      navigate("/dashboard/portfolio-companies");
    } catch (error) {
      console.error(error);
      alert("Failed to update company.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-screen text-white">Loading Company...</div>;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => navigate(-1)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700">
            <ArrowLeft className="text-white" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white">Edit Portfolio Company</h1>
            <p className="text-slate-400">Update portfolio company details</p>
          </div>
        </div>
        <button type="submit" disabled={saving} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-5 py-3 rounded-lg text-white">
          <Save size={18} />
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-white mb-6">Company Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <input type="text" name="companyCode" value={formData.companyCode} onChange={handleChange} placeholder="Company Code" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white" />
          <input type="text" name="companyName" value={formData.companyName} onChange={handleChange} placeholder="Company Name" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white" />
          <input type="text" name="registrationNumber" value={formData.registrationNumber} onChange={handleChange} placeholder="Registration Number" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white" />
          <input type="text" name="kraPin" value={formData.kraPin} onChange={handleChange} placeholder="KRA PIN" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white" />
          <input type="text" name="industry" value={formData.industry} onChange={handleChange} placeholder="Industry" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white" />
          <input type="text" name="businessType" value={formData.businessType} onChange={handleChange} placeholder="Business Type" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white" />
          <input type="text" name="contactPerson" value={formData.contactPerson} onChange={handleChange} placeholder="Contact Person" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white" />
          <input type="text" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} placeholder="Phone Number" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white" />
          <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Email" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white" />
          <input type="text" name="address" value={formData.address} onChange={handleChange} placeholder="Address" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white" />
        </div>
      </div>

      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-white mb-6">Investment &amp; Performance</h2>
        <div className="grid grid-cols-2 gap-4">
          <input type="text" name="investmentType" value={formData.investmentType} onChange={handleChange} placeholder="Investment Type" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white" />
          <input type="number" name="investmentAmount" value={formData.investmentAmount} onChange={handleChange} placeholder="Investment Amount" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white" />
          <input type="number" name="ownershipPercentage" value={formData.ownershipPercentage} onChange={handleChange} placeholder="Ownership Percentage" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white" />
          <input type="number" name="expectedReturn" value={formData.expectedReturn} onChange={handleChange} placeholder="Expected Return (%)" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white" />
          <input type="date" name="investmentDate" value={formData.investmentDate} onChange={handleChange} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white" />
          <input type="number" name="currentValuation" value={formData.currentValuation} onChange={handleChange} placeholder="Current Valuation" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white" />
          <input type="number" name="currentRevenue" value={formData.currentRevenue} onChange={handleChange} placeholder="Current Revenue" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white" />
          <input type="number" name="currentExpenses" value={formData.currentExpenses} onChange={handleChange} placeholder="Current Expenses" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white" />
          <input type="number" name="currentProfit" value={formData.currentProfit} onChange={handleChange} placeholder="Current Profit" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white" />
          <select name="riskRating" value={formData.riskRating} onChange={handleChange} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white">
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
          </select>
          <input type="text" name="repaymentStatus" value={formData.repaymentStatus} onChange={handleChange} placeholder="Repayment Status" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white" />
          <select name="status" value={formData.status} onChange={handleChange} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white">
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </div>
      </div>
    </form>
  );
}