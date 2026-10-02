import { Response } from "express";
import { Prisma } from "@prisma/client";

import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

const EXPENSE_STATUS = {
  DRAFT: "DRAFT",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  APPROVED: "APPROVED",
  POSTED: "POSTED",
  REVERSED: "REVERSED",
} as const;

const PAYMENT_STATUS = {
  UNPAID: "UNPAID",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  PAID: "PAID",
} as const;

const JOURNAL_STATUS = {
  POSTED: "POSTED",
  APPROVED: "APPROVED",
  REVERSED: "REVERSED",
} as const;

const MONEY_TOLERANCE = 0.01;
const MAX_AMOUNT = 999999999999.99;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_TEXT_LENGTH = 500;
const MAX_REFERENCE_LENGTH = 100;
const MAX_SEARCH_LENGTH = 100;

type Tx = Prisma.TransactionClient;

const getOrganizationId = (req: AuthRequest): string | null => {
  const value = req.user?.organizationId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const getUserId = (req: AuthRequest): string => {
  const value = req.user?.userId;
  return typeof value === "string" && value.trim() ? value.trim() : "SYSTEM";
};

const normalizeString = (value: unknown, maxLength = MAX_TEXT_LENGTH): string => {
  if (typeof value !== "string") return "";
  const result = value.trim();
  return result.length <= maxLength ? result : "";
};

const normalizeOptionalString = (
  value: unknown,
  maxLength = MAX_TEXT_LENGTH
): string | null => {
  const result = normalizeString(value, maxLength);
  return result || null;
};

const getQueryString = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
};

const parseMoney = (value: unknown): number | null => {
  const raw =
    typeof value === "number"
      ? String(value)
      : typeof value === "string"
        ? value.trim().replace(/,/g, "")
        : "";

  if (!raw || !/^\d+(?:\.\d{1,2})?$/.test(raw)) return null;

  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) return null;

  const cents = Math.round(amount * 100);
  if (!Number.isSafeInteger(cents)) return null;

  return cents / 100;
};

const parseDate = (value: unknown, endOfDay = false): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;

  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const parsed = dateOnly
    ? new Date(`${raw}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`)
    : new Date(raw);

  if (Number.isNaN(parsed.getTime())) return null;

  if (dateOnly) {
    const normalized = parsed.toISOString().slice(0, 10);
    if (normalized !== raw) return null;
  }

  return parsed;
};

const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const moneyEquals = (a: number, b: number): boolean =>
  Math.abs(roundMoney(a) - roundMoney(b)) <= MONEY_TOLERANCE;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isPrismaUniqueError = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

const audit = async (
  tx: Tx,
  organizationId: string,
  userId: string,
  action: string,
  details: unknown
) => {
  await tx.auditTrail.create({
    data: {
      organizationId,
      user: userId,
      action,
      module: "EXPENSE",
      details:
        typeof details === "string" ? details : JSON.stringify(details),
    },
  });
};

const lockExpense = async (
  tx: Tx,
  organizationId: string,
  expenseId: string
): Promise<void> => {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "Expense"
    WHERE "id" = ${expenseId}
      AND "organizationId" = ${organizationId}
    FOR UPDATE
  `;

  if (!rows.length) throw new Error("EXPENSE_NOT_FOUND");
};

const generateExpenseCode = async (
  tx: Tx,
  organizationId: string,
  year: number
): Promise<string> => {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtext(${`${organizationId}:expense-code:${year}`})
    )
  `;

  const prefix = `EXP-${year}-`;

  const latest = await tx.expense.findFirst({
    where: {
      organizationId,
      expenseCode: { startsWith: prefix },
    },
    orderBy: { expenseCode: "desc" },
    select: { expenseCode: true },
  });

  const match = latest?.expenseCode?.match(/^EXP-\d{4}-(\d+)$/);
  const next = match ? Number(match[1]) + 1 : 1;

  if (!Number.isSafeInteger(next) || next > 999999999) {
    throw new Error("EXPENSE_CODE_EXHAUSTED");
  }

  return `${prefix}${String(next).padStart(3, "0")}`;
};

const validateAccount = async (
  tx: Tx,
  organizationId: string,
  accountId: string,
  allowedTypes: string[],
  field: string
) => {
  const account = await tx.account.findFirst({
    where: {
      id: accountId,
      organizationId,
      type: { in: allowedTypes },
    },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
    },
  });

  if (!account) throw new Error(`${field}_INVALID`);
  return account;
};

const validateBankAccount = async (
  tx: Tx,
  organizationId: string,
  bankAccountId: string | null,
  currency: string
) => {
  if (!bankAccountId) return null;

  const bank = await tx.bankAccount.findFirst({
    where: {
      id: bankAccountId,
      organizationId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      bankName: true,
      accountName: true,
      accountNumber: true,
      currency: true,
    },
  });

  if (!bank) throw new Error("BANK_ACCOUNT_INVALID");

  if (
    bank.currency &&
    currency &&
    bank.currency.toUpperCase() !== currency.toUpperCase()
  ) {
    throw new Error("BANK_CURRENCY_MISMATCH");
  }

  return bank;
};

const validateBalancedJournal = (
  lines: Array<{ debit: number; credit: number }>
) => {
  if (!lines.length) throw new Error("JOURNAL_LINES_INVALID");

  let debit = 0;
  let credit = 0;

  for (const line of lines) {
    if (
      !Number.isFinite(line.debit) ||
      !Number.isFinite(line.credit) ||
      line.debit < 0 ||
      line.credit < 0 ||
      (line.debit > 0 && line.credit > 0) ||
      (line.debit === 0 && line.credit === 0)
    ) {
      throw new Error("JOURNAL_LINES_INVALID");
    }

    debit += line.debit;
    credit += line.credit;
  }

  if (!moneyEquals(debit, credit)) {
    throw new Error("JOURNAL_UNBALANCED");
  }

  return {
    debit: roundMoney(debit),
    credit: roundMoney(credit),
  };
};

const getExpenseInclude = {
  vendor: true,
  expenseAccount: {
    select: { id: true, code: true, name: true, type: true },
  },
  paymentAccount: {
    select: { id: true, code: true, name: true, type: true },
  },
  bankAccount: {
    select: {
      id: true,
      bankName: true,
      accountName: true,
      accountNumber: true,
      currency: true,
    },
  },
  approval: true,
  journalEntry: {
    include: {
      lines: {
        include: {
          account: {
            select: { id: true, code: true, name: true, type: true },
          },
        },
      },
    },
  },
} satisfies Prisma.ExpenseInclude;

const getPage = (value: unknown): number | null => {
  const raw = getQueryString(value).trim();
  if (!raw) return DEFAULT_PAGE;
  if (!/^\d+$/.test(raw)) return null;
  const page = Number(raw);
  return Number.isSafeInteger(page) && page >= 1 ? page : null;
};

const getPageSize = (value: unknown): number | null => {
  const raw = getQueryString(value).trim();
  if (!raw) return DEFAULT_PAGE_SIZE;
  if (!/^\d+$/.test(raw)) return null;
  const size = Number(raw);
  return Number.isSafeInteger(size) && size >= 1 && size <= MAX_PAGE_SIZE
    ? size
    : null;
};

const buildExpenseWhere = (
  organizationId: string,
  query: AuthRequest["query"]
): { where: Prisma.ExpenseWhereInput; filters: Record<string, string> } => {
  const search = normalizeString(
    getQueryString(query.search),
    MAX_SEARCH_LENGTH
  );
  if (getQueryString(query.search) && !search) {
    throw new Error("SEARCH_TOO_LONG");
  }

  const status = normalizeOptionalString(getQueryString(query.status));
  const category = normalizeOptionalString(getQueryString(query.category));
  const vendorId = normalizeOptionalString(getQueryString(query.vendorId));
  const startRaw = normalizeOptionalString(getQueryString(query.startDate));
  const endRaw = normalizeOptionalString(getQueryString(query.endDate));

  const where: Prisma.ExpenseWhereInput = { organizationId };

  if (search) {
    where.OR = [
      { expenseCode: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { category: { contains: search, mode: "insensitive" } },
      {
        vendor: {
          is: { name: { contains: search, mode: "insensitive" } },
        },
      },
    ];
  }

  if (status) where.status = status;
  if (category) where.category = { equals: category, mode: "insensitive" };
  if (vendorId) where.vendorId = vendorId;

  const expenseDate: Prisma.DateTimeFilter = {};

  if (startRaw) {
    const start = parseDate(startRaw);
    if (!start) throw new Error("INVALID_START_DATE");
    expenseDate.gte = start;
  }

  if (endRaw) {
    const end = parseDate(endRaw, true);
    if (!end) throw new Error("INVALID_END_DATE");
    expenseDate.lte = end;
  }

  if (Object.keys(expenseDate).length) where.expenseDate = expenseDate;

  return {
    where,
    filters: {
      search,
      status: status ?? "",
      category: category ?? "",
      vendorId: vendorId ?? "",
      startDate: startRaw ?? "",
      endDate: endRaw ?? "",
    },
  };
};

/* =========================================================
   GET ALL EXPENSES
========================================================= */

export const getExpenses = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const page = getPage(req.query.page);
    const pageSize = getPageSize(req.query.pageSize);

    if (!page || !pageSize) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination parameters.",
      });
    }

    const { where, filters } = buildExpenseWhere(
      organizationId,
      req.query
    );

    const total = await prisma.expense.count({ where });
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
    const skip = (safePage - 1) * pageSize;

    const [expenses, summary, pending, approved, posted, paid, pendingPayment] =
      await Promise.all([
        prisma.expense.findMany({
          where,
          include: getExpenseInclude,
          orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
          skip,
          take: pageSize,
        }),
        prisma.expense.aggregate({
          where,
          _sum: { amount: true },
        }),
        prisma.expense.count({
          where: { ...where, status: EXPENSE_STATUS.PENDING_APPROVAL },
        }),
        prisma.expense.count({
          where: { ...where, status: EXPENSE_STATUS.APPROVED },
        }),
        prisma.expense.count({
          where: { ...where, status: EXPENSE_STATUS.POSTED },
        }),
        prisma.expense.count({
          where: { ...where, paymentStatus: PAYMENT_STATUS.PAID },
        }),
        prisma.expense.count({
          where: { ...where, paymentStatus: PAYMENT_STATUS.PENDING_APPROVAL },
        }),
      ]);

    return res.json({
      success: true,
      expenses,
      pagination: {
        page: safePage,
        pageSize,
        total,
        totalPages,
        hasPreviousPage: safePage > 1,
        hasNextPage: totalPages > 0 && safePage < totalPages,
      },
      summary: {
        totalSpend: roundMoney(Number(summary._sum.amount ?? 0)),
        pending,
        approved,
        posted,
        paid,
        pendingPayment,
      },
      filters,
    });
  } catch (error) {
    const message = getErrorMessage(error);

    const errors: Record<string, string> = {
      SEARCH_TOO_LONG: "Search text is too long.",
      INVALID_START_DATE: "Invalid start date.",
      INVALID_END_DATE: "Invalid end date.",
    };

    if (errors[message]) {
      return res.status(400).json({ success: false, message: errors[message] });
    }

    console.error("GET EXPENSES ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load expenses.",
    });
  }
};

/* =========================================================
   GET ONE EXPENSE
========================================================= */

export const getExpense = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const id = normalizeString(req.params.id, 100);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Expense ID is required.",
      });
    }

    const expense = await prisma.expense.findFirst({
      where: { id, organizationId },
      include: getExpenseInclude,
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found.",
      });
    }

    return res.json({ success: true, expense });
  } catch (error) {
    console.error("GET EXPENSE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load expense.",
    });
  }
};

/* =========================================================
   CREATE EXPENSE
========================================================= */

export const createExpense = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const category = normalizeString(req.body?.category);
    const description = normalizeString(req.body?.description);
    const currency =
      normalizeOptionalString(req.body?.currency, 10)?.toUpperCase() ?? "KES";
    const vendorId = normalizeOptionalString(req.body?.vendorId, 100);
    const expenseAccountId = normalizeOptionalString(
      req.body?.expenseAccountId,
      100
    );
    const paymentAccountId = normalizeOptionalString(
      req.body?.paymentAccountId,
      100
    );
    const bankAccountId = normalizeOptionalString(
      req.body?.bankAccountId,
      100
    );
    const paymentMethod = normalizeOptionalString(
      req.body?.paymentMethod,
      50
    );
    const amount = parseMoney(req.body?.amount);
    const expenseDate = parseDate(req.body?.expenseDate);

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Expense category is required.",
      });
    }

    if (!description) {
      return res.status(400).json({
        success: false,
        message: "Expense description is required.",
      });
    }

    if (!amount) {
      return res.status(400).json({
        success: false,
        message: "Expense amount must be a valid positive KES amount.",
      });
    }

    if (!expenseDate) {
      return res.status(400).json({
        success: false,
        message: "A valid expense date is required.",
      });
    }

    if (!expenseAccountId) {
      return res.status(400).json({
        success: false,
        message: "Expense account is required.",
      });
    }

    if (!paymentAccountId) {
      return res.status(400).json({
        success: false,
        message: "Credit/payable account is required.",
      });
    }

    const expense = await prisma.$transaction(async (tx) => {
      const expenseAccount = await validateAccount(
        tx,
        organizationId,
        expenseAccountId,
        ["EXPENSE"],
        "EXPENSE_ACCOUNT"
      );

      const paymentAccount = await validateAccount(
        tx,
        organizationId,
        paymentAccountId,
        ["ASSET", "LIABILITY"],
        "PAYMENT_ACCOUNT"
      );

      if (expenseAccount.id === paymentAccount.id) {
        throw new Error("ACCOUNT_SIDES_MUST_DIFFER");
      }

      if (vendorId) {
        const vendor = await tx.vendor.findFirst({
          where: { id: vendorId, organizationId },
          select: { id: true },
        });
        if (!vendor) throw new Error("VENDOR_INVALID");
      }

      await validateBankAccount(tx, organizationId, bankAccountId, currency);

      const year = expenseDate.getUTCFullYear();
      const expenseCode = await generateExpenseCode(
        tx,
        organizationId,
        year
      );

      const created = await tx.expense.create({
        data: {
          organizationId,
          expenseCode,
          vendorId,
          category,
          description,
          amount,
          currency,
          expenseDate,
          status: EXPENSE_STATUS.DRAFT,
          paymentStatus: PAYMENT_STATUS.UNPAID,
          paymentMethod,
          expenseAccountId,
          paymentAccountId,
          bankAccountId,
        },
        include: getExpenseInclude,
      });

      await audit(tx, organizationId, getUserId(req), "CREATE", {
        expenseId: created.id,
        expenseCode: created.expenseCode,
        amount,
        currency,
      });

      return created;
    });

    return res.status(201).json({
      success: true,
      message: "Expense created successfully.",
      expense,
    });
  } catch (error) {
    const message = getErrorMessage(error);

    const errors: Record<string, [number, string]> = {
      EXPENSE_ACCOUNT_INVALID: [400, "Selected expense account is invalid for this organization."],
      PAYMENT_ACCOUNT_INVALID: [400, "Selected credit/payable account is invalid for this organization."],
      ACCOUNT_SIDES_MUST_DIFFER: [400, "Expense and credit accounts must be different."],
      VENDOR_INVALID: [400, "Selected vendor does not belong to this organization."],
      BANK_ACCOUNT_INVALID: [400, "Selected bank account is not active in this organization."],
      BANK_CURRENCY_MISMATCH: [400, "Bank account currency does not match the expense currency."],
      EXPENSE_CODE_EXHAUSTED: [500, "Expense numbering capacity has been exhausted."],
    };

    if (errors[message]) {
      return res.status(errors[message][0]).json({
        success: false,
        message: errors[message][1],
      });
    }

    if (isPrismaUniqueError(error)) {
      return res.status(409).json({
        success: false,
        message: "The expense could not be created because a unique value already exists.",
      });
    }

    console.error("CREATE EXPENSE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create expense.",
    });
  }
};

/* =========================================================
   SUBMIT EXPENSE FOR APPROVAL
========================================================= */

export const submitExpense = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const id = normalizeString(req.params.id, 100);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Expense ID is required.",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      await lockExpense(tx, organizationId, id);

      const expense = await tx.expense.findFirst({
        where: { id, organizationId },
      });

      if (!expense) throw new Error("EXPENSE_NOT_FOUND");
      if (expense.status !== EXPENSE_STATUS.DRAFT) {
        throw new Error("EXPENSE_NOT_DRAFT");
      }
      if (!expense.expenseAccountId || !expense.paymentAccountId) {
        throw new Error("EXPENSE_ACCOUNTS_MISSING");
      }

      await validateAccount(
        tx,
        organizationId,
        expense.expenseAccountId,
        ["EXPENSE"],
        "EXPENSE_ACCOUNT"
      );

      await validateAccount(
        tx,
        organizationId,
        expense.paymentAccountId,
        ["ASSET", "LIABILITY"],
        "PAYMENT_ACCOUNT"
      );

      if (expense.vendorId) {
        const vendor = await tx.vendor.findFirst({
          where: { id: expense.vendorId, organizationId },
          select: { id: true },
        });
        if (!vendor) throw new Error("VENDOR_INVALID");
      }

      const existingApproval = expense.approvalId
        ? await tx.approval.findFirst({
            where: {
              id: expense.approvalId,
              organizationId,
            },
          })
        : null;

      if (existingApproval && existingApproval.status === "PENDING") {
        throw new Error("EXPENSE_ALREADY_SUBMITTED");
      }

      const approval = await tx.approval.create({
        data: {
          organizationId,
          module: "EXPENSE",
          description: `${expense.expenseCode} — ${expense.description}`,
          amount: expense.amount,
          requestedBy: getUserId(req),
          status: "PENDING",
        },
      });

      const updated = await tx.expense.update({
        where: { id: expense.id },
        data: {
          status: EXPENSE_STATUS.PENDING_APPROVAL,
          approvalId: approval.id,
        },
        include: getExpenseInclude,
      });

      await audit(tx, organizationId, getUserId(req), "SUBMIT", {
        expenseId: expense.id,
        expenseCode: expense.expenseCode,
        approvalId: approval.id,
      });

      return { expense: updated, approval };
    });

    return res.json({
      success: true,
      message: "Expense submitted for approval successfully.",
      ...result,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    const errors: Record<string, [number, string]> = {
      EXPENSE_NOT_FOUND: [404, "Expense not found."],
      EXPENSE_NOT_DRAFT: [409, "Only draft expenses can be submitted."],
      EXPENSE_ACCOUNTS_MISSING: [400, "Expense and credit/payable accounts are required before submission."],
      EXPENSE_ALREADY_SUBMITTED: [409, "This expense already has a pending approval."],
      EXPENSE_ACCOUNT_INVALID: [400, "The expense account is no longer valid for this organization."],
      PAYMENT_ACCOUNT_INVALID: [400, "The credit/payable account is no longer valid for this organization."],
      VENDOR_INVALID: [400, "The vendor is no longer valid for this organization."],
    };

    if (errors[message]) {
      return res.status(errors[message][0]).json({
        success: false,
        message: errors[message][1],
      });
    }

    console.error("SUBMIT EXPENSE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit expense for approval.",
    });
  }
};

/* =========================================================
   POST EXPENSE TO GENERAL LEDGER
========================================================= */

export const postExpense = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const id = normalizeString(req.params.id, 100);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Expense ID is required.",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      await lockExpense(tx, organizationId, id);

      const expense = await tx.expense.findFirst({
        where: { id, organizationId },
      });

      if (!expense) throw new Error("EXPENSE_NOT_FOUND");

      if (expense.status === EXPENSE_STATUS.POSTED) {
        if (!expense.journalEntryId) {
          throw new Error("POSTED_EXPENSE_WITHOUT_JOURNAL");
        }

        const journal = await tx.journalEntry.findFirst({
          where: {
            id: expense.journalEntryId,
            organizationId,
          },
          include: { lines: true },
        });

        if (!journal) throw new Error("POSTED_EXPENSE_WITHOUT_JOURNAL");

        return {
          expense,
          journalEntry: journal,
          alreadyPosted: true,
        };
      }

      if (expense.status !== EXPENSE_STATUS.APPROVED) {
        throw new Error("EXPENSE_NOT_APPROVED");
      }

      if (!expense.expenseAccountId || !expense.paymentAccountId) {
        throw new Error("EXPENSE_ACCOUNTS_MISSING");
      }

      const expenseAccount = await validateAccount(
        tx,
        organizationId,
        expense.expenseAccountId,
        ["EXPENSE"],
        "EXPENSE_ACCOUNT"
      );

      const creditAccount = await validateAccount(
        tx,
        organizationId,
        expense.paymentAccountId,
        ["ASSET", "LIABILITY"],
        "PAYMENT_ACCOUNT"
      );

      const amount = parseMoney(expense.amount);
      if (!amount) throw new Error("INVALID_EXPENSE_AMOUNT");

      const transactionDate = expense.expenseDate;
      const reference = await generateJournalReference(
        tx,
        organizationId,
        "EXPENSE-JOURNAL"
      );

      const lines = [
        {
          accountId: expenseAccount.id,
          lineNumber: 1,
          memo: expense.description,
          debit: amount,
          credit: 0,
        },
        {
          accountId: creditAccount.id,
          lineNumber: 2,
          memo: expense.description,
          debit: 0,
          credit: amount,
        },
      ];

      validateBalancedJournal(lines);

      const journalEntry = await tx.journalEntry.create({
        data: {
          organizationId,
          reference,
          description: `${expense.expenseCode} — ${expense.description}`,
          debitAccountId: expenseAccount.id,
          creditAccountId: creditAccount.id,
          amount,
          createdBy: getUserId(req),
          transactionDate,
          status: JOURNAL_STATUS.POSTED,
          postedAt: new Date(),
          postedBy: getUserId(req),
          notes: `Expense posting ${expense.expenseCode}`,
          lines: {
            create: lines,
          },
        },
        include: { lines: true },
      });

      validateBalancedJournal(
        journalEntry.lines.map((line) => ({
          debit: Number(line.debit),
          credit: Number(line.credit),
        }))
      );

      const paymentStatus =
        creditAccount.type === "ASSET"
          ? PAYMENT_STATUS.PAID
          : PAYMENT_STATUS.UNPAID;

      const updated = await tx.expense.update({
        where: { id: expense.id },
        data: {
          status: EXPENSE_STATUS.POSTED,
          journalEntryId: journalEntry.id,
          paymentStatus,
          paymentDate:
            paymentStatus === PAYMENT_STATUS.PAID
              ? transactionDate
              : null,
        },
        include: getExpenseInclude,
      });

      await audit(tx, organizationId, getUserId(req), "POST", {
        expenseId: expense.id,
        expenseCode: expense.expenseCode,
        journalEntryId: journalEntry.id,
        journalReference: journalEntry.reference,
        amount,
        debitAccountId: expenseAccount.id,
        creditAccountId: creditAccount.id,
      });

      return {
        expense: updated,
        journalEntry,
        alreadyPosted: false,
      };
    });

    return res.json({
      success: true,
      message: result.alreadyPosted
        ? "Expense is already posted to the General Ledger."
        : "Expense posted to the General Ledger successfully.",
      expense: result.expense,
      journalEntry: result.journalEntry,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    const errors: Record<string, [number, string]> = {
      EXPENSE_NOT_FOUND: [404, "Expense not found."],
      EXPENSE_NOT_APPROVED: [409, "Only approved expenses can be posted."],
      EXPENSE_ACCOUNTS_MISSING: [400, "Expense and credit/payable accounts are required before posting."],
      EXPENSE_ACCOUNT_INVALID: [400, "The expense account is invalid for this organization."],
      PAYMENT_ACCOUNT_INVALID: [400, "The credit/payable account is invalid for this organization."],
      INVALID_EXPENSE_AMOUNT: [409, "The expense amount is invalid."],
      JOURNAL_LINES_INVALID: [500, "The generated accounting lines are invalid."],
      JOURNAL_UNBALANCED: [500, "The generated accounting journal is unbalanced."],
      POSTED_EXPENSE_WITHOUT_JOURNAL: [500, "The expense is marked posted but has no valid General Ledger journal."],
    };

    if (errors[message]) {
      return res.status(errors[message][0]).json({
        success: false,
        message: errors[message][1],
      });
    }

    console.error("POST EXPENSE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to post expense.",
    });
  }
};

const generateJournalReference = async (
  tx: Tx,
  organizationId: string,
  lockKey: string
): Promise<string> => {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtext(${`${organizationId}:${lockKey}`})
    )
  `;

  const latest = await tx.journalEntry.findFirst({
    where: {
      organizationId,
      reference: { startsWith: "JE-" },
    },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });

  const match = latest?.reference.match(/^JE-(\d+)$/);
  const next = match ? Number(match[1]) + 1 : 1;

  if (!Number.isSafeInteger(next) || next > 999999999) {
    throw new Error("JOURNAL_REFERENCE_EXHAUSTED");
  }

  return `JE-${String(next).padStart(4, "0")}`;
};

/* =========================================================
   RECORD AND POST EXPENSE PAYMENT
========================================================= */

export const recordExpensePayment = async (
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

    const id = normalizeString(req.params.id, 100);
    const paymentReference = normalizeOptionalString(
      req.body?.paymentReference,
      MAX_REFERENCE_LENGTH
    );
    const paymentMethod = normalizeOptionalString(req.body?.paymentMethod, 50);
    const bankAccountId = normalizeOptionalString(req.body?.bankAccountId, 100);
    const settlementAccountId = normalizeOptionalString(
      req.body?.settlementAccountId ?? req.body?.paymentAccountId,
      100
    );
    const paymentDate = req.body?.paymentDate
      ? parseDate(req.body.paymentDate)
      : new Date();

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Expense ID is required.",
      });
    }

    if (!paymentReference) {
      return res.status(400).json({
        success: false,
        message: "Payment reference is required.",
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required.",
      });
    }

    if (!paymentDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment date.",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      await lockExpense(tx, organizationId, id);

      const expense = await tx.expense.findFirst({
        where: { id, organizationId },
      });

      if (!expense) throw new Error("EXPENSE_NOT_FOUND");
      if (expense.status !== EXPENSE_STATUS.POSTED) {
        throw new Error("EXPENSE_NOT_POSTED");
      }

      if (expense.paymentStatus === PAYMENT_STATUS.PAID) {
        throw new Error("EXPENSE_ALREADY_PAID");
      }

      if (expense.paymentStatus === PAYMENT_STATUS.PENDING_APPROVAL) {
        throw new Error("PAYMENT_ALREADY_PENDING");
      }

      if (!expense.paymentAccountId) {
        throw new Error("PAYABLE_ACCOUNT_MISSING");
      }

      const payableAccount = await validateAccount(
        tx,
        organizationId,
        expense.paymentAccountId,
        ["LIABILITY"],
        "PAYABLE_ACCOUNT"
      );

      if (!settlementAccountId) {
        throw new Error("SETTLEMENT_ACCOUNT_REQUIRED");
      }

      const settlementAccount = await validateAccount(
        tx,
        organizationId,
        settlementAccountId,
        ["ASSET"],
        "SETTLEMENT_ACCOUNT"
      );

      if (settlementAccount.id === payableAccount.id) {
        throw new Error("SETTLEMENT_ACCOUNT_INVALID");
      }

      await validateBankAccount(
        tx,
        organizationId,
        bankAccountId,
        expense.currency
      );

      /*
       * Idempotency is organization-scoped. The expense row is locked
       * before this check, so concurrent requests for the same expense
       * cannot both post the settlement.
       */
      const duplicatePayment = await tx.journalEntry.findFirst({
        where: {
          organizationId,
          status: { in: [JOURNAL_STATUS.POSTED, JOURNAL_STATUS.APPROVED] },
          notes: {
            contains: `Payment Reference: ${paymentReference}`,
          },
        },
        select: {
          id: true,
          reference: true,
          amount: true,
          transactionDate: true,
        },
      });

      if (duplicatePayment) {
        throw new Error("PAYMENT_REFERENCE_ALREADY_USED");
      }

      const amount = parseMoney(expense.amount);
      if (!amount) throw new Error("INVALID_EXPENSE_AMOUNT");

      const reference = await generateJournalReference(
        tx,
        organizationId,
        "EXPENSE-PAYMENT"
      );

      const lines = [
        {
          accountId: payableAccount.id,
          lineNumber: 1,
          memo: `Settlement of ${expense.expenseCode}`,
          debit: amount,
          credit: 0,
        },
        {
          accountId: settlementAccount.id,
          lineNumber: 2,
          memo: `Payment of ${expense.expenseCode}`,
          debit: 0,
          credit: amount,
        },
      ];

      validateBalancedJournal(lines);

      const journalEntry = await tx.journalEntry.create({
        data: {
          organizationId,
          reference,
          description: `Payment — ${expense.expenseCode}`,
          debitAccountId: payableAccount.id,
          creditAccountId: settlementAccount.id,
          amount,
          createdBy: getUserId(req),
          transactionDate: paymentDate,
          status: JOURNAL_STATUS.POSTED,
          postedAt: new Date(),
          postedBy: getUserId(req),
          notes: `Expense payment ${expense.expenseCode} | Payment Reference: ${paymentReference} | Method: ${paymentMethod}`,
          lines: {
            create: lines,
          },
        },
        include: { lines: true },
      });

      validateBalancedJournal(
        journalEntry.lines.map((line) => ({
          debit: Number(line.debit),
          credit: Number(line.credit),
        }))
      );

      const updated = await tx.expense.update({
        where: { id: expense.id },
        data: {
          paymentStatus: PAYMENT_STATUS.PAID,
          paymentDate,
          paymentReference,
          paymentMethod,
          bankAccountId,
        },
        include: getExpenseInclude,
      });

      await audit(tx, organizationId, getUserId(req), "PAYMENT_POSTED", {
        expenseId: expense.id,
        expenseCode: expense.expenseCode,
        journalEntryId: journalEntry.id,
        journalReference: journalEntry.reference,
        paymentReference,
        paymentMethod,
        settlementAccountId,
        amount,
        paymentDate: paymentDate.toISOString(),
      });

      return {
        expense: updated,
        journalEntry,
      };
    });

    return res.json({
      success: true,
      message: "Expense payment posted and reconciled successfully.",
      ...result,
    });
  } catch (error) {
    const message = getErrorMessage(error);

    const errors: Record<string, [number, string]> = {
      EXPENSE_NOT_FOUND: [404, "Expense not found."],
      EXPENSE_NOT_POSTED: [409, "Only posted expenses can be paid."],
      EXPENSE_ALREADY_PAID: [409, "Expense has already been paid."],
      PAYMENT_ALREADY_PENDING: [409, "Expense payment is already pending."],
      PAYABLE_ACCOUNT_MISSING: [400, "The expense has no payable account configured."],
      PAYABLE_ACCOUNT_INVALID: [400, "The expense payable account is invalid for this organization."],
      SETTLEMENT_ACCOUNT_REQUIRED: [400, "A settlement asset account is required."],
      SETTLEMENT_ACCOUNT_INVALID: [400, "The settlement account must be an asset account belonging to this organization."],
      BANK_ACCOUNT_INVALID: [400, "Selected bank account is not active in this organization."],
      BANK_CURRENCY_MISMATCH: [400, "Bank account currency does not match the expense currency."],
      PAYMENT_REFERENCE_ALREADY_USED: [409, "This payment reference has already been used in this organization."],
      INVALID_EXPENSE_AMOUNT: [409, "The expense amount is invalid."],
      JOURNAL_UNBALANCED: [500, "The payment journal is unbalanced."],
      JOURNAL_LINES_INVALID: [500, "The payment journal lines are invalid."],
    };

    if (errors[message]) {
      return res.status(errors[message][0]).json({
        success: false,
        message: errors[message][1],
      });
    }

    console.error("RECORD EXPENSE PAYMENT ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to record expense payment.",
    });
  }
};

/* =========================================================
   REVERSE POSTED EXPENSE
========================================================= */

export const reverseExpense = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const id = normalizeString(req.params.id, 100);
    const reason = normalizeString(req.body?.reason);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Expense ID is required.",
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "A reversal reason is required.",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      await lockExpense(tx, organizationId, id);

      const expense = await tx.expense.findFirst({
        where: { id, organizationId },
      });

      if (!expense) throw new Error("EXPENSE_NOT_FOUND");
      if (expense.status !== EXPENSE_STATUS.POSTED) {
        throw new Error("EXPENSE_NOT_REVERSIBLE");
      }

      if (expense.paymentStatus === PAYMENT_STATUS.PAID) {
        throw new Error("PAID_EXPENSE_REQUIRES_PAYMENT_REVERSAL");
      }

      if (!expense.journalEntryId) {
        throw new Error("POSTED_EXPENSE_WITHOUT_JOURNAL");
      }

      const original = await tx.journalEntry.findFirst({
        where: {
          id: expense.journalEntryId,
          organizationId,
        },
        include: { lines: true },
      });

      if (!original) throw new Error("POSTED_EXPENSE_WITHOUT_JOURNAL");
      if (
        original.status !== JOURNAL_STATUS.POSTED &&
        original.status !== JOURNAL_STATUS.APPROVED
      ) {
        throw new Error("EXPENSE_JOURNAL_NOT_REVERSIBLE");
      }

      const alreadyReversed = await tx.journalEntry.findFirst({
        where: {
          organizationId,
          reversalOfId: original.id,
        },
        select: { id: true, reference: true },
      });

      if (alreadyReversed) throw new Error("EXPENSE_ALREADY_REVERSED");

      if (!original.lines.length) throw new Error("JOURNAL_LINES_INVALID");

      const reversalLines = original.lines.map((line) => ({
        accountId: line.accountId,
        lineNumber: line.lineNumber,
        memo: `Reversal — ${expense.expenseCode}`,
        debit: roundMoney(Number(line.credit)),
        credit: roundMoney(Number(line.debit)),
      }));

      validateBalancedJournal(reversalLines);

      const reference = await generateJournalReference(
        tx,
        organizationId,
        "EXPENSE-REVERSAL"
      );

      const reversal = await tx.journalEntry.create({
        data: {
          organizationId,
          reference,
          description: `Reversal — ${expense.expenseCode}`,
          debitAccountId: original.creditAccountId,
          creditAccountId: original.debitAccountId,
          amount: original.amount,
          createdBy: getUserId(req),
          transactionDate: new Date(),
          status: JOURNAL_STATUS.POSTED,
          postedAt: new Date(),
          postedBy: getUserId(req),
          notes: `Reversal of ${original.reference} | Reason: ${reason}`,
          reversalOfId: original.id,
          reversalReason: reason,
          reversedAt: new Date(),
          reversedBy: getUserId(req),
          lines: { create: reversalLines },
        },
        include: { lines: true },
      });

      validateBalancedJournal(
        reversal.lines.map((line) => ({
          debit: Number(line.debit),
          credit: Number(line.credit),
        }))
      );

      await tx.journalEntry.update({
        where: { id: original.id },
        data: {
          status: JOURNAL_STATUS.REVERSED,
          reversedAt: new Date(),
          reversedBy: getUserId(req),
          reversalReason: reason,
        },
      });

      const updated = await tx.expense.update({
        where: { id: expense.id },
        data: { status: EXPENSE_STATUS.REVERSED },
        include: getExpenseInclude,
      });

      await audit(tx, organizationId, getUserId(req), "REVERSE", {
        expenseId: expense.id,
        expenseCode: expense.expenseCode,
        originalJournalId: original.id,
        reversalJournalId: reversal.id,
        reason,
      });

      return { expense: updated, reversalJournal: reversal };
    });

    return res.json({
      success: true,
      message: "Expense reversed successfully.",
      ...result,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    const errors: Record<string, [number, string]> = {
      EXPENSE_NOT_FOUND: [404, "Expense not found."],
      EXPENSE_NOT_REVERSIBLE: [409, "Only posted expenses can be reversed."],
      PAID_EXPENSE_REQUIRES_PAYMENT_REVERSAL: [409, "A paid expense must have its settlement reversed before the expense recognition is reversed."],
      POSTED_EXPENSE_WITHOUT_JOURNAL: [500, "The posted expense has no valid General Ledger journal."],
      EXPENSE_JOURNAL_NOT_REVERSIBLE: [409, "The linked General Ledger journal cannot be reversed."],
      EXPENSE_ALREADY_REVERSED: [409, "This expense has already been reversed."],
      JOURNAL_LINES_INVALID: [500, "The reversal journal lines are invalid."],
      JOURNAL_UNBALANCED: [500, "The reversal journal is unbalanced."],
    };

    if (errors[message]) {
      return res.status(errors[message][0]).json({
        success: false,
        message: errors[message][1],
      });
    }

    console.error("REVERSE EXPENSE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reverse expense.",
    });
  }
};

/* =========================================================
   DELETE EXPENSE
========================================================= */

export const deleteExpense = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const id = normalizeString(req.params.id, 100);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Expense ID is required.",
      });
    }

    await prisma.$transaction(async (tx) => {
      await lockExpense(tx, organizationId, id);

      const expense = await tx.expense.findFirst({
        where: { id, organizationId },
      });

      if (!expense) throw new Error("EXPENSE_NOT_FOUND");

      if (expense.status !== EXPENSE_STATUS.DRAFT) {
        throw new Error("EXPENSE_NOT_DELETABLE");
      }

      await tx.expense.delete({
        where: { id: expense.id },
      });

      await audit(tx, organizationId, getUserId(req), "DELETE", {
        expenseId: expense.id,
        expenseCode: expense.expenseCode,
      });
    });

    return res.json({
      success: true,
      message: "Expense deleted successfully.",
    });
  } catch (error) {
    const message = getErrorMessage(error);
    const errors: Record<string, [number, string]> = {
      EXPENSE_NOT_FOUND: [404, "Expense not found."],
      EXPENSE_NOT_DELETABLE: [409, "Only draft expenses can be deleted."],
    };

    if (errors[message]) {
      return res.status(errors[message][0]).json({
        success: false,
        message: errors[message][1],
      });
    }

    console.error("DELETE EXPENSE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete expense.",
    });
  }
};
