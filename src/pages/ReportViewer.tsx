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

import {
  exportReportPdf,
  safePdfFilename,
} from "../lib/reportExport";
import * as XLSX from "xlsx";
import { authenticatedFetch, getAuthToken } from "../lib/auth";

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

  "changes-in-equity": "/api/financial-reports/changes-in-equity",

  "receivables-aging": "/api/financial-reports/receivables-aging",
  "payables-aging": "/api/financial-reports/payables-aging",
  "customer-balances": "/api/financial-reports/customer-balances",
  "vendor-payables": "/api/financial-reports/vendor-payables",

  "cash-position": "/api/financial-reports/cash-position",
  "bank-summary": "/api/financial-reports/bank-summary",
  "bank-reconciliation": "/api/financial-reports/bank-reconciliation",
  mpesa: "/api/financial-reports/mpesa",

  "loan-portfolio": "/api/financial-reports/loan-portfolio",
  "outstanding-loans": "/api/financial-reports/outstanding-loans",
  "portfolio-performance": "/api/financial-reports/portfolio-performance",

  "revenue-analysis": "/api/financial-reports/revenue-analysis",
  "expense-analysis": "/api/financial-reports/expense-analysis",
  "budget-vs-actual": "/api/financial-reports/budget-vs-actual",
  "budget-variance": "/api/financial-reports/budget-variance",

  "financial-kpis": "/api/financial-reports/financial-kpis",
  "financial-ratios": "/api/financial-reports/financial-ratios",
  "monthly-performance": "/api/financial-reports/monthly-performance",

  "general-ledger": "/api/financial-reports/general-ledger",
  "journal-report": "/api/financial-reports/journal-report",
  "audit-trail": "/api/financial-reports/audit-trail",

  custom: "/api/financial-reports/custom",
};

/* =========================================================
   GENERAL HELPERS
========================================================= */

const isRecord = (
  value: unknown
): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value);

const toNumber = (
  value: unknown,
  fallback = 0
): number =>
  typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;

const humanize = (value: string): string =>
  value
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    )
    .trim();

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatPercentage = (value: number): string =>
  `${new Intl.NumberFormat("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)}%`;

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

    if (looksLikeDate && !Number.isNaN(parsedDate)) {
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

const getToken = getAuthToken;

const safeFilename = (value: string): string =>
  value
    .replace(/&/g, "and")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const getFileDate = (): string =>
  new Date().toISOString().slice(0, 10);

/* =========================================================
   PERIOD HELPERS
========================================================= */

const toDateInput = (date: Date): string => {
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
      const difference = day === 0 ? 6 : day - 1;

      start.setDate(start.getDate() - difference);
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
   REPORT NORMALIZATION
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
   STATEMENT COMPONENTS
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
    <section className="border-b border-[#ECECF3] last:border-b-0 print:border-slate-300">
      <div className="bg-white/70 px-6 py-4 print:bg-slate-100">
        <h3 className="font-semibold uppercase tracking-wide text-[#20243A] print:text-black">
          {title}
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#ECECF3] print:border-slate-300">
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#666B84]">
                Account
              </th>

              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#666B84]">
                Description
              </th>

              <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-[#666B84]">
                Amount
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-6 py-6 text-center text-sm text-[#666B84]"
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
                  className="border-b border-[#ECECF3]/70 last:border-b-0 print:border-slate-200"
                >
                  <td className="px-6 py-4 text-sm text-[#666B84] print:text-black">
                    {row.code ?? "-"}
                  </td>

                  <td className="px-6 py-4 text-sm font-medium text-[#20243A] print:text-black">
                    {row.name ??
                      row.description ??
                      "-"}
                  </td>

                  <td className="px-6 py-4 text-right text-sm font-medium text-[#20243A] print:text-black">
                    {formatCurrency(
                      toNumber(row[valueKey])
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>

          <tfoot>
            <tr className="border-t border-[#ECECF3] bg-white/40 print:border-slate-400 print:bg-slate-50">
              <td
                colSpan={2}
                className="px-6 py-4 font-semibold text-[#20243A] print:text-black"
              >
                {totalLabel}
              </td>

              <td className="px-6 py-4 text-right font-bold text-[#20243A] print:text-black">
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
      className={`flex items-center justify-between gap-6 border-b border-[#ECECF3] px-6 py-4 last:border-b-0 print:border-slate-300 ${
        strong
          ? "bg-white/60 print:bg-slate-100"
          : ""
      }`}
    >
      <span
        className={
          strong
            ? "font-bold text-[#20243A] print:text-black"
            : "text-[#666B84] print:text-black"
        }
      >
        {label}
      </span>

      <span
        className={
          strong
            ? "font-bold text-[#20243A] print:text-black"
            : "font-medium text-[#20243A] print:text-black"
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
  const assets = getStatementRows(data.assets);
  const liabilities = getStatementRows(data.liabilities);
  const equity = getStatementRows(data.equity);

  const totals = isRecord(data.totals)
    ? data.totals
    : {};

  const totalAssets = toNumber(totals.assets);
  const totalLiabilities = toNumber(totals.liabilities);
  const totalEquity = toNumber(totals.equity);

  const retainedEarnings = toNumber(
    totals.retainedEarnings,
    toNumber(data.retainedEarnings)
  );

  const totalEquityAndRetained = toNumber(
    totals.totalEquityAndRetainedEarnings,
    totalEquity + retainedEarnings
  );

  const liabilitiesAndEquity = toNumber(
    totals.liabilitiesAndEquity,
    totalLiabilities + totalEquityAndRetained
  );

  const difference = toNumber(
    totals.difference,
    Math.abs(
      totalAssets - liabilitiesAndEquity
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

      <div className="border-b border-[#ECECF3] print:border-slate-300">
        <SummaryLine
          label="Retained Earnings"
          value={retainedEarnings}
        />

        <SummaryLine
          label="Total Equity"
          value={totalEquityAndRetained}
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
            <p className="font-semibold text-[#20243A] print:text-black">
              {balanced
                ? "Balance Sheet Balanced"
                : "Balance Sheet Out of Balance"}
            </p>

            <p className="text-sm text-[#666B84] print:text-slate-600">
              Assets = Liabilities + Equity
            </p>
          </div>
        </div>

        <span className="font-semibold text-[#20243A] print:text-black">
          Difference: {formatCurrency(difference)}
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
  const revenue = getStatementRows(data.revenue);
  const expenses = getStatementRows(data.expenses);

  const totals = isRecord(data.totals)
    ? data.totals
    : {};

  const totalRevenue = toNumber(totals.revenue);
  const totalExpenses = toNumber(totals.expenses);

  const netProfit = toNumber(
    totals.netProfit,
    totalRevenue - totalExpenses
  );

  const profitMargin = toNumber(
    totals.profitMargin
  );

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
          <div className="rounded-xl border border-[#ECECF3] bg-white/50 p-5 print:border-slate-300 print:bg-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#666B84]">
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

          <div className="rounded-xl border border-[#ECECF3] bg-white/50 p-5 print:border-slate-300 print:bg-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#666B84]">
              Profit Margin
            </p>

            <p className="mt-2 text-2xl font-bold text-[#20243A] print:text-black">
              {formatPercentage(profitMargin)}
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
  const rows = getCashFlowRows(section);

  const inflows = toNumber(section.inflows);
  const outflows = toNumber(section.outflows);

  const net = toNumber(
    section.netCashFlow,
    toNumber(
      section.net,
      inflows - outflows
    )
  );

  return (
    <section className="border-b border-[#ECECF3] print:border-slate-300">
      <div className="bg-white/70 px-6 py-4 print:bg-slate-100">
        <h3 className="font-semibold uppercase tracking-wide text-[#20243A] print:text-black">
          {title}
        </h3>
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <tbody>
              {rows.map((row, index) => {
                const label =
                  row.name ??
                  row.description ??
                  row.code ??
                  `Movement ${index + 1}`;

                const amount = toNumber(
                  row.amount,
                  toNumber(row.balance)
                );

                return (
                  <tr
                    key={
                      typeof row.id === "string"
                        ? row.id
                        : index
                    }
                    className="border-b border-[#ECECF3]/60 print:border-slate-200"
                  >
                    <td className="px-6 py-3 text-sm text-[#666B84] print:text-black">
                      {String(label)}
                    </td>

                    <td className="px-6 py-3 text-right text-sm text-[#20243A] print:text-black">
                      {formatCurrency(amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div>
        {(inflows !== 0 || outflows !== 0) && (
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
  const operating = getCashFlowSection(
    data,
    "operatingActivities"
  );

  const investing = getCashFlowSection(
    data,
    "investingActivities"
  );

  const financing = getCashFlowSection(
    data,
    "financingActivities"
  );

  const totals = isRecord(data.totals)
    ? data.totals
    : {};

  const operatingNet = toNumber(
    operating.netCashFlow,
    toNumber(operating.net)
  );

  const investingNet = toNumber(
    investing.netCashFlow,
    toNumber(investing.net)
  );

  const financingNet = toNumber(
    financing.netCashFlow,
    toNumber(financing.net)
  );

  const calculatedMovement =
    operatingNet +
    investingNet +
    financingNet;

  const openingCash = toNumber(
    totals.openingCash,
    toNumber(
      data.openingCash,
      toNumber(data.openingCashBalance)
    )
  );

  const netCashMovement = toNumber(
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

  const closingCash = toNumber(
    totals.closingCash,
    toNumber(
      data.closingCash,
      toNumber(
        data.closingCashBalance,
        openingCash + netCashMovement
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

    difference = toNumber(
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

      <div className="bg-white/30 print:bg-white">
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

            <span className="font-semibold text-[#20243A] print:text-black">
              {reconciled
                ? "Cash Flow Reconciled"
                : "Cash Flow Reconciliation Difference"}
            </span>
          </div>

          <span className="font-semibold text-[#20243A] print:text-black">
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

          <p className="mt-4 font-medium text-[#20243A] print:text-black">
            No report records found
          </p>

          <p className="mt-2 text-sm text-[#666B84]">
            There are currently no records available for this report and reporting period.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-white/80 print:bg-slate-100">
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                className="whitespace-nowrap px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#666B84] print:text-black"
              >
                {humanize(column)}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="border-t border-[#ECECF3] transition hover:bg-white/50 print:border-slate-300"
            >
              {columns.map((column) => (
                <td
                  key={column}
                  className="whitespace-nowrap px-5 py-4 text-sm text-[#20243A] print:text-black"
                >
                  {formatValue(
                    column,
                    row[column]
                  )}
                </td>
              ))}
            </tr>
          ))}
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
    useState<ReportResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [exporting, setExporting] =
    useState<"PDF" | "EXCEL" | null>(
      null
    );

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
    () => resolvePeriodDates(period),
    [period]
  );

  const startDate =
    explicitStartDate ??
    resolvedDates.startDate;

  const endDate =
    explicitEndDate ??
    resolvedDates.endDate;

  /* =========================================================
     FETCH REPORT
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

        query.set("period", period);

        const token = getToken();

        const queryString =
          query.toString();

        const requestUrl =
          queryString
            ? `${endpoint}?${queryString}`
            : endpoint;

        const response =
          await authenticatedFetch(requestUrl, {
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
          });

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

      return Array.from(columnSet);
    }, [rows]);

  const totals =
    useMemo<
      Record<string, unknown>
    >(() => {
      if (
        reportData &&
        isRecord(reportData.totals)
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
     EXPORT DATA BUILDERS
  ========================================================= */

  const buildExportRows =
    (): Array<
      Array<string | number>
    > => {
      if (!reportData) {
        return [];
      }

      const exportRows: Array<
        Array<string | number>
      > = [];

      if (
        currentReportType ===
        "balance-sheet"
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
            exportRows.push([
              section.title,
            ]);

            exportRows.push([
              "Account Code",
              "Account Name",
              "Amount (KES)",
            ]);

            section.rows.forEach(
              (row) => {
                exportRows.push([
                  String(
                    row.code ?? ""
                  ),
                  String(
                    row.name ??
                      row.description ??
                      ""
                  ),
                  toNumber(
                    row[
                      section.key
                    ]
                  ),
                ]);
              }
            );

            exportRows.push([]);
          }
        );

        const balanceTotals =
          isRecord(
            reportData.totals
          )
            ? reportData.totals
            : {};

        exportRows.push([
          "SUMMARY",
        ]);

        exportRows.push([
          "Total Assets",
          "",
          toNumber(
            balanceTotals.assets
          ),
        ]);

        exportRows.push([
          "Total Liabilities",
          "",
          toNumber(
            balanceTotals.liabilities
          ),
        ]);

        exportRows.push([
          "Equity",
          "",
          toNumber(
            balanceTotals.equity
          ),
        ]);

        exportRows.push([
          "Retained Earnings",
          "",
          toNumber(
            balanceTotals.retainedEarnings,
            toNumber(
              reportData.retainedEarnings
            )
          ),
        ]);

        exportRows.push([
          "Liabilities & Equity",
          "",
          toNumber(
            balanceTotals.liabilitiesAndEquity
          ),
        ]);

        return exportRows;
      }

      if (
        currentReportType ===
          "profit-loss" ||
        currentReportType ===
          "income-statement"
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
            exportRows.push([
              section.title,
            ]);

            exportRows.push([
              "Account Code",
              "Account Name",
              "Amount (KES)",
            ]);

            section.rows.forEach(
              (row) => {
                exportRows.push([
                  String(
                    row.code ?? ""
                  ),
                  String(
                    row.name ??
                      row.description ??
                      ""
                  ),
                  toNumber(
                    row.amount
                  ),
                ]);
              }
            );

            exportRows.push([]);
          }
        );

        const statementTotals =
          isRecord(
            reportData.totals
          )
            ? reportData.totals
            : {};

        exportRows.push([
          "SUMMARY",
        ]);

        exportRows.push([
          "Total Revenue",
          "",
          toNumber(
            statementTotals.revenue
          ),
        ]);

        exportRows.push([
          "Total Expenses",
          "",
          toNumber(
            statementTotals.expenses
          ),
        ]);

        exportRows.push([
          "Net Profit / Loss",
          "",
          toNumber(
            statementTotals.netProfit
          ),
        ]);

        exportRows.push([
          "Profit Margin",
          "",
          formatPercentage(
            toNumber(
              statementTotals.profitMargin
            )
          ),
        ]);

        return exportRows;
      }

      if (
        currentReportType ===
        "cash-flow"
      ) {
        const activities = [
          {
            title:
              "OPERATING ACTIVITIES",
            section:
              getCashFlowSection(
                reportData,
                "operatingActivities"
              ),
          },
          {
            title:
              "INVESTING ACTIVITIES",
            section:
              getCashFlowSection(
                reportData,
                "investingActivities"
              ),
          },
          {
            title:
              "FINANCING ACTIVITIES",
            section:
              getCashFlowSection(
                reportData,
                "financingActivities"
              ),
          },
        ];

        activities.forEach(
          ({
            title,
            section,
          }) => {
            exportRows.push([
              title,
            ]);

            exportRows.push([
              "Description",
              "Amount (KES)",
            ]);

            getCashFlowRows(
              section
            ).forEach((row) => {
              exportRows.push([
                String(
                  row.name ??
                    row.description ??
                    row.code ??
                    ""
                ),
                toNumber(
                  row.amount,
                  toNumber(
                    row.balance
                  )
                ),
              ]);
            });

            exportRows.push([
              "Cash Inflows",
              toNumber(
                section.inflows
              ),
            ]);

            exportRows.push([
              "Cash Outflows",
              toNumber(
                section.outflows
              ),
            ]);

            exportRows.push([
              "Net Cash Flow",
              toNumber(
                section.netCashFlow,
                toNumber(
                  section.net
                )
              ),
            ]);

            exportRows.push([]);
          }
        );

        return exportRows;
      }

      if (
        rows.length > 0 &&
        columns.length > 0
      ) {
        exportRows.push(
          columns.map(
            (column) =>
              humanize(column)
          )
        );

        rows.forEach((row) => {
          exportRows.push(
            columns.map(
              (column) =>
                formatValue(
                  column,
                  row[column]
                )
            )
          );
        });
      }

      if (
        Object.keys(totals).length >
        0
      ) {
        exportRows.push([]);
        exportRows.push([
          "REPORT SUMMARY",
        ]);

        Object.entries(
          totals
        ).forEach(
          ([key, value]) => {
            exportRows.push([
              humanize(key),
              formatValue(
                key,
                value
              ),
            ]);
          }
        );
      }

      return exportRows;
    };

  /* =========================================================
     PDF EXPORT
  ========================================================= */

  const exportPdf = (): void => {
    if (!reportData || loading) {
      return;
    }

    try {
      setExporting("PDF");

      const rawExportRows = buildExportRows();

      if (rawExportRows.length === 0) {
        window.alert(
          "No report records are available to export."
        );
        return;
      }

      exportReportPdf({
        reportName,
        organizationName: "ZIYA",
        organizationSubtitle:
          "Financial Operating System",
        period: period.replaceAll("_", " "),
        startDate,
        endDate,
        asOfDate: explicitAsOfDate ?? undefined,
        currency: "KES",
        rows: rawExportRows.map((row) =>
          row.map((value) => ({
            value,
          }))
        ),
        filename: `Ziya_${safePdfFilename(
          reportName
        ).replace(/\.pdf$/i, "")}_${getFileDate()}.pdf`,
      });
    } catch (exportError) {
      console.error(
        "PDF EXPORT ERROR:",
        exportError
      );

      window.alert(
        "Unable to generate the PDF report. Please try again."
      );
    } finally {
      setExporting(null);
    }
  };
  const exportExcel = (): void => {
    if (
      !reportData ||
      loading
    ) {
      return;
    }

    try {
      setExporting("EXCEL");

      const workbook =
        XLSX.utils.book_new();

      const exportRows =
        buildExportRows();

      const headingRows: Array<
        Array<string | number>
      > = [
        [
          "ZIYA FINANCIAL OPERATING SYSTEM",
        ],
        [reportName],
        [
          `Reporting Period: ${period.replaceAll(
            "_",
            " "
          )}`,
        ],
        [
          startDate &&
          endDate
            ? `Date Range: ${startDate} to ${endDate}`
            : "Date Range: All available records",
        ],
        ["Currency: KES"],
        [
          `Generated: ${new Date().toLocaleString(
            "en-KE"
          )}`,
        ],
        [],
      ];

      const worksheet =
        XLSX.utils.aoa_to_sheet([
          ...headingRows,
          ...exportRows,
        ]);

      worksheet["!cols"] = [
        { wch: 28 },
        { wch: 38 },
        { wch: 22 },
        { wch: 22 },
        { wch: 22 },
        { wch: 22 },
        { wch: 22 },
      ];

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Report"
      );

      if (
        Object.keys(meta).length >
        0
      ) {
        const metadataRows =
          Object.entries(meta).map(
            ([key, value]) => [
              humanize(key),
              formatValue(
                key,
                value
              ),
            ]
          );

        const metadataSheet =
          XLSX.utils.aoa_to_sheet([
            [
              "ZIYA REPORT METADATA",
            ],
            [],
            ...metadataRows,
          ]);

        metadataSheet["!cols"] = [
          { wch: 28 },
          { wch: 45 },
        ];

        XLSX.utils.book_append_sheet(
          workbook,
          metadataSheet,
          "Metadata"
        );
      }

      const filename =
        `Ziya_${safeFilename(
          reportName
        )}_${getFileDate()}.xlsx`;

      XLSX.writeFile(
        workbook,
        filename
      );
    } catch (exportError) {
      console.error(
        "EXCEL EXPORT ERROR:",
        exportError
      );

      window.alert(
        "Unable to download the Excel report."
      );
    } finally {
      setExporting(null);
    }
  };

  /* =========================================================
     PRINT
  ========================================================= */

  const printReport = (): void => {
    if (
      !reportData ||
      loading
    ) {
      return;
    }

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
            className="mb-4 flex items-center gap-2 text-sm text-[#666B84] transition hover:text-[#20243A] print:hidden"
          >
            <ArrowLeft size={17} />
            Financial Reports
          </button>

          <h1 className="text-3xl font-bold text-[#20243A] print:text-black">
            {reportName}
          </h1>

          <p className="mt-2 text-[#666B84] print:text-slate-600">
            Ziya Financial Operating System
          </p>
        </div>

        <div className="flex flex-wrap gap-3 print:hidden">
          <button
            type="button"
            onClick={() =>
              void fetchReport()
            }
            disabled={
              loading ||
              exporting !== null
            }
            className="flex items-center gap-2 rounded-xl border border-[#ECECF3] bg-white px-4 py-2.5 text-sm font-medium text-[#20243A] transition hover:border-[#ECECF3] hover:bg-[#F8F9FC] disabled:cursor-not-allowed disabled:opacity-50"
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
            disabled={
              loading ||
              !reportData ||
              exporting !== null
            }
            className="flex items-center gap-2 rounded-xl border border-[#ECECF3] bg-white px-4 py-2.5 text-sm font-medium text-[#20243A] transition hover:border-[#ECECF3] hover:bg-[#F8F9FC] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting === "PDF" ? (
              <RefreshCw
                size={17}
                className="animate-spin"
              />
            ) : (
              <FileText size={17} />
            )}

            {exporting === "PDF"
              ? "Downloading..."
              : "PDF"}
          </button>

          <button
            type="button"
            onClick={exportExcel}
            disabled={
              loading ||
              !reportData ||
              exporting !== null
            }
            className="flex items-center gap-2 rounded-xl border border-[#ECECF3] bg-white px-4 py-2.5 text-sm font-medium text-[#20243A] transition hover:border-[#ECECF3] hover:bg-[#F8F9FC] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ===
            "EXCEL" ? (
              <RefreshCw
                size={17}
                className="animate-spin"
              />
            ) : (
              <FileSpreadsheet
                size={17}
              />
            )}

            {exporting ===
            "EXCEL"
              ? "Downloading..."
              : "Excel"}
          </button>

          <button
            type="button"
            onClick={printReport}
            disabled={
              loading ||
              !reportData ||
              exporting !== null
            }
            className="flex items-center gap-2 rounded-xl bg-[#0D9488] px-4 py-2.5 text-sm font-semibold text-[#20243A] shadow-sm transition hover:bg-[#5a4de0] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Printer size={17} />
            Print
          </button>
        </div>
      </div>

      {/* REPORT INFORMATION */}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[#ECECF3] bg-white p-4 print:border-slate-300 print:bg-white">
          <p className="text-xs uppercase tracking-wide text-[#666B84]">
            Report
          </p>

          <p className="mt-2 font-semibold text-[#20243A] print:text-black">
            {reportName}
          </p>
        </div>

        <div className="rounded-xl border border-[#ECECF3] bg-white p-4 print:border-slate-300 print:bg-white">
          <p className="text-xs uppercase tracking-wide text-[#666B84]">
            Reporting Period
          </p>

          <p className="mt-2 font-semibold text-[#20243A] print:text-black">
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
              <p className="mt-1 text-xs text-[#666B84]">
                {startDate} ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â{" "}
                {endDate}
              </p>
            )}
        </div>

        <div className="rounded-xl border border-[#ECECF3] bg-white p-4 print:border-slate-300 print:bg-white">
          <p className="text-xs uppercase tracking-wide text-[#666B84]">
            Currency
          </p>

          <p className="mt-2 font-semibold text-[#20243A] print:text-black">
            KES
          </p>
        </div>
      </div>

      {/* REPORT */}

      <div className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white shadow-sm print:border-slate-300 print:bg-white print:shadow-none">
        <div className="border-b border-[#ECECF3] p-6 print:border-slate-300">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-[#20243A] print:text-black">
                {reportName}
              </h2>

              <p className="mt-1 text-sm text-[#666B84] print:text-slate-600">
                Generated from Ziya FOS posted financial records.
              </p>
            </div>

            <button
              type="button"
              onClick={exportPdf}
              disabled={
                loading ||
                !reportData ||
                exporting !== null
              }
              title="Download report as PDF"
              aria-label="Download report as PDF"
              className="rounded-xl border border-[#ECECF3] p-2.5 text-[#666B84] transition hover:border-[#20243A]/50 hover:bg-[#0D9488]/10 hover:text-[#20243A] disabled:cursor-not-allowed disabled:opacity-40 print:hidden"
            >
              {exporting === "PDF" ? (
                <RefreshCw
                  size={20}
                  className="animate-spin"
                />
              ) : (
                <Download
                  size={20}
                />
              )}
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex min-h-[350px] items-center justify-center">
            <div className="text-center">
              <RefreshCw
                size={30}
                className="mx-auto animate-spin text-[#20243A]"
              />

              <p className="mt-4 text-[#666B84]">
                Generating report...
              </p>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="p-8">
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-5">
              <p className="font-semibold text-red-400">
                Unable to generate report
              </p>

              <p className="mt-2 text-sm text-[#666B84]">
                {error}
              </p>

              <button
                type="button"
                onClick={() =>
                  void fetchReport()
                }
                className="mt-4 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-[#20243A] transition hover:bg-red-600"
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
          <div className="rounded-2xl border border-[#ECECF3] bg-white p-6 print:border-slate-300 print:bg-white">
            <h3 className="mb-5 text-lg font-semibold text-[#20243A] print:text-black">
              Report Summary
            </h3>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(
                totals
              ).map(
                ([key, value]) => (
                  <div
                    key={key}
                    className="rounded-xl border border-[#ECECF3] bg-white/50 p-4 print:border-slate-300 print:bg-white"
                  >
                    <p className="text-xs uppercase tracking-wide text-[#666B84]">
                      {humanize(key)}
                    </p>

                    <p className="mt-2 text-lg font-semibold text-[#20243A] print:text-black">
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
          <div className="rounded-xl border border-[#ECECF3] bg-white px-5 py-4 print:border-slate-300 print:bg-white">
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs text-[#666B84]">
              {Object.entries(
                meta
              ).map(
                ([key, value]) => (
                  <span key={key}>
                    <strong className="text-[#666B84] print:text-slate-700">
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

      <div className="hidden border-t border-slate-300 pt-4 text-xs text-[#666B84] print:block">
        <div className="flex justify-between">
          <span>
            Ziya Financial Operating System
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


