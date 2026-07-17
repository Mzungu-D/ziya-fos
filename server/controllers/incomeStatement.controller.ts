import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getIncomeStatement = async (
  req: Request,
  res: Response
) => {
  try {
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

    const revenue = revenueAccounts.map((account) => ({
      code: account.code,
      name: account.name,
      amount: account.creditEntries.reduce(
        (sum, entry) => sum + entry.amount,
        0
      ),
    }));

    const expenses = expenseAccounts.map((account) => ({
      code: account.code,
      name: account.name,
      amount: account.debitEntries.reduce(
        (sum, entry) => sum + entry.amount,
        0
      ),
    }));

    const totalRevenue = revenue.reduce(
      (sum, item) => sum + item.amount,
      0
    );

    const totalExpenses = expenses.reduce(
      (sum, item) => sum + item.amount,
      0
    );

    const netProfit = totalRevenue - totalExpenses;

    return res.status(200).json({
      success: true,
      revenue,
      expenses,
      totals: {
        revenue: totalRevenue,
        expenses: totalExpenses,
        netProfit,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate income statement",
    });
  }
};