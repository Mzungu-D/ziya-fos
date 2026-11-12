import { Response } from "express";
import {
  Account as PrismaAccount,
  Prisma,
} from "@prisma/client";

import prisma from "../config/prisma";
import { resolveRoleAccount, type RoleKey } from "../services/accountRoles.service";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   ACCOUNTS RECEIVABLE — PRODUCTION CONTROLLER

   Principles:
   - strict tenant isolation
   - double-entry accounting
   - atomic approval/payment workflows
   - posted accounting is immutable
   - controlled reversals are preferred over deletion
   - idempotent external payment references
   - tenant-owned accounting accounts
   - audit trail
   - server-side pagination/filtering
   - UTC-safe reporting dates
   ========================================================= */

/* "role:" values are resolved per organization (see accountRoles.service). */
const ACCOUNT_CODES = {
  ACCOUNTS_RECEIVABLE: "role:RECEIVABLE_CONTROL",
  DEFAULT_CASH_ACCOUNT: "role:DEFAULT_CASH",
  SALES_REVENUE: "role:SALES_REVENUE",
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
const MAX_TEXT_LENGTH = 500;
const MAX_REFERENCE_LENGTH = 100;
const MAX_CUSTOMER_BALANCE_ROWS = 500;
const EFFECTIVE_JOURNAL_STATUSES = [
  JOURNAL_STATUS.POSTED,
  JOURNAL_STATUS.APPROVED,
] as const;

const getOrganizationId = (req: AuthRequest): string | null => {
  const value = req.user?.organizationId?.trim();
  return value || null;
};

const getUserId = (req: AuthRequest): string => {
  const value = req.user?.userId?.trim();
  return value || "SYSTEM";
};

const getReceivableId = (req: AuthRequest): string | null => {
  const value = req.params.id;
  if (!value) return null;
  const id = Array.isArray(value) ? value[0] : value;
  return String(id).trim() || null;
};

const getIdempotencyKey = (req: AuthRequest): string | null => {
  const headerValue = req.headers["idempotency-key"];
  const header =
    Array.isArray(headerValue) ? headerValue[0] : headerValue;

  const raw =
    typeof req.body?.idempotencyKey === "string"
      ? req.body.idempotencyKey
      : typeof header === "string"
        ? header
        : "";

  const value = raw.trim();
  if (!value) return null;
  if (value.length > MAX_REFERENCE_LENGTH) return null;
  return value;
};

const normalizeText = (
  value: unknown,
  maxLength = MAX_TEXT_LENGTH
): string => {
  if (typeof value !== "string") return "";
  const result = value.trim();
  return result.length <= maxLength ? result : "";
};

const normalizeOptionalText = (
  value: unknown,
  maxLength = MAX_TEXT_LENGTH
): string | null => {
  const result = normalizeText(value, maxLength);
  return result || null;
};

const parseMoney = (value: unknown): number | null => {
  const raw =
    typeof value === "number"
      ? String(value)
      : typeof value === "string"
        ? value.trim().replace(/,/g, "")
        : "";

  if (!raw || !/^\d+(?:\.\d{1,2})?$/.test(raw)) {
    return null;
  }

  const amount = Number(raw);

  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 999999999999.99
  ) {
    return null;
  }

  return roundMoney(amount);
};

const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const toNumber = (value: unknown): number => {
  const number =
    typeof value === "bigint" ? Number(value) : Number(value ?? 0);

  return Number.isFinite(number) ? number : 0;
};

const parseDate = (
  value: unknown,
  endOfDay = false
): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value);
  }

  if (typeof value !== "string") return null;

  const raw = value.trim();
  if (!raw) return null;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);

  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);

    const candidate = new Date(
      Date.UTC(
        year,
        month - 1,
        day,
        endOfDay ? 23 : 0,
        endOfDay ? 59 : 0,
        endOfDay ? 59 : 0,
        endOfDay ? 999 : 0
      )
    );

    if (
      candidate.getUTCFullYear() !== year ||
      candidate.getUTCMonth() !== month - 1 ||
      candidate.getUTCDate() !== day
    ) {
      return null;
    }

    return candidate;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getStartOfUtcDay = (date: Date): Date => {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  return result;
};

const getPaymentStatus = (
  originalAmount: number,
  outstandingBalance: number
): string => {
  const original = roundMoney(Math.max(0, originalAmount));
  const outstanding = roundMoney(Math.max(0, outstandingBalance));

  if (outstanding <= MONEY_TOLERANCE) {
    return PAYMENT_STATUS.PAID;
  }

  if (outstanding < original - MONEY_TOLERANCE) {
    return PAYMENT_STATUS.PARTIALLY_PAID;
  }

  return PAYMENT_STATUS.UNPAID;
};

const parsePagination = (
  pageValue: unknown,
  limitValue: unknown
):
  | { page: number; limit: number; skip: number }
  | { error: string } => {
  const pageRaw =
    pageValue === undefined || pageValue === ""
      ? String(DEFAULT_PAGE)
      : String(pageValue).trim();

  const limitRaw =
    limitValue === undefined || limitValue === ""
      ? String(DEFAULT_LIMIT)
      : String(limitValue).trim();

  if (!/^\d+$/.test(pageRaw) || !/^\d+$/.test(limitRaw)) {
    return { error: "Invalid pagination parameters." };
  }

  const page = Number(pageRaw);
  const limit = Number(limitRaw);

  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > MAX_LIMIT
  ) {
    return { error: "Invalid pagination parameters." };
  }

  const skip = (page - 1) * limit;

  if (!Number.isSafeInteger(skip)) {
    return { error: "Pagination range is too large." };
  }

  return { page, limit, skip };
};

const getSearch = (value: unknown): string | null => {
  if (value === undefined || value === "") return "";
  if (typeof value !== "string") return null;

  const search = value.trim();
  if (search.length > MAX_TEXT_LENGTH) return null;

  return search;
};

const normalizeStatusFilter = (
  value: unknown,
  allowed: readonly string[]
): string | null | "INVALID" => {
  if (value === undefined || value === "") return null;
  if (typeof value !== "string") return "INVALID";

  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;

  return allowed.includes(normalized) ? normalized : "INVALID";
};

const isEffectivelyZero = (value: number): boolean =>
  Math.abs(value) <= MONEY_TOLERANCE;

const getAgingBucket = (daysOverdue: number): string => {
  if (daysOverdue <= 0) return "CURRENT";
  if (daysOverdue <= 30) return "1_30_DAYS";
  if (daysOverdue <= 60) return "31_60_DAYS";
  if (daysOverdue <= 90) return "61_90_DAYS";
  return "90_PLUS_DAYS";
};

const presentReceivable = <
  T extends {
    dueDate: Date;
    outstandingBalance: number;
  }
>(
  receivable: T,
  asOfDate: Date
) => {
  const due = getStartOfUtcDay(new Date(receivable.dueDate));
  const asOf = getStartOfUtcDay(new Date(asOfDate));
  const outstanding = roundMoney(toNumber(receivable.outstandingBalance));
  const isOverdue =
    outstanding > MONEY_TOLERANCE && due.getTime() < asOf.getTime();

  return {
    ...receivable,
    isOverdue,
    daysOverdue: isOverdue
      ? Math.floor(
          (asOf.getTime() - due.getTime()) / 86400000
        )
      : 0,
    agingBucket: getAgingBucket(
      isOverdue
        ? Math.floor(
            (asOf.getTime() - due.getTime()) / 86400000
          )
        : 0
    ),
  };
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isPrismaUniqueError = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
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
      module: "ACCOUNTS_RECEIVABLE",
      details: JSON.stringify(details),
    },
  });
};

/* =========================================================
   ACCOUNT RESOLUTION
   ========================================================= */

const getTenantAccountById = async (
  tx: Prisma.TransactionClient,
  organizationId: string,
  accountId: string
): Promise<PrismaAccount | null> =>
  tx.account.findFirst({
    where: { id: accountId, organizationId },
  });

const getTenantAccountByCode = async (
  tx: Prisma.TransactionClient,
  organizationId: string,
  code: string
): Promise<PrismaAccount | null> =>
  code.startsWith("role:")
    ? resolveRoleAccount(tx, organizationId, code.slice(5) as RoleKey)
    : tx.account.findFirst({
        where: { organizationId, code },
      });

const requireReceivableAccount = async (
  tx: Prisma.TransactionClient,
  organizationId: string
): Promise<PrismaAccount> => {
  const account = await getTenantAccountByCode(
    tx,
    organizationId,
    ACCOUNT_CODES.ACCOUNTS_RECEIVABLE
  );

  if (!account) throw new Error("STANDARD_AR_ACCOUNT_NOT_FOUND");
  if (account.type !== "ASSET") {
    throw new Error("STANDARD_AR_ACCOUNT_INVALID");
  }

  return account;
};

const resolveRevenueAccount = async (
  tx: Prisma.TransactionClient,
  organizationId: string,
  input: { accountId?: unknown; accountCode?: unknown }
): Promise<PrismaAccount> => {
  let account: PrismaAccount | null = null;

  const accountId = normalizeOptionalText(input.accountId, 100);
  const accountCode = normalizeOptionalText(input.accountCode, 50);

  if (accountId) {
    account = await getTenantAccountById(
      tx,
      organizationId,
      accountId
    );
  } else if (accountCode) {
    account = await getTenantAccountByCode(
      tx,
      organizationId,
      accountCode
    );
  } else {
    account = await getTenantAccountByCode(
      tx,
      organizationId,
      ACCOUNT_CODES.SALES_REVENUE
    );
  }

  if (!account) throw new Error("REVENUE_ACCOUNT_NOT_FOUND");
  if (account.type !== "INCOME") {
    throw new Error("REVENUE_ACCOUNT_INVALID");
  }

  return account;
};

const resolvePaymentAccount = async (
  tx: Prisma.TransactionClient,
  organizationId: string,
  input: { accountId?: unknown; accountCode?: unknown }
): Promise<PrismaAccount> => {
  const accountId = normalizeOptionalText(input.accountId, 100);
  const accountCode = normalizeOptionalText(input.accountCode, 50);

  let account: PrismaAccount | null = null;

  if (accountId) {
    account = await getTenantAccountById(
      tx,
      organizationId,
      accountId
    );
  } else if (accountCode) {
    account = await getTenantAccountByCode(
      tx,
      organizationId,
      accountCode
    );
  } else {
    account = await getTenantAccountByCode(
      tx,
      organizationId,
      ACCOUNT_CODES.DEFAULT_CASH_ACCOUNT
    );
  }

  if (!account) throw new Error("PAYMENT_ACCOUNT_NOT_FOUND");
  if (account.type !== "ASSET") {
    throw new Error("PAYMENT_ACCOUNT_MUST_BE_ASSET");
  }

  if (account.subtype === "RECEIVABLE_CONTROL") {
    throw new Error("PAYMENT_ACCOUNT_CANNOT_BE_AR");
  }

  return account;
};

/* =========================================================
   JOURNAL REFERENCES
   ========================================================= */

const generateSequentialReference = async (
  tx: Prisma.TransactionClient,
  organizationId: string,
  prefix: string,
  lockPrefix: string
): Promise<string> => {
  const year = new Date().getUTCFullYear();

  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended(
        ${`${lockPrefix}-${organizationId}-${year}`},
        0
      )
    )
  `;

  const fullPrefix = `${prefix}${year}-`;

  const latest = await tx.journalEntry.findFirst({
    where: {
      organizationId,
      reference: { startsWith: fullPrefix },
    },
    select: { reference: true },
    orderBy: { reference: "desc" },
  });

  const parsed = latest?.reference
    ? Number(latest.reference.slice(fullPrefix.length))
    : 0;

  const next =
    Number.isSafeInteger(parsed) && parsed >= 0
      ? parsed + 1
      : 1;

  return `${fullPrefix}${String(next).padStart(6, "0")}`;
};

/* =========================================================
   PAYMENT HISTORY
   ========================================================= */

const getReceivablePaymentHistory = async (
  organizationId: string,
  invoiceNumber: string
) => {
  const journals = await prisma.journalEntry.findMany({
    where: {
      organizationId,
      status: {
        in: [
          JOURNAL_STATUS.POSTED,
          JOURNAL_STATUS.APPROVED,
        ],
      },
      reference: { startsWith: "AR-PAY-" },
      description: {
        contains: invoiceNumber,
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
        journal.debitAccount.organizationId === organizationId &&
        journal.creditAccount.organizationId === organizationId
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
      idempotencyKey:
        journal.notes
          ?.match(/Idempotency-Key:\s*([^|]+)/i)?.[1]
          ?.trim() ?? null,
      notes: journal.notes,
      paymentAccount: journal.debitAccount,
      receivableAccount: journal.creditAccount,
    }));
};

const assertBalancedJournal = (
  lines: Array<{ debit: unknown; credit: unknown }>,
  errorCode: string
): void => {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw new Error(errorCode);
  }

  let debitTotal = 0;
  let creditTotal = 0;

  for (const line of lines) {
    const debit = toNumber(line.debit);
    const credit = toNumber(line.credit);

    if (
      !Number.isFinite(debit) ||
      !Number.isFinite(credit) ||
      debit < 0 ||
      credit < 0 ||
      (debit > MONEY_TOLERANCE && credit > MONEY_TOLERANCE) ||
      (debit <= MONEY_TOLERANCE && credit <= MONEY_TOLERANCE)
    ) {
      throw new Error(errorCode);
    }

    debitTotal += debit;
    creditTotal += credit;
  }

  if (!isEffectivelyZero(roundMoney(debitTotal) - roundMoney(creditTotal))) {
    throw new Error(errorCode);
  }
};

const getReceivableWriteOffAmount = async (
  organizationId: string,
  invoiceNumber: string
): Promise<number> => {
  const rows = await prisma.journalEntry.findMany({
    where: {
      organizationId,
      status: { in: [...EFFECTIVE_JOURNAL_STATUSES] },
      reference: { startsWith: "AR-WO-" },
      description: {
        contains: invoiceNumber,
      },
    },
    select: { amount: true },
  });

  return roundMoney(
    rows.reduce(
      (sum, row) => sum + toNumber(row.amount),
      0
    )
  );
};

const getReceivableGlReconciliation = async (
  organizationId: string,
  invoiceNumber: string,
  outstandingBalance: number
) => {
  const arAccount = await resolveRoleAccount(prisma, organizationId, "RECEIVABLE_CONTROL");

  if (!arAccount) {
    return {
      reconciled: false,
      arAccount: null,
      glBalance: null,
      subledgerBalance: roundMoney(outstandingBalance),
      difference: null,
      journalCount: 0,
    };
  }

  const journals = await prisma.journalEntry.findMany({
    where: {
      organizationId,
      status: { in: [...EFFECTIVE_JOURNAL_STATUSES] },
      AND: [
        {
          OR: [
            { description: { contains: invoiceNumber } },
            { notes: { contains: invoiceNumber } },
          ],
        },
        {
          OR: [
            { debitAccountId: arAccount.id },
            { creditAccountId: arAccount.id },
          ],
        },
      ],
    },
    select: {
      id: true,
      debitAccountId: true,
      creditAccountId: true,
      amount: true,
      lines: {
        select: {
          accountId: true,
          debit: true,
          credit: true,
        },
      },
    },
  });

  let glBalance = 0;

  for (const journal of journals) {
    for (const line of journal.lines) {
      if (line.accountId !== arAccount.id) continue;
      glBalance += toNumber(line.debit) - toNumber(line.credit);
    }
  }

  const roundedGlBalance = roundMoney(glBalance);
  const subledgerBalance = roundMoney(outstandingBalance);
  const difference = roundMoney(subledgerBalance - roundedGlBalance);

  return {
    reconciled: Math.abs(difference) <= MONEY_TOLERANCE,
    arAccount,
    glBalance: roundedGlBalance,
    subledgerBalance,
    difference,
    journalCount: journals.length,
  };
};

const findIdempotentPayment = async (
  tx: Prisma.TransactionClient,
  organizationId: string,
  invoiceNumber: string,
  paymentReference: string | null,
  idempotencyKey: string,
  requestedAmount: number
) => {
  const candidates = await tx.journalEntry.findMany({
    where: {
      organizationId,
      status: { in: [...EFFECTIVE_JOURNAL_STATUSES] },
      reference: { startsWith: "AR-PAY-" },
      description: `Customer payment - ${invoiceNumber}`,
      notes: { contains: `Idempotency-Key: ${idempotencyKey}` },
    },
    select: {
      id: true,
      reference: true,
      amount: true,
      notes: true,
      transactionDate: true,
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
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const exact = candidates.find(
    (candidate) =>
      candidate.notes
        ?.match(/Idempotency-Key:\s*([^|]+)/i)?.[1]
        ?.trim() === idempotencyKey
  );

  if (!exact) return null;

  const storedPaymentReference =
    exact.notes
      ?.match(/Payment Reference:\s*([^|]+)/i)?.[1]
      ?.trim() ?? null;

  if (
    paymentReference !== storedPaymentReference ||
    !isEffectivelyZero(
      roundMoney(toNumber(exact.amount)) -
        roundMoney(requestedAmount)
    )
  ) {
    return {
      conflict: true,
      journal: exact,
      storedPaymentReference,
    };
  }

  return {
    conflict: false,
    journal: exact,
    storedPaymentReference,
  };
};

/* =========================================================
   CREATE PAYMENT JOURNAL
   ========================================================= */

const createPaymentJournal = async (
  tx: Prisma.TransactionClient,
  params: {
    organizationId: string;
    invoiceNumber: string;
    amount: number;
    paymentAccountId: string;
    receivableAccountId: string;
    transactionDate: Date;
    createdBy: string;
    paymentReference?: string | null;
    idempotencyKey: string;
    notes?: string | null;
  }
) => {
  const amount = roundMoney(params.amount);

  if (amount <= 0) {
    throw new Error("INVALID_PAYMENT_AMOUNT");
  }

  const paymentAccount = await getTenantAccountById(
    tx,
    params.organizationId,
    params.paymentAccountId
  );

  const receivableAccount = await getTenantAccountById(
    tx,
    params.organizationId,
    params.receivableAccountId
  );

  if (!paymentAccount || !receivableAccount) {
    throw new Error("PAYMENT_ACCOUNTS_NOT_FOUND");
  }

  if (paymentAccount.type !== "ASSET") {
    throw new Error("PAYMENT_ACCOUNT_MUST_BE_ASSET");
  }

  if (receivableAccount.type !== "ASSET") {
    throw new Error("RECEIVABLE_ACCOUNT_MUST_BE_ASSET");
  }

  if (paymentAccount.id === receivableAccount.id) {
    throw new Error("PAYMENT_ACCOUNTS_MUST_DIFFER");
  }

  const reference = await generateSequentialReference(
    tx,
    params.organizationId,
    "AR-PAY-",
    "AR-PAYMENT"
  );

  const notes = [
    `AR payment for invoice ${params.invoiceNumber}`,
    params.paymentReference
      ? `Payment Reference: ${params.paymentReference}`
      : null,
    `Idempotency-Key: ${params.idempotencyKey}`,
    params.notes ?? null,
  ]
    .filter(Boolean)
    .join(" | ");

  const journal = await tx.journalEntry.create({
    data: {
      reference,
      description:
        `Customer payment - ${params.invoiceNumber}`,
      debitAccountId: paymentAccount.id,
      creditAccountId: receivableAccount.id,
      amount,
      createdBy: params.createdBy,
      transactionDate: params.transactionDate,
      organizationId: params.organizationId,
      status: JOURNAL_STATUS.POSTED,
      postedAt: params.transactionDate,
      postedBy: params.createdBy,
      notes,
      lines: {
        create: [
          {
            accountId: paymentAccount.id,
            lineNumber: 1,
            memo:
              `Customer payment received - ${params.invoiceNumber}`,
            debit: amount,
            credit: 0,
          },
          {
            accountId: receivableAccount.id,
            lineNumber: 2,
            memo:
              `Settlement of accounts receivable - ${params.invoiceNumber}`,
            debit: 0,
            credit: amount,
          },
        ],
      },
    },
    include: { lines: true },
  });

  assertBalancedJournal(
    journal.lines,
    "PAYMENT_JOURNAL_UNBALANCED"
  );

  return journal;
};

/* =========================================================
   CREATE RECEIVABLE
   ========================================================= */

export const createReceivable = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const invoiceNumber = normalizeText(
      req.body?.invoiceNumber,
      MAX_REFERENCE_LENGTH
    );
    const customerName = normalizeText(
      req.body?.customerName
    );
    const description = normalizeText(
      req.body?.description
    );
    const amount = parseMoney(req.body?.amount);
    const dueDate = parseDate(req.body?.dueDate);

    if (!invoiceNumber) {
      return res.status(400).json({
        success: false,
        message: "Invoice number is required.",
      });
    }

    if (!customerName || !description) {
      return res.status(400).json({
        success: false,
        message:
          "Customer name and description are required.",
      });
    }

    if (amount === null) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than zero.",
      });
    }

    if (!dueDate) {
      return res.status(400).json({
        success: false,
        message: "A valid due date is required.",
      });
    }

    const receivable = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.accountsReceivable.findFirst({
          where: { organizationId, invoiceNumber },
          select: { id: true },
        });

        if (existing) {
          throw new Error("RECEIVABLE_ALREADY_EXISTS");
        }

        const existingInvoice = await tx.invoice.findFirst({
          where: { organizationId, invoiceNumber },
          select: { id: true, status: true },
        });

        if (existingInvoice) {
          throw new Error(
            "INVOICE_ALREADY_EXISTS_USE_INVOICE_WORKFLOW"
          );
        }

        const created = await tx.accountsReceivable.create({
          data: {
            organizationId,
            invoiceNumber,
            customerName,
            description,
            amount,
            outstandingBalance: amount,
            dueDate,
            paymentStatus: PAYMENT_STATUS.UNPAID,
            status: RECEIVABLE_STATUS.PENDING,
          },
        });

        await createAuditTrail(
          tx,
          organizationId,
          getUserId(req),
          "RECEIVABLE_CREATED",
          {
            receivableId: created.id,
            invoiceNumber,
            amount,
            dueDate: dueDate.toISOString(),
            workflow: "STANDALONE_AR",
          }
        );

        return created;
      }
    );

    return res.status(201).json({
      success: true,
      message: "Customer receivable created successfully.",
      receivable: presentReceivable(
        receivable,
        new Date()
      ),
    });
  } catch (error) {
    const message = getErrorMessage(error);

    if (message === "RECEIVABLE_ALREADY_EXISTS") {
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

    if (isPrismaUniqueError(error)) {
      return res.status(409).json({
        success: false,
        message:
          "A receivable with this invoice number already exists in this organization.",
      });
    }

    console.error("Create receivable error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create customer receivable.",
    });
  }
};

/* =========================================================
   GET RECEIVABLES
   ========================================================= */

export const getReceivables = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const pagination = parsePagination(
      req.query.page,
      req.query.limit
    );

    if ("error" in pagination) {
      return res.status(400).json({
        success: false,
        message: pagination.error,
      });
    }

    const search = getSearch(req.query.search);

    if (search === null) {
      return res.status(400).json({
        success: false,
        message: "Invalid or excessively long search parameter.",
      });
    }

    const status = normalizeStatusFilter(
      req.query.status,
      Object.values(RECEIVABLE_STATUS)
    );

    const paymentStatus = normalizeStatusFilter(
      req.query.paymentStatus,
      Object.values(PAYMENT_STATUS)
    );

    if (status === "INVALID" || paymentStatus === "INVALID") {
      return res.status(400).json({
        success: false,
        message: "Invalid status filter.",
      });
    }

    const asOfDate =
      req.query.asOfDate !== undefined
        ? parseDate(req.query.asOfDate, true)
        : new Date();

    if (!asOfDate) {
      return res.status(400).json({
        success: false,
        message: "A valid asOfDate is required when supplied.",
      });
    }

    const baseFilters: Prisma.AccountsReceivableWhereInput = {
      organizationId,
      ...(status ? { status } : {}),
      ...(paymentStatus ? { paymentStatus } : {}),
      ...(search
        ? {
            OR: [
              {
                invoiceNumber: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                customerName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                description: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    };

    const overdueWhere: Prisma.AccountsReceivableWhereInput = {
      ...baseFilters,
      dueDate: {
        lt: getStartOfUtcDay(asOfDate),
      },
      outstandingBalance: {
        gt: MONEY_TOLERANCE,
      },
    };

    const [
      totalRecords,
      receivables,
      summary,
      overdueCount,
      overdueSummary,
      agingRows,
      customerBalanceRows,
    ] = await prisma.$transaction([
      prisma.accountsReceivable.count({
        where: baseFilters,
      }),
      prisma.accountsReceivable.findMany({
        where: baseFilters,
        orderBy: [
          { dueDate: "asc" },
          { createdAt: "desc" },
          { id: "asc" },
        ],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.accountsReceivable.aggregate({
        where: baseFilters,
        _sum: {
          amount: true,
          outstandingBalance: true,
        },
      }),
      prisma.accountsReceivable.count({
        where: overdueWhere,
      }),
      prisma.accountsReceivable.aggregate({
        where: overdueWhere,
        _sum: {
          outstandingBalance: true,
        },
      }),
      prisma.accountsReceivable.findMany({
        where: baseFilters,
        select: { dueDate: true, outstandingBalance: true },
      }),
      prisma.accountsReceivable.groupBy({
        by: ["customerName"],
        where: baseFilters,
        _sum: {
          amount: true,
          outstandingBalance: true,
        },
        _count: {
          _all: true,
        },
        orderBy: {
          _sum: {
            outstandingBalance: "desc",
          },
        },
        take: MAX_CUSTOMER_BALANCE_ROWS,
      }),
    ]);

    const aging = {
      CURRENT: 0,
      "1_30_DAYS": 0,
      "31_60_DAYS": 0,
      "61_90_DAYS": 0,
      "90_PLUS_DAYS": 0,
    } as Record<string, number>;

    for (const row of agingRows) {
      const due = getStartOfUtcDay(new Date(row.dueDate));
      const asOf = getStartOfUtcDay(asOfDate);
      const daysOverdue =
        due.getTime() < asOf.getTime()
          ? Math.floor((asOf.getTime() - due.getTime()) / 86400000)
          : 0;
      const balance = roundMoney(toNumber(row.outstandingBalance));
      if (balance <= MONEY_TOLERANCE) continue;
      const bucket = getAgingBucket(daysOverdue);
      aging[bucket] = roundMoney((aging[bucket] ?? 0) + balance);
    }

    const customerBalances = customerBalanceRows
      .map((row) => ({
        customerName: row.customerName,
        invoiceCount: row._count._all,
        totalAmount: roundMoney(
          toNumber(row._sum.amount)
        ),
        outstandingBalance: roundMoney(
          toNumber(row._sum.outstandingBalance)
        ),
      }))
      .sort(
        (a, b) =>
          b.outstandingBalance - a.outstandingBalance
      );

    const totalPages =
      totalRecords === 0
        ? 0
        : Math.ceil(totalRecords / pagination.limit);

    const presented = receivables.map((item) =>
      presentReceivable(item, asOfDate)
    );

    return res.status(200).json({
      success: true,
      count: presented.length,
      receivables: presented,
      summary: {
        totalAmount: roundMoney(
          toNumber(summary._sum.amount)
        ),
        totalOutstandingBalance: roundMoney(
          toNumber(summary._sum.outstandingBalance)
        ),
        overdueCount,
        overdueOutstandingBalance: roundMoney(
          toNumber(
            overdueSummary._sum.outstandingBalance
          )
        ),
        overdueExposure: roundMoney(
          toNumber(
            overdueSummary._sum.outstandingBalance
          )
        ),
        aging,
        customerBalances,
        customerBalanceCount: customerBalanceRows.length,
        customerBalanceTruncated:
          customerBalanceRows.length >=
          MAX_CUSTOMER_BALANCE_ROWS,
      },
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        totalRecords,
        totalPages,
        hasNextPage: pagination.page < totalPages,
        hasPreviousPage:
          pagination.page > 1 && totalPages > 0,
      },
      meta: {
        organizationId,
        currency: "KES",
        filters: {
          search: search || null,
          status: status || null,
          paymentStatus: paymentStatus || null,
          asOfDate: asOfDate.toISOString(),
        },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Fetch receivables error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch customer receivables.",
    });
  }
};

/* =========================================================
   GET SINGLE RECEIVABLE
   ========================================================= */

export const getReceivableById = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const id = getReceivableId(req);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid receivable ID.",
      });
    }

    const asOfDate =
      req.query.asOfDate !== undefined
        ? parseDate(req.query.asOfDate, true)
        : new Date();

    if (!asOfDate) {
      return res.status(400).json({
        success: false,
        message: "A valid asOfDate is required when supplied.",
      });
    }

    const receivable =
      await prisma.accountsReceivable.findFirst({
        where: { id, organizationId },
      });

    if (!receivable) {
      return res.status(404).json({
        success: false,
        message: "Customer receivable not found.",
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

    const writeOffAmount =
      await getReceivableWriteOffAmount(
        organizationId,
        receivable.invoiceNumber
      );

    const expectedPaymentAllocation = roundMoney(
      Math.max(
        0,
        toNumber(receivable.amount) -
          toNumber(receivable.outstandingBalance) -
          writeOffAmount
      )
    );

    const reconciliationDifference = roundMoney(
      recordedPayments - expectedPaymentAllocation
    );

    const glReconciliation =
      await getReceivableGlReconciliation(
        organizationId,
        receivable.invoiceNumber,
        receivable.status === RECEIVABLE_STATUS.VOID
          ? 0
          : toNumber(receivable.outstandingBalance)
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
        expectedPayments: expectedPaymentAllocation,
        writeOffAmount,
        reconciliationDifference,
        reconciled:
          Math.abs(reconciliationDifference) <=
          MONEY_TOLERANCE,
        allocationBasis:
          "AR_RECEIVABLE_OUTSTANDING_AND_WRITE_OFFS",
      },
      glReconciliation,
    });
  } catch (error) {
    console.error("Fetch receivable error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch customer receivable.",
    });
  }
};

/* =========================================================
   UPDATE RECEIVABLE
   ========================================================= */

export const updateReceivable = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const id = getReceivableId(req);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid receivable ID.",
      });
    }

    const customerName = normalizeText(
      req.body?.customerName
    );
    const description = normalizeText(
      req.body?.description
    );
    const amount = parseMoney(req.body?.amount);
    const dueDate = parseDate(req.body?.dueDate);

    if (!customerName || !description || amount === null || !dueDate) {
      return res.status(400).json({
        success: false,
        message:
          "Customer name, description, amount and valid due date are required.",
      });
    }

    const updated = await prisma.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<
          Array<{ id: string }>
        >`
          SELECT "id"
          FROM "AccountsReceivable"
          WHERE "id" = ${id}
            AND "organizationId" = ${organizationId}
          FOR UPDATE
        `;

        if (!locked.length) {
          throw new Error("RECEIVABLE_NOT_FOUND");
        }

        const existing =
          await tx.accountsReceivable.findFirst({
            where: { id, organizationId },
          });

        if (!existing) {
          throw new Error("RECEIVABLE_NOT_FOUND");
        }

        if (existing.status !== RECEIVABLE_STATUS.PENDING) {
          throw new Error("RECEIVABLE_NOT_EDITABLE");
        }

        const invoice = await tx.invoice.findFirst({
          where: {
            organizationId,
            invoiceNumber: existing.invoiceNumber,
          },
          select: { id: true },
        });

        if (invoice) {
          throw new Error("INVOICE_OWNS_RECEIVABLE");
        }

        const result = await tx.accountsReceivable.update({
          where: { id },
          data: {
            customerName,
            description,
            amount,
            outstandingBalance: amount,
            dueDate,
            paymentStatus: PAYMENT_STATUS.UNPAID,
          },
        });

        await createAuditTrail(
          tx,
          organizationId,
          getUserId(req),
          "RECEIVABLE_UPDATED",
          {
            receivableId: id,
            invoiceNumber: existing.invoiceNumber,
            previousAmount: toNumber(existing.amount),
            newAmount: amount,
            previousDueDate: existing.dueDate.toISOString(),
            newDueDate: dueDate.toISOString(),
          }
        );

        return result;
      }
    );

    return res.status(200).json({
      success: true,
      message: "Customer receivable updated successfully.",
      receivable: presentReceivable(
        updated,
        new Date()
      ),
    });
  } catch (error) {
    const message = getErrorMessage(error);

    if (message === "RECEIVABLE_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Customer receivable not found.",
      });
    }

    if (message === "RECEIVABLE_NOT_EDITABLE") {
      return res.status(409).json({
        success: false,
        message:
          "Only pending receivables can be edited.",
      });
    }

    if (message === "INVOICE_OWNS_RECEIVABLE") {
      return res.status(409).json({
        success: false,
        message:
          "This receivable is owned by the Invoicing workflow and cannot be edited from Accounts Receivable.",
      });
    }

    console.error("Update receivable error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update customer receivable.",
    });
  }
};

/* =========================================================
   APPROVE RECEIVABLE
   ========================================================= */

export const approveReceivable = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId = getOrganizationId(req);
    const userId = getUserId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const id = getReceivableId(req);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid receivable ID.",
      });
    }

    const updated = await prisma.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<
          Array<{ id: string }>
        >`
          SELECT "id"
          FROM "AccountsReceivable"
          WHERE "id" = ${id}
            AND "organizationId" = ${organizationId}
          FOR UPDATE
        `;

        if (!locked.length) {
          throw new Error("RECEIVABLE_NOT_FOUND");
        }

        const existing =
          await tx.accountsReceivable.findFirst({
            where: { id, organizationId },
          });

        if (!existing) {
          throw new Error("RECEIVABLE_NOT_FOUND");
        }

        if (
          existing.status === RECEIVABLE_STATUS.APPROVED ||
          existing.status === RECEIVABLE_STATUS.ACTIVE
        ) {
          throw new Error("RECEIVABLE_ALREADY_APPROVED");
        }

        if (existing.status === RECEIVABLE_STATUS.CLOSED) {
          throw new Error("RECEIVABLE_ALREADY_CLOSED");
        }

        if (existing.status === RECEIVABLE_STATUS.VOID) {
          throw new Error("RECEIVABLE_VOID");
        }

        if (existing.status !== RECEIVABLE_STATUS.PENDING) {
          throw new Error("RECEIVABLE_NOT_APPROVABLE");
        }

        if (
          toNumber(existing.outstandingBalance) <=
          MONEY_TOLERANCE
        ) {
          throw new Error("RECEIVABLE_HAS_NO_BALANCE");
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
              invoiceNumber: existing.invoiceNumber,
            },
            select: { id: true, status: true },
          });

        if (
          existingInvoice &&
          existingInvoice.status !== "POSTED"
        ) {
          throw new Error("INVOICE_REQUIRES_FINALIZATION");
        }

        let recognitionJournalId: string | null = null;

        if (!existingInvoice) {
          const revenueAccount =
            await resolveRevenueAccount(
              tx,
              organizationId,
              {
                accountId:
                  req.body?.revenueAccountId,
                accountCode:
                  req.body?.revenueAccountCode,
              }
            );

          const amount = parseMoney(existing.amount);

          if (amount === null) {
            throw new Error("INVALID_RECEIVABLE_AMOUNT");
          }

          const reference =
            await generateSequentialReference(
              tx,
              organizationId,
              "AR-REC-",
              "AR-RECOGNITION"
            );

          const journal =
            await tx.journalEntry.create({
              data: {
                reference,
                description:
                  `Accounts receivable recognition - ${existing.invoiceNumber}`,
                debitAccountId: receivableAccount.id,
                creditAccountId: revenueAccount.id,
                amount,
                createdBy: userId,
                transactionDate: new Date(),
                organizationId,
                status: JOURNAL_STATUS.POSTED,
                postedAt: new Date(),
                postedBy: userId,
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
              include: { lines: true },
            });

          assertBalancedJournal(
            journal.lines,
            "AR_RECOGNITION_JOURNAL_UNBALANCED"
          );

          recognitionJournalId = journal.id;
        }

        const result =
          await tx.accountsReceivable.update({
            where: { id },
            data: {
              status: RECEIVABLE_STATUS.APPROVED,
              approvedBy: userId,
            },
          });

        await createAuditTrail(
          tx,
          organizationId,
          userId,
          "RECEIVABLE_APPROVED",
          {
            receivableId: id,
            invoiceNumber: existing.invoiceNumber,
            amount: toNumber(existing.amount),
            recognitionJournalId,
            accountingTreatment: existingInvoice
              ? "INVOICE_FINALIZATION"
              : "STANDALONE_AR_RECOGNITION",
          }
        );

        return result;
      }
    );

    return res.status(200).json({
      success: true,
      message: "Customer receivable approved successfully.",
      receivable: presentReceivable(
        updated,
        new Date()
      ),
    });
  } catch (error) {
    const message = getErrorMessage(error);

    const errors: Record<
      string,
      { status: number; message: string }
    > = {
      RECEIVABLE_NOT_FOUND: {
        status: 404,
        message: "Customer receivable not found.",
      },
      RECEIVABLE_ALREADY_APPROVED: {
        status: 409,
        message: "Customer receivable is already approved.",
      },
      RECEIVABLE_ALREADY_CLOSED: {
        status: 409,
        message: "Customer receivable is already closed.",
      },
      RECEIVABLE_VOID: {
        status: 409,
        message: "Voided receivables cannot be approved.",
      },
      RECEIVABLE_NOT_APPROVABLE: {
        status: 409,
        message: "Only pending receivables can be approved.",
      },
      RECEIVABLE_HAS_NO_BALANCE: {
        status: 409,
        message:
          "A receivable with no outstanding balance cannot be approved.",
      },
      INVOICE_REQUIRES_FINALIZATION: {
        status: 409,
        message:
          "This invoice must be finalized through the Invoicing workflow before its receivable can be approved.",
      },
      STANDARD_AR_ACCOUNT_NOT_FOUND: {
        status: 500,
        message:
          "The organization's Accounts Receivable account is not configured.",
      },
      STANDARD_AR_ACCOUNT_INVALID: {
        status: 500,
        message:
          "The organization's Accounts Receivable account is incorrectly configured.",
      },
      REVENUE_ACCOUNT_NOT_FOUND: {
        status: 400,
        message:
          "The selected revenue account could not be found for this tenant.",
      },
      REVENUE_ACCOUNT_INVALID: {
        status: 400,
        message:
          "The selected revenue account must be an income account belonging to this tenant.",
      },
      INVALID_RECEIVABLE_AMOUNT: {
        status: 409,
        message:
          "The receivable amount is invalid.",
      },
      AR_RECOGNITION_JOURNAL_UNBALANCED: {
        status: 500,
        message:
          "The receivable recognition entry failed the double-entry balance check. No receivable was approved.",
      },
    };

    if (errors[message]) {
      return res.status(errors[message].status).json({
        success: false,
        message: errors[message].message,
      });
    }

    console.error("Approve receivable error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to approve customer receivable.",
    });
  }
};

/* =========================================================
   RECORD CUSTOMER PAYMENT
   ========================================================= */

export const recordReceivablePayment = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId = getOrganizationId(req);
    const userId = getUserId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const id = getReceivableId(req);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid receivable ID.",
      });
    }

    const paymentAmount = parseMoney(req.body?.amount);

    if (paymentAmount === null) {
      return res.status(400).json({
        success: false,
        message:
          "Payment amount must be greater than zero and have no more than two decimal places.",
      });
    }

    const paymentDate =
      req.body?.paymentDate !== undefined
        ? parseDate(req.body.paymentDate)
        : new Date();

    if (!paymentDate) {
      return res.status(400).json({
        success: false,
        message: "A valid payment date is required.",
      });
    }

    const paymentReference = normalizeOptionalText(
      req.body?.paymentReference,
      MAX_REFERENCE_LENGTH
    );

    const idempotencyKey = getIdempotencyKey(req);

    if (!idempotencyKey) {
      return res.status(400).json({
        success: false,
        message:
          "An idempotency key is required. Supply the Idempotency-Key header or idempotencyKey in the request body.",
      });
    }

    const notes = normalizeOptionalText(req.body?.notes);

    const result = await prisma.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "AccountsReceivable"
          WHERE "id" = ${id}
            AND "organizationId" = ${organizationId}
          FOR UPDATE
        `;

        if (!locked.length) {
          throw new Error("RECEIVABLE_NOT_FOUND");
        }

        const existing = await tx.accountsReceivable.findFirst({
          where: { id, organizationId },
        });

        if (!existing) {
          throw new Error("RECEIVABLE_NOT_FOUND");
        }

        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(
            hashtextextended(
              ${`AR-IDEMPOTENCY-${organizationId}-${idempotencyKey}`},
              0
            )
          )
        `;

        const existingIdempotentPayment =
          await findIdempotentPayment(
            tx,
            organizationId,
            existing.invoiceNumber,
            paymentReference,
            idempotencyKey,
            paymentAmount
          );

        if (existingIdempotentPayment?.conflict) {
          throw new Error("IDEMPOTENCY_KEY_CONFLICT");
        }

        if (existingIdempotentPayment?.journal) {
          const currentReceivable =
            await tx.accountsReceivable.findFirst({
              where: { id, organizationId },
            });

          if (!currentReceivable) {
            throw new Error("RECEIVABLE_NOT_FOUND");
          }

          return {
            receivable: currentReceivable,
            journal: existingIdempotentPayment.journal,
            paymentAccount:
              existingIdempotentPayment.journal.debitAccount,
            idempotent: true,
          };
        }

        if (existing.status === RECEIVABLE_STATUS.VOID) {
          throw new Error("RECEIVABLE_VOID");
        }

        if (
          existing.status !== RECEIVABLE_STATUS.APPROVED &&
          existing.status !== RECEIVABLE_STATUS.ACTIVE
        ) {
          throw new Error("RECEIVABLE_NOT_APPROVED");
        }

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
            await tx.journalEntry.findMany({
              where: {
                organizationId,
                status: {
                  in: [
                    JOURNAL_STATUS.POSTED,
                    JOURNAL_STATUS.APPROVED,
                  ],
                },
                reference: { startsWith: "AR-PAY-" },
                notes: {
                  contains:
                    `Payment Reference: ${paymentReference}`,
                },
              },
              select: {
                id: true,
                reference: true,
                amount: true,
                notes: true,
                description: true,
              },
              take: 5,
            });

          const exactPaymentReference =
            duplicatePayment.find(
              (journal) =>
                journal.notes
                  ?.match(
                    /Payment Reference:\s*([^|]+)/i
                  )?.[1]
                  ?.trim() === paymentReference
            );

          if (exactPaymentReference) {
            const sameInvoice =
              exactPaymentReference.description ===
              `Customer payment - ${existing.invoiceNumber}`;

            const sameAmount = isEffectivelyZero(
              roundMoney(
                toNumber(exactPaymentReference.amount)
              ) - paymentAmount
            );

            if (!sameInvoice || !sameAmount) {
              throw new Error(
                "PAYMENT_REFERENCE_ALREADY_USED"
              );
            }

            throw new Error(
              "PAYMENT_REFERENCE_REQUIRES_IDEMPOTENCY_MATCH"
            );
          }
        }

        const outstandingBalance = roundMoney(
          toNumber(existing.outstandingBalance)
        );

        if (outstandingBalance <= MONEY_TOLERANCE) {
          throw new Error("RECEIVABLE_ALREADY_PAID");
        }

        if (
          paymentAmount >
          outstandingBalance + MONEY_TOLERANCE
        ) {
          throw new Error("PAYMENT_EXCEEDS_BALANCE");
        }

        const newBalance = roundMoney(
          Math.max(
            0,
            outstandingBalance - paymentAmount
          )
        );

        const newPaymentStatus = getPaymentStatus(
          toNumber(existing.amount),
          newBalance
        );

        const paymentAccount =
          await resolvePaymentAccount(
            tx,
            organizationId,
            {
              accountId:
                req.body?.paymentAccountId,
              accountCode:
                req.body?.paymentAccountCode,
            }
          );

        const receivableAccount =
          await requireReceivableAccount(
            tx,
            organizationId
          );

        const journal = await createPaymentJournal(
          tx,
          {
            organizationId,
            invoiceNumber: existing.invoiceNumber,
            amount: paymentAmount,
            paymentAccountId: paymentAccount.id,
            receivableAccountId:
              receivableAccount.id,
            transactionDate: paymentDate,
            createdBy: userId,
            paymentReference,
            idempotencyKey,
            notes,
          }
        );

        assertBalancedJournal(
          journal.lines,
          "PAYMENT_JOURNAL_UNBALANCED"
        );

        const nextStatus =
          newPaymentStatus === PAYMENT_STATUS.PAID
            ? RECEIVABLE_STATUS.CLOSED
            : RECEIVABLE_STATUS.ACTIVE;

        const updated =
          await tx.accountsReceivable.update({
            where: { id },
            data: {
              outstandingBalance: newBalance,
              paymentStatus: newPaymentStatus,
              status: nextStatus,
            },
          });

        const invoice =
          await tx.invoice.findFirst({
            where: {
              organizationId,
              invoiceNumber: existing.invoiceNumber,
            },
            select: {
              id: true,
              status: true,
            },
          });

        if (invoice) {
          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              paymentStatus: newPaymentStatus,
            },
          });
        }

        await createAuditTrail(
          tx,
          organizationId,
          userId,
          "RECEIVABLE_PAYMENT_RECORDED",
          {
            receivableId: existing.id,
            invoiceNumber: existing.invoiceNumber,
            paymentAmount,
            previousOutstandingBalance:
              outstandingBalance,
            newOutstandingBalance: newBalance,
            paymentStatus: newPaymentStatus,
            paymentReference: paymentReference ?? null,
            idempotencyKey,
            paymentAccountId: paymentAccount.id,
            paymentAccountCode: paymentAccount.code,
            journalEntryId: journal.id,
            journalReference: journal.reference,
            paymentDate: paymentDate.toISOString(),
          }
        );

        return {
          receivable: updated,
          journal,
          paymentAccount,
          idempotent: false,
        };
      }
    );

    return res.status(200).json({
      success: true,
      message: result.idempotent
        ? "Customer payment request already processed."
        : result.receivable.paymentStatus ===
            PAYMENT_STATUS.PAID
          ? "Customer invoice paid in full."
          : "Customer payment recorded successfully.",
      idempotent: result.idempotent,
      receivable: presentReceivable(
        result.receivable,
        new Date()
      ),
      payment: {
        amount: roundMoney(
          toNumber(result.journal.amount)
        ),
        paymentDate:
          result.journal.transactionDate.toISOString(),
        paymentReference:
          paymentReference ??
          result.journal.notes
            ?.match(
              /Payment Reference:\s*([^|]+)/i
            )?.[1]
            ?.trim() ??
          null,
        idempotencyKey,
        paymentAccount: {
          id: result.paymentAccount.id,
          code: result.paymentAccount.code,
          name: result.paymentAccount.name,
        },
        journalEntry: {
          id: result.journal.id,
          reference: result.journal.reference,
          status: result.journal.status,
        },
      },
    });
  } catch (error) {
    const message = getErrorMessage(error);

    const errors: Record<
      string,
      { status: number; message: string }
    > = {
      RECEIVABLE_NOT_FOUND: {
        status: 404,
        message: "Customer receivable not found.",
      },
      RECEIVABLE_NOT_APPROVED: {
        status: 409,
        message:
          "Approve the receivable before recording a payment.",
      },
      RECEIVABLE_VOID: {
        status: 409,
        message:
          "Voided receivables cannot receive payments.",
      },
      IDEMPOTENCY_KEY_CONFLICT: {
        status: 409,
        message:
          "The idempotency key was already used with different payment data.",
      },
      PAYMENT_REFERENCE_ALREADY_USED: {
        status: 409,
        message:
          "This payment reference has already been used with different payment data in this organization.",
      },
      PAYMENT_REFERENCE_REQUIRES_IDEMPOTENCY_MATCH: {
        status: 409,
        message:
          "This payment reference has already been processed. Reuse the original idempotency key to receive the original result.",
      },
      RECEIVABLE_ALREADY_PAID: {
        status: 409,
        message:
          "This receivable is already fully paid.",
      },
      PAYMENT_EXCEEDS_BALANCE: {
        status: 400,
        message:
          "Payment amount cannot exceed the outstanding balance.",
      },
      PAYMENT_ACCOUNT_NOT_FOUND: {
        status: 400,
        message:
          "The selected payment account could not be found for this tenant.",
      },
      PAYMENT_ACCOUNT_MUST_BE_ASSET: {
        status: 400,
        message:
          "The payment account must be an asset account belonging to this tenant.",
      },
      PAYMENT_ACCOUNT_CANNOT_BE_AR: {
        status: 400,
        message:
          "Accounts Receivable cannot be used as the payment account.",
      },
      PAYMENT_ACCOUNTS_NOT_FOUND: {
        status: 400,
        message:
          "The accounting accounts required for this payment could not be found.",
      },
      PAYMENT_ACCOUNTS_MUST_DIFFER: {
        status: 400,
        message:
          "The payment account and Accounts Receivable account must be different.",
      },
      STANDARD_AR_ACCOUNT_NOT_FOUND: {
        status: 500,
        message:
          "The organization's Accounts Receivable account is not configured.",
      },
      STANDARD_AR_ACCOUNT_INVALID: {
        status: 500,
        message:
          "The organization's Accounts Receivable account is incorrectly configured.",
      },
      PAYMENT_JOURNAL_UNBALANCED: {
        status: 500,
        message:
          "The payment accounting entry failed the double-entry balance check. No payment was posted.",
      },
    };

    if (errors[message]) {
      return res.status(errors[message].status).json({
        success: false,
        message: errors[message].message,
      });
    }

    console.error(
      "Record receivable payment error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to record customer payment.",
    });
  }
};

/* =========================================================
   VOID RECEIVABLE / REVERSE RECOGNITION
   ========================================================= */

export const voidReceivable = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId = getOrganizationId(req);
    const userId = getUserId(req);
    const id = getReceivableId(req);

    if (!organizationId) return res.status(401).json({ success: false, message: "Authentication required." });
    if (!id) return res.status(400).json({ success: false, message: "Invalid receivable ID." });

    const result = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "AccountsReceivable"
        WHERE "id" = ${id} AND "organizationId" = ${organizationId}
        FOR UPDATE
      `;
      if (!locked.length) throw new Error("RECEIVABLE_NOT_FOUND");

      const existing = await tx.accountsReceivable.findFirst({ where: { id, organizationId } });
      if (!existing) throw new Error("RECEIVABLE_NOT_FOUND");
      if (existing.status === RECEIVABLE_STATUS.VOID) throw new Error("RECEIVABLE_ALREADY_VOID");
      if (existing.status === RECEIVABLE_STATUS.PENDING) {
        const deleted = await tx.accountsReceivable.deleteMany({ where: { id, organizationId, status: RECEIVABLE_STATUS.PENDING } });
        if (deleted.count !== 1) throw new Error("RECEIVABLE_VOID_FAILED");
        await createAuditTrail(tx, organizationId, userId, "RECEIVABLE_VOIDED", { receivableId: id, invoiceNumber: existing.invoiceNumber, mode: "PENDING_VOID" });
        return { mode: "PENDING_VOID", journalId: null, receivable: null };
      }

      if (existing.paymentStatus !== PAYMENT_STATUS.UNPAID || toNumber(existing.outstandingBalance) < toNumber(existing.amount) - MONEY_TOLERANCE) {
        throw new Error("RECEIVABLE_HAS_PAYMENTS");
      }

      const invoice = await tx.invoice.findFirst({
        where: { organizationId, invoiceNumber: existing.invoiceNumber },
        select: { id: true, status: true },
      });
      if (invoice) throw new Error("INVOICE_OWNED_RECEIVABLE");

      const receivableAccount = await requireReceivableAccount(tx, organizationId);
      const revenueAccount = await resolveRevenueAccount(tx, organizationId, {
        accountId: req.body?.revenueAccountId,
        accountCode: req.body?.revenueAccountCode,
      });
      const amount = parseMoney(existing.amount);
      if (amount === null) throw new Error("INVALID_RECEIVABLE_AMOUNT");

      const reference = await generateSequentialReference(tx, organizationId, "AR-REV-", "AR-REVERSAL");
      const now = new Date();
      const journal = await tx.journalEntry.create({
        data: {
          organizationId, reference,
          description: `Reversal of accounts receivable recognition - ${existing.invoiceNumber}`,
          debitAccountId: revenueAccount.id,
          creditAccountId: receivableAccount.id,
          amount, createdBy: userId, transactionDate: now,
          status: JOURNAL_STATUS.POSTED, postedAt: now, postedBy: userId,
          notes: `AR reversal for ${existing.invoiceNumber}`,
          lines: { create: [
            { accountId: revenueAccount.id, lineNumber: 1, memo: `Reverse revenue - ${existing.invoiceNumber}`, debit: amount, credit: 0 },
            { accountId: receivableAccount.id, lineNumber: 2, memo: `Reverse receivable - ${existing.invoiceNumber}`, debit: 0, credit: amount },
          ] },
        },
        include: { lines: true },
      });

      assertBalancedJournal(
        journal.lines,
        "AR_REVERSAL_UNBALANCED"
      );

      const updated = await tx.accountsReceivable.update({
        where: { id },
        data: {
          status: RECEIVABLE_STATUS.VOID,
          outstandingBalance: 0,
        },
      });
      await createAuditTrail(tx, organizationId, userId, "RECEIVABLE_VOIDED", { receivableId: id, invoiceNumber: existing.invoiceNumber, reversalJournalId: journal.id, amount });
      return { mode: "POSTED_REVERSAL", journalId: journal.id, receivable: updated };
    });

    return res.status(200).json({ success: true, message: "Receivable voided successfully.", ...result });
  } catch (error) {
    const message = getErrorMessage(error);
    const map: Record<string, [number, string]> = {
      RECEIVABLE_NOT_FOUND: [404, "Customer receivable not found."],
      RECEIVABLE_ALREADY_VOID: [409, "Customer receivable is already void."],
      RECEIVABLE_HAS_PAYMENTS: [409, "A receivable with payments cannot be voided."],
      INVOICE_OWNED_RECEIVABLE: [409, "Invoice-owned receivables must be reversed through the invoicing workflow."],
      STANDARD_AR_ACCOUNT_NOT_FOUND: [500, "The organization's Accounts Receivable account is not configured."],
      STANDARD_AR_ACCOUNT_INVALID: [500, "The organization's Accounts Receivable account is incorrectly configured."],
      REVENUE_ACCOUNT_NOT_FOUND: [400, "The selected revenue account could not be found for this tenant."],
      REVENUE_ACCOUNT_INVALID: [400, "The selected revenue account must be an income account belonging to this tenant."],
      AR_REVERSAL_UNBALANCED: [500, "The reversal failed the double-entry balance check."],
      RECEIVABLE_VOID_FAILED: [409, "The receivable could not be voided."],
    };
    if (map[message]) return res.status(map[message][0]).json({ success: false, message: map[message][1] });
    console.error("Void receivable error:", error);
    return res.status(500).json({ success: false, message: "Failed to void customer receivable." });
  }
};

/* =========================================================
   WRITE OFF RECEIVABLE
   ========================================================= */

export const writeOffReceivable = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId = getOrganizationId(req);
    const userId = getUserId(req);
    const id = getReceivableId(req);
    if (!organizationId) return res.status(401).json({ success: false, message: "Authentication required." });
    if (!id) return res.status(400).json({ success: false, message: "Invalid receivable ID." });

    const reason = normalizeText(req.body?.reason, MAX_TEXT_LENGTH);
    if (!reason) return res.status(400).json({ success: false, message: "A write-off reason is required." });

    const result = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "AccountsReceivable" WHERE "id" = ${id} AND "organizationId" = ${organizationId} FOR UPDATE`;
      if (!locked.length) throw new Error("RECEIVABLE_NOT_FOUND");
      const existing = await tx.accountsReceivable.findFirst({ where: { id, organizationId } });
      if (!existing) throw new Error("RECEIVABLE_NOT_FOUND");
      if (existing.status !== RECEIVABLE_STATUS.APPROVED && existing.status !== RECEIVABLE_STATUS.ACTIVE) throw new Error("RECEIVABLE_NOT_WRITEOFFABLE");
      const balance = roundMoney(toNumber(existing.outstandingBalance));
      if (balance <= MONEY_TOLERANCE) throw new Error("RECEIVABLE_ALREADY_PAID");

      const ar = await requireReceivableAccount(
        tx,
        organizationId
      );

      const badDebtId = normalizeOptionalText(
        req.body?.writeOffAccountId,
        MAX_REFERENCE_LENGTH
      );
      const badDebtCode = normalizeOptionalText(
        req.body?.writeOffAccountCode,
        MAX_REFERENCE_LENGTH
      );

      let badDebt: PrismaAccount | null = null;

      if (badDebtId) {
        badDebt = await getTenantAccountById(
          tx,
          organizationId,
          badDebtId
        );
      } else if (badDebtCode) {
        badDebt = await getTenantAccountByCode(
          tx,
          organizationId,
          badDebtCode
        );
      } else {
        badDebt = await getTenantAccountByCode(
          tx,
          organizationId,
          "role:BAD_DEBT"
        );
      }

      if (!badDebt) {
        throw new Error("BAD_DEBT_ACCOUNT_NOT_FOUND");
      }

      if (badDebt.type !== "EXPENSE") {
        throw new Error("BAD_DEBT_ACCOUNT_INVALID");
      }

      const reference = await generateSequentialReference(tx, organizationId, "AR-WO-", "AR-WRITEOFF");
      const now = new Date();
      const journal = await tx.journalEntry.create({
        data: {
          organizationId, reference, description: `Accounts receivable write-off - ${existing.invoiceNumber}`,
          debitAccountId: badDebt.id, creditAccountId: ar.id, amount: balance, createdBy: userId,
          transactionDate: now, status: JOURNAL_STATUS.POSTED, postedAt: now, postedBy: userId,
          notes: `AR write-off for ${existing.invoiceNumber} | Reason: ${reason}`,
          lines: { create: [
            { accountId: badDebt.id, lineNumber: 1, memo: `Bad debt write-off - ${existing.invoiceNumber}`, debit: balance, credit: 0 },
            { accountId: ar.id, lineNumber: 2, memo: `Write off receivable - ${existing.invoiceNumber}`, debit: 0, credit: balance },
          ] },
        }, include: { lines: true },
      });
      assertBalancedJournal(
        journal.lines,
        "AR_WRITEOFF_UNBALANCED"
      );

      const updated = await tx.accountsReceivable.update({
        where: { id },
        data: {
          outstandingBalance: 0,
          paymentStatus: PAYMENT_STATUS.PAID,
          status: RECEIVABLE_STATUS.CLOSED,
        },
      });

      const invoice = await tx.invoice.findFirst({
        where: {
          organizationId,
          invoiceNumber: existing.invoiceNumber,
        },
        select: { id: true },
      });

      if (invoice) {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { paymentStatus: PAYMENT_STATUS.PAID },
        });
      }

      await createAuditTrail(
        tx,
        organizationId,
        userId,
        "RECEIVABLE_WRITTEN_OFF",
        {
          receivableId: id,
          invoiceNumber: existing.invoiceNumber,
          amount: balance,
          journalEntryId: journal.id,
          writeOffAccountId: badDebt.id,
          writeOffAccountCode: badDebt.code,
          reason,
        }
      );

      return {
        receivable: updated,
        journalEntryId: journal.id,
        amount: balance,
      };
    });
    return res.status(200).json({ success: true, message: "Receivable written off successfully.", ...result });
  } catch (error) {
    const message = getErrorMessage(error);
    const map: Record<string, [number, string]> = {
      RECEIVABLE_NOT_FOUND: [404, "Customer receivable not found."],
      RECEIVABLE_NOT_WRITEOFFABLE: [409, "Only approved or active receivables can be written off."],
      RECEIVABLE_ALREADY_PAID: [409, "This receivable has no outstanding balance."],
      BAD_DEBT_ACCOUNT_NOT_FOUND: [500, "The selected bad-debt expense account is not configured for this tenant."],
      BAD_DEBT_ACCOUNT_INVALID: [400, "The selected bad-debt account must be an expense account belonging to this tenant."],
      AR_WRITEOFF_UNBALANCED: [500, "The write-off failed the double-entry balance check."],
    };
    if (map[message]) return res.status(map[message][0]).json({ success: false, message: map[message][1] });
    console.error("Write-off receivable error:", error);
    return res.status(500).json({ success: false, message: "Failed to write off customer receivable." });
  }
};


export const deleteReceivable = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const id = getReceivableId(req);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid receivable ID.",
      });
    }

    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{
          id: string;
          invoiceNumber: string;
          status: string;
        }>
      >`
        SELECT
          "id",
          "invoiceNumber",
          "status"
        FROM "AccountsReceivable"
        WHERE "id" = ${id}
          AND "organizationId" = ${organizationId}
        FOR UPDATE
      `;

      if (!locked.length) {
        throw new Error("RECEIVABLE_NOT_FOUND");
      }

      const existing = locked[0];

      if (existing.status !== RECEIVABLE_STATUS.PENDING) {
        throw new Error("RECEIVABLE_NOT_DELETABLE");
      }

      const invoice =
        await tx.invoice.findFirst({
          where: {
            organizationId,
            invoiceNumber: existing.invoiceNumber,
          },
          select: { id: true },
        });

      if (invoice) {
        throw new Error("INVOICE_OWNS_RECEIVABLE");
      }

      const accountingEntries =
        await tx.journalEntry.count({
          where: {
            organizationId,
            OR: [
              {
                description: {
                  contains:
                    existing.invoiceNumber,
                },
              },
              {
                notes: {
                  contains:
                    existing.invoiceNumber,
                },
              },
            ],
            status: {
              in: [
                JOURNAL_STATUS.POSTED,
                JOURNAL_STATUS.APPROVED,
              ],
            },
          },
        });

      if (accountingEntries > 0) {
        throw new Error("RECEIVABLE_NOT_DELETABLE");
      }

      const deletion =
        await tx.accountsReceivable.deleteMany({
          where: {
            id,
            organizationId,
            status: RECEIVABLE_STATUS.PENDING,
          },
        });

      if (deletion.count !== 1) {
        throw new Error("RECEIVABLE_DELETE_FAILED");
      }

      await createAuditTrail(
        tx,
        organizationId,
        getUserId(req),
        "RECEIVABLE_DELETED",
        {
          receivableId: existing.id,
          invoiceNumber: existing.invoiceNumber,
        }
      );
    });

    return res.status(200).json({
      success: true,
      message:
        "Pending customer receivable deleted successfully.",
    });
  } catch (error) {
    const message = getErrorMessage(error);

    if (message === "RECEIVABLE_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Customer receivable not found.",
      });
    }

    if (
      message === "RECEIVABLE_NOT_DELETABLE"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Posted or approved receivables cannot be deleted. Use the appropriate accounting reversal or void workflow.",
      });
    }

    if (
      message === "INVOICE_OWNS_RECEIVABLE"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This receivable is owned by the Invoicing workflow and cannot be deleted from Accounts Receivable.",
      });
    }

    console.error("Delete receivable error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete customer receivable.",
    });
  }
};