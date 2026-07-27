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

const getParamId = (
  value: string | string[] | undefined
): string | null => {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
};

/* =========================================================
   CREATE PAYABLE
========================================================= */

export const createPayable = async (
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

    const {
      invoiceNumber,
      vendorId,
      description,
      amount,
      dueDate,
    } = req.body;

    if (
      !invoiceNumber ||
      !vendorId ||
      !description ||
      !dueDate
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invoice number, vendor, description and due date are required.",
      });
    }

    const normalizedInvoiceNumber =
      String(invoiceNumber).trim();

    const normalizedVendorId =
      String(vendorId).trim();

    const normalizedDescription =
      String(description).trim();

    if (
      !normalizedInvoiceNumber ||
      !normalizedVendorId ||
      !normalizedDescription
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invoice number, vendor and description are required.",
      });
    }

    const parsedAmount = Number(amount);

    if (
      !Number.isFinite(parsedAmount) ||
      parsedAmount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Amount must be greater than zero.",
      });
    }

    const parsedDueDate =
      new Date(dueDate);

    if (
      Number.isNaN(
        parsedDueDate.getTime()
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid due date.",
      });
    }

    /*
     * Vendor MUST belong to the
     * authenticated organization.
     */
    const vendor =
      await prisma.vendor.findFirst({
        where: {
          id: normalizedVendorId,
          organizationId,
        },

        select: {
          id: true,
        },
      });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found.",
      });
    }

    /*
     * Duplicate check is tenant-scoped.
     */
    const existingPayable =
      await prisma.accountsPayable.findFirst({
        where: {
          organizationId,
          vendorId: normalizedVendorId,
          invoiceNumber:
            normalizedInvoiceNumber,
        },

        select: {
          id: true,
        },
      });

    if (existingPayable) {
      return res.status(409).json({
        success: false,
        message:
          "This invoice number already exists for the selected vendor.",
      });
    }

    const payable =
      await prisma.accountsPayable.create({
        data: {
          organizationId,

          invoiceNumber:
            normalizedInvoiceNumber,

          vendorId:
            normalizedVendorId,

          description:
            normalizedDescription,

          amount: parsedAmount,

          outstandingBalance:
            parsedAmount,

          dueDate:
            parsedDueDate,

          paymentStatus:
            "UNPAID",

          status:
            "PENDING",
        },

        include: {
          vendor: true,
        },
      });

    return res.status(201).json({
      success: true,
      message:
        "Supplier bill created successfully.",
      payable,
    });
  } catch (error) {
    console.error(
      "CREATE PAYABLE ERROR:",
      error
    );

    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This invoice number already exists in this organization.",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to create supplier bill.",
    });
  }
};

/* =========================================================
   GET ALL PAYABLES
========================================================= */

export const getPayables = async (
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

    const payables =
      await prisma.accountsPayable.findMany({
        where: {
          organizationId,
        },

        include: {
          vendor: true,
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    return res.status(200).json({
      success: true,
      count: payables.length,
      payables,
    });
  } catch (error) {
    console.error(
      "GET PAYABLES ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch supplier bills.",
    });
  }
};

/* =========================================================
   GET SINGLE PAYABLE
========================================================= */

export const getPayableById = async (
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
      getParamId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message:
          "Payable ID is required.",
      });
    }

    const payable =
      await prisma.accountsPayable.findFirst({
        where: {
          id,
          organizationId,
        },

        include: {
          vendor: true,
        },
      });

    if (!payable) {
      return res.status(404).json({
        success: false,
        message:
          "Supplier bill not found.",
      });
    }

    return res.status(200).json({
      success: true,
      payable,
    });
  } catch (error) {
    console.error(
      "GET PAYABLE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch supplier bill.",
    });
  }
};

/* =========================================================
   APPROVE PAYABLE
========================================================= */

export const approvePayable = async (
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
      getParamId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message:
          "Payable ID is required.",
      });
    }

    const existingPayable =
      await prisma.accountsPayable.findFirst({
        where: {
          id,
          organizationId,
        },
      });

    if (!existingPayable) {
      return res.status(404).json({
        success: false,
        message:
          "Supplier bill not found.",
      });
    }

    if (
      existingPayable.status ===
      "APPROVED"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Supplier bill is already approved.",
      });
    }

    const result =
      await prisma.accountsPayable.updateMany({
        where: {
          id,
          organizationId,
        },

        data: {
          status: "APPROVED",
        },
      });

    if (result.count !== 1) {
      return res.status(404).json({
        success: false,
        message:
          "Supplier bill not found.",
      });
    }

    const payable =
      await prisma.accountsPayable.findFirst({
        where: {
          id,
          organizationId,
        },

        include: {
          vendor: true,
        },
      });

    return res.status(200).json({
      success: true,
      message:
        "Supplier bill approved successfully.",
      payable,
    });
  } catch (error) {
    console.error(
      "APPROVE PAYABLE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to approve supplier bill.",
    });
  }
};

/* =========================================================
   RECORD PAYMENT
========================================================= */

export const updatePayablePayment = async (
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
      getParamId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message:
          "Payable ID is required.",
      });
    }

    const { paymentAmount } =
      req.body;

    const amountPaid =
      Number(paymentAmount);

    if (
      !Number.isFinite(amountPaid) ||
      amountPaid <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Payment amount must be greater than zero.",
      });
    }

    /*
     * Transaction prevents concurrent payments
     * from corrupting the outstanding balance.
     */
    const payable =
      await prisma.$transaction(
        async (tx) => {
          const existingPayable =
            await tx.accountsPayable.findFirst({
              where: {
                id,
                organizationId,
              },
            });

          if (!existingPayable) {
            throw new Error(
              "PAYABLE_NOT_FOUND"
            );
          }

          if (
            existingPayable.status !==
            "APPROVED"
          ) {
            throw new Error(
              "PAYABLE_NOT_APPROVED"
            );
          }

          const currentOutstanding =
            Number(
              existingPayable.outstandingBalance
            );

          if (
            currentOutstanding <= 0
          ) {
            throw new Error(
              "PAYABLE_ALREADY_PAID"
            );
          }

          if (
            amountPaid >
            currentOutstanding
          ) {
            throw new Error(
              "PAYMENT_EXCEEDS_BALANCE"
            );
          }

          const newOutstanding =
            currentOutstanding -
            amountPaid;

          const paymentStatus =
            newOutstanding <= 0
              ? "PAID"
              : "PARTIALLY_PAID";

          const updated =
            await tx.accountsPayable.updateMany({
              where: {
                id,
                organizationId,
              },

              data: {
                outstandingBalance:
                  newOutstanding,

                paymentStatus,
              },
            });

          if (updated.count !== 1) {
            throw new Error(
              "PAYABLE_NOT_FOUND"
            );
          }

          return tx.accountsPayable.findFirst({
            where: {
              id,
              organizationId,
            },

            include: {
              vendor: true,
            },
          });
        }
      );

    return res.status(200).json({
      success: true,

      message:
        payable?.paymentStatus === "PAID"
          ? "Supplier bill paid successfully."
          : "Supplier payment recorded successfully.",

      payable,
    });
  } catch (error) {
    console.error(
      "UPDATE PAYABLE PAYMENT ERROR:",
      error
    );

    if (
      error instanceof Error
    ) {
      if (
        error.message ===
        "PAYABLE_NOT_FOUND"
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Supplier bill not found.",
        });
      }

      if (
        error.message ===
        "PAYABLE_NOT_APPROVED"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Supplier bill must be approved before payment.",
        });
      }

      if (
        error.message ===
        "PAYABLE_ALREADY_PAID"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "This supplier bill has already been fully paid.",
        });
      }

      if (
        error.message ===
        "PAYMENT_EXCEEDS_BALANCE"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Payment amount cannot exceed the outstanding balance.",
        });
      }
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to record supplier payment.",
    });
  }
};

/* =========================================================
   DELETE PAYABLE
========================================================= */

export const deletePayable = async (
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
      getParamId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message:
          "Payable ID is required.",
      });
    }

    const payable =
      await prisma.accountsPayable.findFirst({
        where: {
          id,
          organizationId,
        },
      });

    if (!payable) {
      return res.status(404).json({
        success: false,
        message:
          "Supplier bill not found.",
      });
    }

    /*
     * Tenant controls its own records.
     * Therefore deletion is allowed regardless
     * of approval/payment state when the member
     * has accountsPayable.delete permission.
     */
    const deletion =
      await prisma.accountsPayable.deleteMany({
        where: {
          id,
          organizationId,
        },
      });

    if (deletion.count !== 1) {
      return res.status(404).json({
        success: false,
        message:
          "Supplier bill not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Supplier bill deleted successfully.",
    });
  } catch (error) {
    console.error(
      "DELETE PAYABLE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete supplier bill.",
    });
  }
};