import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const createPayable = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      invoiceNumber,
      vendorId,
      description,
      amount,
      dueDate
    } = req.body;

    const payable = await prisma.accountsPayable.create({
      data: {
        invoiceNumber,
        vendorId,
        description,
        amount,
        outstandingBalance: amount,
        dueDate: new Date(dueDate),
        paymentStatus: "UNPAID",
        status: "PENDING"
      },
      include: {
        vendor: true
      }
    });

    return res.status(201).json({
      success: true,
      payable
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to create payable"
    });
  }
};

export const getPayables = async (
  req: Request,
  res: Response
) => {
  try {
    const payables = await prisma.accountsPayable.findMany({
      include: {
        vendor: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return res.status(200).json({
      success: true,
      payables
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch payables"
    });
  }
};