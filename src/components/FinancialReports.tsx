import {
  FileText,
  BarChart3,
  Wallet,
  Download,
} from "lucide-react";

const reports = [
  {
    title: "Profit & Loss Statement",
    description: "Revenue, expenses and profitability analysis.",
    icon: FileText,
  },
  {
    title: "Balance Sheet",
    description: "Assets, liabilities and equity position.",
    icon: Wallet,
  },
  {
    title: "Cash Flow Statement",
    description: "Cash inflows and outflows analysis.",
    icon: BarChart3,
  },
  {
    title: "Trial Balance Report",
    description: "Summary of all account balances.",
    icon: FileText,
  },
];

export default function FinancialReports() {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#20243A]">
          Financial Reports
        </h1>

        <p className="text-[#666B84] mt-2">
          Generate and export financial statements.
        </p>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-2 gap-6">

        {reports.map((report) => {
          const Icon = report.icon;

          return (
            <div
              key={report.title}
              className="
                bg-white
                border
                border-[#ECECF3]
                rounded-2xl
                p-6
                hover:border-[#20243A]
                transition-all
              "
            >
              <div className="flex items-center justify-between mb-5">
                <div className="
                  w-14
                  h-14
                  rounded-xl
                  bg-[#20243A]/10
                  flex
                  items-center
                  justify-center
                ">
                  <Icon
                    size={28}
                    className="text-[#20243A]"
                  />
                </div>

                <button className="
                  flex
                  items-center
                  gap-2
                  bg-[#F8F9FC]
                  hover:bg-[#ECECF3]
                  px-4
                  py-2
                  rounded-lg
                  text-[#20243A]
                ">
                  <Download size={16} />
                  Export
                </button>
              </div>

              <h2 className="text-xl font-bold text-[#20243A]">
                {report.title}
              </h2>

              <p className="text-[#666B84] mt-2">
                {report.description}
              </p>

              <button className="
                mt-6
                text-[#20243A]
                hover:text-[#20243A]
              ">
                Open Report →
              </button>
            </div>
          );
        })}

      </div>

    </div>
  );
}
