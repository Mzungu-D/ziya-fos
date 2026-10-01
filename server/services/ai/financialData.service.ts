import prisma from "../../config/prisma";
import { Prisma } from "@prisma/client";

const EFFECTIVE_JOURNAL_STATUSES = ["POSTED", "APPROVED"] as const;

const MIN_FORECAST_MONTHS = 6;
const DEFAULT_HISTORY_MONTHS = 24;
const MAX_HISTORY_MONTHS = 120;

const MONEY_TOLERANCE = 0.01;

export type FinancialDataReadinessStatus =
  | "READY"
  | "NOT_READY"
  | "INSUFFICIENT_DATA";

export interface FinancialMonth {
  month: string;
  year: number;
  monthNumber: number;
  revenue: number;
  expenses: number;
  netProfit: number;
  transactionCount: number;
}

export interface FinancialDataReadiness {
  status: FinancialDataReadinessStatus;
  organizationId: string;
  historicalMonths: number;
  minimumRequiredMonths: number;
  firstMonth: string | null;
  lastMonth: string | null;
  message: string;
}

export interface FinancialDataset {
  organizationId: string;
  currency: string;
  startDate: string;
  endDate: string;
  months: FinancialMonth[];
  totals: {
    revenue: number;
    expenses: number;
    netProfit: number;
  };
  observations: number;
  readiness: FinancialDataReadiness;
}

interface RawMonthlyFinancialRow {
  month_start: Date;
  revenue: number | string | null;
  expenses: number | string | null;
  transaction_count: bigint | number | string | null;
}

interface RawMonthlyAccountRow {
  month_start: Date;
  account_type: string;
  debit_total: number | string | null;
  credit_total: number | string | null;
  transaction_count: bigint | number | string | null;
}

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function toInteger(value: unknown): number {
  const parsed = toNumber(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.trunc(parsed);
}

function normalizeOrganizationId(
  organizationId: unknown
): string {
  if (typeof organizationId !== "string") {
    throw new Error("AI_FINANCIAL_DATA_ORGANIZATION_REQUIRED");
  }

  const normalized = organizationId.trim();

  if (!normalized) {
    throw new Error("AI_FINANCIAL_DATA_ORGANIZATION_REQUIRED");
  }

  return normalized;
}

function parsePositiveInteger(
  value: unknown,
  fallback: number,
  maximum: number
): number {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed =
    typeof value === "number"
      ? value
      : Number(String(value).trim());

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("AI_FINANCIAL_DATA_INVALID_HISTORY");
  }

  if (parsed > maximum) {
    return maximum;
  }

  return parsed;
}

function normalizeDate(
  value: Date
): Date {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("AI_FINANCIAL_DATA_INVALID_DATE");
  }

  return date;
}

function startOfMonth(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      1,
      0,
      0,
      0,
      0
    )
  );
}

function endOfMonth(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      1,
      0,
      0,
      0,
      0
    )
  );
}

function formatMonth(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(
    2,
    "0"
  );

  return `${year}-${month}`;
}

function buildMonthRange(
  startDate: Date,
  endDate: Date
): Date[] {
  const months: Date[] = [];

  let cursor = startOfMonth(startDate);
  const end = startOfMonth(endDate);

  while (cursor < end) {
    months.push(new Date(cursor));

    cursor = new Date(
      Date.UTC(
        cursor.getUTCFullYear(),
        cursor.getUTCMonth() + 1,
        1
      )
    );
  }

  return months;
}

function calculateNetProfit(
  revenue: number,
  expenses: number
): number {
  return roundMoney(revenue - expenses);
}

function normalizeAccountType(
  accountType: string
): string {
  return String(accountType || "")
    .trim()
    .toUpperCase();
}

function calculateRevenueFromAccountMovement(
  debit: number,
  credit: number
): number {
  /*
   * Income accounts normally carry credit balances.
   *
   * Revenue = credits - debits
   *
   * The MAX operation prevents a temporary abnormal
   * debit-heavy income account from producing negative
   * revenue in the feature dataset.
   */
  return roundMoney(
    Math.max(
      0,
      credit - debit
    )
  );
}

function calculateExpenseFromAccountMovement(
  debit: number,
  credit: number
): number {
  /*
   * Expense accounts normally carry debit balances.
   *
   * Expenses = debits - credits
   *
   * The MAX operation prevents a temporary abnormal
   * credit-heavy expense account from producing negative
   * expenses in the feature dataset.
   */
  return roundMoney(
    Math.max(
      0,
      debit - credit
    )
  );
}

/**
 * Returns the organization's effective financial history.
 *
 * IMPORTANT:
 * - organizationId is mandatory.
 * - No Demo Company fallback exists.
 * - Every JournalEntry is tenant-scoped.
 * - Every Account is tenant-scoped.
 * - Only POSTED and APPROVED journals are used.
 * - Draft accounting data is never sent to the AI layer.
 */
export async function getFinancialHistory(
  organizationIdInput: string,
  options?: {
    months?: number;
    endDate?: Date | string;
  }
): Promise<FinancialDataset> {
  const organizationId =
    normalizeOrganizationId(
      organizationIdInput
    );

  const requestedMonths =
    parsePositiveInteger(
      options?.months,
      DEFAULT_HISTORY_MONTHS,
      MAX_HISTORY_MONTHS
    );

  const requestedEndDate =
    options?.endDate
      ? normalizeDate(
          new Date(options.endDate)
        )
      : new Date();

  const endDateExclusive =
    endOfMonth(requestedEndDate);

  const startDate = new Date(
    Date.UTC(
      endDateExclusive.getUTCFullYear(),
      endDateExclusive.getUTCMonth() -
        requestedMonths,
      1,
      0,
      0,
      0,
      0
    )
  );

  /*
   * Verify the organization exists before querying
   * accounting data.
   *
   * This also makes a new/empty tenant a controlled
   * NOT_READY state rather than silently falling back
   * to another organization's data.
   */
  const organization =
    await prisma.organization.findUnique({
      where: {
        id: organizationId,
      },
      select: {
        id: true,
      },
    });

  if (!organization) {
    throw new Error(
      "AI_FINANCIAL_DATA_ORGANIZATION_NOT_FOUND"
    );
  }

  /*
   * Aggregate directly from the accounting engine.
   *
   * Tenant isolation is applied twice:
   *
   * 1. JournalEntry.organizationId
   * 2. Account.organizationId
   *
   * This protects the AI dataset even if a corrupted
   * journal line references an account from another tenant.
   */
  const rows =
    await prisma.$queryRaw<RawMonthlyAccountRow[]>(
      Prisma.sql`
        SELECT
          DATE_TRUNC(
            'month',
            je."transactionDate"
          ) AS month_start,

          a."type" AS account_type,

          COALESCE(
            SUM(jel."debit"),
            0
          ) AS debit_total,

          COALESCE(
            SUM(jel."credit"),
            0
          ) AS credit_total,

          COUNT(
            DISTINCT je."id"
          ) AS transaction_count

        FROM "JournalEntryLine" jel

        INNER JOIN "JournalEntry" je
          ON je."id" = jel."journalEntryId"

        INNER JOIN "Account" a
          ON a."id" = jel."accountId"

        WHERE
          je."organizationId" = ${organizationId}

          AND a."organizationId" = ${organizationId}

          AND je."status" IN (
            ${Prisma.join(
              EFFECTIVE_JOURNAL_STATUSES
            )}
          )

          AND je."transactionDate" >= ${startDate}

          AND je."transactionDate" < ${endDateExclusive}

        GROUP BY
          DATE_TRUNC(
            'month',
            je."transactionDate"
          ),
          a."type"

        ORDER BY
          month_start ASC
      `
    );

  /*
   * Build the complete requested month range first.
   *
   * This guarantees that a tenant with no transactions
   * in a particular month receives an explicit zero
   * observation rather than a missing observation.
   */
  const monthRange =
    buildMonthRange(
      startDate,
      endDateExclusive
    );

  const monthMap = new Map<
    string,
    FinancialMonth
  >();

  for (const month of monthRange) {
    const key = formatMonth(month);

    monthMap.set(key, {
      month: key,
      year: month.getUTCFullYear(),
      monthNumber:
        month.getUTCMonth() + 1,
      revenue: 0,
      expenses: 0,
      netProfit: 0,
      transactionCount: 0,
    });
  }

  for (const row of rows) {
    const month =
      normalizeDate(row.month_start);

    const key =
      formatMonth(month);

    const target =
      monthMap.get(key);

    if (!target) {
      continue;
    }

    const accountType =
      normalizeAccountType(
        row.account_type
      );

    const debit =
      roundMoney(
        toNumber(row.debit_total)
      );

    const credit =
      roundMoney(
        toNumber(row.credit_total)
      );

    const transactionCount =
      toInteger(
        row.transaction_count
      );

    if (accountType === "INCOME") {
      target.revenue = roundMoney(
        target.revenue +
          calculateRevenueFromAccountMovement(
            debit,
            credit
          )
      );
    }

    if (accountType === "EXPENSE") {
      target.expenses = roundMoney(
        target.expenses +
          calculateExpenseFromAccountMovement(
            debit,
            credit
          )
      );
    }

    target.transactionCount =
      Math.max(
        target.transactionCount,
        transactionCount
      );
  }

  const months =
    Array.from(
      monthMap.values()
    ).map((month) => ({
      ...month,
      netProfit:
        calculateNetProfit(
          month.revenue,
          month.expenses
        ),
    }));

  const revenue =
    roundMoney(
      months.reduce(
        (sum, month) =>
          sum + month.revenue,
        0
      )
    );

  const expenses =
    roundMoney(
      months.reduce(
        (sum, month) =>
          sum + month.expenses,
        0
      )
    );

  const netProfit =
    calculateNetProfit(
      revenue,
      expenses
    );

  const observations =
    months.length;

  const monthsWithTransactions =
    months.filter(
      (month) =>
        month.transactionCount > 0
    ).length;

  const firstActiveMonth =
    months.find(
      (month) =>
        month.transactionCount > 0
    ) ?? null;

  const lastActiveMonth =
    [...months]
      .reverse()
      .find(
        (month) =>
          month.transactionCount > 0
      ) ?? null;

  let readinessStatus:
    FinancialDataReadinessStatus;

  let readinessMessage: string;

  if (monthsWithTransactions === 0) {
    readinessStatus =
      "NOT_READY";

    readinessMessage =
      "The tenant does not have posted or approved accounting activity in the requested period.";
  } else if (
    monthsWithTransactions <
    MIN_FORECAST_MONTHS
  ) {
    readinessStatus =
      "INSUFFICIENT_DATA";

    readinessMessage =
      `The tenant has ${monthsWithTransactions} active financial months. At least ${MIN_FORECAST_MONTHS} active months are required for forecasting.`;
  } else {
    readinessStatus =
      "READY";

    readinessMessage =
      "The tenant has sufficient posted or approved financial history for the current forecasting data pipeline.";
  }

  const readiness: FinancialDataReadiness = {
    status:
      readinessStatus,

    organizationId,

    historicalMonths:
      monthsWithTransactions,

    minimumRequiredMonths:
      MIN_FORECAST_MONTHS,

    firstMonth:
      firstActiveMonth?.month ??
      null,

    lastMonth:
      lastActiveMonth?.month ??
      null,

    message:
      readinessMessage,
  };

  return {
    organizationId,

    currency: "KES",

    startDate:
      startDate.toISOString(),

    endDate:
      endDateExclusive.toISOString(),

    months,

    totals: {
      revenue,
      expenses,
      netProfit,
    },

    observations,

    readiness,
  };
}

/**
 * Lightweight readiness check.
 *
 * This avoids loading the complete historical dataset
 * when the caller only needs to know whether the tenant
 * has enough accounting history for AI processing.
 */
export async function getFinancialDataReadiness(
  organizationIdInput: string,
  options?: {
    months?: number;
    endDate?: Date | string;
  }
): Promise<FinancialDataReadiness> {
  const organizationId =
    normalizeOrganizationId(
      organizationIdInput
    );

  const requestedMonths =
    parsePositiveInteger(
      options?.months,
      DEFAULT_HISTORY_MONTHS,
      MAX_HISTORY_MONTHS
    );

  const requestedEndDate =
    options?.endDate
      ? normalizeDate(
          new Date(options.endDate)
        )
      : new Date();

  const endDateExclusive =
    endOfMonth(requestedEndDate);

  const startDate =
    new Date(
      Date.UTC(
        endDateExclusive.getUTCFullYear(),
        endDateExclusive.getUTCMonth() -
          requestedMonths,
        1,
        0,
        0,
        0,
        0
      )
    );

  const organization =
    await prisma.organization.findUnique({
      where: {
        id: organizationId,
      },
      select: {
        id: true,
      },
    });

  if (!organization) {
    throw new Error(
      "AI_FINANCIAL_DATA_ORGANIZATION_NOT_FOUND"
    );
  }

  const result =
    await prisma.$queryRaw<
      Array<{
        active_months: bigint | number | string;
        first_month: Date | null;
        last_month: Date | null;
      }>
    >(
      Prisma.sql`
        SELECT
          COUNT(DISTINCT DATE_TRUNC(
            'month',
            je."transactionDate"
          )) AS active_months,

          MIN(
            DATE_TRUNC(
              'month',
              je."transactionDate"
            )
          ) AS first_month,

          MAX(
            DATE_TRUNC(
              'month',
              je."transactionDate"
            )
          ) AS last_month

        FROM "JournalEntryLine" jel

        INNER JOIN "JournalEntry" je
          ON je."id" = jel."journalEntryId"

        INNER JOIN "Account" a
          ON a."id" = jel."accountId"

        WHERE
          je."organizationId" = ${organizationId}

          AND a."organizationId" = ${organizationId}

          AND je."status" IN (
            ${Prisma.join(
              EFFECTIVE_JOURNAL_STATUSES
            )}
          )

          AND je."transactionDate" >= ${startDate}

          AND je."transactionDate" < ${endDateExclusive}

          AND a."type" IN (
            'INCOME',
            'EXPENSE'
          )
      `
    );

  const row =
    result[0];

  const historicalMonths =
    toInteger(
      row?.active_months
    );

  const firstMonth =
    row?.first_month
      ? formatMonth(
          normalizeDate(
            row.first_month
          )
        )
      : null;

  const lastMonth =
    row?.last_month
      ? formatMonth(
          normalizeDate(
            row.last_month
          )
        )
      : null;

  let status:
    FinancialDataReadinessStatus;

  let message: string;

  if (historicalMonths === 0) {
    status =
      "NOT_READY";

    message =
      "The tenant does not have posted or approved income or expense activity in the requested period.";
  } else if (
    historicalMonths <
    MIN_FORECAST_MONTHS
  ) {
    status =
      "INSUFFICIENT_DATA";

    message =
      `The tenant has ${historicalMonths} active financial months. At least ${MIN_FORECAST_MONTHS} active months are required for forecasting.`;
  } else {
    status =
      "READY";

    message =
      "The tenant has sufficient financial history for forecasting.";
  }

  return {
    status,

    organizationId,

    historicalMonths,

    minimumRequiredMonths:
      MIN_FORECAST_MONTHS,

    firstMonth,

    lastMonth,

    message,
  };
}

/**
 * Returns the most recent completed financial months.
 *
 * Completed months are preferable for forecasting because
 * the current month may contain incomplete accounting data.
 */
export async function getCompletedFinancialHistory(
  organizationIdInput: string,
  months = DEFAULT_HISTORY_MONTHS
): Promise<FinancialDataset> {
  const organizationId =
    normalizeOrganizationId(
      organizationIdInput
    );

  const requestedMonths =
    parsePositiveInteger(
      months,
      DEFAULT_HISTORY_MONTHS,
      MAX_HISTORY_MONTHS
    );

  const now =
    new Date();

  const currentMonthStart =
    startOfMonth(now);

  /*
   * Passing the final instant of the previous month
   * ensures the current incomplete month is excluded.
   */
  const completedEndDate =
    new Date(
      currentMonthStart.getTime() - 1
    );

  return getFinancialHistory(
    organizationId,
    {
      months:
        requestedMonths,
      endDate:
        completedEndDate,
    }
  );
}

/**
 * Produces a forecasting-ready matrix.
 *
 * The forecasting engine should consume this structure
 * rather than querying Prisma directly.
 */
export interface ForecastFeatureRow {
  month: string;
  year: number;
  monthNumber: number;

  revenue: number;
  expenses: number;
  netProfit: number;

  revenueGrowth: number | null;
  expenseGrowth: number | null;
  profitGrowth: number | null;

  transactionCount: number;
}

export function buildForecastFeatures(
  dataset: FinancialDataset
): ForecastFeatureRow[] {
  if (!dataset) {
    throw new Error(
      "AI_FINANCIAL_DATASET_REQUIRED"
    );
  }

  const features: ForecastFeatureRow[] = [];

  for (
    let index = 0;
    index < dataset.months.length;
    index += 1
  ) {
    const current =
      dataset.months[index];

    const previous =
      index > 0
        ? dataset.months[index - 1]
        : null;

    const calculateGrowth = (
      currentValue: number,
      previousValue: number
    ): number | null => {
      if (
        Math.abs(previousValue) <=
        MONEY_TOLERANCE
      ) {
        return null;
      }

      return roundMoney(
        ((currentValue -
          previousValue) /
          Math.abs(previousValue)) *
          100
      );
    };

    features.push({
      month:
        current.month,

      year:
        current.year,

      monthNumber:
        current.monthNumber,

      revenue:
        roundMoney(
          current.revenue
        ),

      expenses:
        roundMoney(
          current.expenses
        ),

      netProfit:
        roundMoney(
          current.netProfit
        ),

      revenueGrowth:
        previous
          ? calculateGrowth(
              current.revenue,
              previous.revenue
            )
          : null,

      expenseGrowth:
        previous
          ? calculateGrowth(
              current.expenses,
              previous.expenses
            )
          : null,

      profitGrowth:
        previous
          ? calculateGrowth(
              current.netProfit,
              previous.netProfit
            )
          : null,

      transactionCount:
        current.transactionCount,
    });
  }

  return features;
}

/**
 * Returns a complete forecasting dataset including
 * derived features.
 */
export async function getForecastDataset(
  organizationIdInput: string,
  options?: {
    months?: number;
    endDate?: Date | string;
    completedMonthsOnly?: boolean;
  }
): Promise<
  FinancialDataset & {
    features: ForecastFeatureRow[];
  }
> {
  const organizationId =
    normalizeOrganizationId(
      organizationIdInput
    );

  const dataset =
    options?.completedMonthsOnly
      ? await getCompletedFinancialHistory(
          organizationId,
          options?.months ??
            DEFAULT_HISTORY_MONTHS
        )
      : await getFinancialHistory(
          organizationId,
          options
        );

  return {
    ...dataset,

    features:
      buildForecastFeatures(
        dataset
      ),
  };
}

/**
 * Expose the model requirements without tying the
 * service to a particular ML library.
 */
export const AI_FINANCIAL_DATA_CONFIG = {
  minimumForecastMonths:
    MIN_FORECAST_MONTHS,

  defaultHistoryMonths:
    DEFAULT_HISTORY_MONTHS,

  maximumHistoryMonths:
    MAX_HISTORY_MONTHS,

  effectiveJournalStatuses:
    EFFECTIVE_JOURNAL_STATUSES,

  currency:
    "KES",

  source:
    "JournalEntryLine",

  accountingBasis:
    "ACCRUAL",

  tenantIsolation:
    "ORGANIZATION_SCOPED",
} as const;