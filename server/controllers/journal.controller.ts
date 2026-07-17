import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const createJournalEntry = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      reference,
      description,
      debitAccountId,
      creditAccountId,
      amount,
    } = req.body;

    const entry = await prisma.journalEntry.create({
      data: {
        reference,
        description,
        debitAccountId,
        creditAccountId,
        amount,
      },
    });

    return res.status(201).json({
      success: true,
      entry,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to create journal entry",
    });
  }
};

export const getJournalEntries = async (
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
        createdAt: "desc",
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
      message: "Failed to fetch journal entries",
    });
  }
};