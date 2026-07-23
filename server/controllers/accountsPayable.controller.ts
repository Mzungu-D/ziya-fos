import type { Request, Response } from "express";
import prisma from "../config/prisma";

/* =========================================================
   HELPERS
========================================================= */

const getParamId = (value: string | string[] | undefined): string | null => {
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
  req: Request,
  res: Response
) => {
  try {
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

    const parsedAmount = Number(amount);

    if (
      !Number.isFinite(parsedAmount) ||
      parsedAmount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than zero.",
      });
    }

    const parsedDueDate = new Date(dueDate);

    if (Number.isNaN(parsedDueDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid due date.",
      });
    }

    /* Verify vendor */

    const vendor = await prisma.vendor.findUnique({
      where: {
        id: String(vendorId),
      },
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found.",
      });
    }

    /* Prevent duplicate vendor invoice */

    const existingPayable =
      await prisma.accountsPayable.findFirst({
        where: {
          vendorId: String(vendorId),
          invoiceNumber: String(invoiceNumber).trim(),
        },
      });

    if (existingPayable) {
      return res.status(409).json({
        success: false,
        message:
          "This invoice number already exists for the selected vendor.",
      });
    }

    const payable = await prisma.accountsPayable.create({
      data: {
        invoiceNumber: String(invoiceNumber).trim(),
        vendorId: String(vendorId),
        description: String(description).trim(),
        amount: parsedAmount,
        outstandingBalance: parsedAmount,
        dueDate: parsedDueDate,
        paymentStatus: "UNPAID",
        status: "PENDING",
      },

      include: {
        vendor: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Supplier bill created successfully.",
      payable,
    });
  } catch (error) {
    console.error("CREATE PAYABLE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create supplier bill.",
    });
  }
};

/* =========================================================
   GET ALL PAYABLES
========================================================= */

export const getPayables = async (
  _req: Request,
  res: Response
) => {
  try {
    const payables = await prisma.accountsPayable.findMany({
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
    console.error("GET PAYABLES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch supplier bills.",
    });
  }
};

/* =========================================================
   GET SINGLE PAYABLE
========================================================= */

export const getPayableById = async (
  req: Request,
  res: Response
) => {
  try {
    const id = getParamId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Payable ID is required.",
      });
    }

    const payable = await prisma.accountsPayable.findUnique({
      where: {
        id,
      },

      include: {
        vendor: true,
      },
    });

    if (!payable) {
      return res.status(404).json({
        success: false,
        message: "Supplier bill not found.",
      });
    }

    return res.status(200).json({
      success: true,
      payable,
    });
  } catch (error) {
    console.error("GET PAYABLE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch supplier bill.",
    });
  }
};

/* =========================================================
   APPROVE PAYABLE
========================================================= */

export const approvePayable = async (
  req: Request,
  res: Response
) => {
  try {
    const id = getParamId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Payable ID is required.",
      });
    }

    const existingPayable =
      await prisma.accountsPayable.findUnique({
        where: {
          id,
        },
      });

    if (!existingPayable) {
      return res.status(404).json({
        success: false,
        message: "Supplier bill not found.",
      });
    }

    if (existingPayable.status === "APPROVED") {
      return res.status(400).json({
        success: false,
        message: "Supplier bill is already approved.",
      });
    }

    const payable = await prisma.accountsPayable.update({
      where: {
        id,
      },

      data: {
        status: "APPROVED",
      },

      include: {
        vendor: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Supplier bill approved successfully.",
      payable,
    });
  } catch (error) {
    console.error("APPROVE PAYABLE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to approve supplier bill.",
    });
  }
};

/* =========================================================
   RECORD PAYMENT
========================================================= */

export const updatePayablePayment = async (
  req: Request,
  res: Response
) => {
  try {
    const id = getParamId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Payable ID is required.",
      });
    }

    const { paymentAmount } = req.body;

    const amountPaid = Number(paymentAmount);

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

    const existingPayable =
      await prisma.accountsPayable.findUnique({
        where: {
          id,
        },
      });

    if (!existingPayable) {
      return res.status(404).json({
        success: false,
        message: "Supplier bill not found.",
      });
    }

    if (existingPayable.status !== "APPROVED") {
      return res.status(400).json({
        success: false,
        message:
          "Supplier bill must be approved before payment.",
      });
    }

    const currentOutstanding = Number(
      existingPayable.outstandingBalance
    );

    if (currentOutstanding <= 0) {
      return res.status(400).json({
        success: false,
        message:
          "This supplier bill has already been fully paid.",
      });
    }

    if (amountPaid > currentOutstanding) {
      return res.status(400).json({
        success: false,
        message:
          "Payment amount cannot exceed the outstanding balance.",
      });
    }

    const newOutstanding =
      currentOutstanding - amountPaid;

    const paymentStatus =
      newOutstanding <= 0
        ? "PAID"
        : "PARTIALLY_PAID";

    const payable = await prisma.accountsPayable.update({
      where: {
        id,
      },

      data: {
        outstandingBalance: newOutstanding,
        paymentStatus,
      },

      include: {
        vendor: true,
      },
    });

    return res.status(200).json({
      success: true,

      message:
        paymentStatus === "PAID"
          ? "Supplier bill paid successfully."
          : "Supplier payment recorded successfully.",

      payable,
    });
  } catch (error) {
    console.error("UPDATE PAYABLE PAYMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to record supplier payment.",
    });
  }
};

/* =========================================================
   DELETE PAYABLE
========================================================= */

export const deletePayable = async (
  req: Request,
  res: Response
) => {
  try {
    const id = getParamId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Payable ID is required.",
      });
    }

    const payable = await prisma.accountsPayable.findUnique({
      where: {
        id,
      },
    });

    if (!payable) {
      return res.status(404).json({
        success: false,
        message: "Supplier bill not found.",
      });
    }

    if (payable.status === "APPROVED") {
      return res.status(400).json({
        success: false,
        message:
          "An approved supplier bill cannot be deleted.",
      });
    }

    const amount = Number(payable.amount);
    const outstanding = Number(
      payable.outstandingBalance
    );

    if (Math.abs(outstanding - amount) >= 0.01) {
      return res.status(400).json({
        success: false,
        message:
          "A supplier bill with recorded payments cannot be deleted.",
      });
    }

    await prisma.accountsPayable.delete({
      where: {
        id,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Supplier bill deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE PAYABLE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete supplier bill.",
    });
  }
};