import { Response } from "express";
import { Prisma } from "@prisma/client";

import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   CONSTANTS
========================================================= */

const MONEY_SCALE = 100;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;
const MAX_SEARCH_LENGTH = 100;

/* =========================================================
   TYPES
========================================================= */

type DateFilter = {
  gte?: Date;
  lte?: Date;
};

type CurrencyTotals = {
  [currency: string]: {
    openingBalance: number;
    currentBalance: number;
    netMovement: number;
  };
};

/* =========================================================
   HELPERS
========================================================= */

function getOrganizationId(
  req: AuthRequest,
): string | null {
  const organizationId = req.user?.organizationId;

  if (typeof organizationId !== "string") {
    return null;
  }

  const value = organizationId.trim();

  return value.length > 0 ? value : null;
}

function round(value: number): number {
  return (
    Math.round(
      (Number.isFinite(value) ? value : 0) *
        MONEY_SCALE,
    ) / MONEY_SCALE
  );
}

function normalizeCurrency(
  value: unknown,
  fallback = "KES",
): string {
  const currency =
    typeof value === "string"
      ? value.trim().toUpperCase()
      : fallback;

  return /^[A-Z]{3}$/.test(currency)
    ? currency
    : fallback;
}

function getQueryValue(
  value: unknown,
): string | undefined {
  const raw = Array.isArray(value)
    ? value[0]
    : value;

  if (typeof raw !== "string") {
    return undefined;
  }

  const normalized = raw.trim();

  return normalized.length > 0
    ? normalized
    : undefined;
}

function getPagination(
  req: AuthRequest,
): { page: number; limit: number; skip: number } {
  const rawPage =
    getQueryValue(req.query.page);
  const rawLimit =
    getQueryValue(req.query.limit);

  const page = rawPage
    ? Number(rawPage)
    : 1;

  const limit = rawLimit
    ? Number(rawLimit)
    : DEFAULT_PAGE_SIZE;

  if (
    !Number.isSafeInteger(page) ||
    page < 1
  ) {
    throw new Error(
      "Page must be a positive integer.",
    );
  }

  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > MAX_PAGE_SIZE
  ) {
    throw new Error(
      `Limit must be between 1 and ${MAX_PAGE_SIZE}.`,
    );
  }

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

function getDateFilter(
  req: AuthRequest,
): DateFilter {
  const startDate =
    getQueryValue(req.query.startDate);
  const endDate =
    getQueryValue(req.query.endDate);

  const filter: DateFilter = {};

  if (startDate) {
    const parsed =
      parseDateBoundary(
        startDate,
        false,
      );

    filter.gte = parsed;
  }

  if (endDate) {
    const parsed =
      parseDateBoundary(
        endDate,
        true,
      );

    filter.lte = parsed;
  }

  if (
    filter.gte &&
    filter.lte &&
    filter.gte > filter.lte
  ) {
    throw new Error(
      "Start date cannot be after end date.",
    );
  }

  return filter;
}

function parseDateBoundary(
  value: string,
  endOfDay: boolean,
): Date {
  const dateOnly =
    /^\d{4}-\d{2}-\d{2}$/.test(value);

  if (dateOnly) {
    const [year, month, day] =
      value.split("-").map(Number);

    const date = endOfDay
      ? new Date(
          Date.UTC(
            year,
            month - 1,
            day,
            23,
            59,
            59,
            999,
          ),
        )
      : new Date(
          Date.UTC(
            year,
            month - 1,
            day,
            0,
            0,
            0,
            0,
          ),
        );

    if (Number.isNaN(date.getTime())) {
      throw new Error(
        "Invalid date.",
      );
    }

    return date;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(
      "Invalid date.",
    );
  }

  return parsed;
}

function hasDateFilter(
  filter: DateFilter,
): boolean {
  return Boolean(
    filter.gte || filter.lte,
  );
}

function isSuccessfulMpesaTransaction(
  status: string,
  resultCode: number | null,
): boolean {
  const normalizedStatus =
    String(status ?? "")
      .trim()
      .toUpperCase();

  return (
    normalizedStatus === "SUCCESS" ||
    normalizedStatus === "COMPLETED" ||
    resultCode === 0
  );
}

function isMpesaInflow(
  transactionType: string,
): boolean {
  const type =
    String(transactionType ?? "")
      .trim()
      .toUpperCase();

  return (
    type.includes("C2B") ||
    type.includes("RECEIVE") ||
    type.includes("RECEIVED") ||
    type.includes("CREDIT") ||
    type.includes("INFLOW")
  );
}

function isMpesaOutflow(
  transactionType: string,
): boolean {
  const type =
    String(transactionType ?? "")
      .trim()
      .toUpperCase();

  return (
    type.includes("B2C") ||
    type.includes("SEND") ||
    type.includes("SENT") ||
    type.includes("DEBIT") ||
    type.includes("OUTFLOW")
  );
}

function normalizeSearch(
  req: AuthRequest,
): string | undefined {
  const value =
    getQueryValue(req.query.search);

  if (!value) {
    return undefined;
  }

  if (
    value.length >
    MAX_SEARCH_LENGTH
  ) {
    throw new Error(
      "Search value is too long.",
    );
  }

  return value.toLowerCase();
}

function addCurrencyTotal(
  totals: CurrencyTotals,
  currency: string,
  openingBalance: number,
  currentBalance: number,
): void {
  const key =
    normalizeCurrency(currency);

  if (!totals[key]) {
    totals[key] = {
      openingBalance: 0,
      currentBalance: 0,
      netMovement: 0,
    };
  }

  totals[key].openingBalance +=
    openingBalance;

  totals[key].currentBalance +=
    currentBalance;

  totals[key].netMovement +=
    currentBalance -
    openingBalance;
}

function serializeError(
  res: Response,
  error: unknown,
  fallback: string,
): void {
  console.error(
    "[CASH/BANK REPORTS]",
    error,
  );

  const message =
    error instanceof Error
      ? error.message
      : "";

  const status =
    message.includes("required") ||
    message.includes("Invalid") ||
    message.includes("invalid") ||
    message.includes("cannot") ||
    message.includes("must be") ||
    message.includes("too long")
      ? 400
      : 500;

  res.status(status).json({
    success: false,
    code:
      status === 400
        ? "INVALID_REPORT_REQUEST"
        : "REPORT_GENERATION_FAILED",
    message:
      status === 400
        ? message
        : fallback,
  });
}

/* =========================================================
   CASH POSITION
   Current liquidity position.
   Balances are never combined across currencies.
========================================================= */

export const getCashPosition = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      res.status(401).json({
        success: false,
        code: "AUTH_REQUIRED",
        message:
          "Authentication required.",
      });
      return;
    }

    const bankAccounts =
      await prisma.bankAccount.findMany({
        where: {
          organizationId,
          status: "ACTIVE",
        },
        orderBy: [
          { currency: "asc" },
          { bankName: "asc" },
          { accountName: "asc" },
        ],
      });

    const mpesaTransactions =
      await prisma.mpesaTransaction.findMany({
        where: {
          organizationId,
        },
        select: {
          amount: true,
          status: true,
          resultCode: true,
          transactionType: true,
        },
      });

    let mpesaInflows = 0;
    let mpesaOutflows = 0;

    for (
      const transaction
      of mpesaTransactions
    ) {
      if (
        !isSuccessfulMpesaTransaction(
          transaction.status,
          transaction.resultCode,
        )
      ) {
        continue;
      }

      if (
        isMpesaInflow(
          transaction.transactionType,
        )
      ) {
        mpesaInflows +=
          Number(transaction.amount);
      }

      if (
        isMpesaOutflow(
          transaction.transactionType,
        )
      ) {
        mpesaOutflows +=
          Number(transaction.amount);
      }
    }

    const mpesaBalance =
      mpesaInflows -
      mpesaOutflows;

    const byCurrency: CurrencyTotals =
      {};

    for (
      const account of bankAccounts
    ) {
      addCurrencyTotal(
        byCurrency,
        account.currency,
        0,
        Number(account.currentBalance),
      );
    }

    addCurrencyTotal(
      byCurrency,
      "KES",
      0,
      mpesaBalance,
    );

    const data = [
      ...bankAccounts.map(
        (account) => ({
          source: "BANK",
          institution:
            account.bankName,
          accountName:
            account.accountName,
          accountNumber:
            account.accountNumber,
          currency:
            normalizeCurrency(
              account.currency,
            ),
          balance: round(
            Number(
              account.currentBalance,
            ),
          ),
          status:
            account.status,
          connectionStatus:
            account.connectionStatus,
          lastSyncAt:
            account.lastSyncAt,
        }),
      ),
      {
        source: "MPESA",
        institution: "M-Pesa",
        accountName: "M-Pesa",
        accountNumber: "-",
        currency: "KES",
        balance:
          round(mpesaBalance),
        status: "ACTIVE",
      },
    ];

    res.status(200).json({
      success: true,
      data,
      totals: {
        byCurrency,
        mpesaInflows:
          round(mpesaInflows),
        mpesaOutflows:
          round(mpesaOutflows),
        mpesaBalance:
          round(mpesaBalance),
      },
      meta: {
        organizationId,
        bankAccounts:
          bankAccounts.length,
        generatedAt:
          new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    serializeError(
      res,
      error,
      "Failed to generate cash position report.",
    );
  }
};

/* =========================================================
   BANK ACCOUNT SUMMARY
========================================================= */

export const getBankSummary = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      res.status(401).json({
        success: false,
        code: "AUTH_REQUIRED",
        message:
          "Authentication required.",
      });
      return;
    }

    const search =
      normalizeSearch(req);

    const accounts =
      await prisma.bankAccount.findMany({
        where: {
          organizationId,
          ...(search
            ? {
                OR: [
                  {
                    bankName: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                  {
                    accountName: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                  {
                    accountNumber: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                ],
              }
            : {}),
        },
        orderBy: [
          { currency: "asc" },
          { bankName: "asc" },
          { accountName: "asc" },
        ],
      });

    const currencyTotals:
      CurrencyTotals = {};

    const data =
      accounts.map(
        (account) => {
          const openingBalance =
            Number(
              account.openingBalance,
            );

          const currentBalance =
            Number(
              account.currentBalance,
            );

          addCurrencyTotal(
            currencyTotals,
            account.currency,
            openingBalance,
            currentBalance,
          );

          return {
            id:
              account.id,
            bankName:
              account.bankName,
            accountName:
              account.accountName,
            accountNumber:
              account.accountNumber,
            branchName:
              account.branchName ??
              "-",
            currency:
              normalizeCurrency(
                account.currency,
              ),
            openingBalance:
              round(openingBalance),
            currentBalance:
              round(currentBalance),
            netMovement:
              round(
                currentBalance -
                  openingBalance,
              ),
            integrationEnabled:
              account.integrationEnabled,
            integrationProvider:
              account.integrationProvider ??
              null,
            connectionStatus:
              account.connectionStatus,
            lastSyncAt:
              account.lastSyncAt,
            status:
              account.status,
          };
        },
      );

    res.status(200).json({
      success: true,
      data,
      totals: {
        accounts:
          accounts.length,
        byCurrency:
          currencyTotals,
      },
      meta: {
        organizationId,
        search:
          search ?? null,
        generatedAt:
          new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    serializeError(
      res,
      error,
      "Failed to generate bank account summary.",
    );
  }
};

/* =========================================================
   BANK RECONCILIATION
   Statement data is not present in the current schema.
   Never report an account as reconciled without it.
========================================================= */

export const getBankReconciliation =
  async (
    req: AuthRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        res.status(401).json({
          success: false,
          code: "AUTH_REQUIRED",
          message:
            "Authentication required.",
        });
        return;
      }

      const accounts =
        await prisma.bankAccount.findMany({
          where: {
            organizationId,
          },
          orderBy: [
            { currency: "asc" },
            { bankName: "asc" },
            { accountName: "asc" },
          ],
        });

      const data =
        accounts.map(
          (account) => {
            const connected =
              account.integrationEnabled &&
              account.connectionStatus
                .trim()
                .toUpperCase() ===
                "CONNECTED";

            return {
              id:
                account.id,
              bankName:
                account.bankName,
              accountName:
                account.accountName,
              accountNumber:
                account.accountNumber,
              currency:
                normalizeCurrency(
                  account.currency,
                ),
              bookBalance:
                round(
                  Number(
                    account.currentBalance,
                  ),
                ),
              statementBalance:
                null,
              difference:
                null,
              reconciliationStatus:
                connected
                  ? "AWAITING_STATEMENT_RECONCILIATION"
                  : "NOT_CONNECTED",
              connectionStatus:
                account.connectionStatus,
              lastSyncAt:
                account.lastSyncAt,
              reconciled:
                false,
            };
          },
        );

      const byCurrency:
        Record<string, number> =
        {};

      for (
        const account of accounts
      ) {
        const currency =
          normalizeCurrency(
            account.currency,
          );

        byCurrency[currency] =
          (byCurrency[currency] ??
            0) +
          Number(
            account.currentBalance,
          );
      }

      const connectedAccounts =
        accounts.filter(
          (account) =>
            account.integrationEnabled &&
            account.connectionStatus
              .trim()
              .toUpperCase() ===
              "CONNECTED",
        ).length;

      res.status(200).json({
        success: true,
        data,
        totals: {
          bankAccounts:
            accounts.length,
          connectedAccounts,
          bookBalanceByCurrency:
            Object.fromEntries(
              Object.entries(
                byCurrency,
              ).map(
                ([currency, value]) => [
                  currency,
                  round(value),
                ],
              ),
            ),
        },
        meta: {
          organizationId,
          reconciliationStatus:
            "NOT_RECONCILED",
          reconciliationBasis:
            "Statement transactions and reconciliation records are required before statement-to-book reconciliation can be calculated.",
          generatedAt:
            new Date().toISOString(),
        },
      });
    } catch (error: unknown) {
      serializeError(
        res,
        error,
        "Failed to generate bank reconciliation report.",
      );
    }
  };

/* =========================================================
   M-PESA TRANSACTION REPORT
========================================================= */

export const getMpesaReport = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      res.status(401).json({
        success: false,
        code: "AUTH_REQUIRED",
        message:
          "Authentication required.",
      });
      return;
    }

    const dateFilter =
      getDateFilter(req);

    const search =
      normalizeSearch(req);

    const {
      page,
      limit,
      skip,
    } = getPagination(req);

    const where =
      {
        organizationId,
        ...(hasDateFilter(
          dateFilter,
        )
          ? {
              createdAt:
                dateFilter,
            }
          : {}),
        ...(search
          ? {
              OR: [
                {
                  transactionType: {
                    contains:
                      search,
                    mode: "insensitive",
                  },
                },
                {
                  phoneNumber: {
                    contains:
                      search,
                    mode: "insensitive",
                  },
                },
                {
                  mpesaReceiptNumber: {
                    contains:
                      search,
                    mode: "insensitive",
                  },
                },
                {
                  accountReference: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {}),
      } satisfies Prisma.MpesaTransactionWhereInput;

    const [
      transactions,
      total,
    ] =
      await Promise.all([
        prisma.mpesaTransaction.findMany({
          where,
          orderBy: {
            createdAt: "desc",
          },
          skip,
          take: limit,
        }),
        prisma.mpesaTransaction.count({
          where,
        }),
      ]);

    const aggregateRows =
      await prisma.mpesaTransaction.groupBy(
        {
          by: [
            "transactionType",
            "status",
            "resultCode",
          ],
          where,
          _sum: {
            amount: true,
          },
          _count: {
            _all: true,
          },
        },
      );

    let inflows = 0;
    let outflows = 0;
    let successfulTransactions = 0;
    let failedTransactions = 0;

    for (
      const row of aggregateRows
    ) {
      const successful =
        isSuccessfulMpesaTransaction(
          row.status,
          row.resultCode,
        );

      const amount =
        Number(
          row._sum.amount ?? 0,
        );

      const transactionCount =
        row._count._all;

      if (!successful) {
        failedTransactions +=
          transactionCount;
        continue;
      }

      successfulTransactions +=
        transactionCount;

      if (
        isMpesaInflow(
          row.transactionType,
        )
      ) {
        inflows += amount;
      }

      if (
        isMpesaOutflow(
          row.transactionType,
        )
      ) {
        outflows += amount;
      }
    }

    const data =
      transactions.map(
        (transaction) => {
          const successful =
            isSuccessfulMpesaTransaction(
              transaction.status,
              transaction.resultCode,
            );

          let direction =
            "OTHER";

          if (
            isMpesaInflow(
              transaction.transactionType,
            )
          ) {
            direction =
              "INFLOW";
          } else if (
            isMpesaOutflow(
              transaction.transactionType,
            )
          ) {
            direction =
              "OUTFLOW";
          }

          return {
            id:
              transaction.id,
            transactionType:
              transaction.transactionType,
            direction,
            phoneNumber:
              transaction.phoneNumber,
            amount:
              round(
                Number(
                  transaction.amount,
                ),
              ),
            receiptNumber:
              transaction.mpesaReceiptNumber ??
              null,
            accountReference:
              transaction.accountReference ??
              null,
            description:
              transaction.transactionDesc ??
              null,
            counterparty:
              transaction.counterparty ??
              null,
            transactionDate:
              transaction.transactionDate ??
              transaction.createdAt,
            status:
              transaction.status,
            resultCode:
              transaction.resultCode,
            resultDescription:
              transaction.resultDescription ??
              null,
            successful,
          };
        },
      );

    const totalPages =
      total === 0
        ? 0
        : Math.ceil(
            total / limit,
          );

    res.status(200).json({
      success: true,
      data,
      totals: {
        transactions: total,
        successfulTransactions,
        failedTransactions,
        inflows:
          round(inflows),
        outflows:
          round(outflows),
        netMovement:
          round(
            inflows -
              outflows,
          ),
      },
      pagination: {
        page,
        limit,
        total,
        totalPages,
        returned:
          data.length,
      },
      filters: {
        startDate:
          getQueryValue(
            req.query.startDate,
          ) ?? null,
        endDate:
          getQueryValue(
            req.query.endDate,
          ) ?? null,
        search:
          search ?? null,
      },
      meta: {
        organizationId,
        currency: "KES",
        generatedAt:
          new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    serializeError(
      res,
      error,
      "Failed to generate M-Pesa transaction report.",
    );
  }
};
