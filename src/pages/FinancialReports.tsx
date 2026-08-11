import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

import {
  ArrowLeftRight,
  BadgeDollarSign,
  Banknote,
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  FileCheck2,
  HandCoins,
  History,
  Landmark,
  PiggyBank,
  ReceiptText,
  Scale,
  Search,
  SlidersHorizontal,
  Smartphone,
  Target,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";

/* =========================================================
   TYPES
========================================================= */

type Report = {
  title: string;
  description: string;
  icon: LucideIcon;
  reportType: string;
  keywords: string[];
};

type ReportSection = {
  title: string;
  description: string;
  reports: Report[];
};

/* =========================================================
   REPORT DEFINITIONS
========================================================= */

const reportSections: ReportSection[] = [
  {
    title: "Primary Financial Statements",
    description:
      "Core accounting statements for statutory, management and financial reporting.",
    reports: [
      {
        title: "Balance Sheet",
        description:
          "Assets, liabilities and equity position at the selected reporting date.",
        icon: Landmark,
        reportType: "balance-sheet",
        keywords: [
          "assets",
          "liabilities",
          "equity",
          "financial position",
        ],
      },
      {
        title: "Profit & Loss Statement",
        description:
          "Revenue, expenses and profitability for the selected reporting period.",
        icon: TrendingUp,
        reportType: "profit-loss",
        keywords: [
          "profit",
          "loss",
          "income",
          "revenue",
          "expenses",
        ],
      },
      {
        title: "Cash Flow Statement",
        description:
          "Operating, investing and financing cash movements.",
        icon: ArrowLeftRight,
        reportType: "cash-flow",
        keywords: [
          "cash",
          "operating",
          "investing",
          "financing",
        ],
      },
      {
        title: "Trial Balance",
        description:
          "Debit and credit balances across the complete Chart of Accounts.",
        icon: Scale,
        reportType: "trial-balance",
        keywords: [
          "trial balance",
          "debit",
          "credit",
          "accounts",
        ],
      },
      {
        title: "Changes in Equity",
        description:
          "Capital, retained earnings and other movements in shareholders' equity.",
        icon: WalletCards,
        reportType: "changes-in-equity",
        keywords: [
          "equity",
          "capital",
          "retained earnings",
        ],
      },
    ],
  },

  {
    title: "Receivables & Payables",
    description:
      "Monitor amounts owed to Ziya and financial obligations owed to suppliers.",
    reports: [
      {
        title: "Accounts Receivable Aging",
        description:
          "Outstanding receivables categorized by aging period and payment status.",
        icon: ReceiptText,
        reportType: "receivables-aging",
        keywords: [
          "receivable",
          "aging",
          "customer",
          "invoice",
        ],
      },
      {
        title: "Accounts Payable Aging",
        description:
          "Supplier obligations categorized by due date and aging period.",
        icon: Building2,
        reportType: "payables-aging",
        keywords: [
          "payable",
          "aging",
          "vendor",
          "supplier",
        ],
      },
      {
        title: "Customer Balances",
        description:
          "Customer balances, outstanding amounts and financial position.",
        icon: Users,
        reportType: "customer-balances",
        keywords: [
          "customer",
          "balance",
          "receivable",
        ],
      },
      {
        title: "Vendor Payables",
        description:
          "Outstanding vendor balances and supplier payment obligations.",
        icon: HandCoins,
        reportType: "vendor-payables",
        keywords: [
          "vendor",
          "supplier",
          "payables",
        ],
      },
    ],
  },

  {
    title: "Cash, Bank & M-Pesa",
    description:
      "Monitor organizational liquidity, banking activity and digital payments.",
    reports: [
      {
        title: "Cash Position",
        description:
          "Consolidated cash position across cash, bank and payment accounts.",
        icon: Banknote,
        reportType: "cash-position",
        keywords: [
          "cash",
          "liquidity",
          "bank",
        ],
      },
      {
        title: "Bank Account Summary",
        description:
          "Balances and transaction activity across registered bank accounts.",
        icon: Landmark,
        reportType: "bank-summary",
        keywords: [
          "bank",
          "account",
          "balance",
        ],
      },
      {
        title: "Bank Reconciliation",
        description:
          "Compare accounting records against bank transactions and balances.",
        icon: ArrowLeftRight,
        reportType: "bank-reconciliation",
        keywords: [
          "bank",
          "reconciliation",
          "transactions",
        ],
      },
      {
        title: "M-Pesa Transactions",
        description:
          "Analyze M-Pesa payments, disbursements, references and transaction status.",
        icon: Smartphone,
        reportType: "mpesa",
        keywords: [
          "mpesa",
          "m-pesa",
          "mobile",
          "payment",
          "disbursement",
        ],
      },
    ],
  },

  {
    title: "Loans & Portfolio",
    description:
      "Monitor financing exposure, outstanding balances, portfolio quality and investment performance.",
    reports: [
      {
        title: "Loan Portfolio Summary",
        description:
          "Portfolio overview of financing amounts, outstanding exposure and portfolio status.",
        icon: HandCoins,
        reportType: "loan-portfolio",
        keywords: [
          "loan",
          "financing",
          "portfolio",
          "exposure",
        ],
      },
      {
        title: "Outstanding Loans",
        description:
          "Current outstanding financing balances, due positions and exposure.",
        icon: BadgeDollarSign,
        reportType: "outstanding-loans",
        keywords: [
          "loan",
          "outstanding",
          "financing",
          "exposure",
        ],
      },
      {
        title: "Portfolio Performance",
        description:
          "Analyze portfolio exposure, performing balances, overdue exposure and portfolio risk.",
        icon: BriefcaseBusiness,
        reportType: "portfolio-performance",
        keywords: [
          "portfolio",
          "investment",
          "performance",
          "exposure",
          "risk",
        ],
      },
    ],
  },

  {
    title: "Revenue, Expenses & Budgets",
    description:
      "Analyze operational performance, spending and financial plans.",
    reports: [
      {
        title: "Revenue Analysis",
        description:
          "Revenue performance by account and reporting period.",
        icon: TrendingUp,
        reportType: "revenue-analysis",
        keywords: [
          "revenue",
          "income",
          "performance",
        ],
      },
      {
        title: "Expense Analysis",
        description:
          "Expenses by category, vendor and reporting period.",
        icon: ReceiptText,
        reportType: "expense-analysis",
        keywords: [
          "expense",
          "cost",
          "vendor",
        ],
      },
      {
        title: "Budget vs Actual",
        description:
          "Compare approved budgets against actual financial performance.",
        icon: Target,
        reportType: "budget-vs-actual",
        keywords: [
          "budget",
          "actual",
          "performance",
        ],
      },
      {
        title: "Budget Variance",
        description:
          "Analyze favorable and unfavorable deviations from approved budgets.",
        icon: PiggyBank,
        reportType: "budget-variance",
        keywords: [
          "budget",
          "variance",
        ],
      },
    ],
  },

  {
    title: "Management & Financial Analysis",
    description:
      "Management insights for financial planning and decision-making.",
    reports: [
      {
        title: "Financial KPI Summary",
        description:
          "Key financial indicators and management performance metrics.",
        icon: ChartNoAxesCombined,
        reportType: "financial-kpis",
        keywords: [
          "kpi",
          "performance",
          "metrics",
        ],
      },
      {
        title: "Financial Ratios",
        description:
          "Liquidity, profitability, leverage and efficiency ratios.",
        icon: BarChart3,
        reportType: "financial-ratios",
        keywords: [
          "ratio",
          "liquidity",
          "profitability",
          "leverage",
        ],
      },
      {
        title: "Monthly Performance",
        description:
          "Month-by-month financial performance and trend analysis.",
        icon: CalendarDays,
        reportType: "monthly-performance",
        keywords: [
          "monthly",
          "performance",
          "trend",
        ],
      },
      {
        title: "Custom Reports",
        description:
          "Create tailored reports using financial and operational information.",
        icon: SlidersHorizontal,
        reportType: "custom",
        keywords: [
          "custom",
          "report",
          "filter",
        ],
      },
    ],
  },

  {
    title: "Audit & Control",
    description:
      "Detailed financial records supporting governance, accountability and audit.",
    reports: [
      {
        title: "General Ledger Report",
        description:
          "Detailed accounting activity across ledger accounts.",
        icon: BookOpen,
        reportType: "general-ledger",
        keywords: [
          "ledger",
          "account",
          "transaction",
        ],
      },
      {
        title: "Journal Report",
        description:
          "Review journal entries, posting activity, reversals and adjustments.",
        icon: FileCheck2,
        reportType: "journal-report",
        keywords: [
          "journal",
          "entry",
          "posting",
          "reversal",
        ],
      },
      {
        title: "Audit Trail",
        description:
          "Review system actions and financial accountability history.",
        icon: History,
        reportType: "audit-trail",
        keywords: [
          "audit",
          "history",
          "control",
        ],
      },
    ],
  },
];

/* =========================================================
   QUICK ACCESS
========================================================= */

const quickReportTypes = [
  "balance-sheet",
  "profit-loss",
  "cash-flow",
  "trial-balance",
];

/* =========================================================
   COMPONENT
========================================================= */

export default function FinancialReports() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [period, setPeriod] =
    useState("THIS_MONTH");

  const allReports = useMemo(
    () =>
      reportSections.flatMap(
        (section) => section.reports
      ),
    []
  );

  const quickAccess = useMemo(
    () =>
      allReports.filter((report) =>
        quickReportTypes.includes(
          report.reportType
        )
      ),
    [allReports]
  );

  const filteredSections = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    if (!query) {
      return reportSections;
    }

    return reportSections
      .map((section) => ({
        ...section,

        reports: section.reports.filter(
          (report) => {
            const searchable = [
              report.title,
              report.description,
              section.title,
              section.description,
              ...report.keywords,
            ]
              .join(" ")
              .toLowerCase();

            return searchable.includes(
              query
            );
          }
        ),
      }))
      .filter(
        (section) =>
          section.reports.length > 0
      );
  }, [search]);

  /* =========================================================
     NAVIGATION
  ========================================================= */

  const openReport = (
    report: Report
  ) => {
    const params =
      new URLSearchParams();

    params.set("period", period);

    navigate(
      `/dashboard/financial-reports/${report.reportType}?${params.toString()}`
    );
  };

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div className="space-y-8 p-8 text-[#20243A]">
      {/* HEADER */}

      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-400">
          Reporting Center
        </p>

        <h1 className="mt-2 text-4xl font-bold">
          Financial Reports
        </h1>

        <p className="mt-3 max-w-3xl text-[#666B84]">
          Generate and analyze financial
          statements, operational reports,
          management information and audit
          reports across Ziya FOS.
        </p>
      </div>

      {/* CONTROLS */}

      <div className="rounded-2xl border border-[#ECECF3] bg-[#111827] p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search
              size={19}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#666B84]"
            />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search reports..."
              className="w-full rounded-xl border border-[#ECECF3] bg-slate-950 py-3 pl-12 pr-4 text-sm text-[#20243A] outline-none placeholder:text-[#666B84] focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <CalendarDays
              size={18}
              className="text-[#666B84]"
            />

            <select
              value={period}
              onChange={(event) =>
                setPeriod(
                  event.target.value
                )
              }
              className="rounded-xl border border-[#ECECF3] bg-slate-950 px-4 py-3 text-sm text-[#20243A] outline-none focus:border-blue-500"
            >
              <option value="THIS_MONTH">
                This Month
              </option>

              <option value="LAST_MONTH">
                Last Month
              </option>

              <option value="THIS_QUARTER">
                This Quarter
              </option>

              <option value="THIS_YEAR">
                This Financial Year
              </option>

              <option value="LAST_YEAR">
                Last Financial Year
              </option>

              <option value="ALL_TIME">
                All Time
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* QUICK ACCESS */}

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold">
            Quick Access
          </h2>

          <p className="mt-1 text-sm text-[#666B84]">
            Open the organization's primary
            financial statements.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {quickAccess.map(
            (report) => {
              const Icon =
                report.icon;

              return (
                <button
                  key={
                    report.reportType
                  }
                  type="button"
                  onClick={() =>
                    openReport(report)
                  }
                  className="group flex items-center justify-between rounded-2xl border border-[#ECECF3] bg-[#111827] p-5 text-left transition hover:-translate-y-0.5 hover:border-blue-500 hover:bg-white"
                >
                  <div className="flex items-center gap-4">
                    <div className="rounded-xl bg-blue-500/10 p-3">
                      <Icon
                        size={21}
                        className="text-blue-400"
                      />
                    </div>

                    <span className="font-semibold">
                      {report.title}
                    </span>
                  </div>

                  <ChevronRight
                    size={19}
                    className="text-slate-600 transition group-hover:translate-x-1 group-hover:text-blue-400"
                  />
                </button>
              );
            }
          )}
        </div>
      </section>

      {/* REPORT CATEGORIES */}

      <div className="space-y-10">
        {filteredSections.map(
          (section) => (
            <section
              key={section.title}
            >
              <div className="mb-5">
                <h2 className="text-2xl font-semibold">
                  {section.title}
                </h2>

                <p className="mt-1 text-sm text-[#666B84]">
                  {
                    section.description
                  }
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {section.reports.map(
                  (report) => {
                    const Icon =
                      report.icon;

                    return (
                      <button
                        key={
                          report.reportType
                        }
                        type="button"
                        onClick={() =>
                          openReport(
                            report
                          )
                        }
                        className="group rounded-2xl border border-[#ECECF3] bg-[#111827] p-6 text-left transition hover:-translate-y-0.5 hover:border-blue-500 hover:bg-white"
                      >
                        <div className="flex items-start justify-between">
                          <div className="rounded-xl bg-[#F8F9FC] p-3 transition group-hover:bg-blue-500/10">
                            <Icon
                              size={24}
                              className="text-[#666B84] transition group-hover:text-blue-400"
                            />
                          </div>

                          <ChevronRight
                            size={19}
                            className="text-slate-600 transition group-hover:translate-x-1 group-hover:text-blue-400"
                          />
                        </div>

                        <h3 className="mt-5 text-lg font-semibold">
                          {
                            report.title
                          }
                        </h3>

                        <p className="mt-2 min-h-12 text-sm leading-6 text-[#666B84]">
                          {
                            report.description
                          }
                        </p>

                        <div className="mt-5 text-sm font-medium text-blue-400">
                          Open report
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            </section>
          )
        )}
      </div>

      {/* NO RESULTS */}

      {filteredSections.length ===
        0 && (
        <div className="rounded-2xl border border-[#ECECF3] bg-[#111827] p-12 text-center">
          <Search
            size={32}
            className="mx-auto text-slate-600"
          />

          <h3 className="mt-4 text-lg font-semibold">
            No reports found
          </h3>

          <p className="mt-2 text-sm text-[#666B84]">
            Try another report name or
            financial category.
          </p>
        </div>
      )}

      {/* REPORTING NOTE */}

      <div className="rounded-2xl border border-[#ECECF3] bg-[#111827] p-6">
        <h2 className="text-lg font-semibold">
          Ziya Financial Reporting
        </h2>

        <p className="mt-2 max-w-4xl text-sm leading-6 text-[#666B84]">
          Financial reports are generated
          from Ziya FOS accounting and
          operational records. Official
          accounting statements should be
          based on posted journal entries
          to maintain consistency between
          the General Ledger, Trial Balance
          and financial statements.
        </p>
      </div>
    </div>
  );
}