import { Response } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   INVOICE CONTROLLER
   ZIYA FOS
   ---------------------------------------------------------
   Design principles:
   - Organization/tenant isolation
   - Server-side invoice numbering
   - Draft -> Finalize workflow
   - Server-side line calculations
   - Customer validation
   - Tenant-scoped Chart of Accounts
   - Accounts Receivable integration
   - JournalEntry + JournalEntryLine integration
   - Audit trail
   - Pagination / search / filters
   - Transactional posting
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
} as const;

const JOURNAL_STATUS = {
  DRAFT: "DRAFT",
  POSTED: "POSTED",
} as const;

/* =========================================================
   HELPERS
========================================================= */

const getOrganizationId = (
  req: AuthRequest
): string | null => {
  return (req.user as any)?.organizationId ?? null;
};

const getActorId = (
  req: AuthRequest
): string => {
  return String(
    (req.user as any)?.id ??
      (req.user as any)?.userId ??
      (req.user as any)?.email ??
      "system"
  );
};

const roundMoney = (
  value: number
): number => {
  return Math.round(
    (value + Number.EPSILON) * 100
  ) / 100;
};

const isFiniteNumber = (
  value: unknown
): value is number => {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
};

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

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
};

const parseDate = (
  value: unknown
): Date | null => {
  if (!value) {
    return null;
  }

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const normalizeString = (
  value: unknown
): string => {
  return value === undefined ||
    value === null
    ? ""
    : String(value).trim();
};

/* =========================================================
   INVOICE NUMBER GENERATION
========================================================= */

/**
 * Generates:
 *
 * INV-YYYY-000001
 *
 * Sequence is scoped by:
 * - organization
 * - calendar year
 *
 * Invoice and Accounts Receivable share the same
 * invoice-number namespace.
 */
const generateInvoiceNumber = async (
  tx: any,
  organizationId: string,
  issueDate: Date
): Promise<string> => {
  const year = issueDate.getFullYear();

  const prefix = `INV-${year}-`;

  /*
   * Serialize invoice number generation.
   *
   * PostgreSQL transaction advisory lock automatically
   * releases when the transaction completes.
   */
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtext(${`${organizationId}:${year}:invoice-number`})
    )
  `;

  const existingInvoices =
    await tx.invoice.findMany({
      where: {
        organizationId,
        invoiceNumber: {
          startsWith: prefix,
        },
      },
      select: {
        invoiceNumber: true,
      },
    });

  const existingReceivables =
    await tx.accountsReceivable.findMany({
      where: {
        organizationId,
        invoiceNumber: {
          startsWith: prefix,
        },
      },
      select: {
        invoiceNumber: true,
      },
    });

  const usedNumbers = [
    ...existingInvoices.map(
      (invoice: { invoiceNumber: string }) =>
        invoice.invoiceNumber
    ),
    ...existingReceivables.map(
      (
        receivable: {
          invoiceNumber: string;
        }
      ) => receivable.invoiceNumber
    ),
  ];

  let highestSequence = 0;

  for (const number of usedNumbers) {
    if (!number.startsWith(prefix)) {
      continue;
    }

    const suffix =
      number.slice(prefix.length);

    const sequence = Number(suffix);

    if (
      Number.isInteger(sequence) &&
      sequence > highestSequence
    ) {
      highestSequence = sequence;
    }
  }

  const nextSequence =
    highestSequence + 1;

  return `${prefix}${String(
    nextSequence
  ).padStart(6, "0")}`;
};

/* =========================================================
   ACCOUNT HELPERS
========================================================= */

/**
 * Resolve a tenant-specific account by code.
 *
 * NEVER hard-code database IDs.
 */
const getAccountByCode = async (
  tx: any,
  organizationId: string,
  code: string
) => {
  const account =
    await tx.account.findFirst({
      where: {
        organizationId,
        code,
      },
    });

  return account;
};

const requireAccountByCode = async (
  tx: any,
  organizationId: string,
  code: string,
  label: string
) => {
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

/* =========================================================
   CUSTOMER HELPERS
========================================================= */

const getCustomerForOrganization = async (
  tx: any,
  organizationId: string,
  customerId: string
) => {
  const customer =
    await tx.customer.findFirst({
      where: {
        id: customerId,
        organizationId,
      },
    });

  return customer;
};

/* =========================================================
   LINE CALCULATION
========================================================= */

const calculateInvoiceLines = async (
  tx: any,
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

  const defaultRevenueAccount =
    await requireAccountByCode(
      tx,
      organizationId,
      ACCOUNT_CODES.SALES_REVENUE,
      "Sales Revenue"
    );

  const lines: NormalizedInvoiceLine[] =
    [];

  let subtotal = 0;
  let taxAmount = 0;
  let totalAmount = 0;

  for (
    let index = 0;
    index < inputLines.length;
    index++
  ) {
    const raw =
      inputLines[index] as InvoiceLineInput;

    const description =
      normalizeString(raw?.description);

    if (!description) {
      throw new Error(
        `Invoice line ${index + 1}: description is required.`
      );
    }

    const quantity =
      toNumber(raw?.quantity, 1);

    const unitPrice =
      toNumber(raw?.unitPrice);

    const discountAmount =
      toNumber(
        raw?.discountAmount,
        0
      );

    const taxRate =
      toNumber(
        raw?.taxRate,
        0
      );

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      throw new Error(
        `Invoice line ${index + 1}: quantity must be greater than zero.`
      );
    }

    if (
      !Number.isFinite(unitPrice) ||
      unitPrice < 0
    ) {
      throw new Error(
        `Invoice line ${index + 1}: unit price cannot be negative.`
      );
    }

    if (
      !Number.isFinite(discountAmount) ||
      discountAmount < 0
    ) {
      throw new Error(
        `Invoice line ${index + 1}: discount cannot be negative.`
      );
    }

    if (
      !Number.isFinite(taxRate) ||
      taxRate < 0 ||
      taxRate > 100
    ) {
      throw new Error(
        `Invoice line ${index + 1}: tax rate must be between 0 and 100.`
      );
    }

    const grossAmount =
      roundMoney(
        quantity * unitPrice
      );

    if (
      discountAmount > grossAmount
    ) {
      throw new Error(
        `Invoice line ${index + 1}: discount cannot exceed the line amount.`
      );
    }

    const lineSubtotal =
      roundMoney(
        grossAmount -
          discountAmount
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

    /*
     * Revenue account can be selected per line.
     *
     * If not supplied, use the organization's
     * default Sales Revenue account.
     */
    let accountId =
      normalizeString(
        raw?.accountId
      ) || defaultRevenueAccount.id;

    if (raw?.accountId) {
      const lineAccount =
        await tx.account.findFirst({
          where: {
            id: accountId,
            organizationId,
          },
        });

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

    const normalizedLine = {
      lineNumber: index + 1,
      accountId,
      description,
      quantity,
      unitPrice,
      discountAmount,
      taxRate,
      taxAmount: calculatedTax,
      lineSubtotal,
      lineTotal,
    };

    lines.push(
      normalizedLine
    );

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

  return {
    lines,
    subtotal,
    taxAmount,
    totalAmount,
  };
};

/* =========================================================
   AUDIT
========================================================= */

const createAuditTrail = async (
  tx: any,
  organizationId: string,
  user: string,
  action: string,
  details: Record<string, unknown>
) => {
  await tx.auditTrail.create({
    data: {
      organizationId,
      user,
      action,
      module: "INVOICE",
      details: JSON.stringify(
        details
      ),
    },
  });
};

/* =========================================================
   JOURNAL REFERENCE
========================================================= */

const generateJournalReference =
  (
    invoiceNumber: string
  ): string => {
    return `INV-${invoiceNumber}-POST`;
  };

/* =========================================================
   JOURNAL CREATION
========================================================= */

const createInvoiceJournal = async (
  tx: any,
  organizationId: string,
  invoice: any,
  actorId: string
) => {
  const receivableAccount =
    await requireAccountByCode(
      tx,
      organizationId,
      ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
      "Accounts Receivable"
    );

  const revenueAccount =
    await requireAccountByCode(
      tx,
      organizationId,
      ACCOUNT_CODES.SALES_REVENUE,
      "Sales Revenue"
    );

  let taxAccount = null;

  if (
    Number(invoice.taxAmount) > 0
  ) {
    taxAccount =
      await requireAccountByCode(
        tx,
        organizationId,
        ACCOUNT_CODES.TAX_PAYABLE,
        "Tax Payable"
      );
  }

  const lines =
    invoice.invoiceLines ?? [];

  /*
   * Aggregate revenue by account.
   */
  const revenueByAccount =
    new Map<
      string,
      number
    >();

  for (const line of lines) {
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
          Number(
            line.lineSubtotal
          )
      )
    );
  }

  /*
   * Fallback for invoices with no lines.
   *
   * This is defensive and should normally never
   * happen because finalization requires lines.
   */
  if (
    revenueByAccount.size === 0
  ) {
    revenueByAccount.set(
      revenueAccount.id,
      roundMoney(
        Number(
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
    });

  if (existingJournal) {
    throw new Error(
      `Accounting entry already exists for invoice ${invoice.invoiceNumber}.`
    );
  }

  /*
   * JournalEntry has legacy header-level debit/credit
   * accounts in addition to JournalEntryLine.
   *
   * The authoritative distribution is stored in
   * JournalEntryLine.
   *
   * Header accounts are retained for compatibility.
   */
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
            Number(
              invoice.totalAmount
            )
          ),

        createdBy: actorId,

        postedBy: actorId,

        approvedBy: actorId,

        postedAt: new Date(),

        approvedAt: new Date(),

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
          Number(
            invoice.totalAmount
          )
        ),

      credit: 0,
    },
  });

  /*
   * CR Revenue.
   */
  for (const [
    accountId,
    amount,
  ] of revenueByAccount.entries()) {
    if (amount <= 0) {
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
          roundMoney(amount),
      },
    });
  }

  /*
   * CR Tax Payable.
   */
  if (
    taxAccount &&
    Number(invoice.taxAmount) > 0
  ) {
    await tx.journalEntryLine.create({
      data: {
        journalEntryId:
          journal.id,

        accountId:
          (taxAccount as { id: string }).id,

        lineNumber:
          lineNumber++,

        memo:
          `Tax payable - ${invoice.invoiceNumber}`,

        debit: 0,

        credit:
          roundMoney(
            Number(
              invoice.taxAmount
            )
          ),
      },
    });
  }

  /*
   * Final balance verification.
   */
  const journalLines =
    await tx.journalEntryLine.findMany({
      where: {
        journalEntryId:
          journal.id,
      },
    });

  const totalDebits =
    roundMoney(
      journalLines.reduce(
        (
          total: number,
          line: any
        ) =>
          total +
          Number(line.debit),
        0
      )
    );

  const totalCredits =
    roundMoney(
      journalLines.reduce(
        (
          total: number,
          line: any
        ) =>
          total +
          Number(line.credit),
        0
      )
    );

  if (
    Math.abs(
      totalDebits -
        totalCredits
    ) > 0.01
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
    invoices: any[]
  ) => {
    if (
      invoices.length === 0
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
          (
            receivable
          ) => [
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
              ? Number(
                  receivable.outstandingBalance
                )
              : Number(
                  invoice.totalAmount
                ),

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

const enrichInvoiceWithReceivable =
  async (
    organizationId: string,
    invoice: any
  ) => {
    const result =
      await enrichInvoicesWithReceivables(
        organizationId,
        [invoice]
      );

    return result[0];
  };

/* =========================================================
   CREATE INVOICE
   ---------------------------------------------------------
   Creates a DRAFT.
   Does NOT create A/R.
   Does NOT post accounting.
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

      if (!issueDate) {
        return res.status(400).json({
          success: false,
          message:
            "Issue date is required.",
        });
      }

      if (!dueDate) {
        return res.status(400).json({
          success: false,
          message:
            "Due date is required.",
        });
      }

      const parsedIssueDate =
        parseDate(issueDate);

      const parsedDueDate =
        parseDate(dueDate);

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

      const normalizedCustomerId =
        normalizeString(
          customerId
        ) || null;

      const normalizedCustomerName =
        normalizeString(
          customerName
        );

      const result =
        await prisma.$transaction(
          async (tx) => {
            let customer = null;

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

            const finalCustomerName =
              customer
                ? `${(customer as any).firstName} ${(customer as any).lastName}`.trim()
                : normalizedCustomerName;

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
                    (customer as any)?.email ??
                    (
                      normalizeString(
                        customerEmail
                      ) || null
                    ),

                  customerPhone:
                    (customer as any)?.phoneNumber ??
                    (
                      normalizeString(
                        customerPhone
                      ) || null
                    ),

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

            await tx.invoiceLine.createMany(
              {
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
              }
            );

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
    } catch (error: any) {
      console.error(
        "CREATE INVOICE ERROR:",
        error
      );

      if (
        error?.code === "P2002"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "An invoice with this number already exists in this organization.",
        });
      }

      return res.status(400).json({
        success: false,
        message:
          error?.message ??
          "Failed to create invoice.",
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
        await prisma.invoice.findFirst({
          where: {
            id,
            organizationId,
          },
          include: {
            invoiceLines: true,
          },
        });

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
            let customer = null;

            const effectiveCustomerId =
              customerId !== undefined
                ? normalizeString(
                    customerId
                  ) || null
                : existing.customerId;

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
                : existing.invoiceLines.map(
                    (line: any) => ({
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

            const effectiveCustomerName =
              customer
                ? `${(customer as any).firstName} ${(customer as any).lastName}`.trim()
                : normalizeString(
                    customerName
                  ) ||
                  existing.customerName;

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

            const invoice =
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
                    (customer as any)?.email ??
                    (
                      customerEmail !==
                      undefined
                        ? normalizeString(
                            customerEmail
                          ) || null
                        : existing.customerEmail
                    ),

                  customerPhone:
                    (customer as any)?.phoneNumber ??
                    (
                      customerPhone !==
                      undefined
                        ? normalizeString(
                            customerPhone
                          ) || null
                        : existing.customerPhone
                    ),

                  description:
                    description !==
                    undefined
                      ? normalizeString(
                          description
                        )
                      : existing.description,

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
              "UPDATE_DRAFT_INVOICE",
              {
                invoiceId:
                  invoice.id,

                invoiceNumber:
                  invoice.invoiceNumber,

                totalAmount:
                  invoice.totalAmount,
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
    } catch (error: any) {
      console.error(
        "UPDATE INVOICE ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message:
          error?.message ??
          "Failed to update invoice.",
      });
    }
  };

/* =========================================================
   FINALIZE / POST INVOICE
   ---------------------------------------------------------
   Draft
      ?
   Validate
      ?
   Create A/R
      ?
   Create Journal Entry
      ?
   Create Journal Lines
      ?
   Mark invoice POSTED
      ?
   Audit
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
            const invoice =
              await tx.invoice.findFirst({
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

            if (
              Number(
                invoice.totalAmount
              ) <= 0
            ) {
              throw new Error(
                "Invoice total must be greater than zero."
              );
            }

            /*
             * Validate required tenant accounts
             * before changing anything.
             */
            await requireAccountByCode(
              tx,
              organizationId,
              ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
              "Accounts Receivable"
            );

            await requireAccountByCode(
              tx,
              organizationId,
              ACCOUNT_CODES.SALES_REVENUE,
              "Sales Revenue"
            );

            if (
              Number(
                invoice.taxAmount
              ) > 0
            ) {
              await requireAccountByCode(
                tx,
                organizationId,
                ACCOUNT_CODES.TAX_PAYABLE,
                "Tax Payable"
              );
            }

            /*
             * Ensure no existing A/R exists.
             */
            const existingReceivable =
              await tx.accountsReceivable.findFirst(
                {
                  where: {
                    organizationId,

                    invoiceNumber:
                      invoice.invoiceNumber,
                  },
                }
              );

            if (existingReceivable) {
              throw new Error(
                `Accounts Receivable already exists for invoice ${invoice.invoiceNumber}.`
              );
            }

            /*
             * Create Accounts Receivable.
             */
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
                      Number(
                        invoice.totalAmount
                      ),

                    outstandingBalance:
                      Number(
                        invoice.totalAmount
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

            /*
             * Create balanced journal.
             */
            const journal =
              await createInvoiceJournal(
                tx,
                organizationId,
                invoice,
                actorId
              );

            /*
             * Mark invoice as posted.
             */
            const postedInvoice =
              await tx.invoice.update({
                where: {
                  id: invoice.id,
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
    } catch (error: any) {
      console.error(
        "FINALIZE INVOICE ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message:
          error?.message ??
          "Failed to finalize invoice.",
      });
    }
  };

/* =========================================================
   GET ALL INVOICES
   ---------------------------------------------------------
   Query:
   ?page=1
   ?pageSize=20
   ?search=ABC
   ?status=DRAFT
   ?paymentStatus=UNPAID
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
        Math.max(
          1,
          Number.parseInt(
            String(
              req.query.page ??
                "1"
            ),
            10
          ) || 1
        );

      const pageSize =
        Math.min(
          100,
          Math.max(
            1,
            Number.parseInt(
              String(
                req.query.pageSize ??
                  "20"
              ),
              10
            ) || 20
          )
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

      const skip =
        (page - 1) *
        pageSize;

      const where: any = {
        organizationId,
      };

      if (status) {
        where.status = status;
      }

      if (paymentStatus) {
        where.paymentStatus =
          paymentStatus;
      }

      if (search) {
        where.OR = [
          {
            invoiceNumber: {
              contains:
                search,
              mode: "insensitive",
            },
          },

          {
            customerName: {
              contains:
                search,
              mode: "insensitive",
            },
          },

          {
            customerEmail: {
              contains:
                search,
              mode: "insensitive",
            },
          },

          {
            customerPhone: {
              contains:
                search,
              mode: "insensitive",
            },
          },

          {
            description: {
              contains:
                search,
              mode: "insensitive",
            },
          },
        ];
      }

      const [
        invoices,
        total,
      ] =
        await Promise.all([
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
        Math.ceil(
          total / pageSize
        );

      return res.status(200).json({
        success: true,

        invoices: enriched,

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
            page > 1,
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
        await prisma.invoice.findFirst({
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

      if (!invoice) {
        return res.status(404).json({
          success: false,
          message:
            "Invoice not found.",
        });
      }

      const enriched =
        await enrichInvoiceWithReceivable(
          organizationId,
          invoice
        );

      return res.status(200).json({
        success: true,

        invoice: enriched,
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
   DELETE / CANCEL DRAFT
   ---------------------------------------------------------
   Posted invoices cannot simply be deleted.
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

      const invoice =
        await prisma.invoice.findFirst({
          where: {
            id,
            organizationId,
          },
        });

      if (!invoice) {
        return res.status(404).json({
          success: false,
          message:
            "Invoice not found.",
        });
      }

      if (
        invoice.status !==
        INVOICE_STATUS.DRAFT
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Only draft invoices can be deleted. Posted invoices must be reversed/voided through the accounting workflow.",
        });
      }

      await prisma.$transaction(
        async (tx) => {
          await tx.invoice.delete({
            where: {
              id: invoice.id,
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

      return res.status(500).json({
        success: false,
        message:
          "Failed to delete invoice.",
      });
    }
  };

/* =========================================================
   VOID POSTED INVOICE
   ---------------------------------------------------------
   This does NOT delete the invoice.
   It creates a reversing journal entry and closes
   the associated A/R record.

   This is deliberately separated from delete.
========================================================= */

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
            const invoice =
              await tx.invoice.findFirst({
                where: {
                  id,
                  organizationId,
                },

                include: {
                  invoiceLines: true,
                },
              });

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

            const reversalReference =
              `REV-${invoice.invoiceNumber}`;

            const existingReversal =
              await tx.journalEntry.findFirst(
                {
                  where: {
                    organizationId,

                    reference:
                      reversalReference,
                  },
                }
              );

            if (existingReversal) {
              throw new Error(
                "A reversal already exists for this invoice."
              );
            }

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
                      Number(
                        originalJournal.amount
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
              originalJournal.lines.length;
              index++
            ) {
              const originalLine =
                originalJournal.lines[
                  index
                ];

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
                        Number(
                          originalLine.credit
                        )
                      ),

                    credit:
                      roundMoney(
                        Number(
                          originalLine.debit
                        )
                      ),
                  },
                }
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

            if (
              receivable &&
              Number(
                receivable.outstandingBalance
              ) > 0
            ) {
              await tx.accountsReceivable.update(
                {
                  where: {
                    id:
                      receivable.id,
                  },

                  data: {
                    outstandingBalance:
                      0,

                    paymentStatus:
                      PAYMENT_STATUS.PAID,

                    status:
                      AR_STATUS.CLOSED,
                  },
                }
              );
            }

            const voidedInvoice =
              await tx.invoice.update({
                where: {
                  id: invoice.id,
                },

                data: {
                  status:
                    INVOICE_STATUS.VOID,

                  paymentStatus:
                    PAYMENT_STATUS.PAID,
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

                reversalJournalId:
                  reversal.id,

                reason,
              }
            );

            return {
              invoice:
                voidedInvoice,

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

        reversalJournal:
          result.reversal,
      });
    } catch (error: any) {
      console.error(
        "VOID INVOICE ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message:
          error?.message ??
          "Failed to void invoice.",
      });
    }
  };

/* =========================================================
   GET INVOICE STATISTICS
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
        invoices,
        receivables,
      ] =
        await Promise.all([
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
              paymentStatus:
                PAYMENT_STATUS.UNPAID,
            },
          }),

          prisma.invoice.findMany({
            where: {
              organizationId,
              status:
                INVOICE_STATUS.POSTED,
            },

            select: {
              subtotal: true,
              taxAmount: true,
              totalAmount: true,
            },
          }),

          prisma.accountsReceivable.findMany(
            {
              where: {
                organizationId,

                status: {
                  not:
                    AR_STATUS.CLOSED,
                },
              },

              select: {
                outstandingBalance:
                  true,
              },
            }
          ),
        ]);

      const totalInvoiced =
        roundMoney(
          invoices.reduce(
            (
              total,
              invoice
            ) =>
              total +
              Number(
                invoice.totalAmount
              ),
            0
          )
        );

      const totalTax =
        roundMoney(
          invoices.reduce(
            (
              total,
              invoice
            ) =>
              total +
              Number(
                invoice.taxAmount
              ),
            0
          )
        );

      const totalReceivable =
        roundMoney(
          receivables.reduce(
            (
              total,
              receivable
            ) =>
              total +
              Number(
                receivable.outstandingBalance
              ),
            0
          )
        );

      return res.status(200).json({
        success: true,

        stats: {
          draftCount,

          postedCount,

          voidCount,

          unpaidCount,

          totalInvoiced,

          totalTax,

          totalReceivable,
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
