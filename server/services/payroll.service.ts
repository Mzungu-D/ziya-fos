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

/**
 * Detailed earning information retained alongside the legacy
 * aggregate payroll fields. The existing payroll API still
 * receives `allowances` as one amount, so we do not invent
 * allowance categories that are not present in the current
 * payroll input model.
 */
export type PayrollEarningResult = {
  id: string;
  type: string;
  description: string;
  amount: number;
  recurring: boolean;
  taxable: boolean;
};

export type PayrollEarningsResult = {
  basicSalary: number;
  allowances: number;
  taxableAllowances: number;
  nonTaxableAllowances: number;
  grossSalary: number;
  items: PayrollEarningResult[];
};

export type PayrollLoanResult = {
  id: string;
  reference: string;
  description: string;
  openingBalance: number;
  repayment: number;
  closingBalance: number;
};

export type PayrollSalaryAdvanceResult = {
  id: string;
  reference: string;
  description: string;
  openingBalance: number;
  repayment: number;
  closingBalance: number;
};

export type PayrollDeductionSummary = {
  statutory: number;
  pension: number;
  helb: number;
  loans: number;
  salaryAdvances: number;
  other: number;
  total: number;
};

export type PayrollTaxSummary = {
  grossSalary: number;
  nssf: number;
  shif: number;
  housingLevy: number;
  allowablePension: number;
  taxableIncome: number;
  paye: number;
};

export type PayrollCalculation = {
  /**
   * Legacy aggregate fields retained for controller
   * compatibility.
   */
  grossSalary: number;
  taxableIncome: number;

  /**
   * Detailed payroll information for enterprise payslips.
   */
  earnings: PayrollEarningsResult;

  tax: PayrollTaxSummary;

  deductions: PayrollDeductionResult[];

  deductionSummary: PayrollDeductionSummary;

  employerContributions:
    PayrollContributionResult[];

  loans: PayrollLoanResult[];

  salaryAdvances:
    PayrollSalaryAdvanceResult[];

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

  return (
    Math.round(
      (value + Number.EPSILON) * 100
    ) / 100
  );
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

  db: PayrollDb = prisma,

  /**
   * Date used when resolving effective employee earnings.
   *
   * Existing callers may omit this value and the current date
   * will be used. Payroll controllers can pass the payroll
   * period end date when processing historical or future periods.
   */
  calculationDate: Date = new Date()
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

  const normalizedLegacyAllowance =
    normalizeMoney(
      allowance
    );

  if (
    Number.isNaN(
      calculationDate.getTime()
    )
  ) {
    throw new Error(
      "A valid payroll calculation date is required."
    );
  }

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
   * EMPLOYEE EARNINGS / COMPENSATION
   * -------------------------------------------------------
   *
   * EmployeeEarning is the source of truth for configured
   * compensation items.
   *
   * We intentionally scope the query by BOTH employeeId and
   * organizationId. This prevents an employee earning from
   * another tenant from ever entering this calculation.
   *
   * Only ACTIVE earnings effective on the calculation date
   * participate in payroll.
   *
   * The legacy `allowance` argument remains supported for
   * backward compatibility. It is used only when the employee
   * has no configured EmployeeEarning records. This prevents
   * the same allowance from being counted twice when the new
   * HR compensation workflow is in use.
   */

  const effectiveEarnings =
    await db.employeeEarning.findMany(
      {
        where: {
          employeeId,

          organizationId,

          status: "ACTIVE",

          effectiveFrom: {
            lte: calculationDate,
          },

          OR: [
            {
              effectiveTo: null,
            },
            {
              effectiveTo: {
                gte: calculationDate,
              },
            },
          ],
        },

        orderBy: [
          {
            effectiveFrom: "asc",
          },
          {
            createdAt: "asc",
          },
        ],
      }
    );

  const earningItems:
    PayrollEarningResult[] =
    effectiveEarnings.map(
      (earning) => ({
        id: earning.id,

        type: earning.type,

        description:
          earning.description?.trim() ||
          earning.type
            .replace(/_/g, " ")
            .toLowerCase()
            .replace(
              /\\b\\w/g,
              (char) =>
                char.toUpperCase()
            ),

        amount:
          normalizeMoney(
            earning.amount
          ),

        recurring:
          Boolean(
            earning.recurring
          ),

        taxable:
          Boolean(
            earning.taxable
          ),
      })
    );

  const configuredAllowances =
    roundMoney(
      earningItems.reduce(
        (
          total,
          earning
        ) =>
          total +
          earning.amount,

        0
      )
    );

  /**
   * If configured employee earnings exist, they replace the
   * old aggregate allowance input.
   *
   * If none exist, preserve the legacy payroll API behaviour.
   */
  const normalizedAllowance =
    earningItems.length > 0
      ? configuredAllowances
      : normalizedLegacyAllowance;

  const taxableConfiguredAllowances =
    roundMoney(
      earningItems
        .filter(
          (earning) =>
            earning.taxable
        )
        .reduce(
          (
            total,
            earning
          ) =>
            total +
            earning.amount,

          0
        )
    );

  const nonTaxableConfiguredAllowances =
    roundMoney(
      earningItems
        .filter(
          (earning) =>
            !earning.taxable
        )
        .reduce(
          (
            total,
            earning
          ) =>
            total +
            earning.amount,

          0
        )
    );

  /**
   * The legacy aggregate allowance predates the detailed
   * EmployeeEarning model and has no taxable flag. For
   * backward compatibility it is therefore treated as taxable.
   */
  const taxableAllowances =
    earningItems.length > 0
      ? taxableConfiguredAllowances
      : normalizedLegacyAllowance;

  const nonTaxableAllowances =
    earningItems.length > 0
      ? nonTaxableConfiguredAllowances
      : 0;

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
   * These collections are derived during the same calculation
   * so the payslip layer does not have to reconstruct loan or
   * advance movements from the current database balance.
   */
  const loans: PayrollLoanResult[] = [];

  const salaryAdvances:
    PayrollSalaryAdvanceResult[] =
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
      const normalizedRepayment =
        roundMoney(
          repayment
        );

      deductions.push({
        type:
          "SALARY_ADVANCE",

        description:
          `Salary advance repayment (${advance.reference})`,

        amount:
          normalizedRepayment,

        sourceId:
          advance.id,
      });

      salaryAdvances.push({
        id:
          advance.id,

        reference:
          advance.reference,

        description:
          advance.notes ||
          `Salary advance repayment (${advance.reference})`,

        openingBalance:
          roundMoney(
            outstandingBalance
          ),

        repayment:
          normalizedRepayment,

        closingBalance:
          roundMoney(
            Math.max(
              0,
              outstandingBalance -
                normalizedRepayment
            )
          ),
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
      const normalizedRepayment =
        roundMoney(
          repayment
        );

      deductions.push({
        type:
          "EMPLOYEE_LOAN",

        description:
          `Employee loan repayment (${employeeLoan.reference})`,

        amount:
          normalizedRepayment,

        sourceId:
          employeeLoan.id,
      });

      loans.push({
        id:
          employeeLoan.id,

        reference:
          employeeLoan.reference,

        description:
          employeeLoan.description ||
          `Employee loan repayment (${employeeLoan.reference})`,

        openingBalance:
          roundMoney(
            outstandingBalance
          ),

        repayment:
          normalizedRepayment,

        closingBalance:
          roundMoney(
            Math.max(
              0,
              outstandingBalance -
                normalizedRepayment
            )
          ),
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

  /**
   * Taxable employment income starts with basic salary plus
   * only those configured earnings marked as taxable.
   *
   * This is intentionally different from gross salary when
   * HR has configured a non-taxable earning.
   */
  const taxableEarningsBase =
    roundMoney(
      normalizedBasicSalary +
        taxableAllowances
    );

  let taxableIncome =
    taxableEarningsBase;

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

          taxableEarningsBase -
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
   * DEDUCTION SUMMARY
   * =======================================================
   *
   * Keep categorisation derived from the actual deductions
   * generated above. This prevents the payslip layer from
   * having to infer categories from descriptions.
   */

  const deductionSummary:
    PayrollDeductionSummary = {
    statutory:
      roundMoney(
        deductions
          .filter(
            (deduction) =>
              [
                "NSSF",
                "SHIF",
                "HOUSING_LEVY",
                "PAYE",
              ].includes(
                deduction.type
              )
          )
          .reduce(
            (
              total,
              deduction
            ) =>
              total +
              deduction.amount,

            0
          )
      ),

    pension:
      roundMoney(
        deductions
          .filter(
            (deduction) =>
              deduction.type ===
              "PENSION"
          )
          .reduce(
            (
              total,
              deduction
            ) =>
              total +
              deduction.amount,

            0
          )
      ),

    helb:
      roundMoney(
        deductions
          .filter(
            (deduction) =>
              deduction.type ===
              "HELB"
          )
          .reduce(
            (
              total,
              deduction
            ) =>
              total +
              deduction.amount,

            0
          )
      ),

    loans:
      roundMoney(
        deductions
          .filter(
            (deduction) =>
              deduction.type ===
              "EMPLOYEE_LOAN"
          )
          .reduce(
            (
              total,
              deduction
            ) =>
              total +
              deduction.amount,

            0
          )
      ),

    salaryAdvances:
      roundMoney(
        deductions
          .filter(
            (deduction) =>
              deduction.type ===
              "SALARY_ADVANCE"
          )
          .reduce(
            (
              total,
              deduction
            ) =>
              total +
              deduction.amount,

            0
          )
      ),

    other:
      roundMoney(
        deductions
          .filter(
            (deduction) =>
              deduction.type ===
              "OTHER"
          )
          .reduce(
            (
              total,
              deduction
            ) =>
              total +
              deduction.amount,

            0
          )
      ),

    total:
      totalDeductions,
  };

  const allowablePension =
    calculateAllowablePension(
      nssf,
      pension
    );

  const tax:
    PayrollTaxSummary = {
    grossSalary,

    nssf,

    shif,

    housingLevy,

    allowablePension,

    taxableIncome,

    paye,
  };

  /**
   * =======================================================
   * FINAL RESULT
   * =======================================================
   */

  return {
    grossSalary,

    taxableIncome,

    earnings: {
      basicSalary:
        normalizedBasicSalary,

      allowances:
        normalizedAllowance,

      taxableAllowances,

      nonTaxableAllowances,

      grossSalary,

      items:
        earningItems,
    },

    tax,

    deductions,

    deductionSummary,

    employerContributions,

    loans,

    salaryAdvances,

    totalDeductions,

    totalEmployerContributions,

    netSalary,
  };
}