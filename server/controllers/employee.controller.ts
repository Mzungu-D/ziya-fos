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
    organizationId: req.user.organizationId,
  };
}

function stringValue(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function optionalString(
  value: unknown
): string | undefined {
  const valueString = stringValue(value);
  return valueString || undefined;
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

function serializeEmployee(employee: any) {
  return {
    id: employee.id,
    employeeNumber: employee.employeeNumber,
    firstName: employee.firstName,
    lastName: employee.lastName,
    name: `${employee.firstName} ${employee.lastName}`.trim(),
    email: employee.email,
    phoneNumber: employee.phoneNumber,
    department: employee.department,
    jobTitle: employee.jobTitle,
    employmentType: employee.employmentType,
    hireDate: employee.hireDate,
    basicSalary: Number(employee.basicSalary),
    status: employee.status,
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt,
  };
}

export const getEmployees = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const context = getTenantContext(req);

    if (!context) {
      return res.status(403).json({
        success: false,
        code: "TENANT_SESSION_REQUIRED",
        message: "A tenant session is required.",
      });
    }

    const search = stringValue(
      req.query.search
    );

    const department = stringValue(
      req.query.department
    );

    const status =
      stringValue(req.query.status) ||
      undefined;

    const employees =
      await prisma.employee.findMany({
        where: {
          organizationId:
            context.organizationId,

          ...(status
            ? { status }
            : {}),

          ...(department
            ? { department }
            : {}),

          ...(search
            ? {
                OR: [
                  {
                    employeeNumber: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
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
                    email: {
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
              }
            : {}),
        },

        orderBy: [
          {
            firstName: "asc",
          },
          {
            lastName: "asc",
          },
        ],
      });

    return res.status(200).json({
      success: true,
      employees:
        employees.map(serializeEmployee),
    });
  } catch (error) {
    console.error(
      "[EMPLOYEES] Failed to fetch employees:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "EMPLOYEE_FETCH_FAILED",
      message: "Failed to fetch employees.",
    });
  }
};

export const getEmployee = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const context = getTenantContext(req);

    if (!context) {
      return res.status(403).json({
        success: false,
        code: "TENANT_SESSION_REQUIRED",
        message: "A tenant session is required.",
      });
    }

    const id = stringValue(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        code: "EMPLOYEE_ID_REQUIRED",
        message: "Employee ID is required.",
      });
    }

    const employee =
      await prisma.employee.findFirst({
        where: {
          id,
          organizationId:
            context.organizationId,
        },
        include: {
          payrollRecords: {
            orderBy: {
              createdAt: "desc",
            },
            take: 12,
          },
        },
      });

    if (!employee) {
      return res.status(404).json({
        success: false,
        code: "EMPLOYEE_NOT_FOUND",
        message: "Employee was not found.",
      });
    }

    return res.status(200).json({
      success: true,
      employee: serializeEmployee(employee),
      payrollRecords:
        employee.payrollRecords.map(
          (record) => ({
            id: record.id,
            payrollPeriodId:
              record.payrollPeriodId,
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
          })
        ),
    });
  } catch (error) {
    console.error(
      "[EMPLOYEES] Failed to fetch employee:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "EMPLOYEE_FETCH_FAILED",
      message: "Failed to fetch employee.",
    });
  }
};

export const createEmployee = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const context = getTenantContext(req);

    if (!context) {
      return res.status(403).json({
        success: false,
        code: "TENANT_SESSION_REQUIRED",
        message: "A tenant session is required.",
      });
    }

    const employeeNumber =
      stringValue(
        req.body?.employeeNumber
      );

    const firstName =
      stringValue(req.body?.firstName);

    const lastName =
      stringValue(req.body?.lastName);

    const email =
      optionalString(req.body?.email)
        ?.toLowerCase();

    const phoneNumber =
      optionalString(
        req.body?.phoneNumber
      );

    const department =
      optionalString(
        req.body?.department
      );

    const jobTitle =
      optionalString(
        req.body?.jobTitle
      );

    const employmentType =
      stringValue(
        req.body?.employmentType
      ) || "FULL_TIME";

    const hireDateValue =
      stringValue(req.body?.hireDate);

    const basicSalary =
      toNumber(req.body?.basicSalary);

    if (!employeeNumber) {
      return res.status(400).json({
        success: false,
        code: "EMPLOYEE_NUMBER_REQUIRED",
        message: "Employee number is required.",
      });
    }

    if (!firstName) {
      return res.status(400).json({
        success: false,
        code: "FIRST_NAME_REQUIRED",
        message: "First name is required.",
      });
    }

    if (!lastName) {
      return res.status(400).json({
        success: false,
        code: "LAST_NAME_REQUIRED",
        message: "Last name is required.",
      });
    }

    if (!hireDateValue) {
      return res.status(400).json({
        success: false,
        code: "HIRE_DATE_REQUIRED",
        message: "Hire date is required.",
      });
    }

    if (
      !Number.isFinite(basicSalary) ||
      basicSalary < 0
    ) {
      return res.status(400).json({
        success: false,
        code: "INVALID_BASIC_SALARY",
        message:
          "Basic salary must be a valid non-negative amount.",
      });
    }

    const hireDate =
      new Date(hireDateValue);

    if (
      Number.isNaN(
        hireDate.getTime()
      )
    ) {
      return res.status(400).json({
        success: false,
        code: "INVALID_HIRE_DATE",
        message: "Hire date is invalid.",
      });
    }

    const existing =
      await prisma.employee.findFirst({
        where: {
          organizationId:
            context.organizationId,
          employeeNumber,
        },
      });

    if (existing) {
      return res.status(409).json({
        success: false,
        code: "EMPLOYEE_NUMBER_EXISTS",
        message:
          "An employee with this employee number already exists.",
      });
    }

    const employee =
      await prisma.employee.create({
        data: {
          organizationId:
            context.organizationId,
          employeeNumber,
          firstName,
          lastName,
          email,
          phoneNumber,
          department,
          jobTitle,
          employmentType,
          hireDate,
          basicSalary,
          status: "ACTIVE",
        },
      });

    return res.status(201).json({
      success: true,
      message: "Employee created successfully.",
      employee:
        serializeEmployee(employee),
    });
  } catch (error) {
    console.error(
      "[EMPLOYEES] Failed to create employee:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "EMPLOYEE_CREATE_FAILED",
      message: "Failed to create employee.",
    });
  }
};

export const updateEmployee = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const context = getTenantContext(req);

    if (!context) {
      return res.status(403).json({
        success: false,
        code: "TENANT_SESSION_REQUIRED",
        message: "A tenant session is required.",
      });
    }

    const id = stringValue(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        code: "EMPLOYEE_ID_REQUIRED",
        message: "Employee ID is required.",
      });
    }

    const existing =
      await prisma.employee.findFirst({
        where: {
          id,
          organizationId:
            context.organizationId,
        },
      });

    if (!existing) {
      return res.status(404).json({
        success: false,
        code: "EMPLOYEE_NOT_FOUND",
        message: "Employee was not found.",
      });
    }

    const data: any = {};

    if (
      req.body?.firstName !== undefined
    ) {
      data.firstName =
        stringValue(req.body.firstName);
    }

    if (
      req.body?.lastName !== undefined
    ) {
      data.lastName =
        stringValue(req.body.lastName);
    }

    if (
      req.body?.email !== undefined
    ) {
      data.email =
        optionalString(
          req.body.email
        )?.toLowerCase() ?? null;
    }

    if (
      req.body?.phoneNumber !== undefined
    ) {
      data.phoneNumber =
        optionalString(
          req.body.phoneNumber
        ) ?? null;
    }

    if (
      req.body?.department !== undefined
    ) {
      data.department =
        optionalString(
          req.body.department
        ) ?? null;
    }

    if (
      req.body?.jobTitle !== undefined
    ) {
      data.jobTitle =
        optionalString(
          req.body.jobTitle
        ) ?? null;
    }

    if (
      req.body?.employmentType !== undefined
    ) {
      data.employmentType =
        stringValue(
          req.body.employmentType
        );
    }

    if (
      req.body?.hireDate !== undefined
    ) {
      const hireDate =
        new Date(
          stringValue(
            req.body.hireDate
          )
        );

      if (
        Number.isNaN(
          hireDate.getTime()
        )
      ) {
        return res.status(400).json({
          success: false,
          code: "INVALID_HIRE_DATE",
          message:
            "Hire date is invalid.",
        });
      }

      data.hireDate = hireDate;
    }

    if (
      req.body?.basicSalary !== undefined
    ) {
      const salary =
        toNumber(
          req.body.basicSalary
        );

      if (
        !Number.isFinite(salary) ||
        salary < 0
      ) {
        return res.status(400).json({
          success: false,
          code: "INVALID_BASIC_SALARY",
          message:
            "Basic salary must be a valid non-negative amount.",
        });
      }

      data.basicSalary = salary;
    }

    if (
      req.body?.status !== undefined
    ) {
      const nextStatus =
        stringValue(
          req.body.status
        ).toUpperCase();

      if (
        ![
          "ACTIVE",
          "ON_LEAVE",
          "INACTIVE",
          "TERMINATED",
        ].includes(nextStatus)
      ) {
        return res.status(400).json({
          success: false,
          code: "INVALID_EMPLOYEE_STATUS",
          message:
            "Invalid employee status.",
        });
      }

      data.status = nextStatus;
    }

    const employee =
      await prisma.employee.update({
        where: {
          id: existing.id,
        },
        data,
      });

    return res.status(200).json({
      success: true,
      message: "Employee updated successfully.",
      employee:
        serializeEmployee(employee),
    });
  } catch (error) {
    console.error(
      "[EMPLOYEES] Failed to update employee:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "EMPLOYEE_UPDATE_FAILED",
      message: "Failed to update employee.",
    });
  }
};

export const deleteEmployee = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const context = getTenantContext(req);

    if (!context) {
      return res.status(403).json({
        success: false,
        code: "TENANT_SESSION_REQUIRED",
        message: "A tenant session is required.",
      });
    }

    const id = stringValue(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        code: "EMPLOYEE_ID_REQUIRED",
        message: "Employee ID is required.",
      });
    }

    const employee =
      await prisma.employee.findFirst({
        where: {
          id,
          organizationId: context.organizationId,
        },
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
        },
      });

    if (!employee) {
      return res.status(404).json({
        success: false,
        code: "EMPLOYEE_NOT_FOUND",
        message: "Employee was not found.",
      });
    }

    const payrollRecordCount =
      await prisma.payrollRecord.count({
        where: {
          employeeId: employee.id,
          organizationId: context.organizationId,
        },
      });

    if (payrollRecordCount > 0) {
      return res.status(409).json({
        success: false,
        code: "EMPLOYEE_HAS_PAYROLL_RECORDS",
        message:
          "This employee cannot be deleted because payroll records exist. Deactivate or terminate the employee instead.",
      });
    }

    await prisma.employee.delete({
      where: {
        id: employee.id,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Employee deleted successfully.",
    });
  } catch (error) {
    console.error(
      "[EMPLOYEES] Failed to delete employee:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "EMPLOYEE_DELETE_FAILED",
      message: "Failed to delete employee.",
    });
  }
};