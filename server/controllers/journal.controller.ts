import { Response } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   HELPERS
========================================================= */

function getTenantContext(req: AuthRequest) {
  if (!req.user?.userId || !req.user?.organizationId) {
    return null;
  }

  return {
    userId: req.user.userId,
    organizationId: req.user.organizationId,
  };
}

async function writeAudit(
  organizationId: string,
  userId: string,
  action: string,
  details: string
) {
  await prisma.auditTrail.create({
    data: {
      organizationId,
      user: userId,
      action,
      module: "JOURNAL",
      details,
    },
  });
}

function parseTransactionDate(value: unknown): Date | null {
  if (!value) {
    return new Date();
  }

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
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

    const cleanReference = String(reference).trim();
    const cleanDescription = String(description).trim();

    if (!cleanReference || !cleanDescription) {
      return res.status(400).json({
        success: false,
        message: "Reference and description are required",
      });
    }

    const numericAmount = Number(amount);

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than zero",
      });
    }

    if (debitAccountId === creditAccountId) {
      return res.status(400).json({
        success: false,
        message:
          "Debit and credit accounts must be different",
      });
    }

    const parsedDate =
      parseTransactionDate(transactionDate);

    if (!parsedDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction date",
      });
    }

    /*
     * Reference uniqueness is tenant-specific.
     */
    const existingReference =
      await prisma.journalEntry.findFirst({
        where: {
          organizationId: tenant.organizationId,
          reference: cleanReference,
        },
        select: {
          id: true,
        },
      });

    if (existingReference) {
      return res.status(409).json({
        success: false,
        message:
          "Journal reference already exists in this organization",
      });
    }

    /*
     * Both accounts MUST belong to this tenant.
     */
    const accounts = await prisma.account.findMany({
      where: {
        organizationId: tenant.organizationId,
        id: {
          in: [
            String(debitAccountId),
            String(creditAccountId),
          ],
        },
      },
      select: {
        id: true,
      },
    });

    if (accounts.length !== 2) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid debit or credit account for this organization",
      });
    }

    const entry = await prisma.$transaction(
      async (tx) => {
        const created =
          await tx.journalEntry.create({
            data: {
              organizationId:
                tenant.organizationId,

              reference: cleanReference,
              transactionDate: parsedDate,
              description: cleanDescription,

              debitAccountId:
                String(debitAccountId),

              creditAccountId:
                String(creditAccountId),

              amount: numericAmount,

              notes:
                notes !== undefined &&
                notes !== null &&
                String(notes).trim()
                  ? String(notes).trim()
                  : null,

              status: "DRAFT",
              createdBy: tenant.userId,
            },

            include: {
              debitAccount: true,
              creditAccount: true,
            },
          });

        await tx.auditTrail.create({
          data: {
            organizationId:
              tenant.organizationId,
            user: tenant.userId,
            action: "CREATE",
            module: "JOURNAL",
            details:
              `Created draft journal ${created.reference} (${created.id})`,
          },
        });

        return created;
      }
    );

    return res.status(201).json({
      success: true,
      message:
        "Journal entry created successfully",
      entry,
    });
  } catch (error) {
    console.error(
      "CREATE JOURNAL ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to create journal entry",
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

    const entries =
      await prisma.journalEntry.findMany({
        where: {
          organizationId:
            tenant.organizationId,
        },

        include: {
          debitAccount: true,
          creditAccount: true,
          reversalOf: true,
          reversedByEntry: true,
        },

        orderBy: [
          {
            transactionDate: "desc",
          },
          {
            createdAt: "desc",
          },
        ],
      });

    return res.status(200).json({
      success: true,
      entries,
    });
  } catch (error) {
    console.error(
      "GET JOURNALS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch journal entries",
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

    const entry =
      await prisma.journalEntry.findFirst({
        where: {
          id,
          organizationId:
            tenant.organizationId,
        },

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
    console.error(
      "GET JOURNAL ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch journal entry",
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

    const existingEntry =
      await prisma.journalEntry.findFirst({
        where: {
          id,
          organizationId:
            tenant.organizationId,
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
        message:
          "Only draft journal entries can be edited",
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

    const nextDebitAccountId =
      debitAccountId !== undefined
        ? String(debitAccountId)
        : existingEntry.debitAccountId;

    const nextCreditAccountId =
      creditAccountId !== undefined
        ? String(creditAccountId)
        : existingEntry.creditAccountId;

    if (
      nextDebitAccountId ===
      nextCreditAccountId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Debit and credit accounts must be different",
      });
    }

    /*
     * Revalidate account ownership even if only one
     * side of the journal was changed.
     */
    const accounts =
      await prisma.account.findMany({
        where: {
          organizationId:
            tenant.organizationId,

          id: {
            in: [
              nextDebitAccountId,
              nextCreditAccountId,
            ],
          },
        },

        select: {
          id: true,
        },
      });

    if (accounts.length !== 2) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid debit or credit account for this organization",
      });
    }

    let numericAmount:
      | number
      | undefined;

    if (amount !== undefined) {
      numericAmount = Number(amount);

      if (
        !Number.isFinite(numericAmount) ||
        numericAmount <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Amount must be greater than zero",
        });
      }
    }

    let parsedDate:
      | Date
      | undefined;

    if (transactionDate !== undefined) {
      const result =
        parseTransactionDate(
          transactionDate
        );

      if (!result) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid transaction date",
        });
      }

      parsedDate = result;
    }

    let cleanReference:
      | string
      | undefined;

    if (reference !== undefined) {
      cleanReference =
        String(reference).trim();

      if (!cleanReference) {
        return res.status(400).json({
          success: false,
          message:
            "Reference cannot be empty",
        });
      }

      if (
        cleanReference !==
        existingEntry.reference
      ) {
        const duplicate =
          await prisma.journalEntry.findFirst({
            where: {
              organizationId:
                tenant.organizationId,

              reference: cleanReference,

              NOT: {
                id,
              },
            },

            select: {
              id: true,
            },
          });

        if (duplicate) {
          return res.status(409).json({
            success: false,
            message:
              "Journal reference already exists in this organization",
          });
        }
      }
    }

    let cleanDescription:
      | string
      | undefined;

    if (description !== undefined) {
      cleanDescription =
        String(description).trim();

      if (!cleanDescription) {
        return res.status(400).json({
          success: false,
          message:
            "Description cannot be empty",
        });
      }
    }

    const entry = await prisma.$transaction(
      async (tx) => {
        const updated =
          await tx.journalEntry.update({
            where: {
              id,
            },

            data: {
              reference: cleanReference,
              transactionDate: parsedDate,
              description:
                cleanDescription,

              debitAccountId:
                nextDebitAccountId,

              creditAccountId:
                nextCreditAccountId,

              amount: numericAmount,

              notes:
                notes !== undefined
                  ? String(
                      notes ?? ""
                    ).trim() || null
                  : undefined,
            },

            include: {
              debitAccount: true,
              creditAccount: true,
            },
          });

        await tx.auditTrail.create({
          data: {
            organizationId:
              tenant.organizationId,
            user: tenant.userId,
            action: "UPDATE",
            module: "JOURNAL",
            details:
              `Updated draft journal ${updated.reference} (${updated.id})`,
          },
        });

        return updated;
      }
    );

    return res.status(200).json({
      success: true,
      message:
        "Journal entry updated successfully",
      entry,
    });
  } catch (error) {
    console.error(
      "UPDATE JOURNAL ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update journal entry",
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

    const existingEntry =
      await prisma.journalEntry.findFirst({
        where: {
          id,
          organizationId:
            tenant.organizationId,
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
        message:
          "Only draft entries can be posted",
      });
    }

    const entry = await prisma.$transaction(
      async (tx) => {
        const updated =
          await tx.journalEntry.update({
            where: {
              id,
            },

            data: {
              status: "POSTED",
              postedAt: new Date(),
              postedBy: tenant.userId,
            },

            include: {
              debitAccount: true,
              creditAccount: true,
            },
          });

        await tx.auditTrail.create({
          data: {
            organizationId:
              tenant.organizationId,
            user: tenant.userId,
            action: "POST",
            module: "JOURNAL",
            details:
              `Posted journal ${updated.reference} (${updated.id})`,
          },
        });

        return updated;
      }
    );

    return res.status(200).json({
      success: true,
      message:
        "Journal entry posted successfully",
      entry,
    });
  } catch (error) {
    console.error(
      "POST JOURNAL ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to post journal entry",
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

    const existingEntry =
      await prisma.journalEntry.findFirst({
        where: {
          id,
          organizationId:
            tenant.organizationId,
        },
      });

    if (!existingEntry) {
      return res.status(404).json({
        success: false,
        message: "Journal entry not found",
      });
    }

    if (
      existingEntry.status !== "POSTED"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Only posted journal entries can be approved",
      });
    }

    const entry = await prisma.$transaction(
      async (tx) => {
        const updated =
          await tx.journalEntry.update({
            where: {
              id,
            },

            data: {
              status: "APPROVED",
              approvedAt: new Date(),
              approvedBy: tenant.userId,
            },

            include: {
              debitAccount: true,
              creditAccount: true,
            },
          });

        await tx.auditTrail.create({
          data: {
            organizationId:
              tenant.organizationId,
            user: tenant.userId,
            action: "APPROVE",
            module: "JOURNAL",
            details:
              `Approved journal ${updated.reference} (${updated.id})`,
          },
        });

        return updated;
      }
    );

    return res.status(200).json({
      success: true,
      message:
        "Journal entry approved successfully",
      entry,
    });
  } catch (error) {
    console.error(
      "APPROVE JOURNAL ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to approve journal entry",
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
      String(req.body?.reason ?? "").trim() ||
      "Journal reversal";

    const original =
      await prisma.journalEntry.findFirst({
        where: {
          id,
          organizationId:
            tenant.organizationId,
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
        message:
          "Only approved journal entries can be reversed",
      });
    }

    if (original.reversedAt) {
      return res.status(400).json({
        success: false,
        message:
          "Journal entry has already been reversed",
      });
    }

    /*
     * Verify accounts still belong to this tenant.
     */
    const accounts =
      await prisma.account.findMany({
        where: {
          organizationId:
            tenant.organizationId,

          id: {
            in: [
              original.debitAccountId,
              original.creditAccountId,
            ],
          },
        },

        select: {
          id: true,
        },
      });

    if (accounts.length !== 2) {
      return res.status(409).json({
        success: false,
        message:
          "Journal accounts are not valid for this organization",
      });
    }

    const reversalReference =
      `REV-${original.reference}-${Date.now()}`;

    const result =
      await prisma.$transaction(
        async (tx) => {
          const reversal =
            await tx.journalEntry.create({
              data: {
                organizationId:
                  tenant.organizationId,

                reference:
                  reversalReference,

                transactionDate:
                  new Date(),

                description:
                  `Reversal: ${original.description}`,

                debitAccountId:
                  original.creditAccountId,

                creditAccountId:
                  original.debitAccountId,

                amount: original.amount,

                status: "APPROVED",

                createdBy:
                  tenant.userId,

                postedBy:
                  tenant.userId,

                approvedBy:
                  tenant.userId,

                reversalOfId:
                  original.id,

                reversalReason:
                  reason,

                postedAt:
                  new Date(),

                approvedAt:
                  new Date(),
              },
            });

          const updatedOriginal =
            await tx.journalEntry.update({
              where: {
                id: original.id,
              },

              data: {
                status: "REVERSED",
                reversedAt:
                  new Date(),
                reversedBy:
                  tenant.userId,
                reversalReason:
                  reason,
              },
            });

          await tx.auditTrail.create({
            data: {
              organizationId:
                tenant.organizationId,
              user: tenant.userId,
              action: "REVERSE",
              module: "JOURNAL",
              details:
                `Reversed journal ${original.reference} (${original.id}) with ${reversal.reference} (${reversal.id}). Reason: ${reason}`,
            },
          });

          return {
            reversal,
            original:
              updatedOriginal,
          };
        }
      );

    return res.status(200).json({
      success: true,
      message:
        "Journal entry reversed successfully",
      ...result,
    });
  } catch (error) {
    console.error(
      "REVERSE JOURNAL ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to reverse journal entry",
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

    const entry =
      await prisma.journalEntry.findFirst({
        where: {
          id,
          organizationId:
            tenant.organizationId,
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
          "Only draft journal entries can be deleted. Posted accounting records must follow the reversal process.",
      });
    }

    await prisma.$transaction(
      async (tx) => {
        await tx.auditTrail.create({
          data: {
            organizationId:
              tenant.organizationId,
            user: tenant.userId,
            action: "DELETE",
            module: "JOURNAL",
            details:
              `Deleted draft journal ${entry.reference} (${entry.id})`,
          },
        });

        await tx.journalEntry.delete({
          where: {
            id: entry.id,
          },
        });
      }
    );

    return res.status(200).json({
      success: true,
      message:
        "Draft journal entry deleted successfully",
    });
  } catch (error) {
    console.error(
      "DELETE JOURNAL ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete journal entry",
    });
  }
};