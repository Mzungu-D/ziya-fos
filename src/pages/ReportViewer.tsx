import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  RefreshCw,
  XCircle,
} from "lucide-react";

/* =========================================================
   TYPES
========================================================= */

type ReportRow = Record<string, unknown>;
type ReportMeta = Record<string, unknown>;

interface ReportResponse {
  success?: boolean;
  message?: string;
  data?: unknown;
  report?: unknown;
  meta?: ReportMeta;
  totals?: Record<string, unknown>;
  [key: string]: unknown;
}

interface StatementRow {
  id?: string;
  code?: string;
  name?: string;
  description?: string;
  balance?: number;
  amount?: number;
  [key: string]: unknown;
}

interface CashFlowSection {
  inflows?: number;
  outflows?: number;
  netCashFlow?: number;
  net?: number;
  items?: StatementRow[];
  activities?: StatementRow[];
  transactions?: StatementRow[];
  [key: string]: unknown;
}

/* =========================================================
   REPORT CONFIGURATION
========================================================= */

const REPORT_NAMES: Record<string, string> = {
  "balance-sheet": "Balance Sheet",
  "profit-loss": "Profit & Loss Statement",
  "income-statement": "Profit & Loss Statement",
  "cash-flow": "Cash Flow Statement",
  "trial-balance": "Trial Balance",
  "changes-in-equity": "Statement of Changes in Equity",

  "receivables-aging": "Accounts Receivable Aging",
  "payables-aging": "Accounts Payable Aging",
  "customer-balances": "Customer Balances",
  "vendor-payables": "Vendor Payables",

  "cash-position": "Cash Position",
  "bank-summary": "Bank Account Summary",
  "bank-reconciliation": "Bank Reconciliation",
  mpesa: "M-Pesa Transactions",

  "loan-portfolio": "Loan Portfolio Summary",
  "outstanding-loans": "Outstanding Loans",
  "portfolio-performance": "Portfolio Performance",

  "revenue-analysis": "Revenue Analysis",
  "expense-analysis": "Expense Analysis",
  "budget-vs-actual": "Budget vs Actual",
  "budget-variance": "Budget Variance",

  "financial-kpis": "Financial KPI Summary",
  "financial-ratios": "Financial Ratios",
  "monthly-performance": "Monthly Performance",

  "general-ledger": "General Ledger Report",
  "journal-report": "Journal Report",
  "audit-trail": "Audit Trail Report",

  custom: "Custom Report",
};

const REPORT_ENDPOINTS: Record<string, string> = {
  "balance-sheet": "/api/balance-sheet",
  "profit-loss": "/api/income-statement",
  "income-statement": "/api/income-statement",
  "cash-flow": "/api/cash-flow",
  "trial-balance": "/api/trial-balance",

  "changes-in-equity":
    "/api/financial-reports/changes-in-equity",

  "receivables-aging":
    "/api/financial-reports/receivables-aging",

  "payables-aging":
    "/api/financial-reports/payables-aging",

  "customer-balances":
    "/api/financial-reports/customer-balances",

  "vendor-payables":
    "/api/financial-reports/vendor-payables",

  "cash-position":
    "/api/financial-reports/cash-position",

  "bank-summary":
    "/api/financial-reports/bank-summary",

  "bank-reconciliation":
    "/api/financial-reports/bank-reconciliation",

  mpesa:
    "/api/financial-reports/mpesa",

  "loan-portfolio":
    "/api/financial-reports/loan-portfolio",

  "outstanding-loans":
    "/api/financial-reports/outstanding-loans",

  "portfolio-performance":
    "/api/financial-reports/portfolio-performance",

  "revenue-analysis":
    "/api/financial-reports/revenue-analysis",

  "expense-analysis":
    "/api/financial-reports/expense-analysis",

  "budget-vs-actual":
    "/api/financial-reports/budget-vs-actual",

  "budget-variance":
    "/api/financial-reports/budget-variance",

  "financial-kpis":
    "/api/financial-reports/financial-kpis",

  "financial-ratios":
    "/api/financial-reports/financial-ratios",

  "monthly-performance":
    "/api/financial-reports/monthly-performance",

  "general-ledger":
    "/api/financial-reports/general-ledger",

  "journal-report":
    "/api/financial-reports/journal-report",

  "audit-trail":
    "/api/financial-reports/audit-trail",

  custom:
    "/api/financial-reports/custom",
};

/* =========================================================
   GENERAL HELPERS
========================================================= */

const isRecord = (
  value: unknown
): value is Record<string, unknown> => {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
};

const toNumber = (
  value: unknown,
  fallback = 0
): number => {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : fallback;
};

const humanize = (value: string): string => {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    )
    .trim();
};

const formatCurrency = (
  value: number
): string => {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatPercentage = (
  value: number
): string => {
  return `${new Intl.NumberFormat("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)}%`;
};

const formatValue = (
  key: string,
  value: unknown
): string => {
  if (value === null || value === undefined) {
    return "-";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    const lowerKey = key.toLowerCase();

    const percentage =
      lowerKey.includes("rate") ||
      lowerKey.includes("percentage") ||
      lowerKey.includes("margin");

    if (percentage) {
      return formatPercentage(value);
    }

    const money =
      lowerKey.includes("amount") ||
      lowerKey.includes("balance") ||
      lowerKey.includes("revenue") ||
      lowerKey.includes("expense") ||
      lowerKey.includes("profit") ||
      lowerKey.includes("asset") ||
      lowerKey.includes("liabil") ||
      lowerKey.includes("equity") ||
      lowerKey.includes("cash") ||
      lowerKey.includes("debit") ||
      lowerKey.includes("credit") ||
      lowerKey.includes("total") ||
      lowerKey.includes("outstanding") ||
      lowerKey.includes("valuation") ||
      lowerKey.includes("movement") ||
      lowerKey.includes("exposure") ||
      lowerKey.includes("inflow") ||
      lowerKey.includes("outflow");

    if (money) {
      return formatCurrency(value);
    }

    return new Intl.NumberFormat("en-KE", {
      maximumFractionDigits: 2,
    }).format(value);
  }

  if (typeof value === "string") {
    const lowerKey = key.toLowerCase();

    const looksLikeDate =
      lowerKey.includes("date") ||
      lowerKey.includes("createdat") ||
      lowerKey.includes("updatedat") ||
      lowerKey.includes("generatedat") ||
      lowerKey.includes("issuedat") ||
      lowerKey.includes("postedat") ||
      lowerKey.includes("approvedat") ||
      lowerKey.includes("lastsyncat");

    const parsedDate = Date.parse(value);

    if (
      looksLikeDate &&
      !Number.isNaN(parsedDate)
    ) {
      return new Intl.DateTimeFormat("en-KE", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      }).format(new Date(value));
    }

    return value;
  }

  if (Array.isArray(value)) {
    return `${value.length} record${
      value.length === 1 ? "" : "s"
    }`;
  }

  if (isRecord(value)) {
    return JSON.stringify(value);
  }

  return String(value);
};

const getToken = (): string | null => {
  return (
    localStorage.getItem("token") ??
    localStorage.getItem("accessToken")
  );
};

/* =========================================================
   PERIOD HELPERS
========================================================= */

const toDateInput = (
  date: Date
): string => {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const resolvePeriodDates = (
  period: string
): {
  startDate?: string;
  endDate?: string;
} => {
  const now = new Date();

  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  let start: Date | undefined;

  switch (period) {
    case "TODAY":
      start = new Date(end);
      break;

    case "THIS_WEEK": {
      start = new Date(end);

      const day = start.getDay();
      const difference =
        day === 0 ? 6 : day - 1;

      start.setDate(
        start.getDate() - difference
      );

      break;
    }

    case "THIS_MONTH":
      start = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      );
      break;

    case "THIS_QUARTER": {
      const quarterStartMonth =
        Math.floor(now.getMonth() / 3) * 3;

      start = new Date(
        now.getFullYear(),
        quarterStartMonth,
        1
      );

      break;
    }

    case "THIS_YEAR":
      start = new Date(
        now.getFullYear(),
        0,
        1
      );
      break;

    default:
      return {};
  }

  return {
    startDate: toDateInput(start),
    endDate: toDateInput(end),
  };
};

/* =========================================================
   GENERIC REPORT NORMALIZATION
========================================================= */

const getReportRows = (
  response: ReportResponse
): ReportRow[] => {
  const candidates: unknown[] = [
    response.data,
    response.report,
    response.trialBalance,
    response.entries,
    response.transactions,
    response.accounts,
    response.customers,
    response.vendors,
    response.loans,
    response.items,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(isRecord);
    }

    if (isRecord(candidate)) {
      const nestedArray = Object.values(
        candidate
      ).find(Array.isArray);

      if (Array.isArray(nestedArray)) {
        return nestedArray.filter(isRecord);
      }
    }
  }

  return [];
};

const getStatementRows = (
  value: unknown
): StatementRow[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord);
};

/* =========================================================
   DOWNLOAD HELPERS
========================================================= */

const downloadBlob = (
  content: BlobPart,
  filename: string,
  type: string
): void => {
  const blob = new Blob([content], {
    type,
  });

  const url = URL.createObjectURL(blob);

  const anchor =
    document.createElement("a");

  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(anchor);

  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
};

const escapeCsv = (
  value: string
): string => {
  return `"${value.replace(/"/g, '""')}"`;
};

/* =========================================================
   REUSABLE STATEMENT COMPONENTS
========================================================= */

function StatementSection({
  title,
  rows,
  valueKey,
  totalLabel,
  total,
}: {
  title: string;
  rows: StatementRow[];
  valueKey: "balance" | "amount";
  totalLabel: string;
  total: number;
}) {
  return (
    <section className="border-b border-slate-800 last:border-b-0 print:border-slate-300">
      <div className="bg-slate-900/70 px-6 py-4 print:bg-slate-100">
        <h3 className="font-semibold uppercase tracking-wide text-white print:text-black">
          {title}
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800 print:border-slate-300">
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Account
              </th>

              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Description
              </th>

              <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                Amount
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-6 py-6 text-center text-sm text-slate-500"
                >
                  No balances recorded
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={
                    typeof row.id === "string"
                      ? row.id
                      : `${row.code ?? "row"}-${index}`
                  }
                  className="border-b border-slate-800/70 last:border-b-0 print:border-slate-200"
                >
                  <td className="px-6 py-4 text-sm text-slate-300 print:text-black">
                    {row.code ?? "-"}
                  </td>

                  <td className="px-6 py-4 text-sm font-medium text-white print:text-black">
                    {row.name ??
                      row.description ??
                      "-"}
                  </td>

                  <td className="px-6 py-4 text-right text-sm font-medium text-white print:text-black">
                    {formatCurrency(
                      toNumber(row[valueKey])
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>

          <tfoot>
            <tr className="border-t border-slate-700 bg-slate-900/40 print:border-slate-400 print:bg-slate-50">
              <td
                colSpan={2}
                className="px-6 py-4 font-semibold text-white print:text-black"
              >
                {totalLabel}
              </td>

              <td className="px-6 py-4 text-right font-bold text-white print:text-black">
                {formatCurrency(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function SummaryLine({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-6 border-b border-slate-800 px-6 py-4 last:border-b-0 print:border-slate-300 ${
        strong
          ? "bg-slate-900/60 print:bg-slate-100"
          : ""
      }`}
    >
      <span
        className={
          strong
            ? "font-bold text-white print:text-black"
            : "text-slate-300 print:text-black"
        }
      >
        {label}
      </span>

      <span
        className={
          strong
            ? "font-bold text-white print:text-black"
            : "font-medium text-white print:text-black"
        }
      >
        {formatCurrency(value)}
      </span>
    </div>
  );
}

/* =========================================================
   BALANCE SHEET
========================================================= */

function BalanceSheetReport({
  data,
}: {
  data: ReportResponse;
}) {
  const assets =
    getStatementRows(data.assets);

  const liabilities =
    getStatementRows(data.liabilities);

  const equity =
    getStatementRows(data.equity);

  const totals = isRecord(data.totals)
    ? data.totals
    : {};

  const totalAssets =
    toNumber(totals.assets);

  const totalLiabilities =
    toNumber(totals.liabilities);

  const totalEquity =
    toNumber(totals.equity);

  const retainedEarnings =
    toNumber(
      totals.retainedEarnings,
      toNumber(data.retainedEarnings)
    );

  const totalEquityAndRetained =
    toNumber(
      totals.totalEquityAndRetainedEarnings,
      totalEquity + retainedEarnings
    );

  const liabilitiesAndEquity =
    toNumber(
      totals.liabilitiesAndEquity,
      totalLiabilities +
        totalEquityAndRetained
    );

  const difference =
    toNumber(
      totals.difference,
      Math.abs(
        totalAssets -
          liabilitiesAndEquity
      )
    );

  const balanced =
    typeof totals.balanced === "boolean"
      ? totals.balanced
      : difference < 0.01;

  return (
    <div>
      <StatementSection
        title="Assets"
        rows={assets}
        valueKey="balance"
        totalLabel="Total Assets"
        total={totalAssets}
      />

      <StatementSection
        title="Liabilities"
        rows={liabilities}
        valueKey="balance"
        totalLabel="Total Liabilities"
        total={totalLiabilities}
      />

      <StatementSection
        title="Equity"
        rows={equity}
        valueKey="balance"
        totalLabel="Shareholders' Equity"
        total={totalEquity}
      />

      <div className="border-b border-slate-800 print:border-slate-300">
        <SummaryLine
          label="Retained Earnings"
          value={retainedEarnings}
        />

        <SummaryLine
          label="Total Equity"
          value={
            totalEquityAndRetained
          }
          strong
        />

        <SummaryLine
          label="Total Liabilities & Equity"
          value={liabilitiesAndEquity}
          strong
        />
      </div>

      <div
        className={`m-6 flex items-center justify-between rounded-xl border p-4 ${
          balanced
            ? "border-emerald-500/30 bg-emerald-500/10"
            : "border-red-500/30 bg-red-500/10"
        } print:border-slate-400 print:bg-white`}
      >
        <div className="flex items-center gap-3">
          {balanced ? (
            <CheckCircle2 className="text-emerald-400" />
          ) : (
            <XCircle className="text-red-400" />
          )}

          <div>
            <p className="font-semibold text-white print:text-black">
              {balanced
                ? "Balance Sheet Balanced"
                : "Balance Sheet Out of Balance"}
            </p>

            <p className="text-sm text-slate-400 print:text-slate-600">
              Assets = Liabilities + Equity
            </p>
          </div>
        </div>

        <span className="font-semibold text-white print:text-black">
          Difference:{" "}
          {formatCurrency(difference)}
        </span>
      </div>
    </div>
  );
}

/* =========================================================
   PROFIT & LOSS
========================================================= */

function IncomeStatementReport({
  data,
}: {
  data: ReportResponse;
}) {
  const revenue =
    getStatementRows(data.revenue);

  const expenses =
    getStatementRows(data.expenses);

  const totals = isRecord(data.totals)
    ? data.totals
    : {};

  const totalRevenue =
    toNumber(totals.revenue);

  const totalExpenses =
    toNumber(totals.expenses);

  const netProfit =
    toNumber(
      totals.netProfit,
      totalRevenue - totalExpenses
    );

  const profitMargin =
    toNumber(totals.profitMargin);

  return (
    <div>
      <StatementSection
        title="Revenue"
        rows={revenue}
        valueKey="amount"
        totalLabel="Total Revenue"
        total={totalRevenue}
      />

      <StatementSection
        title="Expenses"
        rows={expenses}
        valueKey="amount"
        totalLabel="Total Expenses"
        total={totalExpenses}
      />

      <div className="p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-5 print:border-slate-300 print:bg-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Net Profit / Loss
            </p>

            <p
              className={`mt-2 text-2xl font-bold ${
                netProfit >= 0
                  ? "text-emerald-400"
                  : "text-red-400"
              } print:text-black`}
            >
              {formatCurrency(netProfit)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-5 print:border-slate-300 print:bg-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Profit Margin
            </p>

            <p className="mt-2 text-2xl font-bold text-white print:text-black">
              {formatPercentage(
                profitMargin
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   CASH FLOW
========================================================= */

function getCashFlowSection(
  data: ReportResponse,
  key: string
): CashFlowSection {
  const value = data[key];

  return isRecord(value)
    ? (value as CashFlowSection)
    : {};
}

function getCashFlowRows(
  section: CashFlowSection
): StatementRow[] {
  const candidates = [
    section.items,
    section.activities,
    section.transactions,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(isRecord);
    }
  }

  return [];
}

function CashFlowActivity({
  title,
  section,
}: {
  title: string;
  section: CashFlowSection;
}) {
  const rows =
    getCashFlowRows(section);

  const inflows =
    toNumber(section.inflows);

  const outflows =
    toNumber(section.outflows);

  const net =
    toNumber(
      section.netCashFlow,
      toNumber(
        section.net,
        inflows - outflows
      )
    );

  return (
    <section className="border-b border-slate-800 print:border-slate-300">
      <div className="bg-slate-900/70 px-6 py-4 print:bg-slate-100">
        <h3 className="font-semibold uppercase tracking-wide text-white print:text-black">
          {title}
        </h3>
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <tbody>
              {rows.map(
                (row, index) => {
                  const label =
                    row.name ??
                    row.description ??
                    row.code ??
                    `Movement ${
                      index + 1
                    }`;

                  const amount =
                    toNumber(
                      row.amount,
                      toNumber(
                        row.balance
                      )
                    );

                  return (
                    <tr
                      key={
                        typeof row.id ===
                        "string"
                          ? row.id
                          : index
                      }
                      className="border-b border-slate-800/60 print:border-slate-200"
                    >
                      <td className="px-6 py-3 text-sm text-slate-300 print:text-black">
                        {String(label)}
                      </td>

                      <td className="px-6 py-3 text-right text-sm text-white print:text-black">
                        {formatCurrency(
                          amount
                        )}
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      )}

      <div>
        {(inflows !== 0 ||
          outflows !== 0) && (
          <>
            <SummaryLine
              label="Cash Inflows"
              value={inflows}
            />

            <SummaryLine
              label="Cash Outflows"
              value={outflows}
            />
          </>
        )}

        <SummaryLine
          label={`Net Cash from ${title}`}
          value={net}
          strong
        />
      </div>
    </section>
  );
}

function CashFlowReport({
  data,
}: {
  data: ReportResponse;
}) {
  const operating =
    getCashFlowSection(
      data,
      "operatingActivities"
    );

  const investing =
    getCashFlowSection(
      data,
      "investingActivities"
    );

  const financing =
    getCashFlowSection(
      data,
      "financingActivities"
    );

  const totals = isRecord(data.totals)
    ? data.totals
    : {};

  const operatingNet =
    toNumber(
      operating.netCashFlow,
      toNumber(operating.net)
    );

  const investingNet =
    toNumber(
      investing.netCashFlow,
      toNumber(investing.net)
    );

  const financingNet =
    toNumber(
      financing.netCashFlow,
      toNumber(financing.net)
    );

  const calculatedMovement =
    operatingNet +
    investingNet +
    financingNet;

  const openingCash =
    toNumber(
      totals.openingCash,
      toNumber(
        data.openingCash,
        toNumber(
          data.openingCashBalance
        )
      )
    );

  const netCashMovement =
    toNumber(
      totals.netCashFlow,
      toNumber(
        totals.netCashMovement,
        toNumber(
          data.netCashFlow,
          toNumber(
            data.netCashMovement,
            calculatedMovement
          )
        )
      )
    );

  const closingCash =
    toNumber(
      totals.closingCash,
      toNumber(
        data.closingCash,
        toNumber(
          data.closingCashBalance,
          openingCash +
            netCashMovement
        )
      )
    );

  const reconciliation =
    data.reconciliation;

  let reconciled: boolean | undefined;

  let difference = 0;

  if (isRecord(reconciliation)) {
    if (
      typeof reconciliation.reconciled ===
      "boolean"
    ) {
      reconciled =
        reconciliation.reconciled;
    }

    difference =
      toNumber(
        reconciliation.difference
      );
  }

  return (
    <div>
      <CashFlowActivity
        title="Operating Activities"
        section={operating}
      />

      <CashFlowActivity
        title="Investing Activities"
        section={investing}
      />

      <CashFlowActivity
        title="Financing Activities"
        section={financing}
      />

      <div className="bg-slate-900/30 print:bg-white">
        <SummaryLine
          label="Opening Cash Balance"
          value={openingCash}
        />

        <SummaryLine
          label="Net Increase / Decrease in Cash"
          value={netCashMovement}
        />

        <SummaryLine
          label="Closing Cash Balance"
          value={closingCash}
          strong
        />
      </div>

      {reconciled !== undefined && (
        <div
          className={`m-6 flex items-center justify-between rounded-xl border p-4 ${
            reconciled
              ? "border-emerald-500/30 bg-emerald-500/10"
              : "border-red-500/30 bg-red-500/10"
          } print:border-slate-400 print:bg-white`}
        >
          <div className="flex items-center gap-3">
            {reconciled ? (
              <CheckCircle2 className="text-emerald-400" />
            ) : (
              <XCircle className="text-red-400" />
            )}

            <span className="font-semibold text-white print:text-black">
              {reconciled
                ? "Cash Flow Reconciled"
                : "Cash Flow Reconciliation Difference"}
            </span>
          </div>

          <span className="font-semibold text-white print:text-black">
            {formatCurrency(difference)}
          </span>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   GENERIC REPORT TABLE
========================================================= */

function GenericReportTable({
  rows,
  columns,
}: {
  rows: ReportRow[];
  columns: string[];
}) {
  if (rows.length === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center p-10 text-center">
        <div>
          <FileText
            size={40}
            className="mx-auto text-slate-600"
          />

          <p className="mt-4 font-medium text-white print:text-black">
            No report records found
          </p>

          <p className="mt-2 text-sm text-slate-400">
            There are currently no records
            available for this report and
            reporting period.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-900/80 print:bg-slate-100">
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                className="whitespace-nowrap px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 print:text-black"
              >
                {humanize(column)}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map(
            (row, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-t border-slate-800 transition hover:bg-slate-900/50 print:border-slate-300"
              >
                {columns.map(
                  (column) => (
                    <td
                      key={column}
                      className="whitespace-nowrap px-5 py-4 text-sm text-slate-200 print:text-black"
                    >
                      {formatValue(
                        column,
                        row[column]
                      )}
                    </td>
                  )
                )}
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function ReportViewer() {
  const navigate = useNavigate();

  const { reportType } =
    useParams<{
      reportType: string;
    }>();

  const [searchParams] =
    useSearchParams();

  const [reportData, setReportData] =
    useState<ReportResponse | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const currentReportType =
    reportType ?? "";

  const reportName =
    REPORT_NAMES[currentReportType] ??
    "Financial Report";

  const endpoint =
    REPORT_ENDPOINTS[currentReportType];

  const period =
    searchParams.get("period") ??
    "THIS_MONTH";

  const explicitStartDate =
    searchParams.get("startDate");

  const explicitEndDate =
    searchParams.get("endDate");

  const explicitAsOfDate =
    searchParams.get("asOfDate");

  const resolvedDates = useMemo(
    () =>
      resolvePeriodDates(period),
    [period]
  );

  const startDate =
    explicitStartDate ??
    resolvedDates.startDate;

  const endDate =
    explicitEndDate ??
    resolvedDates.endDate;

  /* =========================================================
     FETCH
  ========================================================= */

  const fetchReport =
    useCallback(async () => {
      if (!endpoint) {
        setError(
          "This financial report has not been configured."
        );

        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const query =
          new URLSearchParams();

        if (
          currentReportType ===
          "balance-sheet"
        ) {
          const asOfDate =
            explicitAsOfDate ??
            endDate;

          if (asOfDate) {
            query.set(
              "asOfDate",
              asOfDate
            );
          }
        } else {
          if (startDate) {
            query.set(
              "startDate",
              startDate
            );
          }

          if (endDate) {
            query.set(
              "endDate",
              endDate
            );
          }
        }

        query.set(
          "period",
          period
        );

        const token = getToken();

        const queryString =
          query.toString();

        const requestUrl =
          queryString
            ? `${endpoint}?${queryString}`
            : endpoint;

        const response =
          await fetch(
            requestUrl,
            {
              method: "GET",

              headers: {
                Accept:
                  "application/json",

                ...(token
                  ? {
                      Authorization:
                        `Bearer ${token}`,
                    }
                  : {}),
              },
            }
          );

        const contentType =
          response.headers.get(
            "content-type"
          );

        if (
          !contentType?.includes(
            "application/json"
          )
        ) {
          throw new Error(
            "The server returned an invalid report response."
          );
        }

        const result: unknown =
          await response.json();

        if (!isRecord(result)) {
          throw new Error(
            "Invalid report data received."
          );
        }

        const parsed =
          result as ReportResponse;

        if (
          !response.ok ||
          parsed.success === false
        ) {
          throw new Error(
            typeof parsed.message ===
              "string"
              ? parsed.message
              : "Failed to generate financial report."
          );
        }

        setReportData(parsed);
      } catch (
        fetchError: unknown
      ) {
        console.error(
          "REPORT FETCH ERROR:",
          fetchError
        );

        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to generate financial report."
        );
      } finally {
        setLoading(false);
      }
    }, [
      endpoint,
      currentReportType,
      period,
      startDate,
      endDate,
      explicitAsOfDate,
    ]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  /* =========================================================
     GENERIC DATA
  ========================================================= */

  const rows =
    useMemo<ReportRow[]>(() => {
      if (!reportData) {
        return [];
      }

      return getReportRows(
        reportData
      );
    }, [reportData]);

  const columns =
    useMemo<string[]>(() => {
      if (rows.length === 0) {
        return [];
      }

      const columnSet =
        new Set<string>();

      rows.forEach((row) => {
        Object.keys(row).forEach(
          (key) => {
            if (
              key !== "id" &&
              !key.endsWith("Id")
            ) {
              columnSet.add(key);
            }
          }
        );
      });

      return Array.from(
        columnSet
      );
    }, [rows]);

  const totals =
    useMemo<
      Record<string, unknown>
    >(() => {
      if (
        reportData &&
        isRecord(
          reportData.totals
        )
      ) {
        return reportData.totals;
      }

      return {};
    }, [reportData]);

  const meta =
    useMemo<
      Record<string, unknown>
    >(() => {
      if (
        reportData &&
        isRecord(reportData.meta)
      ) {
        return reportData.meta;
      }

      return {};
    }, [reportData]);

  const isCoreStatement =
    currentReportType ===
      "balance-sheet" ||
    currentReportType ===
      "profit-loss" ||
    currentReportType ===
      "income-statement" ||
    currentReportType ===
      "cash-flow";

  /* =========================================================
     CSV EXPORT
  ========================================================= */

  const exportCsv = (): void => {
    const csvRows: string[] = [];

    if (
      currentReportType ===
        "balance-sheet" &&
      reportData
    ) {
      const sections = [
        {
          title: "ASSETS",
          rows: getStatementRows(
            reportData.assets
          ),
          key: "balance",
        },
        {
          title: "LIABILITIES",
          rows: getStatementRows(
            reportData.liabilities
          ),
          key: "balance",
        },
        {
          title: "EQUITY",
          rows: getStatementRows(
            reportData.equity
          ),
          key: "balance",
        },
      ];

      sections.forEach(
        (section) => {
          csvRows.push(
            escapeCsv(
              section.title
            )
          );

          csvRows.push(
            [
              escapeCsv(
                "Account Code"
              ),
              escapeCsv(
                "Account Name"
              ),
              escapeCsv(
                "Amount"
              ),
            ].join(",")
          );

          section.rows.forEach(
            (row) => {
              csvRows.push(
                [
                  escapeCsv(
                    String(
                      row.code ??
                        ""
                    )
                  ),
                  escapeCsv(
                    String(
                      row.name ??
                        ""
                    )
                  ),
                  escapeCsv(
                    String(
                      toNumber(
                        row[
                          section.key
                        ]
                      )
                    )
                  ),
                ].join(",")
              );
            }
          );

          csvRows.push("");
        }
      );
    } else if (
      (currentReportType ===
        "profit-loss" ||
        currentReportType ===
          "income-statement") &&
      reportData
    ) {
      const sections = [
        {
          title: "REVENUE",
          rows: getStatementRows(
            reportData.revenue
          ),
        },
        {
          title: "EXPENSES",
          rows: getStatementRows(
            reportData.expenses
          ),
        },
      ];

      sections.forEach(
        (section) => {
          csvRows.push(
            escapeCsv(
              section.title
            )
          );

          csvRows.push(
            [
              escapeCsv(
                "Account Code"
              ),
              escapeCsv(
                "Account Name"
              ),
              escapeCsv(
                "Amount"
              ),
            ].join(",")
          );

          section.rows.forEach(
            (row) => {
              csvRows.push(
                [
                  escapeCsv(
                    String(
                      row.code ??
                        ""
                    )
                  ),
                  escapeCsv(
                    String(
                      row.name ??
                        ""
                    )
                  ),
                  escapeCsv(
                    String(
                      toNumber(
                        row.amount
                      )
                    )
                  ),
                ].join(",")
              );
            }
          );

          csvRows.push("");
        }
      );
    } else {
      if (rows.length === 0) {
        return;
      }

      csvRows.push(
        columns
          .map((column) =>
            escapeCsv(
              humanize(column)
            )
          )
          .join(",")
      );

      rows.forEach((row) => {
        csvRows.push(
          columns
            .map((column) =>
              escapeCsv(
                formatValue(
                  column,
                  row[column]
                )
              )
            )
            .join(",")
        );
      });
    }

    if (csvRows.length === 0) {
      return;
    }

    const filename =
      `${
        currentReportType ||
        "financial-report"
      }-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

    downloadBlob(
      csvRows.join("\n"),
      filename,
      "text/csv;charset=utf-8;"
    );
  };

  const exportPdf = (): void => {
    window.print();
  };

  const printReport = (): void => {
    window.print();
  };

  /* =========================================================
     REPORT CONTENT
  ========================================================= */

  const renderReportContent =
    () => {
      if (!reportData) {
        return null;
      }

      if (
        currentReportType ===
        "balance-sheet"
      ) {
        return (
          <BalanceSheetReport
            data={reportData}
          />
        );
      }

      if (
        currentReportType ===
          "profit-loss" ||
        currentReportType ===
          "income-statement"
      ) {
        return (
          <IncomeStatementReport
            data={reportData}
          />
        );
      }

      if (
        currentReportType ===
        "cash-flow"
      ) {
        return (
          <CashFlowReport
            data={reportData}
          />
        );
      }

      return (
        <GenericReportTable
          rows={rows}
          columns={columns}
        />
      );
    };

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div className="space-y-6 print:bg-white print:text-black">
      {/* HEADER */}

      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between print:block">
        <div>
          <button
            type="button"
            onClick={() =>
              navigate(
                "/dashboard/financial-reports"
              )
            }
            className="mb-4 flex items-center gap-2 text-sm text-slate-400 transition hover:text-white print:hidden"
          >
            <ArrowLeft size={17} />

            Financial Reports
          </button>

          <h1 className="text-3xl font-bold text-white print:text-black">
            {reportName}
          </h1>

          <p className="mt-2 text-slate-400 print:text-slate-600">
            Ziya Financial Operating System
          </p>
        </div>

        <div className="flex flex-wrap gap-3 print:hidden">
          <button
            type="button"
            onClick={() =>
              void fetchReport()
            }
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-[#111827] px-4 py-2 text-sm text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />

            Refresh
          </button>

          <button
            type="button"
            onClick={exportPdf}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-[#111827] px-4 py-2 text-sm text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            <FileText size={17} />
            PDF
          </button>

          <button
            type="button"
            onClick={exportCsv}
            disabled={
              loading ||
              !reportData
            }
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-[#111827] px-4 py-2 text-sm text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            <FileSpreadsheet
              size={17}
            />
            CSV
          </button>

          <button
            type="button"
            onClick={printReport}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            <Printer size={17} />
            Print
          </button>
        </div>
      </div>

      {/* REPORT INFORMATION */}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-[#111827] p-4 print:border-slate-300 print:bg-white">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Report
          </p>

          <p className="mt-2 font-semibold text-white print:text-black">
            {reportName}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#111827] p-4 print:border-slate-300 print:bg-white">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Reporting Period
          </p>

          <p className="mt-2 font-semibold text-white print:text-black">
            {period
              .replaceAll("_", " ")
              .toLowerCase()
              .replace(
                /\b\w/g,
                (letter) =>
                  letter.toUpperCase()
              )}
          </p>

          {startDate &&
            endDate && (
              <p className="mt-1 text-xs text-slate-500">
                {startDate} —{" "}
                {endDate}
              </p>
            )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#111827] p-4 print:border-slate-300 print:bg-white">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Currency
          </p>

          <p className="mt-2 font-semibold text-white print:text-black">
            KES
          </p>
        </div>
      </div>

      {/* REPORT */}

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#111827] print:border-slate-300 print:bg-white">
        <div className="border-b border-slate-800 p-6 print:border-slate-300">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white print:text-black">
                {reportName}
              </h2>

              <p className="mt-1 text-sm text-slate-400 print:text-slate-600">
                Generated from Ziya FOS
                posted financial records.
              </p>
            </div>

            <Download
              size={20}
              className="text-slate-500 print:hidden"
            />
          </div>
        </div>

        {loading && (
          <div className="flex min-h-[350px] items-center justify-center">
            <div className="text-center">
              <RefreshCw
                size={30}
                className="mx-auto animate-spin text-blue-500"
              />

              <p className="mt-4 text-slate-400">
                Generating report...
              </p>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="p-8">
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-5">
              <p className="font-semibold text-red-400">
                Unable to generate
                report
              </p>

              <p className="mt-2 text-sm text-slate-300">
                {error}
              </p>

              <button
                type="button"
                onClick={() =>
                  void fetchReport()
                }
                className="mt-4 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {!loading &&
          !error &&
          reportData &&
          renderReportContent()}
      </div>

      {/* GENERIC TOTALS */}

      {!loading &&
        !error &&
        !isCoreStatement &&
        Object.keys(totals).length >
          0 && (
          <div className="rounded-2xl border border-slate-800 bg-[#111827] p-6 print:border-slate-300 print:bg-white">
            <h3 className="mb-5 text-lg font-semibold text-white print:text-black">
              Report Summary
            </h3>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(
                totals
              ).map(
                ([key, value]) => (
                  <div
                    key={key}
                    className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 print:border-slate-300 print:bg-white"
                  >
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      {humanize(key)}
                    </p>

                    <p className="mt-2 text-lg font-semibold text-white print:text-black">
                      {formatValue(
                        key,
                        value
                      )}
                    </p>
                  </div>
                )
              )}
            </div>
          </div>
        )}

      {/* METADATA */}

      {!loading &&
        !error &&
        Object.keys(meta).length >
          0 && (
          <div className="rounded-xl border border-slate-800 bg-[#111827] px-5 py-4 print:border-slate-300 print:bg-white">
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs text-slate-500">
              {Object.entries(
                meta
              ).map(
                ([key, value]) => (
                  <span key={key}>
                    <strong className="text-slate-400 print:text-slate-700">
                      {humanize(key)}:
                    </strong>{" "}
                    {formatValue(
                      key,
                      value
                    )}
                  </span>
                )
              )}
            </div>
          </div>
        )}

      {/* PRINT FOOTER */}

      <div className="hidden border-t border-slate-300 pt-4 text-xs text-slate-500 print:block">
        <div className="flex justify-between">
          <span>
            Ziya Financial Operating
            System
          </span>

          <span>
            Generated{" "}
            {new Date().toLocaleString(
              "en-KE"
            )}
          </span>
        </div>
      </div>
    </div>
  );
}