import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const createVendor = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      vendorCode,
      name,
      email,
      phoneNumber,
      address,
      taxNumber
    } = req.body;

    const vendor = await prisma.vendor.create({
      data: {
        vendorCode,
        name,
        email,
        phoneNumber,
        address,
        taxNumber,
        status: "ACTIVE"
      }
    });

    return res.status(201).json({
      success: true,
      vendor
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to create vendor"
    });
  }
};

export const getVendors = async (
  req: Request,
  res: Response
) => {
  try {
    const vendors = await prisma.vendor.findMany({
      orderBy: {
        createdAt: "desc"
      }
    });

    return res.status(200).json({
      success: true,
      vendors
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch vendors"
    });
  }
};