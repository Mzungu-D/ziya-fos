import { Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

const getOrganizationId = (req: AuthRequest): string | null =>
  req.user?.organizationId ?? null;

const normalizeString = (value: unknown): string =>
  String(value ?? "").trim();

const normalizeOptionalString = (value: unknown): string | null => {
  const valueString = normalizeString(value);
  return valueString || null;
};

/* =========================================================
   EXPENSE CODE
========================================================= */

const generateExpenseCode = async (
  tx: Prisma.TransactionClient,
  organizationId: string
): Promise<string> => {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtext(${`${organizationId}:expense-code`})
    )
  `;

  const latest = await tx.expense.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: { expenseCode: true },
  });

  const match = latest?.expenseCode?.match(/^EXP-\d{4}-(\d+)$/);
  const nextNumber = match ? Number(match[1]) + 1 : 1;

  return `EXP-${new Date().getFullYear()}-${String(nextNumber).padStart(3, "0")}`;
};

/* =========================================================
   GET ALL EXPENSES
========================================================= */

export const getExpenses = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const expenses = await prisma.expense.findMany({
      where: { organizationId },
      include: {
        vendor: true,

        expenseAccount: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
          },
        },

        paymentAccount: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
          },
        },

        bankAccount: {
          select: {
            id: true,
            bankName: true,
            accountName: true,
            accountNumber: true,
            currency: true,
          },
        },

        approval: true,

        journalEntry: {
          select: {
            id: true,
            reference: true,
            status: true,
            transactionDate: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    return res.json({
      success: true,
      expenses,
    });
  } catch (error) {
    console.error("GET EXPENSES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load expenses.",
    });
  }
};

/* =========================================================
   GET ONE EXPENSE
========================================================= */

export const getExpense = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const id = normalizeString(req.params.id);

    const expense = await prisma.expense.findFirst({
      where: {
        id,
        organizationId,
      },

      include: {
        vendor: true,
        expenseAccount: true,
        paymentAccount: true,
        bankAccount: true,
        approval: true,

        journalEntry: {
          include: {
            lines: {
              include: {
                account: true,
              },
            },
          },
        },
      },
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found.",
      });
    }

    return res.json({
      success: true,
      expense,
    });
  } catch (error) {
    console.error("GET EXPENSE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load expense.",
    });
  }
};

/* =========================================================
   CREATE EXPENSE
========================================================= */

export const createExpense = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const {
      vendorId,
      category,
      description,
      amount,
      currency,
      expenseDate,
      expenseAccountId,
      paymentAccountId,
      bankAccountId,
      paymentMethod,
    } = req.body;

    const normalizedCategory = normalizeString(category);
    const normalizedDescription = normalizeString(description);

    const normalizedCurrency =
      normalizeOptionalString(currency) ?? "KES";

    const parsedAmount = Number(amount);
    const parsedDate = new Date(expenseDate);

    if (!normalizedCategory) {
      return res.status(400).json({
        success: false,
        message: "Expense category is required.",
      });
    }

    if (!normalizedDescription) {
      return res.status(400).json({
        success: false,
        message: "Expense description is required.",
      });
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Expense amount must be greater than zero.",
      });
    }

    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "A valid expense date is required.",
      });
    }

    const normalizedVendorId =
      normalizeOptionalString(vendorId);

    const normalizedExpenseAccountId =
      normalizeOptionalString(expenseAccountId);

    const normalizedPaymentAccountId =
      normalizeOptionalString(paymentAccountId);

    const normalizedBankAccountId =
      normalizeOptionalString(bankAccountId);

    if (!normalizedExpenseAccountId) {
      return res.status(400).json({
        success: false,
        message: "Expense account is required.",
      });
    }

    const expenseAccount =
      await prisma.account.findFirst({
        where: {
          id: normalizedExpenseAccountId,
          organizationId,
          type: "EXPENSE",
        },
      });

    if (!expenseAccount) {
      return res.status(400).json({
        success: false,
        message:
          "Selected expense account does not exist in this organization.",
      });
    }

    if (normalizedPaymentAccountId) {
      const paymentAccount =
        await prisma.account.findFirst({
          where: {
            id: normalizedPaymentAccountId,
            organizationId,
          },
        });

      if (!paymentAccount) {
        return res.status(400).json({
          success: false,
          message:
            "Selected payment account does not exist in this organization.",
        });
      }
    }

    if (normalizedVendorId) {
      const vendor =
        await prisma.vendor.findFirst({
          where: {
            id: normalizedVendorId,
            organizationId,
          },
        });

      if (!vendor) {
        return res.status(400).json({
          success: false,
          message:
            "Selected vendor does not exist in this organization.",
        });
      }
    }

    if (normalizedBankAccountId) {
      const bankAccount =
        await prisma.bankAccount.findFirst({
          where: {
            id: normalizedBankAccountId,
            organizationId,
          },
        });

      if (!bankAccount) {
        return res.status(400).json({
          success: false,
          message:
            "Selected bank account does not exist in this organization.",
        });
      }
    }

    const expense = await prisma.$transaction(
      async (tx) => {
        const expenseCode =
          await generateExpenseCode(
            tx,
            organizationId
          );

        return tx.expense.create({
          data: {
            organizationId,
            expenseCode,
            vendorId: normalizedVendorId,
            category: normalizedCategory,
            description: normalizedDescription,
            amount: parsedAmount,
            currency: normalizedCurrency,
            expenseDate: parsedDate,
            status: "DRAFT",
            paymentStatus: "UNPAID",

            paymentMethod:
              normalizeOptionalString(paymentMethod),

            expenseAccountId:
              normalizedExpenseAccountId,

            paymentAccountId:
              normalizedPaymentAccountId,

            bankAccountId:
              normalizedBankAccountId,
          },

          include: {
            vendor: true,
            expenseAccount: true,
            paymentAccount: true,
            bankAccount: true,
          },
        });
      }
    );

    return res.status(201).json({
      success: true,
      message: "Expense created successfully.",
      expense,
    });
  } catch (error) {
    console.error("CREATE EXPENSE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create expense.",
    });
  }
};

/* =========================================================
   SUBMIT EXPENSE FOR APPROVAL
========================================================= */

export const submitExpense = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const id = normalizeString(req.params.id);

    const expense = await prisma.expense.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found.",
      });
    }

    if (expense.status !== "DRAFT") {
      return res.status(409).json({
        success: false,
        message:
          `Expense cannot be submitted from ${expense.status.toLowerCase()} status.`,
      });
    }

    if (!expense.expenseAccountId) {
      return res.status(400).json({
        success: false,
        message:
          "An expense account must be selected before submission.",
      });
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const approval =
          await tx.approval.create({
            data: {
              organizationId,
              module: "EXPENSE",
              description:
                `${expense.expenseCode} — ${expense.description}`,
              amount: expense.amount,
              requestedBy:
                req.user?.userId ?? "SYSTEM",
              status: "PENDING",
            },
          });

        const updatedExpense =
          await tx.expense.update({
            where: {
              id: expense.id,
            },

            data: {
              status: "PENDING_APPROVAL",
              approvalId: approval.id,
            },

            include: {
              vendor: true,
              approval: true,
              expenseAccount: true,
              paymentAccount: true,
              bankAccount: true,
            },
          });

        return {
          expense: updatedExpense,
          approval,
        };
      }
    );

    return res.json({
      success: true,
      message:
        "Expense submitted for approval successfully.",
      ...result,
    });
  } catch (error) {
    console.error("SUBMIT EXPENSE ERROR:", error);

    return res.status(500).json({
      success: false,
      message:
        "Failed to submit expense for approval.",
    });
  }
};

/* =========================================================
   POST EXPENSE TO GENERAL LEDGER
========================================================= */

export const postExpense = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const id = normalizeString(req.params.id);

    const expense = await prisma.expense.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found.",
      });
    }

    if (expense.status !== "APPROVED") {
      return res.status(409).json({
        success: false,
        message:
          "Only approved expenses can be posted.",
      });
    }

    if (
      !expense.expenseAccountId ||
      !expense.paymentAccountId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Expense account and payment account are required before posting.",
      });
    }

    /*
     * These values have been explicitly checked above.
     * Keeping them in local constants narrows their types
     * from string | null to string for Prisma's journal
     * entry and journal line creation.
     */
    const debitAccountId = expense.expenseAccountId;
    const creditAccountId = expense.paymentAccountId;

    const [expenseAccount, paymentAccount] =
      await Promise.all([
        prisma.account.findFirst({
          where: {
            id: debitAccountId,
            organizationId,
          },
        }),

        prisma.account.findFirst({
          where: {
            id: creditAccountId,
            organizationId,
          },
        }),
      ]);

    if (!expenseAccount || !paymentAccount) {
      return res.status(400).json({
        success: false,
        message:
          "One or more accounting accounts no longer exist in this organization.",
      });
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const existingJournal =
          expense.journalEntryId
            ? await tx.journalEntry.findFirst({
                where: {
                  id: expense.journalEntryId,
                  organizationId,
                },
              })
            : null;

        if (existingJournal) {
          if (existingJournal.status !== "POSTED") {
            await tx.journalEntry.update({
              where: {
                id: existingJournal.id,
              },

              data: {
                status: "POSTED",
                postedAt: new Date(),
                postedBy:
                  req.user?.userId ?? null,
              },
            });
          }

          const existingExpense =
            await tx.expense.findFirst({
              where: {
                id: expense.id,
                organizationId,
              },
              include: {
                vendor: true,
                expenseAccount: true,
                paymentAccount: true,
                bankAccount: true,
                approval: true,
                journalEntry: {
                  include: {
                    lines: {
                      include: {
                        account: true,
                      },
                    },
                  },
                },
              },
            });

          if (!existingExpense) {
            throw new Error("POSTED_EXPENSE_RELOAD_FAILED");
          }

          return {
            journalEntry: existingJournal,
            expense: existingExpense,
          };
        }

        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(
            hashtext(${`${organizationId}:journal-reference`})
          )
        `;

        const latest =
          await tx.journalEntry.findFirst({
            where: {
              organizationId,
            },

            orderBy: {
              createdAt: "desc",
            },

            select: {
              reference: true,
            },
          });

        const referenceMatch =
          latest?.reference?.match(/^JE-(\d+)$/);

        const nextNumber =
          referenceMatch
            ? Number(referenceMatch[1]) + 1
            : 1;

        const reference =
          `JE-${String(nextNumber).padStart(4, "0")}`;

        const journalEntry =
          await tx.journalEntry.create({
            data: {
              organizationId,
              reference,

              description:
                `${expense.expenseCode} — ${expense.description}`,

              debitAccountId,
              creditAccountId,

              amount: expense.amount,

              notes:
                `Posted from Expense ${expense.expenseCode}`,

              status: "POSTED",

              transactionDate:
                expense.expenseDate,

              createdBy:
                req.user?.userId ?? null,

              postedAt: new Date(),

              postedBy:
                req.user?.userId ?? null,

              lines: {
                create: [
                  {
                    lineNumber: 1,

                    accountId:
                      debitAccountId,

                    memo:
                      expense.description,

                    debit:
                      expense.amount,

                    credit: 0,
                  },

                  {
                    lineNumber: 2,

                    accountId:
                      creditAccountId,

                    memo:
                      expense.description,

                    debit: 0,

                    credit:
                      expense.amount,
                  },
                ],
              },
            },
          });

        await tx.expense.update({
          where: {
            id: expense.id,
          },

          data: {
            status: "POSTED",
            journalEntryId:
              journalEntry.id,
          },
        });

        const updatedExpense =
          await tx.expense.findFirst({
            where: {
              id: expense.id,
              organizationId,
            },
            include: {
              vendor: true,
              expenseAccount: true,
              paymentAccount: true,
              bankAccount: true,
              approval: true,
              journalEntry: {
                include: {
                  lines: {
                    include: {
                      account: true,
                    },
                  },
                },
              },
            },
          });

        if (!updatedExpense) {
          throw new Error("POSTED_EXPENSE_RELOAD_FAILED");
        }

        return {
          journalEntry,
          expense: updatedExpense,
        };
      }
    );

    return res.json({
      success: true,
      message:
        "Expense posted to the General Ledger successfully.",
      expense: result.expense,
      journalEntry: result.journalEntry,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "POSTED_EXPENSE_RELOAD_FAILED"
    ) {
      return res.status(500).json({
        success: false,
        message: "Expense was posted but could not be reloaded.",
      });
    }

    console.error("POST EXPENSE ERROR:", error);

    return res.status(500).json({
      success: false,
      message:
        "Failed to post expense.",
    });
  }
};

/* =========================================================
   RECORD PAYMENT / RECONCILE PAYMENT
========================================================= */

export const recordExpensePayment = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const id = normalizeString(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Expense ID is required.",
      });
    }

    const paymentDateInput = req.body?.paymentDate;
    const paymentReference = normalizeOptionalString(
      req.body?.paymentReference
    );
    const paymentMethod = normalizeOptionalString(
      req.body?.paymentMethod
    );
    const bankAccountId = normalizeOptionalString(
      req.body?.bankAccountId
    );

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required.",
      });
    }

    if (!paymentReference) {
      return res.status(400).json({
        success: false,
        message: "Payment reference is required.",
      });
    }

    const parsedPaymentDate = paymentDateInput
      ? new Date(paymentDateInput)
      : new Date();

    if (Number.isNaN(parsedPaymentDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment date.",
      });
    }

    const expense = await prisma.expense.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        vendor: true,
        bankAccount: true,
        expenseAccount: true,
        paymentAccount: true,
        journalEntry: true,
      },
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found.",
      });
    }

    if (expense.status !== "POSTED") {
      return res.status(409).json({
        success: false,
        message: "Only posted expenses can be marked as paid.",
      });
    }

    if (expense.paymentStatus === "PAID") {
      return res.status(409).json({
        success: false,
        message: "Expense has already been paid.",
      });
    }

    const normalizedMethod = paymentMethod.toUpperCase();

    const bankRequiredMethods = new Set([
      "BANK",
      "BANK_TRANSFER",
      "CHEQUE",
    ]);

    if (bankRequiredMethods.has(normalizedMethod) && !bankAccountId) {
      return res.status(400).json({
        success: false,
        message: "A bank account is required for this payment method.",
      });
    }

    if (bankAccountId) {
      const bankAccount = await prisma.bankAccount.findFirst({
        where: {
          id: bankAccountId,
          organizationId,
          status: "ACTIVE",
        },
        select: {
          id: true,
          currency: true,
        },
      });

      if (!bankAccount) {
        return res.status(400).json({
          success: false,
          message: "Selected bank account is not an active account in this organization.",
        });
      }

      if (
        expense.currency &&
        bankAccount.currency &&
        expense.currency.toUpperCase() !== bankAccount.currency.toUpperCase()
      ) {
        return res.status(400).json({
          success: false,
          message: `Payment currency mismatch. Expense is ${expense.currency} but the selected bank account is ${bankAccount.currency}.`,
        });
      }
    }

    /*
     * The expense is already posted to the General Ledger when its
     * POSTED journal entry is created. Recording payment here is a
     * reconciliation/audit operation; creating another journal entry
     * would double-count the expense and cash movement.
     *
     * The conditional update also protects against two concurrent
     * requests both marking the same expense as paid.
     */
    const updatedRows = await prisma.$transaction(async (tx) => {
      const updated = await tx.expense.updateMany({
        where: {
          id: expense.id,
          organizationId,
          status: "POSTED",
          paymentStatus: {
            not: "PAID",
          },
        },
        data: {
          paymentStatus: "PAID",
          paymentDate: parsedPaymentDate,
          paymentReference,
          paymentMethod,
          bankAccountId,
        },
      });

      if (updated.count !== 1) {
        throw new Error("EXPENSE_PAYMENT_ALREADY_RECORDED");
      }

      return tx.expense.findFirst({
        where: {
          id: expense.id,
          organizationId,
        },
        include: {
          vendor: true,
          bankAccount: true,
          expenseAccount: true,
          paymentAccount: true,
          journalEntry: true,
        },
      });
    });

    if (!updatedRows) {
      return res.status(500).json({
        success: false,
        message: "Payment was recorded but the expense could not be reloaded.",
      });
    }

    return res.json({
      success: true,
      message: "Expense payment recorded successfully.",
      expense: updatedRows,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "EXPENSE_PAYMENT_ALREADY_RECORDED"
    ) {
      return res.status(409).json({
        success: false,
        message: "Expense has already been paid or its status changed. Refresh and try again.",
      });
    }

    console.error("RECORD EXPENSE PAYMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to record expense payment.",
    });
  }
};

/* =========================================================
   DELETE EXPENSE
========================================================= */

export const deleteExpense = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const id = normalizeString(req.params.id);

    const expense = await prisma.expense.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found.",
      });
    }

    if (expense.status !== "DRAFT") {
      return res.status(409).json({
        success: false,
        message:
          "Only draft expenses can be deleted.",
      });
    }

    await prisma.expense.delete({
      where: {
        id: expense.id,
      },
    });

    return res.json({
      success: true,
      message:
        "Expense deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE EXPENSE ERROR:", error);

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete expense.",
    });
  }
};