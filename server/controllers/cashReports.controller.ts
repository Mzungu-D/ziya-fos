import type { Request, Response } from "express";
import prisma from "../config/prisma";

/* =========================================================
   HELPERS
========================================================= */

const parseDate = (
  value: unknown,
  endOfDay = false
): Date | null => {
  if (!value) {
    return null;
  }

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }

  return date;
};

/* =========================================================
   CASH POSITION REPORT
========================================================= */

export const getCashPosition = async (
  req: Request,
  res: Response
) => {
  try {
    const asOfDate =
      parseDate(req.query.asOfDate, true) ?? new Date();

    const cashAccounts = await prisma.account.findMany({
      where: {
        OR: [
          {
            name: {
              contains: "cash",
              mode: "insensitive",
            },
          },
          {
            name: {
              contains: "bank",
              mode: "insensitive",
            },
          },
          {
            name: {
              contains: "mpesa",
              mode: "insensitive",
            },
          },
          {
            name: {
              contains: "m-pesa",
              mode: "insensitive",
            },
          },
        ],
      },

      orderBy: {
        code: "asc",
      },
    });

    const entries = await prisma.journalEntry.findMany({
      where: {
        status: "POSTED",

        transactionDate: {
          lte: asOfDate,
        },
      },

      select: {
        debitAccountId: true,
        creditAccountId: true,
        amount: true,
      },
    });

    const balances = new Map<
      string,
      {
        debit: number;
        credit: number;
      }
    >();

    for (const entry of entries) {
      const debitBalance = balances.get(entry.debitAccountId) ?? {
        debit: 0,
        credit: 0,
      };

      debitBalance.debit += entry.amount;

      balances.set(
        entry.debitAccountId,
        debitBalance
      );

      const creditBalance = balances.get(entry.creditAccountId) ?? {
        debit: 0,
        credit: 0,
      };

      creditBalance.credit += entry.amount;

      balances.set(
        entry.creditAccountId,
        creditBalance
      );
    }

    const ledgerCash = cashAccounts.map((account) => {
      const balance = balances.get(account.id) ?? {
        debit: 0,
        credit: 0,
      };

      return {
        id: account.id,
        code: account.code,
        name: account.name,
        debit: balance.debit,
        credit: balance.credit,
        balance: balance.debit - balance.credit,
      };
    });

    const bankAccounts = await prisma.bankAccount.findMany({
      where: {
        status: "ACTIVE",
      },

      orderBy: {
        bankName: "asc",
      },

      select: {
        id: true,
        bankName: true,
        accountName: true,
        accountNumber: true,
        currency: true,
        currentBalance: true,
        connectionStatus: true,
        lastSyncAt: true,
      },
    });

    const ledgerTotal = ledgerCash.reduce(
      (total, account) => total + account.balance,
      0
    );

    const bankTotal = bankAccounts.reduce(
      (total, account) => total + account.currentBalance,
      0
    );

    return res.status(200).json({
      success: true,

      ledgerCash,

      bankAccounts,

      totals: {
        ledgerCash: ledgerTotal,
        bankAccounts: bankTotal,
      },

      meta: {
        asOfDate: asOfDate.toISOString(),
        currency: "KES",
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "CASH POSITION REPORT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to generate cash position report",
    });
  }
};

/* =========================================================
   BANK ACCOUNT SUMMARY
========================================================= */

export const getBankAccountSummary = async (
  _req: Request,
  res: Response
) => {
  try {
    const bankAccounts = await prisma.bankAccount.findMany({
      orderBy: [
        {
          bankName: "asc",
        },
        {
          accountName: "asc",
        },
      ],

      select: {
        id: true,
        bankName: true,
        accountName: true,
        accountNumber: true,
        branchName: true,
        currency: true,
        openingBalance: true,
        currentBalance: true,
        integrationEnabled: true,
        integrationProvider: true,
        connectionStatus: true,
        lastSyncAt: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const activeAccounts = bankAccounts.filter(
      (account) => account.status === "ACTIVE"
    );

    const totalOpeningBalance = activeAccounts.reduce(
      (total, account) => total + account.openingBalance,
      0
    );

    const totalCurrentBalance = activeAccounts.reduce(
      (total, account) => total + account.currentBalance,
      0
    );

    return res.status(200).json({
      success: true,

      accounts: bankAccounts,

      totals: {
        accounts: bankAccounts.length,
        activeAccounts: activeAccounts.length,
        openingBalance: totalOpeningBalance,
        currentBalance: totalCurrentBalance,
        movement:
          totalCurrentBalance - totalOpeningBalance,
      },

      meta: {
        currency: "KES",
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "BANK ACCOUNT SUMMARY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to generate bank account summary",
    });
  }
};

/* =========================================================
   BANK RECONCILIATION REPORT
========================================================= */

export const getBankReconciliation = async (
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

      select: {
        id: true,
        bankName: true,
        accountName: true,
        accountNumber: true,
        branchName: true,
        currency: true,
        openingBalance: true,
        currentBalance: true,
        integrationEnabled: true,
        integrationProvider: true,
        connectionStatus: true,
        lastSyncAt: true,
      },
    });

    const accounts = bankAccounts.map((account) => ({
      id: account.id,
      bankName: account.bankName,
      accountName: account.accountName,
      accountNumber: account.accountNumber,
      branchName: account.branchName,
      currency: account.currency,

      bookBalance: account.currentBalance,

      statementBalance: null as number | null,
      difference: null as number | null,

      integrationEnabled: account.integrationEnabled,
      integrationProvider: account.integrationProvider,
      connectionStatus: account.connectionStatus,
      lastSyncAt: account.lastSyncAt,

      reconciliationStatus: "AWAITING_STATEMENT",
    }));

    const totalBookBalance = accounts.reduce(
      (total, account) => total + account.bookBalance,
      0
    );

    return res.status(200).json({
      success: true,

      accounts,

      totals: {
        accounts: accounts.length,
        bookBalance: totalBookBalance,
        reconciled: 0,
        pending: accounts.length,
      },

      meta: {
        currency: "KES",
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
    const startDate = parseDate(req.query.startDate);

    const endDate = parseDate(
      req.query.endDate,
      true
    );

    if (req.query.startDate && !startDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid start date",
      });
    }

    if (req.query.endDate && !endDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid end date",
      });
    }

    if (
      startDate &&
      endDate &&
      startDate > endDate
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Start date cannot be after end date",
      });
    }

    const transactions =
      await prisma.mpesaTransaction.findMany({
        where:
          startDate || endDate
            ? {
                createdAt: {
                  ...(startDate
                    ? {
                        gte: startDate,
                      }
                    : {}),

                  ...(endDate
                    ? {
                        lte: endDate,
                      }
                    : {}),
                },
              }
            : undefined,

        orderBy: {
          createdAt: "desc",
        },

        select: {
          id: true,
          transactionType: true,
          organizationId: true,
          merchantRequestId: true,
          checkoutRequestId: true,
          phoneNumber: true,
          amount: true,
          mpesaReceiptNumber: true,
          transactionDate: true,
          resultCode: true,
          resultDescription: true,
          accountReference: true,
          transactionDesc: true,
          counterparty: true,
          status: true,
          createdAt: true,
        },
      });

    const successfulTransactions =
      transactions.filter(
        (transaction) =>
          transaction.status === "SUCCESS" ||
          transaction.resultCode === 0
      );

    const pendingTransactions =
      transactions.filter(
        (transaction) =>
          transaction.status === "PENDING"
      );

    const failedTransactions =
      transactions.filter(
        (transaction) =>
          transaction.status === "FAILED" ||
          (
            transaction.resultCode !== null &&
            transaction.resultCode !== 0
          )
      );

    const totalAmount = transactions.reduce(
      (total, transaction) =>
        total + transaction.amount,
      0
    );

    const successfulAmount =
      successfulTransactions.reduce(
        (total, transaction) =>
          total + transaction.amount,
        0
      );

    return res.status(200).json({
      success: true,

      transactions,

      totals: {
        transactions: transactions.length,
        successful: successfulTransactions.length,
        pending: pendingTransactions.length,
        failed: failedTransactions.length,
        totalAmount,
        successfulAmount,
      },

      meta: {
        startDate:
          startDate?.toISOString() ?? null,

        endDate:
          endDate?.toISOString() ?? null,

        currency: "KES",

        generatedAt:
          new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "MPESA TRANSACTION REPORT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate M-Pesa transaction report",
    });
  }
};