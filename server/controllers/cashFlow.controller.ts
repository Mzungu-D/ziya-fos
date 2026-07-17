import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getCashFlow = async (
  req: Request,
  res: Response
) => {
  try {
    const cashAccount = await prisma.account.findFirst({
      where: {
        code: "1000",
      },
      include: {
        debitEntries: true,
        creditEntries: true,
      },
    });

    const bankAccount = await prisma.account.findFirst({
      where: {
        code: "1010",
      },
      include: {
        debitEntries: true,
        creditEntries: true,
      },
    });

    const cashInflows =
      (cashAccount?.debitEntries.reduce(
        (sum, entry) => sum + entry.amount,
        0
      ) || 0) +
      (bankAccount?.debitEntries.reduce(
        (sum, entry) => sum + entry.amount,
        0
      ) || 0);

    const cashOutflows =
      (cashAccount?.creditEntries.reduce(
        (sum, entry) => sum + entry.amount,
        0
      ) || 0) +
      (bankAccount?.creditEntries.reduce(
        (sum, entry) => sum + entry.amount,
        0
      ) || 0);

    const netCashFlow = cashInflows - cashOutflows;

    return res.status(200).json({
      success: true,
      operatingActivities: {
        inflows: cashInflows,
        outflows: cashOutflows,
        netCashFlow,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate cash flow statement",
    });
  }
};