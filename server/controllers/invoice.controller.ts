import { Response } from "express";
import {
  Prisma,
  Account,
} from "@prisma/client";

import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   ZIYA FOS
   INVOICE CONTROLLER

   Production accounting model:

   DRAFT
      |
      v
   FINALIZE
      |
      +--> Invoice POSTED
      |
      +--> Accounts Receivable ACTIVE
      |
      +--> Journal:
             Dr Accounts Receivable
             Cr Revenue
             Cr Tax Payable

   PAYMENT
      |
      +--> Accounts Receivable reduced
      |
      +--> Invoice payment status synchronized
      |
      +--> Journal:
             Dr Cash / Bank / M-Pesa
             Cr Accounts Receivable

   VOID
      |
      +--> Only permitted when no payment has occurred
      |
      +--> Original invoice journal remains immutable
      |
      +--> Reversal journal:
             Dr Revenue
             Dr Tax Payable
             Cr Accounts Receivable

   Design principles:
   - Strict tenant isolation
   - Server-side invoice numbering
   - Organization-scoped numbering
   - Draft -> Posted lifecycle
   - Server-side calculations
   - Tenant-scoped customers
   - Tenant-scoped Chart of Accounts
   - Double-entry accounting
   - Atomic invoice + AR + journal posting
   - Immutable posted invoices
   - Controlled reversal instead of deletion
   - Pagination
   - Search
   - Filtering
   - Database aggregation
   - Concurrency protection
   - Audit trail
========================================================= */


/* =========================================================
   TYPES
========================================================= */

type InvoiceLineInput = {
  id?: string;
  accountId?: string | null;
  description: string;
  quantity?: number;
  unitPrice: number;
  discountAmount?: number;
  taxRate?: number;
};

type NormalizedInvoiceLine = {
  lineNumber: number;
  accountId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  lineSubtotal: number;
  lineTotal: number;
};

type CalculatedInvoice = {
  lines: NormalizedInvoiceLine[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
};

type InvoiceWithRelations = Prisma.InvoiceGetPayload<{
  include: {
    customer: true;
    invoiceLines: {
      include: {
        account: true;
      };
    };
  };
}>;


/* =========================================================
   CONSTANTS
========================================================= */

const ACCOUNT_CODES = {
  ACCOUNTS_RECEIVABLE: "1200",
  TAX_PAYABLE: "2300",
  SALES_REVENUE: "4100",
} as const;

const INVOICE_STATUS = {
  DRAFT: "DRAFT",
  POSTED: "POSTED",
  VOID: "VOID",
} as const;

const PAYMENT_STATUS = {
  UNPAID: "UNPAID",
  PARTIALLY_PAID: "PARTIALLY_PAID",
  PAID: "PAID",
} as const;

const AR_STATUS = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  CLOSED: "CLOSED",
  VOID: "VOID",
} as const;

const JOURNAL_STATUS = {
  DRAFT: "DRAFT",
  POSTED: "POSTED",
  APPROVED: "APPROVED",
} as const;

const MONEY_TOLERANCE = 0.01;
const MAX_MONEY_AMOUNT = 999999999999.99;
const MAX_SEARCH_LENGTH = 100;

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;


/* =========================================================
   GENERAL HELPERS
========================================================= */

const getOrganizationId = (
  req: AuthRequest
): string | null =>
  req.user?.organizationId ?? null;

const getActorId = (
  req: AuthRequest
): string =>
  String(
    req.user?.userId ??
      "SYSTEM"
  );

const normalizeString = (
  value: unknown
): string =>
  value === undefined ||
  value === null
    ? ""
    : String(value).trim();

const roundMoney = (
  value: number
): number =>
  Math.round(
    (value + Number.EPSILON) * 100
  ) / 100;

const toNumber = (
  value: unknown,
  fallback = 0
): number => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return fallback;
  }

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
};

const parseDate = (
  value: unknown
): Date | null => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value).trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T00:00:00.000Z`)
    : new Date(raw);

  return Number.isNaN(date.getTime()) ? null : date;
};

const parseInputNumber = (
  value: unknown,
  label: string,
  options: { min?: number; max?: number; required?: boolean } = {}
): number => {
  const raw = value === undefined || value === null || value === "" ? null : value;
  if (raw === null) {
    if (options.required) throw new Error(`${label} is required.`);
    return options.min ?? 0;
  }

  const number = typeof raw === "string" ? Number(raw.replace(/,/g, "").trim()) : Number(raw);
  if (!Number.isFinite(number)) throw new Error(`${label} must be a valid number.`);
  if (options.min !== undefined && number < options.min) throw new Error(`${label} must be at least ${options.min}.`);
  if (options.max !== undefined && number > options.max) throw new Error(`${label} must not exceed ${options.max}.`);
  if (Math.round(number * 100) / 100 !== number && label !== "Tax rate" && label !== "Quantity") {
    throw new Error(`${label} must have no more than 2 decimal places.`);
  }
  return number;
};

const isEffectivelyZero = (
  value: number
): boolean =>
  Math.abs(value) <=
  MONEY_TOLERANCE;

const getPage = (value: unknown): number => {
  if (value === undefined || value === null || String(value).trim() === "") return DEFAULT_PAGE;
  if (!/^\d+$/.test(String(value).trim())) throw new Error("Page must be a positive integer.");
  const page = Number(value);
  if (!Number.isSafeInteger(page) || page < 1) throw new Error("Page must be a positive integer.");
  return page;
};

const getPageSize = (value: unknown): number => {
  if (value === undefined || value === null || String(value).trim() === "") return DEFAULT_PAGE_SIZE;
  if (!/^\d+$/.test(String(value).trim())) throw new Error("Page size must be a positive integer.");
  const pageSize = Number(value);
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) throw new Error("Page size must be a positive integer.");
  return Math.min(pageSize, MAX_PAGE_SIZE);
};

const getErrorMessage = (
  error: unknown
): string =>
  error instanceof Error
    ? error.message
    : String(error);


/* =========================================================
   AUDIT TRAIL
========================================================= */

const createAuditTrail = async (
  tx: Prisma.TransactionClient,
  organizationId: string,
  user: string,
  action: string,
  details: Record<string, unknown>
): Promise<void> => {
  await tx.auditTrail.create({
    data: {
      organizationId,
      user,
      action,
      module: "INVOICE",
      details:
        JSON.stringify(details),
    },
  });
};


/* =========================================================
   TENANT ACCOUNT HELPERS
========================================================= */

const getAccountByCode = async (
  tx: Prisma.TransactionClient,
  organizationId: string,
  code: string
): Promise<Account | null> =>
  tx.account.findFirst({
    where: {
      organizationId,
      code,
    },
  });

const getAccountById = async (
  tx: Prisma.TransactionClient,
  organizationId: string,
  accountId: string
): Promise<Account | null> =>
  tx.account.findFirst({
    where: {
      organizationId,
      id: accountId,
    },
  });

const requireAccountByCode = async (
  tx: Prisma.TransactionClient,
  organizationId: string,
  code: string,
  label: string
): Promise<Account> => {
  const account =
    await getAccountByCode(
      tx,
      organizationId,
      code
    );

  if (!account) {
    throw new Error(
      `${label} account (${code}) is not configured for this organization.`
    );
  }

  return account;
};

const getCustomerForOrganization =
  async (
    tx: Prisma.TransactionClient,
    organizationId: string,
    customerId: string
  ) =>
    tx.customer.findFirst({
      where: {
        id: customerId,
        organizationId,
      },
    });


/* =========================================================
   INVOICE NUMBER GENERATION
========================================================= */

/**
 * Invoice numbers are:
 *
 * INV-YYYY-000001
 *
 * Sequence is:
 * - organization-specific
 * - calendar-year-specific
 *
 * A PostgreSQL advisory transaction lock prevents two
 * concurrent requests for the same tenant/year from generating
 * the same number.
 */
const generateInvoiceNumber =
  async (
    tx: Prisma.TransactionClient,
    organizationId: string,
    issueDate: Date
  ): Promise<string> => {
    const year =
      issueDate.getUTCFullYear();

    const prefix =
      `INV-${year}-`;

    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(
        hashtextextended(
          ${`${organizationId}:${year}:invoice-number`},
          0
        )
      )
    `;

    const [
      existingInvoices,
      existingReceivables,
    ] = await Promise.all([
      tx.invoice.findMany({
        where: {
          organizationId,
          invoiceNumber: {
            startsWith:
              prefix,
          },
        },
        select: {
          invoiceNumber: true,
        },
      }),

      tx.accountsReceivable.findMany(
        {
          where: {
            organizationId,
            invoiceNumber: {
              startsWith:
                prefix,
            },
          },
          select: {
            invoiceNumber: true,
          },
        }
      ),
    ]);

    let highestSequence = 0;

    for (
      const record of [
        ...existingInvoices,
        ...existingReceivables,
      ]
    ) {
      const suffix =
        record.invoiceNumber.slice(
          prefix.length
        );

      const sequence =
        Number(suffix);

      if (
        Number.isInteger(sequence) &&
        sequence > highestSequence
      ) {
        highestSequence =
          sequence;
      }
    }

    return `${prefix}${String(
      highestSequence + 1
    ).padStart(6, "0")}`;
  };


/* =========================================================
   JOURNAL REFERENCE
========================================================= */

const generateJournalReference = (
  invoiceNumber: string
): string =>
  `INV-${invoiceNumber}-POST`;

const generateReversalReference = (
  invoiceNumber: string
): string =>
  `REV-${invoiceNumber}`;


/* =========================================================
   INVOICE LINE CALCULATION
========================================================= */

const calculateInvoiceLines =
  async (
    tx: Prisma.TransactionClient,
    organizationId: string,
    inputLines: unknown
  ): Promise<CalculatedInvoice> => {
    if (!Array.isArray(inputLines)) {
      throw new Error(
        "Invoice lines must be an array."
      );
    }

    if (inputLines.length === 0) {
      throw new Error(
        "At least one invoice line is required."
      );
    }

    if (inputLines.length > 500) {
      throw new Error(
        "An invoice cannot contain more than 500 lines."
      );
    }
const defaultRevenueAccount =
      await requireAccountByCode(
        tx,
        organizationId,
        ACCOUNT_CODES.SALES_REVENUE,
        "Sales Revenue"
      );

    if (
      defaultRevenueAccount.type !==
      "INCOME"
    ) {
      throw new Error(
        "Sales Revenue account (4100) must be an income account."
      );
    }

    const lines:
      NormalizedInvoiceLine[] = [];

    let subtotal = 0;
    let taxAmount = 0;
    let totalAmount = 0;

    for (
      let index = 0;
      index < inputLines.length;
      index++
    ) {
      const raw =
        inputLines[
          index
        ] as InvoiceLineInput;

      const description =
        normalizeString(
          raw?.description
        );

      if (!description) {
        throw new Error(
          `Invoice line ${
            index + 1
          }: description is required.`
        );
      }

      const quantity = parseInputNumber(raw?.quantity, `Invoice line ${index + 1}: quantity`, { min: 0.000001, max: 1000000000 });
      const unitPrice = parseInputNumber(raw?.unitPrice, `Invoice line ${index + 1}: unit price`, { min: 0, max: MAX_MONEY_AMOUNT });
      const discountAmount = parseInputNumber(raw?.discountAmount, `Invoice line ${index + 1}: discount`, { min: 0, max: MAX_MONEY_AMOUNT });
      const taxRate = parseInputNumber(raw?.taxRate, `Invoice line ${index + 1}: tax rate`, { min: 0, max: 100 });

      if (
        !Number.isFinite(
          quantity
        ) ||
        quantity <= 0
      ) {
        throw new Error(
          `Invoice line ${
            index + 1
          }: quantity must be greater than zero.`
        );
      }

      if (
        !Number.isFinite(
          unitPrice
        ) ||
        unitPrice < 0
      ) {
        throw new Error(
          `Invoice line ${
            index + 1
          }: unit price cannot be negative.`
        );
      }

      if (
        !Number.isFinite(
          discountAmount
        ) ||
        discountAmount < 0
      ) {
        throw new Error(
          `Invoice line ${
            index + 1
          }: discount cannot be negative.`
        );
      }

      if (
        !Number.isFinite(
          taxRate
        ) ||
        taxRate < 0 ||
        taxRate > 100
      ) {
        throw new Error(
          `Invoice line ${
            index + 1
          }: tax rate must be between 0 and 100.`
        );
      }

      const grossAmount =
        roundMoney(
          quantity *
            unitPrice
        );

      if (
        discountAmount >
        grossAmount +
          MONEY_TOLERANCE
      ) {
        throw new Error(
          `Invoice line ${
            index + 1
          }: discount cannot exceed the line amount.`
        );
      }

      const lineSubtotal =
        roundMoney(
          Math.max(
            0,
            grossAmount -
              discountAmount
          )
        );

      const calculatedTax =
        roundMoney(
          lineSubtotal *
            (taxRate / 100)
        );

      const lineTotal =
        roundMoney(
          lineSubtotal +
            calculatedTax
        );

      let accountId =
        normalizeString(
          raw?.accountId
        ) ||
        defaultRevenueAccount.id;

      if (
        raw?.accountId
      ) {
        const lineAccount =
          await getAccountById(
            tx,
            organizationId,
            accountId
          );

        if (!lineAccount) {
          throw new Error(
            `Invoice line ${
              index + 1
            }: selected account does not belong to this organization.`
          );
        }

        if (
          lineAccount.type !==
          "INCOME"
        ) {
          throw new Error(
            `Invoice line ${
              index + 1
            }: invoice revenue account must be an income account.`
          );
        }
      }

      lines.push({
        lineNumber:
          index + 1,
        accountId,
        description,
        quantity,
        unitPrice,
        discountAmount,
        taxRate,
        taxAmount:
          calculatedTax,
        lineSubtotal,
        lineTotal,
      });

      subtotal =
        roundMoney(
          subtotal +
            lineSubtotal
        );

      taxAmount =
        roundMoney(
          taxAmount +
            calculatedTax
        );

      totalAmount =
        roundMoney(
          totalAmount +
            lineTotal
        );
    }

    if (totalAmount > MAX_MONEY_AMOUNT || subtotal > MAX_MONEY_AMOUNT || taxAmount > MAX_MONEY_AMOUNT) {
      throw new Error("Invoice amount exceeds the maximum supported value.");
    }

    return {
      lines,
      subtotal,
      taxAmount,
      totalAmount,
    };
  };


/* =========================================================
   INVOICE JOURNAL CREATION
========================================================= */

const createInvoiceJournal =
  async (
    tx: Prisma.TransactionClient,
    organizationId: string,
    invoice: InvoiceWithRelations,
    actorId: string
  ) => {
const receivableAccount =
      await requireAccountByCode(
        tx,
        organizationId,
        ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
        "Accounts Receivable"
      );

    if (
      receivableAccount.type !==
      "ASSET"
    ) {
      throw new Error(
        "Accounts Receivable account (1200) must be an asset account."
      );
    }

    const revenueAccount =
      await requireAccountByCode(
        tx,
        organizationId,
        ACCOUNT_CODES.SALES_REVENUE,
        "Sales Revenue"
      );

    if (
      revenueAccount.type !==
      "INCOME"
    ) {
      throw new Error(
        "Sales Revenue account (4100) must be an income account."
      );
    }

    let taxAccount:
      Account | null = null;

    if (
      toNumber(
        invoice.taxAmount
      ) > 0
    ) {
      taxAccount =
        await requireAccountByCode(
          tx,
          organizationId,
          ACCOUNT_CODES.TAX_PAYABLE,
          "Tax Payable"
        );

      if (
        taxAccount.type !==
        "LIABILITY"
      ) {
        throw new Error(
          "Tax Payable account (2300) must be a liability account."
        );
      }
    }

    const revenueByAccount =
      new Map<string, number>();

    for (
      const line of
        invoice.invoiceLines
    ) {
      const accountId =
        line.accountId ??
        revenueAccount.id;

      const current =
        revenueByAccount.get(
          accountId
        ) ?? 0;

      revenueByAccount.set(
        accountId,
        roundMoney(
          current +
            toNumber(
              line.lineSubtotal
            )
        )
      );
    }

    if (
      revenueByAccount.size ===
      0
    ) {
      revenueByAccount.set(
        revenueAccount.id,
        roundMoney(
          toNumber(
            invoice.subtotal
          )
        )
      );
    }

    const journalReference =
      generateJournalReference(
        invoice.invoiceNumber
      );

    const existingJournal =
      await tx.journalEntry.findFirst({
        where: {
          organizationId,
          reference:
            journalReference,
        },
        select: {
          id: true,
        },
      });

    if (existingJournal) {
      throw new Error(
        `Accounting entry already exists for invoice ${invoice.invoiceNumber}.`
      );
    }

    const journal =
      await tx.journalEntry.create({
        data: {
          organizationId,

          reference:
            journalReference,

          description:
            `Invoice ${invoice.invoiceNumber} posted`,

          debitAccountId:
            receivableAccount.id,

          creditAccountId:
            revenueAccount.id,

          amount:
            roundMoney(
              toNumber(
                invoice.totalAmount
              )
            ),

          createdBy:
            actorId,

          postedBy:
            actorId,

          approvedBy:
            actorId,

          postedAt:
            new Date(),

          approvedAt:
            new Date(),

          transactionDate:
            invoice.issueDate,

          status:
            JOURNAL_STATUS.POSTED,

          notes:
            `Automatic invoice posting for ${invoice.invoiceNumber}`,
        },
      });

    let lineNumber = 1;

    /*
     * DR Accounts Receivable
     */
    await tx.journalEntryLine.create({
      data: {
        journalEntryId:
          journal.id,

        accountId:
          receivableAccount.id,

        lineNumber:
          lineNumber++,

        memo:
          `Accounts receivable - ${invoice.invoiceNumber}`,

        debit:
          roundMoney(
            toNumber(
              invoice.totalAmount
            )
          ),

        credit: 0,
      },
    });

    /*
     * CR Revenue
     */
    for (
      const [
        accountId,
        amount,
      ] of revenueByAccount.entries()
    ) {
      if (
        amount <=
        MONEY_TOLERANCE
      ) {
        continue;
      }

      await tx.journalEntryLine.create({
        data: {
          journalEntryId:
            journal.id,

          accountId,

          lineNumber:
            lineNumber++,

          memo:
            `Revenue - ${invoice.invoiceNumber}`,

          debit: 0,

          credit:
            roundMoney(
              amount
            ),
        },
      });
    }

    /*
     * CR Tax Payable
     */
    if (
      taxAccount &&
      toNumber(
        invoice.taxAmount
      ) > MONEY_TOLERANCE
    ) {
      await tx.journalEntryLine.create({
        data: {
          journalEntryId:
            journal.id,

          accountId:
            taxAccount.id,

          lineNumber:
            lineNumber++,

          memo:
            `Tax payable - ${invoice.invoiceNumber}`,

          debit: 0,

          credit:
            roundMoney(
              toNumber(
                invoice.taxAmount
              )
            ),
        },
      });
    }

    /*
     * Verify the actual persisted journal lines.
     */
    const journalLines =
      await tx.journalEntryLine.findMany(
        {
          where: {
            journalEntryId:
              journal.id,
          },
        }
      );

    const totalDebits =
      roundMoney(
        journalLines.reduce(
          (sum, line) =>
            sum +
            toNumber(
              line.debit
            ),
          0
        )
      );

    const totalCredits =
      roundMoney(
        journalLines.reduce(
          (sum, line) =>
            sum +
            toNumber(
              line.credit
            ),
          0
        )
      );

    if (
      !isEffectivelyZero(
        totalDebits -
          totalCredits
      )
    ) {
      throw new Error(
        `Invoice accounting entry is not balanced. Debits=${totalDebits}, Credits=${totalCredits}.`
      );
    }

    return journal;
  };


/* =========================================================
   AR ENRICHMENT
========================================================= */

const enrichInvoicesWithReceivables =
  async (
    organizationId: string,
    invoices: InvoiceWithRelations[]
  ) => {
    if (
      invoices.length ===
      0
    ) {
      return [];
    }

    const invoiceNumbers =
      invoices.map(
        (invoice) =>
          invoice.invoiceNumber
      );

    const receivables =
      await prisma.accountsReceivable.findMany(
        {
          where: {
            organizationId,
            invoiceNumber: {
              in: invoiceNumbers,
            },
          },
        }
      );

    const receivableMap =
      new Map(
        receivables.map(
          (receivable) => [
            receivable.invoiceNumber,
            receivable,
          ]
        )
      );

    return invoices.map(
      (invoice) => {
        const receivable =
          receivableMap.get(
            invoice.invoiceNumber
          );

        return {
          ...invoice,

          outstandingBalance:
            receivable
              ? toNumber(
                  receivable.outstandingBalance
                )
              : invoice.status ===
                INVOICE_STATUS.POSTED
                ? toNumber(
                    invoice.totalAmount
                  )
                : 0,

          paymentStatus:
            receivable?.paymentStatus ??
            invoice.paymentStatus,

          receivableId:
            receivable?.id ??
            null,

          receivableStatus:
            receivable?.status ??
            null,
        };
      }
    );
  };


/* =========================================================
   CREATE DRAFT INVOICE
========================================================= */

export const createInvoice =
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

      const actorId =
        getActorId(req);

      const {
        customerId,
        customerName,
        customerEmail,
        customerPhone,
        description,
        issueDate,
        dueDate,
        lines,
      } = req.body;

      const parsedIssueDate =
        parseDate(issueDate);

      const parsedDueDate =
        parseDate(dueDate);

      if (!parsedIssueDate) {
        return res.status(400).json({
          success: false,
          message:
            "A valid issue date is required.",
        });
      }

      if (!parsedDueDate) {
        return res.status(400).json({
          success: false,
          message:
            "A valid due date is required.",
        });
      }

      if (
        parsedDueDate <
        parsedIssueDate
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Due date cannot be before issue date.",
        });
      }

      const normalizedCustomerId =
        normalizeString(
          customerId
        ) || null;

      const result =
        await prisma.$transaction(
          async (tx) => {
            let customer:
              Awaited<
                ReturnType<
                  typeof getCustomerForOrganization
                >
              > = null;

            if (
              normalizedCustomerId
            ) {
              customer =
                await getCustomerForOrganization(
                  tx,
                  organizationId,
                  normalizedCustomerId
                );

              if (!customer) {
                throw new Error(
                  "Customer not found in this organization."
                );
              }
            }

            const calculated =
              await calculateInvoiceLines(
                tx,
                organizationId,
                lines
              );

            const customerFromRecord =
              customer as
                | {
                    firstName?: string;
                    lastName?: string;
                    email?: string | null;
                    phoneNumber?: string | null;
                  }
                | null;

            const finalCustomerName =
              customer
                ? `${customerFromRecord?.firstName ?? ""} ${
                    customerFromRecord?.lastName ?? ""
                  }`.trim()
                : normalizeString(
                    customerName
                  );

            if (
              !finalCustomerName
            ) {
              throw new Error(
                "Customer is required."
              );
            }

            const invoiceNumber =
              await generateInvoiceNumber(
                tx,
                organizationId,
                parsedIssueDate
              );

            const invoice =
              await tx.invoice.create({
                data: {
                  organizationId,

                  invoiceNumber,

                  customerName:
                    finalCustomerName,

                  customerEmail:
                    customerFromRecord?.email ??
                    (normalizeString(
                      customerEmail
                    ) || null),

                  customerPhone:
                    customerFromRecord?.phoneNumber ??
                    (normalizeString(
                      customerPhone
                    ) || null),

                  description:
                    normalizeString(
                      description
                    ),

                  subtotal:
                    calculated.subtotal,

                  taxAmount:
                    calculated.taxAmount,

                  totalAmount:
                    calculated.totalAmount,

                  issueDate:
                    parsedIssueDate,

                  dueDate:
                    parsedDueDate,

                  paymentStatus:
                    PAYMENT_STATUS.UNPAID,

                  status:
                    INVOICE_STATUS.DRAFT,

                  customerId:
                    normalizedCustomerId,
                },
              });

            await tx.invoiceLine.createMany({
              data:
                calculated.lines.map(
                  (line) => ({
                    invoiceId:
                      invoice.id,

                    accountId:
                      line.accountId,

                    description:
                      line.description,

                    quantity:
                      line.quantity,

                    unitPrice:
                      line.unitPrice,

                    discountAmount:
                      line.discountAmount,

                    taxRate:
                      line.taxRate,

                    taxAmount:
                      line.taxAmount,

                    lineSubtotal:
                      line.lineSubtotal,

                    lineTotal:
                      line.lineTotal,

                    lineNumber:
                      line.lineNumber,
                  })
                ),
            });

            await createAuditTrail(
              tx,
              organizationId,
              actorId,
              "CREATE_DRAFT_INVOICE",
              {
                invoiceId:
                  invoice.id,

                invoiceNumber:
                  invoice.invoiceNumber,

                customerId:
                  invoice.customerId,

                totalAmount:
                  invoice.totalAmount,
              }
            );

            return tx.invoice.findFirst({
              where: {
                id: invoice.id,
                organizationId,
              },
              include: {
                customer: true,
                invoiceLines: {
                  orderBy: {
                    lineNumber:
                      "asc",
                  },
                  include: {
                    account: true,
                  },
                },
              },
            });
          }
        );

      return res.status(201).json({
        success: true,
        message:
          "Draft invoice created successfully.",
        invoice: result,
      });
    } catch (error) {
      console.error(
        "CREATE INVOICE ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message:
          getErrorMessage(error),
      });
    }
  };


/* =========================================================
   UPDATE DRAFT INVOICE
========================================================= */

export const updateInvoice =
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

      const actorId =
        getActorId(req);

      const id =
        normalizeString(
          req.params.id
        );

      if (!id) {
        return res.status(400).json({
          success: false,
          message:
            "Invoice ID is required.",
        });
      }

      const existing =
        await prisma.invoice.findFirst(
          {
            where: {
              id,
              organizationId,
            },
            include: {
              invoiceLines: {
                orderBy: {
                  lineNumber:
                    "asc",
                },
              },
            },
          }
        );

      if (!existing) {
        return res.status(404).json({
          success: false,
          message:
            "Invoice not found.",
        });
      }

      if (
        existing.status !==
        INVOICE_STATUS.DRAFT
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Only draft invoices can be edited.",
        });
      }

      const {
        customerId,
        customerName,
        customerEmail,
        customerPhone,
        description,
        issueDate,
        dueDate,
        lines,
      } = req.body;

      const parsedIssueDate =
        issueDate !== undefined
          ? parseDate(issueDate)
          : existing.issueDate;

      const parsedDueDate =
        dueDate !== undefined
          ? parseDate(dueDate)
          : existing.dueDate;

      if (!parsedIssueDate) {
        return res.status(400).json({
          success: false,
          message:
            "Issue date is invalid.",
        });
      }

      if (!parsedDueDate) {
        return res.status(400).json({
          success: false,
          message:
            "Due date is invalid.",
        });
      }

      if (
        parsedDueDate <
        parsedIssueDate
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Due date cannot be before issue date.",
        });
      }

      const result =
        await prisma.$transaction(
          async (tx) => {
            /*
             * Lock the draft invoice before changing it.
             */
            const locked =
              await tx.$queryRaw<
                Array<{ id: string }>
              >`
                SELECT "id"
                FROM "Invoice"
                WHERE "id" = ${id}
                  AND "organizationId" = ${organizationId}
                FOR UPDATE
              `;

            if (
              locked.length ===
              0
            ) {
              throw new Error(
                "Invoice not found."
              );
            }

            const current =
              await tx.invoice.findFirst(
                {
                  where: {
                    id,
                    organizationId,
                  },
                  include: {
                    invoiceLines: {
                      orderBy: {
                        lineNumber:
                          "asc",
                      },
                    },
                  },
                }
              );

            if (!current) {
              throw new Error(
                "Invoice not found."
              );
            }

            if (
              current.status !==
              INVOICE_STATUS.DRAFT
            ) {
              throw new Error(
                "Only draft invoices can be edited."
              );
            }

            let customer:
              Awaited<
                ReturnType<
                  typeof getCustomerForOrganization
                >
              > = null;

            const effectiveCustomerId =
              customerId !==
              undefined
                ? normalizeString(
                    customerId
                  ) || null
                : current.customerId;

            if (
              effectiveCustomerId
            ) {
              customer =
                await getCustomerForOrganization(
                  tx,
                  organizationId,
                  effectiveCustomerId
                );

              if (!customer) {
                throw new Error(
                  "Customer not found in this organization."
                );
              }
            }

            const effectiveLines =
              lines !== undefined
                ? lines
                : current.invoiceLines.map(
                    (line) => ({
                      accountId:
                        line.accountId,
                      description:
                        line.description,
                      quantity:
                        line.quantity,
                      unitPrice:
                        line.unitPrice,
                      discountAmount:
                        line.discountAmount,
                      taxRate:
                        line.taxRate,
                    })
                  );

            const calculated =
              await calculateInvoiceLines(
                tx,
                organizationId,
                effectiveLines
              );

            const customerFromRecord =
              customer as
                | {
                    firstName?: string;
                    lastName?: string;
                    email?: string | null;
                    phoneNumber?: string | null;
                  }
                | null;

            const effectiveCustomerName =
              customer
                ? `${customerFromRecord?.firstName ?? ""} ${
                    customerFromRecord?.lastName ?? ""
                  }`.trim()
                : normalizeString(
                    customerName
                  ) ||
                  current.customerName;

            if (
              !effectiveCustomerName
            ) {
              throw new Error(
                "Customer is required."
              );
            }

            await tx.invoiceLine.deleteMany({
              where: {
                invoiceId: id,
              },
            });

            await tx.invoice.update({
              where: {
                id,
              },
              data: {
                customerId:
                  effectiveCustomerId,

                customerName:
                  effectiveCustomerName,

                customerEmail:
                  customerFromRecord?.email ??
                  (customerEmail !==
                  undefined
                    ? normalizeString(
                        customerEmail
                      ) || null
                    : current.customerEmail),

                customerPhone:
                  customerFromRecord?.phoneNumber ??
                  (customerPhone !==
                  undefined
                    ? normalizeString(
                        customerPhone
                      ) || null
                    : current.customerPhone),

                description:
                  description !==
                  undefined
                    ? normalizeString(
                        description
                      )
                    : current.description,

                subtotal:
                  calculated.subtotal,

                taxAmount:
                  calculated.taxAmount,

                totalAmount:
                  calculated.totalAmount,

                issueDate:
                  parsedIssueDate,

                dueDate:
                  parsedDueDate,
              },
            });

            await tx.invoiceLine.createMany({
              data:
                calculated.lines.map(
                  (line) => ({
                    invoiceId:
                      id,

                    accountId:
                      line.accountId,

                    description:
                      line.description,

                    quantity:
                      line.quantity,

                    unitPrice:
                      line.unitPrice,

                    discountAmount:
                      line.discountAmount,

                    taxRate:
                      line.taxRate,

                    taxAmount:
                      line.taxAmount,

                    lineSubtotal:
                      line.lineSubtotal,

                    lineTotal:
                      line.lineTotal,

                    lineNumber:
                      line.lineNumber,
                  })
                ),
            });

            await createAuditTrail(
              tx,
              organizationId,
              actorId,
              "UPDATE_DRAFT_INVOICE",
              {
                invoiceId:
                  current.id,

                invoiceNumber:
                  current.invoiceNumber,

                totalAmount:
                  calculated.totalAmount,
              }
            );

            return tx.invoice.findFirst({
              where: {
                id,
                organizationId,
              },
              include: {
                customer: true,
                invoiceLines: {
                  orderBy: {
                    lineNumber:
                      "asc",
                  },
                  include: {
                    account: true,
                  },
                },
              },
            });
          }
        );

      return res.status(200).json({
        success: true,
        message:
          "Draft invoice updated successfully.",
        invoice: result,
      });
    } catch (error) {
      console.error(
        "UPDATE INVOICE ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message:
          getErrorMessage(error),
      });
    }
  };


/* =========================================================
   FINALIZE / POST INVOICE
========================================================= */

export const finalizeInvoice =
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

      const actorId =
        getActorId(req);

      const id =
        normalizeString(
          req.params.id
        );

      if (!id) {
        return res.status(400).json({
          success: false,
          message:
            "Invoice ID is required.",
        });
      }

      const result =
        await prisma.$transaction(
          async (tx) => {
            /*
             * Critical concurrency protection:
             * two users must never be able to finalize the
             * same draft simultaneously.
             */
            const locked =
              await tx.$queryRaw<
                Array<{ id: string }>
              >`
                SELECT "id"
                FROM "Invoice"
                WHERE "id" = ${id}
                  AND "organizationId" = ${organizationId}
                FOR UPDATE
              `;

            if (
              locked.length ===
              0
            ) {
              throw new Error(
                "Invoice not found."
              );
            }

            const invoice =
              await tx.invoice.findFirst(
                {
                  where: {
                    id,
                    organizationId,
                  },
                  include: {
                    customer: true,
                    invoiceLines: {
                      orderBy: {
                        lineNumber:
                          "asc",
                      },
                      include: {
                        account: true,
                      },
                    },
                  },
                }
              );

            if (!invoice) {
              throw new Error(
                "Invoice not found."
              );
            }

            if (
              invoice.status ===
              INVOICE_STATUS.POSTED
            ) {
              throw new Error(
                "Invoice has already been posted."
              );
            }

            if (
              invoice.status ===
              INVOICE_STATUS.VOID
            ) {
              throw new Error(
                "A void invoice cannot be posted."
              );
            }

            if (
              invoice.invoiceLines
                .length === 0
            ) {
              throw new Error(
                "Invoice must contain at least one line before posting."
              );
            }

            const calculated =
              await calculateInvoiceLines(
                tx,
                organizationId,
                invoice.invoiceLines.map(
                  (line) => ({
                    accountId:
                      line.accountId,
                    description:
                      line.description,
                    quantity:
                      line.quantity,
                    unitPrice:
                      line.unitPrice,
                    discountAmount:
                      line.discountAmount,
                    taxRate:
                      line.taxRate,
                  })
                )
              );

            /*
             * Recalculate from persisted lines and compare with
             * the invoice header. This prevents stale or manually
             * modified totals from being posted.
             */
            if (
              !isEffectivelyZero(
                calculated.totalAmount -
                  toNumber(
                    invoice.totalAmount
                  )
              ) ||
              !isEffectivelyZero(
                calculated.subtotal -
                  toNumber(
                    invoice.subtotal
                  )
              ) ||
              !isEffectivelyZero(
                calculated.taxAmount -
                  toNumber(
                    invoice.taxAmount
                  )
              ) ||
              calculated.lines.length !==
                invoice.invoiceLines.length
            ) {
              throw new Error(
                "Invoice totals do not match its persisted invoice lines. Update the draft before posting."
              );
            }

            if (
              toNumber(
                invoice.totalAmount
              ) <=
              MONEY_TOLERANCE
            ) {
              throw new Error(
                "Invoice total must be greater than zero."
              );
            }

            const existingReceivable =
              await tx.accountsReceivable.findFirst(
                {
                  where: {
                    organizationId,
                    invoiceNumber:
                      invoice.invoiceNumber,
                  },
                  select: {
                    id: true,
                  },
                }
              );

            if (
              existingReceivable
            ) {
              throw new Error(
                `Accounts Receivable already exists for invoice ${invoice.invoiceNumber}.`
              );
            }

            const journal =
              await createInvoiceJournal(
                tx,
                organizationId,
                invoice,
                actorId
              );

            const receivable =
              await tx.accountsReceivable.create(
                {
                  data: {
                    organizationId,

                    invoiceNumber:
                      invoice.invoiceNumber,

                    customerName:
                      invoice.customerName,

                    description:
                      invoice.description ||
                      `Invoice ${invoice.invoiceNumber}`,

                    amount:
                      roundMoney(
                        toNumber(
                          invoice.totalAmount
                        )
                      ),

                    outstandingBalance:
                      roundMoney(
                        toNumber(
                          invoice.totalAmount
                        )
                      ),

                    dueDate:
                      invoice.dueDate,

                    paymentStatus:
                      PAYMENT_STATUS.UNPAID,

                    status:
                      AR_STATUS.ACTIVE,
                  },
                }
              );

            const postedInvoice =
              await tx.invoice.update({
                where: {
                  id:
                    invoice.id,
                },
                data: {
                  status:
                    INVOICE_STATUS.POSTED,

                  paymentStatus:
                    PAYMENT_STATUS.UNPAID,
                },
                include: {
                  customer: true,
                  invoiceLines: {
                    orderBy: {
                      lineNumber:
                        "asc",
                    },
                    include: {
                      account: true,
                    },
                  },
                },
              });

            await createAuditTrail(
              tx,
              organizationId,
              actorId,
              "POST_INVOICE",
              {
                invoiceId:
                  invoice.id,

                invoiceNumber:
                  invoice.invoiceNumber,

                receivableId:
                  receivable.id,

                journalEntryId:
                  journal.id,

                subtotal:
                  invoice.subtotal,

                taxAmount:
                  invoice.taxAmount,

                totalAmount:
                  invoice.totalAmount,
              }
            );

            return {
              invoice:
                postedInvoice,
              receivable,
              journal,
            };
          }
        );

      return res.status(200).json({
        success: true,
        message:
          "Invoice finalized and posted to Accounts Receivable and General Ledger successfully.",
        invoice:
          result.invoice,
        receivable:
          result.receivable,
        journalEntry:
          result.journal,
      });
    } catch (error) {
      console.error(
        "FINALIZE INVOICE ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message:
          getErrorMessage(error),
      });
    }
  };


/* =========================================================
   GET INVOICES
========================================================= */

export const getInvoices =
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

      const page =
        getPage(
          req.query.page
        );

      const pageSize =
        getPageSize(
          req.query.pageSize
        );

      const search =
        normalizeString(
          req.query.search
        );

      const status =
        normalizeString(
          req.query.status
        );

      const paymentStatus =
        normalizeString(
          req.query.paymentStatus
        );

      if (search.length > MAX_SEARCH_LENGTH) {
        return res.status(400).json({ success: false, message: `Search cannot exceed ${MAX_SEARCH_LENGTH} characters.` });
      }

      if (status && !Object.values(INVOICE_STATUS).includes(status as typeof INVOICE_STATUS[keyof typeof INVOICE_STATUS])) {
        return res.status(400).json({ success: false, message: "Invalid invoice status." });
      }

      if (paymentStatus && !Object.values(PAYMENT_STATUS).includes(paymentStatus as typeof PAYMENT_STATUS[keyof typeof PAYMENT_STATUS])) {
        return res.status(400).json({ success: false, message: "Invalid payment status." });
      }

      const where:
        Prisma.InvoiceWhereInput =
        {
          organizationId,

          ...(status
            ? {
                status,
              }
            : {}),

          ...(paymentStatus
            ? {
                paymentStatus,
              }
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
                    customerEmail: {
                      contains:
                        search,
                      mode:
                        "insensitive",
                    },
                  },
                  {
                    customerPhone: {
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

      const skip =
        (page - 1) *
        pageSize;

      const [
        invoices,
        total,
      ] = await Promise.all([
        prisma.invoice.findMany({
          where,

          skip,
          take: pageSize,

          orderBy: [
            {
              issueDate:
                "desc",
            },
            {
              createdAt:
                "desc",
            },
            {
              id: "desc",
            },
          ],

          include: {
            customer: true,

            invoiceLines: {
              orderBy: {
                lineNumber:
                  "asc",
              },

              include: {
                account: true,
              },
            },
          },
        }),

        prisma.invoice.count({
          where,
        }),
      ]);

      const enriched =
        await enrichInvoicesWithReceivables(
          organizationId,
          invoices
        );

      const totalPages =
        total === 0
          ? 0
          : Math.ceil(
              total /
                pageSize
            );

      return res.status(200).json({
        success: true,

        invoices:
          enriched,

        meta: {
          organizationId,

          page,

          pageSize,

          count:
            enriched.length,

          total,

          totalPages,

          hasNextPage:
            page <
            totalPages,

          hasPreviousPage:
            page > 1 &&
            totalPages > 0,

          filters: {
            search:
              search || null,
            status:
              status || null,
            paymentStatus:
              paymentStatus ||
              null,
          },
        },
      });
    } catch (error) {
      console.error(
        "GET INVOICES ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch invoices.",
      });
    }
  };


/* =========================================================
   GET ONE INVOICE
========================================================= */

export const getInvoiceById =
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
        normalizeString(
          req.params.id
        );

      if (!id) {
        return res.status(400).json({
          success: false,
          message:
            "Invoice ID is required.",
        });
      }

      const invoice =
        await prisma.invoice.findFirst(
          {
            where: {
              id,
              organizationId,
            },

            include: {
              customer: true,

              invoiceLines: {
                orderBy: {
                  lineNumber:
                    "asc",
                },

                include: {
                  account: true,
                },
              },
            },
          }
        );

      if (!invoice) {
        return res.status(404).json({
          success: false,
          message:
            "Invoice not found.",
        });
      }

      const enriched =
        await enrichInvoicesWithReceivables(
          organizationId,
          [invoice]
        );

      return res.status(200).json({
        success: true,
        invoice:
          enriched[0],
      });
    } catch (error) {
      console.error(
        "GET INVOICE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch invoice.",
      });
    }
  };


/* =========================================================
   DELETE DRAFT INVOICE
========================================================= */

export const deleteInvoice =
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

      const actorId =
        getActorId(req);

      const id =
        normalizeString(
          req.params.id
        );

      if (!id) {
        return res.status(400).json({
          success: false,
          message:
            "Invoice ID is required.",
        });
      }

      await prisma.$transaction(
        async (tx) => {
          const locked =
            await tx.$queryRaw<
              Array<{ id: string }>
            >`
              SELECT "id"
              FROM "Invoice"
              WHERE "id" = ${id}
                AND "organizationId" = ${organizationId}
              FOR UPDATE
            `;

          if (
            locked.length ===
            0
          ) {
            throw new Error(
              "Invoice not found."
            );
          }

          const invoice =
            await tx.invoice.findFirst(
              {
                where: {
                  id,
                  organizationId,
                },
              }
            );

          if (!invoice) {
            throw new Error(
              "Invoice not found."
            );
          }

          if (
            invoice.status !==
            INVOICE_STATUS.DRAFT
          ) {
            throw new Error(
              "Only draft invoices can be deleted. Posted invoices must be reversed through the accounting workflow."
            );
          }

          await tx.invoice.delete({
            where: {
              id:
                invoice.id,
            },
          });

          await createAuditTrail(
            tx,
            organizationId,
            actorId,
            "DELETE_DRAFT_INVOICE",
            {
              invoiceId:
                invoice.id,

              invoiceNumber:
                invoice.invoiceNumber,
            }
          );
        }
      );

      return res.status(200).json({
        success: true,
        message:
          "Draft invoice deleted successfully.",
      });
    } catch (error) {
      console.error(
        "DELETE INVOICE ERROR:",
        error
      );

      const message =
        getErrorMessage(error);

      if (
        message ===
        "Invoice not found."
      ) {
        return res.status(404).json({
          success: false,
          message,
        });
      }

      return res.status(409).json({
        success: false,
        message,
      });
    }
  };


/* =========================================================
   VOID POSTED INVOICE
========================================================= */

/**
 * Important accounting rule:
 *
 * A posted invoice can only be voided when NO customer payment
 * has been recorded against it.
 *
 * Why?
 *
 * Original:
 *   Dr AR
 *   Cr Revenue
 *
 * Payment:
 *   Dr Cash
 *   Cr AR
 *
 * If the invoice were then reversed without reversing the
 * payment, AR would become negative and the accounting would
 * no longer represent the customer ledger correctly.
 *
 * Therefore:
 *
 * - unpaid invoice -> can be voided
 * - partially paid -> must be handled through a controlled
 *   settlement/reversal workflow
 * - fully paid -> must not be voided through this endpoint
 */
export const voidInvoice =
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

      const actorId =
        getActorId(req);

      const id =
        normalizeString(
          req.params.id
        );

      const reason =
        normalizeString(
          req.body?.reason
        );

      if (!id) {
        return res.status(400).json({
          success: false,
          message:
            "Invoice ID is required.",
        });
      }

      if (!reason) {
        return res.status(400).json({
          success: false,
          message:
            "A reason is required when voiding an invoice.",
        });
      }

      const result =
        await prisma.$transaction(
          async (tx) => {
            const locked =
              await tx.$queryRaw<
                Array<{ id: string }>
              >`
                SELECT "id"
                FROM "Invoice"
                WHERE "id" = ${id}
                  AND "organizationId" = ${organizationId}
                FOR UPDATE
              `;

            if (
              locked.length ===
              0
            ) {
              throw new Error(
                "Invoice not found."
              );
            }

            const invoice =
              await tx.invoice.findFirst(
                {
                  where: {
                    id,
                    organizationId,
                  },

                  include: {
                    invoiceLines: true,
                  },
                }
              );

            if (!invoice) {
              throw new Error(
                "Invoice not found."
              );
            }

            if (
              invoice.status !==
              INVOICE_STATUS.POSTED
            ) {
              throw new Error(
                "Only posted invoices can be voided."
              );
            }

            const receivable =
              await tx.accountsReceivable.findFirst(
                {
                  where: {
                    organizationId,

                    invoiceNumber:
                      invoice.invoiceNumber,
                  },
                }
              );

            if (!receivable) {
              throw new Error(
                "The Accounts Receivable record for this invoice could not be found."
              );
            }

            const originalAmount =
              roundMoney(
                toNumber(
                  receivable.amount
                )
              );

            const outstandingBalance =
              roundMoney(
                toNumber(
                  receivable.outstandingBalance
                )
              );

            const amountPaid =
              roundMoney(
                Math.max(
                  0,
                  originalAmount -
                    outstandingBalance
                )
              );

            /*
             * Never silently erase a payment.
             */
            if (
              amountPaid >
              MONEY_TOLERANCE
            ) {
              throw new Error(
                "INVOICE_HAS_PAYMENTS"
              );
            }

            const originalJournal =
              await tx.journalEntry.findFirst(
                {
                  where: {
                    organizationId,

                    reference:
                      generateJournalReference(
                        invoice.invoiceNumber
                      ),
                  },

                  include: {
                    lines: {
                      orderBy: {
                        lineNumber:
                          "asc",
                      },
                    },
                  },
                }
              );

            if (!originalJournal) {
              throw new Error(
                "Original invoice journal entry could not be found."
              );
            }

            if (
              originalJournal.organizationId !==
              organizationId
            ) {
              throw new Error(
                "Original journal belongs to another organization."
              );
            }

            const existingReversal =
              await tx.journalEntry.findFirst(
                {
                  where: {
                    organizationId,

                    reversalOfId:
                      originalJournal.id,
                  },

                  select: {
                    id: true,
                    reference:
                      true,
                  },
                }
              );

            if (
              existingReversal
            ) {
              throw new Error(
                "A reversal already exists for this invoice."
              );
            }

            const reversalReference =
              generateReversalReference(
                invoice.invoiceNumber
              );

            const duplicateReference =
              await tx.journalEntry.findFirst(
                {
                  where: {
                    organizationId,
                    reference:
                      reversalReference,
                  },
                  select: {
                    id: true,
                  },
                }
              );

            if (
              duplicateReference
            ) {
              throw new Error(
                "A reversal already exists for this invoice."
              );
            }

            /*
             * The reversal must mirror every original journal
             * line. This is safer than assuming only Revenue
             * and AR exist because invoices may contain tax
             * and multiple revenue accounts.
             */
            const reversal =
              await tx.journalEntry.create(
                {
                  data: {
                    organizationId,

                    reference:
                      reversalReference,

                    description:
                      `Reversal of invoice ${invoice.invoiceNumber}`,

                    debitAccountId:
                      originalJournal.creditAccountId,

                    creditAccountId:
                      originalJournal.debitAccountId,

                    amount:
                      roundMoney(
                        toNumber(
                          originalJournal.amount
                        )
                      ),

                    createdBy:
                      actorId,

                    postedBy:
                      actorId,

                    approvedBy:
                      actorId,

                    postedAt:
                      new Date(),

                    approvedAt:
                      new Date(),

                    transactionDate:
                      new Date(),

                    status:
                      JOURNAL_STATUS.POSTED,

                    reversalOfId:
                      originalJournal.id,

                    reversalReason:
                      reason,

                    reversedAt:
                      new Date(),

                    reversedBy:
                      actorId,

                    notes:
                      `Reversal created for voided invoice ${invoice.invoiceNumber}`,
                  },
                }
              );

            for (
              let index = 0;
              index <
              originalJournal.lines
                .length;
              index++
            ) {
              const originalLine =
                originalJournal
                  .lines[index];

              await tx.journalEntryLine.create(
                {
                  data: {
                    journalEntryId:
                      reversal.id,

                    accountId:
                      originalLine.accountId,

                    lineNumber:
                      index + 1,

                    memo:
                      `Reversal - ${invoice.invoiceNumber}`,

                    debit:
                      roundMoney(
                        toNumber(
                          originalLine.credit
                        )
                      ),

                    credit:
                      roundMoney(
                        toNumber(
                          originalLine.debit
                        )
                      ),
                  },
                }
              );
            }

            const reversalLines =
              await tx.journalEntryLine.findMany(
                {
                  where: {
                    journalEntryId:
                      reversal.id,
                  },
                }
              );

            const reversalDebits =
              roundMoney(
                reversalLines.reduce(
                  (sum, line) =>
                    sum +
                    toNumber(
                      line.debit
                    ),
                  0
                )
              );

            const reversalCredits =
              roundMoney(
                reversalLines.reduce(
                  (sum, line) =>
                    sum +
                    toNumber(
                      line.credit
                    ),
                  0
                )
              );

            if (
              !isEffectivelyZero(
                reversalDebits -
                  reversalCredits
              )
            ) {
              throw new Error(
                "Invoice reversal journal is not balanced."
              );
            }

            /*
             * Do not mark the invoice as PAID.
             *
             * VOID is the document state.
             * Payment status describes actual payment history.
             *
             * Since we only allow voiding unpaid invoices here,
             * paymentStatus remains UNPAID.
             */
            await tx.accountsReceivable.update(
              {
                where: {
                  id:
                    receivable.id,
                },

                data: {
                  outstandingBalance:
                    0,

                  status:
                    AR_STATUS.VOID,

                  paymentStatus:
                    PAYMENT_STATUS.UNPAID,
                },
              }
            );

            const voidedInvoice =
              await tx.invoice.update({
                where: {
                  id:
                    invoice.id,
                },

                data: {
                  status:
                    INVOICE_STATUS.VOID,

                  paymentStatus:
                    PAYMENT_STATUS.UNPAID,
                },

                include: {
                  customer: true,

                  invoiceLines: {
                    orderBy: {
                      lineNumber:
                        "asc",
                    },

                    include: {
                      account: true,
                    },
                  },
                },
              });

            await createAuditTrail(
              tx,
              organizationId,
              actorId,
              "VOID_INVOICE",
              {
                invoiceId:
                  invoice.id,

                invoiceNumber:
                  invoice.invoiceNumber,

                originalJournalId:
                  originalJournal.id,

                reversalJournalId:
                  reversal.id,

                reason,

                originalAmount,

                amountPaid,
              }
            );

            const voidedReceivable =
              await tx.accountsReceivable.findFirst({
                where: {
                  id: receivable.id,
                  organizationId,
                },
              });

            return {
              invoice: voidedInvoice,
              receivable: voidedReceivable,
              reversal,
            };
          }
        );

      return res.status(200).json({
        success: true,

        message:
          "Invoice voided and accounting reversal created successfully.",

        invoice:
          result.invoice,

        receivable:
          result.receivable,

        reversalJournal:
          result.reversal,
      });
    } catch (error) {
      console.error(
        "VOID INVOICE ERROR:",
        error
      );

      const message =
        getErrorMessage(error);

      if (
        message ===
        "Invoice not found."
      ) {
        return res.status(404).json({
          success: false,
          message,
        });
      }

      if (
        message ===
        "INVOICE_HAS_PAYMENTS"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "This invoice has already received a payment. It cannot be voided through this workflow because doing so would incorrectly remove the customer's payment history. Use a controlled payment reversal/credit-note workflow.",
        });
      }

      return res.status(409).json({
        success: false,
        message,
      });
    }
  };


/* =========================================================
   INVOICE STATISTICS
   ---------------------------------------------------------
   All financial totals are calculated by the database rather
   than loading the organization's entire invoice history into
   Node.js.
========================================================= */

export const getInvoiceStats =
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

      const [
        draftCount,
        postedCount,
        voidCount,
        unpaidCount,
        postedTotals,
        receivableTotals,
        overdueCount,
        overdueTotals,
      ] = await Promise.all([
        prisma.invoice.count({
          where: {
            organizationId,
            status:
              INVOICE_STATUS.DRAFT,
          },
        }),

        prisma.invoice.count({
          where: {
            organizationId,
            status:
              INVOICE_STATUS.POSTED,
          },
        }),

        prisma.invoice.count({
          where: {
            organizationId,
            status:
              INVOICE_STATUS.VOID,
          },
        }),

        prisma.invoice.count({
          where: {
            organizationId,
            status:
              INVOICE_STATUS.POSTED,
            paymentStatus: {
              not: PAYMENT_STATUS.PAID,
            },
          },
        }),

        prisma.invoice.aggregate({
          where: {
            organizationId,
            status:
              INVOICE_STATUS.POSTED,
          },

          _sum: {
            subtotal: true,
            taxAmount: true,
            totalAmount: true,
          },
        }),

        prisma.accountsReceivable.aggregate(
          {
            where: {
              organizationId,

              status: {
                not:
                  AR_STATUS.VOID,
              },

              outstandingBalance: {
                gt: 0,
              },
            },

            _sum: {
              outstandingBalance:
                true,
            },
          }
        ),

        prisma.accountsReceivable.count({
          where: {
            organizationId,

            status: {
              notIn: [
                AR_STATUS.CLOSED,
                AR_STATUS.VOID,
              ],
            },

            outstandingBalance: {
              gt: 0,
            },

            dueDate: {
              lt: new Date(),
            },
          },
        }),

        prisma.accountsReceivable.aggregate(
          {
            where: {
              organizationId,

              status: {
                notIn: [
                  AR_STATUS.CLOSED,
                  AR_STATUS.VOID,
                ],
              },

              outstandingBalance: {
                gt: 0,
              },

              dueDate: {
                lt: new Date(),
              },
            },

            _sum: {
              outstandingBalance:
                true,
            },
          }
        ),
      ]);

      const totalInvoiced =
        roundMoney(
          toNumber(
            postedTotals._sum
              .totalAmount
          )
        );

      const totalSubtotal =
        roundMoney(
          toNumber(
            postedTotals._sum
              .subtotal
          )
        );

      const totalTax =
        roundMoney(
          toNumber(
            postedTotals._sum
              .taxAmount
          )
        );

      const totalReceivable =
        roundMoney(
          toNumber(
            receivableTotals
              ._sum
              .outstandingBalance
          )
        );

      const overdueReceivable =
        roundMoney(
          toNumber(
            overdueTotals
              ._sum
              .outstandingBalance
          )
        );

      return res.status(200).json({
        success: true,

        stats: {
          draftCount,

          postedCount,

          voidCount,

          unpaidCount,

          totalSubtotal,

          totalTax,

          totalInvoiced,

          totalReceivable,

          overdueCount,

          overdueReceivable,
        },

        meta: {
          organizationId,

          currency: "KES",

          calculatedAt:
            new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error(
        "GET INVOICE STATS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch invoice statistics.",
      });
    }
  };
