import type { Request, Response } from "express";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/* =========================================================
   HELPERS
========================================================= */

const getParam = (
  value: string | string[] | undefined
): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

const getReceivableId = (
  req: Request
): string | undefined => {
  return getParam(req.params.id);
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

  if (
    outstandingBalance <
    originalAmount
  ) {
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
  req: Request,
  res: Response
) => {
  try {
    const invoiceNumber =
      normalizeText(
        req.body.invoiceNumber
      );

    const customerName =
      normalizeText(
        req.body.customerName
      );

    const description =
      normalizeText(
        req.body.description
      );

    const amount =
      parsePositiveAmount(
        req.body.amount
      );

    const dueDate =
      parseDate(
        req.body.dueDate
      );

    if (!invoiceNumber) {
      return res.status(400).json({
        success: false,
        message:
          "Invoice number is required",
      });
    }

    if (!customerName) {
      return res.status(400).json({
        success: false,
        message:
          "Customer name is required",
      });
    }

    if (!description) {
      return res.status(400).json({
        success: false,
        message:
          "Description is required",
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

    const receivable =
      await prisma.accountsReceivable.create({
        data: {
          invoiceNumber,
          customerName,
          description,
          amount,
          outstandingBalance:
            amount,
          dueDate,
          paymentStatus:
            "UNPAID",
          status:
            "PENDING",
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

    if (
      isPrismaUniqueError(error)
    ) {
      return res.status(409).json({
        success: false,
        message:
          "An invoice with this invoice number already exists",
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
  _req: Request,
  res: Response
) => {
  try {
    const receivables =
      await prisma.accountsReceivable.findMany({
        orderBy: {
          createdAt: "desc",
        },
      });

    return res.status(200).json({
      success: true,
      count:
        receivables.length,
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

export const getReceivableById =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const id =
        getReceivableId(req);

      if (!id) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid receivable ID",
        });
      }

      const receivable =
        await prisma.accountsReceivable.findUnique({
          where: {
            id,
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

export const updateReceivable =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const id =
        getReceivableId(req);

      if (!id) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid receivable ID",
        });
      }

      const existing =
        await prisma.accountsReceivable.findUnique({
          where: {
            id,
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
       * Once money has been received against
       * an invoice, financial values should not
       * simply be rewritten.
       */
      if (
        existing.outstandingBalance !==
        existing.amount
      ) {
        return res.status(400).json({
          success: false,
          message:
            "An invoice with recorded payments cannot be edited",
        });
      }

      const invoiceNumber =
        normalizeText(
          req.body.invoiceNumber
        );

      const customerName =
        normalizeText(
          req.body.customerName
        );

      const description =
        normalizeText(
          req.body.description
        );

      const amount =
        parsePositiveAmount(
          req.body.amount
        );

      const dueDate =
        parseDate(
          req.body.dueDate
        );

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

      const receivable =
        await prisma.accountsReceivable.update({
          where: {
            id,
          },

          data: {
            invoiceNumber,
            customerName,
            description,
            amount,
            outstandingBalance:
              amount,
            dueDate,
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

      if (
        isPrismaUniqueError(error)
      ) {
        return res.status(409).json({
          success: false,
          message:
            "An invoice with this invoice number already exists",
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

export const approveReceivable =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const id =
        getReceivableId(req);

      if (!id) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid receivable ID",
        });
      }

      const existing =
        await prisma.accountsReceivable.findUnique({
          where: {
            id,
          },
        });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message:
            "Customer invoice not found",
        });
      }

      if (
        existing.status ===
        "APPROVED"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Customer invoice is already approved",
        });
      }

      const authenticatedUser =
        (
          req as Request & {
            user?: {
              id?: string;
              email?: string;
            };
          }
        ).user;

      const approvedBy =
        authenticatedUser?.id ??
        authenticatedUser?.email ??
        "SYSTEM";

      const receivable =
        await prisma.accountsReceivable.update({
          where: {
            id,
          },

          data: {
            status:
              "APPROVED",
            approvedBy,
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

export const recordReceivablePayment =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const id =
        getReceivableId(req);

      if (!id) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid receivable ID",
        });
      }

      const paymentAmount =
        parsePositiveAmount(
          req.body.amount
        );

      if (
        paymentAmount === null
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Payment amount must be greater than zero",
        });
      }

      const existing =
        await prisma.accountsReceivable.findUnique({
          where: {
            id,
          },
        });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message:
            "Customer invoice not found",
        });
      }

      if (
        existing.status !==
        "APPROVED"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Approve the invoice before recording a payment",
        });
      }

      if (
        existing.outstandingBalance <=
        0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "This invoice is already fully paid",
        });
      }

      if (
        paymentAmount >
        existing.outstandingBalance
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Payment cannot exceed the outstanding balance",
        });
      }

      const newOutstandingBalance =
        Math.max(
          0,
          existing.outstandingBalance -
            paymentAmount
        );

      const paymentStatus =
        getPaymentStatus(
          existing.amount,
          newOutstandingBalance
        );

      /*
       * Atomic update prevents another request
       * from changing the record between the
       * validation above and this write.
       */
      const receivable =
        await prisma.$transaction(
          async (tx) => {
            const latest =
              await tx.accountsReceivable.findUnique({
                where: {
                  id,
                },
              });

            if (!latest) {
              throw new Error(
                "RECEIVABLE_NOT_FOUND"
              );
            }

            if (
              latest.outstandingBalance <
              paymentAmount
            ) {
              throw new Error(
                "PAYMENT_EXCEEDS_BALANCE"
              );
            }

            const balance =
              Math.max(
                0,
                latest.outstandingBalance -
                  paymentAmount
              );

            return tx.accountsReceivable.update({
              where: {
                id,
              },

              data: {
                outstandingBalance:
                  balance,

                paymentStatus:
                  getPaymentStatus(
                    latest.amount,
                    balance
                  ),
              },
            });
          }
        );

      return res.status(200).json({
        success: true,

        message:
          paymentStatus === "PAID"
            ? "Customer invoice paid in full"
            : "Customer payment recorded successfully",

        receivable,
      });
    } catch (error) {
      console.error(
        "Record payment error:",
        error
      );

      if (
        error instanceof Error &&
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
        error instanceof Error &&
        error.message ===
          "PAYMENT_EXCEEDS_BALANCE"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Outstanding balance changed. Refresh and try again.",
        });
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

export const deleteReceivable =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const id =
        getReceivableId(req);

      if (!id) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid receivable ID",
        });
      }

      const existing =
        await prisma.accountsReceivable.findUnique({
          where: {
            id,
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
       * Never delete an invoice after money
       * has been recorded against it.
       */
      if (
        existing.outstandingBalance !==
        existing.amount
      ) {
        return res.status(400).json({
          success: false,
          message:
            "An invoice with recorded payments cannot be deleted",
        });
      }

      await prisma.accountsReceivable.delete({
        where: {
          id,
        },
      });

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