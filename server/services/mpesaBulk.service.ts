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
  mpesaAccountId: string;
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
        const response =
          await initiateB2CPayment(
            params.organizationId,
            {
              mpesaAccountId:
                payment.mpesaAccountId,

              phoneNumber:
                payment.phoneNumber,

              amount:
                payment.amount,

              reference:
                payment.occasion ??
                `ZIYA-BATCH-${params.batchId}`,

              description:
                payment.remarks ??
                "ZIYA-FOS BULK PAYMENT",
            }
          );

        const responseCode =
          response?.ResponseCode;

        const conversationId =
          response?.ConversationID ??
          null;

        const originatorConversationId =
          response?.OriginatorConversationID ??
          null;

        const resultDescription =
          response?.ResponseDescription ??
          null;

        const accepted =
          responseCode === "0";

        const updated =
          await prisma.mpesaTransaction.update({
            where: {
              id: transaction.id,
            },

            data: {
              conversationId,

              originatorConversationId,

              resultDescription,

              status:
                accepted
                  ? "SUBMITTED"
                  : "FAILED",
            },
          });

        results.push({
          transactionId:
            updated.id,

          phoneNumber:
            payment.phoneNumber,

          amount:
            payment.amount,

          status:
            updated.status,

          conversationId,

          originatorConversationId,

          resultDescription,
        });
      } catch (paymentError) {
        console.error(
          "M-PESA BULK PAYMENT ERROR:",
          paymentError
        );

        const failed =
          await prisma.mpesaTransaction.update({
            where: {
              id: transaction.id,
            },

            data: {
              status:
                "FAILED",

              resultDescription:
                paymentError instanceof Error
                  ? paymentError.message
                  : "M-Pesa payment failed",
            },
          });

        results.push({
          transactionId:
            failed.id,

          phoneNumber:
            payment.phoneNumber,

          amount:
            payment.amount,

          status:
            failed.status,

          conversationId:
            failed.conversationId,

          originatorConversationId:
            failed.originatorConversationId,

          resultDescription:
            failed.resultDescription,
        });
      }
    } catch (error) {
      console.error(
        "M-PESA BULK TRANSACTION ERROR:",
        error
      );

      results.push({
        transactionId:
          transaction?.id ?? "",

        phoneNumber:
          payment.phoneNumber,

        amount:
          payment.amount,

        status:
          "FAILED",

        conversationId:
          null,

        originatorConversationId:
          null,

        resultDescription:
          error instanceof Error
            ? error.message
            : "Failed to process M-Pesa transaction",
      });
    }
  }

  return results;
}