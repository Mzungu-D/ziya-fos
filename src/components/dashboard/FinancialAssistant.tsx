import { Bot, Sparkles } from "lucide-react";

export default function FinancialAssistant() {
  return (
    <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
          <Bot className="text-blue-400" size={24} />
        </div>

        <div>
          <h2 className="text-white text-xl font-bold">
            AI Financial Assistant
          </h2>

          <p className="text-slate-400 text-sm">
            Smart insights powered by AI
          </p>
        </div>
      </div>

      <div className="bg-[#0f172a] rounded-xl p-4 border border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="text-yellow-400" size={18} />
          <span className="text-yellow-400 font-semibold">
            Today's Insight
          </span>
        </div>

        <p className="text-slate-300 leading-7">
          Revenue increased by <strong>12.5%</strong> this month while
          operational expenses increased by only <strong>8.1%</strong>.
          This indicates improved profitability. Consider allocating
          additional funds toward loan expansion and customer acquisition.
        </p>
      </div>
    </div>
  );
}