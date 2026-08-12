import prisma from "../config/prisma";
import {
  initiateB2CPayment,
} from "./mpesa.service";

export interface BulkPaymentItem {
  phoneNumber: string;
  amount: number;
  counterparty?: string;
  remarks?: string;
  occasion?: string;
}

export interface BulkPaymentResult {
  transactionId: string;
  phoneNumber: string;
  amount: number;
  status: string;
  conversationId?: string | null;
  originatorConversationId?: string | null;
  resultDescription?: string | null;
}

export async function processMpesaPaymentBatch(
  params: {
    batchId: string;
    organizationId: string;
    payments: BulkPaymentItem[];
  }
): Promise<BulkPaymentResult[]> {
  const results: BulkPaymentResult[] = [];

  for (const payment of params.payments) {
    let transaction:
      | Awaited<
          ReturnType<
            typeof prisma.mpesaTransaction.create
          >
        >
      | null = null;

    try {
      /*
       * Create the individual transaction first.
       * Every recipient gets an independent record.
       */
      transaction =
        await prisma.mpesaTransaction.create({
          data: {
            organizationId:
              params.organizationId,

            batchId:
              params.batchId,

            transactionType:
              "B2C",

            phoneNumber:
              payment.phoneNumber,

            amount:
              payment.amount,

            counterparty:
              payment.counterparty ??
              null,

            transactionDesc:
              payment.remarks ??
              null,

            status:
              "PENDING",
          },
        });

      try {
        /*
         * Submit this individual payment
         * to Safaricom Daraja.
         */
        const response =
          await initiateB2CPayment({
            amount:
              payment.amount,

            phoneNumber:
              payment.phoneNumber,

            remarks:
              payment.remarks ??
              "ZIYA-FOS BULK PAYMENT",

            occasion:
              payment.occasion ??
              `ZIYA-BATCH-${params.batchId}`,
          });

        const responseCode =
          response?.ResponseCode;

        const conversationId =
          response?.ConversationID ??
          null;

        const originatorConversationId =
          response
            ?.OriginatorConversationID ??
          null;

        const resultDescription =
          response
            ?.ResponseDescription ??
          null;

        const accepted =
          responseCode === "0" ||
          responseCode === 0;

        const updated =
          await prisma.mpesaTransaction.update({
            where: {
              id: transaction.id,
            },

            data: {
              conversationId,

              originatorConversationId,

              resultCode:
                responseCode !== undefined &&
                responseCode !== null
                  ? Number(responseCode)
                  : null,

              resultDescription,

              /*
               * Accepted by Daraja is NOT
               * the same as completed.
               */
              status:
                accepted
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

          resultDescription:
            updated.resultDescription,
        });
      } catch (providerError: any) {
        const message =
          providerError?.message ??
          "M-Pesa provider request failed.";

        const failed =
          await prisma.mpesaTransaction.update({
            where: {
              id: transaction.id,
            },

            data: {
              status: "FAILED",

              resultDescription:
                message,
            },
          });

        results.push({
          transactionId:
            failed.id,

          phoneNumber:
            failed.phoneNumber,

          amount:
            failed.amount,

          status:
            "FAILED",

          conversationId:
            failed.conversationId,

          originatorConversationId:
            failed.originatorConversationId,

          resultDescription:
            failed.resultDescription,
        });
      }
    } catch (error: any) {
      const message =
        error?.message ??
        "Failed to create M-Pesa transaction.";

      if (transaction) {
        try {
          await prisma.mpesaTransaction.update({
            where: {
              id: transaction.id,
            },

            data: {
              status:
                "FAILED",

              resultDescription:
                message,
            },
          });
        } catch (updateError) {
          console.error(
            "[MPESA BULK] Failed transaction update:",
            updateError
          );
        }

        results.push({
          transactionId:
            transaction.id,

          phoneNumber:
            transaction.phoneNumber,

          amount:
            transaction.amount,

          status:
            "FAILED",

          conversationId:
            transaction.conversationId,

          originatorConversationId:
            transaction.originatorConversationId,

          resultDescription:
            message,
        });
      }
    }
  }

  /*
   * Recalculate the batch from the actual
   * transaction records.
   */
  const transactions =
    await prisma.mpesaTransaction.findMany({
      where: {
        batchId:
          params.batchId,

        organizationId:
          params.organizationId,
      },

      select: {
        status: true,
      },
    });

  const successful =
    transactions.filter(
      (transaction) =>
        transaction.status ===
        "COMPLETED"
    ).length;

  const failed =
    transactions.filter(
      (transaction) =>
        transaction.status ===
        "FAILED"
    ).length;

  const pending =
    transactions.filter(
      (transaction) =>
        transaction.status ===
        "PENDING"
    ).length;

  let batchStatus =
    "PROCESSING";

  if (
    pending === 0 &&
    failed === 0 &&
    successful > 0
  ) {
    batchStatus =
      "COMPLETED";
  } else if (
    pending === 0 &&
    successful === 0 &&
    failed > 0
  ) {
    batchStatus =
      "FAILED";
  } else if (
    successful > 0 &&
    failed > 0
  ) {
    batchStatus =
      "PARTIAL";
  }

  await prisma.mpesaPaymentBatch.update({
    where: {
      id: params.batchId,
    },

    data: {
      successful,
      failed,
      pending,
      status:
        batchStatus,
    },
  });

  return results;
}