import { Request, Response } from "express";
import prisma from "../config/prisma";

/* =========================================================
   HELPERS
========================================================= */

const parseAsOfDate = (value: unknown): Date => {
  if (!value) {
    return new Date();
  }

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    throw new Error("INVALID_DATE");
  }

  date.setHours(23, 59, 59, 999);

  return date;
};

const daysBetween = (
  earlier: Date,
  later: Date
): number => {
  const milliseconds =
    later.getTime() - earlier.getTime();

  return Math.max(
    0,
    Math.floor(
      milliseconds / (1000 * 60 * 60 * 24)
    )
  );
};

const getBucket = (
  daysPastDue: number
):
  | "current"
  | "days1To30"
  | "days31To60"
  | "days61To90"
  | "daysOver90" => {
  if (daysPastDue <= 0) {
    return "current";
  }

  if (daysPastDue <= 30) {
    return "days1To30";
  }

  if (daysPastDue <= 60) {
    return "days31To60";
  }

  if (daysPastDue <= 90) {
    return "days61To90";
  }

  return "daysOver90";
};

const emptyAging = () => ({
  current: 0,
  days1To30: 0,
  days31To60: 0,
  days61To90: 0,
  daysOver90: 0,
});

/* =========================================================
   ACCOUNTS RECEIVABLE AGING
========================================================= */

export const getReceivablesAging = async (
  req: Request,
  res: Response
) => {
  try {
    let asOfDate: Date;

    try {
      asOfDate = parseAsOfDate(
        req.query.asOfDate
      );
    } catch {
      return res.status(400).json({
        success: false,
        message: "Invalid asOfDate",
      });
    }

    const receivables =
      await prisma.accountsReceivable.findMany({
        where: {
          outstandingBalance: {
            gt: 0,
          },
        },

        orderBy: [
          {
            dueDate: "asc",
          },
          {
            invoiceNumber: "asc",
          },
        ],
      });

    const aging = emptyAging();

    const items = receivables.map(
      (receivable) => {
        const daysPastDue =
          receivable.dueDate < asOfDate
            ? daysBetween(
                receivable.dueDate,
                asOfDate
              )
            : 0;

        const bucket =
          getBucket(daysPastDue);

        aging[bucket] +=
          receivable.outstandingBalance;

        return {
          id: receivable.id,
          invoiceNumber:
            receivable.invoiceNumber,
          customerName:
            receivable.customerName,
          description:
            receivable.description,
          originalAmount:
            receivable.amount,
          outstandingBalance:
            receivable.outstandingBalance,
          dueDate: receivable.dueDate,
          paymentStatus:
            receivable.paymentStatus,
          status: receivable.status,
          daysPastDue,
          bucket,
        };
      }
    );

    const totalOutstanding =
      items.reduce(
        (total, item) =>
          total +
          item.outstandingBalance,
        0
      );

    return res.status(200).json({
      success: true,

      items,

      aging,

      totals: {
        outstanding:
          totalOutstanding,

        overdue:
          aging.days1To30 +
          aging.days31To60 +
          aging.days61To90 +
          aging.daysOver90,
      },

      meta: {
        asOfDate:
          asOfDate.toISOString(),
        records: items.length,
        currency: "KES",
        generatedAt:
          new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "RECEIVABLES AGING ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate receivables aging report",
    });
  }
};

/* =========================================================
   ACCOUNTS PAYABLE AGING
========================================================= */

export const getPayablesAging = async (
  req: Request,
  res: Response
) => {
  try {
    let asOfDate: Date;

    try {
      asOfDate = parseAsOfDate(
        req.query.asOfDate
      );
    } catch {
      return res.status(400).json({
        success: false,
        message: "Invalid asOfDate",
      });
    }

    const payables =
      await prisma.accountsPayable.findMany({
        where: {
          outstandingBalance: {
            gt: 0,
          },
        },

        include: {
          vendor: true,
        },

        orderBy: [
          {
            dueDate: "asc",
          },
          {
            invoiceNumber: "asc",
          },
        ],
      });

    const aging = emptyAging();

    const items = payables.map(
      (payable) => {
        const daysPastDue =
          payable.dueDate < asOfDate
            ? daysBetween(
                payable.dueDate,
                asOfDate
              )
            : 0;

        const bucket =
          getBucket(daysPastDue);

        aging[bucket] +=
          payable.outstandingBalance;

        return {
          id: payable.id,
          invoiceNumber:
            payable.invoiceNumber,

          vendor: {
            id: payable.vendor.id,
            vendorCode:
              payable.vendor.vendorCode,
            name: payable.vendor.name,
          },

          description:
            payable.description,

          originalAmount:
            payable.amount,

          outstandingBalance:
            payable.outstandingBalance,

          dueDate: payable.dueDate,

          paymentStatus:
            payable.paymentStatus,

          status: payable.status,

          daysPastDue,
          bucket,
        };
      }
    );

    const totalOutstanding =
      items.reduce(
        (total, item) =>
          total +
          item.outstandingBalance,
        0
      );

    return res.status(200).json({
      success: true,

      items,

      aging,

      totals: {
        outstanding:
          totalOutstanding,

        overdue:
          aging.days1To30 +
          aging.days31To60 +
          aging.days61To90 +
          aging.daysOver90,
      },

      meta: {
        asOfDate:
          asOfDate.toISOString(),
        records: items.length,
        currency: "KES",
        generatedAt:
          new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "PAYABLES AGING ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate payables aging report",
    });
  }
};

/* =========================================================
   CUSTOMER BALANCES
========================================================= */

export const getCustomerBalances = async (
  req: Request,
  res: Response
) => {
  try {
    const receivables =
      await prisma.accountsReceivable.findMany({
        orderBy: {
          customerName: "asc",
        },
      });

    const customers = new Map<
      string,
      {
        customerName: string;
        invoices: number;
        originalAmount: number;
        outstandingBalance: number;
        overdueBalance: number;
      }
    >();

    const now = new Date();

    for (const receivable of receivables) {
      const key =
        receivable.customerName
          .trim()
          .toLowerCase();

      const existing =
        customers.get(key) ?? {
          customerName:
            receivable.customerName,
          invoices: 0,
          originalAmount: 0,
          outstandingBalance: 0,
          overdueBalance: 0,
        };

      existing.invoices += 1;

      existing.originalAmount +=
        receivable.amount;

      existing.outstandingBalance +=
        receivable.outstandingBalance;

      if (
        receivable.dueDate < now &&
        receivable.outstandingBalance > 0
      ) {
        existing.overdueBalance +=
          receivable.outstandingBalance;
      }

      customers.set(key, existing);
    }

    const items = Array.from(
      customers.values()
    ).sort(
      (a, b) =>
        b.outstandingBalance -
        a.outstandingBalance
    );

    const totals = items.reduce(
      (result, customer) => {
        result.originalAmount +=
          customer.originalAmount;

        result.outstandingBalance +=
          customer.outstandingBalance;

        result.overdueBalance +=
          customer.overdueBalance;

        return result;
      },
      {
        originalAmount: 0,
        outstandingBalance: 0,
        overdueBalance: 0,
      }
    );

    return res.status(200).json({
      success: true,

      items,

      totals,

      meta: {
        customers: items.length,
        currency: "KES",
        generatedAt:
          new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "CUSTOMER BALANCES ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate customer balances report",
    });
  }
};

/* =========================================================
   VENDOR PAYABLES
========================================================= */

export const getVendorPayables = async (
  req: Request,
  res: Response
) => {
  try {
    const vendors =
      await prisma.vendor.findMany({
        include: {
          payables: true,
        },

        orderBy: {
          name: "asc",
        },
      });

    const now = new Date();

    const items = vendors
      .map((vendor) => {
        const originalAmount =
          vendor.payables.reduce(
            (total, payable) =>
              total + payable.amount,
            0
          );

        const outstandingBalance =
          vendor.payables.reduce(
            (total, payable) =>
              total +
              payable.outstandingBalance,
            0
          );

        const overdueBalance =
          vendor.payables.reduce(
            (total, payable) => {
              if (
                payable.dueDate < now &&
                payable.outstandingBalance >
                  0
              ) {
                return (
                  total +
                  payable.outstandingBalance
                );
              }

              return total;
            },
            0
          );

        return {
          id: vendor.id,
          vendorCode:
            vendor.vendorCode,
          vendorName: vendor.name,
          invoices:
            vendor.payables.length,
          originalAmount,
          outstandingBalance,
          overdueBalance,
          status: vendor.status,
        };
      })
      .filter(
        (vendor) =>
          vendor.outstandingBalance > 0
      )
      .sort(
        (a, b) =>
          b.outstandingBalance -
          a.outstandingBalance
      );

    const totals = items.reduce(
      (result, vendor) => {
        result.originalAmount +=
          vendor.originalAmount;

        result.outstandingBalance +=
          vendor.outstandingBalance;

        result.overdueBalance +=
          vendor.overdueBalance;

        return result;
      },
      {
        originalAmount: 0,
        outstandingBalance: 0,
        overdueBalance: 0,
      }
    );

    return res.status(200).json({
      success: true,

      items,

      totals,

      meta: {
        vendors: items.length,
        currency: "KES",
        generatedAt:
          new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "VENDOR PAYABLES ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate vendor payables report",
    });
  }
};