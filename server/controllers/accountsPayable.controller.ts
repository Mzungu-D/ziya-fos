import { Response } from "express";
import { Prisma } from "@prisma/client";

import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

const EFFECTIVE_JOURNAL_STATUSES = ["POSTED", "APPROVED"] as const;
const AP_ACCOUNT_CODE = "2100";
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_SEARCH_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_REFERENCE_LENGTH = 100;
const MONEY_SCALE = 100;

type PaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID";

const getOrganizationId = (req: AuthRequest): string | null => {
  const organizationId = req.user?.organizationId?.trim();
  return organizationId || null;
};

const getUserId = (req: AuthRequest): string | null => {
  const userId = req.user?.userId?.trim();
  return userId || null;
};

const getParamId = (
  value: string | string[] | undefined
): string | null => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

const parseMoneyCents = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    const cents = Math.round(value * MONEY_SCALE);
    return cents > 0 ? cents : null;
  }

  if (typeof value === "string") {
    const normalized = value.trim().replace(/,/g, "");
    if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;

    const numeric = Number(normalized);
    if (!Number.isFinite(numeric)) return null;

    const cents = Math.round(numeric * MONEY_SCALE);
    return cents > 0 ? cents : null;
  }

  return null;
};

const centsToAmount = (cents: number): number =>
  Number((cents / MONEY_SCALE).toFixed(2));

const parsePositiveInteger = (
  value: unknown,
  fallback: number,
  max: number
): number | null => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const raw = String(value).trim();
  if (!/^\d+$/.test(raw)) return null;

  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) {
    return null;
  }

  return parsed;
};

const parseDate = (
  value: unknown,
  endOfDay = false
): Date | null => {
  if (typeof value !== "string" && !(value instanceof Date)) return null;

  const raw = value instanceof Date ? value.toISOString() : value.trim();
  if (!raw) return null;

  const date =
    typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)
      ? new Date(
          `${raw}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`
        )
      : new Date(raw);

  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeText = (
  value: unknown,
  maxLength: number
): string | null => {
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) return null;

  return normalized;
};

const normalizeReference = (value: unknown): string | null => {
  const reference = normalizeText(value, MAX_REFERENCE_LENGTH);
  if (!reference) return null;

  if (!/^[A-Za-z0-9._:/ -]+$/.test(reference)) return null;

  return reference;
};

const writeAudit = async (
  tx: Prisma.TransactionClient,
  organizationId: string,
  userId: string,
  action: string,
  details: Record<string, unknown>
) => {
  await tx.auditTrail.create({
    data: {
      organizationId,
      user: userId,
      action,
      module: "ACCOUNTS_PAYABLE",
      details: JSON.stringify(details),
    },
  });
};

const findTenantAccount = async (
  tx: Prisma.TransactionClient,
  organizationId: string,
  accountId: string,
  allowedTypes: readonly string[]
) => {
  const account = await tx.account.findFirst({
    where: {
      id: accountId,
      organizationId,
    },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
    },
  });

  if (!account || !allowedTypes.includes(account.type)) return null;

  return account;
};

const findAccountsPayableControlAccount = async (
  tx: Prisma.TransactionClient,
  organizationId: string
) => {
  return tx.account.findFirst({
    where: {
      organizationId,
      code: AP_ACCOUNT_CODE,
      type: "LIABILITY",
    },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
    },
  });
};

const generateNextBillNumber = async (
  tx: Prisma.TransactionClient,
  organizationId: string
): Promise<string> => {
  const year = new Date().getUTCFullYear();
  const prefix = `AP-${year}-`;

  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtext(${`FOS:AP:${organizationId}:${year}`})
    )
  `;

  const latest = await tx.accountsPayable.findFirst({
    where: {
      organizationId,
      invoiceNumber: { startsWith: prefix },
    },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });

  let next = 1;

  if (latest?.invoiceNumber) {
    const match = latest.invoiceNumber.match(
      new RegExp(`^AP-${year}-(\\d+)$`)
    );

    if (match) {
      const current = Number(match[1]);
      if (Number.isSafeInteger(current) && current >= 0) {
        next = current + 1;
      }
    }
  }

  return `${prefix}${String(next).padStart(6, "0")}`;
};

const createPostedJournal = async (
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    reference: string;
    description: string;
    transactionDate: Date;
    amountCents: number;
    debitAccountId: string;
    creditAccountId: string;
    userId: string;
    notes: string;
  }
) => {
  const existing = await tx.journalEntry.findFirst({
    where: {
      organizationId: input.organizationId,
      reference: input.reference,
    },
    include: { lines: true },
  });

  if (existing) {
    if (!["POSTED", "APPROVED"].includes(existing.status)) {
      throw new Error("ACCOUNTING_REFERENCE_EXISTS_NOT_POSTED");
    }

    if (
      Math.abs(
        Number(existing.amount) - centsToAmount(input.amountCents)
      ) > 0.01
    ) {
      throw new Error("ACCOUNTING_REFERENCE_AMOUNT_MISMATCH");
    }

    return existing;
  }

  const amount = centsToAmount(input.amountCents);

  return tx.journalEntry.create({
    data: {
      organizationId: input.organizationId,
      reference: input.reference,
      description: input.description,
      amount,
      debitAccountId: input.debitAccountId,
      creditAccountId: input.creditAccountId,
      status: "POSTED",
      transactionDate: input.transactionDate,
      postedAt: new Date(),
      postedBy: input.userId,
      createdBy: input.userId,
      notes: input.notes,
      lines: {
        create: [
          {
            accountId: input.debitAccountId,
            lineNumber: 1,
            memo: input.description,
            debit: amount,
            credit: 0,
          },
          {
            accountId: input.creditAccountId,
            lineNumber: 2,
            memo: input.description,
            debit: 0,
            credit: amount,
          },
        ],
      },
    },
    include: { lines: true },
  });
};

/* =========================================================
   CREATE PAYABLE
   ========================================================= */

export const createPayable = async (
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

    const vendorId = normalizeText(req.body?.vendorId, 100);
    const description = normalizeText(
      req.body?.description,
      MAX_DESCRIPTION_LENGTH
    );
    const amountCents = parseMoneyCents(req.body?.amount);
    const dueDate = parseDate(req.body?.dueDate);

    if (!vendorId || !description || amountCents === null) {
      return res.status(400).json({
        success: false,
        message:
          "Vendor, description and a valid amount are required.",
      });
    }

    if (!dueDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid due date.",
      });
    }

    const payable = await prisma.$transaction(async (tx) => {
      const vendor = await tx.vendor.findFirst({
        where: { id: vendorId, organizationId },
        select: { id: true, name: true },
      });

      if (!vendor) throw new Error("VENDOR_NOT_FOUND");

      const invoiceNumber = await generateNextBillNumber(
        tx,
        organizationId
      );

      return tx.accountsPayable.create({
        data: {
          organizationId,
          invoiceNumber,
          vendorId,
          description,
          amount: centsToAmount(amountCents),
          outstandingBalance: centsToAmount(amountCents),
          dueDate,
          paymentStatus: "UNPAID",
          status: "PENDING",
        },
        include: { vendor: true },
      });
    });

    return res.status(201).json({
      success: true,
      message: "Supplier bill created successfully.",
      payable,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "VENDOR_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Vendor not found.",
      });
    }

    console.error("CREATE PAYABLE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create supplier bill.",
    });
  }
};

/* =========================================================
   GET PAYABLES
   ========================================================= */

export const getPayables = async (
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

    const page = parsePositiveInteger(
      req.query.page,
      DEFAULT_PAGE,
      Number.MAX_SAFE_INTEGER
    );
    const pageSize = parsePositiveInteger(
      req.query.pageSize ?? req.query.limit,
      DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE
    );

    if (page === null || pageSize === null) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination parameters.",
      });
    }

    const searchRaw = req.query.search;

    if (
      searchRaw !== undefined &&
      typeof searchRaw !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid search parameter.",
      });
    }

    const search =
      typeof searchRaw === "string" ? searchRaw.trim() : "";

    if (search.length > MAX_SEARCH_LENGTH) {
      return res.status(400).json({
        success: false,
        message: "Search term is too long.",
      });
    }

    const status =
      typeof req.query.status === "string"
        ? req.query.status.trim()
        : undefined;

    const paymentStatus =
      typeof req.query.paymentStatus === "string"
        ? req.query.paymentStatus.trim()
        : undefined;

    const where: Prisma.AccountsPayableWhereInput = {
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
                description: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                vendor: {
                  name: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              },
            ],
          }
        : {}),
    };

    const skip = (page - 1) * pageSize;

    const [payables, total] = await prisma.$transaction([
      prisma.accountsPayable.findMany({
        where,
        include: { vendor: true },
        orderBy: [
          { dueDate: "asc" },
          { createdAt: "desc" },
        ],
        skip,
        take: pageSize,
      }),
      prisma.accountsPayable.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return res.status(200).json({
      success: true,
      count: payables.length,
      total,
      payables,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error("GET PAYABLES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch supplier bills.",
    });
  }
};

/* =========================================================
   GET SINGLE PAYABLE
   ========================================================= */

export const getPayableById = async (
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

    const id = getParamId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Payable ID is required.",
      });
    }

    const payable = await prisma.accountsPayable.findFirst({
      where: { id, organizationId },
      include: { vendor: true },
    });

    if (!payable) {
      return res.status(404).json({
        success: false,
        message: "Supplier bill not found.",
      });
    }

    return res.status(200).json({
      success: true,
      payable,
    });
  } catch (error) {
    console.error("GET PAYABLE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch supplier bill.",
    });
  }
};

/* =========================================================
   APPROVE PAYABLE + POST ACCOUNTING
   ========================================================= */

export const approvePayable = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId = getOrganizationId(req);
    const userId = getUserId(req);

    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const id = getParamId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Payable ID is required.",
      });
    }

    const expenseAccountId = normalizeText(
      req.body?.expenseAccountId,
      100
    );

    if (!expenseAccountId) {
      return res.status(400).json({
        success: false,
        message:
          "Expense or supplier cost account is required before approval.",
      });
    }

    const payable = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "AccountsPayable"
        WHERE "id" = ${id}
          AND "organizationId" = ${organizationId}
        FOR UPDATE
      `;

      if (!locked.length) throw new Error("PAYABLE_NOT_FOUND");

      const existing = await tx.accountsPayable.findFirst({
        where: { id, organizationId },
        include: { vendor: true },
      });

      if (!existing) throw new Error("PAYABLE_NOT_FOUND");

      if (existing.status === "APPROVED") {
        throw new Error("PAYABLE_ALREADY_APPROVED");
      }

      const amountCents = parseMoneyCents(existing.amount);
      if (amountCents === null) {
        throw new Error("INVALID_PAYABLE_AMOUNT");
      }

      const expenseAccount = await findTenantAccount(
        tx,
        organizationId,
        expenseAccountId,
        ["ASSET", "EXPENSE"]
      );

      if (!expenseAccount) {
        throw new Error("INVALID_EXPENSE_ACCOUNT");
      }

      const apAccount = await findAccountsPayableControlAccount(
        tx,
        organizationId
      );

      if (!apAccount) {
        throw new Error("AP_CONTROL_ACCOUNT_MISSING");
      }

      const journalReference =
        `AP-${existing.invoiceNumber}-POST`;

      const journal = await createPostedJournal(tx, {
        organizationId,
        reference: journalReference,
        description:
          `Supplier bill ${existing.invoiceNumber}: ${existing.description}`,
        transactionDate: existing.createdAt,
        amountCents,
        debitAccountId: expenseAccount.id,
        creditAccountId: apAccount.id,
        userId,
        notes:
          `Accounts Payable posting for ${existing.invoiceNumber}.`,
      });

      const updated = await tx.accountsPayable.updateMany({
        where: {
          id,
          organizationId,
          status: "PENDING",
        },
        data: {
          status: "APPROVED",
          approvedBy: userId,
        },
      });

      if (updated.count !== 1) {
        throw new Error("PAYABLE_APPROVAL_RACE");
      }

      await writeAudit(
        tx,
        organizationId,
        userId,
        "APPROVE",
        {
          payableId: id,
          invoiceNumber: existing.invoiceNumber,
          journalEntryId: journal.id,
          journalReference,
          amount: centsToAmount(amountCents),
          debitAccount: expenseAccount.code,
          creditAccount: apAccount.code,
        }
      );

      return tx.accountsPayable.findFirst({
        where: { id, organizationId },
        include: { vendor: true },
      });
    });

    return res.status(200).json({
      success: true,
      message:
        "Supplier bill approved and posted successfully.",
      payable,
    });
  } catch (error) {
    const messages: Record<
      string,
      { status: number; message: string }
    > = {
      PAYABLE_NOT_FOUND: {
        status: 404,
        message: "Supplier bill not found.",
      },
      PAYABLE_ALREADY_APPROVED: {
        status: 400,
        message: "Supplier bill is already approved.",
      },
      INVALID_PAYABLE_AMOUNT: {
        status: 400,
        message: "Supplier bill amount is invalid.",
      },
      INVALID_EXPENSE_ACCOUNT: {
        status: 400,
        message:
          "The selected supplier cost account is invalid or does not belong to this tenant.",
      },
      AP_CONTROL_ACCOUNT_MISSING: {
        status: 409,
        message:
          "Accounts Payable control account 2100 is not configured for this tenant.",
      },
      ACCOUNTING_REFERENCE_EXISTS_NOT_POSTED: {
        status: 409,
        message:
          "The accounting reference already exists but is not posted.",
      },
      ACCOUNTING_REFERENCE_AMOUNT_MISMATCH: {
        status: 409,
        message:
          "Existing accounting reference does not match the supplier bill amount.",
      },
      PAYABLE_APPROVAL_RACE: {
        status: 409,
        message:
          "Supplier bill approval could not be completed safely. Please retry.",
      },
    };

    if (error instanceof Error && messages[error.message]) {
      const known = messages[error.message];
      return res.status(known.status).json({
        success: false,
        message: known.message,
      });
    }

    console.error("APPROVE PAYABLE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to approve supplier bill.",
    });
  }
};

/* =========================================================
   RECORD SUPPLIER PAYMENT + POST ACCOUNTING
   ========================================================= */

export const updatePayablePayment = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId = getOrganizationId(req);
    const userId = getUserId(req);

    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const id = getParamId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Payable ID is required.",
      });
    }

    const paymentCents = parseMoneyCents(
      req.body?.paymentAmount
    );

    if (paymentCents === null) {
      return res.status(400).json({
        success: false,
        message:
          "Payment amount must be greater than zero and have no more than two decimal places.",
      });
    }

    const paymentAccountId = normalizeText(
      req.body?.paymentAccountId,
      100
    );
    const paymentReference = normalizeReference(
      req.body?.paymentReference
    );

    if (!paymentAccountId) {
      return res.status(400).json({
        success: false,
        message: "Payment account is required.",
      });
    }

    if (!paymentReference) {
      return res.status(400).json({
        success: false,
        message: "A unique payment reference is required.",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "AccountsPayable"
        WHERE "id" = ${id}
          AND "organizationId" = ${organizationId}
        FOR UPDATE
      `;

      if (!locked.length) throw new Error("PAYABLE_NOT_FOUND");

      const payable = await tx.accountsPayable.findFirst({
        where: { id, organizationId },
        include: { vendor: true },
      });

      if (!payable) throw new Error("PAYABLE_NOT_FOUND");

      if (payable.status !== "APPROVED") {
        throw new Error("PAYABLE_NOT_APPROVED");
      }

      const paymentAccount = await findTenantAccount(
        tx,
        organizationId,
        paymentAccountId,
        ["ASSET"]
      );

      if (!paymentAccount) {
        throw new Error("INVALID_PAYMENT_ACCOUNT");
      }

      const apAccount = await findAccountsPayableControlAccount(
        tx,
        organizationId
      );

      if (!apAccount) {
        throw new Error("AP_CONTROL_ACCOUNT_MISSING");
      }

      const outstandingCents = parseMoneyCents(
        payable.outstandingBalance
      );

      if (outstandingCents === null) {
        throw new Error("INVALID_OUTSTANDING_BALANCE");
      }

      if (paymentCents > outstandingCents) {
        throw new Error("PAYMENT_EXCEEDS_BALANCE");
      }

      const journalReference =
        `AP-${payable.invoiceNumber}-PAY-${paymentReference}`;

      const existingJournal = await tx.journalEntry.findFirst({
        where: {
          organizationId,
          reference: journalReference,
        },
        include: { lines: true },
      });

      if (existingJournal) {
        if (!["POSTED", "APPROVED"].includes(existingJournal.status)) {
          throw new Error(
            "PAYMENT_REFERENCE_EXISTS_NOT_POSTED"
          );
        }

        if (
          Math.abs(
            Number(existingJournal.amount) -
              centsToAmount(paymentCents)
          ) > 0.01
        ) {
          throw new Error(
            "PAYMENT_REFERENCE_AMOUNT_MISMATCH"
          );
        }

        return {
          payable,
          journal: existingJournal,
          idempotent: true,
        };
      }

      const journal = await createPostedJournal(tx, {
        organizationId,
        reference: journalReference,
        description:
          `Supplier payment ${paymentReference} for ${payable.invoiceNumber}`,
        transactionDate: new Date(),
        amountCents: paymentCents,
        debitAccountId: paymentAccount.id,
        creditAccountId: apAccount.id,
        userId,
        notes:
          `Accounts Payable settlement for ${payable.invoiceNumber}; payment reference ${paymentReference}.`,
      });

      const newOutstandingCents =
        outstandingCents - paymentCents;

      const paymentStatus: PaymentStatus =
        newOutstandingCents === 0
          ? "PAID"
          : "PARTIALLY_PAID";

      const updated = await tx.accountsPayable.updateMany({
        where: {
          id,
          organizationId,
          status: "APPROVED",
        },
        data: {
          outstandingBalance:
            centsToAmount(newOutstandingCents),
          paymentStatus,
        },
      });

      if (updated.count !== 1) {
        throw new Error("PAYMENT_UPDATE_FAILED");
      }

      await writeAudit(
        tx,
        organizationId,
        userId,
        "PAYMENT",
        {
          payableId: id,
          invoiceNumber: payable.invoiceNumber,
          journalEntryId: journal.id,
          journalReference,
          paymentReference,
          amount: centsToAmount(paymentCents),
          paymentAccount: paymentAccount.code,
          apAccount: apAccount.code,
          paymentStatus,
        }
      );

      const updatedPayable =
        await tx.accountsPayable.findFirst({
          where: { id, organizationId },
          include: { vendor: true },
        });

      return {
        payable: updatedPayable,
        journal,
        idempotent: false,
      };
    });

    return res.status(200).json({
      success: true,
      idempotent: result.idempotent,
      message: result.idempotent
        ? "Supplier payment was already recorded."
        : result.payable?.paymentStatus === "PAID"
          ? "Supplier bill paid successfully."
          : "Supplier payment recorded successfully.",
      payable: result.payable,
      journalEntryId: result.journal.id,
    });
  } catch (error) {
    const messages: Record<
      string,
      { status: number; message: string }
    > = {
      PAYABLE_NOT_FOUND: {
        status: 404,
        message: "Supplier bill not found.",
      },
      PAYABLE_NOT_APPROVED: {
        status: 400,
        message:
          "Supplier bill must be approved before payment.",
      },
      INVALID_PAYMENT_ACCOUNT: {
        status: 400,
        message:
          "The selected payment account is invalid or does not belong to this tenant.",
      },
      AP_CONTROL_ACCOUNT_MISSING: {
        status: 409,
        message:
          "Accounts Payable control account 2100 is not configured for this tenant.",
      },
      INVALID_OUTSTANDING_BALANCE: {
        status: 409,
        message:
          "Supplier bill outstanding balance is invalid.",
      },
      PAYMENT_EXCEEDS_BALANCE: {
        status: 400,
        message:
          "Payment amount cannot exceed the outstanding balance.",
      },
      PAYMENT_REFERENCE_EXISTS_NOT_POSTED: {
        status: 409,
        message:
          "The payment reference already exists but its accounting entry is not posted.",
      },
      PAYMENT_REFERENCE_AMOUNT_MISMATCH: {
        status: 409,
        message:
          "The payment reference already exists with a different amount.",
      },
      PAYMENT_UPDATE_FAILED: {
        status: 409,
        message:
          "Supplier payment could not be completed safely. Please retry.",
      },
    };

    if (error instanceof Error && messages[error.message]) {
      const known = messages[error.message];
      return res.status(known.status).json({
        success: false,
        message: known.message,
      });
    }

    console.error(
      "UPDATE PAYABLE PAYMENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to record supplier payment.",
    });
  }
};

/* =========================================================
   DELETE PAYABLE
   ========================================================= */

export const deletePayable = async (
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

    const id = getParamId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Payable ID is required.",
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
        FROM "AccountsPayable"
        WHERE "id" = ${id}
          AND "organizationId" = ${organizationId}
        FOR UPDATE
      `;

      if (!locked.length) {
        throw new Error("PAYABLE_NOT_FOUND");
      }

      const payable = locked[0];

      if (payable.status !== "PENDING") {
        throw new Error("PAYABLE_ALREADY_ACCOUNTED");
      }

      const posted = await tx.journalEntry.count({
        where: {
          organizationId,
          OR: [
            {
              reference:
                `AP-${payable.invoiceNumber}-POST`,
            },
            {
              reference: {
                startsWith:
                  `AP-${payable.invoiceNumber}-PAY-`,
              },
            },
          ],
          status: {
            in: [...EFFECTIVE_JOURNAL_STATUSES],
          },
        },
      });

      if (posted > 0) {
        throw new Error("PAYABLE_ALREADY_ACCOUNTED");
      }

      const deletion = await tx.accountsPayable.deleteMany({
        where: {
          id,
          organizationId,
          status: "PENDING",
        },
      });

      if (deletion.count !== 1) {
        throw new Error("PAYABLE_DELETE_FAILED");
      }
    });

    return res.status(200).json({
      success: true,
      message: "Supplier bill deleted successfully.",
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "PAYABLE_NOT_FOUND") {
        return res.status(404).json({
          success: false,
          message: "Supplier bill not found.",
        });
      }

      if (error.message === "PAYABLE_ALREADY_ACCOUNTED") {
        return res.status(409).json({
          success: false,
          message:
            "An approved or posted supplier bill cannot be deleted. Reverse the accounting transaction instead.",
        });
      }

      if (error.message === "PAYABLE_DELETE_FAILED") {
        return res.status(409).json({
          success: false,
          message:
            "Supplier bill could not be deleted safely. Please retry.",
        });
      }
    }

    console.error("DELETE PAYABLE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete supplier bill.",
    });
  }
};