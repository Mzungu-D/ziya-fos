import { Response } from "express";
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

/* =========================================================
   CREATE EXPENSE
========================================================= */

export const createExpense = async (
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
      expenseCode,
      vendorId,
      category,
      description,
      amount,
      expenseDate,
      approvedBy,
    } = req.body;

    /* =====================================================
       VALIDATION
    ===================================================== */

    if (
      !expenseCode ||
      !category ||
      amount === undefined ||
      amount === null ||
      !expenseDate
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Expense code, category, amount and expense date are required.",
      });
    }

    const normalizedAmount =
      Number(amount);

    if (
      !Number.isFinite(normalizedAmount) ||
      normalizedAmount < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Amount must be a valid non-negative number.",
      });
    }

    const parsedExpenseDate =
      new Date(expenseDate);

    if (
      Number.isNaN(
        parsedExpenseDate.getTime()
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Expense date is invalid.",
      });
    }

    /* =====================================================
       VERIFY VENDOR BELONGS TO TENANT
    ===================================================== */

    if (vendorId) {
      const vendor =
        await prisma.vendor.findFirst({
          where: {
            id: String(vendorId),
            organizationId,
          },

          select: {
            id: true,
          },
        });

      if (!vendor) {
        return res.status(404).json({
          success: false,
          message:
            "Vendor not found in this organization.",
        });
      }
    }

    /* =====================================================
       CREATE EXPENSE
    ===================================================== */

    const expense =
      await prisma.expense.create({
        data: {
          organizationId,

          expenseCode:
            String(expenseCode).trim(),

          vendorId:
            vendorId
              ? String(vendorId)
              : null,

          category:
            String(category).trim(),

          description:
            description
              ? String(description).trim()
              : "",

          amount:
            normalizedAmount,

          expenseDate:
            parsedExpenseDate,

          status:
            "PENDING",

          approvedBy:
            approvedBy
              ? String(approvedBy)
              : null,
        },

        include: {
          vendor: true,
        },
      });

    return res.status(201).json({
      success: true,
      expense,
    });
  } catch (error: any) {
    console.error(
      "CREATE EXPENSE ERROR:",
      error
    );

    if (error?.code === "P2002") {
      return res.status(409).json({
        success: false,
        message:
          "An expense with this expense code already exists in this organization.",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to create expense",
    });
  }
};

/* =========================================================
   GET EXPENSES
========================================================= */

export const getExpenses = async (
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

    const expenses =
      await prisma.expense.findMany({
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

      expenses,

      meta: {
        organizationId,
        count: expenses.length,
      },
    });
  } catch (error) {
    console.error(
      "GET EXPENSES ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch expenses",
    });
  }
};