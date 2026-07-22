import { Request, Response } from "express";
import prisma from "../config/prisma";

// CREATE JOURNAL ENTRY
export const createJournalEntry = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      reference,
      transactionDate,
      description,
      debitAccountId,
      creditAccountId,
      amount,
      notes,
    } = req.body;

    if (
      !reference ||
      !description ||
      !debitAccountId ||
      !creditAccountId ||
      amount === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Required journal entry fields are missing",
      });
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than zero",
      });
    }

    if (debitAccountId === creditAccountId) {
      return res.status(400).json({
        success: false,
        message: "Debit and credit accounts must be different",
      });
    }

    const existingReference = await prisma.journalEntry.findUnique({
      where: {
        reference: reference.trim(),
      },
    });

    if (existingReference) {
      return res.status(409).json({
        success: false,
        message: "Journal reference already exists",
      });
    }

    const accounts = await prisma.account.findMany({
      where: {
        id: {
          in: [debitAccountId, creditAccountId],
        },
      },
    });

    if (accounts.length !== 2) {
      return res.status(400).json({
        success: false,
        message: "Invalid debit or credit account",
      });
    }

    const entry = await prisma.journalEntry.create({
      data: {
        reference: reference.trim(),
        transactionDate: transactionDate
          ? new Date(transactionDate)
          : new Date(),

        description: description.trim(),

        debitAccountId,
        creditAccountId,

        amount: numericAmount,

        notes: notes?.trim() || null,

        status: "DRAFT",
      },

      include: {
        debitAccount: true,
        creditAccount: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Journal entry created successfully",
      entry,
    });
  } catch (error) {
    console.error("CREATE JOURNAL ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create journal entry",
    });
  }
};

// GET ALL JOURNAL ENTRIES
export const getJournalEntries = async (
  req: Request,
  res: Response
) => {
  try {
    const entries = await prisma.journalEntry.findMany({
      include: {
        debitAccount: true,
        creditAccount: true,
        reversalOf: true,
        reversedByEntry: true,
      },

      orderBy: {
        transactionDate: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      entries,
    });
  } catch (error) {
    console.error("GET JOURNALS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch journal entries",
    });
  }
};

// GET ONE JOURNAL ENTRY
export const getJournalEntry = async (
  req: Request,
  res: Response
) => {
  try {
    const id = req.params.id as string;

    const entry = await prisma.journalEntry.findUnique({
      where: { id },

      include: {
        debitAccount: true,
        creditAccount: true,
        reversalOf: true,
        reversedByEntry: true,
      },
    });

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: "Journal entry not found",
      });
    }

    return res.status(200).json({
      success: true,
      entry,
    });
  } catch (error) {
    console.error("GET JOURNAL ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch journal entry",
    });
  }
};

// UPDATE DRAFT JOURNAL ENTRY
export const updateJournalEntry = async (
  req: Request,
  res: Response
) => {
  try {
    const id = req.params.id as string;

    const existingEntry = await prisma.journalEntry.findUnique({
      where: { id },
    });

    if (!existingEntry) {
      return res.status(404).json({
        success: false,
        message: "Journal entry not found",
      });
    }

    if (existingEntry.status !== "DRAFT") {
      return res.status(400).json({
        success: false,
        message: "Only draft journal entries can be edited",
      });
    }

    const {
      reference,
      transactionDate,
      description,
      debitAccountId,
      creditAccountId,
      amount,
      notes,
    } = req.body;

    if (
      debitAccountId &&
      creditAccountId &&
      debitAccountId === creditAccountId
    ) {
      return res.status(400).json({
        success: false,
        message: "Debit and credit accounts must be different",
      });
    }

    let numericAmount: number | undefined;

    if (amount !== undefined) {
      numericAmount = Number(amount);

      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Amount must be greater than zero",
        });
      }
    }

    if (reference && reference.trim() !== existingEntry.reference) {
      const duplicate = await prisma.journalEntry.findUnique({
        where: {
          reference: reference.trim(),
        },
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: "Journal reference already exists",
        });
      }
    }

    const entry = await prisma.journalEntry.update({
      where: { id },

      data: {
        reference: reference?.trim(),
        transactionDate: transactionDate
          ? new Date(transactionDate)
          : undefined,
        description: description?.trim(),
        debitAccountId,
        creditAccountId,
        amount: numericAmount,
        notes:
          notes !== undefined
            ? notes?.trim() || null
            : undefined,
      },

      include: {
        debitAccount: true,
        creditAccount: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Journal entry updated successfully",
      entry,
    });
  } catch (error) {
    console.error("UPDATE JOURNAL ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update journal entry",
    });
  }
};

// POST JOURNAL ENTRY
export const postJournalEntry = async (
  req: Request,
  res: Response
) => {
  try {
    const id = req.params.id as string;

    const existingEntry = await prisma.journalEntry.findUnique({
      where: { id },
    });

    if (!existingEntry) {
      return res.status(404).json({
        success: false,
        message: "Journal entry not found",
      });
    }

    if (existingEntry.status !== "DRAFT") {
      return res.status(400).json({
        success: false,
        message: "Only draft entries can be posted",
      });
    }

    const entry = await prisma.journalEntry.update({
      where: { id },

      data: {
        status: "POSTED",
        postedAt: new Date(),
      },

      include: {
        debitAccount: true,
        creditAccount: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Journal entry posted successfully",
      entry,
    });
  } catch (error) {
    console.error("POST JOURNAL ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to post journal entry",
    });
  }
};

// APPROVE JOURNAL ENTRY
export const approveJournalEntry = async (
  req: Request,
  res: Response
) => {
  try {
    const id = req.params.id as string;

    const existingEntry = await prisma.journalEntry.findUnique({
      where: { id },
    });

    if (!existingEntry) {
      return res.status(404).json({
        success: false,
        message: "Journal entry not found",
      });
    }

    if (existingEntry.status !== "POSTED") {
      return res.status(400).json({
        success: false,
        message: "Only posted journal entries can be approved",
      });
    }

    const entry = await prisma.journalEntry.update({
      where: { id },

      data: {
        status: "APPROVED",
        approvedAt: new Date(),
      },

      include: {
        debitAccount: true,
        creditAccount: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Journal entry approved successfully",
      entry,
    });
  } catch (error) {
    console.error("APPROVE JOURNAL ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to approve journal entry",
    });
  }
};

// REVERSE JOURNAL ENTRY
export const reverseJournalEntry = async (
  req: Request,
  res: Response
) => {
  try {
    const id = req.params.id as string;
    const { reason } = req.body;

    const original = await prisma.journalEntry.findUnique({
      where: { id },
    });

    if (!original) {
      return res.status(404).json({
        success: false,
        message: "Journal entry not found",
      });
    }

    if (original.status !== "APPROVED") {
      return res.status(400).json({
        success: false,
        message: "Only approved journal entries can be reversed",
      });
    }

    if (original.reversedAt) {
      return res.status(400).json({
        success: false,
        message: "Journal entry has already been reversed",
      });
    }

    const reversalReference = `REV-${original.reference}-${Date.now()}`;

    const result = await prisma.$transaction(async (tx) => {
      const reversal = await tx.journalEntry.create({
        data: {
          reference: reversalReference,
          transactionDate: new Date(),

          description: `Reversal: ${original.description}`,

          // Reverse debit and credit
          debitAccountId: original.creditAccountId,
          creditAccountId: original.debitAccountId,

          amount: original.amount,

          status: "APPROVED",

          reversalOfId: original.id,
          reversalReason: reason?.trim() || "Journal reversal",

          postedAt: new Date(),
          approvedAt: new Date(),
        },
      });

      const updatedOriginal = await tx.journalEntry.update({
        where: {
          id: original.id,
        },

        data: {
          status: "REVERSED",
          reversedAt: new Date(),
          reversalReason:
            reason?.trim() || "Journal reversal",
        },
      });

      return {
        reversal,
        original: updatedOriginal,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Journal entry reversed successfully",
      ...result,
    });
  } catch (error) {
    console.error("REVERSE JOURNAL ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to reverse journal entry",
    });
  }
};

// DELETE DRAFT JOURNAL ENTRY
export const deleteJournalEntry = async (
  req: Request,
  res: Response
) => {
  try {
    const id = req.params.id as string;

    const entry = await prisma.journalEntry.findUnique({
      where: { id },
    });

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: "Journal entry not found",
      });
    }

    if (entry.status !== "DRAFT") {
      return res.status(400).json({
        success: false,
        message: "Only draft journal entries can be deleted",
      });
    }

    await prisma.journalEntry.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: "Journal entry deleted successfully",
    });
  } catch (error) {
    console.error("DELETE JOURNAL ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete journal entry",
    });
  }
};