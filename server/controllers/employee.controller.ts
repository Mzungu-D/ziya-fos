import type { Response } from "express";
import { Prisma } from "@prisma/client";

import prisma from "../config/prisma";
import type { AuthRequest } from "../middleware/auth.middleware";

/* =========================================================
   TENANT CONTEXT
========================================================= */

function getTenantContext(req: AuthRequest) {
  if (!req.user?.userId || !req.user?.organizationId) {
    return null;
  }

  const sessionType = (
    req.user as AuthRequest["user"] & {
      sessionType?: string;
    }
  ).sessionType;

  if (sessionType && sessionType !== "TENANT") {
    return null;
  }

  return {
    userId: req.user.userId,
    organizationId: req.user.organizationId,
  };
}

/* =========================================================
   INPUT HELPERS
========================================================= */

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(value: unknown): string | undefined {
  const valueString = stringValue(value);
  return valueString || undefined;
}

function nullableString(value: unknown): string | null {
  const valueString = stringValue(value);
  return valueString || null;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, ""));

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function parseOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const raw = stringValue(value);

  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

/* =========================================================
   VALIDATION HELPERS
========================================================= */

const VALID_EMPLOYMENT_TYPES = [
  "FULL_TIME",
  "PART_TIME",
  "CONTRACT",
  "CASUAL",
  "INTERN",
] as const;

const VALID_STATUSES = [
  "ACTIVE",
  "ON_LEAVE",
  "INACTIVE",
  "TERMINATED",
] as const;

const VALID_PAYMENT_METHODS = [
  "BANK",
  "MPESA",
  "CASH",
] as const;

function isValidEmploymentType(value: string): boolean {
  return VALID_EMPLOYMENT_TYPES.includes(
    value as (typeof VALID_EMPLOYMENT_TYPES)[number]
  );
}

function isValidStatus(value: string): boolean {
  return VALID_STATUSES.includes(
    value as (typeof VALID_STATUSES)[number]
  );
}

function isValidPaymentMethod(value: string): boolean {
  return VALID_PAYMENT_METHODS.includes(
    value as (typeof VALID_PAYMENT_METHODS)[number]
  );
}

/* =========================================================
   SERIALIZATION
========================================================= */

function serializeManager(manager: any) {
  if (!manager) {
    return null;
  }

  return {
    id: manager.id,
    employeeNumber: manager.employeeNumber,
    firstName: manager.firstName,
    middleName: manager.middleName,
    lastName: manager.lastName,
    name: [
      manager.firstName,
      manager.middleName,
      manager.lastName,
    ]
      .filter(Boolean)
      .join(" "),
    jobTitle: manager.jobTitle,
  };
}

function serializeEmployee(employee: any) {
  return {
    id: employee.id,

    /* Identity */
    employeeNumber: employee.employeeNumber,
    firstName: employee.firstName,
    middleName: employee.middleName,
    lastName: employee.lastName,

    name: [
      employee.firstName,
      employee.middleName,
      employee.lastName,
    ]
      .filter(Boolean)
      .join(" "),

    /* Contact */
    email: employee.email,
    phoneNumber: employee.phoneNumber,

    /* Personal */
    dateOfBirth: employee.dateOfBirth,
    gender: employee.gender,
    maritalStatus: employee.maritalStatus,
    nationality: employee.nationality,
    nationalId: employee.nationalId,
    passportNumber: employee.passportNumber,

    /* Address */
    address: employee.address,
    city: employee.city,
    county: employee.county,
    postalCode: employee.postalCode,

    /* Emergency contact */
    emergencyContactName: employee.emergencyContactName,
    emergencyContactRelationship:
      employee.emergencyContactRelationship,
    emergencyContactPhone: employee.emergencyContactPhone,
    emergencyContactEmail: employee.emergencyContactEmail,

    /* Employment */
    department: employee.department,
    jobTitle: employee.jobTitle,
    employmentType: employee.employmentType,
    hireDate: employee.hireDate,
    probationEndDate: employee.probationEndDate,
    terminationDate: employee.terminationDate,
    workLocation: employee.workLocation,
    employmentNotes: employee.employmentNotes,

    /* Reporting structure */
    managerId: employee.managerId,
    leadershipRole: employee.leadershipRole,
    manager: serializeManager(employee.manager),

    /* Compensation / payment */
    basicSalary:
      employee.basicSalary !== null &&
      employee.basicSalary !== undefined
        ? Number(employee.basicSalary)
        : 0,

    paymentMethod: employee.paymentMethod,
    bankName: employee.bankName,
    bankBranch: employee.bankBranch,
    bankAccountName: employee.bankAccountName,
    bankAccountNumber: employee.bankAccountNumber,
    mobileMoneyNumber: employee.mobileMoneyNumber,

    /* Status */
    status: employee.status,

    /* Audit */
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt,
  };
}

/* =========================================================
   GET EMPLOYEE STATISTICS
   GET /api/employees/stats
========================================================= */

export const getEmployeeStats = async (
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

    const organizationId = context.organizationId;

    const [
      totalEmployees,
      activeEmployees,
      onLeaveEmployees,
      inactiveEmployees,
      terminatedEmployees,
      departmentGroups,
      employmentTypeGroups,
    ] = await Promise.all([
      prisma.employee.count({
        where: {
          organizationId,
        },
      }),

      prisma.employee.count({
        where: {
          organizationId,
          status: "ACTIVE",
        },
      }),

      prisma.employee.count({
        where: {
          organizationId,
          status: "ON_LEAVE",
        },
      }),

      prisma.employee.count({
        where: {
          organizationId,
          status: "INACTIVE",
        },
      }),

      prisma.employee.count({
        where: {
          organizationId,
          status: "TERMINATED",
        },
      }),

      prisma.employee.groupBy({
        by: ["department"],
        where: {
          organizationId,
        },
        _count: {
          _all: true,
        },
        orderBy: {
          department: "asc",
        },
      }),

      prisma.employee.groupBy({
        by: ["employmentType"],
        where: {
          organizationId,
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    const departments = departmentGroups
      .filter((item) => item.department)
      .map((item) => ({
        name: item.department as string,
        count: item._count._all,
      }));

    const employmentTypes = employmentTypeGroups.map(
      (item) => ({
        type: item.employmentType,
        count: item._count._all,
      })
    );

    return res.status(200).json({
      success: true,

      stats: {
        totalEmployees,
        activeEmployees,
        onLeaveEmployees,
        inactiveEmployees,
        terminatedEmployees,

        departments,
        departmentCount: departments.length,

        employmentTypes,
      },
    });
  } catch (error) {
    console.error(
      "[EMPLOYEES] Failed to fetch employee statistics:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "EMPLOYEE_STATS_FAILED",
      message: "Failed to fetch employee statistics.",
    });
  }
};

/* =========================================================
   GET EMPLOYEES
   GET /api/employees
========================================================= */

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

    const search = stringValue(req.query.search);

    const department = stringValue(
      req.query.department
    );

    const status =
      stringValue(req.query.status).toUpperCase() ||
      undefined;

    /* -----------------------------------------------------
       Pagination
    ----------------------------------------------------- */

    const requestedPage = Number(req.query.page);
    const requestedPageSize = Number(req.query.pageSize);

    const page =
      Number.isFinite(requestedPage) && requestedPage > 0
        ? Math.floor(requestedPage)
        : 1;

    const pageSize =
      Number.isFinite(requestedPageSize) &&
      requestedPageSize > 0
        ? Math.min(Math.floor(requestedPageSize), 100)
        : 25;

    const skip = (page - 1) * pageSize;

    /* -----------------------------------------------------
       Filters
    ----------------------------------------------------- */

    const where: Prisma.EmployeeWhereInput = {
      organizationId: context.organizationId,

      ...(status
        ? {
            status,
          }
        : {}),

      ...(department
        ? {
            department,
          }
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
                middleName: {
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
              {
                jobTitle: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    };

    /* -----------------------------------------------------
       Query employees + count in parallel
    ----------------------------------------------------- */

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,

        include: {
          manager: {
            select: {
              id: true,
              employeeNumber: true,
              firstName: true,
              middleName: true,
              lastName: true,
              jobTitle: true,
            },
          },
        },

        orderBy: [
          {
            firstName: "asc",
          },
          {
            lastName: "asc",
          },
        ],

        skip,
        take: pageSize,
      }),

      prisma.employee.count({
        where,
      }),
    ]);

    const totalPages =
      total === 0
        ? 0
        : Math.ceil(total / pageSize);

    return res.status(200).json({
      success: true,

      employees: employees.map(serializeEmployee),

      count: employees.length,

      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage:
          totalPages > 0 && page < totalPages,
        hasPreviousPage: page > 1,
      },
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

/* =========================================================
   GET SINGLE EMPLOYEE
   GET /api/employees/:id
========================================================= */

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
          organizationId: context.organizationId,
        },

        include: {
          manager: {
            select: {
              id: true,
              employeeNumber: true,
              firstName: true,
              middleName: true,
              lastName: true,
              jobTitle: true,
            },
          },

          reports: {
            select: {
              id: true,
              employeeNumber: true,
              firstName: true,
              middleName: true,
              lastName: true,
              jobTitle: true,
              department: true,
              status: true,
            },

            orderBy: [
              {
                firstName: "asc",
              },
              {
                lastName: "asc",
              },
            ],
          },

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

    const serializedEmployee = serializeEmployee(
      employee
    );

    const directReports =
      employee.reports.map((report) => ({
        id: report.id,
        employeeNumber: report.employeeNumber,
        firstName: report.firstName,
        middleName: report.middleName,
        lastName: report.lastName,
        name: [
          report.firstName,
          report.middleName,
          report.lastName,
        ]
          .filter(Boolean)
          .join(" "),
        jobTitle: report.jobTitle,
        department: report.department,
        status: report.status,
      }));

    return res.status(200).json({
      success: true,

      employee: {
        ...serializedEmployee,
        directReports,
        directReportCount: directReports.length,
      },

      payrollRecords:
        employee.payrollRecords.map((record) => ({
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
        })),
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

/* =========================================================
   CREATE EMPLOYEE
   POST /api/employees
========================================================= */

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

    /* -----------------------------------------------------
       Required fields
    ----------------------------------------------------- */

    const employeeNumber = stringValue(
      req.body?.employeeNumber
    );

    const firstName = stringValue(
      req.body?.firstName
    );

    const middleName =
      optionalString(req.body?.middleName);

    const lastName = stringValue(
      req.body?.lastName
    );

    const email =
      optionalString(req.body?.email)
        ?.toLowerCase();

    const phoneNumber =
      optionalString(req.body?.phoneNumber);

    const department =
      optionalString(req.body?.department);

    const jobTitle =
      optionalString(req.body?.jobTitle);

    const employmentType =
      stringValue(req.body?.employmentType) ||
      "FULL_TIME";

    const hireDateValue =
      stringValue(req.body?.hireDate);

    const basicSalary =
      toNumber(req.body?.basicSalary);

    /* -----------------------------------------------------
       New HR fields
    ----------------------------------------------------- */

    const dateOfBirth =
      parseOptionalDate(req.body?.dateOfBirth);

    const gender =
      optionalString(req.body?.gender);

    const maritalStatus =
      optionalString(req.body?.maritalStatus);

    const nationality =
      optionalString(req.body?.nationality);

    const nationalId =
      optionalString(req.body?.nationalId);

    const passportNumber =
      optionalString(req.body?.passportNumber);

    /* Address */

    const address =
      optionalString(req.body?.address);

    const city =
      optionalString(req.body?.city);

    const county =
      optionalString(req.body?.county);

    const postalCode =
      optionalString(req.body?.postalCode);

    /* Emergency contact */

    const emergencyContactName =
      optionalString(
        req.body?.emergencyContactName
      );

    const emergencyContactRelationship =
      optionalString(
        req.body?.emergencyContactRelationship
      );

    const emergencyContactPhone =
      optionalString(
        req.body?.emergencyContactPhone
      );

    const emergencyContactEmail =
      optionalString(
        req.body?.emergencyContactEmail
      )?.toLowerCase();

    /* Employment */

    const probationEndDate =
      parseOptionalDate(
        req.body?.probationEndDate
      );

    const terminationDate =
      parseOptionalDate(
        req.body?.terminationDate
      );

    const workLocation =
      optionalString(req.body?.workLocation);

    const employmentNotes =
      optionalString(
        req.body?.employmentNotes
      );

    /* Reporting */

    const managerId =
      optionalString(req.body?.managerId);

    /* Payment */

    const paymentMethod =
      optionalString(req.body?.paymentMethod);

    const bankName =
      optionalString(req.body?.bankName);

    const bankBranch =
      optionalString(req.body?.bankBranch);

    const bankAccountName =
      optionalString(
        req.body?.bankAccountName
      );

    const bankAccountNumber =
      optionalString(
        req.body?.bankAccountNumber
      );

    const mobileMoneyNumber =
      optionalString(
        req.body?.mobileMoneyNumber
      );

    /* -----------------------------------------------------
       Required validation
    ----------------------------------------------------- */

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

    /* -----------------------------------------------------
       Hire date
    ----------------------------------------------------- */

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

    /* -----------------------------------------------------
       Optional date validation
    ----------------------------------------------------- */

    if (
      req.body?.dateOfBirth !== undefined &&
      dateOfBirth === null &&
      stringValue(req.body?.dateOfBirth)
    ) {
      return res.status(400).json({
        success: false,
        code: "INVALID_DATE_OF_BIRTH",
        message: "Date of birth is invalid.",
      });
    }

    if (
      req.body?.probationEndDate !== undefined &&
      probationEndDate === null &&
      stringValue(req.body?.probationEndDate)
    ) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PROBATION_END_DATE",
        message:
          "Probation end date is invalid.",
      });
    }

    if (
      req.body?.terminationDate !== undefined &&
      terminationDate === null &&
      stringValue(req.body?.terminationDate)
    ) {
      return res.status(400).json({
        success: false,
        code: "INVALID_TERMINATION_DATE",
        message:
          "Termination date is invalid.",
      });
    }

    /* -----------------------------------------------------
       Employment type validation
    ----------------------------------------------------- */

    if (!isValidEmploymentType(employmentType)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_EMPLOYMENT_TYPE",
        message:
          "Invalid employment type.",
      });
    }

    /* -----------------------------------------------------
       Payment method validation
    ----------------------------------------------------- */

    if (
      paymentMethod &&
      !isValidPaymentMethod(paymentMethod)
    ) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PAYMENT_METHOD",
        message:
          "Invalid payment method.",
      });
    }

    /* -----------------------------------------------------
       Duplicate employee number
    ----------------------------------------------------- */

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

    /* -----------------------------------------------------
       Manager validation
    ----------------------------------------------------- */

    if (managerId) {
      const manager =
        await prisma.employee.findFirst({
          where: {
            id: managerId,
            organizationId:
              context.organizationId,
          },

          select: {
            id: true,
          },
        });

      if (!manager) {
        return res.status(400).json({
          success: false,
          code: "INVALID_MANAGER",
          message:
            "The selected manager does not exist in this organization.",
        });
      }
    }

    /* -----------------------------------------------------
       Create employee
    ----------------------------------------------------- */

    const employee =
      await prisma.employee.create({
        data: {
          organizationId:
            context.organizationId,

          employeeNumber,

          firstName,

          middleName:
            middleName ?? null,

          lastName,

          email:
            email ?? null,

          phoneNumber:
            phoneNumber ?? null,

          dateOfBirth:
            dateOfBirth ?? null,

          gender:
            gender ?? null,

          maritalStatus:
            maritalStatus ?? null,

          nationality:
            nationality ?? null,

          nationalId:
            nationalId ?? null,

          passportNumber:
            passportNumber ?? null,

          address:
            address ?? null,

          city:
            city ?? null,

          county:
            county ?? null,

          postalCode:
            postalCode ?? null,

          emergencyContactName:
            emergencyContactName ?? null,

          emergencyContactRelationship:
            emergencyContactRelationship ?? null,

          emergencyContactPhone:
            emergencyContactPhone ?? null,

          emergencyContactEmail:
            emergencyContactEmail ?? null,

          department:
            department ?? null,

          jobTitle:
            jobTitle ?? null,

          employmentType,

          hireDate,

          probationEndDate:
            probationEndDate ?? null,

          terminationDate:
            terminationDate ?? null,

          workLocation:
            workLocation ?? null,

          employmentNotes:
            employmentNotes ?? null,

          managerId:
            managerId ?? null,

          basicSalary,

          paymentMethod:
            paymentMethod ?? null,

          bankName:
            bankName ?? null,

          bankBranch:
            bankBranch ?? null,

          bankAccountName:
            bankAccountName ?? null,

          bankAccountNumber:
            bankAccountNumber ?? null,

          mobileMoneyNumber:
            mobileMoneyNumber ?? null,

          status: "ACTIVE",
        },

        include: {
          manager: {
            select: {
              id: true,
              employeeNumber: true,
              firstName: true,
              middleName: true,
              lastName: true,
              jobTitle: true,
            },
          },
        },
      });

    return res.status(201).json({
      success: true,
      message:
        "Employee created successfully.",

      employee:
        serializeEmployee(employee),
    });
  } catch (error) {
    console.error(
      "[EMPLOYEES] Failed to create employee:",
      error
    );

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        success: false,
        code: "EMPLOYEE_DUPLICATE",
        message:
          "An employee with the same unique information already exists.",
      });
    }

    return res.status(500).json({
      success: false,
      code: "EMPLOYEE_CREATE_FAILED",
      message: "Failed to create employee.",
    });
  }
};

/* =========================================================
   UPDATE EMPLOYEE
   PATCH /api/employees/:id
========================================================= */

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

    /* -----------------------------------------------------
       Prevent employee from reporting to themselves
    ----------------------------------------------------- */

    if (
      req.body?.managerId !== undefined &&
      stringValue(req.body.managerId) === id
    ) {
      return res.status(400).json({
        success: false,
        code: "INVALID_MANAGER",
        message:
          "An employee cannot be their own manager.",
      });
    }

    const data: Prisma.EmployeeUpdateInput = {};

    /* -----------------------------------------------------
       Identity
    ----------------------------------------------------- */

    if (
      req.body?.firstName !== undefined
    ) {
      const firstName =
        stringValue(req.body.firstName);

      if (!firstName) {
        return res.status(400).json({
          success: false,
          code: "FIRST_NAME_REQUIRED",
          message:
            "First name cannot be empty.",
        });
      }

      data.firstName = firstName;
    }

    if (
      req.body?.middleName !== undefined
    ) {
      data.middleName =
        nullableString(
          req.body.middleName
        );
    }

    if (
      req.body?.lastName !== undefined
    ) {
      const lastName =
        stringValue(req.body.lastName);

      if (!lastName) {
        return res.status(400).json({
          success: false,
          code: "LAST_NAME_REQUIRED",
          message:
            "Last name cannot be empty.",
        });
      }

      data.lastName = lastName;
    }

    /* -----------------------------------------------------
       Contact
    ----------------------------------------------------- */

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
        nullableString(
          req.body.phoneNumber
        );
    }

    /* -----------------------------------------------------
       Personal
    ----------------------------------------------------- */

    if (
      req.body?.dateOfBirth !== undefined
    ) {
      const dateOfBirth =
        parseOptionalDate(
          req.body.dateOfBirth
        );

      if (
        dateOfBirth === null &&
        stringValue(
          req.body.dateOfBirth
        )
      ) {
        return res.status(400).json({
          success: false,
          code: "INVALID_DATE_OF_BIRTH",
          message:
            "Date of birth is invalid.",
        });
      }

      data.dateOfBirth =
        dateOfBirth ?? null;
    }

    if (
      req.body?.gender !== undefined
    ) {
      data.gender =
        nullableString(
          req.body.gender
        );
    }

    if (
      req.body?.maritalStatus !== undefined
    ) {
      data.maritalStatus =
        nullableString(
          req.body.maritalStatus
        );
    }

    if (
      req.body?.nationality !== undefined
    ) {
      data.nationality =
        nullableString(
          req.body.nationality
        );
    }

    if (
      req.body?.nationalId !== undefined
    ) {
      data.nationalId =
        nullableString(
          req.body.nationalId
        );
    }

    if (
      req.body?.passportNumber !== undefined
    ) {
      data.passportNumber =
        nullableString(
          req.body.passportNumber
        );
    }

    /* -----------------------------------------------------
       Address
    ----------------------------------------------------- */

    if (
      req.body?.address !== undefined
    ) {
      data.address =
        nullableString(
          req.body.address
        );
    }

    if (
      req.body?.city !== undefined
    ) {
      data.city =
        nullableString(
          req.body.city
        );
    }

    if (
      req.body?.county !== undefined
    ) {
      data.county =
        nullableString(
          req.body.county
        );
    }

    if (
      req.body?.postalCode !== undefined
    ) {
      data.postalCode =
        nullableString(
          req.body.postalCode
        );
    }

    /* -----------------------------------------------------
       Emergency contact
    ----------------------------------------------------- */

    if (
      req.body?.emergencyContactName !==
      undefined
    ) {
      data.emergencyContactName =
        nullableString(
          req.body.emergencyContactName
        );
    }

    if (
      req.body?.emergencyContactRelationship !==
      undefined
    ) {
      data.emergencyContactRelationship =
        nullableString(
          req.body
            .emergencyContactRelationship
        );
    }

    if (
      req.body?.emergencyContactPhone !==
      undefined
    ) {
      data.emergencyContactPhone =
        nullableString(
          req.body.emergencyContactPhone
        );
    }

    if (
      req.body?.emergencyContactEmail !==
      undefined
    ) {
      data.emergencyContactEmail =
        optionalString(
          req.body.emergencyContactEmail
        )?.toLowerCase() ?? null;
    }

    /* -----------------------------------------------------
       Employment
    ----------------------------------------------------- */

    if (
      req.body?.department !== undefined
    ) {
      data.department =
        nullableString(
          req.body.department
        );
    }

    if (
      req.body?.jobTitle !== undefined
    ) {
      data.jobTitle =
        nullableString(
          req.body.jobTitle
        );
    }

    if (
      req.body?.employmentType !==
      undefined
    ) {
      const employmentType =
        stringValue(
          req.body.employmentType
        );

      if (
        !isValidEmploymentType(
          employmentType
        )
      ) {
        return res.status(400).json({
          success: false,
          code: "INVALID_EMPLOYMENT_TYPE",
          message:
            "Invalid employment type.",
        });
      }

      data.employmentType =
        employmentType;
    }

    if (
      req.body?.hireDate !== undefined
    ) {
      const rawHireDate =
        stringValue(
          req.body.hireDate
        );

      if (!rawHireDate) {
        return res.status(400).json({
          success: false,
          code: "HIRE_DATE_REQUIRED",
          message:
            "Hire date cannot be empty.",
        });
      }

      const hireDate =
        new Date(rawHireDate);

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
      req.body?.probationEndDate !==
      undefined
    ) {
      const probationEndDate =
        parseOptionalDate(
          req.body.probationEndDate
        );

      if (
        probationEndDate === null &&
        stringValue(
          req.body.probationEndDate
        )
      ) {
        return res.status(400).json({
          success: false,
          code:
            "INVALID_PROBATION_END_DATE",
          message:
            "Probation end date is invalid.",
        });
      }

      data.probationEndDate =
        probationEndDate ?? null;
    }

    if (
      req.body?.terminationDate !==
      undefined
    ) {
      const terminationDate =
        parseOptionalDate(
          req.body.terminationDate
        );

      if (
        terminationDate === null &&
        stringValue(
          req.body.terminationDate
        )
      ) {
        return res.status(400).json({
          success: false,
          code:
            "INVALID_TERMINATION_DATE",
          message:
            "Termination date is invalid.",
        });
      }

      data.terminationDate =
        terminationDate ?? null;
    }

    if (
      req.body?.workLocation !==
      undefined
    ) {
      data.workLocation =
        nullableString(
          req.body.workLocation
        );
    }

    if (
      req.body?.employmentNotes !==
      undefined
    ) {
      data.employmentNotes =
        nullableString(
          req.body.employmentNotes
        );
    }

    /* -----------------------------------------------------
       Leadership designation
    ----------------------------------------------------- */

    if (req.body?.leadershipRole !== undefined) {
      const leadershipRole = nullableString(
        req.body.leadershipRole
      )?.toUpperCase() ?? null;

      if (
        leadershipRole !== null &&
        leadershipRole !== "MANAGER" &&
        leadershipRole !== "LEADER"
      ) {
        return res.status(400).json({
          success: false,
          code: "INVALID_LEADERSHIP_ROLE",
          message:
            "Leadership role must be MANAGER, LEADER, or null.",
        });
      }

      data.leadershipRole = leadershipRole;
    }

    /* -----------------------------------------------------
       Manager / reporting structure
    ----------------------------------------------------- */

    if (
      req.body?.managerId !== undefined
    ) {
      const managerId =
        optionalString(
          req.body.managerId
        );

      if (!managerId) {
        data.manager = {
          disconnect: true,
        };
      } else {
        const manager =
          await prisma.employee.findFirst({
            where: {
              id: managerId,
              organizationId:
                context.organizationId,
            },

            select: {
              id: true,
              leadershipRole: true,
            },
          });

        if (!manager) {
          return res.status(400).json({
            success: false,
            code: "INVALID_MANAGER",
            message:
              "The selected manager does not exist in this organization.",
          });
        }


        if (
          manager.leadershipRole !== "MANAGER" &&
          manager.leadershipRole !== "LEADER"
        ) {
          return res.status(400).json({
            success: false,
            code: "INVALID_MANAGER",
            message:
              "The selected employee is not designated as a manager or leader.",
          });
        }

        data.manager = {
          connect: {
            id: manager.id,
          },
        };
      }
    }

    /* -----------------------------------------------------
       Compensation
    ----------------------------------------------------- */

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

    /* -----------------------------------------------------
       Payment
    ----------------------------------------------------- */

    if (
      req.body?.paymentMethod !==
      undefined
    ) {
      const paymentMethod =
        optionalString(
          req.body.paymentMethod
        );

      if (
        paymentMethod &&
        !isValidPaymentMethod(
          paymentMethod
        )
      ) {
        return res.status(400).json({
          success: false,
          code: "INVALID_PAYMENT_METHOD",
          message:
            "Invalid payment method.",
        });
      }

      data.paymentMethod =
        paymentMethod ?? null;
    }

    if (
      req.body?.bankName !== undefined
    ) {
      data.bankName =
        nullableString(
          req.body.bankName
        );
    }

    if (
      req.body?.bankBranch !== undefined
    ) {
      data.bankBranch =
        nullableString(
          req.body.bankBranch
        );
    }

    if (
      req.body?.bankAccountName !==
      undefined
    ) {
      data.bankAccountName =
        nullableString(
          req.body.bankAccountName
        );
    }

    if (
      req.body?.bankAccountNumber !==
      undefined
    ) {
      data.bankAccountNumber =
        nullableString(
          req.body.bankAccountNumber
        );
    }

    if (
      req.body?.mobileMoneyNumber !==
      undefined
    ) {
      data.mobileMoneyNumber =
        nullableString(
          req.body.mobileMoneyNumber
        );
    }

    /* -----------------------------------------------------
       Status
    ----------------------------------------------------- */

    if (
      req.body?.status !== undefined
    ) {
      const nextStatus =
        stringValue(
          req.body.status
        ).toUpperCase();

      if (!isValidStatus(nextStatus)) {
        return res.status(400).json({
          success: false,
          code: "INVALID_EMPLOYEE_STATUS",
          message:
            "Invalid employee status.",
        });
      }

      data.status = nextStatus;
    }

    /* -----------------------------------------------------
       Prevent empty update
    ----------------------------------------------------- */

    if (
      Object.keys(data).length === 0
    ) {
      return res.status(400).json({
        success: false,
        code: "NO_UPDATE_FIELDS",
        message:
          "No employee fields were provided for update.",
      });
    }

    /* -----------------------------------------------------
       Update employee
    ----------------------------------------------------- */

    const employee =
      await prisma.employee.update({
        where: {
          id: existing.id,
        },

        data,

        include: {
          manager: {
            select: {
              id: true,
              employeeNumber: true,
              firstName: true,
              middleName: true,
              lastName: true,
              jobTitle: true,
            },
          },
        },
      });

    return res.status(200).json({
      success: true,
      message:
        "Employee updated successfully.",

      employee:
        serializeEmployee(employee),
    });
  } catch (error) {
    console.error(
      "[EMPLOYEES] Failed to update employee:",
      error
    );

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        success: false,
        code: "EMPLOYEE_DUPLICATE",
        message:
          "The employee information conflicts with an existing record.",
      });
    }

    return res.status(500).json({
      success: false,
      code: "EMPLOYEE_UPDATE_FAILED",
      message: "Failed to update employee.",
    });
  }
};

/* =========================================================
   DELETE EMPLOYEE
   DELETE /api/employees/:id
========================================================= */


/* =========================================================
   REPORTING STRUCTURE / ORGANIZATIONAL HIERARCHY
========================================================= */

export const getEmployeeHierarchy = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const context = getTenantContext(req);

    if (!context) {
      res.status(403).json({
        success: false,
        code: "TENANT_SESSION_REQUIRED",
        message: "A tenant session is required.",
      });
      return;
    }

    const employees = await prisma.employee.findMany({
      where: {
        organizationId: context.organizationId,
      },
      orderBy: [
        {
          firstName: "asc",
        },
        {
          lastName: "asc",
        },
      ],
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        middleName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        alternativePhone: true,
        department: true,
        jobTitle: true,
        employmentType: true,
        hireDate: true,
        status: true,
        managerId: true,
        leadershipRole: true,
        manager: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            middleName: true,
            lastName: true,
            jobTitle: true,
            department: true,
            status: true,
          },
        },
      },
    });

    const serializedEmployees = employees.map((employee) => ({
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      firstName: employee.firstName,
      middleName: employee.middleName,
      lastName: employee.lastName,
      name: [
        employee.firstName,
        employee.middleName,
        employee.lastName,
      ]
        .filter(Boolean)
        .join(" "),
      email: employee.email,
      phoneNumber: employee.phoneNumber,
      alternativePhone: employee.alternativePhone,
      department: employee.department,
      jobTitle: employee.jobTitle,
      employmentType: employee.employmentType,
      hireDate: employee.hireDate,
      status: employee.status,
      managerId: employee.managerId,
      leadershipRole: employee.leadershipRole,
      manager: employee.manager
        ? {
            id: employee.manager.id,
            employeeNumber:
              employee.manager.employeeNumber,
            firstName: employee.manager.firstName,
            middleName: employee.manager.middleName,
            lastName: employee.manager.lastName,
            name: [
              employee.manager.firstName,
              employee.manager.middleName,
              employee.manager.lastName,
            ]
              .filter(Boolean)
              .join(" "),
            jobTitle: employee.manager.jobTitle,
            department: employee.manager.department,
            status: employee.manager.status,
          }
        : null,
    }));

    const directReportCounts = new Map<string, number>();

    for (const employee of serializedEmployees) {
      if (employee.managerId) {
        directReportCounts.set(
          employee.managerId,
          (directReportCounts.get(employee.managerId) ?? 0) + 1
        );
      }
    }

    const result = serializedEmployees.map((employee) => ({
      ...employee,
      directReportCount:
        directReportCounts.get(employee.id) ?? 0,
    }));

    res.status(200).json({
      success: true,
      employees: result,
      count: result.length,
    });
  } catch (error) {
    console.error(
      "[EMPLOYEES] Failed to load reporting structure:",
      error
    );

    res.status(500).json({
      success: false,
      code: "EMPLOYEE_HIERARCHY_FETCH_FAILED",
      message: "Failed to load reporting structure.",
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
          organizationId:
            context.organizationId,
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

    /* -----------------------------------------------------
       Protect historical payroll data
    ----------------------------------------------------- */

    const payrollRecordCount =
      await prisma.payrollRecord.count({
        where: {
          employeeId: employee.id,
          organizationId:
            context.organizationId,
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

    /* -----------------------------------------------------
       Protect employees who are managers
    ----------------------------------------------------- */

    const directReportCount =
      await prisma.employee.count({
        where: {
          organizationId:
            context.organizationId,
          managerId: employee.id,
        },
      });

    if (directReportCount > 0) {
      return res.status(409).json({
        success: false,
        code: "EMPLOYEE_HAS_DIRECT_REPORTS",
        message:
          "This employee cannot be deleted because other employees report to them. Reassign those employees to another manager first.",
      });
    }

    /* -----------------------------------------------------
       Delete
    ----------------------------------------------------- */

    await prisma.employee.delete({
      where: {
        id: employee.id,
      },
    });

    return res.status(200).json({
      success: true,
      message:
        "Employee deleted successfully.",
    });
  } catch (error) {
    console.error(
      "[EMPLOYEES] Failed to delete employee:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "EMPLOYEE_DELETE_FAILED",
      message:
        "Failed to delete employee.",
    });
  }
};



