import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const stkPush = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      phoneNumber,
      amount,
      accountReference,
      transactionDesc
    } = req.body;

    const transaction =
      await prisma.mpesaTransaction.create({
        data: {
          transactionType: "STK_PUSH",
          phoneNumber,
          amount,
          accountReference,
          transactionDesc,
          status: "PENDING"
        }
      });

    return res.status(201).json(transaction);
  } catch (error) {
    return res.status(500).json(error);
  }
};

export const c2bPayment = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      phoneNumber,
      amount,
      accountReference
    } = req.body;

    const transaction =
      await prisma.mpesaTransaction.create({
        data: {
          transactionType: "C2B",
          phoneNumber,
          amount,
          accountReference,
          status: "COMPLETED"
        }
      });

    return res.status(201).json(transaction);
  } catch (error) {
    return res.status(500).json(error);
  }
};

export const b2cPayment = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      phoneNumber,
      amount,
      counterparty
    } = req.body;

    const transaction =
      await prisma.mpesaTransaction.create({
        data: {
          transactionType: "B2C",
          phoneNumber,
          amount,
          counterparty,
          status: "PENDING"
        }
      });

    return res.status(201).json(transaction);
  } catch (error) {
    return res.status(500).json(error);
  }
};

export const b2bPayment = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      amount,
      counterparty,
      accountReference
    } = req.body;

    const transaction =
      await prisma.mpesaTransaction.create({
        data: {
          transactionType: "B2B",
          phoneNumber: "BUSINESS",
          amount,
          counterparty,
          accountReference,
          status: "PENDING"
        }
      });

    return res.status(201).json(transaction);
  } catch (error) {
    return res.status(500).json(error);
  }
};

export const mpesaCallback = async (
  req: Request,
  res: Response
) => {
  try {
    return res.status(200).json({
      ResultCode: 0,
      ResultDesc: "Accepted"
    });
  } catch (error) {
    return res.status(500).json(error);
  }
};

export const getTransactions = async (
  req: Request,
  res: Response
) => {
  try {
    const transactions =
      await prisma.mpesaTransaction.findMany({
        orderBy: {
          createdAt: "desc"
        }
      });

    return res.status(200).json(transactions);
  } catch (error) {
    return res.status(500).json(error);
  }
};

export const getTransactionById = async (
  req: Request,
  res: Response
) => {
  try {
    const transaction =
      await prisma.mpesaTransaction.findUnique({
        where: {
          id: req.params.id as string
        }
      });

    if (!transaction) {
      return res.status(404).json({
        message: "Transaction not found"
      });
    }

    return res.status(200).json(transaction);
  } catch (error) {
    return res.status(500).json(error);
  }
};