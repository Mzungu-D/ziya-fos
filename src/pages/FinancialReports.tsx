import { useState } from "react";
import {
  BarChart3, FileText, TrendingUp, Wallet,
  Download, RefreshCw, ChevronRight,
} from "lucide-react";
import { authenticatedFetch } from "../lib/auth";

type ReportType = "profit-loss" | "balance-sheet" | "cash-flow" | "trial-balance";

interface Report {
  id:          ReportType;
  title:       string;
  description: string;
  icon:        React.ReactNode;
  color:       string;
  bg:          string;
}

const REPORTS: Report[] = [
  {
    id:          "profit-loss",
    title:       "Profit & Loss",
    description: "Revenue, expenses and net profit for the period.",
    icon:        <TrendingUp size={22} />,
    color:       "text-[#6D5DF6]",
    bg:          "bg-[#6D5DF6]/10",
  },
  {
    id:          "balance-sheet",
    title:       "Balance Sheet",
    description: "Assets, liabilities and equity at a point in time.",
    icon:        <BarChart3 size={22} />,
    color:       "text-[#16A34A]",
    bg:          "bg-[#16A34A]/10",
  },
  {
    id:          "cash-flow",
    title:       "Cash Flow Statement",
    description: "Cash inflows and outflows from operations, investing and financing.",
    icon:        <Wallet size={22} />,
    color:       "text-[#F59E0B]",
    bg:          "bg-[#F59E0B]/10",
  },
  {
    id:          "trial-balance",
    title:       "Trial Balance",
    description: "Verify that total debits equal total credits.",
    icon:        <FileText size={22} />,
    color:       "text-[#EF4444]",
    bg:          "bg-[#EF4444]/10",
  },
];

const PERIODS = [
  { label: "This Month",      value: "this-month"      },
  { label: "Last Month",      value: "last-month"      },
  { label: "This Quarter",    value: "this-quarter"    },
  { label: "Last Quarter",    value: "last-quarter"    },
  { label: "This Year",       value: "this-year"       },
  { label: "Last Year",       value: "last-year"       },
];

export default function FinancialReports() {
  const [selected, setSelected]   = useState<ReportType | null>(null);
  const [period, setPeriod]       = useState("this-month");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [reportData, setReportData] = useState<Record<string, unknown> | null>(null);

  const generateReport = async (type: ReportType) => {
    try {
      setSelected(type);
      setLoading(true);
      setError("");
      setReportData(null);

      const response = await authenticatedFetch(
        `/api/reports/${type}?period=${period}`
      );
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || "Failed to generate report");

      setReportData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate report");
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!reportData) return;
    const json   = JSON.stringify(reportData, null, 2);
    const blob   = new Blob([json], { type: "application/json" });
    const url    = URL.createObjectURL(blob);
    const link   = document.createElement("a");
    link.href    = url;
    link.download = `ziya-${selected}-${period}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#20243A]">Financial Reports</h1>
          <p className="mt-2 text-[#666B84]">
            Generate and export statutory and management reports.
          </p>
        </div>

        {reportData && (
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 rounded-xl bg-[#6D5DF6] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#5a4de0] transition"
          >
            <Download size={17} />
            Export
          </button>
        )}
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-3 rounded-2xl border border-[#ECECF3] bg-white p-4">
        <span className="text-sm font-medium text-[#20243A]">Period:</span>
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                period === p.value
                  ? "bg-[#6D5DF6] text-white"
                  : "bg-[#F8F9FC] text-[#666B84] hover:bg-[#ECECF3] hover:text-[#20243A]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Report cards */}
      <div className="grid grid-cols-2 gap-5">
        {REPORTS.map((report) => (
          <button
            key={report.id}
            onClick={() => generateReport(report.id)}
            disabled={loading && selected === report.id}
            className={`flex items-start gap-4 rounded-2xl border p-6 text-left transition hover:shadow-md ${
              selected === report.id
                ? "border-[#6D5DF6]/40 bg-[#6D5DF6]/5"
                : "border-[#ECECF3] bg-white hover:border-[#6D5DF6]/30"
            }`}
          >
            <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${report.bg}`}>
              <span className={report.color}>{report.icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-[#20243A]">{report.title}</h3>
              <p className="mt-1 text-sm text-[#666B84]">{report.description}</p>
            </div>
            {loading && selected === report.id ? (
              <RefreshCw size={18} className="flex-shrink-0 animate-spin text-[#6D5DF6]" />
            ) : (
              <ChevronRight size={18} className="flex-shrink-0 text-[#666B84]" />
            )}
          </button>
        ))}
      </div>

      {/* Report output */}
      {reportData && !loading && (
        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#20243A]">
              {REPORTS.find((r) => r.id === selected)?.title} —{" "}
              {PERIODS.find((p) => p.value === period)?.label}
            </h2>
            <span className="rounded-full bg-[#16A34A]/10 px-3 py-1 text-xs font-semibold text-[#16A34A]">
              Generated
            </span>
          </div>
          <pre className="overflow-x-auto rounded-xl bg-[#F8F9FC] p-4 text-sm text-[#20243A]">
            {JSON.stringify(reportData, null, 2)}
          </pre>
        </div>
      )}

    </div>
  );
}