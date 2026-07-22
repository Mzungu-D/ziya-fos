import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/*
|--------------------------------------------------------------------------
| GET FULL GENERAL LEDGER
|--------------------------------------------------------------------------
*/

export const getAllLedger = async (
  req: Request,
  res: Response
) => {
  try {
    const entries = await prisma.journalEntry.findMany({
      include: {
        debitAccount: true,
        creditAccount: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    let runningBalance = 0;

    const ledgerEntries = entries.flatMap((entry) => {
      const debitAmount = Number(entry.amount);

      runningBalance += debitAmount;

      const debitRow = {
        id: `${entry.id}-debit`,
        journalId: entry.id,
        date: entry.createdAt,
        reference: entry.reference,
        description: entry.description,
        accountId: entry.debitAccountId,
        accountCode: entry.debitAccount.code,
        account: entry.debitAccount.name,
        debit: debitAmount,
        credit: 0,
        balance: runningBalance,
      };

      runningBalance -= debitAmount;

      const creditRow = {
        id: `${entry.id}-credit`,
        journalId: entry.id,
        date: entry.createdAt,
        reference: entry.reference,
        description: entry.description,
        accountId: entry.creditAccountId,
        accountCode: entry.creditAccount.code,
        account: entry.creditAccount.name,
        debit: 0,
        credit: debitAmount,
        balance: runningBalance,
      };

      return [debitRow, creditRow];
    });

    return res.status(200).json({
      success: true,
      entries: ledgerEntries,
    });
  } catch (error) {
    console.error("GENERAL LEDGER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch general ledger",
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET LEDGER FOR ONE ACCOUNT
|--------------------------------------------------------------------------
*/

export const getLedger = async (
  req: Request,
  res: Response
) => {
  try {
    const accountId = req.params.accountId as string;

    const account = await prisma.account.findUnique({
      where: {
        id: accountId,
      },
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    const entries = await prisma.journalEntry.findMany({
      where: {
        OR: [
          {
            debitAccountId: accountId,
          },
          {
            creditAccountId: accountId,
          },
        ],
      },
      include: {
        debitAccount: true,
        creditAccount: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    let balance = 0;

    const ledgerEntries = entries.map((entry) => {
      const isDebit =
        entry.debitAccountId === accountId;

      const debit = isDebit
        ? Number(entry.amount)
        : 0;

      const credit = !isDebit
        ? Number(entry.amount)
        : 0;

      balance += debit - credit;

      return {
        id: entry.id,
        date: entry.createdAt,
        reference: entry.reference,
        description: entry.description,
        accountId: account.id,
        accountCode: account.code,
        account: account.name,
        debit,
        credit,
        balance,
      };
    });

    return res.status(200).json({
      success: true,

      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
      },

      entries: ledgerEntries,

      totals: {
        debit: ledgerEntries.reduce(
          (sum, entry) => sum + entry.debit,
          0
        ),

        credit: ledgerEntries.reduce(
          (sum, entry) => sum + entry.credit,
          0
        ),

        balance,
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