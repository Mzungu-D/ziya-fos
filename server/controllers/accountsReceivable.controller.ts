import { Response } from "express";
import {
  Account as PrismaAccount,
  Prisma,
} from "@prisma/client";

import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import {
  ensureStandardChartOfAccounts,
} from "../services/chartOfAccounts.service";

/* =========================================================
   ACCOUNTS RECEIVABLE CONTROLLER

   Accounting model:
   - Every query is tenant-scoped.
   - Pending AR may be edited/deleted.
   - Invoice-originated AR is created by invoice finalization.
   - Standalone AR is recognized on approval:
       Dr Accounts Receivable
       Cr Sales Revenue
   - Customer payments are atomic:
       Dr Cash / Bank / M-Pesa
       Cr Accounts Receivable
   - Partial payments are supported.
   - Posted accounting history is never deleted.
   - Payment references are protected against duplicate use
     within the organization.
   - Approved/active/closed records are immutable except for
     the controlled payment lifecycle.
========================================================= */

const ACCOUNT_CODES = {
  ACCOUNTS_RECEIVABLE: "1200",
  DEFAULT_CASH_ACCOUNT: "1100",
  SALES_REVENUE: "4100",
} as const;

const RECEIVABLE_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  ACTIVE: "ACTIVE",
  CLOSED: "CLOSED",
  VOID: "VOID",
} as const;

const PAYMENT_STATUS = {
  UNPAID: "UNPAID",
  PARTIALLY_PAID: "PARTIALLY_PAID",
  PAID: "PAID",
} as const;

const JOURNAL_STATUS = {
  DRAFT: "DRAFT",
  POSTED: "POSTED",
  APPROVED: "APPROVED",
} as const;

const MONEY_TOLERANCE = 0.01;

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

/* =========================================================
   REQUEST / VALUE HELPERS
========================================================= */

const getOrganizationId = (
  req: AuthRequest
): string | null =>
  req.user?.organizationId ?? null;

const getUserId = (
  req: AuthRequest
): string =>
  req.user?.userId ?? "SYSTEM";

const getReceivableId = (
  req: AuthRequest
): string | null => {
  const value = req.params.id;

  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0]?.trim() || null;
  }

  const id = String(value).trim();

  return id || null;
};

const normalizeText = (
  value: unknown
): string =>
  typeof value === "string"
    ? value.trim()
    : "";

const normalizeOptionalText = (
  value: unknown
): string | null => {
  const valueText =
    normalizeText(value);

  return valueText || null;
};

const parsePositiveAmount = (
  value: unknown
): number | null => {
  const amount =
    typeof value === "number"
      ? value
      : Number(value);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return null;
  }

  return roundMoney(amount);
};

const parseDate = (
  value: unknown
): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(
      value.getTime()
    )
      ? null
      : value;
  }

  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return null;
  }

  const date =
    new Date(value);

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
};

const roundMoney = (
  value: number
): number =>
  Math.round(
    (value + Number.EPSILON) * 100
  ) / 100;

const toNumber = (
  value: unknown
): number => {
  const number =
    typeof value === "bigint"
      ? Number(value)
      : Number(value ?? 0);

  return Number.isFinite(number)
    ? number
    : 0;
};

const isEffectivelyZero = (
  value: number
): boolean =>
  Math.abs(value) <=
  MONEY_TOLERANCE;

const getPaymentStatus = (
  originalAmount: number,
  outstandingBalance: number
): string => {
  const original =
    roundMoney(originalAmount);

  const outstanding =
    roundMoney(
      Math.max(
        0,
        outstandingBalance
      )
    );

  if (
    outstanding <=
    MONEY_TOLERANCE
  ) {
    return PAYMENT_STATUS.PAID;
  }

  if (
    outstanding <
    original - MONEY_TOLERANCE
  ) {
    return PAYMENT_STATUS.PARTIALLY_PAID;
  }

  return PAYMENT_STATUS.UNPAID;
};

const parsePagination = (
  pageValue: unknown,
  limitValue: unknown
) => {
  let page =
    Number(pageValue);

  let limit =
    Number(limitValue);

  if (
    !Number.isInteger(page) ||
    page < 1
  ) {
    page = DEFAULT_PAGE;
  }

  if (
    !Number.isInteger(limit) ||
    limit < 1
  ) {
    limit = DEFAULT_LIMIT;
  }

  limit =
    Math.min(
      limit,
      MAX_LIMIT
    );

  return {
    page,
    limit,
    skip:
      (page - 1) *
      limit,
  };
};

const getSearch = (
  value: unknown
): string =>
  typeof value === "string"
    ? value.trim()
    : "";

const normalizeStatusFilter = (
  value: unknown,
  allowed: readonly string[]
): string | null => {
  const normalized =
    normalizeOptionalText(value);

  if (!normalized) return null;

  return (
    allowed.find(
      (item) =>
        item.toUpperCase() ===
        normalized.toUpperCase()
    ) ?? null
  );
};

const getStartOfDay = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const getOverdueMetadata = (
  dueDate: Date,
  outstandingBalance: number,
  asOfDate: Date = new Date()
) => {
  const outstanding =
    roundMoney(
      outstandingBalance
    );

  const due =
    new Date(dueDate);

  const asOf =
    new Date(asOfDate);

  due.setHours(0, 0, 0, 0);
  asOf.setHours(0, 0, 0, 0);

  const isOverdue =
    outstanding > MONEY_TOLERANCE &&
    due.getTime() <
      asOf.getTime();

  return {
    isOverdue,
    daysOverdue: isOverdue
      ? Math.floor(
          (asOf.getTime() -
            due.getTime()) /
            (24 * 60 * 60 * 1000)
        )
      : 0,
  };
};

const presentReceivable = <
  T extends {
    dueDate: Date;
    outstandingBalance: number;
  }
>(
  receivable: T,
  asOfDate: Date = new Date()
) => ({
  ...receivable,
  ...getOverdueMetadata(
    receivable.dueDate,
    toNumber(
      receivable.outstandingBalance
    ),
    asOfDate
  ),
});

const getReceivablePaymentHistory = async (
  organizationId: string,
  invoiceNumber: string
) => {
  const journals = await prisma.journalEntry.findMany({
    where: {
      organizationId,
      reference: { startsWith: "AR-PAY-" },
      description: { contains: invoiceNumber },
      status: {
        in: [
          JOURNAL_STATUS.POSTED,
          JOURNAL_STATUS.APPROVED,
        ],
      },
    },
    select: {
      id: true,
      reference: true,
      amount: true,
      notes: true,
      transactionDate: true,
      createdAt: true,
      status: true,
      debitAccount: {
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          organizationId: true,
        },
      },
      creditAccount: {
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          organizationId: true,
        },
      },
    },
    orderBy: [
      { transactionDate: "desc" },
      { createdAt: "desc" },
      { id: "desc" },
    ],
  });

  return journals
    .filter(
      (journal) =>
        journal.debitAccount.organizationId ===
          organizationId &&
        journal.creditAccount.organizationId ===
          organizationId
    )
    .map((journal) => ({
      id: journal.id,
      reference: journal.reference,
      amount: roundMoney(toNumber(journal.amount)),
      transactionDate: journal.transactionDate,
      createdAt: journal.createdAt,
      status: journal.status,
      paymentReference:
        journal.notes
          ?.match(/Payment Reference:\s*([^|]+)/i)?.[1]
          ?.trim() ?? null,
      notes: journal.notes,
      paymentAccount: {
        id: journal.debitAccount.id,
        code: journal.debitAccount.code,
        name: journal.debitAccount.name,
        type: journal.debitAccount.type,
      },
      receivableAccount: {
        id: journal.creditAccount.id,
        code: journal.creditAccount.code,
        name: journal.creditAccount.name,
        type: journal.creditAccount.type,
      },
    }));
};

/* =========================================================
   ERROR / AUDIT HELPERS
========================================================= */

const getErrorMessage = (
  error: unknown
): string =>
  error instanceof Error
    ? error.message
    : String(error);

const isPrismaUniqueError = (
  error: unknown
): boolean =>
  error instanceof
    Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

const createAuditTrail = async (
  tx: Prisma.TransactionClient,
  organizationId: string,
  userId: string,
  action: string,
  details: Record<string, unknown>
): Promise<void> => {
  await tx.auditTrail.create({
    data: {
      organizationId,
      user: userId,
      action,
      module:
        "ACCOUNTS_RECEIVABLE",
      details:
        JSON.stringify(details),
    },
  });
};

/* =========================================================
   ACCOUNT HELPERS

   IMPORTANT:
   The Prisma Account model uses:
       account.type

   It does NOT use:
       account.accountType
========================================================= */

const getTenantAccountById = async (
  tx: Prisma.TransactionClient,
  organizationId: string,
  accountId: string
): Promise<PrismaAccount | null> =>
  tx.account.findFirst({
    where: {
      id: accountId,
      organizationId,
    },
  });

const getTenantAccountByCode = async (
  tx: Prisma.TransactionClient,
  organizationId: string,
  code: string
): Promise<PrismaAccount | null> =>
  tx.account.findFirst({
    where: {
      organizationId,
      code,
    },
  });

const requireReceivableAccount =
  async (
    tx: Prisma.TransactionClient,
    organizationId: string
  ): Promise<PrismaAccount> => {
    await ensureStandardChartOfAccounts(
      tx,
      organizationId
    );

    const account =
      await getTenantAccountByCode(
        tx,
        organizationId,
        ACCOUNT_CODES
          .ACCOUNTS_RECEIVABLE
      );

    if (!account) {
      throw new Error(
        "STANDARD_AR_ACCOUNT_NOT_FOUND"
      );
    }

    if (account.type !== "ASSET") {
      throw new Error(
        "STANDARD_AR_ACCOUNT_INVALID"
      );
    }

    return account;
  };

const requireRevenueAccount =
  async (
    tx: Prisma.TransactionClient,
    organizationId: string
  ): Promise<PrismaAccount> => {
    await ensureStandardChartOfAccounts(
      tx,
      organizationId
    );

    const account =
      await getTenantAccountByCode(
        tx,
        organizationId,
        ACCOUNT_CODES.SALES_REVENUE
      );

    if (!account) {
      throw new Error(
        "STANDARD_REVENUE_ACCOUNT_NOT_FOUND"
      );
    }

    if (account.type !== "INCOME") {
      throw new Error(
        "STANDARD_REVENUE_ACCOUNT_INVALID"
      );
    }

    return account;
  };

const resolvePaymentAccount =
  async (
    tx: Prisma.TransactionClient,
    organizationId: string,
    input: {
      accountId?: unknown;
      accountCode?: unknown;
    }
  ): Promise<PrismaAccount> => {
    await ensureStandardChartOfAccounts(
      tx,
      organizationId
    );

    const accountId =
      normalizeOptionalText(
        input.accountId
      );

    const accountCode =
      normalizeOptionalText(
        input.accountCode
      );

    let account:
      PrismaAccount | null =
      null;

    if (accountId) {
      account =
        await getTenantAccountById(
          tx,
          organizationId,
          accountId
        );
    } else if (accountCode) {
      account =
        await getTenantAccountByCode(
          tx,
          organizationId,
          accountCode
        );
    } else {
      account =
        await getTenantAccountByCode(
          tx,
          organizationId,
          ACCOUNT_CODES
            .DEFAULT_CASH_ACCOUNT
        );
    }

    if (!account) {
      throw new Error(
        "PAYMENT_ACCOUNT_NOT_FOUND"
      );
    }

    if (account.type !== "ASSET") {
      throw new Error(
        "PAYMENT_ACCOUNT_MUST_BE_ASSET"
      );
    }

    if (
      account.code ===
      ACCOUNT_CODES
        .ACCOUNTS_RECEIVABLE
    ) {
      throw new Error(
        "PAYMENT_ACCOUNT_CANNOT_BE_AR"
      );
    }

    return account;
  };

/* =========================================================
   JOURNAL REFERENCES

   References are tenant-scoped and protected by a PostgreSQL
   transaction advisory lock.

   The external payment reference is deliberately NOT used as
   the journal primary reference. This keeps internal GL
   numbering controlled by the system.
========================================================= */

const generateSequentialReference =
  async (
    tx: Prisma.TransactionClient,
    organizationId: string,
    prefix: string,
    lockPrefix: string
  ): Promise<string> => {
    const year =
      new Date().getFullYear();

    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(
        hashtextextended(
          ${`${lockPrefix}-${organizationId}-${year}`},
          0
        )
      )
    `;

    const fullPrefix =
      `${prefix}${year}-`;

    const existing =
      await tx.journalEntry.findMany({
        where: {
          organizationId,
          reference: {
            startsWith:
              fullPrefix,
          },
        },
        select: {
          reference: true,
        },
        orderBy: {
          reference: "desc",
        },
        take: 1,
      });

    const latest =
      existing[0]?.reference;

    const parsed = latest
      ? Number(
          latest.slice(
            fullPrefix.length
          )
        )
      : 0;

    const next =
      Number.isInteger(parsed) &&
      parsed >= 0
        ? parsed + 1
        : 1;

    return (
      fullPrefix +
      String(next).padStart(6, "0")
    );
  };

const generatePaymentReference =
  (
    tx: Prisma.TransactionClient,
    organizationId: string
  ): Promise<string> =>
    generateSequentialReference(
      tx,
      organizationId,
      "AR-PAY-",
      "AR-PAY"
    );

const generateRecognitionReference =
  (
    tx: Prisma.TransactionClient,
    organizationId: string
  ): Promise<string> =>
    generateSequentialReference(
      tx,
      organizationId,
      "AR-REC-",
      "AR-RECOGNITION"
    );

/* =========================================================
   JOURNAL CREATION
========================================================= */

const createPaymentJournal =
  async (
    tx: Prisma.TransactionClient,
    params: {
      organizationId: string;
      invoiceNumber: string;
      amount: number;
      paymentAccountId: string;
      receivableAccountId: string;
      transactionDate: Date;
      createdBy: string;
      paymentReference?:
        | string
        | null;
      notes?: string | null;
    }
  ) => {
    const amount =
      roundMoney(params.amount);

    if (amount <= 0) {
      throw new Error(
        "INVALID_PAYMENT_AMOUNT"
      );
    }

    const paymentAccount =
      await getTenantAccountById(
        tx,
        params.organizationId,
        params.paymentAccountId
      );

    const receivableAccount =
      await getTenantAccountById(
        tx,
        params.organizationId,
        params.receivableAccountId
      );

    if (
      !paymentAccount ||
      !receivableAccount
    ) {
      throw new Error(
        "PAYMENT_ACCOUNTS_NOT_FOUND"
      );
    }

    if (
      paymentAccount.type !==
      "ASSET"
    ) {
      throw new Error(
        "PAYMENT_ACCOUNT_MUST_BE_ASSET"
      );
    }

    if (
      receivableAccount.type !==
      "ASSET"
    ) {
      throw new Error(
        "RECEIVABLE_ACCOUNT_MUST_BE_ASSET"
      );
    }

    if (
      paymentAccount.id ===
      receivableAccount.id
    ) {
      throw new Error(
        "PAYMENT_ACCOUNTS_MUST_DIFFER"
      );
    }

    const reference =
      await generatePaymentReference(
        tx,
        params.organizationId
      );

    const noteParts = [
      `AR payment for invoice ${params.invoiceNumber}`,
      params.paymentReference
        ? `Payment Reference: ${params.paymentReference}`
        : null,
      params.notes ?? null,
    ].filter(
      (
        value
      ): value is string =>
        Boolean(value)
    );

    const journal =
      await tx.journalEntry.create({
        data: {
          reference,
          description:
            `Customer payment - ${params.invoiceNumber}`,
          debitAccountId:
            paymentAccount.id,
          creditAccountId:
            receivableAccount.id,
          amount,
          createdBy:
            params.createdBy,
          transactionDate:
            params.transactionDate,
          organizationId:
            params.organizationId,
          status:
            JOURNAL_STATUS.POSTED,
          postedAt:
            params.transactionDate,
          postedBy:
            params.createdBy,
          notes:
            noteParts.join(" | "),
          lines: {
            create: [
              {
                accountId:
                  paymentAccount.id,
                lineNumber: 1,
                memo:
                  `Customer payment received - ${params.invoiceNumber}`,
                debit: amount,
                credit: 0,
              },
              {
                accountId:
                  receivableAccount.id,
                lineNumber: 2,
                memo:
                  `Settlement of accounts receivable - ${params.invoiceNumber}`,
                debit: 0,
                credit: amount,
              },
            ],
          },
        },
        include: {
          lines: true,
        },
      });

    const debitTotal =
      journal.lines.reduce(
        (sum, line) =>
          sum +
          toNumber(line.debit),
        0
      );

    const creditTotal =
      journal.lines.reduce(
        (sum, line) =>
          sum +
          toNumber(line.credit),
        0
      );

    if (
      !isEffectivelyZero(
        roundMoney(
          debitTotal -
            creditTotal
        )
      )
    ) {
      throw new Error(
        "PAYMENT_JOURNAL_UNBALANCED"
      );
    }

    return journal;
  };

/* =========================================================
   CREATE RECEIVABLE
========================================================= */

export const createReceivable =
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

      const invoiceNumber =
        normalizeText(
          req.body.invoiceNumber
        );

      const customerName =
        normalizeText(
          req.body.customerName
        );

      const description =
        normalizeText(
          req.body.description
        );

      const amount =
        parsePositiveAmount(
          req.body.amount
        );

      const dueDate =
        parseDate(
          req.body.dueDate
        );

      if (!invoiceNumber) {
        return res.status(400).json({
          success: false,
          message:
            "Invoice number is required.",
        });
      }

      if (!customerName) {
        return res.status(400).json({
          success: false,
          message:
            "Customer name is required.",
        });
      }

      if (!description) {
        return res.status(400).json({
          success: false,
          message:
            "Description is required.",
        });
      }

      if (amount === null) {
        return res.status(400).json({
          success: false,
          message:
            "Amount must be greater than zero.",
        });
      }

      if (!dueDate) {
        return res.status(400).json({
          success: false,
          message:
            "A valid due date is required.",
        });
      }

      const receivable =
        await prisma.$transaction(
          async (tx) => {
            await ensureStandardChartOfAccounts(
              tx,
              organizationId
            );

            const existing =
              await tx.accountsReceivable.findFirst(
                {
                  where: {
                    organizationId,
                    invoiceNumber,
                  },
                  select: {
                    id: true,
                  },
                }
              );

            if (existing) {
              throw new Error(
                "RECEIVABLE_ALREADY_EXISTS"
              );
            }

            /*
             * Invoice and AR share the invoice-number namespace
             * conceptually. If an Invoice exists, the Invoicing
             * workflow owns the receivable lifecycle.
             */
            const existingInvoice =
              await tx.invoice.findFirst({
                where: {
                  organizationId,
                  invoiceNumber,
                },
                select: {
                  id: true,
                  status: true,
                },
              });

            if (existingInvoice) {
              throw new Error(
                "INVOICE_ALREADY_EXISTS_USE_INVOICE_WORKFLOW"
              );
            }

            const created =
              await tx.accountsReceivable.create(
                {
                  data: {
                    organizationId,
                    invoiceNumber,
                    customerName,
                    description,
                    amount,
                    outstandingBalance:
                      amount,
                    dueDate,
                    paymentStatus:
                      PAYMENT_STATUS.UNPAID,
                    status:
                      RECEIVABLE_STATUS.PENDING,
                  },
                }
              );

            await createAuditTrail(
              tx,
              organizationId,
              getUserId(req),
              "RECEIVABLE_CREATED",
              {
                receivableId:
                  created.id,
                invoiceNumber,
                amount,
                dueDate:
                  dueDate.toISOString(),
                workflow:
                  "STANDALONE_AR",
              }
            );

            return created;
          }
        );

      return res.status(201).json({
        success: true,
        message:
          "Customer receivable created successfully.",
        receivable:
          presentReceivable(
            receivable
          ),
      });
    } catch (error) {
      console.error(
        "Create receivable error:",
        error
      );

      const message =
        getErrorMessage(error);

      if (
        message ===
        "RECEIVABLE_ALREADY_EXISTS"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "A receivable with this invoice number already exists in this organization.",
        });
      }

      if (
        message ===
        "INVOICE_ALREADY_EXISTS_USE_INVOICE_WORKFLOW"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "An invoice with this number already exists. Use the Invoicing workflow so the invoice and receivable are posted together.",
        });
      }

      if (
        isPrismaUniqueError(error)
      ) {
        return res.status(409).json({
          success: false,
          message:
            "A receivable with this invoice number already exists in this organization.",
        });
      }

      return res.status(500).json({
        success: false,
        message:
          "Failed to create customer receivable.",
      });
    }
  };

/* =========================================================
   GET RECEIVABLES

   Server-side:
   - pagination
   - search
   - status filters
   - payment-status filters
   - aggregate totals
========================================================= */

export const getReceivables =
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

      const {
        page,
        limit,
        skip,
      } = parsePagination(
        req.query.page,
        req.query.limit
      );

      const search =
        getSearch(
          req.query.search
        );

      const status = normalizeStatusFilter(
        req.query.status,
        Object.values(RECEIVABLE_STATUS)
      );

      const paymentStatus = normalizeStatusFilter(
        req.query.paymentStatus,
        Object.values(PAYMENT_STATUS)
      );

      const asOfDate =
        req.query.asOfDate !== undefined
          ? parseDate(req.query.asOfDate)
          : new Date();

      if (!asOfDate) {
        return res.status(400).json({
          success: false,
          message:
            "A valid asOfDate is required when supplied.",
        });
      }

      const overdueWhere: Prisma.AccountsReceivableWhereInput = {
        organizationId,
        ...(status ? { status } : {}),
        ...(paymentStatus ? { paymentStatus } : {}),
        ...(search
          ? {
              OR: [
                { invoiceNumber: { contains: search, mode: "insensitive" } },
                { customerName: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
        dueDate: { lt: getStartOfDay(asOfDate) },
        outstandingBalance: { gt: MONEY_TOLERANCE },
      };

      const where:
        Prisma.AccountsReceivableWhereInput =
        {
          organizationId,
          ...(status
            ? { status }
            : {}),
          ...(paymentStatus
            ? { paymentStatus }
            : {}),
          ...(search
            ? {
                OR: [
                  {
                    invoiceNumber: {
                      contains:
                        search,
                      mode:
                        "insensitive",
                    },
                  },
                  {
                    customerName: {
                      contains:
                        search,
                      mode:
                        "insensitive",
                    },
                  },
                  {
                    description: {
                      contains:
                        search,
                      mode:
                        "insensitive",
                    },
                  },
                ],
              }
            : {}),
        };

      const [
        totalRecords,
        receivables,
        summary,
        overdueCount,
        overdueSummary,
      ] =
        await prisma.$transaction([
          prisma.accountsReceivable.count({
            where,
          }),

          prisma.accountsReceivable.findMany(
            {
              where,
              orderBy: [
                {
                  dueDate:
                    "asc",
                },
                {
                  createdAt:
                    "desc",
                },
                {
                  id: "asc",
                },
              ],
              skip,
              take: limit,
            }
          ),

          prisma.accountsReceivable.aggregate(
            {
              where,
              _sum: {
                amount: true,
                outstandingBalance:
                  true,
              },
            }
          ),

          prisma.accountsReceivable.count({
            where: overdueWhere,
          }),

          prisma.accountsReceivable.aggregate({
            where: overdueWhere,
            _sum: {
              outstandingBalance: true,
            },
          }),
        ]);

      const totalPages =
        totalRecords === 0
          ? 0
          : Math.ceil(
              totalRecords /
                limit
            );

      const presented = receivables.map((receivable) =>
        presentReceivable(receivable, asOfDate)
      );

      return res.status(200).json({
        success: true,
        count:
          presented.length,
        receivables:
          presented,
        summary: {
          totalAmount:
            roundMoney(
              toNumber(
                summary._sum.amount
              )
            ),
          totalOutstandingBalance:
            roundMoney(
              toNumber(
                summary._sum
                  .outstandingBalance
              )
            ),
          overdueCount,
          overdueOutstandingBalance:
            roundMoney(
              toNumber(
                overdueSummary._sum
                  .outstandingBalance
              )
            ),
        },
        pagination: {
          page,
          limit,
          totalRecords,
          totalPages,
          hasNextPage:
            page < totalPages,
          hasPreviousPage:
            page > 1 &&
            totalPages > 0,
        },
        meta: {
          organizationId,
          currency: "KES",
          filters: {
            search:
              search || null,
            status:
              status || null,
            paymentStatus:
              paymentStatus ||
              null,
            asOfDate:
              asOfDate.toISOString(),
          },
          generatedAt:
            new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error(
        "Fetch receivables error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch customer receivables.",
      });
    }
  };

/* =========================================================
   GET SINGLE RECEIVABLE
========================================================= */

export const getReceivableById =
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
        getReceivableId(req);

      if (!id) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid receivable ID.",
        });
      }

      const asOfDate =
        req.query.asOfDate !== undefined
          ? parseDate(req.query.asOfDate)
          : new Date();

      if (!asOfDate) {
        return res.status(400).json({
          success: false,
          message:
            "A valid asOfDate is required when supplied.",
        });
      }

      const receivable =
        await prisma.accountsReceivable.findFirst(
          {
            where: {
              id,
              organizationId,
            },
          }
        );

      if (!receivable) {
        return res.status(404).json({
          success: false,
          message:
            "Customer receivable not found.",
        });
      }

      const paymentHistory =
        await getReceivablePaymentHistory(
          organizationId,
          receivable.invoiceNumber
        );

      const recordedPayments = roundMoney(
        paymentHistory.reduce(
          (sum, payment) => sum + payment.amount,
          0
        )
      );

      const expectedPayments = roundMoney(
        toNumber(receivable.amount) -
          toNumber(receivable.outstandingBalance)
      );

      const paymentReconciliationDifference = roundMoney(
        recordedPayments - expectedPayments
      );

      return res.status(200).json({
        success: true,
        receivable: presentReceivable(
          receivable,
          asOfDate
        ),
        payments: paymentHistory,
        paymentSummary: {
          paymentCount: paymentHistory.length,
          recordedPayments,
          expectedPayments,
          reconciliationDifference:
            paymentReconciliationDifference,
          reconciled:
            Math.abs(paymentReconciliationDifference) <=
            MONEY_TOLERANCE,
        },
      });
    } catch (error) {
      console.error(
        "Fetch receivable error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch customer receivable.",
      });
    }
  };

/* =========================================================
   UPDATE RECEIVABLE

   Only PENDING standalone AR can be edited.
========================================================= */

export const updateReceivable =
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
        getReceivableId(req);

      if (!id) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid receivable ID.",
        });
      }

      const existing =
        await prisma.accountsReceivable.findFirst(
          {
            where: {
              id,
              organizationId,
            },
          }
        );

      if (!existing) {
        return res.status(404).json({
          success: false,
          message:
            "Customer receivable not found.",
        });
      }

      if (
        existing.status !==
        RECEIVABLE_STATUS.PENDING
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Only pending receivables can be edited. Posted or approved receivables must be corrected through the appropriate accounting reversal workflow.",
        });
      }

      const customerName =
        normalizeText(
          req.body.customerName
        );

      const description =
        normalizeText(
          req.body.description
        );

      const amount =
        parsePositiveAmount(
          req.body.amount
        );

      const dueDate =
        parseDate(
          req.body.dueDate
        );

      if (!customerName) {
        return res.status(400).json({
          success: false,
          message:
            "Customer name is required.",
        });
      }

      if (!description) {
        return res.status(400).json({
          success: false,
          message:
            "Description is required.",
        });
      }

      if (amount === null) {
        return res.status(400).json({
          success: false,
          message:
            "Amount must be greater than zero.",
        });
      }

      if (!dueDate) {
        return res.status(400).json({
          success: false,
          message:
            "A valid due date is required.",
        });
      }

      const updated =
        await prisma.$transaction(
          async (tx) => {
            const latest =
              await tx.accountsReceivable.findFirst(
                {
                  where: {
                    id,
                    organizationId,
                  },
                }
              );

            if (!latest) {
              throw new Error(
                "RECEIVABLE_NOT_FOUND"
              );
            }

            if (
              latest.status !==
              RECEIVABLE_STATUS.PENDING
            ) {
              throw new Error(
                "RECEIVABLE_NOT_EDITABLE"
              );
            }

            const invoice = await tx.invoice.findFirst({
              where: {
                organizationId,
                invoiceNumber: latest.invoiceNumber,
              },
              select: { id: true },
            });

            if (invoice) {
              throw new Error(
                "INVOICE_OWNS_RECEIVABLE"
              );
            }

            const result =
              await tx.accountsReceivable.update(
                {
                  where: { id },
                  data: {
                    customerName,
                    description,
                    amount,
                    outstandingBalance:
                      amount,
                    dueDate,
                    paymentStatus:
                      PAYMENT_STATUS.UNPAID,
                  },
                }
              );

            await createAuditTrail(
              tx,
              organizationId,
              getUserId(req),
              "RECEIVABLE_UPDATED",
              {
                receivableId: id,
                invoiceNumber:
                  latest.invoiceNumber,
                previousAmount:
                  toNumber(
                    latest.amount
                  ),
                newAmount: amount,
                previousDueDate:
                  latest.dueDate.toISOString(),
                newDueDate:
                  dueDate.toISOString(),
              }
            );

            return result;
          }
        );

      return res.status(200).json({
        success: true,
        message:
          "Customer receivable updated successfully.",
        receivable:
          presentReceivable(
            updated
          ),
      });
    } catch (error) {
      console.error(
        "Update receivable error:",
        error
      );

      const message =
        getErrorMessage(error);

      if (
        message ===
        "RECEIVABLE_NOT_FOUND"
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Customer receivable not found.",
        });
      }

      if (
        message ===
        "RECEIVABLE_NOT_EDITABLE"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Only pending receivables can be edited.",
        });
      }

      if (
        message ===
        "INVOICE_OWNS_RECEIVABLE"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "This receivable is owned by the Invoicing workflow and cannot be edited from Accounts Receivable.",
        });
      }

      return res.status(500).json({
        success: false,
        message:
          "Failed to update customer receivable.",
      });
    }
  };

/* =========================================================
   APPROVE RECEIVABLE

   Two legitimate sources exist:

   A. Invoice-originated AR:
      Invoice finalization already posts:
        Dr AR
        Cr Revenue

      Therefore this endpoint must NOT create another
      recognition journal.

   B. Standalone AR:
      Approval is the accounting recognition point:
        Dr AR
        Cr Sales Revenue

   If an Invoice exists but is not POSTED, the standalone
   AR endpoint refuses to approve it. This prevents duplicate
   or premature recognition.
========================================================= */

export const approveReceivable =
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
        getReceivableId(req);

      if (!id) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid receivable ID.",
        });
      }

      const updated =
        await prisma.$transaction(
          async (tx) => {
            const lockedRows =
              await tx.$queryRaw<
                Array<{ id: string }>
              >`
                SELECT "id"
                FROM "AccountsReceivable"
                WHERE "id" = ${id}
                  AND "organizationId" = ${organizationId}
                FOR UPDATE
              `;

            if (lockedRows.length === 0) {
              throw new Error(
                "RECEIVABLE_NOT_FOUND"
              );
            }

            const existing =
              await tx.accountsReceivable.findFirst(
                {
                  where: {
                    id,
                    organizationId,
                  },
                }
              );

            if (!existing) {
              throw new Error(
                "RECEIVABLE_NOT_FOUND"
              );
            }

            if (
              existing.status ===
              RECEIVABLE_STATUS.APPROVED ||
              existing.status ===
              RECEIVABLE_STATUS.ACTIVE
            ) {
              throw new Error(
                "RECEIVABLE_ALREADY_APPROVED"
              );
            }

            if (
              existing.status ===
              RECEIVABLE_STATUS.CLOSED
            ) {
              throw new Error(
                "RECEIVABLE_ALREADY_CLOSED"
              );
            }

            if (
              existing.status ===
              RECEIVABLE_STATUS.VOID
            ) {
              throw new Error(
                "RECEIVABLE_VOID"
              );
            }

            if (
              existing.status !==
              RECEIVABLE_STATUS.PENDING
            ) {
              throw new Error(
                "RECEIVABLE_NOT_APPROVABLE"
              );
            }

            if (
              toNumber(
                existing.outstandingBalance
              ) <= MONEY_TOLERANCE
            ) {
              throw new Error(
                "RECEIVABLE_HAS_NO_BALANCE"
              );
            }

            const receivableAccount =
              await requireReceivableAccount(
                tx,
                organizationId
              );

            const existingInvoice =
              await tx.invoice.findFirst({
                where: {
                  organizationId,
                  invoiceNumber:
                    existing.invoiceNumber,
                },
                select: {
                  id: true,
                  status: true,
                },
              });

            if (
              existingInvoice &&
              existingInvoice.status !==
                "POSTED"
            ) {
              throw new Error(
                "INVOICE_REQUIRES_FINALIZATION"
              );
            }

            let recognitionJournalId:
              string | null = null;

            /*
             * Standalone AR records must be recognized when
             * approved. Invoice-originated AR is already posted
             * by the invoice finalization transaction.
             */
            if (!existingInvoice) {
              const revenueAccount =
                await requireRevenueAccount(
                  tx,
                  organizationId
                );

              const amount =
                roundMoney(
                  toNumber(
                    existing.amount
                  )
                );

              const transactionDate =
                new Date();

              const reference =
                await generateRecognitionReference(
                  tx,
                  organizationId
                );

              const journal =
                await tx.journalEntry.create(
                  {
                    data: {
                      reference,
                      description:
                        `Accounts receivable recognition - ${existing.invoiceNumber}`,
                      debitAccountId:
                        receivableAccount.id,
                      creditAccountId:
                        revenueAccount.id,
                      amount,
                      createdBy:
                        getUserId(req),
                      transactionDate,
                      organizationId,
                      status:
                        JOURNAL_STATUS.POSTED,
                      postedAt:
                        transactionDate,
                      postedBy:
                        getUserId(req),
                      notes:
                        `Standalone AR recognition for ${existing.invoiceNumber}`,
                      lines: {
                        create: [
                          {
                            accountId:
                              receivableAccount.id,
                            lineNumber: 1,
                            memo:
                              `Accounts receivable - ${existing.invoiceNumber}`,
                            debit: amount,
                            credit: 0,
                          },
                          {
                            accountId:
                              revenueAccount.id,
                            lineNumber: 2,
                            memo:
                              `Revenue recognition - ${existing.invoiceNumber}`,
                            debit: 0,
                            credit: amount,
                          },
                        ],
                      },
                    },
                    include: {
                      lines: true,
                    },
                  }
                );

              const debitTotal =
                journal.lines.reduce(
                  (sum, line) =>
                    sum +
                    toNumber(
                      line.debit
                    ),
                  0
                );

              const creditTotal =
                journal.lines.reduce(
                  (sum, line) =>
                    sum +
                    toNumber(
                      line.credit
                    ),
                  0
                );

              if (
                !isEffectivelyZero(
                  roundMoney(
                    debitTotal -
                      creditTotal
                  )
                )
              ) {
                throw new Error(
                  "AR_RECOGNITION_JOURNAL_UNBALANCED"
                );
              }

              recognitionJournalId =
                journal.id;
            }

            const result =
              await tx.accountsReceivable.update(
                {
                  where: { id },
                  data: {
                    status:
                      RECEIVABLE_STATUS
                        .APPROVED,
                    approvedBy:
                      getUserId(req),
                  },
                }
              );

            await createAuditTrail(
              tx,
              organizationId,
              getUserId(req),
              "RECEIVABLE_APPROVED",
              {
                receivableId: id,
                invoiceNumber:
                  existing.invoiceNumber,
                amount:
                  toNumber(
                    existing.amount
                  ),
                recognitionJournalId,
                accountingTreatment:
                  existingInvoice
                    ? "INVOICE_FINALIZATION"
                    : "STANDALONE_AR_RECOGNITION",
              }
            );

            return result;
          }
        );

      return res.status(200).json({
        success: true,
        message:
          "Customer receivable approved successfully.",
        receivable:
          presentReceivable(
            updated
          ),
      });
    } catch (error) {
      console.error(
        "Approve receivable error:",
        error
      );

      const message =
        getErrorMessage(error);

      if (
        message ===
        "RECEIVABLE_NOT_FOUND"
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Customer receivable not found.",
        });
      }

      if (
        message ===
        "RECEIVABLE_ALREADY_APPROVED"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Customer receivable is already approved.",
        });
      }

      if (
        message ===
        "RECEIVABLE_ALREADY_CLOSED"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Customer receivable is already closed.",
        });
      }

      if (
        message ===
        "RECEIVABLE_VOID"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Voided receivables cannot be approved.",
        });
      }

      if (
        message ===
        "RECEIVABLE_NOT_APPROVABLE"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Only pending standalone receivables can be approved.",
        });
      }

      if (
        message ===
        "RECEIVABLE_HAS_NO_BALANCE"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "A receivable with no outstanding balance cannot be approved.",
        });
      }

      if (
        message ===
        "INVOICE_REQUIRES_FINALIZATION"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "This invoice must be finalized through the Invoicing workflow before its receivable can be approved.",
        });
      }

      if (
        message ===
          "STANDARD_REVENUE_ACCOUNT_NOT_FOUND" ||
        message ===
          "STANDARD_REVENUE_ACCOUNT_INVALID" ||
        message ===
          "STANDARD_AR_ACCOUNT_NOT_FOUND" ||
        message ===
          "STANDARD_AR_ACCOUNT_INVALID"
      ) {
        return res.status(500).json({
          success: false,
          message:
            "The organization's standard accounting accounts are not configured correctly. No receivable was approved.",
        });
      }

      if (
        message ===
        "AR_RECOGNITION_JOURNAL_UNBALANCED"
      ) {
        return res.status(500).json({
          success: false,
          message:
            "The receivable recognition entry failed the double-entry balance check. No receivable was approved.",
        });
      }

      return res.status(500).json({
        success: false,
        message:
          "Failed to approve customer receivable.",
      });
    }
  };

/* =========================================================
   RECORD CUSTOMER PAYMENT

   Accounting:
      Dr Cash / Bank / M-Pesa
      Cr Accounts Receivable

   The AR row is locked with SELECT ... FOR UPDATE before
   the balance is read. This prevents two concurrent requests
   from both consuming the same outstanding balance.

   The payment journal, AR update, Invoice synchronization
   and audit trail are one database transaction.
========================================================= */

export const recordReceivablePayment =
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
        getReceivableId(req);

      if (!id) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid receivable ID.",
        });
      }

      const paymentAmount =
        parsePositiveAmount(
          req.body.amount
        );

      if (paymentAmount === null) {
        return res.status(400).json({
          success: false,
          message:
            "Payment amount must be greater than zero.",
        });
      }

      const paymentDate =
        req.body.paymentDate !==
        undefined
          ? parseDate(
              req.body.paymentDate
            )
          : new Date();

      if (!paymentDate) {
        return res.status(400).json({
          success: false,
          message:
            "A valid payment date is required.",
        });
      }

      const paymentReference =
        normalizeOptionalText(
          req.body.paymentReference
        );

      if (
        paymentReference &&
        paymentReference.length > 100
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Payment reference must not exceed 100 characters.",
        });
      }

      const notes =
        normalizeOptionalText(
          req.body.notes
        );

      const result =
        await prisma.$transaction(
          async (tx) => {
            /*
             * Lock the AR row before reading its balance.
             */
            const lockedRows =
              await tx.$queryRaw<
                Array<{ id: string }>
              >`
                SELECT "id"
                FROM "AccountsReceivable"
                WHERE "id" = ${id}
                  AND "organizationId" = ${organizationId}
                FOR UPDATE
              `;

            if (
              lockedRows.length === 0
            ) {
              throw new Error(
                "RECEIVABLE_NOT_FOUND"
              );
            }

            const existing =
              await tx.accountsReceivable.findFirst(
                {
                  where: {
                    id,
                    organizationId,
                  },
                }
              );

            if (!existing) {
              throw new Error(
                "RECEIVABLE_NOT_FOUND"
              );
            }

            if (
              existing.status ===
              RECEIVABLE_STATUS.VOID
            ) {
              throw new Error(
                "RECEIVABLE_VOID"
              );
            }

            if (
              existing.status !==
                RECEIVABLE_STATUS
                  .APPROVED &&
              existing.status !==
                RECEIVABLE_STATUS
                  .ACTIVE
            ) {
              throw new Error(
                "RECEIVABLE_NOT_APPROVED"
              );
            }

            /*
             * Serialize the payment-reference check across
             * different receivables in the same organization.
             */
            if (paymentReference) {
              await tx.$executeRaw`
                SELECT pg_advisory_xact_lock(
                  hashtextextended(
                    ${`AR-PAYMENT-REFERENCE-${organizationId}-${paymentReference}`},
                    0
                  )
                )
              `;

              const duplicatePayment =
                await tx.journalEntry.findFirst(
                  {
                    where: {
                      organizationId,
                      status: {
                        in: [
                          JOURNAL_STATUS
                            .POSTED,
                          JOURNAL_STATUS
                            .APPROVED,
                        ],
                      },
                      notes: {
                        contains:
                          `Payment Reference: ${paymentReference}`,
                      },
                    },
                    select: {
                      id: true,
                      reference: true,
                    },
                  }
                );

              if (duplicatePayment) {
                throw new Error(
                  "PAYMENT_REFERENCE_ALREADY_USED"
                );
              }
            }

            const outstandingBalance =
              roundMoney(
                toNumber(
                  existing.outstandingBalance
                )
              );

            if (
              outstandingBalance <=
              MONEY_TOLERANCE
            ) {
              throw new Error(
                "RECEIVABLE_ALREADY_PAID"
              );
            }

            if (
              paymentAmount >
              outstandingBalance +
                MONEY_TOLERANCE
            ) {
              throw new Error(
                "PAYMENT_EXCEEDS_BALANCE"
              );
            }

            const newBalance =
              roundMoney(
                Math.max(
                  0,
                  outstandingBalance -
                    paymentAmount
                )
              );

            const newPaymentStatus =
              getPaymentStatus(
                toNumber(
                  existing.amount
                ),
                newBalance
              );

            const paymentAccount =
              await resolvePaymentAccount(
                tx,
                organizationId,
                {
                  accountId:
                    req.body
                      .paymentAccountId,
                  accountCode:
                    req.body
                      .paymentAccountCode,
                }
              );

            const receivableAccount =
              await requireReceivableAccount(
                tx,
                organizationId
              );

            const journal =
              await createPaymentJournal(
                tx,
                {
                  organizationId,
                  invoiceNumber:
                    existing.invoiceNumber,
                  amount:
                    paymentAmount,
                  paymentAccountId:
                    paymentAccount.id,
                  receivableAccountId:
                    receivableAccount.id,
                  transactionDate:
                    paymentDate,
                  createdBy:
                    getUserId(req),
                  paymentReference,
                  notes,
                }
              );

            const nextStatus =
              newPaymentStatus ===
              PAYMENT_STATUS.PAID
                ? RECEIVABLE_STATUS
                    .CLOSED
                : RECEIVABLE_STATUS
                    .ACTIVE;

            const updated =
              await tx.accountsReceivable.update(
                {
                  where: { id },
                  data: {
                    outstandingBalance:
                      newBalance,
                    paymentStatus:
                      newPaymentStatus,
                    status:
                      nextStatus,
                  },
                }
              );

            /*
             * Invoice payment status is synchronized only
             * inside the same transaction.
             */
            const invoice =
              await tx.invoice.findFirst({
                where: {
                  organizationId,
                  invoiceNumber:
                    existing.invoiceNumber,
                },
                select: {
                  id: true,
                  status: true,
                },
              });

            if (invoice) {
              await tx.invoice.update({
                where: {
                  id: invoice.id,
                },
                data: {
                  paymentStatus:
                    newPaymentStatus,
                },
              });
            }

            await createAuditTrail(
              tx,
              organizationId,
              getUserId(req),
              "RECEIVABLE_PAYMENT_RECORDED",
              {
                receivableId:
                  existing.id,
                invoiceNumber:
                  existing.invoiceNumber,
                paymentAmount,
                previousOutstandingBalance:
                  outstandingBalance,
                newOutstandingBalance:
                  newBalance,
                paymentStatus:
                  newPaymentStatus,
                paymentReference:
                  paymentReference ||
                  null,
                paymentAccountId:
                  paymentAccount.id,
                paymentAccountCode:
                  paymentAccount.code,
                journalEntryId:
                  journal.id,
                journalReference:
                  journal.reference,
                paymentDate:
                  paymentDate.toISOString(),
              }
            );

            return {
              receivable:
                updated,
              journal,
              paymentAccount,
            };
          }
        );

      return res.status(200).json({
        success: true,
        message:
          result.receivable
            .paymentStatus ===
          PAYMENT_STATUS.PAID
            ? "Customer invoice paid in full."
            : "Customer payment recorded successfully.",
        receivable:
          presentReceivable(
            result.receivable
          ),
        payment: {
          amount:
            paymentAmount,
          paymentDate:
            paymentDate.toISOString(),
          paymentReference:
            paymentReference,
          paymentAccount: {
            id:
              result.paymentAccount
                .id,
            code:
              result.paymentAccount
                .code,
            name:
              result.paymentAccount
                .name,
          },
          journalEntry: {
            id:
              result.journal.id,
            reference:
              result.journal
                .reference,
            status:
              result.journal
                .status,
          },
        },
      });
    } catch (error) {
      console.error(
        "Record receivable payment error:",
        error
      );

      const message =
        getErrorMessage(error);

      if (
        message ===
        "RECEIVABLE_NOT_FOUND"
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Customer receivable not found.",
        });
      }

      if (
        message ===
        "RECEIVABLE_NOT_APPROVED"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Approve the receivable before recording a payment.",
        });
      }

      if (
        message ===
        "RECEIVABLE_ALREADY_PAID"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "This receivable is already fully paid.",
        });
      }

      if (
        message ===
        "PAYMENT_EXCEEDS_BALANCE"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Payment cannot exceed the outstanding balance.",
        });
      }

      if (
        message ===
        "PAYMENT_REFERENCE_ALREADY_USED"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "This payment reference has already been recorded for this organization.",
        });
      }

      if (
        message ===
        "RECEIVABLE_VOID"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Payments cannot be recorded against a void receivable.",
        });
      }

      if (
        message ===
        "PAYMENT_ACCOUNT_NOT_FOUND"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "The selected payment account was not found in this organization.",
        });
      }

      if (
        message ===
        "PAYMENT_ACCOUNT_MUST_BE_ASSET"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "The payment account must be an asset account such as bank, cash, or another approved cash-equivalent account.",
        });
      }

      if (
        message ===
        "PAYMENT_ACCOUNT_CANNOT_BE_AR"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Accounts Receivable cannot be used as the payment account.",
        });
      }

      if (
        message ===
        "PAYMENT_ACCOUNTS_NOT_FOUND"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "The accounting accounts required for this payment could not be found.",
        });
      }

      if (
        message ===
        "PAYMENT_ACCOUNTS_MUST_DIFFER"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "The payment account and Accounts Receivable account must be different.",
        });
      }

      if (
        message ===
        "PAYMENT_JOURNAL_UNBALANCED"
      ) {
        return res.status(500).json({
          success: false,
          message:
            "The payment accounting entry failed the double-entry balance check. No payment was posted.",
        });
      }

      return res.status(500).json({
        success: false,
        message:
          "Failed to record customer payment.",
      });
    }
  };

/* =========================================================
   DELETE RECEIVABLE

   Only pending standalone records may be deleted. Once an AR
   record participates in accounting, the record is preserved.
========================================================= */

export const deleteReceivable =
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
        getReceivableId(req);

      if (!id) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid receivable ID.",
        });
      }

      await prisma.$transaction(
        async (tx) => {
          const existing =
            await tx.accountsReceivable.findFirst(
              {
                where: {
                  id,
                  organizationId,
                },
              }
            );

          if (!existing) {
            throw new Error(
              "RECEIVABLE_NOT_FOUND"
            );
          }

          if (
            existing.status !==
            RECEIVABLE_STATUS.PENDING
          ) {
            throw new Error(
              "RECEIVABLE_NOT_DELETABLE"
            );
          }

          /*
           * Defensive check: a pending AR must never have an
           * accounting journal attached through the invoice
           * workflow.
           */
          const invoice =
            await tx.invoice.findFirst({
              where: {
                organizationId,
                invoiceNumber:
                  existing.invoiceNumber,
              },
              select: {
                id: true,
              },
            });

          if (invoice) {
            throw new Error(
              "INVOICE_OWNS_RECEIVABLE"
            );
          }

          await tx.accountsReceivable.delete(
            {
              where: { id },
            }
          );

          await createAuditTrail(
            tx,
            organizationId,
            getUserId(req),
            "RECEIVABLE_DELETED",
            {
              receivableId:
                existing.id,
              invoiceNumber:
                existing.invoiceNumber,
              amount:
                toNumber(
                  existing.amount
                ),
            }
          );
        }
      );

      return res.status(200).json({
        success: true,
        message:
          "Pending customer receivable deleted successfully.",
      });
    } catch (error) {
      console.error(
        "Delete receivable error:",
        error
      );

      const message =
        getErrorMessage(error);

      if (
        message ===
        "RECEIVABLE_NOT_FOUND"
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Customer receivable not found.",
        });
      }

      if (
        message ===
        "RECEIVABLE_NOT_DELETABLE"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Posted or approved receivables cannot be deleted. Use the appropriate accounting reversal or void workflow.",
        });
      }

      if (
        message ===
        "INVOICE_OWNS_RECEIVABLE"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "This receivable is owned by the Invoicing workflow and cannot be deleted from Accounts Receivable.",
        });
      }

      return res.status(500).json({
        success: false,
        message:
          "Failed to delete customer receivable.",
      });
    }
  };