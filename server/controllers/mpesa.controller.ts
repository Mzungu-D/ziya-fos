import { Response } from "express";

import prisma from "../config/prisma";

import {
  AuthRequest,
} from "../middleware/auth.middleware";

import {
  initiateB2CPayment,
  normalizeMpesaPhoneNumber,
} from "../services/mpesa.service";

/* =========================================================
   HELPERS
========================================================= */

const getOrganizationId = (
  req: AuthRequest,
): string | null => {
  return req.user?.organizationId ?? null;
};

const getValidAmount = (
  value: unknown,
): number | null => {
  const amount = Number(value);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return null;
  }

  return Math.round(amount);
};

const getResultCode = (
  value: unknown,
): number | null => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
};

const getResultParameter = (
  result: any,
  key: string,
): unknown => {
  const parameters =
    result?.ResultParameters
      ?.ResultParameter;

  if (!Array.isArray(parameters)) {
    return undefined;
  }

  const parameter =
    parameters.find(
      (item: any) =>
        item?.Key === key,
    );

  return parameter?.Value;
};

const getTransactionStatus = (
  resultCode: number | null,
): string => {
  if (resultCode === 0) {
    return "COMPLETED";
  }

  if (
    resultCode === 1032 ||
    resultCode === 1037
  ) {
    return "FAILED";
  }

  return "FAILED";
};

/* =========================================================
   UPDATE BATCH SUMMARY
========================================================= */

const refreshBatchSummary = async (
  batchId: string,
): Promise<void> => {
  const transactions =
    await prisma.mpesaTransaction.findMany({
      where: {
        batchId,
      },
      select: {
        status: true,
      },
    });

  const successful =
    transactions.filter(
      (transaction) =>
        transaction.status ===
          "COMPLETED" ||
        transaction.status ===
          "SUCCESS",
    ).length;

  const failed =
    transactions.filter(
      (transaction) =>
        transaction.status ===
          "FAILED" ||
        transaction.status ===
          "REJECTED" ||
        transaction.status ===
          "TIMEOUT",
    ).length;

  const pending =
    transactions.length -
    successful -
    failed;

  let status = "PROCESSING";

  if (pending > 0) {
    status = "PROCESSING";
  }

  if (
    pending === 0 &&
    failed === 0 &&
    successful > 0
  ) {
    status = "COMPLETED";
  }

  if (
    pending === 0 &&
    successful === 0 &&
    failed > 0
  ) {
    status = "FAILED";
  }

  if (
    pending === 0 &&
    successful > 0 &&
    failed > 0
  ) {
    status = "PARTIAL";
  }

  await prisma.mpesaPaymentBatch.update({
    where: {
      id: batchId,
    },
    data: {
      successful,
      failed,
      pending,
      status,
    },
  });
};

/* =========================================================
   STK PUSH
========================================================= */

export const stkPush = async (
  req: AuthRequest,
  res: Response,
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

    if (normalizedAmount === null) {
      return res.status(400).json({
        success: false,
        message:
          "Amount must be greater than zero.",
      });
    }

    const normalizedPhone =
      normalizeMpesaPhoneNumber(
        String(phoneNumber),
      );

    const transaction =
      await prisma.mpesaTransaction.create({
        data: {
          organizationId,

          transactionType:
            "STK_PUSH",

          phoneNumber:
            normalizedPhone,

          amount:
            normalizedAmount,

          accountReference:
            accountReference
              ? String(
                  accountReference,
                ).trim()
              : null,

          transactionDesc:
            transactionDesc
              ? String(
                  transactionDesc,
                ).trim()
              : null,

          status: "PENDING",
        },
      });

    return res.status(201).json({
      success: true,
      transaction,
    });
  } catch (error) {
    console.error(
      "[MPESA] STK PUSH ERROR:",
      error,
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to create STK Push transaction.",
    });
  }
};

/* =========================================================
   C2B
========================================================= */

export const c2bPayment = async (
  req: AuthRequest,
  res: Response,
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

    if (normalizedAmount === null) {
      return res.status(400).json({
        success: false,
        message:
          "Amount must be greater than zero.",
      });
    }

    const normalizedPhone =
      normalizeMpesaPhoneNumber(
        String(phoneNumber),
      );

    const transaction =
      await prisma.mpesaTransaction.create({
        data: {
          organizationId,
          transactionType: "C2B",

          phoneNumber:
            normalizedPhone,

          amount:
            normalizedAmount,

          accountReference:
            accountReference
              ? String(
                  accountReference,
                ).trim()
              : null,

          status: "COMPLETED",
        },
      });

    return res.status(201).json({
      success: true,
      transaction,
    });
  } catch (error) {
    console.error(
      "[MPESA] C2B ERROR:",
      error,
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to create C2B transaction.",
    });
  }
};

/* =========================================================
   SINGLE B2C PAYMENT
========================================================= */

export const b2cPayment = async (
  req: AuthRequest,
  res: Response,
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
      remarks,
      occasion,
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

    if (normalizedAmount === null) {
      return res.status(400).json({
        success: false,
        message:
          "Amount must be greater than zero.",
      });
    }

    const normalizedPhone =
      normalizeMpesaPhoneNumber(
        String(phoneNumber),
      );

    const transaction =
      await prisma.mpesaTransaction.create({
        data: {
          organizationId,
          transactionType: "B2C",

          phoneNumber:
            normalizedPhone,

          amount:
            normalizedAmount,

          counterparty:
            counterparty
              ? String(
                  counterparty,
                ).trim()
              : null,

          transactionDesc:
            remarks
              ? String(remarks).trim()
              : null,

          status: "PENDING",
        },
      });

    try {
      const response =
        await initiateB2CPayment({
          amount:
            normalizedAmount,

          phoneNumber:
            normalizedPhone,

          remarks:
            remarks ||
            `ZIYA payment ${transaction.id}`,

          occasion:
            occasion ||
            "ZIYA-FOS",
        });

      const responseCode =
        getResultCode(
          response.ResponseCode,
        );

      const updated =
        await prisma.mpesaTransaction.update({
          where: {
            id: transaction.id,
          },
          data: {
            conversationId:
              response.ConversationID
                ? String(
                    response.ConversationID,
                  )
                : null,

            originatorConversationId:
              response.OriginatorConversationID
                ? String(
                    response.OriginatorConversationID,
                  )
                : null,

            resultCode:
              responseCode,

            resultDescription:
              response.ResponseDescription
                ? String(
                    response.ResponseDescription,
                  )
                : null,

            status:
              responseCode === null ||
              responseCode === 0
                ? "PENDING"
                : "FAILED",
          },
        });

      return res.status(201).json({
        success: true,
        transaction: updated,
        safaricom: response,
      });
    } catch (error) {
      await prisma.mpesaTransaction.update({
        where: {
          id: transaction.id,
        },
        data: {
          status: "FAILED",
          resultDescription:
            error instanceof Error
              ? error.message
              : "B2C request failed.",
        },
      });

      throw error;
    }
  } catch (error) {
    console.error(
      "[MPESA] B2C ERROR:",
      error,
    );

    return res.status(502).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "M-Pesa B2C payment failed.",
    });
  }
};

/* =========================================================
   BULK B2C PAYMENT
========================================================= */

export const bulkB2CPayment = async (
  req: AuthRequest,
  res: Response,
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
      batchReference,
      description,
      payments,
    } = req.body;

    if (
      !Array.isArray(payments) ||
      payments.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "At least one payment is required.",
      });
    }

    if (payments.length > 100) {
      return res.status(400).json({
        success: false,
        message:
          "A maximum of 100 payments is allowed per batch.",
      });
    }

    const reference =
      String(
        batchReference ||
          `ZIYA-${Date.now()}`,
      ).trim();

    if (!reference) {
      return res.status(400).json({
        success: false,
        message:
          "Batch reference is required.",
      });
    }

    const existing =
      await prisma.mpesaPaymentBatch.findFirst({
        where: {
          organizationId,
          batchReference: reference,
        },
      });

    if (existing) {
      return res.status(409).json({
        success: false,
        message:
          "A payment batch with this reference already exists.",
        batchId: existing.id,
      });
    }

    const normalizedPayments =
      payments.map(
        (
          payment: any,
          index: number,
        ) => {
          if (!payment?.phoneNumber) {
            throw new Error(
              `Payment ${index + 1}: phone number is required.`,
            );
          }

          const amount =
            getValidAmount(
              payment.amount,
            );

          if (amount === null) {
            throw new Error(
              `Payment ${index + 1}: amount must be greater than zero.`,
            );
          }

          return {
            phoneNumber:
              normalizeMpesaPhoneNumber(
                String(
                  payment.phoneNumber,
                ),
              ),

            amount,

            counterparty:
              payment.counterparty
                ? String(
                    payment.counterparty,
                  ).trim()
                : null,

            remarks:
              payment.remarks
                ? String(
                    payment.remarks,
                  ).trim()
                : `ZIYA batch ${reference}`,

            occasion:
              payment.occasion
                ? String(
                    payment.occasion,
                  ).trim()
                : "ZIYA-FOS",
          };
        },
      );

    const totalAmount =
      normalizedPayments.reduce(
        (sum, payment) =>
          sum + payment.amount,
        0,
      );

    const batch =
      await prisma.mpesaPaymentBatch.create({
        data: {
          organizationId,
          batchReference: reference,

          description:
            description
              ? String(
                  description,
                ).trim()
              : null,

          totalAmount,

          totalPayments:
            normalizedPayments.length,

          successful: 0,
          failed: 0,
          pending:
            normalizedPayments.length,

          status: "PROCESSING",
        },
      });

    const results: Array<{
      transactionId: string;
      phoneNumber: string;
      amount: number;
      status: string;
      conversationId?: string | null;
      originatorConversationId?: string | null;
      message?: string;
    }> = [];

    /*
     * Process sequentially.
     *
     * This prevents a large batch from firing
     * dozens of Safaricom requests simultaneously.
     */
    for (
      const payment of normalizedPayments
    ) {
      const transaction =
        await prisma.mpesaTransaction.create({
          data: {
            organizationId,

            transactionType:
              "B2C",

            phoneNumber:
              payment.phoneNumber,

            amount:
              payment.amount,

            counterparty:
              payment.counterparty,

            transactionDesc:
              payment.remarks,

            batchId:
              batch.id,

            status:
              "PENDING",
          },
        });

      try {
        const response =
          await initiateB2CPayment({
            amount:
              payment.amount,

            phoneNumber:
              payment.phoneNumber,

            remarks:
              payment.remarks,

            occasion:
              payment.occasion,
          });

        const responseCode =
          getResultCode(
            response.ResponseCode,
          );

        const updated =
          await prisma.mpesaTransaction.update({
            where: {
              id: transaction.id,
            },

            data: {
              conversationId:
                response.ConversationID
                  ? String(
                      response.ConversationID,
                    )
                  : null,

              originatorConversationId:
                response.OriginatorConversationID
                  ? String(
                      response.OriginatorConversationID,
                    )
                  : null,

              resultCode:
                responseCode,

              resultDescription:
                response.ResponseDescription
                  ? String(
                      response.ResponseDescription,
                    )
                  : null,

              status:
                responseCode === null ||
                responseCode === 0
                  ? "PENDING"
                  : "FAILED",
            },
          });

        results.push({
          transactionId:
            updated.id,

          phoneNumber:
            updated.phoneNumber,

          amount:
            updated.amount,

          status:
            updated.status,

          conversationId:
            updated.conversationId,

          originatorConversationId:
            updated.originatorConversationId,
        });
      } catch (error) {
        await prisma.mpesaTransaction.update({
          where: {
            id: transaction.id,
          },

          data: {
            status: "FAILED",

            resultDescription:
              error instanceof Error
                ? error.message
                : "B2C request failed.",
          },
        });

        results.push({
          transactionId:
            transaction.id,

          phoneNumber:
            transaction.phoneNumber,

          amount:
            transaction.amount,

          status:
            "FAILED",

          message:
            error instanceof Error
              ? error.message
              : "B2C request failed.",
        });
      }
    }

    await refreshBatchSummary(
      batch.id,
    );

    const finalBatch =
      await prisma.mpesaPaymentBatch.findFirst({
        where: {
          id: batch.id,
          organizationId,
        },

        include: {
          transactions: true,
        },
      });

    return res.status(201).json({
      success: true,
      batch: finalBatch,
      results,
    });
  } catch (error) {
    console.error(
      "[MPESA] BULK B2C ERROR:",
      error,
    );

    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to process bulk M-Pesa payments.",
    });
  }
};

/* =========================================================
   M-PESA CALLBACK
========================================================= */

export const mpesaCallback = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const body =
      req.body ?? {};

    const result =
      body.Result ?? body.result;

    if (!result) {
      return res.status(200).json({
        ResultCode: 0,
        ResultDesc:
          "Accepted",
      });
    }

    const resultCode =
      getResultCode(
        result.ResultCode,
      );

    const conversationId =
      result.ConversationID
        ? String(
            result.ConversationID,
          )
        : null;

    const originatorConversationId =
      result.OriginatorConversationID
        ? String(
            result.OriginatorConversationID,
          )
        : null;

    const receipt =
      getResultParameter(
        result,
        "TransactionReceipt",
      );

    const transactionDate =
      getResultParameter(
        result,
        "TransactionCompletedDate",
      );

    const resultDescription =
      result.ResultDesc
        ? String(
            result.ResultDesc,
          )
        : null;

    let transaction = null;

    if (conversationId) {
      transaction =
        await prisma.mpesaTransaction.findFirst({
          where: {
            conversationId,
          },
        });
    }

    if (
      !transaction &&
      originatorConversationId
    ) {
      transaction =
        await prisma.mpesaTransaction.findFirst({
          where: {
            originatorConversationId,
          },
        });
    }

    if (!transaction) {
      console.warn(
        "[MPESA] Callback transaction not found:",
        {
          conversationId,
          originatorConversationId,
          resultCode,
        },
      );

      return res.status(200).json({
        ResultCode: 0,
        ResultDesc:
          "Accepted",
      });
    }

    const status =
      getTransactionStatus(
        resultCode,
      );

    let parsedDate:
      Date | undefined;

    if (transactionDate) {
      const date =
        new Date(
          String(
            transactionDate,
          ),
        );

      if (!Number.isNaN(
        date.getTime(),
      )) {
        parsedDate = date;
      }
    }

    const updated =
      await prisma.mpesaTransaction.update({
        where: {
          id: transaction.id,
        },

        data: {
          conversationId:
            conversationId ??
            transaction.conversationId,

          originatorConversationId:
            originatorConversationId ??
            transaction.originatorConversationId,

          mpesaReceiptNumber:
            receipt
              ? String(receipt)
              : transaction.mpesaReceiptNumber,

          resultCode,

          resultDescription,

          transactionDate:
            parsedDate,

          status,
        },
      });

    if (updated.batchId) {
      await refreshBatchSummary(
        updated.batchId,
      );
    }

    return res.status(200).json({
      ResultCode: 0,
      ResultDesc:
        "Accepted",
    });
  } catch (error) {
    console.error(
      "[MPESA] CALLBACK ERROR:",
      error,
    );

    /*
     * Safaricom callbacks should receive a
     * valid response even if our internal
     * processing encounters an error.
     */
    return res.status(200).json({
      ResultCode: 0,
      ResultDesc:
        "Accepted",
    });
  }
};

/* =========================================================
   GET TRANSACTIONS
========================================================= */

export const getTransactions = async (
  req: AuthRequest,
  res: Response,
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
          createdAt: "desc",
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
      "[MPESA] GET TRANSACTIONS ERROR:",
      error,
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
    res: Response,
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

          include: {
            batch: true,
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
        "[MPESA] GET TRANSACTION ERROR:",
        error,
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch M-Pesa transaction.",
      });
    }
  };

/* =========================================================
   GET BATCHES
========================================================= */

export const getPaymentBatches =
  async (
    req: AuthRequest,
    res: Response,
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

      const batches =
        await prisma.mpesaPaymentBatch.findMany({
          where: {
            organizationId,
          },

          include: {
            transactions: true,
          },

          orderBy: {
            createdAt: "desc",
          },
        });

      return res.status(200).json({
        success: true,
        batches,

        meta: {
          organizationId,
          count:
            batches.length,
        },
      });
    } catch (error) {
      console.error(
        "[MPESA] GET BATCHES ERROR:",
        error,
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch M-Pesa payment batches.",
      });
    }
  };

/* =========================================================
   GET BATCH BY ID
========================================================= */

export const getPaymentBatchById =
  async (
    req: AuthRequest,
    res: Response,
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
            "Batch ID is required.",
        });
      }

      const batch =
        await prisma.mpesaPaymentBatch.findFirst({
          where: {
            id,
            organizationId,
          },

          include: {
            transactions: {
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        });

      if (!batch) {
        return res.status(404).json({
          success: false,
          message:
            "Payment batch not found.",
        });
      }

      return res.status(200).json({
        success: true,
        batch,
      });
    } catch (error) {
      console.error(
        "[MPESA] GET BATCH ERROR:",
        error,
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch M-Pesa payment batch.",
      });
    }
  };