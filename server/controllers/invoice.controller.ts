import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const createInvoice = async (
  req: Request,
  res: Response
) => {
  try {
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
      dueDate
    } = req.body;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        customerName,
        customerEmail,
        customerPhone,
        description,
        subtotal,
        taxAmount: taxAmount || 0,
        totalAmount,
        issueDate: new Date(issueDate),
        dueDate: new Date(dueDate),
        paymentStatus: "UNPAID",
        status: "ACTIVE"
      }
    });

    return res.status(201).json({
      success: true,
      invoice
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to create invoice"
    });
  }
};

export const getInvoices = async (
  req: Request,
  res: Response
) => {
  try {
    const invoices = await prisma.invoice.findMany({
      orderBy: {
        createdAt: "desc"
      }
    });

    return res.status(200).json({
      success: true,
      invoices
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch invoices"
    });
  }
};

export const getInvoiceById = async (
  req: Request,
  res: Response
) => {
  try {
    const id = req.params.id as string;

    const invoice = await prisma.invoice.findUnique({
      where: {
        id
      }
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found"
      });
    }

    return res.status(200).json({
      success: true,
      invoice
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch invoice"
    });
  }
};