import { Response } from "express";
import prisma from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   HELPERS
========================================================= */

const getOrganizationId = (
  req: AuthRequest
): string | null => {
  return req.user?.organizationId ?? null;
};

/**
 * Generates the next invoice number for an organization.
 *
 * Format:
 * INV-YYYY-000001
 *
 * The sequence is scoped to:
 * - organization
 * - calendar year
 *
 * PostgreSQL transaction advisory locking is used so
 * concurrent invoice creation requests cannot generate
 * the same number.
 */
const generateInvoiceNumber = async (
  tx: any,
  organizationId: string,
  issueDate: Date
): Promise<string> => {
  const year = issueDate.getFullYear();

  const prefix = `INV-${year}-`;

  /*
   * Serialize invoice-number generation for this
   * organization and year.
   *
   * pg_advisory_xact_lock automatically releases when
   * the surrounding transaction finishes.
   */
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtext(${`${organizationId}:${year}:invoice-number`})
    )
  `;

  /*
   * Fetch existing invoice numbers for this organization
   * and year.
   */
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

  /*
   * Fetch existing Accounts Receivable invoice numbers too.
   *
   * This protects the shared numbering relationship between
   * Invoice and Accounts Receivable.
   */
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
      (receivable: { invoiceNumber: string }) =>
        receivable.invoiceNumber
    ),
  ];

  let highestSequence = 0;

  for (const number of usedNumbers) {
    if (!number.startsWith(prefix)) {
      continue;
    }

    const suffix = number.slice(prefix.length);
    const sequence = Number(suffix);

    if (
      Number.isInteger(sequence) &&
      sequence > highestSequence
    ) {
      highestSequence = sequence;
    }
  }

  const nextSequence = highestSequence + 1;

  return `${prefix}${String(nextSequence).padStart(
    6,
    "0"
  )}`;
};

/**
 * Invoice is the billing document.
 *
 * Accounts Receivable is the source of truth for:
 * - outstanding balance
 * - payment status
 *
 * The models are intentionally matched by:
 * organizationId + invoiceNumber
 */
const enrichInvoicesWithReceivables = async (
  organizationId: string,
  invoices: any[]
) => {
  if (invoices.length === 0) {
    return [];
  }

  const invoiceNumbers =
    invoices.map(
      (invoice) => invoice.invoiceNumber
    );

  const receivables =
    await prisma.accountsReceivable.findMany({
      where: {
        organizationId,
        invoiceNumber: {
          in: invoiceNumbers,
        },
      },
    });

  const receivableMap =
    new Map(
      receivables.map(
        (receivable) => [
          receivable.invoiceNumber,
          receivable,
        ]
      )
    );

  return invoices.map((invoice) => {
    const receivable =
      receivableMap.get(
        invoice.invoiceNumber
      );

    return {
      ...invoice,

      outstandingBalance: receivable
        ? Number(
            receivable.outstandingBalance
          )
        : Number(invoice.totalAmount),

      paymentStatus:
        receivable?.paymentStatus ??
        invoice.paymentStatus,
    };
  });
};

/**
 * Enrich a single invoice with its
 * Accounts Receivable balance and status.
 */
const enrichInvoiceWithReceivable = async (
  organizationId: string,
  invoice: any
) => {
  const enrichedInvoices =
    await enrichInvoicesWithReceivables(
      organizationId,
      [invoice]
    );

  return enrichedInvoices[0];
};

/* =========================================================
   CREATE INVOICE + ACCOUNTS RECEIVABLE
========================================================= */

export const createInvoice = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const {
      customerName,
      customerEmail,
      customerPhone,
      description,
      subtotal,
      taxAmount,
      totalAmount,
      issueDate,
      dueDate,
    } = req.body;

    /*
     * Invoice number is intentionally NOT accepted from
     * the frontend.
     *
     * The backend generates it automatically.
     */
    if (
      !customerName ||
      subtotal === undefined ||
      subtotal === null ||
      totalAmount === undefined ||
      totalAmount === null ||
      !issueDate ||
      !dueDate
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Customer name, subtotal, total amount, issue date and due date are required.",
      });
    }

    const normalizedSubtotal =
      Number(subtotal);

    const normalizedTaxAmount =
      Number(taxAmount ?? 0);

    const normalizedTotalAmount =
      Number(totalAmount);

    if (
      !Number.isFinite(
        normalizedSubtotal
      ) ||
      !Number.isFinite(
        normalizedTaxAmount
      ) ||
      !Number.isFinite(
        normalizedTotalAmount
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Subtotal, tax amount and total amount must be valid numbers.",
      });
    }

    if (
      normalizedSubtotal <= 0 ||
      normalizedTaxAmount < 0 ||
      normalizedTotalAmount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Subtotal and total amount must be greater than zero, while tax cannot be negative.",
      });
    }

    const calculatedTotal =
      normalizedSubtotal +
      normalizedTaxAmount;

    if (
      Math.abs(
        calculatedTotal -
          normalizedTotalAmount
      ) > 0.01
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Total amount must equal subtotal plus tax amount.",
      });
    }

    const parsedIssueDate =
      new Date(issueDate);

    const parsedDueDate =
      new Date(dueDate);

    if (
      Number.isNaN(
        parsedIssueDate.getTime()
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Issue date is invalid.",
      });
    }

    if (
      Number.isNaN(
        parsedDueDate.getTime()
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Due date is invalid.",
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

    const normalizedCustomerName =
      String(customerName).trim();

    const normalizedDescription =
      description
        ? String(description).trim()
        : "";

    if (!normalizedCustomerName) {
      return res.status(400).json({
        success: false,
        message: "Customer name is required.",
      });
    }

    const result =
      await prisma.$transaction(
        async (tx) => {
          /* ---------------------------------------------
             GENERATE SERVER-SIDE INVOICE NUMBER
          --------------------------------------------- */

          const generatedInvoiceNumber =
            await generateInvoiceNumber(
              tx,
              organizationId,
              parsedIssueDate
            );

          /* ---------------------------------------------
             CREATE INVOICE
          --------------------------------------------- */

          const invoice =
            await tx.invoice.create({
              data: {
                organizationId,

                invoiceNumber:
                  generatedInvoiceNumber,

                customerName:
                  normalizedCustomerName,

                customerEmail:
                  customerEmail
                    ? String(
                        customerEmail
                      ).trim()
                    : null,

                customerPhone:
                  customerPhone
                    ? String(
                        customerPhone
                      ).trim()
                    : null,

                description:
                  normalizedDescription,

                subtotal:
                  normalizedSubtotal,

                taxAmount:
                  normalizedTaxAmount,

                totalAmount:
                  normalizedTotalAmount,

                issueDate:
                  parsedIssueDate,

                dueDate:
                  parsedDueDate,

                paymentStatus:
                  "UNPAID",

                status:
                  "ACTIVE",
              },
            });

          /* ---------------------------------------------
             CREATE ACCOUNTS RECEIVABLE
          --------------------------------------------- */

          const receivable =
            await tx.accountsReceivable.create({
              data: {
                organizationId,

                /*
                 * IMPORTANT:
                 * AR receives the exact same number
                 * generated for the Invoice.
                 */
                invoiceNumber:
                  generatedInvoiceNumber,

                customerName:
                  normalizedCustomerName,

                description:
                  normalizedDescription ||
                  `Invoice ${generatedInvoiceNumber}`,

                amount:
                  normalizedTotalAmount,

                outstandingBalance:
                  normalizedTotalAmount,

                dueDate:
                  parsedDueDate,

                paymentStatus:
                  "UNPAID",

                status:
                  "PENDING",
              },
            });

          return {
            invoice,
            receivable,
          };
        }
      );

    return res.status(201).json({
      success: true,

      message:
        "Invoice created and Accounts Receivable entry created successfully.",

      invoice: {
        ...result.invoice,

        outstandingBalance:
          Number(
            result.receivable
              .outstandingBalance
          ),
      },

      receivable:
        result.receivable,
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
          "An invoice with this invoice number already exists in this organization.",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to create invoice",
    });
  }
};

/* =========================================================
   GET ALL INVOICES
========================================================= */

export const getInvoices = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const invoices =
      await prisma.invoice.findMany({
        where: {
          organizationId,
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    /*
     * Enrich all invoices with their corresponding
     * Accounts Receivable balance and payment status.
     *
     * AR remains the source of truth for payment state.
     *
     * Receivables are fetched in one query instead of
     * performing one database query per invoice.
     */
    const enrichedInvoices =
      await enrichInvoicesWithReceivables(
        organizationId,
        invoices
      );

    return res.status(200).json({
      success: true,

      invoices:
        enrichedInvoices,

      meta: {
        organizationId,

        count:
          enrichedInvoices.length,
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
        "Failed to fetch invoices",
    });
  }
};

/* =========================================================
   GET ONE INVOICE
========================================================= */

export const getInvoiceById = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const id =
      req.params.id as string;

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
        message: "Invoice not found.",
      });
    }

    const enrichedInvoice =
      await enrichInvoiceWithReceivable(
        organizationId,
        invoice
      );

    return res.status(200).json({
      success: true,

      invoice:
        enrichedInvoice,
    });
  } catch (error) {
    console.error(
      "GET INVOICE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch invoice",
    });
  }
};