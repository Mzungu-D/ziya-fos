import { ShieldCheck } from "lucide-react";

export default function FinancialHealthScore() {
  return (
    <div className="bg-white border border-[#ECECF3] rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-[#16A34A]/10 flex items-center justify-center">
          <ShieldCheck className="text-[#16A34A]" size={24} />
        </div>
        <div>
          <h2 className="text-[#20243A] text-xl font-bold">Financial Health</h2>
          <p className="text-[#666B84] text-sm">Overall business score</p>
        </div>
      </div>

      <div className="text-center">
        <h1 className="text-6xl font-bold text-[#16A34A]">92%</h1>
        <p className="text-[#666B84] mt-3">Excellent Financial Health</p>
      </div>

      <div className="mt-8">
        <div className="w-full h-3 rounded-full bg-[#F8F9FC] overflow-hidden border border-[#ECECF3]">
          <div className="h-full w-[92%] bg-[#16A34A] rounded-full" />
        </div>
      </div>
    </div>
  );
}