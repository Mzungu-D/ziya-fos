import type { Response } from "express";
import {
  Prisma,
} from "@prisma/client";

import prisma from "../config/prisma";
import type { AuthRequest } from "../middleware/auth.middleware";

import {
  calculateEmployeePayroll,
} from "../services/payroll.service";

/**
 * =========================================================
 * TENANT CONTEXT
 * =========================================================
 *
 * Payroll is strictly organization scoped.
 *
 * The organization is ALWAYS taken from the authenticated
 * tenant session.
 *
 * Never trust organizationId supplied by the browser.
 */
function getTenantContext(
  req: AuthRequest
) {
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
    userId:
      req.user.userId,

    organizationId:
      req.user.organizationId,
  };
}

/**
 * =========================================================
 * SAFE STRING
 * =========================================================
 */
function stringValue(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

/**
 * =========================================================
 * SAFE NUMBER
 * =========================================================
 */
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
    const parsed =
      Number(
        value
          .replace(/,/g, "")
          .trim()
      );

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  /*
   * Prisma Decimal values are objects.
   * Number(value) converts the Prisma
   * numeric value to a JavaScript number.
   */
  if (
    typeof value === "object"
  ) {
    const converted =
      Number(value);

    return Number.isFinite(converted)
      ? converted
      : 0;
  }

  return 0;
}

/**
 * =========================================================
 * ROUND MONEY
 * =========================================================
 */
function roundMoney(
  value: number
): number {
  return Math.round(
    (value + Number.EPSILON) *
      100
  ) / 100;
}

/**
 * =========================================================
 * SERIALIZE PAYROLL DEDUCTION
 * =========================================================
 */
function serializeDeduction(
  deduction: any
) {
  return {
    id:
      deduction.id,

    type:
      deduction.type,

    description:
      deduction.description,

    amount:
      Number(
        deduction.amount
      ),

    createdAt:
      deduction.createdAt,
  };
}

/**
 * =========================================================
 * SERIALIZE EMPLOYER CONTRIBUTION
 * =========================================================
 */
function serializeEmployerContribution(
  contribution: any
) {
  return {
    id:
      contribution.id,

    type:
      contribution.type,

    description:
      contribution.description,

    amount:
      Number(
        contribution.amount
      ),

    createdAt:
      contribution.createdAt,
  };
}

/**
 * =========================================================
 * SERIALIZE PAYROLL RECORD
 * =========================================================
 */
function serializeRecord(
  record: any
) {
  return {
    id:
      record.id,

    payrollPeriodId:
      record.payrollPeriodId,

    employeeId:
      record.employeeId,

    employee:
      record.employee
        ? {
            id:
              record.employee.id,

            employeeNumber:
              record.employee
                .employeeNumber,

            firstName:
              record.employee
                .firstName,

            lastName:
              record.employee
                .lastName,

            name:
              `${record.employee.firstName} ${record.employee.lastName}`,

            email:
              record.employee.email,

            phoneNumber:
              record.employee
                .phoneNumber,

            department:
              record.employee
                .department,

            jobTitle:
              record.employee
                .jobTitle,
          }
        : null,

    basicSalary:
      Number(
        record.basicSalary
      ),

    allowances:
      Number(
        record.allowances
      ),

    grossSalary:
      Number(
        record.grossSalary
      ),

    deductions:
      Number(
        record.deductions
      ),

    netSalary:
      Number(
        record.netSalary
      ),

    status:
      record.status,

    processedAt:
      record.processedAt,

    /**
     * Detailed employee deductions.
     */
    deductionsBreakdown:
      Array.isArray(
        record.payrollDeductions
      )
        ? record.payrollDeductions.map(
            serializeDeduction
          )
        : [],

    /**
     * Employer contributions are deliberately
     * separated from employee deductions.
     */
    employerContributions:
      Array.isArray(
        record.employerContributions
      )
        ? record.employerContributions.map(
            serializeEmployerContribution
          )
        : [],

    createdAt:
      record.createdAt,

    updatedAt:
      record.updatedAt,
  };
}

/**
 * =========================================================
 * SERIALIZE PAYROLL PERIOD
 * =========================================================
 */
function serializePeriod(
  period: any
) {
  return {
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

    totalGross:
      Number(
        period.totalGross
      ),

    totalDeductions:
      Number(
        period.totalDeductions
      ),

    totalNet:
      Number(
        period.totalNet
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

/**
 * =========================================================
 * GET ALL PAYROLL
 * =========================================================
 *
 * GET /payroll
 */
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

    const periods =
      await prisma.payrollPeriod.findMany(
        {
          where: {
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
              },

              orderBy: {
                employee: {
                  firstName:
                    "asc",
                },
              },
            },
          },

          orderBy: {
            periodStart:
              "desc",
          },
        }
      );

    const employees =
      await prisma.employee.findMany(
        {
          where: {
            organizationId:
              context.organizationId,

            status:
              "ACTIVE",
          },
        }
      );

    const latest =
      periods[0] ?? null;

    const summary =
      latest
        ? {
            employees:
              latest
                .payrollRecords
                .length,

            grossPayroll:
              Number(
                latest.totalGross
              ),

            deductions:
              Number(
                latest.totalDeductions
              ),

            netPayroll:
              Number(
                latest.totalNet
              ),
          }
        : {
            employees:
              employees.length,

            grossPayroll:
              0,

            deductions:
              0,

            netPayroll:
              0,
          };

    return res.status(200).json({
      success: true,

      summary,

      periods:
        periods.map(
          serializePeriod
        ),
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

/**
 * =========================================================
 * GET PAYROLL PERIOD
 * =========================================================
 *
 * GET /payroll/:id
 */
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
                },

                orderBy: {
                  employee: {
                    firstName:
                      "asc",
                  },
                },
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

/**
 * =========================================================
 * GET INDIVIDUAL PAYSLIP
 * =========================================================
 *
 * GET /payroll/:id/payslip
 *
 * Here :id is the PayrollRecord ID.
 *
 * IMPORTANT:
 * The lookup includes organizationId so an employee
 * record from another tenant can never be returned.
 */
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

      /**
       * Never expose a payslip for an unprocessed
       * payroll record.
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

      const employee =
        record.employee;

      const period =
        record.payrollPeriod;

      const deductions =
        record.payrollDeductions
          .map(
            serializeDeduction
          );

      const employerContributions =
        record
          .employerContributions
          .map(
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
              contribution.amount,

            0
          )
        );

      return res.status(200).json({
        success: true,

        payslip: {
          id:
            record.id,

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
              `${employee.firstName} ${employee.lastName}`,

            email:
              employee.email,

            phoneNumber:
              employee.phoneNumber,

            department:
              employee.department,

            jobTitle:
              employee.jobTitle,

            employmentType:
              employee.employmentType,

            hireDate:
              employee.hireDate,
          },

          employer: {
            organizationId:
              context.organizationId,
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
              Number(
                record.basicSalary
              ),

            allowances:
              Number(
                record.allowances
              ),

            grossSalary:
              Number(
                record.grossSalary
              ),
          },

          deductions,

          totals: {
            grossSalary:
              Number(
                record.grossSalary
              ),

            totalDeductions:
              Number(
                record.deductions
              ),

            netSalary:
              Number(
                record.netSalary
              ),

            totalEmployerContributions,
          },

          employerContributions,

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

/**
 * =========================================================
 * RUN PAYROLL
 * =========================================================
 *
 * POST /payroll/run
 *
 * This is now the real payroll engine.
 *
 * It does NOT calculate:
 *
 * gross - manually supplied deduction
 *
 * Instead it calls calculateEmployeePayroll()
 * for every employee.
 *
 * All records, deductions, contributions and balance
 * updates happen inside ONE database transaction.
 */
export const runPayroll = async (
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

    /**
     * Optional allowances map.
     *
     * Example:
     *
     * {
     *   employeeId1: 5000,
     *   employeeId2: 10000
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

    /**
     * Employees are loaded only from this tenant.
     */
    const employees =
      await prisma.employee.findMany(
        {
          where: {
            organizationId:
              context.organizationId,

            status:
              "ACTIVE",
          },

          orderBy: [
            {
              firstName:
                "asc",
            },

            {
              lastName:
                "asc",
            },
          ],
        }
      );

    if (
      employees.length === 0
    ) {
      return res.status(400).json({
        success: false,

        code:
          "NO_ACTIVE_EMPLOYEES",

        message:
          "There are no active employees to process.",
      });
    }

    /**
     * Check before entering the transaction so we can
     * return a clean conflict response.
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

    /**
     * =====================================================
     * ATOMIC PAYROLL TRANSACTION
     * =====================================================
     *
     * Serializable isolation protects against concurrent
     * payroll processing against the same outstanding
     * salary advances and employee loans.
     */
    const result =
      await prisma.$transaction(
        async (tx) => {
          let totalGross = 0;

          let totalDeductions =
            0;

          let totalNet = 0;

          /**
           * -------------------------------------------------
           * CREATE PAYROLL PERIOD
           * -------------------------------------------------
           */
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

                  processedAt:
                    new Date(),
                },
              }
            );

          /**
           * -------------------------------------------------
           * PROCESS EACH EMPLOYEE
           * -------------------------------------------------
           */
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

            const allowance =
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

            /**
             * Run the central payroll engine.
             *
             * Pass the transaction client so the reads
             * participate in the same transaction.
             */
            const calculation =
              await calculateEmployeePayroll(
                employee.id,

                context.organizationId,

                basicSalary,

                allowance,

                tx
              );

            /**
             * -------------------------------------------------
             * ROUND FINAL VALUES
             * -------------------------------------------------
             */
            const grossSalary =
              roundMoney(
                calculation.grossSalary
              );

            const deductionTotal =
              roundMoney(
                calculation.totalDeductions
              );

            const netSalary =
              roundMoney(
                calculation.netSalary
              );

            /**
             * -------------------------------------------------
             * CREATE PAYROLL RECORD
             * -------------------------------------------------
             */
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

                    allowances:
                      allowance,

                    grossSalary,

                    deductions:
                      deductionTotal,

                    netSalary,

                    status:
                      "PROCESSED",

                    processedAt:
                      new Date(),
                  },
                }
              );

            /**
             * -------------------------------------------------
             * CREATE EMPLOYEE DEDUCTION ROWS
             * -------------------------------------------------
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

              /**
               * -----------------------------------------------
               * UPDATE SALARY ADVANCE BALANCE
               * -----------------------------------------------
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

                /**
                 * Automatically close a fully repaid
                 * salary advance.
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

              /**
               * -----------------------------------------------
               * UPDATE EMPLOYEE LOAN BALANCE
               * -----------------------------------------------
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

                /**
                 * Automatically close a fully repaid
                 * employee loan.
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

            /**
             * -------------------------------------------------
             * CREATE EMPLOYER CONTRIBUTION ROWS
             * -------------------------------------------------
             *
             * These NEVER enter payrollRecord.deductions.
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

            /**
             * -------------------------------------------------
             * PERIOD TOTALS
             * -------------------------------------------------
             */
            totalGross +=
              grossSalary;

            totalDeductions +=
              deductionTotal;

            totalNet +=
              netSalary;
          }

          /**
           * -------------------------------------------------
           * UPDATE PERIOD TOTALS
           * -------------------------------------------------
           */
          return tx.payrollPeriod.update(
            {
              where: {
                id:
                  period.id,
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
                  },

                  orderBy: {
                    employee: {
                      firstName:
                        "asc",
                    },
                  },
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

    /**
     * Handle Prisma serialization conflicts cleanly.
     */
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return res.status(409).json({
        success: false,

        code:
          "PAYROLL_TRANSACTION_CONFLICT",

        message:
          "Payroll processing conflicted with another transaction. Please try again.",
      });
    }

    /**
     * Unique payroll period conflict.
     */
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
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
