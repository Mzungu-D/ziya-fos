export default function FinancialReports() {
  return (
    <div className="p-8 text-white">

      <div className="mb-8">
        <h1 className="text-4xl font-bold">
          Financial Reports
        </h1>

        <p className="text-slate-400 mt-2">
          Generate, analyze and export financial reports for your organization.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">

        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 hover:border-blue-500 transition-all">
          <h2 className="text-xl font-semibold">
            Balance Sheet
          </h2>

          <p className="text-slate-400 mt-3">
            View assets, liabilities and equity position.
          </p>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 hover:border-blue-500 transition-all">
          <h2 className="text-xl font-semibold">
            Profit & Loss Statement
          </h2>

          <p className="text-slate-400 mt-3">
            Analyze revenues, expenses and profitability.
          </p>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 hover:border-blue-500 transition-all">
          <h2 className="text-xl font-semibold">
            Cash Flow Statement
          </h2>

          <p className="text-slate-400 mt-3">
            Track operating, investing and financing cash flows.
          </p>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 hover:border-blue-500 transition-all">
          <h2 className="text-xl font-semibold">
            Trial Balance Report
          </h2>

          <p className="text-slate-400 mt-3">
            Verify debit and credit balances across all accounts.
          </p>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 hover:border-blue-500 transition-all">
          <h2 className="text-xl font-semibold">
            Budget vs Actual
          </h2>

          <p className="text-slate-400 mt-3">
            Compare planned budgets against actual performance.
          </p>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 hover:border-blue-500 transition-all">
          <h2 className="text-xl font-semibold">
            Custom Reports
          </h2>

          <p className="text-slate-400 mt-3">
            Build and export tailored financial reports for management.
          </p>
        </div>

      </div>

    </div>
  );
}