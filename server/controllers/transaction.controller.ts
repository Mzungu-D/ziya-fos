import { Response } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

const getOrganizationId = (
  req: AuthRequest
): string | null => {
  const organizationId =
    req.user?.organizationId;

  return organizationId?.trim() || null;
};

/* =========================================================
   GET ALL TRANSACTIONS
========================================================= */

export const getTransactions = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(403).json({
        success: false,
        message: "No organization context",
      });
    }

    const requestedLimit =
      Number(req.query.limit ?? 50);

    const limit =
      Number.isInteger(requestedLimit) &&
      requestedLimit >= 1 &&
      requestedLimit <= 100
        ? requestedLimit
        : 50;

    const transactions =
      await prisma.transaction.findMany({
        where: {
          organizationId,
        },

        orderBy: {
          createdAt: "desc",
        },

        take: limit,
      });

    return res.status(200).json({
      success: true,
      transactions,
      meta: {
        organizationId,
        count: transactions.length,
        limit,
      },
    });
  } catch (error) {
    console.error(
      "GET TRANSACTIONS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch transactions",
    });
  }
};

/* =========================================================
   GET TRANSACTION BY ID
========================================================= */

export const getTransactionById = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(403).json({
        success: false,
        message: "No organization context",
      });
    }

    const transaction =
      await prisma.transaction.findFirst({
        where: {
          id: String(req.params.id),
          organizationId,
        },
      });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    return res.status(200).json({
      success: true,
      transaction,
    });
  } catch (error) {
    console.error(
      "GET TRANSACTION ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch transaction",
    });
  }
};

/* =========================================================
   CREATE TRANSACTION
========================================================= */

export const createTransaction = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(403).json({
        success: false,
        message: "No organization context",
      });
    }

    const {
      reference,
      description,
      amount,
      type,
    } = req.body ?? {};

    const normalizedReference =
      typeof reference === "string"
        ? reference.trim()
        : "";

    const normalizedDescription =
      typeof description === "string"
        ? description.trim()
        : "";

    const normalizedType =
      typeof type === "string"
        ? type.trim()
        : "";

    if (
      !normalizedReference ||
      !normalizedDescription ||
      !normalizedType
    ) {
      return res.status(400).json({
        success: false,
        message:
          "reference, description and type are required",
      });
    }

    const parsedAmount =
      Number(amount);

    if (
      !Number.isFinite(parsedAmount)
    ) {
      return res.status(400).json({
        success: false,
        message: "amount must be a valid number",
      });
    }

    const duplicate =
      await prisma.transaction.findFirst({
        where: {
          organizationId,
          reference:
            normalizedReference,
        },

        select: {
          id: true,
        },
      });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message:
          "Reference already exists",
      });
    }

    const transaction =
      await prisma.transaction.create({
        data: {
          organizationId,
          reference:
            normalizedReference,
          description:
            normalizedDescription,
          amount: parsedAmount,
          type: normalizedType,
        },
      });

    return res.status(201).json({
      success: true,
      transaction,
    });
  } catch (error: any) {
    console.error(
      "CREATE TRANSACTION ERROR:",
      error
    );

    if (error?.code === "P2002") {
      return res.status(409).json({
        success: false,
        message:
          "Reference already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to create transaction",
    });
  }
};

/* =========================================================
   UPDATE TRANSACTION
========================================================= */

export const updateTransaction = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(403).json({
        success: false,
        message: "No organization context",
      });
    }

    const existing =
      await prisma.transaction.findFirst({
        where: {
          id: String(req.params.id),
          organizationId,
        },
      });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    const {
      description,
      amount,
      type,
    } = req.body ?? {};

    let normalizedAmount =
      existing.amount;

    if (amount !== undefined) {
      normalizedAmount =
        Number(amount);

      if (
        !Number.isFinite(
          normalizedAmount
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "amount must be a valid number",
        });
      }
    }

    const normalizedDescription =
      typeof description === "string"
        ? description.trim()
        : existing.description;

    const normalizedType =
      typeof type === "string"
        ? type.trim()
        : existing.type;

    const transaction =
      await prisma.transaction.update({
        where: {
          id: existing.id,
        },

        data: {
          description:
            normalizedDescription,
          amount:
            normalizedAmount,
          type:
            normalizedType,
        },
      });

    return res.status(200).json({
      success: true,
      transaction,
    });
  } catch (error) {
    console.error(
      "UPDATE TRANSACTION ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update transaction",
    });
  }
};

/* =========================================================
   DELETE TRANSACTION
========================================================= */

export const deleteTransaction = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(403).json({
        success: false,
        message: "No organization context",
      });
    }

    const existing =
      await prisma.transaction.findFirst({
        where: {
          id: String(req.params.id),
          organizationId,
        },

        select: {
          id: true,
        },
      });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    await prisma.transaction.delete({
      where: {
        id: existing.id,
      },
    });

    return res.status(204).send();
  } catch (error) {
    console.error(
      "DELETE TRANSACTION ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete transaction",
    });
  }
};