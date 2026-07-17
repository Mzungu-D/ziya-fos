import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getBalanceSheet = async (
  req: Request,
  res: Response
) => {
  try {
    const assetAccounts = await prisma.account.findMany({
      where: {
        type: "ASSET",
      },
      include: {
        debitEntries: true,
        creditEntries: true,
      },
    });

    const liabilityAccounts = await prisma.account.findMany({
      where: {
        type: "LIABILITY",
      },
      include: {
        debitEntries: true,
        creditEntries: true,
      },
    });

    const equityAccounts = await prisma.account.findMany({
      where: {
        type: "EQUITY",
      },
      include: {
        debitEntries: true,
        creditEntries: true,
      },
    });

    const revenueAccounts = await prisma.account.findMany({
      where: {
        type: "REVENUE",
      },
      include: {
        creditEntries: true,
      },
    });

    const expenseAccounts = await prisma.account.findMany({
      where: {
        type: "EXPENSE",
      },
      include: {
        debitEntries: true,
      },
    });

    const assets = assetAccounts.map((account) => ({
      code: account.code,
      name: account.name,
      balance:
        account.debitEntries.reduce(
          (sum, entry) => sum + entry.amount,
          0
        ) -
        account.creditEntries.reduce(
          (sum, entry) => sum + entry.amount,
          0
        ),
    }));

    const liabilities = liabilityAccounts.map((account) => ({
      code: account.code,
      name: account.name,
      balance:
        account.creditEntries.reduce(
          (sum, entry) => sum + entry.amount,
          0
        ) -
        account.debitEntries.reduce(
          (sum, entry) => sum + entry.amount,
          0
        ),
    }));

    const equity = equityAccounts.map((account) => ({
      code: account.code,
      name: account.name,
      balance:
        account.creditEntries.reduce(
          (sum, entry) => sum + entry.amount,
          0
        ) -
        account.debitEntries.reduce(
          (sum, entry) => sum + entry.amount,
          0
        ),
    }));

    const totalAssets = assets.reduce(
      (sum, account) => sum + account.balance,
      0
    );

    const totalLiabilities = liabilities.reduce(
      (sum, account) => sum + account.balance,
      0
    );

    const totalEquity = equity.reduce(
      (sum, account) => sum + account.balance,
      0
    );

    const retainedEarnings =
      revenueAccounts.reduce(
        (sum, account) =>
          sum +
          account.creditEntries.reduce(
            (entrySum, entry) =>
              entrySum + entry.amount,
            0
          ),
        0
      ) -
      expenseAccounts.reduce(
        (sum, account) =>
          sum +
          account.debitEntries.reduce(
            (entrySum, entry) =>
              entrySum + entry.amount,
            0
          ),
        0
      );

    return res.status(200).json({
      success: true,
      assets,
      liabilities,
      equity,
      retainedEarnings,
      totals: {
        assets: totalAssets,
        liabilities: totalLiabilities,
        equity: totalEquity,
        retainedEarnings,
        balanced:
          totalAssets ===
          (
            totalLiabilities +
            totalEquity +
            retainedEarnings
          ),
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate balance sheet",
    });
  }
};