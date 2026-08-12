import { Response } from "express";

import prisma from "../config/prisma";

import { AuthRequest } from "../middleware/auth.middleware";

import {
  initiateB2BPayment,
} from "../services/mpesa.service";

/* =========================================================
   HELPERS
========================================================= */

const getOrganizationId = (
  req: AuthRequest
): string | null => {
  return (
    req.user?.organizationId ??
    null
  );
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

const normalizeText = (
  value: unknown
): string | null => {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const valueString =
    String(value).trim();

  return valueString
    ? valueString
    : null;
};

const isValidShortcode = (
  value: unknown
): boolean => {
  const shortcode =
    typeof value === "string"
      ? value.trim()
      : String(value ?? "").trim();

  return /^\d{5,7}$/.test(
    shortcode
  );
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
        message:
          "Authentication required.",
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
        message:
          "Phone number is required.",
      });
    }

    const normalizedAmount =
      getValidAmount(amount);

    if (
      normalizedAmount === null
    ) {
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
            String(
              phoneNumber
            ).trim(),

          amount:
            normalizedAmount,

          accountReference:
            normalizeText(
              accountReference
            ),

          transactionDesc:
            normalizeText(
              transactionDesc
            ),

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
        message:
          "Authentication required.",
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
        message:
          "Phone number is required.",
      });
    }

    const normalizedAmount =
      getValidAmount(amount);

    if (
      normalizedAmount === null
    ) {
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
            String(
              phoneNumber
            ).trim(),

          amount:
            normalizedAmount,

          accountReference:
            normalizeText(
              accountReference
            ),

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
        message:
          "Authentication required.",
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
        message:
          "Phone number is required.",
      });
    }

    const normalizedAmount =
      getValidAmount(amount);

    if (
      normalizedAmount === null
    ) {
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
            String(
              phoneNumber
            ).trim(),

          amount:
            normalizedAmount,

          counterparty:
            normalizeText(
              counterparty
            ),

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

/**
 * POST /api/mpesa/b2b
 *
 * Sends money from the authenticated organization's
 * configured M-Pesa B2B shortcode to another business.
 *
 * Supported:
 *
 * BusinessPayBill
 * BusinessBuyGoods
 */
export const b2bPayment = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    /* -------------------------------------------------------
       TENANT
    ------------------------------------------------------- */

    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        code:
          "AUTHENTICATION_REQUIRED",
        message:
          "Authentication required.",
      });
    }

    /* -------------------------------------------------------
       REQUEST BODY
    ------------------------------------------------------- */

    const {
      amount,
      partyB,
      counterparty,
      accountReference,
      remarks,
      commandId,
      occasion,
    } = req.body ?? {};

    /* -------------------------------------------------------
       AMOUNT VALIDATION
    ------------------------------------------------------- */

    const normalizedAmount =
      getValidAmount(amount);

    if (
      normalizedAmount === null
    ) {
      return res.status(400).json({
        success: false,
        code:
          "INVALID_AMOUNT",
        message:
          "Amount must be greater than zero.",
      });
    }

    /* -------------------------------------------------------
       PARTY B VALIDATION
    ------------------------------------------------------- */

    const normalizedPartyB =
      String(
        partyB ?? ""
      ).trim();

    if (
      !isValidShortcode(
        normalizedPartyB
      )
    ) {
      return res.status(400).json({
        success: false,
        code:
          "INVALID_PARTY_B",
        message:
          "Party B must be a valid M-Pesa business shortcode or till number.",
      });
    }

    /* -------------------------------------------------------
       COMMAND VALIDATION
    ------------------------------------------------------- */

    const normalizedCommand =
      commandId ??
      "BusinessPayBill";

    if (
      normalizedCommand !==
        "BusinessPayBill" &&
      normalizedCommand !==
        "BusinessBuyGoods"
    ) {
      return res.status(400).json({
        success: false,
        code:
          "INVALID_COMMAND",
        message:
          "B2B command must be BusinessPayBill or BusinessBuyGoods.",
      });
    }

    /* -------------------------------------------------------
       REFERENCE
    ------------------------------------------------------- */

    const normalizedReference =
      String(
        accountReference ??
          "ZIYA-FOS"
      )
        .trim()
        .slice(0, 20);

    /* -------------------------------------------------------
       REMARKS
    ------------------------------------------------------- */

    const normalizedRemarks =
      String(
        remarks ??
          "ZIYA-FOS B2B PAYMENT"
      )
        .trim()
        .slice(0, 100);

    if (
      !normalizedRemarks
    ) {
      return res.status(400).json({
        success: false,
        code:
          "INVALID_REMARKS",
        message:
          "Payment remarks are required.",
      });
    }

    /* -------------------------------------------------------
       CREATE LOCAL TRANSACTION
    ------------------------------------------------------- */

    const transaction =
      await prisma.mpesaTransaction.create({
        data: {
          organizationId,

          transactionType:
            "B2B",

          phoneNumber:
            "BUSINESS",

          amount:
            Math.round(
              normalizedAmount
            ),

          counterparty:
            normalizeText(
              counterparty
            ) ??
            normalizedPartyB,

          accountReference:
            normalizedReference,

          transactionDesc:
            normalizedRemarks,

          status:
            "PENDING",
        },
      });

    /* -------------------------------------------------------
       SEND TO SAFARICOM
    ------------------------------------------------------- */

    try {
      const mpesaResponse =
        await initiateB2BPayment({
          amount:
            normalizedAmount,

          partyB:
            normalizedPartyB,

          accountReference:
            normalizedReference,

          remarks:
            normalizedRemarks,

          commandId:
            normalizedCommand,

          occasion:
            normalizeText(
              occasion
            ) ??
            "ZIYA-FOS",
        });

      /*
       * We intentionally do not mark the transaction
       * COMPLETED here.
       *
       * Safaricom accepting the request only means the
       * payment has been submitted for processing.
       *
       * The final status must come from the callback/
       * reconciliation flow.
       */

      return res.status(201).json({
        success: true,

        message:
          "B2B payment request submitted successfully.",

        transaction,

        mpesa: mpesaResponse,
      });
    } catch (mpesaError: any) {
      console.error(
        "B2B SAFARICOM REQUEST ERROR:",
        mpesaError?.response?.data ??
          mpesaError?.message ??
          mpesaError
      );

      /*
       * The transaction exists in our ledger as a failed
       * submission. We do not delete it because financial
       * transactions must remain auditable.
       */

      return res.status(502).json({
        success: false,

        code:
          "MPESA_B2B_REQUEST_FAILED",

        message:
          "The M-Pesa B2B payment request could not be submitted.",

        transactionId:
          transaction.id,

        mpesa:
          mpesaError?.response?.data ??
          null,
      });
    }
  } catch (error) {
    console.error(
      "B2B PAYMENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      code:
        "B2B_PAYMENT_FAILED",

      message:
        "Failed to process M-Pesa B2B payment.",
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
     * Safaricom must be able to reach this endpoint
     * without a Ziya user JWT.
     *
     * Full callback reconciliation should identify
     * the originating transaction and update its
     * final status.
     */

    return res.status(200).json({
      ResultCode: 0,

      ResultDesc:
        "Accepted",
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
        message:
          "Authentication required.",
      });
    }

    const transactions =
      await prisma.mpesaTransaction.findMany({
        where: {
          organizationId,
        },

        orderBy: {
          createdAt:
            "desc",
        },
      });

    return res.status(200).json({
      success: true,

      transactions,

      meta: {
        organizationId,

        count:
          transactions.length,
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

export const getTransactionById =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(401).json({
          success: false,

          message:
            "Authentication required.",
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