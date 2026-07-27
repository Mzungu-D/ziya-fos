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

const parseAsOfDate = (
  value: unknown
): Date => {
  if (!value) {
    return new Date();
  }

  const date = new Date(
    String(value)
  );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw new Error(
      "INVALID_DATE"
    );
  }

  date.setHours(
    23,
    59,
    59,
    999
  );

  return date;
};

const daysBetween = (
  earlier: Date,
  later: Date
): number => {
  const milliseconds =
    later.getTime() -
    earlier.getTime();

  return Math.max(
    0,
    Math.floor(
      milliseconds /
        (1000 * 60 * 60 * 24)
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

    let asOfDate: Date;

    try {
      asOfDate =
        parseAsOfDate(
          req.query.asOfDate
        );
    } catch {
      return res.status(400).json({
        success: false,
        message:
          "Invalid asOfDate",
      });
    }

    const receivables =
      await prisma.accountsReceivable.findMany({
        where: {
          organizationId,

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

    const aging =
      emptyAging();

    const items =
      receivables.map(
        (receivable) => {
          const daysPastDue =
            receivable.dueDate <
            asOfDate
              ? daysBetween(
                  receivable.dueDate,
                  asOfDate
                )
              : 0;

          const bucket =
            getBucket(
              daysPastDue
            );

          aging[bucket] +=
            Number(
              receivable.outstandingBalance
            );

          return {
            id:
              receivable.id,

            invoiceNumber:
              receivable.invoiceNumber,

            customerName:
              receivable.customerName,

            description:
              receivable.description,

            originalAmount:
              Number(
                receivable.amount
              ),

            outstandingBalance:
              Number(
                receivable.outstandingBalance
              ),

            dueDate:
              receivable.dueDate,

            paymentStatus:
              receivable.paymentStatus,

            status:
              receivable.status,

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
        organizationId,

        asOfDate:
          asOfDate.toISOString(),

        records:
          items.length,

        currency: "KES",

        generatedAt:
          new Date()
            .toISOString(),
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

    let asOfDate: Date;

    try {
      asOfDate =
        parseAsOfDate(
          req.query.asOfDate
        );
    } catch {
      return res.status(400).json({
        success: false,
        message:
          "Invalid asOfDate",
      });
    }

    const payables =
      await prisma.accountsPayable.findMany({
        where: {
          organizationId,

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

    const aging =
      emptyAging();

    const items =
      payables.map(
        (payable) => {
          const daysPastDue =
            payable.dueDate <
            asOfDate
              ? daysBetween(
                  payable.dueDate,
                  asOfDate
                )
              : 0;

          const bucket =
            getBucket(
              daysPastDue
            );

          aging[bucket] +=
            Number(
              payable.outstandingBalance
            );

          return {
            id:
              payable.id,

            invoiceNumber:
              payable.invoiceNumber,

            vendor: {
              id:
                payable.vendor.id,

              vendorCode:
                payable.vendor.vendorCode,

              name:
                payable.vendor.name,
            },

            description:
              payable.description,

            originalAmount:
              Number(
                payable.amount
              ),

            outstandingBalance:
              Number(
                payable.outstandingBalance
              ),

            dueDate:
              payable.dueDate,

            paymentStatus:
              payable.paymentStatus,

            status:
              payable.status,

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
        organizationId,

        asOfDate:
          asOfDate.toISOString(),

        records:
          items.length,

        currency: "KES",

        generatedAt:
          new Date()
            .toISOString(),
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

    const receivables =
      await prisma.accountsReceivable.findMany({
        where: {
          organizationId,
        },

        orderBy: {
          customerName: "asc",
        },
      });

    const customers =
      new Map<
        string,
        {
          customerName: string;
          invoices: number;
          originalAmount: number;
          outstandingBalance: number;
          overdueBalance: number;
        }
      >();

    const now =
      new Date();

    for (
      const receivable of
      receivables
    ) {
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
        Number(
          receivable.amount
        );

      existing.outstandingBalance +=
        Number(
          receivable.outstandingBalance
        );

      if (
        receivable.dueDate <
          now &&
        Number(
          receivable.outstandingBalance
        ) > 0
      ) {
        existing.overdueBalance +=
          Number(
            receivable.outstandingBalance
          );
      }

      customers.set(
        key,
        existing
      );
    }

    const items =
      Array.from(
        customers.values()
      ).sort(
        (a, b) =>
          b.outstandingBalance -
          a.outstandingBalance
      );

    const totals =
      items.reduce(
        (
          result,
          customer
        ) => {
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
        organizationId,

        customers:
          items.length,

        currency: "KES",

        generatedAt:
          new Date()
            .toISOString(),
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

    /*
     * Both Vendor and included Payables are
     * explicitly tenant-scoped.
     */
    const vendors =
      await prisma.vendor.findMany({
        where: {
          organizationId,
        },

        include: {
          payables: {
            where: {
              organizationId,
            },
          },
        },

        orderBy: {
          name: "asc",
        },
      });

    const now =
      new Date();

    const items = vendors
      .map((vendor) => {
        const originalAmount =
          vendor.payables.reduce(
            (
              total,
              payable
            ) =>
              total +
              Number(
                payable.amount
              ),
            0
          );

        const outstandingBalance =
          vendor.payables.reduce(
            (
              total,
              payable
            ) =>
              total +
              Number(
                payable.outstandingBalance
              ),
            0
          );

        const overdueBalance =
          vendor.payables.reduce(
            (
              total,
              payable
            ) => {
              if (
                payable.dueDate <
                  now &&
                Number(
                  payable.outstandingBalance
                ) > 0
              ) {
                return (
                  total +
                  Number(
                    payable.outstandingBalance
                  )
                );
              }

              return total;
            },
            0
          );

        return {
          id:
            vendor.id,

          vendorCode:
            vendor.vendorCode,

          vendorName:
            vendor.name,

          invoices:
            vendor.payables.length,

          originalAmount,

          outstandingBalance,

          overdueBalance,

          status:
            vendor.status,
        };
      })
      .filter(
        (vendor) =>
          vendor.outstandingBalance >
          0
      )
      .sort(
        (a, b) =>
          b.outstandingBalance -
          a.outstandingBalance
      );

    const totals =
      items.reduce(
        (
          result,
          vendor
        ) => {
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
        organizationId,

        vendors:
          items.length,

        currency: "KES",

        generatedAt:
          new Date()
            .toISOString(),
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