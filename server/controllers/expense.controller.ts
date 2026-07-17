import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const createExpense = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      expenseCode,
      vendorId,
      category,
      description,
      amount,
      expenseDate,
      approvedBy
    } = req.body;

    const expense = await prisma.expense.create({
      data: {
        expenseCode,
        vendorId,
        category,
        description,
        amount,
        expenseDate: new Date(expenseDate),
        status: "PENDING",
        approvedBy
      },
      include: {
        vendor: true
      }
    });

    return res.status(201).json({
      success: true,
      expense
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to create expense"
    });
  }
};

export const getExpenses = async (
  req: Request,
  res: Response
) => {
  try {
    const expenses = await prisma.expense.findMany({
      include: {
        vendor: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return res.status(200).json({
      success: true,
      expenses
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch expenses"
    });
  }
};