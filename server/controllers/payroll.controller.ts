import type { Response } from "express";
import { Prisma } from "@prisma/client";

import prisma from "../config/prisma";
import type { AuthRequest } from "../middleware/auth.middleware";
import {
  calculateEmployeePayroll,
} from "../services/payroll.service";

/* =========================================================
   TYPES
   ========================================================= */

type TenantContext = {
  userId: string;
  organizationId: string;
};

type OrganizationIdentity = {
  id: string;
  name: string;
  legalName: string | null;
  registrationNumber: string | null;
  taxNumber: string | null;
  email: string | null;
  phoneNumber: string | null;
  address: string | null;
  country: string | null;
  currency: string | null;
  logoUrl: string | null;
};

type PayrollQuery = {
  page: number;
  pageSize: number;
  search: string;
  periodId: string;
};

/* =========================================================
   TENANT CONTEXT
   ========================================================= */

function getTenantContext(
  req: AuthRequest
): TenantContext | null {
  if (
    !req.user?.userId ||
    !req.user?.organizationId
  ) {
    return null;
  }

  const sessionType = (
    req.user as AuthRequest["user"] & {
      sessionType?: string;
    }
  ).sessionType;

  if (
    sessionType &&
    sessionType !== "TENANT"
  ) {
    return null;
  }

  return {
    userId: req.user.userId,
    organizationId:
      req.user.organizationId,
  };
}

/* =========================================================
   SAFE VALUES
   ========================================================= */

function stringValue(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function toNumber(
  value: unknown
): number {
  if (
    value === null ||
    value === undefined
  ) {
    return 0;
  }

  if (
    typeof value === "number"
  ) {
    return Number.isFinite(value)
      ? value
      : 0;
  }

  if (
    typeof value === "string"
  ) {
    const parsed = Number(
      value
        .replace(/,/g, "")
        .trim()
    );

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  if (
    typeof value === "object"
  ) {
    const converted = Number(value);

    return Number.isFinite(
      converted
    )
      ? converted
      : 0;
  }

  return 0;
}

function roundMoney(
  value: number
): number {
  return (
    Math.round(
      (value + Number.EPSILON) *
        100
    ) / 100
  );
}

/* =========================================================
   QUERY PARAMETERS
   ========================================================= */

function parsePositiveInteger(
  value: unknown,
  fallback: number,
  maximum?: number
): number {
  const parsed =
    typeof value === "string"
      ? Number(value)
      : Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 1
  ) {
    return fallback;
  }

  const integer =
    Math.floor(parsed);

  if (
    maximum !== undefined
  ) {
    return Math.min(
      integer,
      maximum
    );
  }

  return integer;
}

function parsePayrollQuery(
  req: AuthRequest
): PayrollQuery {
  return {
    page: parsePositiveInteger(
      req.query.page,
      1
    ),

    pageSize:
      parsePositiveInteger(
        req.query.pageSize,
        25,
        100
      ),

    search: stringValue(
      req.query.search
    ),

    periodId: stringValue(
      req.query.periodId
    ),
  };
}

/* =========================================================
   ORGANIZATION
   ========================================================= */

async function getOrganization(
  organizationId: string
): Promise<OrganizationIdentity | null> {
  const organization =
    await prisma.organization.findUnique(
      {
        where: {
          id: organizationId,
        },

        select: {
          id: true,
          name: true,
          legalName: true,
          registrationNumber: true,
          taxNumber: true,
          email: true,
          phoneNumber: true,
          address: true,
          country: true,
          currency: true,
          logoUrl: true,
        },
      }
    );

  return organization;
}

/* =========================================================
   SERIALIZATION
   ========================================================= */

function serializeDeduction(
  deduction: any
) {
  return {
    id: deduction.id,
    type: deduction.type,
    description:
      deduction.description,
    amount: roundMoney(
      toNumber(
        deduction.amount
      )
    ),
    createdAt:
      deduction.createdAt,
  };
}

function serializePayrollEarning(
  earning: any
) {
  return {
    id: earning.id,
    type: earning.type,
    description: earning.description ?? null,
    amount: roundMoney(toNumber(earning.amount)),
    recurring: Boolean(earning.recurring),
    taxable: Boolean(earning.taxable),
    effectiveFrom: earning.effectiveFrom ?? null,
    createdAt: earning.createdAt,
  };
}

function serializeEmployerContribution(
  contribution: any
) {
  return {
    id: contribution.id,
    type: contribution.type,
    description:
      contribution.description,
    amount: roundMoney(
      toNumber(
        contribution.amount
      )
    ),
    createdAt:
      contribution.createdAt,
  };
}

function serializeEmployee(
  employee: any
) {
  if (!employee) {
    return null;
  }

  return {
    id: employee.id,

    employeeNumber:
      employee.employeeNumber,

    firstName:
      employee.firstName,

    lastName:
      employee.lastName,

    name:
      `${employee.firstName ?? ""} ${
        employee.lastName ?? ""
      }`.trim(),

    fullName:
      `${employee.firstName ?? ""} ${
        employee.lastName ?? ""
      }`.trim(),

    email:
      employee.email ?? null,

    phoneNumber:
      employee.phoneNumber ??
      null,

    department:
      employee.department ??
      null,

    jobTitle:
      employee.jobTitle ??
      null,

    employmentType:
      employee.employmentType ??
      null,

    hireDate:
      employee.hireDate ??
      null,

    kraPin:
      employee.kraPin ??
      null,

    nssfNumber:
      employee.nssfNumber ??
      null,

    shaNumber:
      employee.shaNumber ??
      null,
  };
}

function serializeRecord(
  record: any
) {
  return {
    id: record.id,

    payrollPeriodId:
      record.payrollPeriodId,

    employeeId:
      record.employeeId,

    employee:
      serializeEmployee(
        record.employee
      ),

    basicSalary:
      roundMoney(
        toNumber(
          record.basicSalary
        )
      ),

    allowances:
      roundMoney(
        toNumber(
          record.allowances
        )
      ),

    grossSalary:
      roundMoney(
        toNumber(
          record.grossSalary
        )
      ),

    deductions:
      roundMoney(
        toNumber(
          record.deductions
        )
      ),

    netSalary:
      roundMoney(
        toNumber(
          record.netSalary
        )
      ),

    status:
      record.status,

    processedAt:
      record.processedAt,

    deductionsBreakdown:
      Array.isArray(
        record.payrollDeductions
      )
        ? record.payrollDeductions.map(
            serializeDeduction
          )
        : [],

    employerContributions:
      Array.isArray(
        record.employerContributions
      )
        ? record.employerContributions.map(
            serializeEmployerContribution
          )
        : [],

    payrollEarnings:
      Array.isArray(record.payrollEarnings)
        ? record.payrollEarnings.map(
            serializePayrollEarning
          )
        : [],

    createdAt:
      record.createdAt,

    updatedAt:
      record.updatedAt,
  };
}

function serializePeriod(
  period: any
) {
  return {
    id: period.id,

    name: period.name,

    periodStart:
      period.periodStart,

    periodEnd:
      period.periodEnd,

    status:
      period.status,

    totalGross:
      roundMoney(
        toNumber(
          period.totalGross
        )
      ),

    totalDeductions:
      roundMoney(
        toNumber(
          period.totalDeductions
        )
      ),

    totalNet:
      roundMoney(
        toNumber(
          period.totalNet
        )
      ),

    processedAt:
      period.processedAt,

    approvedAt:
      period.approvedAt,

    approvedBy:
      period.approvedBy,

    paidAt:
      period.paidAt,

    createdAt:
      period.createdAt,

    updatedAt:
      period.updatedAt,

    payrollRecords:
      Array.isArray(
        period.payrollRecords
      )
        ? period.payrollRecords.map(
            serializeRecord
          )
        : [],
  };
}

/* =========================================================
   GET PAYROLL
   ========================================================= */

export const getPayroll = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const context =
      getTenantContext(req);

    if (!context) {
      return res.status(403).json({
        success: false,
        code:
          "TENANT_SESSION_REQUIRED",
        message:
          "A tenant session is required.",
      });
    }

    const {
      page,
      pageSize,
      search,
      periodId,
    } = parsePayrollQuery(req);

    const organization =
      await getOrganization(
        context.organizationId
      );

    if (!organization) {
      return res.status(404).json({
        success: false,
        code:
          "ORGANIZATION_NOT_FOUND",
        message:
          "The organization associated with this payroll session was not found.",
      });
    }

    /*
     * Only payroll periods are loaded here.
     *
     * Payroll records are deliberately NOT loaded
     * for every period. The selected period's records
     * are fetched below using database pagination.
     */
    const periods =
      await prisma.payrollPeriod.findMany(
        {
          where: {
            organizationId:
              context.organizationId,
          },

          orderBy: {
            periodStart: "desc",
          },
        }
      );

    const selectedPeriod =
      periodId
        ? periods.find(
            (period) =>
              period.id ===
              periodId
          ) ?? null
        : periods[0] ?? null;

    if (
      periodId &&
      !selectedPeriod
    ) {
      return res.status(404).json({
        success: false,
        code:
          "PAYROLL_PERIOD_NOT_FOUND",
        message:
          "The requested payroll period was not found.",
      });
    }

    /*
     * Summary is based on the whole selected
     * payroll period, never on the current page.
     */
    let summary = {
      employees: 0,
      grossPayroll: 0,
      deductions: 0,
      netPayroll: 0,
    };

    if (selectedPeriod) {
      summary = {
        employees:
          await prisma.payrollRecord.count(
            {
              where: {
                organizationId:
                  context.organizationId,

                payrollPeriodId:
                  selectedPeriod.id,
              },
            }
          ),

        grossPayroll:
          roundMoney(
            toNumber(
              selectedPeriod.totalGross
            )
          ),

        deductions:
          roundMoney(
            toNumber(
              selectedPeriod.totalDeductions
            )
          ),

        netPayroll:
          roundMoney(
            toNumber(
              selectedPeriod.totalNet
            )
          ),
      };
    } else {
      summary.employees =
        await prisma.employee.count({
          where: {
            organizationId:
              context.organizationId,

            status: "ACTIVE",
          },
        });
    }

    /*
     * Typed Prisma filter.
     *
     * This prevents Prisma's `mode` field from
     * being inferred as a generic string.
     */
    const employeeFilter: Prisma.PayrollRecordWhereInput =
      search
        ? {
            employee: {
              OR: [
                {
                  firstName: {
                    contains: search,
                    mode: "insensitive",
                  },
                },

                {
                  lastName: {
                    contains: search,
                    mode: "insensitive",
                  },
                },

                {
                  employeeNumber: {
                    contains: search,
                    mode: "insensitive",
                  },
                },

                {
                  department: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              ],
            },
          }
        : {};

    let totalRecords = 0;

    let payrollRecords: any[] =
      [];

    let effectivePage = page;

    if (selectedPeriod) {
      const where: Prisma.PayrollRecordWhereInput =
        {
          organizationId:
            context.organizationId,

          payrollPeriodId:
            selectedPeriod.id,

          ...employeeFilter,
        };

      /*
       * Count first so that an invalid page such
       * as page 99 can be safely clamped.
       */
      totalRecords =
        await prisma.payrollRecord.count(
          {
            where,
          }
        );

      const totalPages =
        totalRecords === 0
          ? 0
          : Math.ceil(
              totalRecords /
                pageSize
            );

      if (
        totalPages > 0 &&
        effectivePage >
          totalPages
      ) {
        effectivePage =
          totalPages;
      }

      /*
       * If there are no records, do not query
       * the database with an unnecessary page.
       */
      if (totalRecords > 0) {
        payrollRecords =
          await prisma.payrollRecord.findMany(
            {
              where,

              include: {
                employee: true,

                payrollDeductions:
                  true,

                employerContributions:
                  true,

                payrollEarnings:
                  true,
              },

              orderBy: [
                {
                  employee: {
                    firstName:
                      "asc",
                  },
                },

                {
                  employee: {
                    lastName:
                      "asc",
                  },
                },

                {
                  id: "asc",
                },
              ],

              skip:
                (effectivePage -
                  1) *
                pageSize,

              take: pageSize,
            }
          );
      }
    }

    const totalPages =
      totalRecords === 0
        ? 0
        : Math.ceil(
            totalRecords /
              pageSize
          );

    const serializedPeriods =
      periods.map(
        (period) => {
          if (
            !selectedPeriod ||
            period.id !==
              selectedPeriod.id
          ) {
            return serializePeriod(
              period
            );
          }

          return serializePeriod({
            ...period,

            /*
             * Only the current page is attached
             * to the selected period.
             */
            payrollRecords,
          });
        }
      );

    return res.status(200).json({
      success: true,

      organization,

      summary,

      periods:
        serializedPeriods,

      pagination: {
        page:
          totalRecords === 0
            ? 1
            : effectivePage,

        pageSize,

        totalRecords,

        totalPages,
      },
    });
  } catch (error) {
    console.error(
      "[PAYROLL] Failed to fetch payroll:",
      error
    );

    return res.status(500).json({
      success: false,
      code:
        "PAYROLL_FETCH_FAILED",
      message:
        "Failed to fetch payroll.",
    });
  }
};

/* =========================================================
   GET PAYROLL PERIOD
   ========================================================= */

export const getPayrollPeriod =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const context =
        getTenantContext(req);

      if (!context) {
        return res.status(403).json({
          success: false,
          code:
            "TENANT_SESSION_REQUIRED",
          message:
            "A tenant session is required.",
        });
      }

      const id =
        stringValue(
          req.params.id
        );

      if (!id) {
        return res.status(400).json({
          success: false,
          code:
            "PAYROLL_PERIOD_ID_REQUIRED",
          message:
            "Payroll period ID is required.",
        });
      }

      const period =
        await prisma.payrollPeriod.findFirst(
          {
            where: {
              id,

              organizationId:
                context.organizationId,
            },

            include: {
              payrollRecords: {
                include: {
                  employee: true,

                  payrollDeductions:
                    true,

                  employerContributions:
                    true,

                  payrollEarnings:
                    true,
                },

                orderBy: [
                  {
                    employee: {
                      firstName:
                        "asc",
                    },
                  },

                  {
                    employee: {
                      lastName:
                        "asc",
                    },
                  },
                ],
              },
            },
          }
        );

      if (!period) {
        return res.status(404).json({
          success: false,
          code:
            "PAYROLL_PERIOD_NOT_FOUND",
          message:
            "Payroll period was not found.",
        });
      }

      return res.status(200).json({
        success: true,

        period:
          serializePeriod(
            period
          ),
      });
    } catch (error) {
      console.error(
        "[PAYROLL] Failed to fetch payroll period:",
        error
      );

      return res.status(500).json({
        success: false,
        code:
          "PAYROLL_PERIOD_FETCH_FAILED",
        message:
          "Failed to fetch payroll period.",
      });
    }
  };

/* =========================================================
   GET PAYSLIP
   ========================================================= */

export const getPayslip =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const context =
        getTenantContext(req);

      if (!context) {
        return res.status(403).json({
          success: false,
          code:
            "TENANT_SESSION_REQUIRED",
          message:
            "A tenant session is required.",
        });
      }

      const id =
        stringValue(
          req.params.id
        );

      if (!id) {
        return res.status(400).json({
          success: false,
          code:
            "PAYROLL_RECORD_ID_REQUIRED",
          message:
            "Payroll record ID is required.",
        });
      }

      /*
       * Organization is resolved from the authenticated
       * tenant, never from the request.
       */
      const organization =
        await getOrganization(
          context.organizationId
        );

      if (!organization) {
        return res.status(404).json({
          success: false,
          code:
            "ORGANIZATION_NOT_FOUND",
          message:
            "The organization associated with this payslip was not found.",
        });
      }

      const record =
        await prisma.payrollRecord.findFirst(
          {
            where: {
              id,

              organizationId:
                context.organizationId,
            },

            include: {
              employee: true,

              payrollPeriod:
                true,

              payrollDeductions: {
                orderBy: {
                  createdAt:
                    "asc",
                },
              },

              employerContributions: {
                orderBy: {
                  createdAt:
                    "asc",
                },
              },

              payrollEarnings: {
                orderBy: [
                  {
                    effectiveFrom: "asc",
                  },
                  {
                    createdAt: "asc",
                  },
                ],
              },
            },
          }
        );

      if (!record) {
        return res.status(404).json({
          success: false,
          code:
            "PAYSLIP_NOT_FOUND",
          message:
            "The requested payslip was not found.",
        });
      }

      /*
       * Payslips are only available after payroll
       * has been successfully processed.
       */
      if (
        record.status !==
        "PROCESSED"
      ) {
        return res.status(409).json({
          success: false,
          code:
            "PAYSLIP_NOT_READY",
          message:
            "The payslip is not available until payroll has been processed.",
        });
      }

      if (
        !record.employee ||
        !record.payrollPeriod
      ) {
        return res.status(500).json({
          success: false,
          code:
            "PAYSLIP_DATA_INCOMPLETE",
          message:
            "The payroll record is missing required employee or payroll period information.",
        });
      }

      const employee =
        record.employee;

      const period =
        record.payrollPeriod;

      const deductions =
        record.payrollDeductions.map(
          serializeDeduction
        );

      const employerContributions =
        record.employerContributions.map(
          serializeEmployerContribution
        );

      const totalEmployerContributions =
        roundMoney(
          employerContributions.reduce(
            (
              total,
              contribution
            ) =>
              total +
              toNumber(
                contribution.amount
              ),
            0
          )
        );

      /*
       * Current employee loan balances.
       *
       * These are read from the tenant-scoped HR records so the
       * payslip can show the balance that exists after the payroll
       * run. Historical payroll snapshots remain in PayrollEarning
       * and PayrollDeduction.
       */
      const activeLoans =
        await prisma.employeeLoan.findMany({
          where: {
            organizationId:
              context.organizationId,
            employeeId:
              employee.id,
          },
          select: {
            id: true,
            reference: true,
            description: true,
            outstandingBalance: true,
            monthlyRepayment: true,
            status: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        });

      const activeSalaryAdvances =
        await prisma.salaryAdvance.findMany({
          where: {
            organizationId:
              context.organizationId,
            employeeId:
              employee.id,
            status: "ACTIVE",
          },
          select: {
            id: true,
            reference: true,
            notes: true,
            outstandingBalance: true,
            monthlyRepayment: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        });

      const loanRepaymentDeductions = deductions.filter(
        (deduction: any) =>
          deduction.type === "EMPLOYEE_LOAN"
      );

      const salaryAdvanceRepaymentDeductions = deductions.filter(
        (deduction: any) =>
          deduction.type === "SALARY_ADVANCE"
      );

      const loanRepaymentFor = (reference: string) =>
        roundMoney(
          loanRepaymentDeductions
            .filter((deduction: any) =>
              String(deduction.description ?? "").includes(reference)
            )
            .reduce(
              (total: number, deduction: any) =>
                total + toNumber(deduction.amount),
              0
            )
        );

      const salaryAdvanceRepaymentFor = (reference: string) =>
        roundMoney(
          salaryAdvanceRepaymentDeductions
            .filter((deduction: any) =>
              String(deduction.description ?? "").includes(reference)
            )
            .reduce(
              (total: number, deduction: any) =>
                total + toNumber(deduction.amount),
              0
            )
        );

      const loanDetails = activeLoans
        .map((loan) => {
          const closingBalance = roundMoney(toNumber(loan.outstandingBalance));
          const repayment = loanRepaymentFor(loan.reference);
          return {
            id: loan.id,
            reference: loan.reference,
            description: loan.description ?? null,
            openingBalance: roundMoney(closingBalance + repayment),
            repayment,
            closingBalance,
            monthlyRepayment: roundMoney(toNumber(loan.monthlyRepayment)),
          };
        })
        .filter((loan) => loan.repayment > 0 || loan.closingBalance > 0);

      const salaryAdvanceDetails = activeSalaryAdvances
        .map((advance) => {
          const closingBalance = roundMoney(toNumber(advance.outstandingBalance));
          const repayment = salaryAdvanceRepaymentFor(advance.reference);
          return {
            id: advance.id,
            reference: advance.reference,
            description: advance.notes ?? null,
            openingBalance: roundMoney(closingBalance + repayment),
            repayment,
            closingBalance,
            monthlyRepayment: roundMoney(toNumber(advance.monthlyRepayment)),
          };
        })
        .filter((advance) => advance.repayment > 0 || advance.closingBalance > 0);


      /*
       * Year-to-date totals are calculated from processed payroll
       * records for this employee and tenant, from 1 January of
       * the payroll period year through the current payroll period.
       */
      const periodEndDate =
        new Date(period.periodEnd);

      const ytdStartDate =
        new Date(
          periodEndDate.getUTCFullYear(),
          0,
          1
        );

      const ytdRecords =
        await prisma.payrollRecord.findMany({
          where: {
            organizationId:
              context.organizationId,
            employeeId:
              employee.id,
            status: "PROCESSED",
            payrollPeriod: {
              periodEnd: {
                gte: ytdStartDate,
                lte: period.periodEnd,
              },
            },
          },
          select: {
            basicSalary: true,
            grossSalary: true,
            deductions: true,
            netSalary: true,
          },
        });

      const ytd =
        ytdRecords.reduce(
          (
            totals,
            payrollRecord
          ) => ({
            basicSalary:
              totals.basicSalary +
              toNumber(
                payrollRecord.basicSalary
              ),
            grossSalary:
              totals.grossSalary +
              toNumber(
                payrollRecord.grossSalary
              ),
            deductions:
              totals.deductions +
              toNumber(
                payrollRecord.deductions
              ),
            netSalary:
              totals.netSalary +
              toNumber(
                payrollRecord.netSalary
              ),
          }),
          {
            basicSalary: 0,
            grossSalary: 0,
            deductions: 0,
            netSalary: 0,
          }
        );

      const loanBalance =
        roundMoney(
          activeLoans.reduce(
            (
              total,
              loan
            ) =>
              total +
              toNumber(
                loan.outstandingBalance
              ),
            0
          )
        );

      const salaryAdvanceBalance =
        roundMoney(
          activeSalaryAdvances.reduce(
            (
              total,
              advance
            ) =>
              total +
              toNumber(
                advance.outstandingBalance
              ),
            0
          )
        );

      return res.status(200).json({
        success: true,

        payslip: {
          id: record.id,

          /*
           * Full employer identity.
           * This is what allows the payslip to represent
           * the tenant company rather than Ziya.
           */
          organization,

          employer: {
            organizationId:
              context.organizationId,

            name:
              organization.name,

            legalName:
              organization.legalName,

            registrationNumber:
              organization.registrationNumber,

            taxNumber:
              organization.taxNumber,

            email:
              organization.email,

            phoneNumber:
              organization.phoneNumber,

            address:
              organization.address,

            country:
              organization.country,

            currency:
              organization.currency,

            logoUrl:
              organization.logoUrl,
          },

          employee: {
            id:
              employee.id,

            employeeNumber:
              employee.employeeNumber,

            firstName:
              employee.firstName,

            lastName:
              employee.lastName,

            fullName:
              `${employee.firstName ?? ""} ${
                employee.lastName ?? ""
              }`.trim(),

            email:
              employee.email ??
              null,

            phoneNumber:
              employee.phoneNumber ??
              null,

            department:
              employee.department ??
              null,

            jobTitle:
              employee.jobTitle ??
              null,

            employmentType:
              employee.employmentType ??
              null,

            hireDate:
              employee.hireDate ??
              null,

            /*
             * Statutory employee information.
             * These are useful on the formal payslip.
             */
            kraPin:
              employee.kraPin ??
              null,

            nssfNumber:
              employee.nssfNumber ??
              null,

            shaNumber:
              employee.shaNumber ??
              null,

            paymentMethod:
              employee.paymentMethod ??
              null,

            bankName:
              employee.bankName ??
              null,

            bankBranch:
              employee.bankBranch ??
              null,

            bankAccountName:
              employee.bankAccountName ??
              null,

            bankAccountNumber:
              employee.bankAccountNumber ??
              null,

            mobileMoneyNumber:
              employee.mobileMoneyNumber ??
              null,
          },

          payrollPeriod: {
            id:
              period.id,

            name:
              period.name,

            periodStart:
              period.periodStart,

            periodEnd:
              period.periodEnd,

            status:
              period.status,

            processedAt:
              period.processedAt,
          },

          earnings: {
            basicSalary:
              roundMoney(
                toNumber(
                  record.basicSalary
                )
              ),

            allowances:
              roundMoney(
                toNumber(
                  record.allowances
                )
              ),

            taxableAllowances:
              Array.isArray(record.payrollEarnings)
                ? roundMoney(
                    record.payrollEarnings
                      .filter((earning: any) => Boolean(earning.taxable))
                      .reduce(
                        (total: number, earning: any) =>
                          total + toNumber(earning.amount),
                        0
                      )
                  )
                : roundMoney(toNumber(record.allowances)),

            nonTaxableAllowances:
              Array.isArray(record.payrollEarnings)
                ? roundMoney(
                    record.payrollEarnings
                      .filter((earning: any) => !Boolean(earning.taxable))
                      .reduce(
                        (total: number, earning: any) =>
                          total + toNumber(earning.amount),
                        0
                      )
                  )
                : 0,

            items: Array.isArray(record.payrollEarnings)
              ? record.payrollEarnings.map(serializePayrollEarning)
              : [],

            grossSalary:
              roundMoney(
                toNumber(
                  record.grossSalary
                )
              ),
          },

          deductions,

          totals: {
            grossSalary:
              roundMoney(
                toNumber(
                  record.grossSalary
                )
              ),

            totalDeductions:
              roundMoney(
                toNumber(
                  record.deductions
                )
              ),

            netSalary:
              roundMoney(
                toNumber(
                  record.netSalary
                )
              ),

            totalEmployerContributions,
          },

          employerContributions,

          loanBalances: {
            totalOutstanding:
              loanBalance,
            totalMonthlyRepayment:
              roundMoney(
                activeLoans.reduce(
                  (
                    total,
                    loan
                  ) =>
                    total +
                    toNumber(
                      loan.monthlyRepayment
                    ),
                  0
                )
              ),
            loans: loanDetails,
          },

          salaryAdvanceBalances: {
            totalOutstanding:
              salaryAdvanceBalance,
            totalMonthlyRepayment:
              roundMoney(
                activeSalaryAdvances.reduce(
                  (
                    total,
                    advance
                  ) =>
                    total +
                    toNumber(
                      advance.monthlyRepayment
                    ),
                  0
                )
              ),
            advances: salaryAdvanceDetails,
          },

          ytd: {
            basicSalary:
              roundMoney(
                ytd.basicSalary
              ),
            grossSalary:
              roundMoney(
                ytd.grossSalary
              ),
            totalDeductions:
              roundMoney(
                ytd.deductions
              ),
            netSalary:
              roundMoney(
                ytd.netSalary
              ),
          },

          status:
            record.status,

          processedAt:
            record.processedAt,
        },
      });
    } catch (error) {
      console.error(
        "[PAYROLL] Failed to fetch payslip:",
        error
      );

      return res.status(500).json({
        success: false,
        code:
          "PAYSLIP_FETCH_FAILED",
        message:
          "Failed to fetch payslip.",
      });
    }
  };

/* =========================================================
   RUN PAYROLL
   ========================================================= */

export const runPayroll =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const context =
        getTenantContext(req);

      if (!context) {
        return res.status(403).json({
          success: false,
          code:
            "TENANT_SESSION_REQUIRED",
          message:
            "A tenant session is required.",
        });
      }

      const name =
        stringValue(
          req.body?.name
        );

      if (!name) {
        return res.status(400).json({
          success: false,
          code:
            "PAYROLL_NAME_REQUIRED",
          message:
            "Payroll period name is required.",
        });
      }

      const periodStartValue =
        stringValue(
          req.body?.periodStart
        );

      const periodEndValue =
        stringValue(
          req.body?.periodEnd
        );

      if (
        !periodStartValue ||
        !periodEndValue
      ) {
        return res.status(400).json({
          success: false,
          code:
            "PAYROLL_DATES_REQUIRED",
          message:
            "Payroll period start and end dates are required.",
        });
      }

      const periodStart =
        new Date(
          periodStartValue
        );

      const periodEnd =
        new Date(
          periodEndValue
        );

      if (
        Number.isNaN(
          periodStart.getTime()
        ) ||
        Number.isNaN(
          periodEnd.getTime()
        )
      ) {
        return res.status(400).json({
          success: false,
          code:
            "INVALID_PAYROLL_DATES",
          message:
            "Valid payroll period dates are required.",
        });
      }

      if (
        periodEnd <
        periodStart
      ) {
        return res.status(400).json({
          success: false,
          code:
            "INVALID_PAYROLL_PERIOD",
          message:
            "Payroll end date cannot be before the start date.",
        });
      }

      /*
       * The frontend may provide employee-specific
       * allowances as:
       *
       * {
       *   employeeId: amount
       * }
       */
      const allowances =
        req.body?.allowances ??
        {};

      if (
        typeof allowances !==
          "object" ||
        Array.isArray(
          allowances
        ) ||
        allowances === null
      ) {
        return res.status(400).json({
          success: false,
          code:
            "INVALID_ALLOWANCES",
          message:
            "Allowances must be supplied as an object.",
        });
      }

      /*
       * Only active employees belonging to the
       * authenticated organization can be processed.
       */
      const employees =
        await prisma.employee.findMany(
          {
            where: {
              organizationId:
                context.organizationId,

              status: "ACTIVE",
            },

            orderBy: [
              {
                firstName: "asc",
              },

              {
                lastName: "asc",
              },
            ],
          }
        );

      if (
        employees.length ===
        0
      ) {
        return res.status(400).json({
          success: false,
          code:
            "NO_ACTIVE_EMPLOYEES",
          message:
            "There are no active employees to process.",
        });
      }

      /*
       * Prevent duplicate payroll periods.
       */
      const existing =
        await prisma.payrollPeriod.findFirst(
          {
            where: {
              organizationId:
                context.organizationId,

              periodStart,

              periodEnd,
            },
          }
        );

      if (existing) {
        return res.status(409).json({
          success: false,
          code:
            "PAYROLL_PERIOD_EXISTS",
          message:
            "A payroll period for these dates already exists.",
        });
      }

      /*
       * =====================================================
       * ATOMIC PAYROLL TRANSACTION
       * =====================================================
       *
       * The calculation engine is intentionally preserved.
       * This controller is responsible for orchestration,
       * tenant isolation and persistence.
       */
      const result =
        await prisma.$transaction(
          async (tx) => {
            let totalGross = 0;

            let totalDeductions =
              0;

            let totalNet = 0;

            const processedAt =
              new Date();

            const period =
              await tx.payrollPeriod.create(
                {
                  data: {
                    organizationId:
                      context.organizationId,

                    name,

                    periodStart,

                    periodEnd,

                    status:
                      "PROCESSED",

                    processedAt,
                  },
                }
              );

            for (
              const employee of
                employees
            ) {
              const basicSalary =
                Math.max(
                  0,
                  toNumber(
                    employee.basicSalary
                  )
                );

              const employeeAllowances =
                Math.max(
                  0,
                  toNumber(
                    (
                      allowances as Record<
                        string,
                        unknown
                      >
                    )[
                      employee.id
                    ]
                  )
                );

              /*
               * Central payroll engine.
               *
               * This is deliberately not duplicated
               * in the controller.
               */
              const calculation =
                await calculateEmployeePayroll(
                  employee.id,

                  context.organizationId,

                  basicSalary,

                  employeeAllowances,

                  tx,

                  periodEnd
                );

              const grossSalary =
                roundMoney(
                  toNumber(
                    calculation.grossSalary
                  )
                );

              const deductionTotal =
                roundMoney(
                  toNumber(
                    calculation.totalDeductions
                  )
                );

              const netSalary =
                roundMoney(
                  toNumber(
                    calculation.netSalary
                  )
                );

              const payrollRecord =
                await tx.payrollRecord.create(
                  {
                    data: {
                      organizationId:
                        context.organizationId,

                      payrollPeriodId:
                        period.id,

                      employeeId:
                        employee.id,

                      basicSalary,

                      /*
                       * Persist the allowance total produced by the
                       * central payroll engine. When EmployeeEarning
                       * records exist, this is the configured earning
                       * total for the payroll period rather than the
                       * legacy request payload.
                       */
                      allowances:
                        roundMoney(
                          toNumber(
                            calculation.earnings?.allowances
                          )
                        ),

                      grossSalary,

                      deductions:
                        deductionTotal,

                      netSalary,

                      status:
                        "PROCESSED",

                      processedAt,
                    },
                  }
                );

              /*
               * Snapshot the configured earnings used for this payroll run.
               * These rows are historical payroll facts and must never depend
               * on later changes to the employee's earning configuration.
               */
              for (
                const earning of
                  calculation.earnings?.items ?? []
              ) {
                const amount =
                  roundMoney(toNumber(earning.amount));

                if (amount <= 0) {
                  continue;
                }

                await tx.payrollEarning.create({
                  data: {
                    payrollRecordId: payrollRecord.id,
                    organizationId: context.organizationId,
                    sourceEarningId: earning.id || null,
                    type: earning.type,
                    description: earning.description || null,
                    amount,
                    recurring: Boolean(earning.recurring),
                    taxable: Boolean(earning.taxable),
                    effectiveFrom: periodEnd,
                  },
                });
              }

              /*
               * Employee deductions.
               */
              for (
                const deduction of
                  calculation.deductions
              ) {
                const amount =
                  roundMoney(
                    toNumber(
                      deduction.amount
                    )
                  );

                if (
                  amount <= 0
                ) {
                  continue;
                }

                await tx.payrollDeduction.create(
                  {
                    data: {
                      payrollRecordId:
                        payrollRecord.id,

                      organizationId:
                        context.organizationId,

                      type:
                        deduction.type,

                      description:
                        deduction.description,

                      amount,
                    },
                  }
                );

                /*
                 * Salary advance balance.
                 */
                if (
                  deduction.type ===
                    "SALARY_ADVANCE" &&
                  deduction.sourceId
                ) {
                  const updated =
                    await tx.salaryAdvance.updateMany(
                      {
                        where: {
                          id:
                            deduction.sourceId,

                          organizationId:
                            context.organizationId,

                          employeeId:
                            employee.id,

                          status:
                            "ACTIVE",

                          outstandingBalance:
                            {
                              gte:
                                amount,
                            },
                        },

                        data: {
                          outstandingBalance:
                            {
                              decrement:
                                amount,
                            },
                        },
                      }
                    );

                  if (
                    updated.count !==
                    1
                  ) {
                    throw new Error(
                      `Unable to update salary advance balance for employee ${employee.employeeNumber}.`
                    );
                  }

                  /*
                   * Close the advance when fully repaid.
                   */
                  await tx.salaryAdvance.updateMany(
                    {
                      where: {
                        id:
                          deduction.sourceId,

                        organizationId:
                          context.organizationId,

                        employeeId:
                          employee.id,

                        status:
                          "ACTIVE",

                        outstandingBalance:
                          0,
                      },

                      data: {
                        status:
                          "COMPLETED",
                      },
                    }
                  );
                }

                /*
                 * Employee loan balance.
                 */
                if (
                  deduction.type ===
                    "EMPLOYEE_LOAN" &&
                  deduction.sourceId
                ) {
                  const updated =
                    await tx.employeeLoan.updateMany(
                      {
                        where: {
                          id:
                            deduction.sourceId,

                          organizationId:
                            context.organizationId,

                          employeeId:
                            employee.id,

                          status:
                            "ACTIVE",

                          outstandingBalance:
                            {
                              gte:
                                amount,
                            },
                        },

                        data: {
                          outstandingBalance:
                            {
                              decrement:
                                amount,
                            },
                        },
                      }
                    );

                  if (
                    updated.count !==
                    1
                  ) {
                    throw new Error(
                      `Unable to update employee loan balance for employee ${employee.employeeNumber}.`
                    );
                  }

                  /*
                   * Close the loan when fully repaid.
                   */
                  await tx.employeeLoan.updateMany(
                    {
                      where: {
                        id:
                          deduction.sourceId,

                        organizationId:
                          context.organizationId,

                        employeeId:
                          employee.id,

                        status:
                          "ACTIVE",

                        outstandingBalance:
                          0,
                      },

                      data: {
                        status:
                          "COMPLETED",
                      },
                    }
                  );
                }
              }

              /*
               * Employer contributions.
               *
               * These are NOT employee deductions.
               */
              for (
                const contribution of
                  calculation.employerContributions
              ) {
                const amount =
                  roundMoney(
                    toNumber(
                      contribution.amount
                    )
                  );

                if (
                  amount <= 0
                ) {
                  continue;
                }

                await tx.payrollEmployerContribution.create(
                  {
                    data: {
                      payrollRecordId:
                        payrollRecord.id,

                      organizationId:
                        context.organizationId,

                      type:
                        contribution.type,

                      description:
                        contribution.description,

                      amount,
                    },
                  }
                );
              }

              totalGross +=
                grossSalary;

              totalDeductions +=
                deductionTotal;

              totalNet +=
                netSalary;
            }

            /*
             * Save period totals using the final
             * rounded values.
             */
            return tx.payrollPeriod.update(
              {
                where: {
                  id: period.id,
                },

                data: {
                  totalGross:
                    roundMoney(
                      totalGross
                    ),

                  totalDeductions:
                    roundMoney(
                      totalDeductions
                    ),

                  totalNet:
                    roundMoney(
                      totalNet
                    ),
                },

                include: {
                  payrollRecords: {
                    include: {
                      employee:
                        true,

                      payrollDeductions:
                        true,

                      employerContributions:
                        true,

                      payrollEarnings:
                        true,
                    },

                    orderBy: [
                      {
                        employee: {
                          firstName:
                            "asc",
                        },
                      },

                      {
                        employee: {
                          lastName:
                            "asc",
                        },
                      },
                    ],
                  },
                },
              }
            );
          },

          {
            isolationLevel:
              Prisma.TransactionIsolationLevel.Serializable,
          }
        );

      return res.status(201).json({
        success: true,

        message:
          "Payroll processed successfully.",

        period:
          serializePeriod(
            result
          ),
      });
    } catch (error) {
      console.error(
        "[PAYROLL] Failed to run payroll:",
        error
      );

      /*
       * Serializable transaction conflict.
       */
      if (
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
        error.code ===
          "P2034"
      ) {
        return res.status(409).json({
          success: false,
          code:
            "PAYROLL_TRANSACTION_CONFLICT",
          message:
            "Payroll processing conflicted with another transaction. Please try again.",
        });
      }

      /*
       * Unique constraint violation.
       */
      if (
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
        error.code ===
          "P2002"
      ) {
        return res.status(409).json({
          success: false,
          code:
            "PAYROLL_PERIOD_EXISTS",
          message:
            "A payroll period for these dates already exists.",
        });
      }

      return res.status(500).json({
        success: false,
        code:
          "PAYROLL_PROCESSING_FAILED",
        message:
          "Failed to process payroll.",
      });
    }
  };