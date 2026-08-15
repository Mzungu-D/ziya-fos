import type { Response } from "express";
import prisma from "../config/prisma";
import type { AuthRequest } from "../middleware/auth.middleware";

function getTenantContext(req: AuthRequest) {
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

function stringValue(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function toNumber(value: unknown): number {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(
      value.replace(/,/g, "")
    );

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function serializeRecord(record: any) {
  return {
    id: record.id,
    payrollPeriodId:
      record.payrollPeriodId,
    employeeId:
      record.employeeId,
    employee: record.employee
      ? {
          id: record.employee.id,
          employeeNumber:
            record.employee.employeeNumber,
          firstName:
            record.employee.firstName,
          lastName:
            record.employee.lastName,
          name: `${record.employee.firstName} ${record.employee.lastName}`,
          department:
            record.employee.department,
        }
      : null,
    basicSalary:
      Number(record.basicSalary),
    allowances:
      Number(record.allowances),
    grossSalary:
      Number(record.grossSalary),
    deductions:
      Number(record.deductions),
    netSalary:
      Number(record.netSalary),
    status: record.status,
    processedAt:
      record.processedAt,
    createdAt:
      record.createdAt,
    updatedAt:
      record.updatedAt,
  };
}

function serializePeriod(period: any) {
  return {
    id: period.id,
    name: period.name,
    periodStart:
      period.periodStart,
    periodEnd:
      period.periodEnd,
    status: period.status,
    totalGross:
      Number(period.totalGross),
    totalDeductions:
      Number(period.totalDeductions),
    totalNet:
      Number(period.totalNet),
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
      period.payrollRecords
        ?.map(serializeRecord),
  };
}

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
      await prisma.payrollPeriod.findMany({
        where: {
          organizationId:
            context.organizationId,
        },
        include: {
          payrollRecords: {
            include: {
              employee: true,
            },
            orderBy: {
              employee: {
                firstName: "asc",
              },
            },
          },
        },
        orderBy: {
          periodStart: "desc",
        },
      });

    const employees =
      await prisma.employee.findMany({
        where: {
          organizationId:
            context.organizationId,
          status: "ACTIVE",
        },
      });

    const latest =
      periods[0] ?? null;

    const summary = latest
      ? {
          employees:
            latest.payrollRecords.length,
          grossPayroll:
            Number(latest.totalGross),
          deductions:
            Number(
              latest.totalDeductions
            ),
          netPayroll:
            Number(latest.totalNet),
        }
      : {
          employees:
            employees.length,
          grossPayroll: 0,
          deductions: 0,
          netPayroll: 0,
        };

    return res.status(200).json({
      success: true,
      summary,
      periods:
        periods.map(serializePeriod),
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

export const getPayrollPeriod = async (
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
      stringValue(req.params.id);

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
      await prisma.payrollPeriod.findFirst({
        where: {
          id,
          organizationId:
            context.organizationId,
        },
        include: {
          payrollRecords: {
            include: {
              employee: true,
            },
            orderBy: {
              employee: {
                firstName: "asc",
              },
            },
          },
        },
      });

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
        serializePeriod(period),
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
      stringValue(req.body?.name);

    const periodStart =
      new Date(
        stringValue(
          req.body?.periodStart
        )
      );

    const periodEnd =
      new Date(
        stringValue(
          req.body?.periodEnd
        )
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

    if (periodEnd < periodStart) {
      return res.status(400).json({
        success: false,
        code:
          "INVALID_PAYROLL_PERIOD",
        message:
          "Payroll end date cannot be before the start date.",
      });
    }

    const deductions =
      req.body?.deductions ?? {};

    if (
      typeof deductions !== "object" ||
      Array.isArray(deductions)
    ) {
      return res.status(400).json({
        success: false,
        code:
          "INVALID_DEDUCTIONS",
        message:
          "Deductions must be supplied as an object.",
      });
    }

    const employees =
      await prisma.employee.findMany({
        where: {
          organizationId:
            context.organizationId,
          status: "ACTIVE",
        },
      });

    if (employees.length === 0) {
      return res.status(400).json({
        success: false,
        code:
          "NO_ACTIVE_EMPLOYEES",
        message:
          "There are no active employees to process.",
      });
    }

    const existing =
      await prisma.payrollPeriod.findFirst({
        where: {
          organizationId:
            context.organizationId,
          periodStart,
          periodEnd,
        },
      });

    if (existing) {
      return res.status(409).json({
        success: false,
        code:
          "PAYROLL_PERIOD_EXISTS",
        message:
          "A payroll period for these dates already exists.",
      });
    }

    const result =
      await prisma.$transaction(
        async (tx) => {
          let totalGross = 0;
          let totalDeductions = 0;
          let totalNet = 0;

          const period =
            await tx.payrollPeriod.create({
              data: {
                organizationId:
                  context.organizationId,
                name,
                periodStart,
                periodEnd,
                status: "PROCESSED",
                processedAt:
                  new Date(),
              },
            });

          for (
            const employee of employees
          ) {
            const basicSalary =
              Number(
                employee.basicSalary
              );

            const allowance =
              toNumber(
                req.body?.allowances?.[
                  employee.id
                ]
              );

            const deduction =
              Math.max(
                0,
                toNumber(
                  deductions[
                    employee.id
                  ]
                )
              );

            const grossSalary =
              basicSalary +
              allowance;

            const netSalary =
              Math.max(
                0,
                grossSalary -
                  deduction
              );

            totalGross +=
              grossSalary;

            totalDeductions +=
              deduction;

            totalNet +=
              netSalary;

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
                    deduction,
                  netSalary,
                  status:
                    "PROCESSED",
                  processedAt:
                    new Date(),
                },
              }
            );
          }

          return tx.payrollPeriod.update({
            where: {
              id: period.id,
            },
            data: {
              totalGross,
              totalDeductions,
              totalNet,
            },
            include: {
              payrollRecords: {
                include: {
                  employee: true,
                },
                orderBy: {
                  employee: {
                    firstName:
                      "asc",
                  },
                },
              },
            },
          });
        }
      );

    return res.status(201).json({
      success: true,
      message:
        "Payroll processed successfully.",
      period:
        serializePeriod(result),
    });
  } catch (error) {
    console.error(
      "[PAYROLL] Failed to run payroll:",
      error
    );

    return res.status(500).json({
      success: false,
      code:
        "PAYROLL_PROCESSING_FAILED",
      message:
        "Failed to process payroll.",
    });
  }
};