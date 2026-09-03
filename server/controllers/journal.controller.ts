import { Response } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   HELPERS
========================================================= */

function getTenantContext(req: AuthRequest) {
  if (!req.user?.userId || !req.user?.organizationId) return null;

  return {
    userId: req.user.userId,
    organizationId: req.user.organizationId,
  };
}

function parseTransactionDate(value: unknown): Date | null {
  if (!value) return new Date();

  const date = new Date(String(value));

  return Number.isNaN(date.getTime()) ? null : date;
}

type JournalLineInput = {
  accountId?: unknown;
  memo?: unknown;
  debit?: unknown;
  credit?: unknown;
};

function parseLines(value: unknown): JournalLineInput[] | null {
  if (!Array.isArray(value)) return null;

  return value.map((line) => ({
    accountId: line?.accountId,
    memo: line?.memo,
    debit: line?.debit,
    credit: line?.credit,
  }));
}

function validateLines(
  lines: JournalLineInput[],
  allowUnbalancedDraft = true
) {
  if (lines.length < 2) {
    return "A journal entry must contain at least two lines";
  }

  if (lines.length > 500) {
    return "A journal entry cannot contain more than 500 lines";
  }

  let totalDebit = 0;
  let totalCredit = 0;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];

    if (!line.accountId) {
      return `Line ${index + 1}: account is required`;
    }

    const debit = Number(line.debit ?? 0);
    const credit = Number(line.credit ?? 0);

    if (!Number.isFinite(debit) || debit < 0) {
      return `Line ${index + 1}: debit must be zero or greater`;
    }

    if (!Number.isFinite(credit) || credit < 0) {
      return `Line ${index + 1}: credit must be zero or greater`;
    }

    if (debit > 0 && credit > 0) {
      return `Line ${index + 1}: a line cannot contain both debit and credit`;
    }

    if (debit === 0 && credit === 0) {
      return `Line ${index + 1}: either debit or credit must be greater than zero`;
    }

    totalDebit += debit;
    totalCredit += credit;
  }

  const difference = Math.abs(totalDebit - totalCredit);

  if (!allowUnbalancedDraft && difference > 0.005) {
    return `Journal is not balanced. Debit: ${totalDebit}, Credit: ${totalCredit}`;
  }

  return null;
}

async function validateTenantAccounts(
  organizationId: string,
  lines: JournalLineInput[]
) {
  const accountIds = [
    ...new Set(lines.map((line) => String(line.accountId))),
  ];

  const accounts = await prisma.account.findMany({
    where: {
      organizationId,
      id: {
        in: accountIds,
      },
    },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
    },
  });

  if (accounts.length !== accountIds.length) {
    return null;
  }

  return accounts;
}

function lineTotals(lines: JournalLineInput[]): { debit: number; credit: number } {
  return lines.reduce<{ debit: number; credit: number }>(
    (totals, line) => {
      totals.debit += Number(line.debit ?? 0);
      totals.credit += Number(line.credit ?? 0);

      return totals;
    },
    { debit: 0, credit: 0 }
  );
}

/* =========================================================
   CREATE JOURNAL ENTRY
========================================================= */

export const createJournalEntry = async (
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

    const {
      reference,
      transactionDate,
      description,
      notes,
      lines: rawLines,
    } = req.body;

    if (!reference || !description) {
      return res.status(400).json({
        success: false,
        message: "Reference and description are required",
      });
    }

    const cleanReference = String(reference).trim();
    const cleanDescription = String(description).trim();

    if (!cleanReference || !cleanDescription) {
      return res.status(400).json({
        success: false,
        message: "Reference and description are required",
      });
    }

    const lines = parseLines(rawLines);

    if (!lines) {
      return res.status(400).json({
        success: false,
        message: "Journal lines are required",
      });
    }

    const lineError = validateLines(lines, true);

    if (lineError) {
      return res.status(400).json({
        success: false,
        message: lineError,
      });
    }

    const parsedDate = parseTransactionDate(transactionDate);

    if (!parsedDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction date",
      });
    }

    const accounts = await validateTenantAccounts(
      tenant.organizationId,
      lines
    );

    if (!accounts) {
      return res.status(400).json({
        success: false,
        message: "One or more accounts do not belong to this organization",
      });
    }

    const existingReference = await prisma.journalEntry.findFirst({
      where: {
        organizationId: tenant.organizationId,
        reference: cleanReference,
      },
      select: { id: true },
    });

    if (existingReference) {
      return res.status(409).json({
        success: false,
        message: "Journal reference already exists in this organization",
      });
    }

    const totals = lineTotals(lines);

    /*
     * Legacy projection.
     *
     * The old JournalEntry columns are retained temporarily so existing
     * parts of the application continue working while JournalEntryLine
     * becomes the authoritative accounting representation.
     */
    const firstDebit =
      lines.find((line) => Number(line.debit ?? 0) > 0)?.accountId;

    const firstCredit =
      lines.find((line) => Number(line.credit ?? 0) > 0)?.accountId;

    if (!firstDebit || !firstCredit) {
      return res.status(400).json({
        success: false,
        message: "Journal must contain at least one debit and one credit line",
      });
    }

    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.journalEntry.create({
        data: {
          organizationId: tenant.organizationId,
          reference: cleanReference,
          transactionDate: parsedDate,
          description: cleanDescription,

          // Legacy compatibility projection
          debitAccountId: String(firstDebit),
          creditAccountId: String(firstCredit),
          amount: totals.debit,

          notes: notes ? String(notes).trim() || null : null,
          status: "DRAFT",
          createdBy: tenant.userId,

          lines: {
            create: lines.map((line, index) => ({
              accountId: String(line.accountId),
              lineNumber: index + 1,
              memo: line.memo
                ? String(line.memo).trim() || null
                : null,
              debit: Number(line.debit ?? 0),
              credit: Number(line.credit ?? 0),
            })),
          },
        },
        include: {
          debitAccount: true,
          creditAccount: true,
          lines: {
            include: {
              account: true,
            },
            orderBy: {
              lineNumber: "asc",
            },
          },
        },
      });

      await tx.auditTrail.create({
        data: {
          organizationId: tenant.organizationId,
          user: tenant.userId,
          action: "CREATE",
          module: "JOURNAL",
          details: `Created draft journal ${created.reference} (${created.id})`,
        },
      });

      return created;
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

/* =========================================================
   GET ALL JOURNAL ENTRIES
========================================================= */

export const getJournalEntries = async (
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

    const entries = await prisma.journalEntry.findMany({
      where: {
        organizationId: tenant.organizationId,
      },
      include: {
        debitAccount: true,
        creditAccount: true,
        lines: {
          include: {
            account: true,
          },
          orderBy: {
            lineNumber: "asc",
          },
        },
      },
      orderBy: [
        { transactionDate: "desc" },
        { createdAt: "desc" },
      ],
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

/* =========================================================
   GET ONE JOURNAL ENTRY
========================================================= */

export const getJournalEntry = async (
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

    const id = String(req.params.id);

    const entry = await prisma.journalEntry.findFirst({
      where: {
        id,
        organizationId: tenant.organizationId,
      },
      include: {
        debitAccount: true,
        creditAccount: true,
        lines: {
          include: {
            account: true,
          },
          orderBy: {
            lineNumber: "asc",
          },
        },
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

/* =========================================================
   UPDATE DRAFT JOURNAL ENTRY
========================================================= */

export const updateJournalEntry = async (
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

    const id = String(req.params.id);

    const existingEntry = await prisma.journalEntry.findFirst({
      where: {
        id,
        organizationId: tenant.organizationId,
      },
      include: {
        lines: {
          orderBy: {
            lineNumber: "asc",
          },
        },
      },
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
      notes,
      lines: rawLines,
    } = req.body;

    const nextReference =
      reference !== undefined
        ? String(reference).trim()
        : existingEntry.reference;

    const nextDescription =
      description !== undefined
        ? String(description).trim()
        : existingEntry.description;

    if (!nextReference || !nextDescription) {
      return res.status(400).json({
        success: false,
        message: "Reference and description are required",
      });
    }

    const lines =
      rawLines !== undefined
        ? parseLines(rawLines)
        : existingEntry.lines.map((line) => ({
            accountId: line.accountId,
            memo: line.memo,
            debit: line.debit,
            credit: line.credit,
          }));

    if (!lines) {
      return res.status(400).json({
        success: false,
        message: "Journal lines are required",
      });
    }

    const lineError = validateLines(lines, true);

    if (lineError) {
      return res.status(400).json({
        success: false,
        message: lineError,
      });
    }

    const parsedDate =
      transactionDate !== undefined
        ? parseTransactionDate(transactionDate)
        : existingEntry.transactionDate;

    if (!parsedDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction date",
      });
    }

    const accounts = await validateTenantAccounts(
      tenant.organizationId,
      lines
    );

    if (!accounts) {
      return res.status(400).json({
        success: false,
        message: "One or more accounts do not belong to this organization",
      });
    }

    if (nextReference !== existingEntry.reference) {
      const duplicate = await prisma.journalEntry.findFirst({
        where: {
          organizationId: tenant.organizationId,
          reference: nextReference,
          NOT: { id },
        },
        select: { id: true },
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: "Journal reference already exists in this organization",
        });
      }
    }

    const totals = lineTotals(lines);

    const firstDebit =
      lines.find((line) => Number(line.debit ?? 0) > 0)?.accountId;

    const firstCredit =
      lines.find((line) => Number(line.credit ?? 0) > 0)?.accountId;

    if (!firstDebit || !firstCredit) {
      return res.status(400).json({
        success: false,
        message: "Journal must contain at least one debit and one credit line",
      });
    }

    const entry = await prisma.$transaction(async (tx) => {
      await tx.journalEntryLine.deleteMany({
        where: {
          journalEntryId: id,
        },
      });

      const updated = await tx.journalEntry.update({
        where: { id },
        data: {
          reference: nextReference,
          transactionDate: parsedDate,
          description: nextDescription,

          // Legacy compatibility projection
          debitAccountId: String(firstDebit),
          creditAccountId: String(firstCredit),
          amount: totals.debit,

          notes:
            notes !== undefined
              ? String(notes ?? "").trim() || null
              : undefined,

          lines: {
            create: lines.map((line, index) => ({
              accountId: String(line.accountId),
              lineNumber: index + 1,
              memo: line.memo
                ? String(line.memo).trim() || null
                : null,
              debit: Number(line.debit ?? 0),
              credit: Number(line.credit ?? 0),
            })),
          },
        },
        include: {
          debitAccount: true,
          creditAccount: true,
          lines: {
            include: {
              account: true,
            },
            orderBy: {
              lineNumber: "asc",
            },
          },
        },
      });

      await tx.auditTrail.create({
        data: {
          organizationId: tenant.organizationId,
          user: tenant.userId,
          action: "UPDATE",
          module: "JOURNAL",
          details: `Updated draft journal ${updated.reference} (${updated.id})`,
        },
      });

      return updated;
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

/* =========================================================
   POST JOURNAL ENTRY
========================================================= */

export const postJournalEntry = async (
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

    const id = String(req.params.id);

    const existingEntry = await prisma.journalEntry.findFirst({
      where: {
        id,
        organizationId: tenant.organizationId,
      },
      include: {
        lines: {
          orderBy: {
            lineNumber: "asc",
          },
        },
      },
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

    const lines: JournalLineInput[] = existingEntry.lines.map((line) => ({
      accountId: line.accountId,
      memo: line.memo,
      debit: line.debit,
      credit: line.credit,
    }));

    const lineError = validateLines(lines, false);

    if (lineError) {
      return res.status(400).json({
        success: false,
        message: lineError,
      });
    }

    const accounts = await validateTenantAccounts(
      tenant.organizationId,
      lines
    );

    if (!accounts) {
      return res.status(400).json({
        success: false,
        message: "One or more journal accounts are invalid",
      });
    }

    const entry = await prisma.$transaction(async (tx) => {
      const updated = await tx.journalEntry.update({
        where: { id },
        data: {
          status: "POSTED",
          postedAt: new Date(),
          postedBy: tenant.userId,
        },
        include: {
          debitAccount: true,
          creditAccount: true,
          lines: {
            include: {
              account: true,
            },
            orderBy: {
              lineNumber: "asc",
            },
          },
        },
      });

      await tx.auditTrail.create({
        data: {
          organizationId: tenant.organizationId,
          user: tenant.userId,
          action: "POST",
          module: "JOURNAL",
          details: `Posted journal ${updated.reference} (${updated.id})`,
        },
      });

      return updated;
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

/* =========================================================
   APPROVE JOURNAL ENTRY
========================================================= */

export const approveJournalEntry = async (
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

    const id = String(req.params.id);

    const existingEntry = await prisma.journalEntry.findFirst({
      where: {
        id,
        organizationId: tenant.organizationId,
      },
      include: {
        lines: {
          orderBy: {
            lineNumber: "asc",
          },
        },
      },
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

    const lines: JournalLineInput[] = existingEntry.lines.map((line) => ({
      accountId: line.accountId,
      debit: line.debit,
      credit: line.credit,
    }));

    const lineError = validateLines(lines, false);

    if (lineError) {
      return res.status(400).json({
        success: false,
        message: lineError,
      });
    }

    const entry = await prisma.$transaction(async (tx) => {
      const updated = await tx.journalEntry.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedAt: new Date(),
          approvedBy: tenant.userId,
        },
        include: {
          debitAccount: true,
          creditAccount: true,
          lines: {
            include: {
              account: true,
            },
            orderBy: {
              lineNumber: "asc",
            },
          },
        },
      });

      await tx.auditTrail.create({
        data: {
          organizationId: tenant.organizationId,
          user: tenant.userId,
          action: "APPROVE",
          module: "JOURNAL",
          details: `Approved journal ${updated.reference} (${updated.id})`,
        },
      });

      return updated;
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

/* =========================================================
   REVERSE JOURNAL ENTRY
========================================================= */

export const reverseJournalEntry = async (
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

    const id = String(req.params.id);

    const reason =
      String(req.body?.reason ?? "").trim() || "Journal reversal";

    const original = await prisma.journalEntry.findFirst({
      where: {
        id,
        organizationId: tenant.organizationId,
      },
      include: {
        lines: {
          orderBy: {
            lineNumber: "asc",
          },
        },
      },
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

    if (original.lines.length < 2) {
      return res.status(409).json({
        success: false,
        message:
          "This journal does not contain multi-line accounting data and cannot be reversed using the new journal engine",
      });
    }

    const lines: JournalLineInput[] = original.lines.map((line) => ({
      accountId: line.accountId,
      memo: line.memo,
      debit: line.credit,
      credit: line.debit,
    }));

    const lineError = validateLines(lines, false);

    if (lineError) {
      return res.status(400).json({
        success: false,
        message: lineError,
      });
    }

    const accounts = await validateTenantAccounts(
      tenant.organizationId,
      lines
    );

    if (!accounts) {
      return res.status(409).json({
        success: false,
        message: "Journal accounts are not valid for this organization",
      });
    }

    const reversalReference = `REV-${original.reference}-${Date.now()}`;

    const totals = lineTotals(lines);

    const firstDebit =
      lines.find((line) => Number(line.debit ?? 0) > 0)?.accountId;

    const firstCredit =
      lines.find((line) => Number(line.credit ?? 0) > 0)?.accountId;

    if (!firstDebit || !firstCredit) {
      return res.status(400).json({
        success: false,
        message: "Unable to construct reversal lines",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const reversal = await tx.journalEntry.create({
        data: {
          organizationId: tenant.organizationId,
          reference: reversalReference,
          transactionDate: new Date(),
          description: `Reversal: ${original.description}`,

          // Legacy compatibility projection
          debitAccountId: String(firstDebit),
          creditAccountId: String(firstCredit),
          amount: totals.debit,

          status: "APPROVED",
          createdBy: tenant.userId,
          postedBy: tenant.userId,
          approvedBy: tenant.userId,
          reversalOfId: original.id,
          reversalReason: reason,
          postedAt: new Date(),
          approvedAt: new Date(),

          lines: {
            create: lines.map((line, index) => ({
              accountId: String(line.accountId),
              lineNumber: index + 1,
              memo: line.memo
                ? `Reversal: ${String(line.memo)}`
                : "Journal reversal",
              debit: Number(line.debit ?? 0),
              credit: Number(line.credit ?? 0),
            })),
          },
        },
        include: {
          debitAccount: true,
          creditAccount: true,
          lines: {
            include: {
              account: true,
            },
            orderBy: {
              lineNumber: "asc",
            },
          },
        },
      });

      const updatedOriginal = await tx.journalEntry.update({
        where: {
          id: original.id,
        },
        data: {
          status: "REVERSED",
          reversedAt: new Date(),
          reversedBy: tenant.userId,
          reversalReason: reason,
        },
      });

      await tx.auditTrail.create({
        data: {
          organizationId: tenant.organizationId,
          user: tenant.userId,
          action: "REVERSE",
          module: "JOURNAL",
          details: `Reversed journal ${original.reference} (${original.id}) with ${reversal.reference} (${reversal.id}). Reason: ${reason}`,
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

/* =========================================================
   DELETE DRAFT JOURNAL ENTRY
========================================================= */

export const deleteJournalEntry = async (
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

    const id = String(req.params.id);

    const entry = await prisma.journalEntry.findFirst({
      where: {
        id,
        organizationId: tenant.organizationId,
      },
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
        message:
          "Only draft journal entries can be deleted. Posted records must follow the reversal process.",
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.auditTrail.create({
        data: {
          organizationId: tenant.organizationId,
          user: tenant.userId,
          action: "DELETE",
          module: "JOURNAL",
          details: `Deleted draft journal ${entry.reference} (${entry.id})`,
        },
      });

      await tx.journalEntry.delete({
        where: {
          id: entry.id,
        },
      });
    });

    return res.status(200).json({
      success: true,
      message: "Draft journal entry deleted successfully",
    });
  } catch (error) {
    console.error("DELETE JOURNAL ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete journal entry",
    });
  }
};
