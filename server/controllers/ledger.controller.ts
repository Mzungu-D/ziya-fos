import { Response } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   HELPERS
========================================================= */

function getTenantContext(req: AuthRequest) {
  if (!req.user?.userId || !req.user?.organizationId) {
    return null;
  }

  return {
    userId: req.user.userId,
    organizationId: req.user.organizationId,
  };
}

/* =========================================================
   GET FULL GENERAL LEDGER
========================================================= */

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

    /*
     * SECURITY:
     * The organization comes exclusively from the verified JWT.
     * Never trust an organizationId supplied by the browser.
     */
    const entries = await prisma.journalEntry.findMany({
      where: {
        organizationId: tenant.organizationId,

        /*
         * Draft entries do not form part of the official ledger.
         * Posted, approved and reversed entries remain visible
         * because accounting history must be preserved.
         */
        status: {
          in: ["POSTED", "APPROVED", "REVERSED"],
        },
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

    /*
     * A General Ledger contains a running balance PER ACCOUNT.
     * A single global running balance would be incorrect.
     */
    const balances = new Map<string, number>();

    const ledgerEntries = entries.flatMap((entry) => {
      const amount = Number(entry.amount);

      const debitPrevious =
        balances.get(entry.debitAccountId) ?? 0;

      const debitBalance =
        debitPrevious + amount;

      balances.set(
        entry.debitAccountId,
        debitBalance
      );

      const debitRow = {
        id: `${entry.id}-debit`,
        journalId: entry.id,

        date: entry.transactionDate,
        transactionDate: entry.transactionDate,

        reference: entry.reference,
        description: entry.description,

        accountId: entry.debitAccountId,
        accountCode: entry.debitAccount.code,
        account: entry.debitAccount.name,

        debit: amount,
        credit: 0,
        balance: debitBalance,

        status: entry.status,
        createdBy: entry.createdBy,
        postedBy: entry.postedBy,
        approvedBy: entry.approvedBy,
        reversedBy: entry.reversedBy,
        reversalOfId: entry.reversalOfId,
        reversalReason: entry.reversalReason,
      };

      const creditPrevious =
        balances.get(entry.creditAccountId) ?? 0;

      const creditBalance =
        creditPrevious - amount;

      balances.set(
        entry.creditAccountId,
        creditBalance
      );

      const creditRow = {
        id: `${entry.id}-credit`,
        journalId: entry.id,

        date: entry.transactionDate,
        transactionDate: entry.transactionDate,

        reference: entry.reference,
        description: entry.description,

        accountId: entry.creditAccountId,
        accountCode: entry.creditAccount.code,
        account: entry.creditAccount.name,

        debit: 0,
        credit: amount,
        balance: creditBalance,

        status: entry.status,
        createdBy: entry.createdBy,
        postedBy: entry.postedBy,
        approvedBy: entry.approvedBy,
        reversedBy: entry.reversedBy,
        reversalOfId: entry.reversalOfId,
        reversalReason: entry.reversalReason,
      };

      return [debitRow, creditRow];
    });

    const totalDebit = ledgerEntries.reduce(
      (sum, entry) => sum + entry.debit,
      0
    );

    const totalCredit = ledgerEntries.reduce(
      (sum, entry) => sum + entry.credit,
      0
    );

    return res.status(200).json({
      success: true,

      organizationId: tenant.organizationId,

      entries: ledgerEntries,

      totals: {
        debit: totalDebit,
        credit: totalCredit,
        difference: totalDebit - totalCredit,
      },
    });
  } catch (error) {
    console.error(
      "GENERAL LEDGER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch general ledger",
    });
  }
};

/* =========================================================
   GET LEDGER FOR ONE ACCOUNT
========================================================= */

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

    const accountId =
      String(req.params.accountId);

    /*
     * CRITICAL TENANT CHECK:
     * Account ID alone is never enough.
     */
    const account =
      await prisma.account.findFirst({
        where: {
          id: accountId,
          organizationId:
            tenant.organizationId,
        },
      });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    const entries =
      await prisma.journalEntry.findMany({
        where: {
          organizationId:
            tenant.organizationId,

          status: {
            in: [
              "POSTED",
              "APPROVED",
              "REVERSED",
            ],
          },

          OR: [
            {
              debitAccountId:
                accountId,
            },
            {
              creditAccountId:
                accountId,
            },
          ],
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

    let balance = 0;

    const ledgerEntries =
      entries.map((entry) => {
        const isDebit =
          entry.debitAccountId ===
          accountId;

        const debit = isDebit
          ? Number(entry.amount)
          : 0;

        const credit = isDebit
          ? 0
          : Number(entry.amount);

        balance += debit - credit;

        return {
          id: isDebit
            ? `${entry.id}-debit`
            : `${entry.id}-credit`,

          journalId: entry.id,

          date: entry.transactionDate,
          transactionDate:
            entry.transactionDate,

          reference: entry.reference,
          description:
            entry.description,

          accountId: account.id,
          accountCode: account.code,
          account: account.name,

          debit,
          credit,
          balance,

          status: entry.status,

          reversalOfId:
            entry.reversalOfId,

          reversalReason:
            entry.reversalReason,
        };
      });

    const totalDebit =
      ledgerEntries.reduce(
        (sum, entry) =>
          sum + entry.debit,
        0
      );

    const totalCredit =
      ledgerEntries.reduce(
        (sum, entry) =>
          sum + entry.credit,
        0
      );

    return res.status(200).json({
      success: true,

      organizationId:
        tenant.organizationId,

      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        description:
          account.description,
      },

      entries: ledgerEntries,

      totals: {
        debit: totalDebit,
        credit: totalCredit,
        balance,
      },
    });
  } catch (error) {
    console.error(
      "ACCOUNT LEDGER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch ledger",
    });
  }
};