import prisma from "../config/prisma";

/* =========================================================
   FRAUD DETECTION SERVICE

   All fraud detection is tenant-scoped through organizationId.

   Current detection rules:
   1. Duplicate M-Pesa receipts
   2. Unusually large expenses
   3. Payroll anomalies

   This is the deterministic foundation.
   ML-based detection can be added later.
========================================================= */

/* =========================================================
   ALERT RESULT TYPE
========================================================= */

type FraudAlertResult =
  Awaited<
    ReturnType<
      typeof createOrUpdateAlert
    >
  >;

/* =========================================================
   CREATE OR UPDATE ALERT
========================================================= */

async function createOrUpdateAlert(params: {
  organizationId: string;
  alertCode: string;
  type: string;
  description: string;
  severity: string;
  riskScore: number;
  sourceType: string;
  sourceId?: string | null;
  amount?: number | null;
}) {
  return prisma.fraudAlert.upsert({
    where: {
      organizationId_alertCode: {
        organizationId:
          params.organizationId,
        alertCode:
          params.alertCode,
      },
    },

    update: {
      type: params.type,
      description:
        params.description,
      severity:
        params.severity,
      riskScore:
        params.riskScore,
      sourceType:
        params.sourceType,
      sourceId:
        params.sourceId ?? null,
      amount:
        params.amount ?? null,
    },

    create: {
      organizationId:
        params.organizationId,
      alertCode:
        params.alertCode,
      type: params.type,
      description:
        params.description,
      severity:
        params.severity,
      status: "OPEN",
      riskScore:
        params.riskScore,
      sourceType:
        params.sourceType,
      sourceId:
        params.sourceId ?? null,
      amount:
        params.amount ?? null,
    },
  });
}

/* =========================================================
   DUPLICATE M-PESA PAYMENTS
========================================================= */

async function detectDuplicatePayments(
  organizationId: string
): Promise<FraudAlertResult[]> {
  const transactions =
    await prisma.mpesaTransaction.findMany({
      where: {
        organizationId,

        mpesaReceiptNumber: {
          not: null,
        },
      },

      select: {
        id: true,
        mpesaReceiptNumber: true,
        amount: true,
      },

      orderBy: {
        createdAt: "desc",
      },
    });

  const grouped =
    new Map<
      string,
      typeof transactions
    >();

  for (const transaction of transactions) {
    if (
      !transaction.mpesaReceiptNumber
    ) {
      continue;
    }

    const existing =
      grouped.get(
        transaction.mpesaReceiptNumber
      ) ?? [];

    existing.push(transaction);

    grouped.set(
      transaction.mpesaReceiptNumber,
      existing
    );
  }

  const alerts: FraudAlertResult[] =
    [];

  for (const [
    receipt,
    duplicateTransactions,
  ] of grouped.entries()) {
    if (
      duplicateTransactions.length < 2
    ) {
      continue;
    }

    const totalAmount =
      duplicateTransactions.reduce(
        (total, transaction) =>
          total + transaction.amount,
        0
      );

    const firstTransaction =
      duplicateTransactions[0];

    alerts.push(
      await createOrUpdateAlert({
        organizationId,

        alertCode:
          `DUP-MPESA-${receipt}`,

        type:
          "Duplicate Payment",

        description:
          `M-Pesa receipt ${receipt} appears multiple times.`,

        severity:
          "HIGH",

        riskScore:
          90,

        sourceType:
          "MPESA_TRANSACTION",

        sourceId:
          firstTransaction?.id ?? null,

        amount:
          totalAmount,
      })
    );
  }

  return alerts;
}

/* =========================================================
   UNUSUAL EXPENSES
========================================================= */

async function detectUnusualExpenses(
  organizationId: string
): Promise<FraudAlertResult[]> {
  const expenses =
    await prisma.expense.findMany({
      where: {
        organizationId,
      },

      select: {
        id: true,
        expenseCode: true,
        amount: true,
      },

      orderBy: {
        expenseDate: "desc",
      },
    });

  if (expenses.length < 2) {
    return [];
  }

  const total =
    expenses.reduce(
      (sum, expense) =>
        sum + expense.amount,
      0
    );

  const average =
    total / expenses.length;

  if (average <= 0) {
    return [];
  }

  const alerts: FraudAlertResult[] =
    [];

  for (const expense of expenses) {
    const ratio =
      expense.amount / average;

    /*
     * Consider an expense suspicious when it is
     * at least 2.5 times the organization's average.
     */

    if (ratio < 2.5) {
      continue;
    }

    const riskScore =
      Math.min(
        95,
        Math.round(
          45 +
            (ratio - 2.5) * 15
        )
      );

    const severity =
      riskScore >= 75
        ? "HIGH"
        : riskScore >= 40
        ? "MEDIUM"
        : "LOW";

    alerts.push(
      await createOrUpdateAlert({
        organizationId,

        alertCode:
          `EXP-${expense.expenseCode}`,

        type:
          "Unusual Expense",

        description:
          `Expense ${expense.expenseCode} is significantly above the organization's average expense amount.`,

        severity,

        riskScore,

        sourceType:
          "EXPENSE",

        sourceId:
          expense.id,

        amount:
          expense.amount,
      })
    );
  }

  return alerts;
}

/* =========================================================
   PAYROLL ANOMALIES
========================================================= */

async function detectPayrollAnomalies(
  organizationId: string
): Promise<FraudAlertResult[]> {
  const payrollRecords =
    await prisma.payrollRecord.findMany({
      where: {
        organizationId,
      },

      select: {
        id: true,
        employeeId: true,
        basicSalary: true,
        grossSalary: true,

        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });

  const alerts: FraudAlertResult[] =
    [];

  for (const record of payrollRecords) {
    const basicSalary =
      Number(
        record.basicSalary
      );

    const grossSalary =
      Number(
        record.grossSalary
      );

    if (
      basicSalary <= 0 ||
      grossSalary <= 0
    ) {
      continue;
    }

    /*
     * A gross salary more than 25% above the
     * recorded basic salary is flagged.
     */

    const ratio =
      grossSalary /
      basicSalary;

    if (ratio < 1.25) {
      continue;
    }

    const increasePercentage =
      Math.round(
        (ratio - 1) * 100
      );

    const riskScore =
      Math.min(
        90,
        40 +
          increasePercentage
      );

    const severity =
      riskScore >= 75
        ? "HIGH"
        : riskScore >= 40
        ? "MEDIUM"
        : "LOW";

    const employeeName =
      `${record.employee.firstName} ${record.employee.lastName}`;

    alerts.push(
      await createOrUpdateAlert({
        organizationId,

        alertCode:
          `PAYROLL-${record.id}`,

        type:
          "Payroll Anomaly",

        description:
          `Payroll for ${employeeName} is ${increasePercentage}% above the recorded basic salary.`,

        severity,

        riskScore,

        sourceType:
          "PAYROLL_RECORD",

        sourceId:
          record.id,

        amount:
          grossSalary,
      })
    );
  }

  return alerts;
}

/* =========================================================
   RUN FRAUD DETECTION
========================================================= */

export async function detectFraudAlerts(
  organizationId: string
) {
  if (!organizationId) {
    throw new Error(
      "Organization ID is required."
    );
  }

  await Promise.all([
    detectDuplicatePayments(
      organizationId
    ),

    detectUnusualExpenses(
      organizationId
    ),

    detectPayrollAnomalies(
      organizationId
    ),
  ]);

  return getFraudAlerts(
    organizationId
  );
}

/* =========================================================
   GET ALERTS
========================================================= */

export async function getFraudAlerts(
  organizationId: string
) {
  if (!organizationId) {
    throw new Error(
      "Organization ID is required."
    );
  }

  return prisma.fraudAlert.findMany({
    where: {
      organizationId,
    },

    orderBy: {
      detectedAt: "desc",
    },
  });
}

/* =========================================================
   GET SUMMARY
========================================================= */

export async function getFraudSummary(
  organizationId: string
) {
  if (!organizationId) {
    throw new Error(
      "Organization ID is required."
    );
  }

  const [
    activeAlerts,
    resolvedCases,
    averageRisk,
  ] = await Promise.all([
    prisma.fraudAlert.count({
      where: {
        organizationId,

        status: {
          in: [
            "OPEN",
            "INVESTIGATING",
          ],
        },
      },
    }),

    prisma.fraudAlert.count({
      where: {
        organizationId,

        status: "RESOLVED",
      },
    }),

    prisma.fraudAlert.aggregate({
      where: {
        organizationId,

        status: {
          not: "RESOLVED",
        },
      },

      _avg: {
        riskScore: true,
      },
    }),
  ]);

  return {
    activeAlerts,

    resolvedCases,

    riskScore:
      Math.round(
        (averageRisk._avg
          .riskScore ?? 0) * 100
      ) / 100,

    systemStatus:
      "Monitoring",
  };
}