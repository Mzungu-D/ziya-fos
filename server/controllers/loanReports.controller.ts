import type { Request, Response } from "express";
import prisma from "../config/prisma";

/* =========================================================
   HELPERS
========================================================= */

const round = (value: number): number => {
  return Math.round(value * 100) / 100;
};

const percentage = (
  value: number,
  total: number
): number => {
  if (total === 0) {
    return 0;
  }

  return round((value / total) * 100);
};

/* =========================================================
   LOAN PORTFOLIO SUMMARY
========================================================= */

export const getLoanPortfolio = async (
  _req: Request,
  res: Response
) => {
  try {
    const loans = await prisma.loan.findMany({
      include: {
        customer: true,
      },
      orderBy: {
        issuedAt: "desc",
      },
    });

    const now = new Date();

    const data = loans.map((loan) => {
      const overdue =
        loan.balance > 0 &&
        loan.dueDate.getTime() < now.getTime();

      let status = "OUTSTANDING";

      if (loan.balance <= 0) {
        status = "CLOSED";
      } else if (overdue) {
        status = "OVERDUE";
      }

      return {
        loanId: loan.id,

        customer:
          `${loan.customer.firstName} ${loan.customer.lastName}`,

        phoneNumber:
          loan.customer.phoneNumber,

        originalAmount:
          round(loan.amount),

        outstandingBalance:
          round(loan.balance),

        issuedAt:
          loan.issuedAt,

        dueDate:
          loan.dueDate,

        status,
      };
    });

    const totalFinanced = loans.reduce(
      (total, loan) => total + loan.amount,
      0
    );

    const outstandingExposure = loans.reduce(
      (total, loan) => total + loan.balance,
      0
    );

    const activeLoans = loans.filter(
      (loan) => loan.balance > 0
    ).length;

    const closedLoans = loans.filter(
      (loan) => loan.balance <= 0
    ).length;

    const overdueLoans = loans.filter(
      (loan) =>
        loan.balance > 0 &&
        loan.dueDate.getTime() < now.getTime()
    ).length;

    return res.status(200).json({
      success: true,

      data,

      totals: {
        totalLoans: loans.length,
        activeLoans,
        closedLoans,
        overdueLoans,

        totalFinanced:
          round(totalFinanced),

        outstandingExposure:
          round(outstandingExposure),

        outstandingExposureRate:
          percentage(
            outstandingExposure,
            totalFinanced
          ),
      },

      meta: {
        reportType:
          "Loan Portfolio Summary",

        currency:
          "KES",

        generatedAt:
          new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "LOAN PORTFOLIO REPORT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate loan portfolio report",
    });
  }
};

/* =========================================================
   OUTSTANDING LOANS
========================================================= */

export const getOutstandingLoans = async (
  _req: Request,
  res: Response
) => {
  try {
    const loans = await prisma.loan.findMany({
      where: {
        balance: {
          gt: 0,
        },
      },

      include: {
        customer: true,
      },

      orderBy: {
        dueDate: "asc",
      },
    });

    const now = new Date();

    const data = loans.map((loan) => {
      const overdue =
        loan.dueDate.getTime() < now.getTime();

      const overdueDays = overdue
        ? Math.floor(
            (now.getTime() -
              loan.dueDate.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : 0;

      return {
        loanId:
          loan.id,

        customer:
          `${loan.customer.firstName} ${loan.customer.lastName}`,

        phoneNumber:
          loan.customer.phoneNumber,

        originalAmount:
          round(loan.amount),

        outstandingBalance:
          round(loan.balance),

        issuedAt:
          loan.issuedAt,

        dueDate:
          loan.dueDate,

        overdueDays,

        status:
          overdue
            ? "OVERDUE"
            : "OUTSTANDING",
      };
    });

    const outstandingExposure =
      loans.reduce(
        (total, loan) =>
          total + loan.balance,
        0
      );

    const overdueLoans =
      loans.filter(
        (loan) =>
          loan.dueDate.getTime() <
          now.getTime()
      );

    const overdueExposure =
      overdueLoans.reduce(
        (total, loan) =>
          total + loan.balance,
        0
      );

    const currentExposure =
      Math.max(
        outstandingExposure -
          overdueExposure,
        0
      );

    return res.status(200).json({
      success: true,

      data,

      totals: {
        outstandingLoans:
          loans.length,

        outstandingExposure:
          round(outstandingExposure),

        currentExposure:
          round(currentExposure),

        overdueLoans:
          overdueLoans.length,

        overdueExposure:
          round(overdueExposure),

        portfolioAtRisk:
          percentage(
            overdueExposure,
            outstandingExposure
          ),
      },

      meta: {
        reportType:
          "Outstanding Loans",

        currency:
          "KES",

        generatedAt:
          new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "OUTSTANDING LOANS REPORT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate outstanding loans report",
    });
  }
};

/* =========================================================
   PORTFOLIO PERFORMANCE
========================================================= */

export const getPortfolioPerformance = async (
  _req: Request,
  res: Response
) => {
  try {
    const loans =
      await prisma.loan.findMany();

    const now = new Date();

    const totalFinanced =
      loans.reduce(
        (total, loan) =>
          total + loan.amount,
        0
      );

    const outstandingExposure =
      loans.reduce(
        (total, loan) =>
          total + loan.balance,
        0
      );

    const overdueLoans =
      loans.filter(
        (loan) =>
          loan.balance > 0 &&
          loan.dueDate.getTime() <
            now.getTime()
      );

    const overdueExposure =
      overdueLoans.reduce(
        (total, loan) =>
          total + loan.balance,
        0
      );

    const performingExposure =
      Math.max(
        outstandingExposure -
          overdueExposure,
        0
      );

    const activeLoans =
      loans.filter(
        (loan) =>
          loan.balance > 0
      ).length;

    const closedLoans =
      loans.filter(
        (loan) =>
          loan.balance <= 0
      ).length;

    const portfolioAtRisk =
      percentage(
        overdueExposure,
        outstandingExposure
      );

    const performingPortfolioRate =
      percentage(
        performingExposure,
        outstandingExposure
      );

    const outstandingExposureRate =
      percentage(
        outstandingExposure,
        totalFinanced
      );

    const data = [
      {
        metric: "Total Loans",
        value: loans.length,
      },
      {
        metric: "Active Loans",
        value: activeLoans,
      },
      {
        metric: "Closed Loans",
        value: closedLoans,
      },
      {
        metric: "Overdue Loans",
        value: overdueLoans.length,
      },
      {
        metric: "Total Financed",
        value: round(totalFinanced),
        unit: "KES",
      },
      {
        metric: "Outstanding Exposure",
        value: round(outstandingExposure),
        unit: "KES",
      },
      {
        metric: "Performing Exposure",
        value: round(performingExposure),
        unit: "KES",
      },
      {
        metric: "Overdue Exposure",
        value: round(overdueExposure),
        unit: "KES",
      },
      {
        metric: "Performing Portfolio Rate",
        value: performingPortfolioRate,
        unit: "%",
      },
      {
        metric: "Portfolio At Risk",
        value: portfolioAtRisk,
        unit: "%",
      },
    ];

    return res.status(200).json({
      success: true,

      data,

      totals: {
        totalLoans:
          loans.length,

        activeLoans,

        closedLoans,

        overdueLoans:
          overdueLoans.length,

        totalFinanced:
          round(totalFinanced),

        outstandingExposure:
          round(outstandingExposure),

        performingExposure:
          round(performingExposure),

        overdueExposure:
          round(overdueExposure),

        performingPortfolioRate,

        portfolioAtRisk,

        outstandingExposureRate,
      },

      meta: {
        reportType:
          "Portfolio Performance",

        currency:
          "KES",

        generatedAt:
          new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "PORTFOLIO PERFORMANCE REPORT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate portfolio performance report",
    });
  }
};