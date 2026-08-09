import { useState } from "react";
import { X } from "lucide-react";
import { API_URL } from "../../lib/api";
import { authenticatedFetch } from "../../lib/auth";

interface AddCompanyModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddCompanyModal({ open, onClose, onSuccess }: AddCompanyModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    companyCode: "", companyName: "", industry: "",
    contactPerson: "", phoneNumber: "", investmentAmount: "", riskRating: "LOW",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await authenticatedFetch(`${API_URL}/api/portfolio-companies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, investmentAmount: Number(formData.investmentAmount), status: "ACTIVE" }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.log("Backend Error:", errorData);
        alert(JSON.stringify(errorData));
        return;
      }
      setFormData({ companyCode: "", companyName: "", industry: "", contactPerson: "", phoneNumber: "", investmentAmount: "", riskRating: "LOW" });
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      alert("Failed to save company.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50">
      <div className="bg-[#111827] w-full max-w-2xl rounded-2xl border border-slate-700 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Add Portfolio Company</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white"><X /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 mb-2">Company Code</label>
              <input type="text" name="companyCode" value={formData.companyCode} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white" required />
            </div>
            <div>
              <label className="block text-slate-300 mb-2">Company Name</label>
              <input type="text" name="companyName" value={formData.companyName} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white" required />
            </div>
            <div>
              <label className="block text-slate-300 mb-2">Industry</label>
              <input type="text" name="industry" value={formData.industry} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white" />
            </div>
            <div>
              <label className="block text-slate-300 mb-2">Contact Person</label>
              <input type="text" name="contactPerson" value={formData.contactPerson} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white" />
            </div>
            <div>
              <label className="block text-slate-300 mb-2">Phone Number</label>
              <input type="text" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white" />
            </div>
            <div>
              <label className="block text-slate-300 mb-2">Investment Amount</label>
              <input type="number" name="investmentAmount" value={formData.investmentAmount} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white" required />
            </div>
            <div className="col-span-2">
              <label className="block text-slate-300 mb-2">Risk Rating</label>
              <select name="riskRating" value={formData.riskRating} onChange={handleChange} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white">
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-5 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800">Cancel</button>
            <button type="submit" disabled={loading} className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">{loading ? "Saving..." : "Save Company"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
