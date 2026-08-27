import {
  Prisma,
  PrismaClient,
} from "@prisma/client";

import prisma from "../config/prisma";

/**
 * =========================================================
 * PAYROLL TYPES
 * =========================================================
 */

export type PayrollDeductionResult = {
  type: string;
  description: string;
  amount: number;

  /**
   * Present when the deduction originates from
   * a salary advance or employee loan.
   *
   * The controller uses this ID to update the
   * outstanding balance inside the same transaction.
   */
  sourceId?: string;
};

export type PayrollContributionResult = {
  type: string;
  description: string;
  amount: number;
};

export type PayrollCalculation = {
  grossSalary: number;
  taxableIncome: number;

  deductions: PayrollDeductionResult[];

  employerContributions:
    PayrollContributionResult[];

  totalDeductions: number;

  totalEmployerContributions: number;

  netSalary: number;
};

/**
 * =========================================================
 * DATABASE CLIENT
 * =========================================================
 *
 * Supports both:
 *
 * - normal Prisma client
 * - Prisma transaction client
 *
 * This is important because payroll processing must be
 * atomic.
 */

type PayrollDb =
  | PrismaClient
  | Prisma.TransactionClient;

/**
 * =========================================================
 * STATUTORY PAYROLL CONFIGURATION
 * =========================================================
 *
 * Keep statutory values in one place.
 *
 * When statutory rates change, we update this section
 * instead of searching through the payroll engine for
 * hard-coded numbers.
 *
 * Current configuration:
 *
 * PAYE:
 * 10%    first 24,000
 * 25%    next 8,333
 * 30%    next 467,667
 * 32.5%  next 300,000
 * 35%    above 800,000
 *
 * Personal relief:
 * 2,400 monthly
 *
 * SHIF:
 * 2.75%
 *
 * Affordable Housing Levy:
 * 1.5% employee
 * 1.5% employer
 *
 * NSSF:
 * 6% employee
 * 6% employer
 *
 * NITA:
 * KSh 50 per employee per month
 * Employer cost only.
 */

const PAYROLL_STATUTORY = {
  PAYE: {
    personalRelief: 2400,

    bands: [
      {
        upperLimit: 24000,
        rate: 0.1,
      },

      {
        upperLimit: 32333,
        rate: 0.25,
      },

      {
        upperLimit: 500000,
        rate: 0.3,
      },

      {
        upperLimit: 800000,
        rate: 0.325,
      },

      {
        upperLimit: Infinity,
        rate: 0.35,
      },
    ],
  },

  NSSF: {
    rate: 0.06,

    /**
     * Configured 2026 pensionable earnings ceiling.
     */
    upperEarningsLimit: 108000,
  },

  SHIF: {
    rate: 0.0275,
  },

  HOUSING_LEVY: {
    employeeRate: 0.015,

    employerRate: 0.015,
  },

  PENSION: {
    maximumAllowableMonthlyContribution: 30000,
  },

  NITA: {
    monthlyEmployerLevy: 50,
  },
} as const;

/**
 * =========================================================
 * MONEY HELPERS
 * =========================================================
 */

function roundMoney(
  value: number
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(
    (value + Number.EPSILON) * 100
  ) / 100;
}

function toNumber(
  value: unknown
): number {
  const result = Number(value);

  if (!Number.isFinite(result)) {
    return 0;
  }

  return result;
}

function normalizeMoney(
  value: unknown
): number {
  const amount = toNumber(value);

  if (amount < 0) {
    throw new Error(
      "Payroll amounts cannot be negative."
    );
  }

  return roundMoney(amount);
}

/**
 * =========================================================
 * PAYE
 * =========================================================
 */

function calculatePaye(
  taxableIncome: number
): number {
  let remaining =
    Math.max(
      0,
      taxableIncome
    );

  let previousLimit = 0;

  let tax = 0;

  for (
    const band of
      PAYROLL_STATUTORY.PAYE.bands
  ) {
    if (remaining <= 0) {
      break;
    }

    const bandWidth =
      band.upperLimit === Infinity
        ? remaining
        : band.upperLimit -
          previousLimit;

    const taxableAtBand =
      Math.min(
        remaining,
        bandWidth
      );

    tax +=
      taxableAtBand *
      band.rate;

    remaining -=
      taxableAtBand;

    if (
      band.upperLimit !==
      Infinity
    ) {
      previousLimit =
        band.upperLimit;
    }
  }

  /**
   * Personal relief.
   */
  tax -=
    PAYROLL_STATUTORY
      .PAYE
      .personalRelief;

  return roundMoney(
    Math.max(
      0,
      tax
    )
  );
}

/**
 * =========================================================
 * NSSF
 * =========================================================
 */

function calculateNssf(
  grossSalary: number
): number {
  const pensionableEarnings =
    Math.min(
      Math.max(
        0,
        grossSalary
      ),
      PAYROLL_STATUTORY
        .NSSF
        .upperEarningsLimit
    );

  return roundMoney(
    pensionableEarnings *
      PAYROLL_STATUTORY
        .NSSF
        .rate
  );
}

/**
 * =========================================================
 * SHIF
 * =========================================================
 */

function calculateShif(
  grossSalary: number
): number {
  return roundMoney(
    grossSalary *
      PAYROLL_STATUTORY
        .SHIF
        .rate
  );
}

/**
 * =========================================================
 * AFFORDABLE HOUSING LEVY
 * =========================================================
 */

function calculateHousingLevy(
  grossSalary: number
): number {
  return roundMoney(
    grossSalary *
      PAYROLL_STATUTORY
        .HOUSING_LEVY
        .employeeRate
  );
}

/**
 * =========================================================
 * PENSION
 * =========================================================
 */

function calculatePension(
  grossSalary: number,

  profile: {
    pensionEnabled: boolean;
    pensionAmount: unknown;
    pensionRate: unknown;
  }
): number {
  if (
    !profile.pensionEnabled
  ) {
    return 0;
  }

  /**
   * Fixed amount takes precedence.
   */
  const configuredAmount =
    toNumber(
      profile.pensionAmount
    );

  if (
    configuredAmount > 0
  ) {
    return roundMoney(
      configuredAmount
    );
  }

  /**
   * Otherwise calculate from percentage.
   */
  const rate =
    toNumber(
      profile.pensionRate
    );

  if (rate <= 0) {
    return 0;
  }

  return roundMoney(
    grossSalary *
      (rate / 100)
  );
}

/**
 * =========================================================
 * ALLOWABLE PENSION
 * =========================================================
 *
 * Maximum registered pension contribution considered
 * for PAYE purposes is KSh 30,000 per month.
 */

function calculateAllowablePension(
  nssf: number,

  otherPension: number
): number {
  const remainingAllowance =
    Math.max(
      0,

      PAYROLL_STATUTORY
        .PENSION
        .maximumAllowableMonthlyContribution -
        nssf
    );

  return roundMoney(
    Math.min(
      otherPension,
      remainingAllowance
    )
  );
}

/**
 * =========================================================
 * MAIN PAYROLL CALCULATION
 * =========================================================
 */

export async function calculateEmployeePayroll(
  employeeId: string,

  organizationId: string,

  basicSalary: number,

  allowance: number,

  db: PayrollDb = prisma
): Promise<PayrollCalculation> {
  /**
   * -------------------------------------------------------
   * VALIDATE INPUT
   * -------------------------------------------------------
   */

  if (!employeeId) {
    throw new Error(
      "Employee ID is required for payroll calculation."
    );
  }

  if (!organizationId) {
    throw new Error(
      "Organization ID is required for payroll calculation."
    );
  }

  const normalizedBasicSalary =
    normalizeMoney(
      basicSalary
    );

  const normalizedAllowance =
    normalizeMoney(
      allowance
    );

  /**
   * -------------------------------------------------------
   * EMPLOYEE PAYROLL PROFILE
   * -------------------------------------------------------
   */

  const profile =
    await db.employeePayrollProfile.findFirst(
      {
        where: {
          employeeId,

          organizationId,
        },
      }
    );

  /**
   * -------------------------------------------------------
   * GROSS SALARY
   * -------------------------------------------------------
   */

  const grossSalary =
    roundMoney(
      normalizedBasicSalary +
        normalizedAllowance
    );

  const deductions:
    PayrollDeductionResult[] =
      [];

  const employerContributions:
    PayrollContributionResult[] =
      [];

  /**
   * =======================================================
   * NSSF
   * =======================================================
   */

  let nssf = 0;

  if (
    profile?.nssfEnabled !==
    false
  ) {
    nssf =
      calculateNssf(
        grossSalary
      );

    if (nssf > 0) {
      /**
       * Employee deduction.
       */
      deductions.push({
        type:
          "NSSF",

        description:
          "Employee NSSF contribution",

        amount:
          nssf,
      });

      /**
       * Employer contribution.
       */
      employerContributions.push({
        type:
          "EMPLOYER_NSSF",

        description:
          "Employer NSSF contribution",

        amount:
          nssf,
      });
    }
  }

  /**
   * =======================================================
   * SHIF
   * =======================================================
   */

  let shif = 0;

  if (
    profile?.shaEnabled !==
    false
  ) {
    shif =
      calculateShif(
        grossSalary
      );

    if (shif > 0) {
      deductions.push({
        type:
          "SHIF",

        description:
          "Social Health Insurance Fund contribution",

        amount:
          shif,
      });
    }
  }

  /**
   * =======================================================
   * AFFORDABLE HOUSING LEVY
   * =======================================================
   */

  let housingLevy = 0;

  if (
    profile?.housingLevyEnabled !==
    false
  ) {
    housingLevy =
      calculateHousingLevy(
        grossSalary
      );

    if (housingLevy > 0) {
      /**
       * Employee portion.
       */
      deductions.push({
        type:
          "HOUSING_LEVY",

        description:
          "Employee Affordable Housing Levy",

        amount:
          housingLevy,
      });

      /**
       * Employer portion.
       */
      const employerHousingLevy =
        roundMoney(
          grossSalary *
            PAYROLL_STATUTORY
              .HOUSING_LEVY
              .employerRate
        );

      employerContributions.push({
        type:
          "EMPLOYER_HOUSING_LEVY",

        description:
          "Employer Affordable Housing Levy",

        amount:
          employerHousingLevy,
      });
    }
  }

  /**
   * =======================================================
   * PENSION
   * =======================================================
   */

  let pension = 0;

  if (
    profile?.pensionEnabled
  ) {
    pension =
      calculatePension(
        grossSalary,

        {
          pensionEnabled:
            profile.pensionEnabled,

          pensionAmount:
            profile.pensionAmount,

          pensionRate:
            profile.pensionRate,
        }
      );

    if (pension > 0) {
      deductions.push({
        type:
          "PENSION",

        description:
          "Employee pension contribution",

        amount:
          pension,
      });
    }
  }

  /**
   * =======================================================
   * HELB
   * =======================================================
   *
   * HELB is stored as a fixed configured monthly
   * deduction on the employee payroll profile.
   */

  if (
    profile?.helbEnabled &&
    toNumber(
      profile.helbAmount
    ) > 0
  ) {
    const helbAmount =
      roundMoney(
        toNumber(
          profile.helbAmount
        )
      );

    deductions.push({
      type:
        "HELB",

      description:
        "HELB monthly loan deduction",

      amount:
        helbAmount,
    });
  }

  /**
   * =======================================================
   * SALARY ADVANCES
   * =======================================================
   *
   * Process every active salary advance.
   *
   * Oldest first.
   *
   * The originating record ID is preserved in sourceId.
   *
   * IMPORTANT:
   *
   * This function DOES NOT update the balance.
   *
   * The controller does that inside the same transaction
   * that creates the payroll record.
   */

  const advances =
    await db.salaryAdvance.findMany(
      {
        where: {
          employeeId,

          organizationId,

          status:
            "ACTIVE",

          outstandingBalance: {
            gt: 0,
          },
        },

        orderBy: {
          issuedDate:
            "asc",
        },
      }
    );

  for (
    const advance of
      advances
  ) {
    const outstandingBalance =
      toNumber(
        advance.outstandingBalance
      );

    const monthlyRepayment =
      toNumber(
        advance.monthlyRepayment
      );

    /**
     * Invalid repayment configuration
     * should not create a negative or useless
     * payroll deduction.
     */
    if (
      monthlyRepayment <= 0
    ) {
      continue;
    }

    const repayment =
      Math.min(
        monthlyRepayment,

        outstandingBalance
      );

    if (
      repayment > 0
    ) {
      deductions.push({
        type:
          "SALARY_ADVANCE",

        description:
          `Salary advance repayment (${advance.reference})`,

        amount:
          roundMoney(
            repayment
          ),

        sourceId:
          advance.id,
      });
    }
  }

  /**
   * =======================================================
   * EMPLOYEE LOANS
   * =======================================================
   */

  const employeeLoans =
    await db.employeeLoan.findMany(
      {
        where: {
          employeeId,

          organizationId,

          status:
            "ACTIVE",

          outstandingBalance: {
            gt: 0,
          },
        },

        orderBy: {
          startDate:
            "asc",
        },
      }
    );

  for (
    const employeeLoan of
      employeeLoans
  ) {
    const outstandingBalance =
      toNumber(
        employeeLoan.outstandingBalance
      );

    const monthlyRepayment =
      toNumber(
        employeeLoan.monthlyRepayment
      );

    if (
      monthlyRepayment <= 0
    ) {
      continue;
    }

    const repayment =
      Math.min(
        monthlyRepayment,

        outstandingBalance
      );

    if (
      repayment > 0
    ) {
      deductions.push({
        type:
          "EMPLOYEE_LOAN",

        description:
          `Employee loan repayment (${employeeLoan.reference})`,

        amount:
          roundMoney(
            repayment
          ),

        sourceId:
          employeeLoan.id,
      });
    }
  }

  /**
   * =======================================================
   * OTHER DEDUCTION
   * =======================================================
   */

  if (
    profile &&
    toNumber(
      profile.otherDeductionAmount
    ) > 0
  ) {
    deductions.push({
      type:
        "OTHER",

      description:
        profile.otherDeductionNotes ||
        "Other payroll deduction",

      amount:
        roundMoney(
          toNumber(
            profile.otherDeductionAmount
          )
        ),
    });
  }

  /**
   * =======================================================
   * PAYE TAXABLE INCOME
   * =======================================================
   *
   * KRA currently identifies the following as deductible
   * when determining taxable employment income:
   *
   * - Affordable Housing Levy
   * - SHIF
   * - qualifying pension contribution
   *
   * NSSF is also treated here as the employee's qualifying
   * retirement contribution for the payroll calculation.
   *
   * Salary advances, HELB and employee loans remain
   * net-pay deductions and are NOT automatically removed
   * from taxable income.
   */

  let taxableIncome =
    grossSalary;

  let paye = 0;

  if (
    profile?.payeEnabled !==
    false
  ) {
    const allowablePension =
      calculateAllowablePension(
        nssf,

        pension
      );

    taxableIncome =
      roundMoney(
        Math.max(
          0,

          grossSalary -
            nssf -
            shif -
            housingLevy -
            allowablePension
        )
      );

    paye =
      calculatePaye(
        taxableIncome
      );

    if (paye > 0) {
      deductions.push({
        type:
          "PAYE",

        description:
          "Pay As You Earn",

        amount:
          paye,
      });
    }
  } else {
    taxableIncome = 0;
  }

  /**
   * =======================================================
   * NITA TRAINING LEVY
   * =======================================================
   *
   * This is an EMPLOYER cost.
   *
   * It must NEVER appear inside deductions.
   */

  employerContributions.push({
    type:
      "TRAINING_LEVY",

    description:
      "NITA Industrial Training Levy",

    amount:
      PAYROLL_STATUTORY
        .NITA
        .monthlyEmployerLevy,
  });

  /**
   * =======================================================
   * TOTAL EMPLOYEE DEDUCTIONS
   * =======================================================
   */

  const totalDeductions =
    roundMoney(
      deductions.reduce(
        (
          total,
          deduction
        ) =>
          total +
          deduction.amount,

        0
      )
    );

  /**
   * =======================================================
   * TOTAL EMPLOYER CONTRIBUTIONS
   * =======================================================
   */

  const totalEmployerContributions =
    roundMoney(
      employerContributions.reduce(
        (
          total,
          contribution
        ) =>
          total +
          contribution.amount,

        0
      )
    );

  /**
   * =======================================================
   * NET SALARY
   * =======================================================
   *
   * Payroll should never produce a negative amount payable.
   *
   * If deductions exceed gross salary, net pay becomes zero.
   *
   * The controller still updates originating advance/loan
   * balances only when the corresponding deduction was
   * successfully created inside the transaction.
   */

  const netSalary =
    roundMoney(
      Math.max(
        0,

        grossSalary -
          totalDeductions
      )
    );

  /**
   * =======================================================
   * FINAL RESULT
   * =======================================================
   */

  return {
    grossSalary,

    taxableIncome,

    deductions,

    employerContributions,

    totalDeductions,

    totalEmployerContributions,

    netSalary,
  };
}