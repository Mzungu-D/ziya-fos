import { Response } from "express";
import { Prisma } from "@prisma/client";

import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   HELPERS
========================================================= */

const getOrganizationId = (
  req: AuthRequest
): string | null => {
  return req.user?.organizationId ?? null;
};

const getReceivableId = (
  req: AuthRequest
): string | null => {
  const value = req.params.id;

  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return String(value);
};

const parsePositiveAmount = (
  value: unknown
): number | null => {
  const amount = Number(value);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return null;
  }

  return amount;
};

const parseDate = (
  value: unknown
): Date | null => {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const normalizeText = (
  value: unknown
): string => {
  return typeof value === "string"
    ? value.trim()
    : "";
};

const getPaymentStatus = (
  originalAmount: number,
  outstandingBalance: number
): string => {
  if (outstandingBalance <= 0) {
    return "PAID";
  }

  if (outstandingBalance < originalAmount) {
    return "PARTIALLY_PAID";
  }

  return "UNPAID";
};

const isPrismaUniqueError = (
  error: unknown
): boolean => {
  return (
    error instanceof
      Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
};

/* =========================================================
   CREATE RECEIVABLE
========================================================= */

export const createReceivable = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const invoiceNumber =
      normalizeText(req.body.invoiceNumber);

    const customerName =
      normalizeText(req.body.customerName);

    const description =
      normalizeText(req.body.description);

    const amount =
      parsePositiveAmount(req.body.amount);

    const dueDate =
      parseDate(req.body.dueDate);

    if (!invoiceNumber) {
      return res.status(400).json({
        success: false,
        message: "Invoice number is required",
      });
    }

    if (!customerName) {
      return res.status(400).json({
        success: false,
        message: "Customer name is required",
      });
    }

    if (!description) {
      return res.status(400).json({
        success: false,
        message: "Description is required",
      });
    }

    if (amount === null) {
      return res.status(400).json({
        success: false,
        message:
          "Amount must be greater than zero",
      });
    }

    if (!dueDate) {
      return res.status(400).json({
        success: false,
        message:
          "A valid due date is required",
      });
    }

    const existing =
      await prisma.accountsReceivable.findFirst({
        where: {
          organizationId,
          invoiceNumber,
        },

        select: {
          id: true,
        },
      });

    if (existing) {
      return res.status(409).json({
        success: false,
        message:
          "An invoice with this invoice number already exists in this organization",
      });
    }

    const receivable =
      await prisma.accountsReceivable.create({
        data: {
          organizationId,
          invoiceNumber,
          customerName,
          description,
          amount,
          outstandingBalance: amount,
          dueDate,
          paymentStatus: "UNPAID",
          status: "PENDING",
        },
      });

    return res.status(201).json({
      success: true,
      message:
        "Customer invoice created successfully",
      receivable,
    });
  } catch (error) {
    console.error(
      "Create receivable error:",
      error
    );

    if (isPrismaUniqueError(error)) {
      return res.status(409).json({
        success: false,
        message:
          "An invoice with this invoice number already exists in this organization",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to create customer invoice",
    });
  }
};

/* =========================================================
   GET ALL RECEIVABLES
========================================================= */

export const getReceivables = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const receivables =
      await prisma.accountsReceivable.findMany({
        where: {
          organizationId,
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    return res.status(200).json({
      success: true,
      count: receivables.length,
      receivables,
    });
  } catch (error) {
    console.error(
      "Fetch receivables error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch receivables",
    });
  }
};

/* =========================================================
   GET SINGLE RECEIVABLE
========================================================= */

export const getReceivableById = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const id =
      getReceivableId(req);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid receivable ID",
      });
    }

    const receivable =
      await prisma.accountsReceivable.findFirst({
        where: {
          id,
          organizationId,
        },
      });

    if (!receivable) {
      return res.status(404).json({
        success: false,
        message:
          "Customer invoice not found",
      });
    }

    return res.status(200).json({
      success: true,
      receivable,
    });
  } catch (error) {
    console.error(
      "Fetch receivable error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch customer invoice",
    });
  }
};

/* =========================================================
   UPDATE RECEIVABLE
========================================================= */

export const updateReceivable = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const id =
      getReceivableId(req);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid receivable ID",
      });
    }

    const existing =
      await prisma.accountsReceivable.findFirst({
        where: {
          id,
          organizationId,
        },
      });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message:
          "Customer invoice not found",
      });
    }

    /*
     * Financial values must not be rewritten
     * after a payment has been recorded.
     */
    if (
      Number(existing.outstandingBalance) !==
      Number(existing.amount)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "An invoice with recorded payments cannot be edited",
      });
    }

    const invoiceNumber =
      normalizeText(req.body.invoiceNumber);

    const customerName =
      normalizeText(req.body.customerName);

    const description =
      normalizeText(req.body.description);

    const amount =
      parsePositiveAmount(req.body.amount);

    const dueDate =
      parseDate(req.body.dueDate);

    if (
      !invoiceNumber ||
      !customerName ||
      !description
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invoice number, customer name and description are required",
      });
    }

    if (amount === null) {
      return res.status(400).json({
        success: false,
        message:
          "Amount must be greater than zero",
      });
    }

    if (!dueDate) {
      return res.status(400).json({
        success: false,
        message:
          "A valid due date is required",
      });
    }

    const duplicate =
      await prisma.accountsReceivable.findFirst({
        where: {
          organizationId,
          invoiceNumber,
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
          "An invoice with this invoice number already exists in this organization",
      });
    }

    const updated =
      await prisma.accountsReceivable.updateMany({
        where: {
          id,
          organizationId,
        },

        data: {
          invoiceNumber,
          customerName,
          description,
          amount,
          outstandingBalance: amount,
          dueDate,
        },
      });

    if (updated.count !== 1) {
      return res.status(404).json({
        success: false,
        message:
          "Customer invoice not found",
      });
    }

    const receivable =
      await prisma.accountsReceivable.findFirst({
        where: {
          id,
          organizationId,
        },
      });

    return res.status(200).json({
      success: true,
      message:
        "Customer invoice updated successfully",
      receivable,
    });
  } catch (error) {
    console.error(
      "Update receivable error:",
      error
    );

    if (isPrismaUniqueError(error)) {
      return res.status(409).json({
        success: false,
        message:
          "An invoice with this invoice number already exists in this organization",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to update customer invoice",
    });
  }
};

/* =========================================================
   APPROVE RECEIVABLE
========================================================= */

export const approveReceivable = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const id =
      getReceivableId(req);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid receivable ID",
      });
    }

    const existing =
      await prisma.accountsReceivable.findFirst({
        where: {
          id,
          organizationId,
        },
      });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message:
          "Customer invoice not found",
      });
    }

    if (existing.status === "APPROVED") {
      return res.status(400).json({
        success: false,
        message:
          "Customer invoice is already approved",
      });
    }

    const approvedBy =
      req.user?.userId ?? "SYSTEM";

    const updated =
      await prisma.accountsReceivable.updateMany({
        where: {
          id,
          organizationId,
        },

        data: {
          status: "APPROVED",
          approvedBy,
        },
      });

    if (updated.count !== 1) {
      return res.status(404).json({
        success: false,
        message:
          "Customer invoice not found",
      });
    }

    const receivable =
      await prisma.accountsReceivable.findFirst({
        where: {
          id,
          organizationId,
        },
      });

    return res.status(200).json({
      success: true,
      message:
        "Customer invoice approved successfully",
      receivable,
    });
  } catch (error) {
    console.error(
      "Approve receivable error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to approve customer invoice",
    });
  }
};

/* =========================================================
   RECORD CUSTOMER PAYMENT
========================================================= */

export const recordReceivablePayment = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const id =
      getReceivableId(req);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid receivable ID",
      });
    }

    const paymentAmount =
      parsePositiveAmount(req.body.amount);

    if (paymentAmount === null) {
      return res.status(400).json({
        success: false,
        message:
          "Payment amount must be greater than zero",
      });
    }

    const receivable =
      await prisma.$transaction(
        async (tx) => {
          const existing =
            await tx.accountsReceivable.findFirst({
              where: {
                id,
                organizationId,
              },
            });

          if (!existing) {
            throw new Error(
              "RECEIVABLE_NOT_FOUND"
            );
          }

          if (
            existing.status !==
            "APPROVED"
          ) {
            throw new Error(
              "RECEIVABLE_NOT_APPROVED"
            );
          }

          const outstandingBalance =
            Number(
              existing.outstandingBalance
            );

          if (outstandingBalance <= 0) {
            throw new Error(
              "RECEIVABLE_ALREADY_PAID"
            );
          }

          if (
            paymentAmount >
            outstandingBalance
          ) {
            throw new Error(
              "PAYMENT_EXCEEDS_BALANCE"
            );
          }

          const newBalance =
            Math.max(
              0,
              outstandingBalance -
                paymentAmount
            );

          const paymentStatus =
            getPaymentStatus(
              Number(existing.amount),
              newBalance
            );

          const updated =
            await tx.accountsReceivable.updateMany({
              where: {
                id,
                organizationId,
              },

              data: {
                outstandingBalance:
                  newBalance,

                paymentStatus,
              },
            });

          if (updated.count !== 1) {
            throw new Error(
              "RECEIVABLE_NOT_FOUND"
            );
          }

          const invoice =
            await tx.invoice.findFirst({
              where: {
                organizationId,
                invoiceNumber:
                  existing.invoiceNumber,
              },
            });

          if (invoice) {
            await tx.invoice.update({
              where: {
                id: invoice.id,
              },

              data: {
                paymentStatus,
              },
            });
          }
          return tx.accountsReceivable.findFirst({
            where: {
              id,
              organizationId,
            },
          });
        }
      );

    return res.status(200).json({
      success: true,

      message:
        receivable?.paymentStatus ===
        "PAID"
          ? "Customer invoice paid in full"
          : "Customer payment recorded successfully",

      receivable,
    });
  } catch (error) {
    console.error(
      "Record payment error:",
      error
    );

    if (error instanceof Error) {
      if (
        error.message ===
        "RECEIVABLE_NOT_FOUND"
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Customer invoice not found",
        });
      }

      if (
        error.message ===
        "RECEIVABLE_NOT_APPROVED"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Approve the invoice before recording a payment",
        });
      }

      if (
        error.message ===
        "RECEIVABLE_ALREADY_PAID"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "This invoice is already fully paid",
        });
      }

      if (
        error.message ===
        "PAYMENT_EXCEEDS_BALANCE"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Payment cannot exceed the outstanding balance",
        });
      }
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to record customer payment",
    });
  }
};

/* =========================================================
   DELETE RECEIVABLE
========================================================= */

export const deleteReceivable = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const id =
      getReceivableId(req);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid receivable ID",
      });
    }

    const existing =
      await prisma.accountsReceivable.findFirst({
        where: {
          id,
          organizationId,
        },
      });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message:
          "Customer invoice not found",
      });
    }

    /*
     * Tenant controls its own records.
     * Permission middleware decides whether
     * the authenticated member may delete.
     */
    const deletion =
      await prisma.accountsReceivable.deleteMany({
        where: {
          id,
          organizationId,
        },
      });

    if (deletion.count !== 1) {
      return res.status(404).json({
        success: false,
        message:
          "Customer invoice not found",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Customer invoice deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete receivable error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete customer invoice",
    });
  }
};

