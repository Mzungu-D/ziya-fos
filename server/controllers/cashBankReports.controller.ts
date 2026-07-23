import type { Request, Response } from "express";
import prisma from "../config/prisma";

/* =========================================================
   TYPES
========================================================= */

type DateFilter = {
  gte?: Date;
  lte?: Date;
};

/* =========================================================
   HELPERS
========================================================= */

const round = (value: number): number => {
  return Math.round(value * 100) / 100;
};

const getDateFilter = (req: Request): DateFilter => {
  const { startDate, endDate } = req.query;

  const filter: DateFilter = {};

  if (startDate) {
    const parsed = new Date(String(startDate));

    if (!Number.isNaN(parsed.getTime())) {
      parsed.setHours(0, 0, 0, 0);
      filter.gte = parsed;
    }
  }

  if (endDate) {
    const parsed = new Date(String(endDate));

    if (!Number.isNaN(parsed.getTime())) {
      parsed.setHours(23, 59, 59, 999);
      filter.lte = parsed;
    }
  }

  return filter;
};

const hasDateFilter = (filter: DateFilter): boolean => {
  return Boolean(filter.gte || filter.lte);
};

const isSuccessfulMpesaTransaction = (
  status: string,
  resultCode: number | null
): boolean => {
  const normalizedStatus = status.toUpperCase();

  return (
    normalizedStatus === "SUCCESS" ||
    normalizedStatus === "COMPLETED" ||
    resultCode === 0
  );
};

const isMpesaInflow = (transactionType: string): boolean => {
  const type = transactionType.toUpperCase();

  return (
    type.includes("C2B") ||
    type.includes("RECEIVE") ||
    type.includes("RECEIVED") ||
    type.includes("CREDIT") ||
    type.includes("INFLOW")
  );
};

const isMpesaOutflow = (transactionType: string): boolean => {
  const type = transactionType.toUpperCase();

  return (
    type.includes("B2C") ||
    type.includes("SEND") ||
    type.includes("SENT") ||
    type.includes("DEBIT") ||
    type.includes("OUTFLOW")
  );
};

/* =========================================================
   CASH POSITION
========================================================= */

export const getCashPosition = async (
  _req: Request,
  res: Response
) => {
  try {
    const bankAccounts = await prisma.bankAccount.findMany({
      where: {
        status: "ACTIVE",
      },

      orderBy: {
        bankName: "asc",
      },
    });

    const mpesaTransactions =
      await prisma.mpesaTransaction.findMany({
        orderBy: {
          createdAt: "asc",
        },
      });

    let mpesaInflows = 0;
    let mpesaOutflows = 0;

    for (const transaction of mpesaTransactions) {
      if (
        !isSuccessfulMpesaTransaction(
          transaction.status,
          transaction.resultCode
        )
      ) {
        continue;
      }

      if (isMpesaInflow(transaction.transactionType)) {
        mpesaInflows += transaction.amount;
      }

      if (isMpesaOutflow(transaction.transactionType)) {
        mpesaOutflows += transaction.amount;
      }
    }

    const mpesaBalance = mpesaInflows - mpesaOutflows;

    const totalBankBalance = bankAccounts.reduce(
      (sum, account) => sum + account.currentBalance,
      0
    );

    const totalLiquidity =
      totalBankBalance + mpesaBalance;

    const data = [
      ...bankAccounts.map((account) => ({
        source: "BANK",
        institution: account.bankName,
        accountName: account.accountName,
        accountNumber: account.accountNumber,
        currency: account.currency,
        balance: round(account.currentBalance),
        status: account.status,
      })),

      {
        source: "MPESA",
        institution: "M-Pesa",
        accountName: "M-Pesa",
        accountNumber: "-",
        currency: "KES",
        balance: round(mpesaBalance),
        status: "ACTIVE",
      },
    ];

    return res.status(200).json({
      success: true,

      data,

      totals: {
        bankBalance: round(totalBankBalance),
        mpesaBalance: round(mpesaBalance),
        totalLiquidity: round(totalLiquidity),
      },

      meta: {
        bankAccounts: bankAccounts.length,
        currency: "KES",
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("CASH POSITION REPORT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate cash position report",
    });
  }
};

/* =========================================================
   BANK ACCOUNT SUMMARY
========================================================= */

export const getBankSummary = async (
  _req: Request,
  res: Response
) => {
  try {
    const accounts = await prisma.bankAccount.findMany({
      orderBy: [
        {
          bankName: "asc",
        },
        {
          accountName: "asc",
        },
      ],
    });

    const data = accounts.map((account) => {
      const movement =
        account.currentBalance - account.openingBalance;

      return {
        id: account.id,
        bankName: account.bankName,
        accountName: account.accountName,
        accountNumber: account.accountNumber,
        branchName: account.branchName ?? "-",
        currency: account.currency,
        openingBalance: round(account.openingBalance),
        currentBalance: round(account.currentBalance),
        netMovement: round(movement),
        integrationEnabled: account.integrationEnabled,
        integrationProvider:
          account.integrationProvider ?? "-",
        connectionStatus: account.connectionStatus,
        lastSyncAt: account.lastSyncAt,
        status: account.status,
      };
    });

    const totalOpeningBalance = accounts.reduce(
      (sum, account) => sum + account.openingBalance,
      0
    );

    const totalCurrentBalance = accounts.reduce(
      (sum, account) => sum + account.currentBalance,
      0
    );

    return res.status(200).json({
      success: true,

      data,

      totals: {
        accounts: accounts.length,
        openingBalance: round(totalOpeningBalance),
        currentBalance: round(totalCurrentBalance),
        netMovement: round(
          totalCurrentBalance - totalOpeningBalance
        ),
      },

      meta: {
        currency: "KES",
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("BANK SUMMARY REPORT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate bank account summary",
    });
  }
};

/* =========================================================
   BANK RECONCILIATION
========================================================= */

export const getBankReconciliation = async (
  _req: Request,
  res: Response
) => {
  try {
    const accounts = await prisma.bankAccount.findMany({
      orderBy: {
        bankName: "asc",
      },
    });

    /*
     * Current schema does not yet contain imported bank
     * statement lines or reconciliation records.
     *
     * We therefore report the system/book balances and
     * integration state without falsely marking accounts
     * as reconciled.
     */

    const data = accounts.map((account) => ({
      id: account.id,
      bankName: account.bankName,
      accountName: account.accountName,
      accountNumber: account.accountNumber,
      currency: account.currency,

      bookBalance: round(account.currentBalance),

      statementBalance: null,

      difference: null,

      reconciliationStatus:
        account.integrationEnabled &&
        account.connectionStatus === "CONNECTED"
          ? "AWAITING_STATEMENT_RECONCILIATION"
          : "NOT_CONNECTED",

      connectionStatus: account.connectionStatus,

      lastSyncAt: account.lastSyncAt,
    }));

    const totalBookBalance = accounts.reduce(
      (sum, account) => sum + account.currentBalance,
      0
    );

    const connectedAccounts = accounts.filter(
      (account) =>
        account.integrationEnabled &&
        account.connectionStatus === "CONNECTED"
    ).length;

    return res.status(200).json({
      success: true,

      data,

      totals: {
        bankAccounts: accounts.length,
        connectedAccounts,
        bookBalance: round(totalBookBalance),
      },

      meta: {
        reconciliationBasis:
          "Bank statement transaction records are required before statement-to-book reconciliation can be calculated.",

        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "BANK RECONCILIATION REPORT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to generate bank reconciliation report",
    });
  }
};

/* =========================================================
   M-PESA TRANSACTION REPORT
========================================================= */

export const getMpesaReport = async (
  req: Request,
  res: Response
) => {
  try {
    const dateFilter = getDateFilter(req);

    const transactions =
      await prisma.mpesaTransaction.findMany({
        where: {
          ...(hasDateFilter(dateFilter)
            ? {
                createdAt: dateFilter,
              }
            : {}),
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    const data = transactions.map((transaction) => {
      const successful = isSuccessfulMpesaTransaction(
        transaction.status,
        transaction.resultCode
      );

      let direction = "OTHER";

      if (isMpesaInflow(transaction.transactionType)) {
        direction = "INFLOW";
      } else if (
        isMpesaOutflow(transaction.transactionType)
      ) {
        direction = "OUTFLOW";
      }

      return {
        id: transaction.id,
        transactionType: transaction.transactionType,
        direction,
        phoneNumber: transaction.phoneNumber,
        amount: round(transaction.amount),

        receiptNumber:
          transaction.mpesaReceiptNumber ?? "-",

        accountReference:
          transaction.accountReference ?? "-",

        description:
          transaction.transactionDesc ?? "-",

        counterparty:
          transaction.counterparty ?? "-",

        transactionDate:
          transaction.transactionDate ??
          transaction.createdAt,

        status: transaction.status,

        resultCode: transaction.resultCode,

        resultDescription:
          transaction.resultDescription ?? "-",

        successful,
      };
    });

    let inflows = 0;
    let outflows = 0;
    let successfulTransactions = 0;
    let failedTransactions = 0;

    for (const transaction of transactions) {
      const successful = isSuccessfulMpesaTransaction(
        transaction.status,
        transaction.resultCode
      );

      if (!successful) {
        failedTransactions += 1;
        continue;
      }

      successfulTransactions += 1;

      if (isMpesaInflow(transaction.transactionType)) {
        inflows += transaction.amount;
      }

      if (isMpesaOutflow(transaction.transactionType)) {
        outflows += transaction.amount;
      }
    }

    return res.status(200).json({
      success: true,

      data,

      totals: {
        transactions: transactions.length,
        successfulTransactions,
        failedTransactions,
        inflows: round(inflows),
        outflows: round(outflows),
        netMovement: round(inflows - outflows),
      },

      meta: {
        currency: "KES",
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("MPESA REPORT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate M-Pesa transaction report",
    });
  }
};