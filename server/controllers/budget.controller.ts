import type { Response } from "express";
import prisma from "../config/prisma";
import type { AuthRequest } from "../middleware/auth.middleware";

function getTenantContext(req: AuthRequest) {
  if (!req.user?.userId || !req.user?.organizationId) {
    return null;
  }

  const sessionType = (
    req.user as AuthRequest["user"] & {
      sessionType?: string;
    }
  ).sessionType;

  if (sessionType && sessionType !== "TENANT") {
    return null;
  }

  return {
    userId: req.user.userId,
    organizationId: req.user.organizationId,
  };
}

function parseAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return amount;
}

function parseYear(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const year = Number(value);

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return null;
  }

  return year;
}

function cleanDepartment(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * GET BUDGETS
 *
 * Returns budgets belonging only to the
 * authenticated tenant organization.
 */
export const getBudgets = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const context = getTenantContext(req);

    if (!context) {
      return res.status(403).json({
        success: false,
        code: "TENANT_SESSION_REQUIRED",
        message: "A tenant session is required.",
      });
    }

    const requestedYear =
      parseYear(req.query.year) ??
      new Date().getFullYear();

    const budgets = await prisma.budget.findMany({
      where: {
        organizationId: context.organizationId,
        year: requestedYear,
      },
      orderBy: {
        department: "asc",
      },
    });

    const totalBudget = budgets.reduce(
      (sum, budget) =>
        sum + Number(budget.amount),
      0
    );

    return res.status(200).json({
      success: true,
      data: budgets,
      totals: {
        budget: totalBudget,
        count: budgets.length,
      },
      meta: {
        organizationId: context.organizationId,
        year: requestedYear,
      },
    });
  } catch (error) {
    console.error(
      "[BUDGET] Failed to fetch budgets:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "BUDGETS_FETCH_FAILED",
      message: "Failed to fetch budgets.",
    });
  }
};

/**
 * GET SINGLE BUDGET
 */
export const getBudget = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const context = getTenantContext(req);

    if (!context) {
      return res.status(403).json({
        success: false,
        code: "TENANT_SESSION_REQUIRED",
        message: "A tenant session is required.",
      });
    }

    const id =
      typeof req.params.id === "string"
        ? req.params.id.trim()
        : "";

    if (!id) {
      return res.status(400).json({
        success: false,
        code: "BUDGET_ID_REQUIRED",
        message: "Budget ID is required.",
      });
    }

    const budget = await prisma.budget.findFirst({
      where: {
        id,
        organizationId: context.organizationId,
      },
    });

    if (!budget) {
      return res.status(404).json({
        success: false,
        code: "BUDGET_NOT_FOUND",
        message: "Budget not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: budget,
    });
  } catch (error) {
    console.error(
      "[BUDGET] Failed to fetch budget:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "BUDGET_FETCH_FAILED",
      message: "Failed to fetch budget.",
    });
  }
};

/**
 * CREATE BUDGET
 */
export const createBudget = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const context = getTenantContext(req);

    if (!context) {
      return res.status(403).json({
        success: false,
        code: "TENANT_SESSION_REQUIRED",
        message: "A tenant session is required.",
      });
    }

    const department = cleanDepartment(
      req.body?.department
    );

    const amount = parseAmount(
      req.body?.amount
    );

    const year = parseYear(
      req.body?.year
    );

    if (!department) {
      return res.status(400).json({
        success: false,
        code: "BUDGET_DEPARTMENT_REQUIRED",
        message: "Department is required.",
      });
    }

    if (amount === null) {
      return res.status(400).json({
        success: false,
        code: "BUDGET_AMOUNT_INVALID",
        message:
          "Budget amount must be a valid non-negative number.",
      });
    }

    if (year === null) {
      return res.status(400).json({
        success: false,
        code: "BUDGET_YEAR_INVALID",
        message: "Budget year is invalid.",
      });
    }

    /*
     * Prevent accidental duplicate department
     * budgets for the same organization and year.
     */
    const existing = await prisma.budget.findFirst({
      where: {
        organizationId: context.organizationId,
        department,
        year,
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        code: "BUDGET_ALREADY_EXISTS",
        message:
          "A budget for this department already exists for this year.",
      });
    }

    const budget = await prisma.budget.create({
      data: {
        department,
        amount,
        year,
        organizationId: context.organizationId,
      },
    });

    return res.status(201).json({
      success: true,
      data: budget,
    });
  } catch (error) {
    console.error(
      "[BUDGET] Failed to create budget:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "BUDGET_CREATE_FAILED",
      message: "Failed to create budget.",
    });
  }
};

/**
 * UPDATE BUDGET
 */
export const updateBudget = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const context = getTenantContext(req);

    if (!context) {
      return res.status(403).json({
        success: false,
        code: "TENANT_SESSION_REQUIRED",
        message: "A tenant session is required.",
      });
    }

    const id =
      typeof req.params.id === "string"
        ? req.params.id.trim()
        : "";

    if (!id) {
      return res.status(400).json({
        success: false,
        code: "BUDGET_ID_REQUIRED",
        message: "Budget ID is required.",
      });
    }

    const existing = await prisma.budget.findFirst({
      where: {
        id,
        organizationId: context.organizationId,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        code: "BUDGET_NOT_FOUND",
        message: "Budget not found.",
      });
    }

    const department =
      req.body?.department !== undefined
        ? cleanDepartment(req.body.department)
        : existing.department;

    const amount =
      req.body?.amount !== undefined
        ? parseAmount(req.body.amount)
        : Number(existing.amount);

    const year =
      req.body?.year !== undefined
        ? parseYear(req.body.year)
        : existing.year;

    if (!department) {
      return res.status(400).json({
        success: false,
        code: "BUDGET_DEPARTMENT_REQUIRED",
        message: "Department is required.",
      });
    }

    if (amount === null) {
      return res.status(400).json({
        success: false,
        code: "BUDGET_AMOUNT_INVALID",
        message:
          "Budget amount must be a valid non-negative number.",
      });
    }

    if (year === null) {
      return res.status(400).json({
        success: false,
        code: "BUDGET_YEAR_INVALID",
        message: "Budget year is invalid.",
      });
    }

    const duplicate = await prisma.budget.findFirst({
      where: {
        organizationId: context.organizationId,
        department,
        year,
        NOT: {
          id,
        },
      },
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        code: "BUDGET_ALREADY_EXISTS",
        message:
          "A budget for this department already exists for this year.",
      });
    }

    const budget = await prisma.budget.update({
      where: {
        id,
      },
      data: {
        department,
        amount,
        year,
      },
    });

    return res.status(200).json({
      success: true,
      data: budget,
    });
  } catch (error) {
    console.error(
      "[BUDGET] Failed to update budget:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "BUDGET_UPDATE_FAILED",
      message: "Failed to update budget.",
    });
  }
};

/**
 * DELETE BUDGET
 */
export const deleteBudget = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const context = getTenantContext(req);

    if (!context) {
      return res.status(403).json({
        success: false,
        code: "TENANT_SESSION_REQUIRED",
        message: "A tenant session is required.",
      });
    }

    const id =
      typeof req.params.id === "string"
        ? req.params.id.trim()
        : "";

    if (!id) {
      return res.status(400).json({
        success: false,
        code: "BUDGET_ID_REQUIRED",
        message: "Budget ID is required.",
      });
    }

    const existing = await prisma.budget.findFirst({
      where: {
        id,
        organizationId: context.organizationId,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        code: "BUDGET_NOT_FOUND",
        message: "Budget not found.",
      });
    }

    await prisma.budget.delete({
      where: {
        id,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Budget deleted successfully.",
    });
  } catch (error) {
    console.error(
      "[BUDGET] Failed to delete budget:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "BUDGET_DELETE_FAILED",
      message: "Failed to delete budget.",
    });
  }
};