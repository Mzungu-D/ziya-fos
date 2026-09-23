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

    /* Statutory & Tax */
    kraPin: employee.kraPin,
    nssfNumber: employee.nssfNumber,
    shaNumber: employee.shaNumber,
    payeApplicable: employee.payeApplicable,
    housingLevyApplicable: employee.housingLevyApplicable,

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

function serializeEmployeeEarning(earning: any) {
  return {
    id: earning.id,
    employeeId: earning.employeeId,
    organizationId: earning.organizationId,
    type: earning.type,
    description: earning.description,
    amount: Number(earning.amount),
    recurring: Boolean(earning.recurring),
    taxable: Boolean(earning.taxable),
    effectiveFrom: earning.effectiveFrom,
    effectiveTo: earning.effectiveTo,
    status: earning.status,
    createdAt: earning.createdAt,
    updatedAt: earning.updatedAt,
  };
}

function parseBoolean(value: unknown, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return defaultValue;
}

function isValidEarningStatus(value: string): boolean {
  return value === 'ACTIVE' || value === 'INACTIVE';
}

function parseRequiredDate(value: unknown): Date | null {
  const raw = stringValue(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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

          earnings: {
            orderBy: [
              { status: "asc" },
              { effectiveFrom: "desc" },
              { createdAt: "desc" },
            ],
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
        earnings: employee.earnings.map(serializeEmployeeEarning),
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

    /* Statutory & Tax */
    const kraPin =
      optionalString(req.body?.kraPin);

    const nssfNumber =
      optionalString(req.body?.nssfNumber);

    const shaNumber =
      optionalString(req.body?.shaNumber);

    const payeApplicable =
      req.body?.payeApplicable !== undefined
        ? Boolean(req.body.payeApplicable)
        : true;

    const housingLevyApplicable =
      req.body?.housingLevyApplicable !== undefined
        ? Boolean(req.body.housingLevyApplicable)
        : true;

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

          /* Statutory & Tax */
          kraPin:
            kraPin ?? null,

          nssfNumber:
            nssfNumber ?? null,

          shaNumber:
            shaNumber ?? null,

          payeApplicable,

          housingLevyApplicable,

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
       Statutory & Tax
    ----------------------------------------------------- */

    if (req.body?.kraPin !== undefined) {
      data.kraPin =
        nullableString(req.body.kraPin);
    }

    if (req.body?.nssfNumber !== undefined) {
      data.nssfNumber =
        nullableString(req.body.nssfNumber);
    }

    if (req.body?.shaNumber !== undefined) {
      data.shaNumber =
        nullableString(req.body.shaNumber);
    }

    if (req.body?.payeApplicable !== undefined) {
      data.payeApplicable =
        Boolean(req.body.payeApplicable);
    }

    if (req.body?.housingLevyApplicable !== undefined) {
      data.housingLevyApplicable =
        Boolean(req.body.housingLevyApplicable);
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
   EMPLOYEE EARNINGS
   GET    /api/employees/:id/earnings
   POST   /api/employees/:id/earnings
   PATCH  /api/employees/:id/earnings/:earningId
   DELETE /api/employees/:id/earnings/:earningId
========================================================= */

export const getEmployeeEarnings = async (
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

    const employeeId = stringValue(req.params.id);

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        code: "EMPLOYEE_ID_REQUIRED",
        message: "Employee ID is required.",
      });
    }

    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        organizationId: context.organizationId,
      },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        middleName: true,
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

    const earnings = await prisma.employeeEarning.findMany({
      where: {
        employeeId,
        organizationId: context.organizationId,
      },
      orderBy: [
        { status: "asc" },
        { effectiveFrom: "desc" },
        { createdAt: "desc" },
      ],
    });

    return res.status(200).json({
      success: true,
      employee: {
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        name: [
          employee.firstName,
          employee.middleName,
          employee.lastName,
        ].filter(Boolean).join(" "),
      },
      earnings: earnings.map(serializeEmployeeEarning),
      count: earnings.length,
    });
  } catch (error) {
    console.error(
      "[EMPLOYEE EARNINGS] Failed to fetch employee earnings:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "EMPLOYEE_EARNINGS_FETCH_FAILED",
      message: "Failed to fetch employee earnings.",
    });
  }
};

export const createEmployeeEarning = async (
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

    const employeeId = stringValue(req.params.id);
    const type = stringValue(req.body?.type);
    const description = optionalString(req.body?.description);
    const amount = toNumber(req.body?.amount);
    const recurring = parseBoolean(req.body?.recurring, true);
    const taxable = parseBoolean(req.body?.taxable, true);
    const status = (
      stringValue(req.body?.status) || "ACTIVE"
    ).toUpperCase();

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        code: "EMPLOYEE_ID_REQUIRED",
        message: "Employee ID is required.",
      });
    }

    if (!type) {
      return res.status(400).json({
        success: false,
        code: "EARNING_TYPE_REQUIRED",
        message: "Earning type is required.",
      });
    }

    if (type.length > 100) {
      return res.status(400).json({
        success: false,
        code: "EARNING_TYPE_TOO_LONG",
        message: "Earning type must not exceed 100 characters.",
      });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        code: "INVALID_EARNING_AMOUNT",
        message: "Earning amount must be greater than zero.",
      });
    }

    if (!isValidEarningStatus(status)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_EARNING_STATUS",
        message: "Earning status must be ACTIVE or INACTIVE.",
      });
    }

    const effectiveFrom =
      req.body?.effectiveFrom !== undefined
        ? parseRequiredDate(req.body.effectiveFrom)
        : new Date();

    if (!effectiveFrom) {
      return res.status(400).json({
        success: false,
        code: "INVALID_EFFECTIVE_FROM",
        message: "Effective-from date is invalid.",
      });
    }

    const effectiveTo =
      req.body?.effectiveTo !== undefined
        ? parseOptionalDate(req.body.effectiveTo)
        : undefined;

    if (
      req.body?.effectiveTo !== undefined &&
      effectiveTo === null &&
      stringValue(req.body.effectiveTo)
    ) {
      return res.status(400).json({
        success: false,
        code: "INVALID_EFFECTIVE_TO",
        message: "Effective-to date is invalid.",
      });
    }

    if (
      effectiveTo &&
      effectiveFrom.getTime() > effectiveTo.getTime()
    ) {
      return res.status(400).json({
        success: false,
        code: "INVALID_EARNING_DATE_RANGE",
        message: "Effective-to date cannot be earlier than effective-from date.",
      });
    }

    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        organizationId: context.organizationId,
      },
      select: { id: true },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        code: "EMPLOYEE_NOT_FOUND",
        message: "Employee was not found.",
      });
    }

    const earning = await prisma.employeeEarning.create({
      data: {
        employeeId,
        organizationId: context.organizationId,
        type,
        description: description ?? null,
        amount,
        recurring,
        taxable,
        effectiveFrom,
        effectiveTo: effectiveTo ?? null,
        status,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Employee earning created successfully.",
      earning: serializeEmployeeEarning(earning),
    });
  } catch (error) {
    console.error(
      "[EMPLOYEE EARNINGS] Failed to create employee earning:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "EMPLOYEE_EARNING_CREATE_FAILED",
      message: "Failed to create employee earning.",
    });
  }
};

export const updateEmployeeEarning = async (
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

    const employeeId = stringValue(req.params.id);
    const earningId = stringValue(req.params.earningId);

    if (!employeeId || !earningId) {
      return res.status(400).json({
        success: false,
        code: "EARNING_IDENTIFIERS_REQUIRED",
        message: "Employee ID and earning ID are required.",
      });
    }

    const existing = await prisma.employeeEarning.findFirst({
      where: {
        id: earningId,
        employeeId,
        organizationId: context.organizationId,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        code: "EMPLOYEE_EARNING_NOT_FOUND",
        message: "Employee earning was not found.",
      });
    }

    const data: Prisma.EmployeeEarningUpdateInput = {};

    if (req.body?.type !== undefined) {
      const type = stringValue(req.body.type);

      if (!type) {
        return res.status(400).json({
          success: false,
          code: "EARNING_TYPE_REQUIRED",
          message: "Earning type cannot be empty.",
        });
      }

      if (type.length > 100) {
        return res.status(400).json({
          success: false,
          code: "EARNING_TYPE_TOO_LONG",
          message: "Earning type must not exceed 100 characters.",
        });
      }

      data.type = type;
    }

    if (req.body?.description !== undefined) {
      data.description = nullableString(req.body.description);
    }

    if (req.body?.amount !== undefined) {
      const amount = toNumber(req.body.amount);

      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({
          success: false,
          code: "INVALID_EARNING_AMOUNT",
          message: "Earning amount must be greater than zero.",
        });
      }

      data.amount = amount;
    }

    if (req.body?.recurring !== undefined) {
      data.recurring = parseBoolean(
        req.body.recurring,
        existing.recurring
      );
    }

    if (req.body?.taxable !== undefined) {
      data.taxable = parseBoolean(
        req.body.taxable,
        existing.taxable
      );
    }

    let effectiveFrom = existing.effectiveFrom;
    let effectiveTo = existing.effectiveTo;

    if (req.body?.effectiveFrom !== undefined) {
      const parsed = parseRequiredDate(req.body.effectiveFrom);

      if (!parsed) {
        return res.status(400).json({
          success: false,
          code: "INVALID_EFFECTIVE_FROM",
          message: "Effective-from date is invalid.",
        });
      }

      effectiveFrom = parsed;
      data.effectiveFrom = parsed;
    }

    if (req.body?.effectiveTo !== undefined) {
      const parsed = parseOptionalDate(req.body.effectiveTo);

      if (
        parsed === null &&
        stringValue(req.body.effectiveTo)
      ) {
        return res.status(400).json({
          success: false,
          code: "INVALID_EFFECTIVE_TO",
          message: "Effective-to date is invalid.",
        });
      }

      effectiveTo = parsed ?? null;
      data.effectiveTo = parsed ?? null;
    }

    if (
      effectiveTo &&
      effectiveFrom.getTime() > effectiveTo.getTime()
    ) {
      return res.status(400).json({
        success: false,
        code: "INVALID_EARNING_DATE_RANGE",
        message: "Effective-to date cannot be earlier than effective-from date.",
      });
    }

    if (req.body?.status !== undefined) {
      const status = stringValue(req.body.status).toUpperCase();

      if (!isValidEarningStatus(status)) {
        return res.status(400).json({
          success: false,
          code: "INVALID_EARNING_STATUS",
          message: "Earning status must be ACTIVE or INACTIVE.",
        });
      }

      data.status = status;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        code: "NO_UPDATE_FIELDS",
        message: "No earning fields were provided for update.",
      });
    }

    const earning = await prisma.employeeEarning.update({
      where: {
        id: existing.id,
      },
      data,
    });

    return res.status(200).json({
      success: true,
      message: "Employee earning updated successfully.",
      earning: serializeEmployeeEarning(earning),
    });
  } catch (error) {
    console.error(
      "[EMPLOYEE EARNINGS] Failed to update employee earning:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "EMPLOYEE_EARNING_UPDATE_FAILED",
      message: "Failed to update employee earning.",
    });
  }
};

export const deleteEmployeeEarning = async (
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

    const employeeId = stringValue(req.params.id);
    const earningId = stringValue(req.params.earningId);

    if (!employeeId || !earningId) {
      return res.status(400).json({
        success: false,
        code: "EARNING_IDENTIFIERS_REQUIRED",
        message: "Employee ID and earning ID are required.",
      });
    }

    const existing = await prisma.employeeEarning.findFirst({
      where: {
        id: earningId,
        employeeId,
        organizationId: context.organizationId,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        code: "EMPLOYEE_EARNING_NOT_FOUND",
        message: "Employee earning was not found.",
      });
    }

    await prisma.employeeEarning.delete({
      where: {
        id: existing.id,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Employee earning deleted successfully.",
    });
  } catch (error) {
    console.error(
      "[EMPLOYEE EARNINGS] Failed to delete employee earning:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "EMPLOYEE_EARNING_DELETE_FAILED",
      message: "Failed to delete employee earning.",
    });
  }
};


/* =========================================================
   EMPLOYEE LOANS
   GET    /api/employees/:id/loans
   POST   /api/employees/:id/loans
   PATCH  /api/employees/:id/loans/:loanId
   DELETE /api/employees/:id/loans/:loanId
========================================================= */

const VALID_FINANCIAL_LIABILITY_STATUSES = [
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
] as const;

function isValidFinancialLiabilityStatus(value: string): boolean {
  return VALID_FINANCIAL_LIABILITY_STATUSES.includes(
    value as (typeof VALID_FINANCIAL_LIABILITY_STATUSES)[number]
  );
}

function serializeEmployeeLoan(loan: any) {
  return {
    id: loan.id,
    employeeId: loan.employeeId,
    organizationId: loan.organizationId,
    reference: loan.reference,
    description: loan.description,
    principalAmount: Number(loan.principalAmount),
    outstandingBalance: Number(loan.outstandingBalance),
    monthlyRepayment: Number(loan.monthlyRepayment),
    startDate: loan.startDate,
    endDate: loan.endDate,
    status: loan.status,
    createdAt: loan.createdAt,
    updatedAt: loan.updatedAt,
  };
}

function serializeSalaryAdvance(advance: any) {
  return {
    id: advance.id,
    employeeId: advance.employeeId,
    organizationId: advance.organizationId,
    reference: advance.reference,
    amount: Number(advance.amount),
    outstandingBalance: Number(advance.outstandingBalance),
    monthlyRepayment: Number(advance.monthlyRepayment),
    issuedDate: advance.issuedDate,
    status: advance.status,
    notes: advance.notes,
    createdAt: advance.createdAt,
    updatedAt: advance.updatedAt,
  };
}

async function getTenantEmployee(
  employeeId: string,
  organizationId: string
) {
  return prisma.employee.findFirst({
    where: {
      id: employeeId,
      organizationId,
    },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      middleName: true,
      lastName: true,
      status: true,
    },
  });
}

export const getEmployeeLoans = async (
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

    const employeeId = stringValue(req.params.id);

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        code: "EMPLOYEE_ID_REQUIRED",
        message: "Employee ID is required.",
      });
    }

    const employee = await getTenantEmployee(
      employeeId,
      context.organizationId
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        code: "EMPLOYEE_NOT_FOUND",
        message: "Employee was not found.",
      });
    }

    const loans = await prisma.employeeLoan.findMany({
      where: {
        employeeId,
        organizationId: context.organizationId,
      },
      orderBy: [
        { status: "asc" },
        { startDate: "desc" },
        { createdAt: "desc" },
      ],
    });

    return res.status(200).json({
      success: true,
      employee: {
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        name: [
          employee.firstName,
          employee.middleName,
          employee.lastName,
        ]
          .filter(Boolean)
          .join(" "),
      },
      loans: loans.map(serializeEmployeeLoan),
      count: loans.length,
    });
  } catch (error) {
    console.error(
      "[EMPLOYEE LOANS] Failed to fetch employee loans:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "EMPLOYEE_LOANS_FETCH_FAILED",
      message: "Failed to fetch employee loans.",
    });
  }
};

export const createEmployeeLoan = async (
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

    const employeeId = stringValue(req.params.id);
    const reference = stringValue(req.body?.reference);
    const description = optionalString(req.body?.description);
    const principalAmount = toNumber(req.body?.principalAmount);
    const monthlyRepayment = toNumber(req.body?.monthlyRepayment);
    const status = (
      stringValue(req.body?.status) || "ACTIVE"
    ).toUpperCase();
    const startDate =
      req.body?.startDate !== undefined
        ? parseRequiredDate(req.body.startDate)
        : new Date();
    const endDate =
      req.body?.endDate !== undefined
        ? parseOptionalDate(req.body.endDate)
        : undefined;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        code: "EMPLOYEE_ID_REQUIRED",
        message: "Employee ID is required.",
      });
    }

    if (!reference) {
      return res.status(400).json({
        success: false,
        code: "LOAN_REFERENCE_REQUIRED",
        message: "Loan reference is required.",
      });
    }

    if (reference.length > 100) {
      return res.status(400).json({
        success: false,
        code: "LOAN_REFERENCE_TOO_LONG",
        message: "Loan reference must not exceed 100 characters.",
      });
    }

    if (!Number.isFinite(principalAmount) || principalAmount <= 0) {
      return res.status(400).json({
        success: false,
        code: "INVALID_LOAN_PRINCIPAL",
        message: "Loan principal must be greater than zero.",
      });
    }

    if (!Number.isFinite(monthlyRepayment) || monthlyRepayment <= 0) {
      return res.status(400).json({
        success: false,
        code: "INVALID_LOAN_REPAYMENT",
        message: "Monthly loan repayment must be greater than zero.",
      });
    }

    if (monthlyRepayment > principalAmount) {
      return res.status(400).json({
        success: false,
        code: "LOAN_REPAYMENT_EXCEEDS_PRINCIPAL",
        message: "Monthly repayment cannot exceed the loan principal.",
      });
    }

    if (!startDate) {
      return res.status(400).json({
        success: false,
        code: "INVALID_LOAN_START_DATE",
        message: "Loan start date is invalid.",
      });
    }

    if (
      req.body?.endDate !== undefined &&
      endDate === null &&
      stringValue(req.body.endDate)
    ) {
      return res.status(400).json({
        success: false,
        code: "INVALID_LOAN_END_DATE",
        message: "Loan end date is invalid.",
      });
    }

    if (endDate && startDate.getTime() > endDate.getTime()) {
      return res.status(400).json({
        success: false,
        code: "INVALID_LOAN_DATE_RANGE",
        message: "Loan end date cannot be earlier than start date.",
      });
    }

    if (!isValidFinancialLiabilityStatus(status)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_LOAN_STATUS",
        message: "Loan status must be ACTIVE, COMPLETED, or CANCELLED.",
      });
    }

    if (status === "COMPLETED" && principalAmount > 0) {
      return res.status(400).json({
        success: false,
        code: "INVALID_COMPLETED_LOAN",
        message: "A newly created loan cannot be marked COMPLETED while it has an outstanding balance.",
      });
    }

    const employee = await getTenantEmployee(
      employeeId,
      context.organizationId
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        code: "EMPLOYEE_NOT_FOUND",
        message: "Employee was not found.",
      });
    }

    const duplicate = await prisma.employeeLoan.findFirst({
      where: {
        organizationId: context.organizationId,
        reference,
      },
      select: { id: true },
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        code: "LOAN_REFERENCE_EXISTS",
        message: "A loan with this reference already exists in this organization.",
      });
    }

    const loan = await prisma.employeeLoan.create({
      data: {
        employeeId,
        organizationId: context.organizationId,
        reference,
        description: description ?? null,
        principalAmount,
        outstandingBalance: principalAmount,
        monthlyRepayment,
        startDate,
        endDate: endDate ?? null,
        status,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Employee loan created successfully.",
      loan: serializeEmployeeLoan(loan),
    });
  } catch (error) {
    console.error(
      "[EMPLOYEE LOANS] Failed to create employee loan:",
      error
    );

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        success: false,
        code: "LOAN_REFERENCE_EXISTS",
        message: "A loan with this reference already exists in this organization.",
      });
    }

    return res.status(500).json({
      success: false,
      code: "EMPLOYEE_LOAN_CREATE_FAILED",
      message: "Failed to create employee loan.",
    });
  }
};

export const updateEmployeeLoan = async (
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

    const employeeId = stringValue(req.params.id);
    const loanId = stringValue(req.params.loanId);

    if (!employeeId || !loanId) {
      return res.status(400).json({
        success: false,
        code: "LOAN_IDENTIFIERS_REQUIRED",
        message: "Employee ID and loan ID are required.",
      });
    }

    const existing = await prisma.employeeLoan.findFirst({
      where: {
        id: loanId,
        employeeId,
        organizationId: context.organizationId,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        code: "EMPLOYEE_LOAN_NOT_FOUND",
        message: "Employee loan was not found.",
      });
    }

    const data: Prisma.EmployeeLoanUpdateInput = {};

    let principalAmount = Number(existing.principalAmount);
    let outstandingBalance = Number(existing.outstandingBalance);
    let monthlyRepayment = Number(existing.monthlyRepayment);
    let startDate = existing.startDate;
    let endDate = existing.endDate;

    if (req.body?.reference !== undefined) {
      const reference = stringValue(req.body.reference);

      if (!reference) {
        return res.status(400).json({
          success: false,
          code: "LOAN_REFERENCE_REQUIRED",
          message: "Loan reference cannot be empty.",
        });
      }

      if (reference.length > 100) {
        return res.status(400).json({
          success: false,
          code: "LOAN_REFERENCE_TOO_LONG",
          message: "Loan reference must not exceed 100 characters.",
        });
      }

      const duplicate = await prisma.employeeLoan.findFirst({
        where: {
          organizationId: context.organizationId,
          reference,
          NOT: { id: existing.id },
        },
        select: { id: true },
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          code: "LOAN_REFERENCE_EXISTS",
          message: "A loan with this reference already exists in this organization.",
        });
      }

      data.reference = reference;
    }

    if (req.body?.description !== undefined) {
      data.description = nullableString(req.body.description);
    }

    if (req.body?.principalAmount !== undefined) {
      principalAmount = toNumber(req.body.principalAmount);

      if (!Number.isFinite(principalAmount) || principalAmount <= 0) {
        return res.status(400).json({
          success: false,
          code: "INVALID_LOAN_PRINCIPAL",
          message: "Loan principal must be greater than zero.",
        });
      }

      if (outstandingBalance > principalAmount) {
        return res.status(400).json({
          success: false,
          code: "LOAN_PRINCIPAL_BELOW_BALANCE",
          message: "Loan principal cannot be lower than the outstanding balance.",
        });
      }

      data.principalAmount = principalAmount;
    }

    if (req.body?.outstandingBalance !== undefined) {
      outstandingBalance = toNumber(req.body.outstandingBalance);

      if (!Number.isFinite(outstandingBalance) || outstandingBalance < 0) {
        return res.status(400).json({
          success: false,
          code: "INVALID_LOAN_BALANCE",
          message: "Outstanding loan balance must be a valid non-negative amount.",
        });
      }

      if (outstandingBalance > principalAmount) {
        return res.status(400).json({
          success: false,
          code: "LOAN_BALANCE_EXCEEDS_PRINCIPAL",
          message: "Outstanding balance cannot exceed the loan principal.",
        });
      }

      data.outstandingBalance = outstandingBalance;
    }

    if (req.body?.monthlyRepayment !== undefined) {
      monthlyRepayment = toNumber(req.body.monthlyRepayment);

      if (!Number.isFinite(monthlyRepayment) || monthlyRepayment <= 0) {
        return res.status(400).json({
          success: false,
          code: "INVALID_LOAN_REPAYMENT",
          message: "Monthly loan repayment must be greater than zero.",
        });
      }

      if (monthlyRepayment > principalAmount) {
        return res.status(400).json({
          success: false,
          code: "LOAN_REPAYMENT_EXCEEDS_PRINCIPAL",
          message: "Monthly repayment cannot exceed the loan principal.",
        });
      }

      data.monthlyRepayment = monthlyRepayment;
    }

    if (req.body?.startDate !== undefined) {
      const parsed = parseRequiredDate(req.body.startDate);

      if (!parsed) {
        return res.status(400).json({
          success: false,
          code: "INVALID_LOAN_START_DATE",
          message: "Loan start date is invalid.",
        });
      }

      startDate = parsed;
      data.startDate = parsed;
    }

    if (req.body?.endDate !== undefined) {
      const parsed = parseOptionalDate(req.body.endDate);

      if (
        parsed === null &&
        stringValue(req.body.endDate)
      ) {
        return res.status(400).json({
          success: false,
          code: "INVALID_LOAN_END_DATE",
          message: "Loan end date is invalid.",
        });
      }

      endDate = parsed ?? null;
      data.endDate = parsed ?? null;
    }

    if (endDate && startDate.getTime() > endDate.getTime()) {
      return res.status(400).json({
        success: false,
        code: "INVALID_LOAN_DATE_RANGE",
        message: "Loan end date cannot be earlier than start date.",
      });
    }

    if (req.body?.status !== undefined) {
      const status = stringValue(req.body.status).toUpperCase();

      if (!isValidFinancialLiabilityStatus(status)) {
        return res.status(400).json({
          success: false,
          code: "INVALID_LOAN_STATUS",
          message: "Loan status must be ACTIVE, COMPLETED, or CANCELLED.",
        });
      }

      if (status === "COMPLETED" && outstandingBalance > 0) {
        return res.status(400).json({
          success: false,
          code: "LOAN_BALANCE_REMAINING",
          message: "A loan can only be marked COMPLETED when its outstanding balance is zero.",
        });
      }

      data.status = status;
    } else if (outstandingBalance === 0) {
      data.status = "COMPLETED";
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        code: "NO_UPDATE_FIELDS",
        message: "No loan fields were provided for update.",
      });
    }

    const loan = await prisma.employeeLoan.update({
      where: { id: existing.id },
      data,
    });

    return res.status(200).json({
      success: true,
      message: "Employee loan updated successfully.",
      loan: serializeEmployeeLoan(loan),
    });
  } catch (error) {
    console.error(
      "[EMPLOYEE LOANS] Failed to update employee loan:",
      error
    );

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        success: false,
        code: "LOAN_REFERENCE_EXISTS",
        message: "A loan with this reference already exists in this organization.",
      });
    }

    return res.status(500).json({
      success: false,
      code: "EMPLOYEE_LOAN_UPDATE_FAILED",
      message: "Failed to update employee loan.",
    });
  }
};

export const deleteEmployeeLoan = async (
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

    const employeeId = stringValue(req.params.id);
    const loanId = stringValue(req.params.loanId);

    if (!employeeId || !loanId) {
      return res.status(400).json({
        success: false,
        code: "LOAN_IDENTIFIERS_REQUIRED",
        message: "Employee ID and loan ID are required.",
      });
    }

    const existing = await prisma.employeeLoan.findFirst({
      where: {
        id: loanId,
        employeeId,
        organizationId: context.organizationId,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        code: "EMPLOYEE_LOAN_NOT_FOUND",
        message: "Employee loan was not found.",
      });
    }

    const principalAmount = Number(existing.principalAmount);
    const outstandingBalance = Number(existing.outstandingBalance);

    if (
      outstandingBalance < principalAmount &&
      existing.status !== "CANCELLED"
    ) {
      return res.status(409).json({
        success: false,
        code: "LOAN_HAS_REPAYMENT_HISTORY",
        message: "This loan has repayment history and cannot be deleted. Mark it as CANCELLED or COMPLETED instead.",
      });
    }

    await prisma.employeeLoan.delete({
      where: { id: existing.id },
    });

    return res.status(200).json({
      success: true,
      message: "Employee loan deleted successfully.",
    });
  } catch (error) {
    console.error(
      "[EMPLOYEE LOANS] Failed to delete employee loan:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "EMPLOYEE_LOAN_DELETE_FAILED",
      message: "Failed to delete employee loan.",
    });
  }
};

/* =========================================================
   SALARY ADVANCES
   GET    /api/employees/:id/salary-advances
   POST   /api/employees/:id/salary-advances
   PATCH  /api/employees/:id/salary-advances/:advanceId
   DELETE /api/employees/:id/salary-advances/:advanceId
========================================================= */

export const getEmployeeSalaryAdvances = async (
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

    const employeeId = stringValue(req.params.id);

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        code: "EMPLOYEE_ID_REQUIRED",
        message: "Employee ID is required.",
      });
    }

    const employee = await getTenantEmployee(
      employeeId,
      context.organizationId
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        code: "EMPLOYEE_NOT_FOUND",
        message: "Employee was not found.",
      });
    }

    const advances = await prisma.salaryAdvance.findMany({
      where: {
        employeeId,
        organizationId: context.organizationId,
      },
      orderBy: [
        { status: "asc" },
        { issuedDate: "desc" },
        { createdAt: "desc" },
      ],
    });

    return res.status(200).json({
      success: true,
      employee: {
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        name: [
          employee.firstName,
          employee.middleName,
          employee.lastName,
        ]
          .filter(Boolean)
          .join(" "),
      },
      salaryAdvances: advances.map(serializeSalaryAdvance),
      count: advances.length,
    });
  } catch (error) {
    console.error(
      "[SALARY ADVANCES] Failed to fetch employee salary advances:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "SALARY_ADVANCES_FETCH_FAILED",
      message: "Failed to fetch employee salary advances.",
    });
  }
};

export const createEmployeeSalaryAdvance = async (
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

    const employeeId = stringValue(req.params.id);
    const reference = stringValue(req.body?.reference);
    const amount = toNumber(req.body?.amount);
    const monthlyRepayment = toNumber(req.body?.monthlyRepayment);
    const notes = optionalString(req.body?.notes);
    const status = (
      stringValue(req.body?.status) || "ACTIVE"
    ).toUpperCase();
    const issuedDate =
      req.body?.issuedDate !== undefined
        ? parseRequiredDate(req.body.issuedDate)
        : new Date();

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        code: "EMPLOYEE_ID_REQUIRED",
        message: "Employee ID is required.",
      });
    }

    if (!reference) {
      return res.status(400).json({
        success: false,
        code: "ADVANCE_REFERENCE_REQUIRED",
        message: "Salary advance reference is required.",
      });
    }

    if (reference.length > 100) {
      return res.status(400).json({
        success: false,
        code: "ADVANCE_REFERENCE_TOO_LONG",
        message: "Salary advance reference must not exceed 100 characters.",
      });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        code: "INVALID_ADVANCE_AMOUNT",
        message: "Salary advance amount must be greater than zero.",
      });
    }

    if (!Number.isFinite(monthlyRepayment) || monthlyRepayment <= 0) {
      return res.status(400).json({
        success: false,
        code: "INVALID_ADVANCE_REPAYMENT",
        message: "Monthly salary advance repayment must be greater than zero.",
      });
    }

    if (monthlyRepayment > amount) {
      return res.status(400).json({
        success: false,
        code: "ADVANCE_REPAYMENT_EXCEEDS_AMOUNT",
        message: "Monthly repayment cannot exceed the salary advance amount.",
      });
    }

    if (!issuedDate) {
      return res.status(400).json({
        success: false,
        code: "INVALID_ADVANCE_ISSUED_DATE",
        message: "Salary advance issue date is invalid.",
      });
    }

    if (!isValidFinancialLiabilityStatus(status)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_ADVANCE_STATUS",
        message: "Salary advance status must be ACTIVE, COMPLETED, or CANCELLED.",
      });
    }

    if (status === "COMPLETED") {
      return res.status(400).json({
        success: false,
        code: "INVALID_COMPLETED_ADVANCE",
        message: "A newly created salary advance cannot be marked COMPLETED while it has an outstanding balance.",
      });
    }

    const employee = await getTenantEmployee(
      employeeId,
      context.organizationId
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        code: "EMPLOYEE_NOT_FOUND",
        message: "Employee was not found.",
      });
    }

    const duplicate = await prisma.salaryAdvance.findFirst({
      where: {
        organizationId: context.organizationId,
        reference,
      },
      select: { id: true },
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        code: "ADVANCE_REFERENCE_EXISTS",
        message: "A salary advance with this reference already exists in this organization.",
      });
    }

    const advance = await prisma.salaryAdvance.create({
      data: {
        employeeId,
        organizationId: context.organizationId,
        reference,
        amount,
        outstandingBalance: amount,
        monthlyRepayment,
        issuedDate,
        status,
        notes: notes ?? null,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Salary advance created successfully.",
      salaryAdvance: serializeSalaryAdvance(advance),
    });
  } catch (error) {
    console.error(
      "[SALARY ADVANCES] Failed to create salary advance:",
      error
    );

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        success: false,
        code: "ADVANCE_REFERENCE_EXISTS",
        message: "A salary advance with this reference already exists in this organization.",
      });
    }

    return res.status(500).json({
      success: false,
      code: "SALARY_ADVANCE_CREATE_FAILED",
      message: "Failed to create salary advance.",
    });
  }
};

export const updateEmployeeSalaryAdvance = async (
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

    const employeeId = stringValue(req.params.id);
    const advanceId = stringValue(req.params.advanceId);

    if (!employeeId || !advanceId) {
      return res.status(400).json({
        success: false,
        code: "ADVANCE_IDENTIFIERS_REQUIRED",
        message: "Employee ID and salary advance ID are required.",
      });
    }

    const existing = await prisma.salaryAdvance.findFirst({
      where: {
        id: advanceId,
        employeeId,
        organizationId: context.organizationId,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        code: "SALARY_ADVANCE_NOT_FOUND",
        message: "Salary advance was not found.",
      });
    }

    const data: Prisma.SalaryAdvanceUpdateInput = {};

    let amount = Number(existing.amount);
    let outstandingBalance = Number(existing.outstandingBalance);
    let monthlyRepayment = Number(existing.monthlyRepayment);
    let issuedDate = existing.issuedDate;

    if (req.body?.reference !== undefined) {
      const reference = stringValue(req.body.reference);

      if (!reference) {
        return res.status(400).json({
          success: false,
          code: "ADVANCE_REFERENCE_REQUIRED",
          message: "Salary advance reference cannot be empty.",
        });
      }

      if (reference.length > 100) {
        return res.status(400).json({
          success: false,
          code: "ADVANCE_REFERENCE_TOO_LONG",
          message: "Salary advance reference must not exceed 100 characters.",
        });
      }

      const duplicate = await prisma.salaryAdvance.findFirst({
        where: {
          organizationId: context.organizationId,
          reference,
          NOT: { id: existing.id },
        },
        select: { id: true },
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          code: "ADVANCE_REFERENCE_EXISTS",
          message: "A salary advance with this reference already exists in this organization.",
        });
      }

      data.reference = reference;
    }

    if (req.body?.amount !== undefined) {
      amount = toNumber(req.body.amount);

      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({
          success: false,
          code: "INVALID_ADVANCE_AMOUNT",
          message: "Salary advance amount must be greater than zero.",
        });
      }

      if (outstandingBalance > amount) {
        return res.status(400).json({
          success: false,
          code: "ADVANCE_AMOUNT_BELOW_BALANCE",
          message: "Salary advance amount cannot be lower than the outstanding balance.",
        });
      }

      data.amount = amount;
    }

    if (req.body?.outstandingBalance !== undefined) {
      outstandingBalance = toNumber(req.body.outstandingBalance);

      if (!Number.isFinite(outstandingBalance) || outstandingBalance < 0) {
        return res.status(400).json({
          success: false,
          code: "INVALID_ADVANCE_BALANCE",
          message: "Outstanding salary advance balance must be a valid non-negative amount.",
        });
      }

      if (outstandingBalance > amount) {
        return res.status(400).json({
          success: false,
          code: "ADVANCE_BALANCE_EXCEEDS_AMOUNT",
          message: "Outstanding balance cannot exceed the salary advance amount.",
        });
      }

      data.outstandingBalance = outstandingBalance;
    }

    if (req.body?.monthlyRepayment !== undefined) {
      monthlyRepayment = toNumber(req.body.monthlyRepayment);

      if (!Number.isFinite(monthlyRepayment) || monthlyRepayment <= 0) {
        return res.status(400).json({
          success: false,
          code: "INVALID_ADVANCE_REPAYMENT",
          message: "Monthly salary advance repayment must be greater than zero.",
        });
      }

      if (monthlyRepayment > amount) {
        return res.status(400).json({
          success: false,
          code: "ADVANCE_REPAYMENT_EXCEEDS_AMOUNT",
          message: "Monthly repayment cannot exceed the salary advance amount.",
        });
      }

      data.monthlyRepayment = monthlyRepayment;
    }

    if (req.body?.issuedDate !== undefined) {
      const parsed = parseRequiredDate(req.body.issuedDate);

      if (!parsed) {
        return res.status(400).json({
          success: false,
          code: "INVALID_ADVANCE_ISSUED_DATE",
          message: "Salary advance issue date is invalid.",
        });
      }

      issuedDate = parsed;
      data.issuedDate = parsed;
    }

    if (req.body?.notes !== undefined) {
      data.notes = nullableString(req.body.notes);
    }

    if (req.body?.status !== undefined) {
      const status = stringValue(req.body.status).toUpperCase();

      if (!isValidFinancialLiabilityStatus(status)) {
        return res.status(400).json({
          success: false,
          code: "INVALID_ADVANCE_STATUS",
          message: "Salary advance status must be ACTIVE, COMPLETED, or CANCELLED.",
        });
      }

      if (status === "COMPLETED" && outstandingBalance > 0) {
        return res.status(400).json({
          success: false,
          code: "ADVANCE_BALANCE_REMAINING",
          message: "A salary advance can only be marked COMPLETED when its outstanding balance is zero.",
        });
      }

      data.status = status;
    } else if (outstandingBalance === 0) {
      data.status = "COMPLETED";
    }

    void issuedDate;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        code: "NO_UPDATE_FIELDS",
        message: "No salary advance fields were provided for update.",
      });
    }

    const advance = await prisma.salaryAdvance.update({
      where: { id: existing.id },
      data,
    });

    return res.status(200).json({
      success: true,
      message: "Salary advance updated successfully.",
      salaryAdvance: serializeSalaryAdvance(advance),
    });
  } catch (error) {
    console.error(
      "[SALARY ADVANCES] Failed to update salary advance:",
      error
    );

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({
        success: false,
        code: "ADVANCE_REFERENCE_EXISTS",
        message: "A salary advance with this reference already exists in this organization.",
      });
    }

    return res.status(500).json({
      success: false,
      code: "SALARY_ADVANCE_UPDATE_FAILED",
      message: "Failed to update salary advance.",
    });
  }
};

export const deleteEmployeeSalaryAdvance = async (
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

    const employeeId = stringValue(req.params.id);
    const advanceId = stringValue(req.params.advanceId);

    if (!employeeId || !advanceId) {
      return res.status(400).json({
        success: false,
        code: "ADVANCE_IDENTIFIERS_REQUIRED",
        message: "Employee ID and salary advance ID are required.",
      });
    }

    const existing = await prisma.salaryAdvance.findFirst({
      where: {
        id: advanceId,
        employeeId,
        organizationId: context.organizationId,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        code: "SALARY_ADVANCE_NOT_FOUND",
        message: "Salary advance was not found.",
      });
    }

    const amount = Number(existing.amount);
    const outstandingBalance = Number(existing.outstandingBalance);

    if (
      outstandingBalance < amount &&
      existing.status !== "CANCELLED"
    ) {
      return res.status(409).json({
        success: false,
        code: "ADVANCE_HAS_REPAYMENT_HISTORY",
        message: "This salary advance has repayment history and cannot be deleted. Mark it as CANCELLED or COMPLETED instead.",
      });
    }

    await prisma.salaryAdvance.delete({
      where: { id: existing.id },
    });

    return res.status(200).json({
      success: true,
      message: "Salary advance deleted successfully.",
    });
  } catch (error) {
    console.error(
      "[SALARY ADVANCES] Failed to delete salary advance:",
      error
    );

    return res.status(500).json({
      success: false,
      code: "SALARY_ADVANCE_DELETE_FAILED",
      message: "Failed to delete salary advance.",
    });
  }
};

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



