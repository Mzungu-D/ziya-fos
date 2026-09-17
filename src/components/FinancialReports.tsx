import {
  ArrowRight,
  BarChart3,
  Banknote,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileBarChart2,
  FileSpreadsheet,
  Landmark,
  ReceiptText,
  Search,
  Scale,
  ShieldCheck,
  Star,
  WalletCards,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

type ReportId =
  | "profit-loss"
  | "balance-sheet"
  | "cash-flow"
  | "trial-balance"
  | "changes-in-equity"
  | "revenue-analysis"
  | "expense-analysis"
  | "budget-vs-actual"
  | "budget-variance"
  | "financial-kpis"
  | "financial-ratios"
  | "monthly-performance"
  | "receivables-aging"
  | "payables-aging"
  | "customer-balances"
  | "vendor-payables"
  | "cash-position"
  | "bank-summary"
  | "bank-reconciliation"
  | "mpesa"
  | "loan-portfolio"
  | "outstanding-loans"
  | "portfolio-performance"
  | "general-ledger"
  | "journal-report"
  | "audit-trail"
  | "custom";

type ReportCategory =
  | "Financial Statements"
  | "Management & Performance"
  | "Receivables & Payables"
  | "Cash & Banking"
  | "Loans & Portfolio"
  | "Accounting & Audit";

interface ReportDefinition {
  id: ReportId;
  title: string;
  description: string;
  category: ReportCategory;
  icon: typeof FileBarChart2;
  accent: string;
}

const PERIODS = [
  { value: "THIS_MONTH", label: "This Month" },
  { value: "LAST_MONTH", label: "Last Month" },
  { value: "THIS_QUARTER", label: "This Quarter" },
  { value: "LAST_QUARTER", label: "Last Quarter" },
  { value: "THIS_YEAR", label: "This Year" },
  { value: "LAST_YEAR", label: "Last Year" },
];

const reports: ReportDefinition[] = [
  {
    id: "profit-loss",
    title: "Profit & Loss",
    description: "Revenue, expenses and profitability for the selected period.",
    category: "Financial Statements",
    icon: BarChart3,
    accent: "bg-teal-50 text-teal-700",
  },
  {
    id: "balance-sheet",
    title: "Balance Sheet",
    description: "Assets, liabilities and equity at a point in time.",
    category: "Financial Statements",
    icon: Scale,
    accent: "bg-emerald-50 text-emerald-700",
  },
  {
    id: "cash-flow",
    title: "Cash Flow Statement",
    description: "Operating, investing and financing cash movements.",
    category: "Financial Statements",
    icon: WalletCards,
    accent: "bg-amber-50 text-amber-700",
  },
  {
    id: "trial-balance",
    title: "Trial Balance",
    description: "Verify account balances and debit-credit integrity.",
    category: "Financial Statements",
    icon: CheckCircle2,
    accent: "bg-rose-50 text-rose-700",
  },
  {
    id: "changes-in-equity",
    title: "Changes in Equity",
    description: "Track movements in shareholders' equity over time.",
    category: "Financial Statements",
    icon: Building2,
    accent: "bg-violet-50 text-violet-700",
  },

  {
    id: "revenue-analysis",
    title: "Revenue Analysis",
    description: "Understand revenue performance and underlying movements.",
    category: "Management & Performance",
    icon: BarChart3,
    accent: "bg-blue-50 text-blue-700",
  },
  {
    id: "expense-analysis",
    title: "Expense Analysis",
    description: "Analyse spending patterns and expense drivers.",
    category: "Management & Performance",
    icon: ReceiptText,
    accent: "bg-orange-50 text-orange-700",
  },
  {
    id: "budget-vs-actual",
    title: "Budget vs Actual",
    description: "Compare financial performance against approved budgets.",
    category: "Management & Performance",
    icon: FileSpreadsheet,
    accent: "bg-indigo-50 text-indigo-700",
  },
  {
    id: "budget-variance",
    title: "Budget Variance",
    description: "Identify material deviations from financial plans.",
    category: "Management & Performance",
    icon: BarChart3,
    accent: "bg-cyan-50 text-cyan-700",
  },
  {
    id: "financial-kpis",
    title: "Financial KPIs",
    description: "Monitor important financial performance indicators.",
    category: "Management & Performance",
    icon: FileBarChart2,
    accent: "bg-fuchsia-50 text-fuchsia-700",
  },
  {
    id: "financial-ratios",
    title: "Financial Ratios",
    description: "Review liquidity, profitability and financial health ratios.",
    category: "Management & Performance",
    icon: Scale,
    accent: "bg-purple-50 text-purple-700",
  },
  {
    id: "monthly-performance",
    title: "Monthly Performance",
    description: "Review financial performance across reporting periods.",
    category: "Management & Performance",
    icon: CalendarDays,
    accent: "bg-sky-50 text-sky-700",
  },

  {
    id: "receivables-aging",
    title: "Accounts Receivable Aging",
    description: "Review outstanding customer balances by aging period.",
    category: "Receivables & Payables",
    icon: Clock3,
    accent: "bg-green-50 text-green-700",
  },
  {
    id: "payables-aging",
    title: "Accounts Payable Aging",
    description: "Review outstanding supplier obligations by age.",
    category: "Receivables & Payables",
    icon: Clock3,
    accent: "bg-red-50 text-red-700",
  },
  {
    id: "customer-balances",
    title: "Customer Balances",
    description: "Review balances outstanding across customers.",
    category: "Receivables & Payables",
    icon: ReceiptText,
    accent: "bg-lime-50 text-lime-700",
  },
  {
    id: "vendor-payables",
    title: "Vendor Payables",
    description: "Review supplier obligations and outstanding balances.",
    category: "Receivables & Payables",
    icon: ReceiptText,
    accent: "bg-orange-50 text-orange-700",
  },

  {
    id: "cash-position",
    title: "Cash Position",
    description: "Understand current cash availability across accounts.",
    category: "Cash & Banking",
    icon: WalletCards,
    accent: "bg-teal-50 text-teal-700",
  },
  {
    id: "bank-summary",
    title: "Bank Account Summary",
    description: "Review balances and activity across bank accounts.",
    category: "Cash & Banking",
    icon: Landmark,
    accent: "bg-blue-50 text-blue-700",
  },
  {
    id: "bank-reconciliation",
    title: "Bank Reconciliation",
    description: "Review reconciliation status and differences.",
    category: "Cash & Banking",
    icon: CheckCircle2,
    accent: "bg-emerald-50 text-emerald-700",
  },
  {
    id: "mpesa",
    title: "M-Pesa Transactions",
    description: "Review M-Pesa transaction activity and movements.",
    category: "Cash & Banking",
    icon: Banknote,
    accent: "bg-green-50 text-green-700",
  },

  {
    id: "loan-portfolio",
    title: "Loan Portfolio",
    description: "Review portfolio composition and financial exposure.",
    category: "Loans & Portfolio",
    icon: WalletCards,
    accent: "bg-violet-50 text-violet-700",
  },
  {
    id: "outstanding-loans",
    title: "Outstanding Loans",
    description: "Review outstanding loan balances and exposure.",
    category: "Loans & Portfolio",
    icon: ReceiptText,
    accent: "bg-amber-50 text-amber-700",
  },
  {
    id: "portfolio-performance",
    title: "Portfolio Performance",
    description: "Analyse performance across the investment portfolio.",
    category: "Loans & Portfolio",
    icon: BarChart3,
    accent: "bg-indigo-50 text-indigo-700",
  },

  {
    id: "general-ledger",
    title: "General Ledger",
    description: "Review detailed accounting movements by account.",
    category: "Accounting & Audit",
    icon: BookOpen,
    accent: "bg-slate-100 text-slate-700",
  },
  {
    id: "journal-report",
    title: "Journal Report",
    description: "Review posted journal entries and accounting activity.",
    category: "Accounting & Audit",
    icon: FileBarChart2,
    accent: "bg-slate-100 text-slate-700",
  },
  {
    id: "audit-trail",
    title: "Audit Trail",
    description: "Review system activity and accounting audit history.",
    category: "Accounting & Audit",
    icon: ShieldCheck,
    accent: "bg-slate-100 text-slate-700",
  },
];

const categoryOrder: ReportCategory[] = [
  "Financial Statements",
  "Management & Performance",
  "Receivables & Payables",
  "Cash & Banking",
  "Loans & Portfolio",
  "Accounting & Audit",
];

const categoryDescriptions: Record<ReportCategory, string> = {
  "Financial Statements":
    "Core statements used to understand financial position and performance.",
  "Management & Performance":
    "Reports for planning, performance analysis and management decisions.",
  "Receivables & Payables":
    "Customer and supplier balances, ageing and obligations.",
  "Cash & Banking":
    "Cash availability, banking activity and reconciliation.",
  "Loans & Portfolio":
    "Loan exposure and portfolio performance reporting.",
  "Accounting & Audit":
    "Detailed accounting activity, journals and audit information.",
};

function formatDate(value: string): string {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export default function FinancialReports() {
  const navigate = useNavigate();

  const [period, setPeriod] = useState("THIS_MONTH");
  const [asOfDate, setAsOfDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<ReportId[]>([]);
  const [recent, setRecent] = useState<ReportId[]>([]);

  const filteredReports = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return reports;
    }

    return reports.filter((report) =>
      `${report.title} ${report.description} ${report.category}`
        .toLowerCase()
        .includes(query)
    );
  }, [search]);

  const recentReports = useMemo(
    () =>
      recent
        .map((id) => reports.find((report) => report.id === id))
        .filter((report): report is ReportDefinition => Boolean(report)),
    [recent]
  );

  const favoriteReports = useMemo(
    () =>
      favorites
        .map((id) => reports.find((report) => report.id === id))
        .filter((report): report is ReportDefinition => Boolean(report)),
    [favorites]
  );

  const openReport = (report: ReportDefinition) => {
    setRecent((current) => [
      report.id,
      ...current.filter((id) => id !== report.id),
    ].slice(0, 5));

    const params = new URLSearchParams();
    params.set("period", period);

    if (report.id === "balance-sheet") {
      params.set("asOfDate", asOfDate);
    }

    navigate(
      `/dashboard/financial-reports/${report.id}?${params.toString()}`
    );
  };

  const toggleFavorite = (id: ReportId) => {
    setFavorites((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  };

  const renderReportCard = (report: ReportDefinition) => {
    const Icon = report.icon;
    const isFavorite = favorites.includes(report.id);

    return (
      <div
        key={report.id}
        className="group min-w-0 rounded-2xl border border-[#E7E9F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition duration-200 hover:-translate-y-0.5 hover:border-[#C9CEDB] hover:shadow-[0_12px_30px_rgba(15,23,42,0.07)]"
      >
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${report.accent}`}
          >
            <Icon size={20} strokeWidth={1.9} />
          </div>

          <button
            type="button"
            aria-label={
              isFavorite
                ? `Remove ${report.title} from favorites`
                : `Add ${report.title} to favorites`
            }
            onClick={() => toggleFavorite(report.id)}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${
              isFavorite
                ? "bg-amber-50 text-amber-500"
                : "text-[#9AA0B5] hover:bg-[#F5F6FA] hover:text-[#20243A]"
            }`}
          >
            <Star
              size={17}
              fill={isFavorite ? "currentColor" : "none"}
            />
          </button>
        </div>

        <div className="mt-5 min-w-0">
          <h3 className="text-base font-semibold tracking-[-0.01em] text-[#20243A]">
            {report.title}
          </h3>

          <p className="mt-2 min-h-[42px] text-sm leading-6 text-[#70758D]">
            {report.description}
          </p>
        </div>

        <button
          type="button"
          onClick={() => openReport(report)}
          className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#20243A] transition group-hover:text-[#0D9488]"
        >
          View report
          <ArrowRight size={16} />
        </button>
      </div>
    );
  };

  return (
    <div className="min-w-0 space-y-7 pb-8">
      {/* Page header */}
      <section className="flex min-w-0 flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#E5E8EF] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#70758D]">
            <FileBarChart2 size={14} />
            Reporting Center
          </div>

          <h1 className="text-3xl font-bold tracking-[-0.03em] text-[#20243A] sm:text-4xl">
            Financial Reports
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#70758D] sm:text-base">
            Explore financial statements, management reports and accounting
            insights from your organization&apos;s live financial data.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-xs text-[#70758D]">
          <CheckCircle2 size={15} className="text-emerald-500" />
          Live financial reporting
        </div>
      </section>

      {/* Reporting controls */}
      <section className="rounded-2xl border border-[#E7E9F0] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex items-center gap-2">
              <CalendarDays size={16} className="text-[#70758D]" />
              <p className="text-sm font-semibold text-[#20243A]">
                Reporting period
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {PERIODS.map((item) => {
                const active = period === item.value;

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setPeriod(item.value)}
                    className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                      active
                        ? "bg-[#20243A] text-white shadow-sm"
                        : "bg-[#F5F6FA] text-[#666B84] hover:bg-[#ECEEF4] hover:text-[#20243A]"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="w-full shrink-0 xl:w-[220px]">
            <label
              htmlFor="reports-as-of-date"
              className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#7B8097]"
            >
              Balance Sheet as of
            </label>

            <input
              id="reports-as-of-date"
              type="date"
              value={asOfDate}
              onChange={(event) => setAsOfDate(event.target.value)}
              className="h-11 w-full rounded-xl border border-[#DDE1EA] bg-white px-3 text-sm font-medium text-[#20243A] outline-none transition focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-[#EEF0F4] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2 text-xs text-[#7B8097]">
            <CalendarDays size={14} />
            <span className="truncate">
              Reports opened now will use{" "}
              <span className="font-semibold text-[#20243A]">
                {PERIODS.find((item) => item.value === period)?.label}
              </span>
              {asOfDate ? ` | ${formatDate(asOfDate)}` : ""}
            </span>
          </div>

          <div className="relative w-full sm:w-[280px]">
            <Search
              size={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9AA0B5]"
            />

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search reports..."
              className="h-10 w-full rounded-xl border border-[#DDE1EA] bg-[#FAFBFC] pl-10 pr-9 text-sm text-[#20243A] outline-none transition placeholder:text-[#9AA0B5] focus:border-[#0D9488] focus:bg-white focus:ring-4 focus:ring-[#0D9488]/10"
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear report search"
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[#8A8FA5] hover:bg-[#EEF0F4] hover:text-[#20243A]"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Quick access */}
      {!search && (favoriteReports.length > 0 || recentReports.length > 0) && (
        <section className="grid min-w-0 gap-5 lg:grid-cols-2">
          {favoriteReports.length > 0 && (
            <div className="min-w-0 rounded-2xl border border-[#E7E9F0] bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <Star size={17} className="text-amber-500" fill="currentColor" />
                <h2 className="font-semibold text-[#20243A]">Favorites</h2>
              </div>

              <div className="space-y-2">
                {favoriteReports.slice(0, 4).map((report) => (
                  <button
                    key={report.id}
                    type="button"
                    onClick={() => openReport(report)}
                    className="flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition hover:border-[#E7E9F0] hover:bg-[#F8F9FC]"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <report.icon size={16} className="shrink-0 text-[#70758D]" />
                      <span className="truncate text-sm font-medium text-[#20243A]">
                        {report.title}
                      </span>
                    </span>
                    <ArrowRight size={15} className="shrink-0 text-[#9AA0B5]" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {recentReports.length > 0 && (
            <div className="min-w-0 rounded-2xl border border-[#E7E9F0] bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <Clock3 size={17} className="text-[#70758D]" />
                <h2 className="font-semibold text-[#20243A]">Recently viewed</h2>
              </div>

              <div className="space-y-2">
                {recentReports.slice(0, 4).map((report) => (
                  <button
                    key={report.id}
                    type="button"
                    onClick={() => openReport(report)}
                    className="flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition hover:border-[#E7E9F0] hover:bg-[#F8F9FC]"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <report.icon size={16} className="shrink-0 text-[#70758D]" />
                      <span className="truncate text-sm font-medium text-[#20243A]">
                        {report.title}
                      </span>
                    </span>
                    <ArrowRight size={15} className="shrink-0 text-[#9AA0B5]" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Search result count */}
      {search && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#20243A]">
              Search results
            </h2>
            <p className="mt-1 text-sm text-[#70758D]">
              {filteredReports.length} report
              {filteredReports.length === 1 ? "" : "s"} matching &quot;
              {search}&quot;
            </p>
          </div>
        </div>
      )}

      {/* Report library */}
      {filteredReports.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-[#D8DCE6] bg-white px-6 py-14 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F3F4F7] text-[#7B8097]">
            <Search size={21} />
          </div>

          <h2 className="mt-4 font-semibold text-[#20243A]">
            No reports found
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#70758D]">
            Try another report name or search by category such as cash,
            expense, balance, loan or audit.
          </p>

          <button
            type="button"
            onClick={() => setSearch("")}
            className="mt-5 rounded-xl bg-[#20243A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#111827]"
          >
            Clear search
          </button>
        </section>
      ) : (
        <div className="space-y-9">
          {categoryOrder.map((category) => {
            const categoryReports = filteredReports.filter(
              (report) => report.category === category
            );

            if (categoryReports.length === 0) {
              return null;
            }

            return (
              <section key={category} className="min-w-0">
                <div className="mb-4 flex min-w-0 flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold tracking-[-0.015em] text-[#20243A]">
                      {category}
                    </h2>
                    <p className="mt-1 text-sm text-[#7B8097]">
                      {categoryDescriptions[category]}
                    </p>
                  </div>

                  <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-[#9AA0B5]">
                    {categoryReports.length} reports
                  </span>
                </div>

                <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {categoryReports.map(renderReportCard)}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Future reporting capabilities */}
      {!search && (
        <section className="overflow-hidden rounded-2xl border border-[#DCE7E5] bg-gradient-to-br from-[#F0FBF9] via-white to-[#F7FAFA] p-5 sm:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0D9488]/10 text-[#0D9488]">
                <FileBarChart2 size={20} />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#20243A]">
                  Reporting workspace
                </p>

                <p className="mt-1 max-w-2xl text-sm leading-6 text-[#70758D]">
                  Ziya FOS is designed to evolve from standard statements into
                  interactive management reporting, comparisons, drill-downs
                  and custom financial analysis.
                </p>
              </div>
            </div>

            <span className="shrink-0 rounded-full border border-[#D8E8E5] bg-white px-3 py-1.5 text-xs font-semibold text-[#0D7F73]">
              Built for live financial data
            </span>
          </div>
        </section>
      )}
    </div>
  );
}
