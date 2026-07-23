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

const round = (value: number): number =>
  Math.round(value * 100) / 100;

const getDateFilter = (req: Request): DateFilter => {
  const filter: DateFilter = {};

  if (req.query.startDate) {
    const startDate = new Date(
      String(req.query.startDate)
    );

    if (!Number.isNaN(startDate.getTime())) {
      startDate.setHours(0, 0, 0, 0);
      filter.gte = startDate;
    }
  }

  if (req.query.endDate) {
    const endDate = new Date(
      String(req.query.endDate)
    );

    if (!Number.isNaN(endDate.getTime())) {
      endDate.setHours(23, 59, 59, 999);
      filter.lte = endDate;
    }
  }

  return filter;
};

const hasDateFilter = (
  filter: DateFilter
): boolean => Boolean(filter.gte || filter.lte);

/* =========================================================
   GENERAL LEDGER REPORT
========================================================= */

export const getGeneralLedgerReport = async (
  req: Request,
  res: Response
) => {
  try {
    const dateFilter = getDateFilter(req);

    const accountId =
      typeof req.query.accountId === "string"
        ? req.query.accountId
        : undefined;

    const entries =
      await prisma.journalEntry.findMany({
        where: {
          status: "POSTED",

          ...(hasDateFilter(dateFilter)
            ? {
                transactionDate: dateFilter,
              }
            : {}),

          ...(accountId
            ? {
                OR: [
                  {
                    debitAccountId: accountId,
                  },
                  {
                    creditAccountId: accountId,
                  },
                ],
              }
            : {}),
        },

        include: {
          debitAccount: true,
          creditAccount: true,
        },

        orderBy: [
          {
            transactionDate: "asc",
          },
          {
            createdAt: "asc",
          },
        ],
      });

    const data = entries.flatMap((entry) => [
      {
        transactionDate: entry.transactionDate,
        reference: entry.reference,
        description: entry.description,
        accountCode: entry.debitAccount.code,
        accountName: entry.debitAccount.name,
        debit: round(entry.amount),
        credit: 0,
        status: entry.status,
      },

      {
        transactionDate: entry.transactionDate,
        reference: entry.reference,
        description: entry.description,
        accountCode: entry.creditAccount.code,
        accountName: entry.creditAccount.name,
        debit: 0,
        credit: round(entry.amount),
        status: entry.status,
      },
    ]);

    const filteredData = accountId
      ? data.filter((row) => {
          const account = entries.find(
            (entry) =>
              (entry.debitAccountId === accountId &&
                entry.debitAccount.code ===
                  row.accountCode) ||
              (entry.creditAccountId === accountId &&
                entry.creditAccount.code ===
                  row.accountCode)
          );

          return Boolean(account);
        })
      : data;

    const totalDebit = filteredData.reduce(
      (sum, row) => sum + row.debit,
      0
    );

    const totalCredit = filteredData.reduce(
      (sum, row) => sum + row.credit,
      0
    );

    return res.status(200).json({
      success: true,

      data: filteredData,

      totals: {
        debit: round(totalDebit),
        credit: round(totalCredit),
        difference: round(
          totalDebit - totalCredit
        ),
      },

      meta: {
        journalEntries: entries.length,
        ledgerLines: filteredData.length,
        currency: "KES",
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "GENERAL LEDGER REPORT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate general ledger report",
    });
  }
};

/* =========================================================
   JOURNAL REPORT
========================================================= */

export const getJournalReport = async (
  req: Request,
  res: Response
) => {
  try {
    const dateFilter = getDateFilter(req);

    const status =
      typeof req.query.status === "string"
        ? req.query.status
        : undefined;

    const entries =
      await prisma.journalEntry.findMany({
        where: {
          ...(status
            ? {
                status: status.toUpperCase(),
              }
            : {}),

          ...(hasDateFilter(dateFilter)
            ? {
                transactionDate: dateFilter,
              }
            : {}),
        },

        include: {
          debitAccount: true,
          creditAccount: true,
        },

        orderBy: {
          transactionDate: "desc",
        },
      });

    const data = entries.map((entry) => ({
      id: entry.id,
      transactionDate: entry.transactionDate,
      reference: entry.reference,
      description: entry.description,

      debitAccount:
        `${entry.debitAccount.code} - ${entry.debitAccount.name}`,

      creditAccount:
        `${entry.creditAccount.code} - ${entry.creditAccount.name}`,

      amount: round(entry.amount),

      status: entry.status,

      createdBy: entry.createdBy ?? "-",
      postedBy: entry.postedBy ?? "-",
      approvedBy: entry.approvedBy ?? "-",

      postedAt: entry.postedAt,
      approvedAt: entry.approvedAt,

      notes: entry.notes ?? "-",
    }));

    const totalAmount = entries.reduce(
      (sum, entry) => sum + entry.amount,
      0
    );

    const postedEntries = entries.filter(
      (entry) => entry.status === "POSTED"
    ).length;

    const draftEntries = entries.filter(
      (entry) => entry.status === "DRAFT"
    ).length;

    const reversedEntries = entries.filter(
      (entry) => entry.status === "REVERSED"
    ).length;

    return res.status(200).json({
      success: true,

      data,

      totals: {
        entries: entries.length,
        amount: round(totalAmount),
        postedEntries,
        draftEntries,
        reversedEntries,
      },

      meta: {
        currency: "KES",
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "JOURNAL REPORT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate journal report",
    });
  }
};

/* =========================================================
   AUDIT TRAIL REPORT
========================================================= */

export const getAuditTrailReport = async (
  req: Request,
  res: Response
) => {
  try {
    const dateFilter = getDateFilter(req);

    const module =
      typeof req.query.module === "string"
        ? req.query.module
        : undefined;

    const user =
      typeof req.query.user === "string"
        ? req.query.user
        : undefined;

    const records =
      await prisma.auditTrail.findMany({
        where: {
          ...(module
            ? {
                module: {
                  contains: module,
                  mode: "insensitive",
                },
              }
            : {}),

          ...(user
            ? {
                user: {
                  contains: user,
                  mode: "insensitive",
                },
              }
            : {}),

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

    const data = records.map((record) => ({
      id: record.id,
      date: record.createdAt,
      user: record.user,
      action: record.action,
      module: record.module,
      details: record.details,
    }));

    const users = new Set(
      records.map((record) => record.user)
    );

    const modules = new Set(
      records.map((record) => record.module)
    );

    return res.status(200).json({
      success: true,

      data,

      totals: {
        auditEvents: records.length,
        users: users.size,
        modules: modules.size,
      },

      meta: {
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "AUDIT TRAIL REPORT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate audit trail report",
    });
  }
};

/* =========================================================
   CUSTOM FINANCIAL REPORT

   Provides controlled report selection.
   It does NOT accept arbitrary SQL/database queries.
========================================================= */

export const getCustomReport = async (
  req: Request,
  res: Response
) => {
  try {
    const dateFilter = getDateFilter(req);

    const accountType =
      typeof req.query.accountType === "string"
        ? req.query.accountType.toUpperCase()
        : undefined;

    const accountId =
      typeof req.query.accountId === "string"
        ? req.query.accountId
        : undefined;

    const accounts =
      await prisma.account.findMany({
        where: {
          ...(accountType
            ? {
                type: accountType,
              }
            : {}),

          ...(accountId
            ? {
                id: accountId,
              }
            : {}),
        },

        orderBy: {
          code: "asc",
        },
      });

    const accountIds = new Set(
      accounts.map((account) => account.id)
    );

    const entries =
      await prisma.journalEntry.findMany({
        where: {
          status: "POSTED",

          ...(hasDateFilter(dateFilter)
            ? {
                transactionDate: dateFilter,
              }
            : {}),
        },

        select: {
          debitAccountId: true,
          creditAccountId: true,
          amount: true,
        },
      });

    const data = accounts.map((account) => {
      let debit = 0;
      let credit = 0;

      for (const entry of entries) {
        if (
          entry.debitAccountId === account.id
        ) {
          debit += entry.amount;
        }

        if (
          entry.creditAccountId === account.id
        ) {
          credit += entry.amount;
        }
      }

      return {
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        debit: round(debit),
        credit: round(credit),
        netBalance: round(debit - credit),
      };
    });

    const filteredData = data.filter(
      (row) =>
        row.debit !== 0 ||
        row.credit !== 0
    );

    const totalDebit = filteredData.reduce(
      (sum, row) => sum + row.debit,
      0
    );

    const totalCredit = filteredData.reduce(
      (sum, row) => sum + row.credit,
      0
    );

    return res.status(200).json({
      success: true,

      data: filteredData,

      totals: {
        accounts: filteredData.length,
        debit: round(totalDebit),
        credit: round(totalCredit),
        netBalance: round(
          totalDebit - totalCredit
        ),
      },

      meta: {
        accountType: accountType ?? "ALL",
        accountId: accountId ?? "ALL",
        selectedAccounts: accountIds.size,
        currency: "KES",
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "CUSTOM REPORT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate custom financial report",
    });
  }
};