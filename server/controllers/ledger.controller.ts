import { Response } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

const EFFECTIVE_STATUSES = ["POSTED", "APPROVED"] as const;
const TOLERANCE = 0.01;

type LedgerLine = {
  id: string;
  journalId: string;
  date: Date;
  transactionDate: Date;
  reference: string;
  description: string;
  accountId: string;
  accountCode: string;
  account: string;
  accountType: string;
  debit: number;
  credit: number;
  balance: number;
  normalBalance: number;
  balanceSide: "DEBIT" | "CREDIT" | "ZERO";
  status: string;
  createdBy: string | null;
  postedBy: string | null;
  approvedBy: string | null;
  reversedBy: string | null;
  reversalOfId: string | null;
  reversalReason: string | null;
  memo: string | null;
  lineNumber: number;
  counterpartyAccounts: Array<{
    accountId: string;
    accountCode: string;
    account: string;
  }>;
};

function getTenantContext(req: AuthRequest) {
  if (!req.user?.userId || !req.user?.organizationId) return null;

  return {
    userId: req.user.userId,
    organizationId: req.user.organizationId,
  };
}

function parseDate(value: unknown, endOfDay = false): Date | undefined {
  if (value === undefined || value === null || String(value).trim() === "") {
    return undefined;
  }

  const raw = String(value).trim();

  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(
        `${raw}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`
      )
    : new Date(raw);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getNormalBalance(accountType: string, signedBalance: number) {
  return ["LIABILITY", "EQUITY", "REVENUE"].includes(accountType)
    ? -signedBalance
    : signedBalance;
}

function getBalanceSide(
  signedBalance: number
): "DEBIT" | "CREDIT" | "ZERO" {
  if (Math.abs(signedBalance) < TOLERANCE) return "ZERO";
  return signedBalance > 0 ? "DEBIT" : "CREDIT";
}

async function loadLedgerEntries(
  organizationId: string,
  options: {
    accountId?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string;
  }
) {
  return prisma.journalEntry.findMany({
    where: {
      organizationId,
      status: { in: [...EFFECTIVE_STATUSES] },

      ...(options.startDate || options.endDate
        ? {
            transactionDate: {
              ...(options.startDate ? { gte: options.startDate } : {}),
              ...(options.endDate ? { lte: options.endDate } : {}),
            },
          }
        : {}),

      ...(options.accountId
        ? {
            lines: {
              some: {
                accountId: options.accountId,
              },
            },
          }
        : {}),

      ...(options.search
        ? {
            OR: [
              {
                reference: {
                  contains: options.search,
                  mode: "insensitive",
                },
              },
              {
                description: {
                  contains: options.search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    },

    select: {
      id: true,
      reference: true,
      description: true,
      status: true,
      createdBy: true,
      postedBy: true,
      approvedBy: true,
      reversedBy: true,
      reversalOfId: true,
      reversalReason: true,
      transactionDate: true,
      createdAt: true,

      lines: {
        orderBy: {
          lineNumber: "asc",
        },

        select: {
          id: true,
          journalEntryId: true,
          accountId: true,
          lineNumber: true,
          memo: true,
          debit: true,
          credit: true,

          account: {
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
              organizationId: true,
            },
          },
        },
      },
    },

    orderBy: [
      { transactionDate: "asc" },
      { createdAt: "asc" },
      { id: "asc" },
    ],
  });
}

export const getAllLedger = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const tenant = getTenantContext(req);

    if (!tenant) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const startDate = parseDate(req.query.startDate);
    const endDate = parseDate(req.query.endDate, true);

    if (
      (req.query.startDate && !startDate) ||
      (req.query.endDate && !endDate)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid startDate or endDate.",
      });
    }

    if (startDate && endDate && startDate > endDate) {
      return res.status(400).json({
        success: false,
        message: "startDate cannot be after endDate.",
      });
    }

    const accountId = req.query.accountId
      ? String(req.query.accountId)
      : undefined;

    const search = req.query.search
      ? String(req.query.search).trim()
      : undefined;

    if (accountId) {
      const account = await prisma.account.findFirst({
        where: {
          id: accountId,
          organizationId: tenant.organizationId,
        },
        select: { id: true },
      });

      if (!account) {
        return res.status(404).json({
          success: false,
          message: "Account not found",
        });
      }
    }

    /*
     * The opening balance must NEVER be affected by the search filter.
     * It represents the account position immediately before the
     * selected reporting period.
     */
    const openingBalances = new Map<string, number>();

    if (startDate) {
      const openingEntries = await loadLedgerEntries(
        tenant.organizationId,
        {
          accountId,
          endDate: new Date(startDate.getTime() - 1),
        }
      );

      for (const entry of openingEntries) {
        for (const line of entry.lines) {
          if (accountId && line.accountId !== accountId) continue;

          const debit = Number(line.debit);
          const credit = Number(line.credit);

          if (!Number.isFinite(debit) || !Number.isFinite(credit)) {
            continue;
          }

          openingBalances.set(
            line.accountId,
            (openingBalances.get(line.accountId) ?? 0) +
              debit -
              credit
          );
        }
      }
    }

    const entries = await loadLedgerEntries(
      tenant.organizationId,
      {
        accountId,
        startDate,
        endDate,
        search,
      }
    );

    const balances = new Map(openingBalances);
    const ledgerEntries: LedgerLine[] = [];

    for (const entry of entries) {
      for (const line of entry.lines) {
        if (accountId && line.accountId !== accountId) continue;

        const debit = Number(line.debit);
        const credit = Number(line.credit);

        if (!Number.isFinite(debit) || !Number.isFinite(credit)) {
          continue;
        }

        const previous = balances.get(line.accountId) ?? 0;
        const balance = previous + debit - credit;

        balances.set(line.accountId, balance);

        ledgerEntries.push({
          id: line.id,
          journalId: entry.id,

          date: entry.transactionDate,
          transactionDate: entry.transactionDate,

          reference: entry.reference,
          description: entry.description,

          accountId: line.account.id,
          accountCode: line.account.code,
          account: line.account.name,
          accountType: line.account.type,

          debit,
          credit,

          balance: round(balance),
          normalBalance: round(
            getNormalBalance(line.account.type, balance)
          ),
          balanceSide: getBalanceSide(balance),

          status: entry.status,

          createdBy: entry.createdBy,
          postedBy: entry.postedBy,
          approvedBy: entry.approvedBy,
          reversedBy: entry.reversedBy,

          reversalOfId: entry.reversalOfId,
          reversalReason: entry.reversalReason,

          memo: line.memo,
          lineNumber: line.lineNumber,

          counterpartyAccounts: entry.lines
            .filter((other) => other.accountId !== line.accountId)
            .map((other) => ({
              accountId: other.account.id,
              accountCode: other.account.code,
              account: other.account.name,
            })),
        });
      }
    }

    const totalDebit = ledgerEntries.reduce(
      (sum, row) => sum + row.debit,
      0
    );

    const totalCredit = ledgerEntries.reduce(
      (sum, row) => sum + row.credit,
      0
    );

    return res.status(200).json({
      success: true,

      organizationId: tenant.organizationId,

      entries: ledgerEntries,

      openingBalances: [...openingBalances.entries()].map(
        ([accountId, balance]) => ({
          accountId,
          balance: round(balance),
        })
      ),

      accountBalances: [...balances.entries()].map(
        ([accountId, balance]) => ({
          accountId,
          balance: round(balance),
        })
      ),

      totals: {
        debit: round(totalDebit),
        credit: round(totalCredit),
        difference: round(totalDebit - totalCredit),
        balanced:
          Math.abs(totalDebit - totalCredit) < TOLERANCE,
      },

      filters: {
        accountId: accountId ?? null,
        startDate: startDate?.toISOString() ?? null,
        endDate: endDate?.toISOString() ?? null,
        search: search ?? null,
      },

      meta: {
        effectiveStatuses: [...EFFECTIVE_STATUSES],
        source: "JournalEntryLine",
        currency: "KES",
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("GENERAL LEDGER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch general ledger",
    });
  }
};

export const getLedger = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const tenant = getTenantContext(req);

    if (!tenant) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const accountId = String(req.params.accountId);

    const account = await prisma.account.findFirst({
      where: {
        id: accountId,
        organizationId: tenant.organizationId,
      },

      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        description: true,
      },
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    const startDate = parseDate(req.query.startDate);
    const endDate = parseDate(req.query.endDate, true);

    if (
      (req.query.startDate && !startDate) ||
      (req.query.endDate && !endDate)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid startDate or endDate.",
      });
    }

    if (startDate && endDate && startDate > endDate) {
      return res.status(400).json({
        success: false,
        message: "startDate cannot be after endDate.",
      });
    }

    let openingBalance = 0;

    if (startDate) {
      const openingEntries = await loadLedgerEntries(
        tenant.organizationId,
        {
          accountId,
          endDate: new Date(startDate.getTime() - 1),
        }
      );

      for (const entry of openingEntries) {
        for (const line of entry.lines) {
          if (line.accountId !== accountId) continue;

          const debit = Number(line.debit);
          const credit = Number(line.credit);

          if (!Number.isFinite(debit) || !Number.isFinite(credit)) {
            continue;
          }

          openingBalance += debit - credit;
        }
      }
    }

    const entries = await loadLedgerEntries(
      tenant.organizationId,
      {
        accountId,
        startDate,
        endDate,
      }
    );

    let balance = openingBalance;

    const ledgerEntries: LedgerLine[] = [];

    for (const entry of entries) {
      const matchingLines = entry.lines.filter(
        (item) => item.accountId === accountId
      );

      for (const line of matchingLines) {
        const debit = Number(line.debit);
      const credit = Number(line.credit);

      if (!Number.isFinite(debit) || !Number.isFinite(credit)) {
        continue;
      }

      balance += debit - credit;

      ledgerEntries.push({
        id: line.id,
        journalId: entry.id,

        date: entry.transactionDate,
        transactionDate: entry.transactionDate,

        reference: entry.reference,
        description: entry.description,

        accountId: account.id,
        accountCode: account.code,
        account: account.name,
        accountType: account.type,

        debit,
        credit,

        balance: round(balance),
        normalBalance: round(
          getNormalBalance(account.type, balance)
        ),
        balanceSide: getBalanceSide(balance),

        status: entry.status,

        createdBy: entry.createdBy,
        postedBy: entry.postedBy,
        approvedBy: entry.approvedBy,
        reversedBy: entry.reversedBy,

        reversalOfId: entry.reversalOfId,
        reversalReason: entry.reversalReason,

        memo: line.memo,
        lineNumber: line.lineNumber,

        counterpartyAccounts: entry.lines
          .filter((other) => other.accountId !== accountId)
          .map((other) => ({
            accountId: other.account.id,
            accountCode: other.account.code,
            account: other.account.name,
          })),
        });
      }
    }

    const totalDebit = ledgerEntries.reduce(
      (sum, row) => sum + row.debit,
      0
    );

    const totalCredit = ledgerEntries.reduce(
      (sum, row) => sum + row.credit,
      0
    );

    return res.status(200).json({
      success: true,

      organizationId: tenant.organizationId,

      account,

      entries: ledgerEntries,

      openingBalance: round(openingBalance),

      totals: {
        debit: round(totalDebit),
        credit: round(totalCredit),
        balance: round(balance),
        movement: round(totalDebit - totalCredit),
      },

      meta: {
        effectiveStatuses: [...EFFECTIVE_STATUSES],
        source: "JournalEntryLine",
        currency: "KES",
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("ACCOUNT LEDGER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch ledger",
    });
  }
};

