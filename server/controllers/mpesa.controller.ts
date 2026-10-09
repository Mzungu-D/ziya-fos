import { resolveEffectivePermissions } from "../services/authorization.service";
// server/controllers/mpesa.controller.ts

import {
  Request,
  Response as ExpressResponse,
} from "express";
import crypto from "crypto";

import prisma from "../config/prisma";
import {
  encryptSecret,
} from "../utils/encryption";
import {
  initiateB2CPayment,
  testMpesaAccountConnection,
  createSTKPushTransaction,
  handleSTKCallback as processSTKCallback,
  type STKTransactionType,
} from "../services/mpesa.service";
import {
  processPayment,
  processPaymentBatch,
  type PaymentDestination,
  type PaymentDestinationType,
} from "../services/mpesaPayment.service";

/* =========================================================
   TYPES
========================================================= */

interface AuthenticatedRequest extends Request {
  user?: {
    id?: string;
    userId?: string;
    organizationId?: string;
    role?: string;
    platformRole?: string;
    email?: string;
  };
}

type MpesaEnvironment =
  | "sandbox"
  | "production";

interface ConfigureMpesaBody {
  name: string;
  accountType?: string;
  shortcode: string;
  environment?: MpesaEnvironment;
  consumerKey: string;
  consumerSecret: string;
  initiatorName: string;
  securityCredential: string;
  stkPasskey?: string;
  resultUrl: string;
  timeoutUrl: string;
  isDefault?: boolean;
}

interface UpdateMpesaBody {
  name?: string;
  accountType?: string;
  shortcode?: string;
  environment?: MpesaEnvironment;
  consumerKey?: string;
  consumerSecret?: string;
  initiatorName?: string;
  securityCredential?: string;
  stkPasskey?: string;
  resultUrl?: string;
  timeoutUrl?: string;
  isDefault?: boolean;
}

interface SinglePaymentBody {
  mpesaAccountId: string;
  phoneNumber: string;
  amount: number;
  reference?: string;
  description?: string;
}

interface BulkRecipient {
  phoneNumber: string;
  amount: number;
  reference?: string;
  description?: string;
}

interface BulkPaymentBody {
  mpesaAccountId: string;
  description?: string;
  recipients: BulkRecipient[];
}

type PaymentMethod =
  | "MPESA";

interface PaymentHubBody {
  amount: number;
  mpesaAccountId: string;
  paymentMethod?: PaymentMethod;
  destinationType: PaymentDestinationType;
  destination?: string;
  destinationName?: string;
  phoneNumber?: string;
  paybillNumber?: string;
  tillNumber?: string;
  reference?: string;
  description?: string;
}

interface PaymentHubBulkItem {
  amount: number;
  destinationType: PaymentDestinationType;
  destination?: string;
  destinationName?: string;
  phoneNumber?: string;
  paybillNumber?: string;
  tillNumber?: string;
  reference?: string;
  description?: string;
}

interface PaymentHubBulkBody {
  mpesaAccountId: string;
  payments: PaymentHubBulkItem[];
}

interface STKPushBody {
  mpesaAccountId: string;
  phoneNumber: string;
  amount: number;
  transactionType?: STKTransactionType;
  accountReference?: string;
  transactionDesc?: string;
}

interface DarajaOAuthResponse {
  access_token?: string;
  expires_in?: number;
}

interface DarajaB2CResponse {
  ConversationID?: string;
  OriginatorConversationID?: string;
  ResponseCode?: string;
  ResponseDescription?: string;
}

interface DarajaResultParameter {
  Key?: string;
  Value?: string | number;
}

interface DarajaResultResponse {
  Result?: {
    ResultType?: number;
    ResultCode?: number;
    ResultDesc?: string;
    OriginatorConversationID?: string;
    ConversationID?: string;
    TransactionID?: string;
    ResultParameters?: {
      ResultParameter?: DarajaResultParameter[];
    };
    ReferenceData?: {
      ReferenceItem?: {
        Key?: string;
        Value?: string;
      };
    };
  };
}

/* =========================================================
   CONSTANTS
========================================================= */

const MAX_BULK_RECIPIENTS = 1000;
const MAX_SINGLE_AMOUNT = 150_000_000;
const MIN_SINGLE_AMOUNT = 1;

/*
 * Maximum number of simultaneous Daraja requests.
 *
 * This protects the application from opening hundreds
 * of outbound HTTP requests at the same time.
 */
const BULK_CONCURRENCY = 5;

/* =========================================================
   M-PESA ENVIRONMENT
========================================================= */

const isMpesaEnvironment = (
  value: unknown
): value is MpesaEnvironment => {
  return (
    value === "sandbox" ||
    value === "production"
  );
};

const validateEnvironment = (
  value: unknown
): MpesaEnvironment => {
  if (!isMpesaEnvironment(value)) {
    throw new Error(
      "M-Pesa environment must be either sandbox or production."
    );
  }

  return value;
};

/* =========================================================
   AUTHENTICATION
========================================================= */

const getAuthenticatedUserId = (
  req: AuthenticatedRequest
): string => {
  const userId =
    req.user?.id ||
    req.user?.userId;

  if (!userId) {
    throw new Error(
      "Authenticated user could not be identified."
    );
  }

  return userId;
};

/* =========================================================
   ROUTE PARAMETER HELPER
========================================================= */

const getRouteParam = (
  req: Request,
  name: string
): string => {
  const value =
    req.params[name];

  if (
    Array.isArray(value)
  ) {
    const first =
      value[0];

    if (!first) {
      throw new Error(
        `${name} route parameter is required.`
      );
    }

    return first;
  }

  if (
    typeof value !==
      "string" ||
    value.trim() === ""
  ) {
    throw new Error(
      `${name} route parameter is required.`
    );
  }

  return value.trim();
};

/* =========================================================
   TENANT RESOLUTION
========================================================= */

/*
 * We NEVER trust organizationId supplied by the frontend.
 *
 * The tenant is resolved from the authenticated user's
 * OrganizationMember record.
 */
const getOrganizationId = async (
  req: AuthenticatedRequest
): Promise<string> => {
  const userId =
    getAuthenticatedUserId(
      req
    );

  /*
   * If authentication middleware already provides an
   * organizationId, verify membership before using it.
   */
  if (
    req.user?.organizationId
  ) {
    const membership =
      await prisma.organizationMember.findFirst(
        {
          where: {
            userId,
            organizationId:
              req.user.organizationId,
            isActive: true,
          },
          select: {
            organizationId: true,
          },
        }
      );

    if (membership) {
      return membership.organizationId;
    }
  }

  /*
   * Otherwise use the user's default active organization.
   */
  const membership =
    await prisma.organizationMember.findFirst(
      {
        where: {
          userId,
          isActive: true,
        },
        orderBy: [
          {
            isDefault: "desc",
          },
          {
            joinedAt: "asc",
          },
        ],
        select: {
          organizationId: true,
        },
      }
    );

  if (!membership) {
    throw new Error(
      "User does not belong to an active organization."
    );
  }

  return membership.organizationId;
};

/* =========================================================
   ORGANIZATION ACCESS / PERMISSIONS
========================================================= */

const requireOrganizationAccess =
  async (
    req: AuthenticatedRequest,
    permissions: string[] = []
  ) => {
    const userId =
      getAuthenticatedUserId(
        req
      );

    const organizationId =
      await getOrganizationId(
        req
      );

    const membership =
      await prisma.organizationMember.findFirst(
        {
          where: {
            userId,
            organizationId,
            isActive: true,
          },
        }
      );

    if (!membership) {
      throw new Error(
        "You do not have access to this organization."
      );
    }

    /*
     * Organization owners/admins can manage M-Pesa.
     */
    const role =
      String(
        membership.role || ""
      )
        .trim()
        .toUpperCase();

    const isAdmin =
      role === "OWNER" ||
      role === "ADMIN" ||
      role ===
        "SUPER_ADMIN";

    if (
      permissions.length > 0 &&
      !isAdmin
    ) {
      const userPermissions =
        resolveEffectivePermissions({ role: membership.role, permissions: membership.permissions });

      const allowed =
        permissions.some(
          (permission) =>
            userPermissions.includes(
              permission
            )
        );

      if (!allowed) {
        throw new Error(
          "You do not have permission to perform this M-Pesa operation."
        );
      }
    }

    return {
      userId,
      organizationId,
      membership,
    };
  };

/* =========================================================
   VALIDATION
========================================================= */

const normalizePhoneNumber = (
  value: string
): string => {
  let phone =
    String(value)
      .trim()
      .replace(
        /\s+/g,
        ""
      )
      .replace(
        /-/g,
        ""
      );

  if (
    phone.startsWith(
      "+254"
    )
  ) {
    phone =
      phone.substring(
        1
      );
  }

  if (
    phone.startsWith(
      "07"
    ) ||
    phone.startsWith(
      "01"
    )
  ) {
    phone =
      `254${phone.substring(
        1
      )}`;
  }

  if (
    !/^254[17]\d{8}$/.test(
      phone
    )
  ) {
    throw new Error(
      `Invalid Kenyan phone number: ${value}`
    );
  }

  return phone;
};

const validateAmount = (
  value: unknown
): number => {
  const amount =
    Number(value);

  if (
    !Number.isFinite(
      amount
    )
  ) {
    throw new Error(
      "Payment amount must be a valid number."
    );
  }

  if (
    amount <
    MIN_SINGLE_AMOUNT
  ) {
    throw new Error(
      `Payment amount must be at least ${MIN_SINGLE_AMOUNT}.`
    );
  }

  if (
    amount >
    MAX_SINGLE_AMOUNT
  ) {
    throw new Error(
      `Payment amount cannot exceed ${MAX_SINGLE_AMOUNT}.`
    );
  }

  return (
    Math.round(
      amount * 100
    ) / 100
  );
};

/* =========================================================
   REFERENCES
========================================================= */

const generateBatchReference =
  (): string => {
    return `BATCH-${Date.now()}-${crypto
      .randomBytes(4)
      .toString("hex")
      .toUpperCase()}`;
  };

const generatePaymentReference =
  (
    index: number
  ): string => {
    return `PAY-${Date.now()}-${index + 1}-${crypto
      .randomBytes(3)
      .toString("hex")
      .toUpperCase()}`;
  };

/* =========================================================
   SAFE SERIALIZATION
========================================================= */

const serializeMpesaAccount = (
  account: any
) => {
  return {
    id: account.id,
    organizationId:
      account.organizationId,
    name: account.name,
    accountType:
      account.accountType,
    shortcode:
      account.shortcode,
    environment:
      account.environment,
    initiatorName:
      account.initiatorName,
    resultUrl:
      account.resultUrl,
    timeoutUrl:
      account.timeoutUrl,
    isActive:
      account.isActive,
    isDefault:
      account.isDefault,
    createdAt:
      account.createdAt,
    updatedAt:
      account.updatedAt,
  };
};

const serializeTransaction = (
  transaction: any
) => {
  return {
    ...transaction,
    amount:
      Number(
        transaction.amount
      ),
  };
};

const serializeBatch = (
  batch: any
) => {
  return {
    ...batch,
    totalAmount:
      Number(
        batch.totalAmount
      ),
  };
};

/* =========================================================
   AUDIT LOG
========================================================= */

const createAuditLog = async (
  organizationId: string,
  userId: string,
  action: string,
  details: Record<
    string,
    unknown
  >
): Promise<void> => {
  try {
    await prisma.auditTrail.create(
      {
        data: {
          organizationId,
          user: userId,
          action,
          module: "MPESA",
          details:
            JSON.stringify(
              details
            ),
        },
      }
    );
  } catch (error) {
    /*
     * Do not allow audit logging failure to break
     * payment processing or callbacks.
     */
    console.error(
      "M-Pesa audit log error:",
      error
    );
  }
};

/* =========================================================
   DARAJA URL
========================================================= */

const getDarajaBaseUrl = (
  environment: MpesaEnvironment
): string => {
  return environment ===
    "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
};

/* =========================================================
   HTTP / DARAJA REQUEST
========================================================= */

const requestJson = async <
  T
>(
  url: string,
  options: RequestInit,
  timeoutMs = 30_000
): Promise<{
  ok: boolean;
  status: number;
  data: T | null;
  raw: string;
}> => {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => {
        controller.abort();
      },
      timeoutMs
    );

  try {
    const response =
      await fetch(
        url,
        {
          ...options,
          signal:
            controller.signal,
        }
      );

    const raw =
      await response.text();

    let data:
      | T
      | null = null;

    if (raw) {
      try {
        data =
          JSON.parse(
            raw
          ) as T;
      } catch {
        data = null;
      }
    }

    return {
      ok: response.ok,
      status:
        response.status,
      data,
      raw,
    };
  } finally {
    clearTimeout(
      timeout
    );
  }
};

/* =========================================================
   TEST M-PESA CREDENTIALS
========================================================= */

const testMpesaCredentials =
  async ({
    consumerKey,
    consumerSecret,
    environment,
  }: {
    consumerKey: string;
    consumerSecret: string;
    environment: MpesaEnvironment;
  }): Promise<boolean> => {
    const credentials =
      Buffer.from(
        `${consumerKey}:${consumerSecret}`
      ).toString(
        "base64"
      );

    const baseUrl =
      getDarajaBaseUrl(
        environment
      );

    const response =
      await requestJson<DarajaOAuthResponse>(
        `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
        {
          method: "GET",
          headers: {
            Authorization:
              `Basic ${credentials}`,
            Accept:
              "application/json",
          },
        },
        20_000
      );

    return Boolean(
      response.ok &&
        response.data?.access_token
    );
  };

/* =========================================================
   SEND B2C PAYMENT
========================================================= */

/*
 * The actual Daraja integration lives in mpesa.service.ts.
 * Keeping the controller thin prevents duplicated credential,
 * token and encryption logic.
 */
const sendB2CPayment = async (
  account: any,
  payment: {
    phoneNumber: string;
    amount: number;
    reference: string;
    description: string;
  }
): Promise<DarajaB2CResponse> => {
  const response =
    await initiateB2CPayment(
      account.organizationId,
      {
        mpesaAccountId:
          account.id,
        phoneNumber:
          payment.phoneNumber,
        amount:
          payment.amount,
        reference:
          payment.reference,
        description:
          payment.description,
      }
    );

  return {
    ConversationID:
      typeof response.ConversationID ===
      "string"
        ? response.ConversationID
        : undefined,

    OriginatorConversationID:
      typeof response.OriginatorConversationID ===
      "string"
        ? response.OriginatorConversationID
        : undefined,

    ResponseCode:
      typeof response.ResponseCode ===
      "string"
        ? response.ResponseCode
        : undefined,

    ResponseDescription:
      typeof response.ResponseDescription ===
      "string"
        ? response.ResponseDescription
        : undefined,
  };
};

/* =========================================================
   CONFIGURE M-PESA
========================================================= */

/**
 * POST /api/mpesa/accounts
 */
export const configureMpesaAccount =
  async (
    req: AuthenticatedRequest,
    res: ExpressResponse
  ): Promise<void> => {
    try {
      const {
        organizationId,
        userId,
      } =
        await requireOrganizationAccess(
          req,
          ["mpesa:configure"]
        );

      const body =
        req.body as ConfigureMpesaBody;

      if (
        !body.name ||
        !body.shortcode ||
        !body.consumerKey ||
        !body.consumerSecret ||
        !body.initiatorName ||
        !body.securityCredential ||
        !body.resultUrl ||
        !body.timeoutUrl
      ) {
        res.status(400).json({
          success: false,
          message:
            "All required M-Pesa configuration fields must be provided.",
        });

        return;
      }

      const environment =
        validateEnvironment(
          body.environment ||
            "sandbox"
        );

      const name =
        body.name.trim();

      const shortcode =
        body.shortcode.trim();

      /*
       * Verify credentials BEFORE storing them.
       */
      const valid =
        await testMpesaCredentials(
          {
            consumerKey:
              body.consumerKey.trim(),

            consumerSecret:
              body.consumerSecret.trim(),

            environment,
          }
        );

      if (!valid) {
        res.status(400).json({
          success: false,
          message:
            "The M-Pesa API credentials could not be verified.",
        });

        return;
      }

      /*
       * Check for duplicate account within THIS tenant.
       */
      const existing =
        await prisma.mpesaAccount.findFirst(
          {
            where: {
              organizationId,
              OR: [
                {
                  name,
                },
                {
                  shortcode,
                },
              ],
            },
          }
        );

      if (existing) {
        res.status(409).json({
          success: false,
          message:
            "An M-Pesa account with this name or shortcode already exists for this organization.",
        });

        return;
      }

      /*
       * Only one default account per organization.
       */
      if (
        body.isDefault
      ) {
        await prisma.mpesaAccount.updateMany(
          {
            where: {
              organizationId,
            },
            data: {
              isDefault:
                false,
            },
          }
        );
      }

      const account =
        await prisma.mpesaAccount.create(
          {
            data: {
              organizationId,

              name,

              accountType:
                body.accountType?.trim() ||
                "B2C",

              shortcode,

              environment,

              consumerKeyEncrypted:
                encryptSecret(
                  body.consumerKey.trim()
                ),

              consumerSecretEncrypted:
                encryptSecret(
                  body.consumerSecret.trim()
                ),

              initiatorName:
                body.initiatorName.trim(),

              securityCredentialEncrypted:
                encryptSecret(
                  body.securityCredential.trim()
                ),

              stkPasskeyEncrypted:
                body.stkPasskey?.trim()
                  ? encryptSecret(
                      body.stkPasskey.trim()
                    )
                  : null,

              resultUrl:
                body.resultUrl.trim(),

              timeoutUrl:
                body.timeoutUrl.trim(),

              isActive:
                true,

              isDefault:
                Boolean(
                  body.isDefault
                ),
            },
          }
        );

      await createAuditLog(
        organizationId,
        userId,
        "MPESA_ACCOUNT_CONNECTED",
        {
          accountId:
            account.id,
          accountName:
            account.name,
          shortcode:
            account.shortcode,
          environment:
            account.environment,
        }
      );

      res.status(201).json({
        success: true,
        message:
          "M-Pesa account connected successfully.",
        account:
          serializeMpesaAccount(
            account
          ),
      });
    } catch (error) {
      console.error(
        "Configure M-Pesa account error:",
        error
      );

      res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to configure M-Pesa account.",
      });
    }
  };

/* =========================================================
   UPDATE M-PESA ACCOUNT
========================================================= */

/**
 * PATCH /api/mpesa/accounts/:accountId
 */
export const updateMpesaAccount =
  async (
    req: AuthenticatedRequest,
    res: ExpressResponse
  ): Promise<void> => {
    try {
      const {
        organizationId,
        userId,
      } =
        await requireOrganizationAccess(
          req,
          ["mpesa:configure"]
        );

      const accountId =
        getRouteParam(
          req,
          "accountId"
        );

      const body =
        req.body as UpdateMpesaBody;

      const existing =
        await prisma.mpesaAccount.findFirst(
          {
            where: {
              id: accountId,
              organizationId,
            },
          }
        );

      if (!existing) {
        res.status(404).json({
          success: false,
          message:
            "M-Pesa account not found.",
        });

        return;
      }

      /*
       * Prisma stores environment as String.
       * Convert/validate it before passing to Daraja helpers.
       */
      const environment =
        body.environment !==
        undefined
          ? validateEnvironment(
              body.environment
            )
          : validateEnvironment(
              existing.environment
            );

      const newName =
        body.name?.trim() ||
        existing.name;

      const newShortcode =
        body.shortcode?.trim() ||
        existing.shortcode;

      /*
       * Check tenant-level uniqueness.
       */
      const duplicate =
        await prisma.mpesaAccount.findFirst(
          {
            where: {
              organizationId,
              id: {
                not: accountId,
              },
              OR: [
                {
                  name:
                    newName,
                },
                {
                  shortcode:
                    newShortcode,
                },
              ],
            },
          }
        );

      if (duplicate) {
        res.status(409).json({
          success: false,
          message:
            "Another M-Pesa account already uses this name or shortcode.",
        });

        return;
      }

      /*
       * If new API credentials are supplied, verify them
       * before replacing the existing credentials.
       */
      if (
        body.consumerKey !==
          undefined ||
        body.consumerSecret !==
          undefined
      ) {
        if (
          !body.consumerKey ||
          !body.consumerSecret
        ) {
          res.status(400).json({
            success: false,
            message:
              "Consumer Key and Consumer Secret must be supplied together.",
          });

          return;
        }

        const credentialsValid =
          await testMpesaCredentials(
            {
              consumerKey:
                body.consumerKey.trim(),

              consumerSecret:
                body.consumerSecret.trim(),

              environment,
            }
          );

        if (!credentialsValid) {
          res.status(400).json({
            success: false,
            message:
              "The supplied M-Pesa credentials could not be verified.",
          });

          return;
        }
      }

      /*
       * If this account becomes default, remove default
       * from every other account belonging to this tenant.
       */
      if (
        body.isDefault ===
        true
      ) {
        await prisma.mpesaAccount.updateMany(
          {
            where: {
              organizationId,
              id: {
                not: accountId,
              },
            },
            data: {
              isDefault:
                false,
            },
          }
        );
      }

      const account =
        await prisma.mpesaAccount.update(
          {
            where: {
              id: accountId,
            },
            data: {
              name:
                newName,

              accountType:
                body.accountType?.trim() ||
                existing.accountType,

              shortcode:
                newShortcode,

              environment,

              ...(body.consumerKey
                ? {
                    consumerKeyEncrypted:
                      encryptSecret(
                        body.consumerKey.trim()
                      ),
                  }
                : {}),

              ...(body.consumerSecret
                ? {
                    consumerSecretEncrypted:
                      encryptSecret(
                        body.consumerSecret.trim()
                      ),
                  }
                : {}),

              ...(body.initiatorName
                ? {
                    initiatorName:
                      body.initiatorName.trim(),
                  }
                : {}),

              ...(body.securityCredential
                ? {
                    securityCredentialEncrypted:
                      encryptSecret(
                        body.securityCredential.trim()
                      ),
                  }
                : {}),

              ...(body.stkPasskey !== undefined
                ? {
                    stkPasskeyEncrypted:
                      body.stkPasskey.trim()
                        ? encryptSecret(
                            body.stkPasskey.trim()
                          )
                        : null,
                  }
                : {}),

              ...(body.resultUrl
                ? {
                    resultUrl:
                      body.resultUrl.trim(),
                  }
                : {}),

              ...(body.timeoutUrl
                ? {
                    timeoutUrl:
                      body.timeoutUrl.trim(),
                  }
                : {}),

              ...(typeof body.isDefault ===
              "boolean"
                ? {
                    isDefault:
                      body.isDefault,
                  }
                : {}),
            },
          }
        );

      await createAuditLog(
        organizationId,
        userId,
        "MPESA_ACCOUNT_UPDATED",
        {
          accountId:
            account.id,
          accountName:
            account.name,
          environment:
            account.environment,
        }
      );

      res.status(200).json({
        success: true,
        message:
          "M-Pesa account updated successfully.",
        account:
          serializeMpesaAccount(
            account
          ),
      });
    } catch (error) {
      console.error(
        "Update M-Pesa account error:",
        error
      );

      res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to update M-Pesa account.",
      });
    }
  };

/* =========================================================
   GET M-PESA ACCOUNTS
========================================================= */

/**
 * GET /api/mpesa/accounts
 */
export const getMpesaAccounts =
  async (
    req: AuthenticatedRequest,
    res: ExpressResponse
  ): Promise<void> => {
    try {
      const {
        organizationId,
      } =
        await requireOrganizationAccess(
          req
        );

      const accounts =
        await prisma.mpesaAccount.findMany(
          {
            where: {
              organizationId,
            },
            orderBy: [
              {
                isDefault:
                  "desc",
              },
              {
                createdAt:
                  "desc",
              },
            ],
          }
        );

      res.status(200).json({
        success: true,
        accounts:
          accounts.map(
            serializeMpesaAccount
          ),
      });
    } catch (error) {
      console.error(
        "Get M-Pesa accounts error:",
        error
      );

      res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch M-Pesa accounts.",
      });
    }
  };

/* =========================================================
   GET SINGLE M-PESA ACCOUNT
========================================================= */

/**
 * GET /api/mpesa/accounts/:accountId
 */
export const getMpesaAccount =
  async (
    req: AuthenticatedRequest,
    res: ExpressResponse
  ): Promise<void> => {
    try {
      const {
        organizationId,
      } =
        await requireOrganizationAccess(
          req
        );

      const accountId =
        getRouteParam(
          req,
          "accountId"
        );

      const account =
        await prisma.mpesaAccount.findFirst(
          {
            where: {
              id: accountId,
              organizationId,
            },
          }
        );

      if (!account) {
        res.status(404).json({
          success: false,
          message:
            "M-Pesa account not found.",
        });

        return;
      }

      res.status(200).json({
        success: true,
        account:
          serializeMpesaAccount(
            account
          ),
      });
    } catch (error) {
      console.error(
        "Get M-Pesa account error:",
        error
      );

      res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch M-Pesa account.",
      });
    }
  };

/* =========================================================
   TEST M-PESA CONNECTION
========================================================= */

/**
 * POST /api/mpesa/accounts/:accountId/test
 */
export const testExistingMpesaAccount =
  async (
    req: AuthenticatedRequest,
    res: ExpressResponse
  ): Promise<void> => {
    try {
      const {
        organizationId,
      } =
        await requireOrganizationAccess(
          req,
          ["mpesa:configure"]
        );

      const accountId =
        getRouteParam(
          req,
          "accountId"
        );

      const account =
        await prisma.mpesaAccount.findFirst(
          {
            where: {
              id: accountId,
              organizationId,
            },
          }
        );

      if (!account) {
        res.status(404).json({
          success: false,
          message:
            "M-Pesa account not found.",
        });

        return;
      }

      await testMpesaAccountConnection(
        organizationId,
        accountId
      );

      res.status(200).json({
        success: true,
        connected: true,
        message:
          "M-Pesa connection is working correctly.",
      });
    } catch (error) {
      console.error(
        "Test M-Pesa connection error:",
        error
      );

      res.status(400).json({
        success: false,
        connected: false,
        message:
          "M-Pesa connection test failed. Check the tenant's API credentials.",
      });
    }
  };

/* =========================================================
   ACTIVATE / DEACTIVATE M-PESA ACCOUNT
========================================================= */

/**
 * PATCH /api/mpesa/accounts/:accountId/status
 */
export const updateMpesaAccountStatus =
  async (
    req: AuthenticatedRequest,
    res: ExpressResponse
  ): Promise<void> => {
    try {
      const {
        organizationId,
        userId,
      } =
        await requireOrganizationAccess(
          req,
          ["mpesa:configure"]
        );

      const accountId =
        getRouteParam(
          req,
          "accountId"
        );

      const {
        isActive,
      } = req.body;

      if (
        typeof isActive !==
        "boolean"
      ) {
        res.status(400).json({
          success: false,
          message:
            "isActive must be a boolean.",
        });

        return;
      }

      const account =
        await prisma.mpesaAccount.findFirst(
          {
            where: {
              id: accountId,
              organizationId,
            },
          }
        );

      if (!account) {
        res.status(404).json({
          success: false,
          message:
            "M-Pesa account not found.",
        });

        return;
      }

      const updated =
        await prisma.mpesaAccount.update(
          {
            where: {
              id: account.id,
            },
            data: {
              isActive,
            },
          }
        );

      await createAuditLog(
        organizationId,
        userId,
        isActive
          ? "MPESA_ACCOUNT_ACTIVATED"
          : "MPESA_ACCOUNT_DEACTIVATED",
        {
          accountId:
            account.id,
          accountName:
            account.name,
        }
      );

      res.status(200).json({
        success: true,
        message:
          isActive
            ? "M-Pesa account activated."
            : "M-Pesa account deactivated.",
        account:
          serializeMpesaAccount(
            updated
          ),
      });
    } catch (error) {
      console.error(
        "Update M-Pesa account status error:",
        error
      );

      res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to update M-Pesa account status.",
      });
    }
  };

/* =========================================================
   SET DEFAULT M-PESA ACCOUNT
========================================================= */

/**
 * PATCH /api/mpesa/accounts/:accountId/default
 */
export const setDefaultMpesaAccount =
  async (
    req: AuthenticatedRequest,
    res: ExpressResponse
  ): Promise<void> => {
    try {
      const {
        organizationId,
        userId,
      } =
        await requireOrganizationAccess(
          req,
          ["mpesa:configure"]
        );

      const accountId =
        getRouteParam(
          req,
          "accountId"
        );

      const account =
        await prisma.mpesaAccount.findFirst(
          {
            where: {
              id: accountId,
              organizationId,
            },
          }
        );

      if (!account) {
        res.status(404).json({
          success: false,
          message:
            "M-Pesa account not found.",
        });

        return;
      }

      if (
        !account.isActive
      ) {
        res.status(400).json({
          success: false,
          message:
            "An inactive M-Pesa account cannot be made default.",
        });

        return;
      }

      await prisma.$transaction(
        [
          prisma.mpesaAccount.updateMany(
            {
              where: {
                organizationId,
              },
              data: {
                isDefault:
                  false,
              },
            }
          ),

          prisma.mpesaAccount.update(
            {
              where: {
                id: account.id,
              },
              data: {
                isDefault:
                  true,
              },
            }
          ),
        ]
      );

      await createAuditLog(
        organizationId,
        userId,
        "MPESA_DEFAULT_ACCOUNT_CHANGED",
        {
          accountId:
            account.id,
          accountName:
            account.name,
        }
      );

      res.status(200).json({
        success: true,
        message:
          "M-Pesa account is now the default account.",
      });
    } catch (error) {
      console.error(
        "Set default M-Pesa account error:",
        error
      );

      res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to set default M-Pesa account.",
      });
    }
  };

/* =========================================================
   SINGLE B2C PAYMENT
========================================================= */

/**
 * POST /api/mpesa/payments
 */
export const createSinglePayment =
  async (
    req: AuthenticatedRequest,
    res: ExpressResponse
  ): Promise<void> => {
    try {
      const {
        organizationId,
        userId,
      } =
        await requireOrganizationAccess(
          req,
          ["mpesa:payments"]
        );

      const body =
        req.body as SinglePaymentBody;

      if (
        !body.mpesaAccountId ||
        !body.phoneNumber ||
        body.amount ===
          undefined
      ) {
        res.status(400).json({
          success: false,
          message:
            "M-Pesa account, phone number and amount are required.",
        });

        return;
      }

      const amount =
        validateAmount(
          body.amount
        );

      const phoneNumber =
        normalizePhoneNumber(
          body.phoneNumber
        );

      /*
       * IMPORTANT:
       * Account is always scoped to the authenticated tenant.
       */
      const account =
        await prisma.mpesaAccount.findFirst(
          {
            where: {
              id:
                body.mpesaAccountId,
              organizationId,
              isActive: true,
            },
          }
        );

      if (!account) {
        res.status(404).json({
          success: false,
          message:
            "Active M-Pesa account not found.",
        });

        return;
      }

      const batchReference =
        generateBatchReference();

      const paymentReference =
        body.reference?.trim() ||
        generatePaymentReference(
          0
        );

      /*
       * Create internal records BEFORE calling Daraja.
       */
      const batch =
        await prisma.mpesaPaymentBatch.create(
          {
            data: {
              organizationId,

              batchReference,

              description:
                body.description ||
                "Single M-Pesa payment",

              totalAmount:
                amount,

              totalPayments:
                1,

              successful:
                0,

              failed:
                0,

              pending:
                1,

              status:
                "PROCESSING",
            },
          }
        );

      const transaction =
        await prisma.mpesaTransaction.create(
          {
            data: {
              organizationId,

              mpesaAccountId:
                account.id,

              batchId:
                batch.id,

              transactionType:
                "B2C",

              phoneNumber,

              amount,

              accountReference:
                paymentReference,

              transactionDesc:
                body.description ||
                "M-Pesa B2C payment",

              status:
                "PROCESSING",
            },
          }
        );

      try {
        const darajaResponse =
          await sendB2CPayment(
            account,
            {
              phoneNumber,

              amount,

              reference:
                paymentReference,

              description:
                body.description ||
                "Ziya FOS payment",
            }
          );

        const updated =
          await prisma.mpesaTransaction.update(
            {
              where: {
                id:
                  transaction.id,
              },
              data: {
                conversationId:
                  darajaResponse.ConversationID,

                originatorConversationId:
                  darajaResponse.OriginatorConversationID,

                resultCode:
                  darajaResponse.ResponseCode
                    ? Number(
                        darajaResponse.ResponseCode
                      )
                    : undefined,

                resultDescription:
                  darajaResponse.ResponseDescription,

                /*
                 * Daraja accepted the request.
                 * Final status comes through callback.
                 */
                status:
                  "PENDING",
              },
            }
          );

        await createAuditLog(
          organizationId,
          userId,
          "MPESA_PAYMENT_INITIATED",
          {
            transactionId:
              transaction.id,
            batchId:
              batch.id,
            amount,
            phoneNumber,
          }
        );

        res.status(202).json({
          success: true,
          message:
            "M-Pesa payment initiated successfully.",
          batch:
            serializeBatch(
              batch
            ),
          transaction:
            serializeTransaction(
              updated
            ),
        });
      } catch (paymentError) {
        await prisma.$transaction(
          [
            prisma.mpesaTransaction.update(
              {
                where: {
                  id:
                    transaction.id,
                },
                data: {
                  status:
                    "FAILED",

                  resultDescription:
                    paymentError instanceof
                    Error
                      ? paymentError.message
                      : "Payment initiation failed.",
                },
              }
            ),

            prisma.mpesaPaymentBatch.update(
              {
                where: {
                  id:
                    batch.id,
                },
                data: {
                  pending:
                    0,

                  failed:
                    1,

                  status:
                    "FAILED",
                },
              }
            ),
          ]
        );

        throw paymentError;
      }
    } catch (error) {
      console.error(
        "Create single M-Pesa payment error:",
        error
      );

      res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to initiate M-Pesa payment.",
      });
    }
  };

/* =========================================================
   BULK B2C PAYMENT
========================================================= */

/**
 * POST /api/mpesa/payments/bulk
 *
 * Example:
 *
 * {
 *   "mpesaAccountId": "ACCOUNT_ID",
 *   "description": "August field payments",
 *   "recipients": [
 *     {
 *       "phoneNumber": "0712345678",
 *       "amount": 5000
 *     },
 *     {
 *       "phoneNumber": "0723456789",
 *       "amount": 12500
 *     },
 *     {
 *       "phoneNumber": "0734567890",
 *       "amount": 2750
 *     }
 *   ]
 * }
 *
 * Every recipient may have a different amount.
 */
export const createBulkPayment =
  async (
    req: AuthenticatedRequest,
    res: ExpressResponse
  ): Promise<void> => {
    try {
      const {
        organizationId,
        userId,
      } =
        await requireOrganizationAccess(
          req,
          ["mpesa:payments"]
        );

      const body =
        req.body as BulkPaymentBody;

      if (
        !body.mpesaAccountId ||
        !Array.isArray(
          body.recipients
        )
      ) {
        res.status(400).json({
          success: false,
          message:
            "M-Pesa account and recipients are required.",
        });

        return;
      }

      if (
        body.recipients.length ===
        0
      ) {
        res.status(400).json({
          success: false,
          message:
            "At least one recipient is required.",
        });

        return;
      }

      if (
        body.recipients.length >
        MAX_BULK_RECIPIENTS
      ) {
        res.status(400).json({
          success: false,
          message:
            `A maximum of ${MAX_BULK_RECIPIENTS} recipients is allowed per batch.`,
        });

        return;
      }

      const account =
        await prisma.mpesaAccount.findFirst(
          {
            where: {
              id:
                body.mpesaAccountId,
              organizationId,
              isActive: true,
            },
          }
        );

      if (!account) {
        res.status(404).json({
          success: false,
          message:
            "Active M-Pesa account not found.",
        });

        return;
      }

      /*
       * Validate every recipient BEFORE creating
       * the batch.
       */
      const recipients =
        body.recipients.map(
          (
            recipient,
            index
          ) => {
            if (
              !recipient.phoneNumber
            ) {
              throw new Error(
                `Recipient ${index + 1}: phone number is required.`
              );
            }

            const phoneNumber =
              normalizePhoneNumber(
                recipient.phoneNumber
              );

            const amount =
              validateAmount(
                recipient.amount
              );

            const reference =
              recipient.reference?.trim() ||
              generatePaymentReference(
                index
              );

            return {
              phoneNumber,
              amount,
              reference,
              description:
                recipient.description?.trim() ||
                body.description?.trim() ||
                "Ziya FOS B2C payment",
            };
          }
        );

      /*
       * Payment references must be unique inside
       * the batch.
       */
      const references =
        new Set<string>();

      for (
        const recipient of recipients
      ) {
        if (
          references.has(
            recipient.reference
          )
        ) {
          throw new Error(
            `Duplicate payment reference: ${recipient.reference}`
          );
        }

        references.add(
          recipient.reference
        );
      }

      const totalAmount =
        recipients.reduce(
          (
            total,
            recipient
          ) =>
            total +
            recipient.amount,
          0
        );

      const batchReference =
        generateBatchReference();

      /*
       * Create batch and all individual transactions
       * atomically.
       */
      const batch =
        await prisma.$transaction(
          async (tx) => {
            const createdBatch =
              await tx.mpesaPaymentBatch.create(
                {
                  data: {
                    organizationId,

                    batchReference,

                    description:
                      body.description?.trim() ||
                      "Bulk M-Pesa payment",

                    totalAmount,

                    totalPayments:
                      recipients.length,

                    successful:
                      0,

                    failed:
                      0,

                    pending:
                      recipients.length,

                    status:
                      "PROCESSING",
                  },
                }
              );

            await tx.mpesaTransaction.createMany(
              {
                data:
                  recipients.map(
                    (
                      recipient
                    ) => ({
                      organizationId,

                      mpesaAccountId:
                        account.id,

                      batchId:
                        createdBatch.id,

                      transactionType:
                        "B2C",

                      phoneNumber:
                        recipient.phoneNumber,

                      amount:
                        recipient.amount,

                      accountReference:
                        recipient.reference,

                      transactionDesc:
                        recipient.description,

                      status:
                        "PENDING",
                    })
                  ),
              }
            );

            return createdBatch;
          }
        );

      /*
       * Fetch transactions in creation order.
       */
      const transactions =
        await prisma.mpesaTransaction.findMany(
          {
            where: {
              organizationId,
              batchId:
                batch.id,
            },
            orderBy: {
              createdAt:
                "asc",
            },
          }
        );

      /*
       * Controlled concurrency.
       *
       * Example:
       * 500 recipients
       * 5 requests at a time
       *
       * This is safer than firing all 500 at once.
       */
      let cursor = 0;

      const processNext =
        async (): Promise<void> => {
          while (
            true
          ) {
            const index =
              cursor++;

            if (
              index >=
              transactions.length
            ) {
              return;
            }

            const transaction =
              transactions[
                index
              ];

            const recipient =
              recipients[
                index
              ];

            try {
              const response =
                await sendB2CPayment(
                  account,
                  {
                    phoneNumber:
                      recipient.phoneNumber,

                    amount:
                      recipient.amount,

                    reference:
                      recipient.reference,

                    description:
                      recipient.description,
                  }
                );

              await prisma.mpesaTransaction.update(
                {
                  where: {
                    id:
                      transaction.id,
                  },
                  data: {
                    conversationId:
                      response.ConversationID,

                    originatorConversationId:
                      response.OriginatorConversationID,

                    resultCode:
                      response.ResponseCode
                        ? Number(
                            response.ResponseCode
                          )
                        : undefined,

                    resultDescription:
                      response.ResponseDescription,

                    /*
                     * Accepted by Daraja.
                     * Final result comes via callback.
                     */
                    status:
                      "PENDING",
                  },
                }
              );
            } catch (error) {
              await prisma.mpesaTransaction.update(
                {
                  where: {
                    id:
                      transaction.id,
                  },
                  data: {
                    status:
                      "FAILED",

                    resultDescription:
                      error instanceof
                      Error
                        ? error.message
                        : "Payment initiation failed.",
                  },
                }
              );
            }
          }
        };

      const workerCount =
        Math.min(
          BULK_CONCURRENCY,
          transactions.length
        );

      const workers =
        Array.from(
          {
            length:
              workerCount,
          },
          () =>
            processNext()
        );

      await Promise.all(
        workers
      );

      /*
       * Recalculate counters from database.
       */
      const currentTransactions =
        await prisma.mpesaTransaction.findMany(
          {
            where: {
              organizationId,
              batchId:
                batch.id,
            },
            select: {
              status: true,
            },
          }
        );

      const pending =
        currentTransactions.filter(
          (item) =>
            item.status ===
              "PENDING" ||
            item.status ===
              "PROCESSING"
        ).length;

      const failed =
        currentTransactions.filter(
          (item) =>
            item.status ===
            "FAILED"
        ).length;

      const successful =
        currentTransactions.filter(
          (item) =>
            item.status ===
            "COMPLETED"
        ).length;

      let status =
        "PROCESSING";

      if (
        pending === 0
      ) {
        if (
          successful ===
          recipients.length
        ) {
          status =
            "COMPLETED";
        } else if (
          failed ===
          recipients.length
        ) {
          status =
            "FAILED";
        } else {
          status =
            "PARTIALLY_COMPLETED";
        }
      }

      const updatedBatch =
        await prisma.mpesaPaymentBatch.update(
          {
            where: {
              id:
                batch.id,
            },
            data: {
              successful,
              failed,
              pending,
              status,
            },
          }
        );

      await createAuditLog(
        organizationId,
        userId,
        "MPESA_BULK_PAYMENT_INITIATED",
        {
          batchId:
            batch.id,
          batchReference:
            batch.batchReference,
          totalPayments:
            recipients.length,
          totalAmount,
          failedToInitiate:
            failed,
        }
      );

      res.status(202).json({
        success: true,
        message:
          "Bulk M-Pesa payment batch submitted successfully.",
        batch:
          serializeBatch(
            updatedBatch
          ),
      });
    } catch (error) {
      console.error(
        "Create bulk M-Pesa payment error:",
        error
      );

      res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to create bulk M-Pesa payment.",
      });
    }
  };

/* =========================================================
   STK PUSH
========================================================= */

export const createSTKPush =
  async (
    req: AuthenticatedRequest,
    res: ExpressResponse
  ): Promise<void> => {
    try {
      const {
        organizationId,
        userId,
      } = await requireOrganizationAccess(
        req,
        ["mpesa:payments"]
      );

      const body = req.body as STKPushBody;

      if (
        !body.mpesaAccountId ||
        !body.phoneNumber ||
        body.amount === undefined
      ) {
        res.status(400).json({
          success: false,
          message: "M-Pesa account, phone number and amount are required.",
        });
        return;
      }

      const amount = validateAmount(body.amount);
      const phoneNumber = normalizePhoneNumber(body.phoneNumber);

      const account = await prisma.mpesaAccount.findFirst({
        where: {
          id: body.mpesaAccountId,
          organizationId,
          isActive: true,
        },
      });

      if (!account) {
        res.status(404).json({
          success: false,
          message: "Active M-Pesa account not found.",
        });
        return;
      }

      if (!account.stkPasskeyEncrypted) {
        res.status(400).json({
          success: false,
          message: "M-Pesa STK Passkey is not configured for this account.",
        });
        return;
      }

      const transactionType = body.transactionType || "CustomerPayBillOnline";
      if (
        transactionType !== "CustomerPayBillOnline" &&
        transactionType !== "CustomerBuyGoodsOnline"
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid STK transaction type.",
        });
        return;
      }

      const result = await createSTKPushTransaction(
        organizationId,
        {
          mpesaAccountId: account.id,
          phoneNumber,
          amount,
          transactionType,
          accountReference: body.accountReference?.trim() || "ZIYA-FOS",
          transactionDesc: body.transactionDesc?.trim() || "Ziya FOS payment",
        }
      );

      await createAuditLog(
        organizationId,
        userId,
        "MPESA_STK_PUSH_INITIATED",
        {
          transactionId: result.transactionId,
          mpesaAccountId: account.id,
          amount,
          phoneNumber,
          transactionType,
        }
      );

      res.status(result.success ? 202 : 400).json({
        success: result.success,
        message:
          result.responseDescription ||
          (result.success
            ? "STK Push submitted successfully."
            : "STK Push could not be submitted."),
        payment: {
          transactionId: result.transactionId,
          status: result.status,
          merchantRequestId: result.merchantRequestId ?? null,
          checkoutRequestId: result.checkoutRequestId ?? null,
          responseCode: result.responseCode ?? null,
          responseDescription: result.responseDescription ?? null,
          customerMessage: result.customerMessage ?? null,
        },
      });
    } catch (error) {
      console.error("Create STK Push error:", error);
      res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to initiate STK Push.",
      });
    }
  };

export const handleSTKCallback =
  async (
    req: Request,
    res: ExpressResponse
  ): Promise<void> => {
    try {
      console.log("M-Pesa STK callback received.");
      await processSTKCallback(req.body);
      res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
    } catch (error) {
      console.error("M-Pesa STK callback error:", error);
      res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
    }
  };

/* =========================================================
   CALLBACK HELPERS
========================================================= */

const getResultParameter = (
  parameters:
    | DarajaResultParameter[]
    | undefined,
  key: string
):
  | string
  | number
  | undefined => {
  return parameters?.find(
    (item) =>
      item.Key === key
  )?.Value;
};

const parseMpesaDate = (
  value:
    | string
    | number
    | undefined
): Date | undefined => {
  if (
    value ===
      undefined ||
    value === null
  ) {
    return undefined;
  }

  const dateString =
    String(value);

  /*
   * Safaricom commonly returns:
   * YYYYMMDDHHMMSS
   */
  if (
    !/^\d{14}$/.test(
      dateString
    )
  ) {
    return undefined;
  }

  const year =
    Number(
      dateString.substring(
        0,
        4
      )
    );

  const month =
    Number(
      dateString.substring(
        4,
        6
      )
    ) - 1;

  const day =
    Number(
      dateString.substring(
        6,
        8
      )
    );

  const hour =
    Number(
      dateString.substring(
        8,
        10
      )
    );

  const minute =
    Number(
      dateString.substring(
        10,
        12
      )
    );

  const second =
    Number(
      dateString.substring(
        12,
        14
      )
    );

  const date =
    new Date(
      year,
      month,
      day,
      hour,
      minute,
      second
    );

  return Number.isNaN(
    date.getTime()
  )
    ? undefined
    : date;
};

/* =========================================================
   B2C RESULT CALLBACK
========================================================= */

/**
 * POST /api/mpesa/callback/result
 */
export const handleB2CResultCallback =
  async (
    req: Request,
    res: ExpressResponse
  ): Promise<void> => {
    try {
      console.log(
        "M-Pesa B2C result callback received."
      );

      const body =
        req.body as DarajaResultResponse;

      const result =
        body?.Result;

      /*
       * Always acknowledge malformed callbacks.
       */
      if (!result) {
        res.status(200).json({
          ResultCode: 0,
          ResultDesc:
            "Accepted",
        });

        return;
      }

      const conversationId =
        result.ConversationID;

      const originatorConversationId =
        result.OriginatorConversationID;

      const resultCode =
        result.ResultCode;

      const resultDescription =
        result.ResultDesc;

      const transactionId =
        result.TransactionID;

      const parameters =
        result
          .ResultParameters
          ?.ResultParameter ||
        [];

      const receiptValue =
        getResultParameter(
          parameters,
          "TransactionReceipt"
        );

      const completedDateValue =
        getResultParameter(
          parameters,
          "TransactionCompletedDate"
        );

      const transactionAmountValue =
        getResultParameter(
          parameters,
          "TransactionAmount"
        );

      /*
       * Locate original transaction.
       */
      const orConditions: Array<
        Record<string, string>
      > = [];

      if (
        conversationId
      ) {
        orConditions.push({
          conversationId,
        });
      }

      if (
        originatorConversationId
      ) {
        orConditions.push({
          originatorConversationId,
        });
      }

      if (
        transactionId
      ) {
        orConditions.push({
          mpesaReceiptNumber:
            transactionId,
        });
      }

      if (
        orConditions.length ===
        0
      ) {
        res.status(200).json({
          ResultCode: 0,
          ResultDesc:
            "Accepted",
        });

        return;
      }

      const transaction =
        await prisma.mpesaTransaction.findFirst(
          {
            where: {
              transactionType: "B2C",
              OR: orConditions,
            },
            include: {
              mpesaAccount: {
                select: {
                  id: true,
                  organizationId: true,
                },
              },
            },
          }
        );

      if (
        !transaction ||
        !transaction.mpesaAccount ||
        transaction.mpesaAccount.organizationId !== transaction.organizationId
      ) {
        console.warn(
          "M-Pesa callback could not be matched to a transaction."
        );

        res.status(200).json({
          ResultCode: 0,
          ResultDesc:
            "Accepted",
        });

        return;
      }

      /*
       * Idempotency:
       *
       * Don't process a terminal transaction twice.
       */
      if (
        transaction.status ===
          "COMPLETED" ||
        transaction.status ===
          "FAILED" ||
        transaction.status ===
          "CANCELLED"
      ) {
        res.status(200).json({
          ResultCode: 0,
          ResultDesc:
            "Accepted",
        });

        return;
      }

      const successful =
        Number(
          resultCode
        ) === 0;

      const newStatus =
        successful
          ? "COMPLETED"
          : "FAILED";

      const receipt =
        typeof receiptValue ===
        "string"
          ? receiptValue
          : transactionId;

      const amount =
        transactionAmountValue !==
        undefined
          ? Number(
              transactionAmountValue
            )
          : Number(
              transaction.amount
            );

      const transactionDate =
        parseMpesaDate(
          completedDateValue
        ) ||
        transaction.transactionDate ||
        new Date();

      await prisma.$transaction(
        async (tx) => {
          await tx.mpesaTransaction.update(
            {
              where: {
                id:
                  transaction.id,
              },
              data: {
                conversationId:
                  conversationId ||
                  transaction.conversationId,

                originatorConversationId:
                  originatorConversationId ||
                  transaction.originatorConversationId,

                mpesaReceiptNumber:
                  receipt ||
                  transaction.mpesaReceiptNumber,

                resultCode:
                  resultCode !==
                  undefined
                    ? Number(
                        resultCode
                      )
                    : transaction.resultCode,

                resultDescription:
                  resultDescription ||
                  transaction.resultDescription,

                amount,

                transactionDate,

                status:
                  newStatus,
              },
            }
          );

          /*
           * Recalculate parent batch.
           */
          if (
            transaction.batchId
          ) {
            const batchTransactions =
              await tx.mpesaTransaction.findMany(
                {
                  where: {
                    batchId:
                      transaction.batchId,
                  },
                  select: {
                    status: true,
                  },
                }
              );

            const successfulCount =
              batchTransactions.filter(
                (item) =>
                  item.status ===
                  "COMPLETED"
              ).length;

            const failedCount =
              batchTransactions.filter(
                (item) =>
                  item.status ===
                  "FAILED"
              ).length;

            const pendingCount =
              batchTransactions.filter(
                (item) =>
                  item.status ===
                    "PENDING" ||
                  item.status ===
                    "PROCESSING"
              ).length;

            let batchStatus =
              "PROCESSING";

            if (
              pendingCount ===
              0
            ) {
              if (
                successfulCount ===
                batchTransactions.length
              ) {
                batchStatus =
                  "COMPLETED";
              } else if (
                failedCount ===
                batchTransactions.length
              ) {
                batchStatus =
                  "FAILED";
              } else {
                batchStatus =
                  "PARTIALLY_COMPLETED";
              }
            }

            await tx.mpesaPaymentBatch.update(
              {
                where: {
                  id:
                    transaction.batchId,
                },
                data: {
                  successful:
                    successfulCount,

                  failed:
                    failedCount,

                  pending:
                    pendingCount,

                  status:
                    batchStatus,
                },
              }
            );
          }
        }
      );

      res.status(200).json({
        ResultCode: 0,
        ResultDesc:
          "Accepted",
      });
    } catch (error) {
      console.error(
        "M-Pesa B2C result callback error:",
        error
      );

      /*
       * Always acknowledge the callback.
       */
      res.status(200).json({
        ResultCode: 0,
        ResultDesc:
          "Accepted",
      });
    }
  };

/* =========================================================
   B2C TIMEOUT CALLBACK
========================================================= */

/**
 * POST /api/mpesa/callback/timeout
 */
export const handleB2CTimeoutCallback =
  async (
    req: Request,
    res: ExpressResponse
  ): Promise<void> => {
    try {
      const body =
        req.body || {};

      const conversationId =
        body.ConversationID ||
        body.Result
          ?.ConversationID;

      const originatorConversationId =
        body.OriginatorConversationID ||
        body.Result
          ?.OriginatorConversationID;

      const orConditions: Array<
        Record<string, string>
      > = [];

      if (
        conversationId
      ) {
        orConditions.push({
          conversationId,
        });
      }

      if (
        originatorConversationId
      ) {
        orConditions.push({
          originatorConversationId,
        });
      }

      if (
        orConditions.length ===
        0
      ) {
        res.status(200).json({
          ResultCode: 0,
          ResultDesc:
            "Accepted",
        });

        return;
      }

      const transaction =
        await prisma.mpesaTransaction.findFirst(
          {
            where: {
              transactionType: "B2C",
              OR: orConditions,
            },
            include: {
              mpesaAccount: {
                select: {
                  id: true,
                  organizationId: true,
                },
              },
            },
          }
        );

      if (
        transaction &&
        transaction.mpesaAccount &&
        transaction.mpesaAccount.organizationId === transaction.organizationId
      ) {
        await prisma.$transaction(
          async (tx) => {
            await tx.mpesaTransaction.update(
              {
                where: {
                  id:
                    transaction.id,
                },
                data: {
                  status:
                    "FAILED",

                  resultDescription:
                    "M-Pesa payment request timed out.",
                },
              }
            );

            if (
              transaction.batchId
            ) {
              const batchTransactions =
                await tx.mpesaTransaction.findMany(
                  {
                    where: {
                      batchId:
                        transaction.batchId,
                    },
                    select: {
                      status: true,
                    },
                  }
                );

              const successful =
                batchTransactions.filter(
                  (item) =>
                    item.status ===
                    "COMPLETED"
                ).length;

              const failed =
                batchTransactions.filter(
                  (item) =>
                    item.status ===
                    "FAILED"
                ).length;

              const pending =
                batchTransactions.filter(
                  (item) =>
                    item.status ===
                      "PENDING" ||
                    item.status ===
                      "PROCESSING"
                ).length;

              let status =
                "PROCESSING";

              if (
                pending ===
                0
              ) {
                if (
                  successful ===
                  batchTransactions.length
                ) {
                  status =
                    "COMPLETED";
                } else if (
                  failed ===
                  batchTransactions.length
                ) {
                  status =
                    "FAILED";
                } else {
                  status =
                    "PARTIALLY_COMPLETED";
                }
              }

              await tx.mpesaPaymentBatch.update(
                {
                  where: {
                    id:
                      transaction.batchId,
                  },
                  data: {
                    successful,
                    failed,
                    pending,
                    status,
                  },
                }
              );
            }
          }
        );
      }

      res.status(200).json({
        ResultCode: 0,
        ResultDesc:
          "Accepted",
      });
    } catch (error) {
      console.error(
        "M-Pesa timeout callback error:",
        error
      );

      res.status(200).json({
        ResultCode: 0,
        ResultDesc:
          "Accepted",
      });
    }
  };

/* =========================================================
   GET PAYMENT BATCH
========================================================= */

/**
 * GET /api/mpesa/batches/:batchId
 */
export const getPaymentBatch =
  async (
    req: AuthenticatedRequest,
    res: ExpressResponse
  ): Promise<void> => {
    try {
      const {
        organizationId,
      } =
        await requireOrganizationAccess(
          req
        );

      const batchId =
        getRouteParam(
          req,
          "batchId"
        );

      const batch =
        await prisma.mpesaPaymentBatch.findFirst(
          {
            where: {
              id: batchId,
              organizationId,
            },
            include: {
              transactions: {
                orderBy: {
                  createdAt:
                    "asc",
                },
              },
            },
          }
        );

      if (!batch) {
        res.status(404).json({
          success: false,
          message:
            "M-Pesa payment batch not found.",
        });

        return;
      }

      res.status(200).json({
        success: true,
        batch: {
          ...serializeBatch(
            batch
          ),

          transactions:
            batch.transactions.map(
              serializeTransaction
            ),
        },
      });
    } catch (error) {
      console.error(
        "Get payment batch error:",
        error
      );

      res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch payment batch.",
      });
    }
  };

/* =========================================================
   LIST PAYMENT BATCHES
========================================================= */

/**
 * GET /api/mpesa/batches
 */
export const getPaymentBatches =
  async (
    req: AuthenticatedRequest,
    res: ExpressResponse
  ): Promise<void> => {
    try {
      const {
        organizationId,
      } =
        await requireOrganizationAccess(
          req
        );

      const page =
        Math.max(
          Number(
            req.query.page
          ) || 1,
          1
        );

      const limit =
        Math.min(
          Math.max(
            Number(
              req.query.limit
            ) || 50,
            1
          ),
          100
        );

      const skip =
        (page - 1) *
        limit;

      const [
        batches,
        total,
      ] =
        await Promise.all([
          prisma.mpesaPaymentBatch.findMany(
            {
              where: {
                organizationId,
              },
              orderBy: {
                createdAt:
                  "desc",
              },
              skip,
              take:
                limit,
            }
          ),

          prisma.mpesaPaymentBatch.count(
            {
              where: {
                organizationId,
              },
            }
          ),
        ]);

      res.status(200).json({
        success: true,

        pagination: {
          page,
          limit,
          total,
          totalPages:
            Math.ceil(
              total / limit
            ),
        },

        batches:
          batches.map(
            serializeBatch
          ),
      });
    } catch (error) {
      console.error(
        "Get payment batches error:",
        error
      );

      res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch payment batches.",
      });
    }
  };

/* =========================================================
   GET M-PESA TRANSACTIONS
========================================================= */

/**
 * GET /api/mpesa/transactions
 *
 * Supported query parameters:
 *
 * ?status=COMPLETED
 * ?phoneNumber=0712345678
 * ?batchId=...
 * ?page=1
 * ?limit=50
 */
export const getMpesaTransactions =
  async (
    req: AuthenticatedRequest,
    res: ExpressResponse
  ): Promise<void> => {
    try {
      const {
        organizationId,
      } =
        await requireOrganizationAccess(
          req
        );

      const page =
        Math.max(
          Number(
            req.query.page
          ) || 1,
          1
        );

      const limit =
        Math.min(
          Math.max(
            Number(
              req.query.limit
            ) || 50,
            1
          ),
          100
        );

      const where: {
        organizationId: string;
        status?: string;
        phoneNumber?: string;
        batchId?: string;
      } = {
        organizationId,
      };

      if (
        typeof req.query.status ===
        "string"
      ) {
        where.status =
          req.query.status;
      }

      if (
        typeof req.query.phoneNumber ===
        "string"
      ) {
        where.phoneNumber =
          normalizePhoneNumber(
            req.query.phoneNumber
          );
      }

      if (
        typeof req.query.batchId ===
        "string"
      ) {
        where.batchId =
          req.query.batchId;
      }

      const skip =
        (page - 1) *
        limit;

      const [
        transactions,
        total,
      ] =
        await Promise.all([
          prisma.mpesaTransaction.findMany(
            {
              where,
              orderBy: {
                createdAt:
                  "desc",
              },
              skip,
              take:
                limit,
            }
          ),

          prisma.mpesaTransaction.count(
            {
              where,
            }
          ),
        ]);

      res.status(200).json({
        success: true,

        pagination: {
          page,
          limit,
          total,
          totalPages:
            Math.ceil(
              total / limit
            ),
        },

        transactions:
          transactions.map(
            serializeTransaction
          ),
      });
    } catch (error) {
      console.error(
        "Get M-Pesa transactions error:",
        error
      );

      res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch M-Pesa transactions.",
      });
    }
  };

/* =========================================================
   GET SINGLE TRANSACTION
========================================================= */

/**
 * GET /api/mpesa/transactions/:transactionId
 */
export const getMpesaTransaction =
  async (
    req: AuthenticatedRequest,
    res: ExpressResponse
  ): Promise<void> => {
    try {
      const {
        organizationId,
      } =
        await requireOrganizationAccess(
          req
        );

      const transactionId =
        getRouteParam(
          req,
          "transactionId"
        );

      const transaction =
        await prisma.mpesaTransaction.findFirst(
          {
            where: {
              id:
                transactionId,
              organizationId,
            },
          }
        );

      if (!transaction) {
        res.status(404).json({
          success: false,
          message:
            "M-Pesa transaction not found.",
        });

        return;
      }

      res.status(200).json({
        success: true,
        transaction:
          serializeTransaction(
            transaction
          ),
      });
    } catch (error) {
      console.error(
        "Get M-Pesa transaction error:",
        error
      );

      res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch M-Pesa transaction.",
      });
    }
  };

/* =========================================================
   M-PESA SUMMARY
========================================================= */

/**
 * GET /api/mpesa/summary
 */
export const getMpesaSummary =
  async (
    req: AuthenticatedRequest,
    res: ExpressResponse
  ): Promise<void> => {
    try {
      const {
        organizationId,
      } =
        await requireOrganizationAccess(
          req
        );

      const [
        totalTransactions,
        completedTransactions,
        failedTransactions,
        pendingTransactions,
      ] =
        await Promise.all([
          prisma.mpesaTransaction.count(
            {
              where: {
                organizationId,
              },
            }
          ),

          prisma.mpesaTransaction.count(
            {
              where: {
                organizationId,
                status:
                  "COMPLETED",
              },
            }
          ),

          prisma.mpesaTransaction.count(
            {
              where: {
                organizationId,
                status:
                  "FAILED",
              },
            }
          ),

          prisma.mpesaTransaction.count(
            {
              where: {
                organizationId,
                status: {
                  in: [
                    "PENDING",
                    "PROCESSING",
                  ],
                },
              },
            }
          ),
        ]);

      const completed =
        await prisma.mpesaTransaction.findMany(
          {
            where: {
              organizationId,
              status:
                "COMPLETED",
            },
            select: {
              amount: true,
            },
          }
        );

      const totalCompletedAmount =
        completed.reduce(
          (
            total,
            transaction
          ) =>
            total +
            Number(
              transaction.amount
            ),
          0
        );

      res.status(200).json({
        success: true,

        summary: {
          totalTransactions,

          completedTransactions,

          failedTransactions,

          pendingTransactions,

          totalCompletedAmount:
            Math.round(
              totalCompletedAmount *
                100
            ) / 100,
        },
      });
    } catch (error) {
      console.error(
        "Get M-Pesa summary error:",
        error
      );

      res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to generate M-Pesa summary.",
      });
    }
  };

/* =========================================================
   PAYMENT HUB
========================================================= */

/**
 * POST /api/mpesa/payment-hub/pay
 *
 * Unified outbound M-Pesa payment endpoint.
 *
 * Destination types:
 *   PHONE     -> B2C
 *   PAYBILL   -> B2B BusinessPayBill
 *   TILL      -> B2B BusinessBuyGoods
 *   B2B       -> B2B BusinessPayment
 *
 * The authenticated organization is always resolved by the
 * existing tenant access helper. A frontend-supplied
 * organizationId is never trusted.
 */
export const createPaymentHubPayment =
  async (
    req: AuthenticatedRequest,
    res: ExpressResponse
  ): Promise<void> => {
    try {
      const {
        organizationId,
        userId,
      } =
        await requireOrganizationAccess(
          req,
          ["mpesa:payments"]
        );

      const body =
        req.body as PaymentHubBody;

      if (
        !body.mpesaAccountId ||
        body.amount === undefined ||
        !body.destinationType
      ) {
        res.status(400).json({
          success: false,
          message:
            "M-Pesa account, amount and destination type are required.",
        });
        return;
      }

      const destination:
        PaymentDestination = {
        paymentMethod: "MPESA",
        destinationType:
          body.destinationType,
        destination:
          body.destination,
        destinationName:
          body.destinationName,
        phoneNumber:
          body.phoneNumber
            ? normalizePhoneNumber(
                body.phoneNumber
              )
            : undefined,
        paybillNumber:
          body.paybillNumber,
        tillNumber:
          body.tillNumber,
        reference:
          body.reference,
        description:
          body.description,
      };

      const result =
        await processPayment({
          organizationId,
          mpesaAccountId:
            body.mpesaAccountId,
          amount:
            validateAmount(
              body.amount
            ),
          destination,
        });

      await createAuditLog(
        organizationId,
        userId,
        "MPESA_PAYMENT_HUB_REQUESTED",
        {
          transactionId:
            result.transactionId,
          amount:
            body.amount,
          destinationType:
            body.destinationType,
          destination:
            body.destination ||
            body.phoneNumber ||
            body.paybillNumber ||
            body.tillNumber ||
            null,
        }
      );

      res.status(
        result.success
          ? 202
          : 400
      ).json({
        success:
          result.success,
        message:
          result.resultDescription ||
          (
            result.success
              ? "M-Pesa payment initiated successfully."
              : "M-Pesa payment could not be initiated."
          ),
        payment:
          result,
      });
    } catch (error) {
      console.error(
        "Payment Hub payment error:",
        error
      );

      res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to process M-Pesa payment.",
      });
    }
  };

/**
 * POST /api/mpesa/payment-hub/bulk
 *
 * Unified bulk outbound M-Pesa payment endpoint.
 */
export const createPaymentHubBulkPayment =
  async (
    req: AuthenticatedRequest,
    res: ExpressResponse
  ): Promise<void> => {
    try {
      const {
        organizationId,
        userId,
      } =
        await requireOrganizationAccess(
          req,
          ["mpesa:payments"]
        );

      const body =
        req.body as PaymentHubBulkBody;

      if (
        !body.mpesaAccountId ||
        !Array.isArray(
          body.payments
        ) ||
        body.payments.length === 0
      ) {
        res.status(400).json({
          success: false,
          message:
            "M-Pesa account and at least one payment are required.",
        });
        return;
      }

      if (
        body.payments.length >
        MAX_BULK_RECIPIENTS
      ) {
        res.status(400).json({
          success: false,
          message:
            `A maximum of ${MAX_BULK_RECIPIENTS} payments is allowed per batch.`,
        });
        return;
      }

      const payments =
        body.payments.map(
          (
            payment,
            index
          ) => {
            if (
              payment.amount ===
              undefined
            ) {
              throw new Error(
                `Payment ${index + 1}: amount is required.`
              );
            }

            if (
              !payment.destinationType
            ) {
              throw new Error(
                `Payment ${index + 1}: destination type is required.`
              );
            }

            return {
              amount:
                validateAmount(
                  payment.amount
                ),
              destination: {
                paymentMethod:
                  "MPESA",
                destinationType:
                  payment.destinationType,
                destination:
                  payment.destination,
                destinationName:
                  payment.destinationName,
                phoneNumber:
                  payment.phoneNumber
                    ? normalizePhoneNumber(
                        payment.phoneNumber
                      )
                    : undefined,
                paybillNumber:
                  payment.paybillNumber,
                tillNumber:
                  payment.tillNumber,
                reference:
                  payment.reference ||
                  generatePaymentReference(
                    index
                  ),
                description:
                  payment.description ||
                  "ZIYA FOS M-Pesa payment",
              } satisfies PaymentDestination,
            };
          }
        );

      const results =
        await processPaymentBatch({
          organizationId,
          mpesaAccountId:
            body.mpesaAccountId,
          payments,
        });

      const successful =
        results.filter(
          result =>
            result.success
        ).length;

      const failed =
        results.length -
        successful;

      await createAuditLog(
        organizationId,
        userId,
        "MPESA_PAYMENT_HUB_BULK_REQUESTED",
        {
          total:
            results.length,
          successful,
          failed,
        }
      );

      res.status(200).json({
        success:
          failed === 0,
        total:
          results.length,
        successful,
        failed,
        payments:
          results,
      });
    } catch (error) {
      console.error(
        "Payment Hub bulk payment error:",
        error
      );

      res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to process bulk M-Pesa payments.",
      });
    }
  };

/* =========================================================
   CONTROLLER EXPORT
========================================================= */

export default {
  configureMpesaAccount,
  updateMpesaAccount,

  getMpesaAccounts,
  getMpesaAccount,

  testExistingMpesaAccount,

  updateMpesaAccountStatus,
  setDefaultMpesaAccount,

  createSinglePayment,
  createBulkPayment,

  createSTKPush,
  handleSTKCallback,

  createPaymentHubPayment,
  createPaymentHubBulkPayment,

  handleB2CResultCallback,
  handleB2CTimeoutCallback,

  getPaymentBatch,
  getPaymentBatches,

  getMpesaTransactions,
  getMpesaTransaction,

  getMpesaSummary,
};
