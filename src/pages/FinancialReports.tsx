import { useState } from "react";
import {
  BarChart3,
  FileText,
  TrendingUp,
  Wallet,
  RefreshCw,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { authenticatedFetch } from "../lib/auth";

type ReportId =
  | "income-statement"
  | "balance-sheet"
  | "cash-flow"
  | "trial-balance";

interface ReportMeta {
  id: ReportId;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  endpoint: string;
}

const REPORTS: ReportMeta[] = [
  {
    id: "income-statement",
    title: "Profit & Loss",
    description: "Revenue, expenses and net profit for the period.",
    icon: <TrendingUp size={22} />,
    color: "text-[#6D5DF6]",
    bg: "bg-[#6D5DF6]/10",
    endpoint: "/api/income-statement",
  },
  {
    id: "balance-sheet",
    title: "Balance Sheet",
    description: "Assets, liabilities and equity at a point in time.",
    icon: <BarChart3 size={22} />,
    color: "text-[#16A34A]",
    bg: "bg-[#16A34A]/10",
    endpoint: "/api/balance-sheet",
  },
  {
    id: "cash-flow",
    title: "Cash Flow Statement",
    description: "Cash inflows and outflows from operations, investing and financing.",
    icon: <Wallet size={22} />,
    color: "text-[#F59E0B]",
    bg: "bg-[#F59E0B]/10",
    endpoint: "/api/cash-flow",
  },
  {
    id: "trial-balance",
    title: "Trial Balance",
    description: "Verify that total debits equal total credits.",
    icon: <FileText size={22} />,
    color: "text-[#EF4444]",
    bg: "bg-[#EF4444]/10",
    endpoint: "/api/trial-balance",
  },
];

const PERIODS = [
  { label: "This Month",   value: "this-month"   },
  { label: "Last Month",   value: "last-month"   },
  { label: "This Quarter", value: "this-quarter" },
  { label: "Last Quarter", value: "last-quarter" },
  { label: "This Year",    value: "this-year"    },
  { label: "Last Year",    value: "last-year"    },
];

const fmt = (n: unknown) => {
  const num = Number(n ?? 0);
  return isNaN(num)
    ? "0.00"
    : num.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtDate = (d: unknown) => {
  if (!d) return "—";
  try {
    return new Date(String(d)).toLocaleDateString("en-KE", {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch {
    return String(d);
  }
};

interface LineItem {
  name?: string;
  accountName?: string;
  description?: string;
  amount?: number;
  balance?: number;
  total?: number;
  debit?: number;
  credit?: number;
  [key: string]: unknown;
}

function SectionTable({
  title,
  rows,
  totalLabel,
  totalValue,
  color = "#6D5DF6",
  amountKey = "amount",
}: {
  title: string;
  rows: LineItem[];
  totalLabel: string;
  totalValue: number;
  color?: string;
  amountKey?: "amount" | "balance" | "total";
}) {
  const label = (r: LineItem) => r.accountName ?? r.name ?? r.description ?? "—";
  const value = (r: LineItem): number =>
    Number(r[amountKey] ?? r.amount ?? r.balance ?? r.total ?? 0);

  return (
    <div className="mb-6">
      <div
        className="mb-2 inline-block rounded-md px-3 py-1 text-xs font-bold uppercase tracking-wider text-white"
        style={{ background: color }}
      >
        {title}
      </div>

      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-[#9CA3AF]">No entries for this period.</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-[#ECECF3] last:border-0 hover:bg-[#F8F9FC]">
                <td className="py-2.5 pl-2 pr-4 text-[#20243A]">{label(r)}</td>
                <td className="py-2.5 pr-2 text-right font-mono text-[#20243A]">{fmt(value(r))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div
        className="mt-1 flex items-center justify-between rounded-lg px-2 py-2.5 text-sm font-bold"
        style={{ background: color + "15" }}
      >
        <span style={{ color }}>{totalLabel}</span>
        <span style={{ color }} className="font-mono">{fmt(totalValue)}</span>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ProfitLossReport({ data }: { data: any }) {
  const revenue:  LineItem[] = data.revenue  ?? [];
  const expenses: LineItem[] = data.expenses ?? [];
  const totals               = data.totals   ?? {};

  const totalRevenue  = Number(totals.revenue  ?? totals.totalRevenue  ?? 0);
  const totalExpenses = Number(totals.expenses ?? totals.totalExpenses ?? 0);
  const netProfit     = Number(totals.netProfit ?? totals.net ?? totalRevenue - totalExpenses);
  const profitMargin  = Number(totals.profitMargin ?? 0);
  const isProfit      = netProfit >= 0;

  return (
    <div>
      <SectionTable title="Revenue" rows={revenue} totalLabel="Total Revenue" totalValue={totalRevenue} color="#16A34A" />
      <SectionTable title="Expenses" rows={expenses} totalLabel="Total Expenses" totalValue={totalExpenses} color="#EF4444" />
      <div className={`flex items-center justify-between rounded-xl border-2 px-4 py-4 text-base font-bold ${isProfit ? "border-[#16A34A]/40 bg-[#16A34A]/5 text-[#16A34A]" : "border-[#EF4444]/40 bg-[#EF4444]/5 text-[#EF4444]"}`}>
        <span>Net {isProfit ? "Profit" : "Loss"}</span>
        <div className="text-right">
          <div className="font-mono text-xl">{fmt(Math.abs(netProfit))}</div>
          <div className="text-xs font-normal opacity-70">Margin: {fmt(profitMargin)}%</div>
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BalanceSheetReport({ data }: { data: any }) {
  const assets:      LineItem[] = data.assets      ?? [];
  const liabilities: LineItem[] = data.liabilities ?? [];
  const equity:      LineItem[] = data.equity      ?? [];
  const totals                  = data.totals      ?? {};

  const totalAssets      = Number(totals.totalAssets      ?? totals.assets      ?? 0);
  const totalLiabilities = Number(totals.totalLiabilities ?? totals.liabilities ?? 0);
  const totalEquity      = Number(totals.totalEquity      ?? totals.equity      ?? 0);
  const balanced         = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;

  return (
    <div>
      <SectionTable title="Assets" rows={assets} totalLabel="Total Assets" totalValue={totalAssets} color="#6D5DF6" amountKey="balance" />
      <SectionTable title="Liabilities" rows={liabilities} totalLabel="Total Liabilities" totalValue={totalLiabilities} color="#EF4444" amountKey="balance" />
      <SectionTable title="Equity" rows={equity} totalLabel="Total Equity" totalValue={totalEquity} color="#16A34A" amountKey="balance" />
      <div className={`mt-2 flex items-center justify-between rounded-xl border-2 px-4 py-3 text-sm font-bold ${balanced ? "border-[#16A34A]/40 bg-[#16A34A]/5 text-[#16A34A]" : "border-[#EF4444]/40 bg-[#EF4444]/5 text-[#EF4444]"}`}>
        <span>{balanced ? "✓ Balance sheet is balanced" : "⚠ Balance sheet does not balance"}</span>
        <div className="text-right font-mono text-sm">
          <div>Assets: {fmt(totalAssets)}</div>
          <div>Liabilities + Equity: {fmt(totalLiabilities + totalEquity)}</div>
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CashFlowReport({ data }: { data: any }) {
  const operating: LineItem[] = data.operating ?? data.operatingActivities ?? [];
  const investing: LineItem[] = data.investing ?? data.investingActivities ?? [];
  const financing: LineItem[] = data.financing ?? data.financingActivities ?? [];
  const totals                = data.totals    ?? {};

  const opTotal  = Number(totals.operating ?? totals.operatingTotal ?? 0);
  const invTotal = Number(totals.investing ?? totals.investingTotal ?? 0);
  const finTotal = Number(totals.financing ?? totals.financingTotal ?? 0);
  const netFlow  = Number(totals.netCashFlow ?? totals.net ?? opTotal + invTotal + finTotal);

  return (
    <div>
      <SectionTable title="Operating Activities" rows={operating} totalLabel="Net Operating Cash Flow" totalValue={opTotal} color="#6D5DF6" />
      <SectionTable title="Investing Activities" rows={investing} totalLabel="Net Investing Cash Flow" totalValue={invTotal} color="#F59E0B" />
      <SectionTable title="Financing Activities" rows={financing} totalLabel="Net Financing Cash Flow" totalValue={finTotal} color="#06B6D4" />
      <div className={`flex items-center justify-between rounded-xl border-2 px-4 py-4 text-base font-bold ${netFlow >= 0 ? "border-[#16A34A]/40 bg-[#16A34A]/5 text-[#16A34A]" : "border-[#EF4444]/40 bg-[#EF4444]/5 text-[#EF4444]"}`}>
        <span>Net Cash Flow</span>
        <span className="font-mono text-xl">{fmt(netFlow)}</span>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TrialBalanceReport({ data }: { data: any }) {
  const accounts: LineItem[] = data.accounts ?? data.entries ?? data.trialBalance ?? [];
  const totals                = data.totals  ?? {};

  const totalDebits  = Number(totals.totalDebits  ?? totals.debits  ?? 0);
  const totalCredits = Number(totals.totalCredits ?? totals.credits ?? 0);
  const isBalanced   = Math.abs(totalDebits - totalCredits) < 0.01;

  const label = (r: LineItem) => r.accountName ?? r.name ?? r.description ?? "—";

  return (
    <div>
      {accounts.length === 0 ? (
        <p className="py-6 text-center text-sm text-[#9CA3AF]">No accounts for this period.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-[#ECECF3]">
              <th className="py-2.5 pl-2 text-left font-semibold text-[#666B84]">Account</th>
              <th className="py-2.5 pr-2 text-right font-semibold text-[#666B84]">Debit</th>
              <th className="py-2.5 pr-2 text-right font-semibold text-[#666B84]">Credit</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((r, i) => (
              <tr key={i} className="border-b border-[#ECECF3] last:border-0 hover:bg-[#F8F9FC]">
                <td className="py-2.5 pl-2 text-[#20243A]">{label(r)}</td>
                <td className="py-2.5 pr-2 text-right font-mono text-[#20243A]">{Number(r.debit ?? 0) > 0 ? fmt(r.debit) : "—"}</td>
                <td className="py-2.5 pr-2 text-right font-mono text-[#20243A]">{Number(r.credit ?? 0) > 0 ? fmt(r.credit) : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#20243A] font-bold">
              <td className="py-3 pl-2 text-[#20243A]">TOTALS</td>
              <td className="py-3 pr-2 text-right font-mono text-[#20243A]">{fmt(totalDebits)}</td>
              <td className="py-3 pr-2 text-right font-mono text-[#20243A]">{fmt(totalCredits)}</td>
            </tr>
          </tfoot>
        </table>
      )}
      <div className={`mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${isBalanced ? "border-[#16A34A]/30 bg-[#16A34A]/5 text-[#16A34A]" : "border-[#EF4444]/30 bg-[#EF4444]/5 text-[#EF4444]"}`}>
        {isBalanced ? "✓ Trial balance is in agreement" : "⚠ Trial balance is out of balance"}
        {!isBalanced && <span className="ml-auto font-mono">Difference: {fmt(Math.abs(totalDebits - totalCredits))}</span>}
      </div>
    </div>
  );
}

function ReportView({
  report, period, data, onBack,
}: {
  report: ReportMeta;
  period: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  onBack: () => void;
}) {
  const meta        = data.meta ?? {};
  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? period;

  return (
    <div className="rounded-2xl border border-[#ECECF3] bg-white">
      <div className="flex items-center gap-4 border-b border-[#ECECF3] p-6">
        <button
          onClick={onBack}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#F8F9FC] text-[#666B84] hover:bg-[#ECECF3] hover:text-[#20243A] transition"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-[#20243A]">{report.title}</h2>
          <p className="mt-0.5 text-sm text-[#666B84]">
            {periodLabel}
            {meta.startDate && meta.endDate ? ` · ${fmtDate(meta.startDate)} – ${fmtDate(meta.endDate)}` : ""}
          </p>
        </div>
      </div>
      <div className="p-6">
        {report.id === "income-statement" && <ProfitLossReport   data={data} />}
        {report.id === "balance-sheet"    && <BalanceSheetReport  data={data} />}
        {report.id === "cash-flow"        && <CashFlowReport      data={data} />}
        {report.id === "trial-balance"    && <TrialBalanceReport   data={data} />}
      </div>
    </div>
  );
}

export default function FinancialReports() {
  const [period,       setPeriod]       = useState("this-month");
  const [loading,      setLoading]      = useState<ReportId | null>(null);
  const [error,        setError]        = useState("");
  const [activeReport, setActiveReport] = useState<ReportMeta | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [reportData,   setReportData]   = useState<any>(null);

  const generate = async (report: ReportMeta) => {
    try {
      setLoading(report.id);
      setError("");
      setActiveReport(null);
      setReportData(null);

      const response = await authenticatedFetch(`${report.endpoint}?period=${period}`);

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error("Server returned an unexpected response — check that this endpoint exists.");
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to generate report");

      setActiveReport(report);
      setReportData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate report");
    } finally {
      setLoading(null);
    }
  };

  const handleBack = () => {
    setActiveReport(null);
    setReportData(null);
    setError("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#20243A]">Financial Reports</h1>
        <p className="mt-2 text-[#666B84]">Generate and export statutory and management reports.</p>
      </div>

      {!activeReport && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#ECECF3] bg-white p-4">
          <span className="text-sm font-medium text-[#20243A]">Period:</span>
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
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {activeReport && reportData ? (
        <ReportView report={activeReport} period={period} data={reportData} onBack={handleBack} />
      ) : (
        <div className="grid grid-cols-2 gap-5">
          {REPORTS.map((report) => {
            const isLoading = loading === report.id;
            return (
              <button
                key={report.id}
                onClick={() => generate(report)}
                disabled={!!loading}
                className="flex items-start gap-4 rounded-2xl border border-[#ECECF3] bg-white p-6 text-left transition hover:border-[#6D5DF6]/30 hover:shadow-md disabled:opacity-60"
              >
                <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${report.bg}`}>
                  <span className={report.color}>{report.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[#20243A]">{report.title}</h3>
                  <p className="mt-1 text-sm text-[#666B84]">{report.description}</p>
                </div>
                {isLoading
                  ? <RefreshCw size={18} className="flex-shrink-0 animate-spin text-[#6D5DF6]" />
                  : <ChevronRight size={18} className="flex-shrink-0 text-[#666B84]" />
                }
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}