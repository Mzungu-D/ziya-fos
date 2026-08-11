import { ShieldCheck } from "lucide-react";

export default function FinancialHealthScore() {
  return (
    <div className="bg-[#111827] border border-[#ECECF3] rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
          <ShieldCheck className="text-green-400" size={24} />
        </div>

        <div>
          <h2 className="text-[#20243A] text-xl font-bold">
            Financial Health
          </h2>

          <p className="text-[#666B84] text-sm">
            Overall business score
          </p>
        </div>
      </div>

      <div className="text-center">
        <h1 className="text-6xl font-bold text-green-400">
          92%
        </h1>

        <p className="text-[#666B84] mt-3">
          Excellent Financial Health
        </p>
      </div>

      <div className="mt-8">
        <div className="w-full h-3 rounded-full bg-[#F8F9FC] overflow-hidden">
          <div className="h-full w-[92%] bg-green-500 rounded-full"></div>
        </div>
      </div>
    </div>
  );
}