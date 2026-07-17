import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const createReceivable = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      invoiceNumber,
      customerName,
      description,
      amount,
      dueDate
    } = req.body;

    const receivable = await prisma.accountsReceivable.create({
      data: {
        invoiceNumber,
        customerName,
        description,
        amount,
        outstandingBalance: amount,
        dueDate: new Date(dueDate),
        paymentStatus: "UNPAID",
        status: "PENDING"
      }
    });

    return res.status(201).json({
      success: true,
      receivable
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to create receivable"
    });
  }
};

export const getReceivables = async (
  req: Request,
  res: Response
) => {
  try {
    const receivables =
      await prisma.accountsReceivable.findMany({
        orderBy: {
          createdAt: "desc"
        }
      });

    return res.status(200).json({
      success: true,
      receivables
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch receivables"
    });
  }
};