import { Request, Response } from "express";
import prisma from "../config/prisma";

export const getIncomeStatement = async (
  req: Request,
  res: Response
) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter: {
      gte?: Date;
      lte?: Date;
    } = {};

    if (startDate) {
      const parsedStartDate = new Date(String(startDate));

      if (Number.isNaN(parsedStartDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid startDate",
        });
      }

      parsedStartDate.setHours(0, 0, 0, 0);
      dateFilter.gte = parsedStartDate;
    }

    if (endDate) {
      const parsedEndDate = new Date(String(endDate));

      if (Number.isNaN(parsedEndDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid endDate",
        });
      }

      parsedEndDate.setHours(23, 59, 59, 999);
      dateFilter.lte = parsedEndDate;
    }

    if (
      dateFilter.gte &&
      dateFilter.lte &&
      dateFilter.gte > dateFilter.lte
    ) {
      return res.status(400).json({
        success: false,
        message: "startDate cannot be after endDate",
      });
    }

    const accounts = await prisma.account.findMany({
      where: {
        type: {
          in: ["REVENUE", "EXPENSE"],
        },
      },
      orderBy: {
        code: "asc",
      },
    });

    const entries = await prisma.journalEntry.findMany({
      where: {
        status: "POSTED",

        ...(startDate || endDate
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

    const movements = new Map<
      string,
      {
        debit: number;
        credit: number;
      }
    >();

    for (const entry of entries) {
      const debit = movements.get(entry.debitAccountId) ?? {
        debit: 0,
        credit: 0,
      };

      debit.debit += entry.amount;
      movements.set(entry.debitAccountId, debit);

      const credit = movements.get(entry.creditAccountId) ?? {
        debit: 0,
        credit: 0,
      };

      credit.credit += entry.amount;
      movements.set(entry.creditAccountId, credit);
    }

    const revenue = accounts
      .filter((account) => account.type === "REVENUE")
      .map((account) => {
        const movement = movements.get(account.id) ?? {
          debit: 0,
          credit: 0,
        };

        return {
          id: account.id,
          code: account.code,
          name: account.name,
          amount: movement.credit - movement.debit,
        };
      })
      .filter((account) => Math.abs(account.amount) >= 0.01);

    const expenses = accounts
      .filter((account) => account.type === "EXPENSE")
      .map((account) => {
        const movement = movements.get(account.id) ?? {
          debit: 0,
          credit: 0,
        };

        return {
          id: account.id,
          code: account.code,
          name: account.name,
          amount: movement.debit - movement.credit,
        };
      })
      .filter((account) => Math.abs(account.amount) >= 0.01);

    const totalRevenue = revenue.reduce(
      (total, account) => total + account.amount,
      0
    );

    const totalExpenses = expenses.reduce(
      (total, account) => total + account.amount,
      0
    );

    const netProfit = totalRevenue - totalExpenses;

    const profitMargin =
      totalRevenue !== 0
        ? (netProfit / totalRevenue) * 100
        : 0;

    return res.status(200).json({
      success: true,

      revenue,
      expenses,

      totals: {
        revenue: totalRevenue,
        expenses: totalExpenses,
        netProfit,
        profitMargin,
      },

      meta: {
        startDate: dateFilter.gte?.toISOString() ?? null,
        endDate: dateFilter.lte?.toISOString() ?? null,
        postedEntries: entries.length,
        currency: "KES",
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("INCOME STATEMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate income statement",
    });
  }
};