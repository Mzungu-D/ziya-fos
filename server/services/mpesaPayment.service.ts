// server/services/mpesaPayment.service.ts

import prisma from "../config/prisma";
import {
  initiateB2CPayment,
} from "./mpesa.service";

/*
|--------------------------------------------------------------------------
| Payment Hub
|--------------------------------------------------------------------------
|
| This service provides one internal payment interface for:
|
|   - M-Pesa B2C -> phone number
|   - M-Pesa PayBill
|   - M-Pesa Till / Buy Goods
|   - M-Pesa B2B
|   - Bank account
|   - Other future payment providers
|
| IMPORTANT:
| This layer does NOT pretend that every destination uses
| the same Safaricom API.
|
| B2C remains connected to the existing tested implementation.
| B2B / PayBill / Till are represented as payment destinations
| and can be connected to their respective Daraja products.
|--------------------------------------------------------------------------
*/

export type PaymentMethod =
  | "MPESA"
  | "BANK"
  | "OTHER";

export type PaymentDestinationType =
  | "PHONE"
  | "PAYBILL"
  | "TILL"
  | "B2B"
  | "BANK_ACCOUNT"
  | "OTHER";

export interface PaymentDestination {
  paymentMethod: PaymentMethod;
  destinationType: PaymentDestinationType;

  destination?: string;
  destinationName?: string;

  phoneNumber?: string;
  paybillNumber?: string;
  tillNumber?: string;

  bankAccountNumber?: string;
  bankCode?: string;

  reference?: string;
  description?: string;
}

export interface PaymentRequest {
  organizationId: string;

  mpesaAccountId?: string;

  amount: number;

  destination: PaymentDestination;
}

export interface PaymentResult {
  success: boolean;

  transactionId?: string;

  status: string;

  paymentMethod: PaymentMethod;

  destinationType: PaymentDestinationType;

  destination?: string | null;

  destinationName?: string | null;

  conversationId?: string | null;

  originatorConversationId?: string | null;

  resultDescription?: string | null;
}

/*
|--------------------------------------------------------------------------
| Validation
|--------------------------------------------------------------------------
*/

function validateAmount(
  amount: number,
): number {
  const value = Number(amount);

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new Error(
      "Payment amount must be greater than zero.",
    );
  }

  return Math.round(value);
}

function requireOrganization(
  organizationId: string,
): void {
  if (
    !organizationId?.trim()
  ) {
    throw new Error(
      "Organization ID is required.",
    );
  }
}

/*
|--------------------------------------------------------------------------
| Normalize destination
|--------------------------------------------------------------------------
*/

function normalizeDestination(
  destination: PaymentDestination,
): PaymentDestination {
  return {
    ...destination,

    destination:
      destination.destination?.trim() ||
      undefined,

    destinationName:
      destination.destinationName?.trim() ||
      undefined,

    phoneNumber:
      destination.phoneNumber?.trim() ||
      undefined,

    paybillNumber:
      destination.paybillNumber?.trim() ||
      undefined,

    tillNumber:
      destination.tillNumber?.trim() ||
      undefined,

    bankAccountNumber:
      destination.bankAccountNumber?.trim() ||
      undefined,

    bankCode:
      destination.bankCode?.trim() ||
      undefined,

    reference:
      destination.reference?.trim() ||
      undefined,

    description:
      destination.description?.trim() ||
      undefined,
  };
}

/*
|--------------------------------------------------------------------------
| Destination validation
|--------------------------------------------------------------------------
*/

function validateDestination(
  destination: PaymentDestination,
): void {
  if (
    !destination.paymentMethod
  ) {
    throw new Error(
      "Payment method is required.",
    );
  }

  if (
    !destination.destinationType
  ) {
    throw new Error(
      "Payment destination type is required.",
    );
  }

  switch (
    destination.destinationType
  ) {
    case "PHONE":

      if (
        !destination.phoneNumber
      ) {
        throw new Error(
          "Phone number is required for a phone payment.",
        );
      }

      break;

    case "PAYBILL":

      if (
        !destination.paybillNumber
      ) {
        throw new Error(
          "PayBill number is required.",
        );
      }

      break;

    case "TILL":

      if (
        !destination.tillNumber
      ) {
        throw new Error(
          "Till number is required.",
        );
      }

      break;

    case "B2B":

      if (
        !destination.destination
      ) {
        throw new Error(
          "B2B destination shortcode is required.",
        );
      }

      break;

    case "BANK_ACCOUNT":

      if (
        !destination.bankAccountNumber
      ) {
        throw new Error(
          "Bank account number is required.",
        );
      }

      break;

    case "OTHER":

      if (
        !destination.destination
      ) {
        throw new Error(
          "Payment destination is required.",
        );
      }

      break;

    default:

      throw new Error(
        "Unsupported payment destination type.",
      );
  }
}

/*
|--------------------------------------------------------------------------
| Create transaction record
|--------------------------------------------------------------------------
*/

async function createTransaction(
  params: {
    organizationId: string;
    amount: number;
    mpesaAccountId?: string;
    destination: PaymentDestination;
  },
) {
  const destination =
    normalizeDestination(
      params.destination,
    );

  return prisma.mpesaTransaction.create({
    data: {
      organizationId:
        params.organizationId,

      mpesaAccountId:
        params.mpesaAccountId ??
        null,

      transactionType:
        destination.destinationType,

      phoneNumber:
        destination.phoneNumber ??
        null,

      amount:
        params.amount,

      counterparty:
        destination.destinationName ??
        null,

      transactionDesc:
        destination.description ??
        null,

      paymentMethod:
        destination.paymentMethod,

      destinationType:
        destination.destinationType,

      destination:
        destination.destination ??
        destination.phoneNumber ??
        destination.paybillNumber ??
        destination.tillNumber ??
        null,

      destinationName:
        destination.destinationName ??
        null,

      paybillNumber:
        destination.paybillNumber ??
        null,

      tillNumber:
        destination.tillNumber ??
        null,

      status:
        "PENDING",
    },
  });
}

/*
|--------------------------------------------------------------------------
| PHONE / B2C
|--------------------------------------------------------------------------
*/

async function processPhonePayment(
  params: PaymentRequest,
  transactionId: string,
): Promise<PaymentResult> {
  if (
    !params.mpesaAccountId
  ) {
    throw new Error(
      "M-Pesa account ID is required for phone payments.",
    );
  }

  const phoneNumber =
    params.destination.phoneNumber;

  if (
    !phoneNumber
  ) {
    throw new Error(
      "Phone number is required.",
    );
  }

  try {
    const response =
      await initiateB2CPayment(
        params.organizationId,
        {
          mpesaAccountId:
            params.mpesaAccountId,

          phoneNumber,

          amount:
            params.amount,

          reference:
            params.destination.reference ??
            `ZIYA-${transactionId}`,

          description:
            params.destination.description ??
            "ZIYA-FOS PAYMENT",
        },
      );

    const accepted =
      response?.ResponseCode ===
      "0";

    const status =
      accepted
        ? "SUBMITTED"
        : "FAILED";

    const updated =
      await prisma.mpesaTransaction.update(
        {
          where: {
            id:
              transactionId,
          },

          data: {
            conversationId:
              response?.ConversationID ??
              null,

            originatorConversationId:
              response?.OriginatorConversationID ??
              null,

            resultDescription:
              response?.ResponseDescription ??
              null,

            status,
          },
        },
      );

    return {
      success:
        accepted,

      transactionId:
        updated.id,

      status:

        updated.status,

      paymentMethod:
        "MPESA",

      destinationType:
        "PHONE",

      destination:
        phoneNumber,

      destinationName:
        params.destination.destinationName ??
        null,

      conversationId:
        updated.conversationId,

      originatorConversationId:
        updated.originatorConversationId,

      resultDescription:
        updated.resultDescription,
    };
  } catch (error) {
    await prisma.mpesaTransaction.update(
      {
        where: {
          id:
            transactionId,
        },

        data: {
          status:
            "FAILED",

          resultDescription:
            error instanceof Error
              ? error.message
              : "M-Pesa phone payment failed.",
        },
      },
    );

    throw error;
  }
}

/*
|--------------------------------------------------------------------------
| PAYBILL
|--------------------------------------------------------------------------
|
| We intentionally do not route this through B2C.
|
| PayBill payments require the appropriate Daraja product/API
| configuration. The destination is nevertheless recorded now,
| allowing the Payment Hub and UI to support it without corrupting
| the B2C flow.
|--------------------------------------------------------------------------
*/

async function processPaybillPayment(
  params: PaymentRequest,
  transactionId: string,
): Promise<PaymentResult> {
  const paybill =
    params.destination.paybillNumber!;

  await prisma.mpesaTransaction.update(
    {
      where: {
        id:
          transactionId,
      },

      data: {
        status:
          "READY",
        resultDescription:
          "PayBill destination recorded. Daraja PayBill payment adapter is required before live submission.",
      },
    },
  );

  return {
    success:
      false,

    transactionId,

    status:
      "READY",

    paymentMethod:
      "MPESA",

    destinationType:
      "PAYBILL",

    destination:
      paybill,

    destinationName:
      params.destination.destinationName ??
      null,

    resultDescription:
      "PayBill destination is configured but the live Daraja PayBill adapter has not been enabled.",
  };
}

/*
|--------------------------------------------------------------------------
| TILL / BUY GOODS
|--------------------------------------------------------------------------
*/

async function processTillPayment(
  params: PaymentRequest,
  transactionId: string,
): Promise<PaymentResult> {
  const till =
    params.destination.tillNumber!;

  await prisma.mpesaTransaction.update(
    {
      where: {
        id:
          transactionId,
      },

      data: {
        status:
          "READY",

        resultDescription:
          "Till destination recorded. Daraja Till / Buy Goods adapter is required before live submission.",
      },
    },
  );

  return {
    success:
      false,

    transactionId,

    status:
      "READY",

    paymentMethod:
      "MPESA",

    destinationType:
      "TILL",

    destination:
      till,

    destinationName:
      params.destination.destinationName ??
      null,

    resultDescription:
      "Till destination is configured but the live Daraja Till adapter has not been enabled.",
  };
}

/*
|--------------------------------------------------------------------------
| B2B
|--------------------------------------------------------------------------
*/

async function processB2BPayment(
  params: PaymentRequest,
  transactionId: string,
): Promise<PaymentResult> {
  const shortcode =
    params.destination.destination!;

  await prisma.mpesaTransaction.update(
    {
      where: {
        id:
          transactionId,
      },

      data: {
        status:
          "READY",

        resultDescription:
          "B2B destination recorded. Daraja B2B adapter requires the tenant's approved B2B configuration.",
      },
    },
  );

  return {
    success:
      false,

    transactionId,

    status:
      "READY",

    paymentMethod:
      "MPESA",

    destinationType:
      "B2B",

    destination:
      shortcode,

    destinationName:
      params.destination.destinationName ??
      null,

    resultDescription:
      "B2B destination is configured but the live Daraja B2B adapter has not been enabled.",
  };
}

/*
|--------------------------------------------------------------------------
| BANK
|--------------------------------------------------------------------------
*/

async function processBankPayment(
  params: PaymentRequest,
  transactionId: string,
): Promise<PaymentResult> {
  const accountNumber =
    params.destination.bankAccountNumber!;

  await prisma.mpesaTransaction.update(
    {
      where: {
        id:
          transactionId,
      },

      data: {
        status:
          "READY",

        resultDescription:
          "Bank destination recorded. Bank payment adapter should submit this through the configured bank integration.",
      },
    },
  );

  return {
    success:
      false,

    transactionId,

    status:
      "READY",

    paymentMethod:
      "BANK",

    destinationType:
      "BANK_ACCOUNT",

    destination:
      accountNumber,

    destinationName:
      params.destination.destinationName ??
      null,

    resultDescription:
      "Bank payment destination is configured for the Payment Hub.",
  };
}

/*
|--------------------------------------------------------------------------
| MAIN PAYMENT ROUTER
|--------------------------------------------------------------------------
*/

export async function processPayment(
  params: PaymentRequest,
): Promise<PaymentResult> {
  requireOrganization(
    params.organizationId,
  );

  const amount =
    validateAmount(
      params.amount,
    );

  const destination =
    normalizeDestination(
      params.destination,
    );

  validateDestination(
    destination,
  );

  const transaction =
    await createTransaction(
      {
        organizationId:
          params.organizationId,

        amount,

        mpesaAccountId:
          params.mpesaAccountId,

        destination,
      },
    );

  const paymentParams:
    PaymentRequest = {
      ...params,

      amount,

      destination,
    };

  switch (
    destination.destinationType
  ) {
    case "PHONE":

      return processPhonePayment(
        paymentParams,
        transaction.id,
      );

    case "PAYBILL":

      return processPaybillPayment(
        paymentParams,
        transaction.id,
      );

    case "TILL":

      return processTillPayment(
        paymentParams,
        transaction.id,
      );

    case "B2B":

      return processB2BPayment(
        paymentParams,
        transaction.id,
      );

    case "BANK_ACCOUNT":

      return processBankPayment(
        paymentParams,
        transaction.id,
      );

    case "OTHER":

      await prisma.mpesaTransaction.update(
        {
          where: {
            id:
              transaction.id,
          },

          data: {
            status:
              "READY",

            resultDescription:
              "Other payment destination recorded.",
          },
        },
      );

      return {
        success:
          false,

        transactionId:
          transaction.id,

        status:
          "READY",

        paymentMethod:
          destination.paymentMethod,

        destinationType:
          "OTHER",

        destination:
          destination.destination ??
          null,

        destinationName:
          destination.destinationName ??
          null,

        resultDescription:
          "Other payment destination has been recorded.",
      };

    default:

      throw new Error(
        "Unsupported payment destination.",
      );
  }
}

/*
|--------------------------------------------------------------------------
| Bulk payment
|--------------------------------------------------------------------------
*/

export async function processPaymentBatch(
  params: {
    organizationId: string;

    mpesaAccountId?: string;

    payments: Array<{
      amount: number;
      destination:
        PaymentDestination;
    }>;
  },
): Promise<
  PaymentResult[]
> {
  requireOrganization(
    params.organizationId,
  );

  const results:
    PaymentResult[] = [];

  for (
    const payment of
      params.payments
  ) {
    try {
      const result =
        await processPayment(
          {
            organizationId:
              params.organizationId,

            mpesaAccountId:
              params.mpesaAccountId,

            amount:
              payment.amount,

            destination:
              payment.destination,
          },
        );

      results.push(
        result,
      );
    } catch (
      error
    ) {
      results.push(
        {
          success:
            false,

          status:
            "FAILED",

          paymentMethod:
            payment.destination
              .paymentMethod,

          destinationType:
            payment.destination
              .destinationType,

          destination:
            payment.destination
              .destination ??
            payment.destination
              .phoneNumber ??
            payment.destination
              .paybillNumber ??
            payment.destination
              .tillNumber ??
            null,

          destinationName:
            payment.destination
              .destinationName ??
            null,

          resultDescription:
            error instanceof Error
              ? error.message
              : "Payment failed.",
        },
      );
    }
  }

  return results;
}