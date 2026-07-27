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

const getValidAmount = (
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

/* =========================================================
   STK PUSH
========================================================= */

export const stkPush = async (
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
      phoneNumber,
      amount,
      accountReference,
      transactionDesc,
    } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required.",
      });
    }

    const normalizedAmount =
      getValidAmount(amount);

    if (normalizedAmount === null) {
      return res.status(400).json({
        success: false,
        message:
          "Amount must be greater than zero.",
      });
    }

    const transaction =
      await prisma.mpesaTransaction.create({
        data: {
          organizationId,

          transactionType:
            "STK_PUSH",

          phoneNumber:
            String(phoneNumber).trim(),

          amount:
            normalizedAmount,

          accountReference:
            accountReference
              ? String(
                  accountReference
                ).trim()
              : null,

          transactionDesc:
            transactionDesc
              ? String(
                  transactionDesc
                ).trim()
              : null,

          status:
            "PENDING",
        },
      });

    return res.status(201).json({
      success: true,
      transaction,
    });
  } catch (error) {
    console.error(
      "STK PUSH ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to create STK Push transaction.",
    });
  }
};

/* =========================================================
   C2B PAYMENT
========================================================= */

export const c2bPayment = async (
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
      phoneNumber,
      amount,
      accountReference,
    } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required.",
      });
    }

    const normalizedAmount =
      getValidAmount(amount);

    if (normalizedAmount === null) {
      return res.status(400).json({
        success: false,
        message:
          "Amount must be greater than zero.",
      });
    }

    const transaction =
      await prisma.mpesaTransaction.create({
        data: {
          organizationId,

          transactionType:
            "C2B",

          phoneNumber:
            String(phoneNumber).trim(),

          amount:
            normalizedAmount,

          accountReference:
            accountReference
              ? String(
                  accountReference
                ).trim()
              : null,

          status:
            "COMPLETED",
        },
      });

    return res.status(201).json({
      success: true,
      transaction,
    });
  } catch (error) {
    console.error(
      "C2B PAYMENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to create C2B transaction.",
    });
  }
};

/* =========================================================
   B2C PAYMENT
========================================================= */

export const b2cPayment = async (
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
      phoneNumber,
      amount,
      counterparty,
    } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required.",
      });
    }

    const normalizedAmount =
      getValidAmount(amount);

    if (normalizedAmount === null) {
      return res.status(400).json({
        success: false,
        message:
          "Amount must be greater than zero.",
      });
    }

    const transaction =
      await prisma.mpesaTransaction.create({
        data: {
          organizationId,

          transactionType:
            "B2C",

          phoneNumber:
            String(phoneNumber).trim(),

          amount:
            normalizedAmount,

          counterparty:
            counterparty
              ? String(
                  counterparty
                ).trim()
              : null,

          status:
            "PENDING",
        },
      });

    return res.status(201).json({
      success: true,
      transaction,
    });
  } catch (error) {
    console.error(
      "B2C PAYMENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to create B2C transaction.",
    });
  }
};

/* =========================================================
   B2B PAYMENT
========================================================= */

export const b2bPayment = async (
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
      amount,
      counterparty,
      accountReference,
    } = req.body;

    const normalizedAmount =
      getValidAmount(amount);

    if (normalizedAmount === null) {
      return res.status(400).json({
        success: false,
        message:
          "Amount must be greater than zero.",
      });
    }

    const transaction =
      await prisma.mpesaTransaction.create({
        data: {
          organizationId,

          transactionType:
            "B2B",

          phoneNumber:
            "BUSINESS",

          amount:
            normalizedAmount,

          counterparty:
            counterparty
              ? String(
                  counterparty
                ).trim()
              : null,

          accountReference:
            accountReference
              ? String(
                  accountReference
                ).trim()
              : null,

          status:
            "PENDING",
        },
      });

    return res.status(201).json({
      success: true,
      transaction,
    });
  } catch (error) {
    console.error(
      "B2B PAYMENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to create B2B transaction.",
    });
  }
};

/* =========================================================
   M-PESA CALLBACK
========================================================= */

export const mpesaCallback = async (
  _req: AuthRequest,
  res: Response
) => {
  try {
    /*
     * Actual callback verification and transaction
     * reconciliation will be handled when the live
     * M-Pesa integration is connected.
     */

    return res.status(200).json({
      ResultCode: 0,
      ResultDesc: "Accepted",
    });
  } catch (error) {
    console.error(
      "M-PESA CALLBACK ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to process M-Pesa callback.",
    });
  }
};

/* =========================================================
   GET TRANSACTIONS
========================================================= */

export const getTransactions = async (
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

    const transactions =
      await prisma.mpesaTransaction.findMany({
        where: {
          organizationId,
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    return res.status(200).json({
      success: true,

      transactions,

      meta: {
        organizationId,
        count: transactions.length,
      },
    });
  } catch (error) {
    console.error(
      "GET M-PESA TRANSACTIONS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch M-Pesa transactions.",
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
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const id =
      req.params.id as string;

    if (!id) {
      return res.status(400).json({
        success: false,
        message:
          "Transaction ID is required.",
      });
    }

    const transaction =
      await prisma.mpesaTransaction.findFirst({
        where: {
          id,
          organizationId,
        },
      });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message:
          "Transaction not found.",
      });
    }

    return res.status(200).json({
      success: true,
      transaction,
    });
  } catch (error) {
    console.error(
      "GET M-PESA TRANSACTION ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch M-Pesa transaction.",
    });
  }
};