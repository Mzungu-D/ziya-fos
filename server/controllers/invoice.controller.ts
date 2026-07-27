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

/* =========================================================
   CREATE INVOICE
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
      invoiceNumber,
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

    if (
      !invoiceNumber ||
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
          "Invoice number, customer name, subtotal, total amount, issue date and due date are required.",
      });
    }

    const normalizedSubtotal =
      Number(subtotal);

    const normalizedTaxAmount =
      Number(taxAmount ?? 0);

    const normalizedTotalAmount =
      Number(totalAmount);

    if (
      !Number.isFinite(normalizedSubtotal) ||
      !Number.isFinite(normalizedTaxAmount) ||
      !Number.isFinite(normalizedTotalAmount)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Subtotal, tax amount and total amount must be valid numbers.",
      });
    }

    if (
      normalizedSubtotal < 0 ||
      normalizedTaxAmount < 0 ||
      normalizedTotalAmount < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invoice amounts cannot be negative.",
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

    const invoice =
      await prisma.invoice.create({
        data: {
          organizationId,

          invoiceNumber:
            String(invoiceNumber).trim(),

          customerName:
            String(customerName).trim(),

          customerEmail:
            customerEmail
              ? String(customerEmail).trim()
              : null,

          customerPhone:
            customerPhone
              ? String(customerPhone).trim()
              : null,

          description:
            description
              ? String(description).trim()
              : "",

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

    return res.status(201).json({
      success: true,
      invoice,
    });
  } catch (error: any) {
    console.error(
      "CREATE INVOICE ERROR:",
      error
    );

    if (error?.code === "P2002") {
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

    return res.status(200).json({
      success: true,
      invoices,

      meta: {
        organizationId,
        count: invoices.length,
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
        message: "Invoice ID is required.",
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

    return res.status(200).json({
      success: true,
      invoice,
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