import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getLedger = async (
  req: Request,
  res: Response
) => {
  try {
    const accountId = req.params.accountId as string;

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

    return res.status(200).json({
      success: true,
      entries,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch ledger",
    });
  }
};