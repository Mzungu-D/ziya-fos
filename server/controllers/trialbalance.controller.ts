import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getTrialBalance = async (
  req: Request,
  res: Response
) => {
  try {
    const accounts = await prisma.account.findMany({
      include: {
        debitEntries: true,
        creditEntries: true,
      },
      orderBy: {
        code: "asc",
      },
    });

    const trialBalance = accounts.map((account) => {
      const debitTotal = account.debitEntries.reduce(
        (sum, entry) => sum + entry.amount,
        0
      );

      const creditTotal = account.creditEntries.reduce(
        (sum, entry) => sum + entry.amount,
        0
      );

      return {
        code: account.code,
        name: account.name,
        type: account.type,
        debit: debitTotal,
        credit: creditTotal,
      };
    });

    const totalDebit = trialBalance.reduce(
      (sum, account) => sum + account.debit,
      0
    );

    const totalCredit = trialBalance.reduce(
      (sum, account) => sum + account.credit,
      0
    );

    return res.status(200).json({
      success: true,
      trialBalance,
      totals: {
        debit: totalDebit,
        credit: totalCredit,
        balanced: totalDebit === totalCredit,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate trial balance",
    });
  }
};