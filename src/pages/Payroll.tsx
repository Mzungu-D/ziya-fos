import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { jsPDF } from "jspdf";

import { authenticatedFetch } from "../lib/auth-session";

/* =========================================================
   TYPES
   ========================================================= */

interface PayrollEmployee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  name?: string;
  fullName?: string;
  email?: string | null;
  phoneNumber?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  employmentType?: string | null;
  hireDate?: string | null;
  kraPin?: string | null;
  nssfNumber?: string | null;
  shaNumber?: string | null;
  paymentMethod?: string | null;
  bankName?: string | null;
  bankBranch?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  mobileMoneyNumber?: string | null;
}

interface PayrollDeduction {
  id: string;
  type: string;
  description?: string | null;
  amount: number;
  createdAt?: string;
}

interface PayrollEmployerContribution {
  id: string;
  type: string;
  description?: string | null;
  amount: number;
  createdAt?: string;
}

interface PayrollRecord {
  id: string;
  payrollPeriodId: string;
  employeeId: string;
  employee: PayrollEmployee | null;

  basicSalary: number;
  allowances: number;
  grossSalary: number;
  deductions: number;
  netSalary: number;

  status: string;
  processedAt?: string | null;
  createdAt: string;
  updatedAt: string;

  deductionsBreakdown?: PayrollDeduction[];
  employerContributions?: PayrollEmployerContribution[];
}

interface PayrollPeriod {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;

  status: string;

  totalGross: number;
  totalDeductions: number;
  totalNet: number;

  processedAt?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  paidAt?: string | null;

  createdAt: string;
  updatedAt: string;

  payrollRecords?: PayrollRecord[];
}

interface OrganizationIdentity {
  id: string;
  name: string;
  legalName?: string | null;
  registrationNumber?: string | null;
  taxNumber?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
  country?: string | null;
  currency?: string | null;
  logoUrl?: string | null;
}

interface PayrollResponse {
  success: boolean;

  organization?: OrganizationIdentity | null;

  summary?: {
    employees: number;
    grossPayroll: number;
    deductions: number;
    netPayroll: number;
  };

  periods?: PayrollPeriod[];

  pagination?: {
    page: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
  };

  message?: string;
}

type PayslipData = {
  id: string;

  organization: OrganizationIdentity;

  employee: PayrollEmployee & {
    fullName: string;
  };

  employer: {
    organizationId: string;
  };

  payrollPeriod: {
    id: string;
    name: string;
    periodStart: string;
    periodEnd: string;
    status: string;
    processedAt?: string | null;
  };

  earnings: {
    basicSalary: number;
    allowances: number;
    taxableAllowances?: number;
    nonTaxableAllowances?: number;
    grossSalary: number;
    items?: Array<{
      id: string;
      type: string;
      description?: string | null;
      amount: number;
      recurring: boolean;
      taxable: boolean;
    }>;
  };

  deductions: PayrollDeduction[];

  totals: {
    grossSalary: number;
    totalDeductions: number;
    netSalary: number;
    totalEmployerContributions: number;
  };

  employerContributions: PayrollEmployerContribution[];

  loanBalances?: {
    totalOutstanding: number;
    totalMonthlyRepayment: number;
    loans: Array<{
      id: string;
      reference: string;
      description?: string | null;
      openingBalance: number;
      repayment: number;
      closingBalance: number;
      outstandingBalance: number;
      monthlyRepayment: number;
    }>;
  };

  salaryAdvanceBalances?: {
    totalOutstanding: number;
    totalMonthlyRepayment: number;
    advances: Array<{
      id: string;
      reference: string;
      description?: string | null;
      openingBalance: number;
      repayment: number;
      closingBalance: number;
      outstandingBalance: number;
      monthlyRepayment: number;
    }>;
  };

  ytd?: {
    basicSalary: number;
    grossSalary: number;
    totalDeductions: number;
    netSalary: number;
  };

  status: string;
  processedAt?: string | null;
};

interface PayslipResponse {
  success: boolean;
  message?: string;

  payslip?: Omit<PayslipData, "organization"> & {
    organization?: OrganizationIdentity | null;
  };
}

interface RunPayrollForm {
  name: string;
  periodStart: string;
  periodEnd: string;
}

/* =========================================================
   CONSTANTS
   ========================================================= */

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

const emptyForm: RunPayrollForm = {
  name: "",
  periodStart: "",
  periodEnd: "",
};

/* =========================================================
   HELPERS
   ========================================================= */

function toNumber(
  value: number | string | null | undefined
): number {
  const parsed =
    typeof value === "number"
      ? value
      : Number(
          String(value ?? "0").replace(/,/g, "")
        );

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function formatCurrency(
  value: number | string | null | undefined
): string {
  return new Intl.NumberFormat(
    "en-KE",
    {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  ).format(toNumber(value));
}

function formatDate(
  value?: string | null
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-KE",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  ).format(date);
}

function statusLabel(
  status: string
): string {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(
      /\b\w/g,
      (char) =>
        char.toUpperCase()
    );
}

function deductionLabel(
  type: string
): string {
  const labels: Record<
    string,
    string
  > = {
    PAYE: "PAYE",
    NSSF: "NSSF",
    SHIF: "SHIF",
    HOUSING_LEVY:
      "Housing Levy",
    PENSION: "Pension",
    HELB: "HELB",
    SALARY_ADVANCE:
      "Salary Advance",
    EMPLOYEE_LOAN:
      "Employee Loan",
    OTHER: "Other",
  };

  return (
    labels[type] ??
    statusLabel(type)
  );
}

function earningLabel(
  type: string
): string {
  const labels: Record<string, string> = {
    HOUSING_ALLOWANCE: "Housing Allowance",
    TRANSPORT_ALLOWANCE: "Transport Allowance",
    COMMUNICATION_ALLOWANCE: "Communication Allowance",
    MEDICAL_ALLOWANCE: "Medical Allowance",
    MEAL_ALLOWANCE: "Meal Allowance",
    OTHER_EARNING: "Other Earnings",
    BONUS: "Bonus",
    COMMISSION: "Commission",
    OVERTIME: "Overtime",
  };

  return (
    labels[type] ??
    statusLabel(type)
  );
}

function getCurrentMonthDates(): RunPayrollForm {
  const now = new Date();

  const first = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );

  const last = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0
  );

  const toInputDate = (
    date: Date
  ) =>
    `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    )}-${String(
      date.getDate()
    ).padStart(
      2,
      "0"
    )}`;

  return {
    name: "",
    periodStart:
      toInputDate(first),
    periodEnd:
      toInputDate(last),
  };
}

function safeFilePart(
  value: string
): string {
  return (
    value
      .trim()
      .replace(
        /[^a-zA-Z0-9_-]/g,
        "_"
      ) ||
    "document"
  );
}

function statusClasses(
  status: string
): string {
  const normalized =
    status.toUpperCase();

  if (
    normalized ===
      "PROCESSED" ||
    normalized === "PAID"
  ) {
    return "bg-emerald-50 text-emerald-700";
  }

  if (
    normalized.includes(
      "REJECT"
    ) ||
    normalized.includes(
      "FAILED"
    )
  ) {
    return "bg-red-50 text-red-700";
  }

  return "bg-amber-50 text-amber-700";
}

/* =========================================================
   PAYSLIP PDF
   ========================================================= */

function maskSensitive(value?: string | null): string {
  if (!value) return "—";
  const normalized = value.trim();
  if (normalized.length <= 4) return `••••${normalized}`;
  return `••••${normalized.slice(-4)}`;
}

function paymentMethodLabel(value?: string | null): string {
  const method = String(value ?? "").trim().toUpperCase();
  if (method === "BANK" || method === "BANK_TRANSFER") return "Bank Transfer";
  if (method === "MPESA" || method === "M-PESA" || method === "MOBILE_MONEY") return "M-Pesa";
  if (method === "CASH") return "Cash";
  return value || "—";
}

async function getLogoDataUrl(
  logoUrl?: string | null
): Promise<string | null> {
  if (!logoUrl) return null;

  const trimmed = logoUrl.trim();
  if (trimmed.startsWith("data:image/")) {
    return trimmed;
  }

  try {
    const response = await fetch(trimmed, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
    });

    if (!response.ok) return null;

    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) return null;

    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(
          typeof reader.result === "string"
            ? reader.result
            : null
        );
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function generatePayslipPdf(
  payslip: PayslipData
): Promise<void> {
  return (async () => {
    const logoDataUrl = await getLogoDataUrl(
      payslip.organization.logoUrl
    );

    const pdf = new jsPDF({
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const footerHeight = 14;
    const contentWidth = pageWidth - margin * 2;
    const right = pageWidth - margin;
    const navy = [15, 23, 42] as const;
    const gold = [212, 175, 55] as const;
    const teal = [13, 148, 136] as const;
    const text = [31, 41, 55] as const;
    const muted = [100, 116, 139] as const;
    const border = [226, 232, 240] as const;
    const surface = [248, 250, 252] as const;
    const white = [255, 255, 255] as const;
    const green = [22, 101, 52] as const;
    const greenBg = [236, 253, 245] as const;
    const red = [185, 28, 28] as const;
    const amber = [146, 94, 0] as const;
    const amberBg = [255, 251, 235] as const;

    let y = 15;

    const normalizedPaymentMethod = String(
      payslip.employee.paymentMethod ?? ""
    )
      .trim()
      .toUpperCase();

    const isBank =
      normalizedPaymentMethod === "BANK" ||
      normalizedPaymentMethod === "BANK_TRANSFER";

    const isMpesa =
      normalizedPaymentMethod === "MPESA" ||
      normalizedPaymentMethod === "M-PESA" ||
      normalizedPaymentMethod === "MOBILE_MONEY";

    const isCash = normalizedPaymentMethod === "CASH";

    const safeText = (value?: string | null) =>
      value && value.trim() ? value.trim() : "—";

    const fitText = (
      value: string,
      maxWidth: number,
      fontSize = 8.5
    ): string => {
      pdf.setFontSize(fontSize);
      const lines = pdf.splitTextToSize(value, maxWidth);
      return Array.isArray(lines) && lines.length > 0
        ? lines[0]
        : value;
    };

    const addFooter = () => {
      pdf.setDrawColor(...border);
      pdf.setLineWidth(0.25);
      pdf.line(
        margin,
        pageHeight - footerHeight,
        right,
        pageHeight - footerHeight
      );

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(...muted);

      const organizationName = fitText(
        safeText(payslip.organization.name),
        contentWidth * 0.55,
        7
      );

      pdf.text(
        organizationName,
        margin,
        pageHeight - 7
      );

      pdf.text(
        `Generated ${formatDate(new Date().toISOString())}`,
        right,
        pageHeight - 7,
        { align: "right" }
      );
    };

    const ensureSpace = (
      requiredHeight: number,
      keepTogether = true
    ) => {
      const availableBottom = pageHeight - footerHeight - 5;
      if (y + requiredHeight <= availableBottom) return;

      addFooter();
      pdf.addPage();
      y = 15;

      if (keepTogether) {
        drawContinuationHeader();
      }
    };

    const drawContinuationHeader = () => {
      pdf.setFillColor(...navy);
      pdf.rect(0, 0, pageWidth, 8, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.setTextColor(...white);
      pdf.text(
        `${safeText(payslip.organization.name)} • PAYSLIP`,
        margin,
        5.2
      );
      y = 15;
    };

    const drawSectionHeader = (title: string) => {
      ensureSpace(14, false);

      pdf.setFillColor(...navy);
      pdf.roundedRect(
        margin,
        y,
        contentWidth,
        8,
        1.5,
        1.5,
        "F"
      );

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor(...white);
      pdf.text(title.toUpperCase(), margin + 4, y + 5.3);
      y += 12;
    };

    const drawInfoCard = (
      fields: Array<{ label: string; value: string; bold?: boolean }>,
      columns = 2
    ) => {
      const gap = 8;
      const width = (contentWidth - gap * (columns - 1)) / columns;
      const rows = Math.ceil(fields.length / columns);
      const rowHeight = 13;
      const height = Math.max(18, rows * rowHeight + 5);

      ensureSpace(height + 2, false);
      const startY = y;

      pdf.setFillColor(...surface);
      pdf.setDrawColor(...border);
      pdf.setLineWidth(0.25);
      pdf.roundedRect(
        margin,
        y,
        contentWidth,
        height,
        2,
        2,
        "FD"
      );

      y += 7;
      fields.forEach((field, index) => {
        const column = index % columns;
        const rowIndex = Math.floor(index / columns);
        const x = margin + column * (width + gap) + 4;
        const fieldY = y + rowIndex * rowHeight;

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.2);
        pdf.setTextColor(...muted);
        pdf.text(field.label.toUpperCase(), x, fieldY);

        pdf.setFont("helvetica", field.bold ? "bold" : "normal");
        pdf.setFontSize(8.4);
        pdf.setTextColor(...text);
        const value = fitText(
          safeText(field.value),
          width - 8,
          8.4
        );
        pdf.text(value, x, fieldY + 4.5);
      });

      y = startY + height + 7;
    };

    const drawTable = (
      columns: Array<{
        title: string;
        width: number;
        align?: "left" | "right";
      }>,
      rows: Array<Array<string>>,
      options: {
        headerFill?: readonly [number, number, number];
        rowHeight?: number;
        valueColors?: Array<readonly [number, number, number] | undefined>;
      } = {}
    ) => {
      const rowHeight = options.rowHeight ?? 7;
      const headerHeight = 8;
      const headerFill = options.headerFill ?? teal;

      const required = headerHeight + Math.min(rows.length, 5) * rowHeight + 4;
      ensureSpace(required, false);

      const xPositions: number[] = [];
      let x = margin;
      columns.forEach((column) => {
        xPositions.push(x);
        x += column.width;
      });

      pdf.setFillColor(...headerFill);
      pdf.roundedRect(
        margin,
        y,
        contentWidth,
        headerHeight,
        1.5,
        1.5,
        "F"
      );

      columns.forEach((column, index) => {
        const colX = xPositions[index];
        const align = column.align ?? "left";
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.3);
        pdf.setTextColor(...white);
        pdf.text(
          column.title.toUpperCase(),
          align === "right"
            ? colX + column.width - 3
            : colX + 3,
          y + 5.2,
          { align }
        );
      });

      y += headerHeight;

      rows.forEach((row, rowIndex) => {
        if (y + rowHeight > pageHeight - footerHeight - 5) {
          addFooter();
          pdf.addPage();
          drawContinuationHeader();

          pdf.setFillColor(...headerFill);
          pdf.roundedRect(
            margin,
            y,
            contentWidth,
            headerHeight,
            1.5,
            1.5,
            "F"
          );

          columns.forEach((column, index) => {
            const colX = xPositions[index];
            const align = column.align ?? "left";
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(7.3);
            pdf.setTextColor(...white);
            pdf.text(
              column.title.toUpperCase(),
              align === "right"
                ? colX + column.width - 3
                : colX + 3,
              y + 5.2,
              { align }
            );
          });
          y += headerHeight;
        }

        if (rowIndex % 2 === 0) {
          pdf.setFillColor(...surface);
          pdf.rect(
            margin,
            y,
            contentWidth,
            rowHeight,
            "F"
          );
        }

        pdf.setDrawColor(...border);
        pdf.setLineWidth(0.2);
        pdf.line(
          margin,
          y + rowHeight,
          right,
          y + rowHeight
        );

        columns.forEach((column, index) => {
          const colX = xPositions[index];
          const align = column.align ?? "left";
          const value = safeText(row[index]);
          const color =
            options.valueColors?.[index] ?? text;

          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(7.8);
          pdf.setTextColor(...color);
          pdf.text(
            fitText(value, column.width - 6, 7.8),
            align === "right"
              ? colX + column.width - 3
              : colX + 3,
            y + 4.7,
            { align }
          );
        });

        y += rowHeight;
      });

      y += 5;
    };

    const drawTotalBar = (
      label: string,
      amount: number,
      options: {
        fill?: readonly [number, number, number];
        amountColor?: readonly [number, number, number];
      } = {}
    ) => {
      ensureSpace(14, false);
      const fill = options.fill ?? surface;
      const amountColor = options.amountColor ?? text;

      pdf.setFillColor(...fill);
      pdf.roundedRect(
        margin,
        y,
        contentWidth,
        11,
        2,
        2,
        "F"
      );

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor(...text);
      pdf.text(label, margin + 4, y + 7);

      pdf.setTextColor(...amountColor);
      pdf.text(
        formatCurrency(amount),
        right - 4,
        y + 7,
        { align: "right" }
      );
      y += 16;
    };

    const drawBalanceCard = (
      title: string,
      reference: string,
      description: string,
      opening: number,
      repayment: number,
      closing: number,
      monthlyRepayment: number
    ) => {
      const height = 35;
      ensureSpace(height + 2, false);

      pdf.setFillColor(...white);
      pdf.setDrawColor(...border);
      pdf.setLineWidth(0.3);
      pdf.roundedRect(
        margin,
        y,
        contentWidth,
        height,
        2,
        2,
        "FD"
      );

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor(...navy);
      pdf.text(title, margin + 4, y + 7);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.setTextColor(...muted);
      pdf.text(
        safeText(reference),
        right - 4,
        y + 7,
        { align: "right" }
      );

      if (description && description !== "—") {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(...muted);
        pdf.text(
          fitText(description, contentWidth - 8, 7),
          margin + 4,
          y + 12
        );
      }

      const cardY = y + 18;
      const labels = [
        "Opening",
        "Repayment",
        "Closing",
        "Monthly",
      ];
      const amounts = [
        opening,
        repayment,
        closing,
        monthlyRepayment,
      ];
      const colWidth = contentWidth / 4;

      labels.forEach((label, index) => {
        const x = margin + index * colWidth + 4;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(6.8);
        pdf.setTextColor(...muted);
        pdf.text(label, x, cardY);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.5);
        if (index === 2) {
          pdf.setTextColor(...green);
        } else {
          pdf.setTextColor(...text);
        }
        pdf.text(
          formatCurrency(amounts[index]),
          x,
          cardY + 6
        );
      });

      y += height + 6;
    };

    /* -------------------------------------------------------
       HEADER / BRANDING
       ------------------------------------------------------- */

    pdf.setFillColor(...navy);
    pdf.rect(0, 0, pageWidth, 9, "F");

    pdf.setFillColor(...gold);
    pdf.rect(0, 0, pageWidth, 2, "F");

    y = 17;

    if (logoDataUrl) {
      try {
        pdf.addImage(
          logoDataUrl,
          "AUTO",
          margin,
          y - 2,
          15,
          15,
          undefined,
          "FAST"
        );
      } catch {
        // Fall back to the generated initials mark below.
      }
    }

    const hasLogo = Boolean(logoDataUrl);
    const brandX = hasLogo ? margin + 19 : margin;

    if (!hasLogo) {
      pdf.setFillColor(...gold);
      pdf.roundedRect(
        margin,
        y - 2,
        14,
        14,
        3,
        3,
        "F"
      );
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(...navy);
      const initials = safeText(
        payslip.organization.name
      )
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();
      pdf.text(initials || "FOS", margin + 7, y + 7, {
        align: "center",
      });
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.setTextColor(...navy);
    pdf.text(
      safeText(
        payslip.organization.legalName ||
          payslip.organization.name
      ),
      brandX,
      y + 3
    );

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...muted);
    const companyMeta = [
      payslip.organization.registrationNumber
        ? `Reg. ${payslip.organization.registrationNumber}`
        : null,
      payslip.organization.taxNumber
        ? `Tax ${payslip.organization.taxNumber}`
        : null,
      payslip.organization.phoneNumber,
      payslip.organization.email,
    ]
      .filter(Boolean)
      .join(" • ");

    if (companyMeta) {
      pdf.text(
        fitText(companyMeta, contentWidth * 0.55, 7.5),
        brandX,
        y + 9
      );
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(19);
    pdf.setTextColor(...teal);
    pdf.text("PAYSLIP", right, y + 2, {
      align: "right",
    });

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor(...navy);
    pdf.text(
      safeText(payslip.payrollPeriod.name),
      right,
      y + 9,
      { align: "right" }
    );

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.2);
    pdf.setTextColor(...muted);
    pdf.text(
      `Status: ${statusLabel(payslip.status)}`,
      right,
      y + 14,
      { align: "right" }
    );

    y += 25;
    pdf.setDrawColor(...border);
    pdf.line(margin, y, right, y);
    y += 7;

    /* -------------------------------------------------------
       EMPLOYEE INFORMATION
       ------------------------------------------------------- */

    drawSectionHeader("Employee Information");

    drawInfoCard([
      {
        label: "Employee",
        value: safeText(payslip.employee.fullName),
        bold: true,
      },
      {
        label: "Employee Number",
        value: safeText(payslip.employee.employeeNumber),
      },
      {
        label: "Department",
        value: safeText(payslip.employee.department),
      },
      {
        label: "Position",
        value: safeText(payslip.employee.jobTitle),
      },
      {
        label: "Employment Type",
        value: safeText(payslip.employee.employmentType),
      },
      {
        label: "Pay Date",
        value: formatDate(payslip.processedAt),
      },
    ]);

    drawSectionHeader("Payroll Period & Payment");

    const paymentFields: Array<{
      label: string;
      value: string;
      bold?: boolean;
    }> = [
      {
        label: "Period",
        value: `${formatDate(
          payslip.payrollPeriod.periodStart
        )} — ${formatDate(
          payslip.payrollPeriod.periodEnd
        )}`,
      },
      {
        label: "Payment Method",
        value: paymentMethodLabel(
          payslip.employee.paymentMethod
        ),
        bold: true,
      },
    ];

    if (isBank) {
      paymentFields.push(
        {
          label: "Bank",
          value: safeText(payslip.employee.bankName),
        },
        {
          label: "Branch",
          value: safeText(payslip.employee.bankBranch),
        },
        {
          label: "Account Name",
          value: safeText(payslip.employee.bankAccountName),
        },
        {
          label: "Account Number",
          value: safeText(
            payslip.employee.bankAccountNumber
          ),
          bold: true,
        }
      );
    } else if (isMpesa) {
      paymentFields.push({
        label: "M-Pesa Number",
        value: safeText(
          payslip.employee.mobileMoneyNumber
        ),
        bold: true,
      });
    } else if (isCash) {
      paymentFields.push({
        label: "Payment Instruction",
        value: "Cash payment",
      });
    }

    drawInfoCard(paymentFields, 2);

    /* -------------------------------------------------------
       EARNINGS / DEDUCTIONS
       ------------------------------------------------------- */

    drawSectionHeader("Earnings");

    const earningRows: Array<Array<string>> = [
      [
        "Basic Salary",
        formatCurrency(payslip.earnings.basicSalary),
      ],
    ];

    const earningItems = payslip.earnings.items ?? [];
    if (earningItems.length > 0) {
      earningItems.forEach((earning) => {
        earningRows.push([
          safeText(
            earning.description ||
              earningLabel(earning.type)
          ),
          formatCurrency(earning.amount),
        ]);
      });
    } else if (toNumber(payslip.earnings.allowances) !== 0) {
      earningRows.push([
        "Allowances",
        formatCurrency(payslip.earnings.allowances),
      ]);
    }

    if (
      typeof payslip.earnings.taxableAllowances ===
        "number" &&
      payslip.earnings.taxableAllowances !== 0
    ) {
      earningRows.push([
        "Taxable Allowances",
        formatCurrency(
          payslip.earnings.taxableAllowances
        ),
      ]);
    }

    if (
      typeof payslip.earnings.nonTaxableAllowances ===
        "number" &&
      payslip.earnings.nonTaxableAllowances !== 0
    ) {
      earningRows.push([
        "Non-Taxable Allowances",
        formatCurrency(
          payslip.earnings.nonTaxableAllowances
        ),
      ]);
    }

    drawTable(
      [
        {
          title: "Earning",
          width: contentWidth * 0.72,
        },
        {
          title: "Amount",
          width: contentWidth * 0.28,
          align: "right",
        },
      ],
      earningRows
    );

    drawTotalBar(
      "Gross Salary",
      payslip.totals.grossSalary,
      {
        fill: [239, 246, 255],
        amountColor: navy,
      }
    );

    drawSectionHeader("Employee Deductions");

    const deductionRows =
      payslip.deductions.length > 0
        ? payslip.deductions.map((deduction) => [
            safeText(
              deduction.description ||
                deductionLabel(deduction.type)
            ),
            formatCurrency(deduction.amount),
          ])
        : [["No deductions", formatCurrency(0)]];

    drawTable(
      [
        {
          title: "Deduction",
          width: contentWidth * 0.72,
        },
        {
          title: "Amount",
          width: contentWidth * 0.28,
          align: "right",
        },
      ],
      deductionRows,
      {
        valueColors: [text, red],
      }
    );

    drawTotalBar(
      "Total Deductions",
      payslip.totals.totalDeductions,
      {
        fill: [254, 242, 242],
        amountColor: red,
      }
    );

    /* -------------------------------------------------------
       NET PAY
       ------------------------------------------------------- */

    ensureSpace(30, false);

    pdf.setFillColor(...greenBg);
    pdf.setDrawColor(187, 247, 208);
    pdf.roundedRect(
      margin,
      y,
      contentWidth,
      24,
      3,
      3,
      "FD"
    );

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(...green);
    pdf.text("NET PAY", margin + 6, y + 9);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.setTextColor(...navy);
    pdf.text(
      formatCurrency(payslip.totals.netSalary),
      right - 6,
      y + 10,
      { align: "right" }
    );

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(...muted);
    pdf.text(
      "Amount payable to the employee after statutory and other deductions.",
      margin + 6,
      y + 17
    );

    y += 31;

    /* -------------------------------------------------------
       LOANS / ADVANCES
       ------------------------------------------------------- */

    const loans = payslip.loanBalances?.loans ?? [];
    const advances =
      payslip.salaryAdvanceBalances?.advances ?? [];

    if (loans.length > 0 || advances.length > 0) {
      drawSectionHeader("Loans & Salary Advances");

      if (loans.length > 0) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.5);
        pdf.setTextColor(...navy);
        pdf.text("Employee Loans", margin, y);
        y += 5;

        loans.forEach((loan) => {
          drawBalanceCard(
            "Employee Loan",
            loan.reference,
            safeText(loan.description),
            loan.openingBalance,
            loan.repayment,
            loan.closingBalance,
            loan.monthlyRepayment
          );
        });
      }

      if (advances.length > 0) {
        ensureSpace(12, false);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.5);
        pdf.setTextColor(...navy);
        pdf.text("Salary Advances", margin, y);
        y += 5;

        advances.forEach((advance) => {
          drawBalanceCard(
            "Salary Advance",
            advance.reference,
            safeText(advance.description),
            advance.openingBalance,
            advance.repayment,
            advance.closingBalance,
            advance.monthlyRepayment
          );
        });
      }

      drawTotalBar(
        "Total Outstanding Loans",
        payslip.loanBalances?.totalOutstanding ?? 0,
        {
          fill: surface,
          amountColor: navy,
        }
      );

      if (advances.length > 0) {
        drawTotalBar(
          "Total Outstanding Salary Advances",
          payslip.salaryAdvanceBalances?.totalOutstanding ?? 0,
          {
            fill: amberBg,
            amountColor: amber,
          }
        );
      }
    }

    /* -------------------------------------------------------
       EMPLOYER CONTRIBUTIONS
       ------------------------------------------------------- */

    drawSectionHeader("Employer Contributions");

    if (payslip.employerContributions.length === 0) {
      drawTable(
        [
          {
            title: "Contribution",
            width: contentWidth * 0.72,
          },
          {
            title: "Amount",
            width: contentWidth * 0.28,
            align: "right",
          },
        ],
        [["No employer contributions", formatCurrency(0)]]
      );
    } else {
      drawTable(
        [
          {
            title: "Contribution",
            width: contentWidth * 0.72,
          },
          {
            title: "Amount",
            width: contentWidth * 0.28,
            align: "right",
          },
        ],
        payslip.employerContributions.map(
          (contribution) => [
            safeText(
              contribution.description ||
                deductionLabel(contribution.type)
            ),
            formatCurrency(contribution.amount),
          ]
        )
      );
    }

    drawTotalBar(
      "Total Employer Contributions",
      payslip.totals.totalEmployerContributions,
      {
        fill: surface,
        amountColor: navy,
      }
    );

    /* -------------------------------------------------------
       YTD SUMMARY
       ------------------------------------------------------- */

    drawSectionHeader("Year-to-Date Summary");

    if (payslip.ytd) {
      drawTable(
        [
          {
            title: "YTD Measure",
            width: contentWidth * 0.65,
          },
          {
            title: "Amount",
            width: contentWidth * 0.35,
            align: "right",
          },
        ],
        [
          [
            "Basic Salary",
            formatCurrency(payslip.ytd.basicSalary),
          ],
          [
            "Gross Salary",
            formatCurrency(payslip.ytd.grossSalary),
          ],
          [
            "Total Deductions",
            formatCurrency(payslip.ytd.totalDeductions),
          ],
          [
            "Net Salary",
            formatCurrency(payslip.ytd.netSalary),
          ],
        ],
        {
          valueColors: [text, navy],
        }
      );
    } else {
      drawInfoCard([
        {
          label: "YTD Information",
          value: "Not available for this payslip",
        },
      ], 1);
    }

    /* -------------------------------------------------------
       FINAL FOOTER / STATUS
       ------------------------------------------------------- */

    ensureSpace(28, false);

    pdf.setFillColor(...surface);
    pdf.setDrawColor(...border);
    pdf.roundedRect(
      margin,
      y,
      contentWidth,
      20,
      2,
      2,
      "FD"
    );

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...navy);
    pdf.text(
      "Payroll Record",
      margin + 5,
      y + 7
    );

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(...muted);
    pdf.text(
      `Status: ${statusLabel(payslip.status)}`,
      margin + 5,
      y + 12
    );
    pdf.text(
      `Processed: ${formatDate(payslip.processedAt)}`,
      right - 5,
      y + 12,
      { align: "right" }
    );

    pdf.setFontSize(6.8);
    pdf.text(
      `This electronic payslip is issued by ${safeText(
        payslip.organization.name
      )}. No signature is required.`,
      pageWidth / 2,
      y + 17,
      { align: "center" }
    );

    addFooter();

    pdf.save(
      `Payslip_${safeFilePart(
        payslip.employee.employeeNumber
      )}_${safeFilePart(
        payslip.payrollPeriod.name
      )}.pdf`
    );
  })();
}

/* =========================================================
   COMPONENT
   ========================================================= */

export default function Payroll() {
  const [
    periods,
    setPeriods,
  ] =
    useState<PayrollPeriod[]>(
      []
    );

  const [
    summary,
    setSummary,
  ] = useState({
    employees: 0,
    grossPayroll: 0,
    deductions: 0,
    netPayroll: 0,
  });

  const [
    organization,
    setOrganization,
  ] =
    useState<OrganizationIdentity | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    processing,
    setProcessing,
  ] = useState(false);

  const [
    payslipLoadingId,
    setPayslipLoadingId,
  ] =
    useState<string | null>(
      null
    );

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    pageSize,
    setPageSize,
  ] = useState(10);

  const [
    totalPages,
    setTotalPages,
  ] = useState(0);

  const [
    totalRecords,
    setTotalRecords,
  ] = useState(0);

  const [
    selectedPeriodId,
    setSelectedPeriodId,
  ] =
    useState<string | null>(
      null
    );

  const [
    selectedPayslip,
    setSelectedPayslip,
  ] =
    useState<PayslipData | null>(
      null
    );

  const [
    showPayslip,
    setShowPayslip,
  ] = useState(false);

  const [
    showRunModal,
    setShowRunModal,
  ] = useState(false);

  const [
    form,
    setForm,
  ] =
    useState<RunPayrollForm>(
      emptyForm
    );

  const [
    formError,
    setFormError,
  ] = useState("");

  /* =======================================================
     LOAD PAYROLL
     ======================================================= */

  const loadPayroll = async (
    options: {
      pageOverride?: number;
      pageSizeOverride?: number;
      searchOverride?: string;
      periodIdOverride?: string | null;
    } = {}
  ) => {
    try {
      setLoading(true);
      setError("");

      const requestedPage =
        Math.max(
          1,
          options.pageOverride ??
            page
        );

      const requestedPageSize =
        options.pageSizeOverride ??
        pageSize;

      const requestedSearch =
        options.searchOverride ??
        search;

      const requestedPeriodId =
        options.periodIdOverride ??
        selectedPeriodId;

      const params =
        new URLSearchParams({
          page: String(
            requestedPage
          ),

          pageSize: String(
            requestedPageSize
          ),
        });

      if (
        requestedSearch.trim()
      ) {
        params.set(
          "search",
          requestedSearch.trim()
        );
      }

      if (
        requestedPeriodId
      ) {
        params.set(
          "periodId",
          requestedPeriodId
        );
      }

      const response =
        await authenticatedFetch(
          `/api/payroll?${params.toString()}`,
          {
            method: "GET",
            headers: {
              Accept:
                "application/json",
            },
          }
        );

      const data =
        (await response
          .json()
          .catch(
            () => null
          )) as
          | PayrollResponse
          | null;

      if (
        !response.ok ||
        !data?.success
      ) {
        throw new Error(
          data?.message ||
            `Failed to load payroll (${response.status}).`
        );
      }

      const loadedPeriods =
        data.periods ?? [];

      setOrganization(
        data.organization ??
          null
      );

      setPeriods(
        loadedPeriods
      );

      setSummary({
        employees:
          data.summary
            ?.employees ??
          0,

        grossPayroll:
          data.summary
            ?.grossPayroll ??
          0,

        deductions:
          data.summary
            ?.deductions ??
          0,

        netPayroll:
          data.summary
            ?.netPayroll ??
          0,
      });

      /* ---------------------------------------------------
         SERVER PAGINATION
         --------------------------------------------------- */

      if (
        data.pagination
      ) {
        setTotalRecords(
          data.pagination
            .totalRecords
        );

        setTotalPages(
          data.pagination
            .totalPages
        );

        setPage(
          data.pagination.page
        );

        setPageSize(
          data.pagination.pageSize
        );
      } else {
        setTotalRecords(0);
        setTotalPages(0);
      }

      /* ---------------------------------------------------
         SELECTED PERIOD
         --------------------------------------------------- */

      const periodExists =
        requestedPeriodId
          ? loadedPeriods.some(
              (period) =>
                period.id ===
                requestedPeriodId
            )
          : false;

      if (
        periodExists &&
        requestedPeriodId
      ) {
        setSelectedPeriodId(
          requestedPeriodId
        );

        return;
      }

      const firstPeriod =
        loadedPeriods[0];

      if (!firstPeriod) {
        setSelectedPeriodId(
          null
        );

        return;
      }

      setSelectedPeriodId(
        firstPeriod.id
      );

      /*
       * The first request loads period metadata.
       * The second request explicitly loads the
       * latest period's server-paginated records.
       */
      if (
        !requestedPeriodId
      ) {
        await loadPayroll({
          pageOverride:
            requestedPage,

          pageSizeOverride:
            requestedPageSize,

          searchOverride:
            requestedSearch,

          periodIdOverride:
            firstPeriod.id,
        });
      }
    } catch (err) {
      setPeriods([]);

      setSummary({
        employees: 0,
        grossPayroll: 0,
        deductions: 0,
        netPayroll: 0,
      });

      setTotalRecords(0);
      setTotalPages(0);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load payroll."
      );
    } finally {
      setLoading(false);
    }
  };

  /* =======================================================
     INITIAL LOAD
     ======================================================= */

  useEffect(() => {
    void loadPayroll({
      pageOverride: 1,
      pageSizeOverride:
        pageSize,
      searchOverride: "",
      periodIdOverride: null,
    });

    // Initial load only.
    // Subsequent requests are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =======================================================
     SELECTED PERIOD
     ======================================================= */

  const selectedPeriod =
    periods.find(
      (period) =>
        period.id ===
        selectedPeriodId
    ) ??
    periods[0] ??
    null;

  /*
   * IMPORTANT:
   * records contains ONLY the records returned
   * by the server for the current page.
   */
  const records =
    selectedPeriod
      ?.payrollRecords ??
    [];

  const startRecord =
    totalRecords === 0
      ? 0
      : (page - 1) *
          pageSize +
        1;

  const endRecord =
    totalRecords === 0
      ? 0
      : Math.min(
          page * pageSize,
          totalRecords
        );

  /* =======================================================
     PERIOD CHANGE
     ======================================================= */

  const handlePeriodChange = (
    periodId: string
  ) => {
    if (!periodId) {
      return;
    }

    setSelectedPeriodId(
      periodId
    );

    setPage(1);

    void loadPayroll({
      pageOverride: 1,

      pageSizeOverride:
        pageSize,

      searchOverride:
        search,

      periodIdOverride:
        periodId,
    });
  };

  /* =======================================================
     SEARCH
     ======================================================= */

  const handleSearchChange = (
    value: string
  ) => {
    setSearch(value);

    setPage(1);

    void loadPayroll({
      pageOverride: 1,

      pageSizeOverride:
        pageSize,

      searchOverride: value,

      periodIdOverride:
        selectedPeriodId,
    });
  };

  /* =======================================================
     PAGINATION
     ======================================================= */

  const goToPage = (
    nextPage: number
  ) => {
    if (
      nextPage < 1 ||
      nextPage >
        totalPages ||
      nextPage === page ||
      loading
    ) {
      return;
    }

    setPage(nextPage);

    void loadPayroll({
      pageOverride:
        nextPage,

      pageSizeOverride:
        pageSize,

      searchOverride:
        search,

      periodIdOverride:
        selectedPeriodId,
    });
  };

  const changePageSize = (
    nextSize: number
  ) => {
    if (
      !PAGE_SIZE_OPTIONS.includes(
        nextSize as (typeof PAGE_SIZE_OPTIONS)[number]
      )
    ) {
      return;
    }

    /*
     * IMPORTANT:
     * Pass nextSize directly to loadPayroll.
     * Do not rely on React state having updated yet.
     */
    setPageSize(nextSize);
    setPage(1);

    void loadPayroll({
      pageOverride: 1,

      pageSizeOverride:
        nextSize,

      searchOverride:
        search,

      periodIdOverride:
        selectedPeriodId,
    });
  };

  /* =======================================================
     OPEN RUN PAYROLL
     ======================================================= */

  const openRunPayroll = () => {
    setForm(
      getCurrentMonthDates()
    );

    setFormError("");
    setSuccess("");
    setShowRunModal(true);
  };

  const closeRunPayroll = () => {
    if (processing) {
      return;
    }

    setShowRunModal(false);
    setForm(emptyForm);
    setFormError("");
  };

  /* =======================================================
     RUN PAYROLL
     ======================================================= */

  const submitPayroll = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setFormError("");
    setSuccess("");

    if (
      !form.name.trim() ||
      !form.periodStart ||
      !form.periodEnd
    ) {
      setFormError(
        "Payroll name, start date and end date are required."
      );

      return;
    }

    const start =
      new Date(
        `${form.periodStart}T00:00:00`
      );

    const end =
      new Date(
        `${form.periodEnd}T23:59:59`
      );

    if (
      Number.isNaN(
        start.getTime()
      ) ||
      Number.isNaN(
        end.getTime()
      )
    ) {
      setFormError(
        "Please provide valid payroll dates."
      );

      return;
    }

    if (end < start) {
      setFormError(
        "Payroll end date cannot be before the start date."
      );

      return;
    }

    try {
      setProcessing(true);

      const response =
        await authenticatedFetch(
          "/api/payroll/run",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            body: JSON.stringify({
              name:
                form.name.trim(),

              periodStart:
                start.toISOString(),

              periodEnd:
                end.toISOString(),

              /*
               * Preserved from the existing
               * payroll API contract.
               *
               * The backend payroll engine remains
               * responsible for calculations.
               */
              allowances: {},
            }),
          }
        );

      const data =
        (await response
          .json()
          .catch(
            () => null
          )) as
          | {
              success?: boolean;
              message?: string;
              period?: PayrollPeriod;
            }
          | null;

      if (
        !response.ok ||
        !data?.success
      ) {
        throw new Error(
          data?.message ||
            `Failed to process payroll (${response.status}).`
        );
      }

      setSuccess(
        data.message ||
          "Payroll processed successfully."
      );

      setShowRunModal(false);
      setForm(emptyForm);

      setSearch("");

      await loadPayroll({
        pageOverride: 1,

        pageSizeOverride:
          pageSize,

        searchOverride: "",

        periodIdOverride:
          data.period?.id ??
          null,
      });
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Failed to process payroll."
      );
    } finally {
      setProcessing(false);
    }
  };

  /* =======================================================
     FETCH PAYSLIP
     ======================================================= */

  const fetchPayslip = async (
    recordId: string,
    download = false
  ) => {
    try {
      setPayslipLoadingId(
        recordId
      );

      setError("");

      const response =
        await authenticatedFetch(
          `/api/payroll/${encodeURIComponent(
            recordId
          )}/payslip`,
          {
            method: "GET",

            headers: {
              Accept:
                "application/json",
            },
          }
        );

      const data =
        (await response
          .json()
          .catch(
            () => null
          )) as
          | PayslipResponse
          | null;

      if (
        !response.ok ||
        !data?.success ||
        !data.payslip
      ) {
        throw new Error(
          data?.message ||
            `Failed to retrieve payslip (${response.status}).`
        );
      }

      /*
       * The backend should return organization identity
       * with the payslip. The current payroll page also
       * has the authenticated tenant organization from
       * GET /api/payroll, so it is used as a safe fallback.
       */
      const employer =
        data.payslip
          .organization ??
        organization;

      if (!employer) {
        throw new Error(
          "Employer organization details are unavailable for this payslip."
        );
      }

      const payslip: PayslipData =
        {
          ...data.payslip,
          organization:
            employer,
        };

      setSelectedPayslip(
        payslip
      );

      if (download) {
        await generatePayslipPdf(
          payslip
        );
      } else {
        setShowPayslip(true);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to retrieve payslip."
      );
    } finally {
      setPayslipLoadingId(
        null
      );
    }
  };

  /* =======================================================
     CLOSE PAYSLIP
     ======================================================= */

  const closePayslip = () => {
    setShowPayslip(false);
    setSelectedPayslip(
      null
    );
  };

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div className="space-y-6 pb-10">

      {/* =====================================================
          HEADER
          ===================================================== */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">

          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0D9488]">
            Payroll
          </p>

          <h1 className="mt-1 break-words text-2xl font-bold tracking-tight text-[#20243A] sm:text-3xl">
            {organization?.name ||
              "Payroll"}
          </h1>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#666B84]">
            Manage payroll processing,
            employee deductions,
            employer contributions
            and payslips.
          </p>

        </div>

        <button
          type="button"
          onClick={
            openRunPayroll
          }
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0D9488] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f766e]"
        >
          <Plus size={18} />

          Run Payroll
        </button>
      </div>

      {/* =====================================================
          SUCCESS
          ===================================================== */}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {success}
        </div>
      )}

      {/* =====================================================
          SUMMARY
          ===================================================== */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <div className="min-w-0 rounded-xl border border-[#E7E9F0] bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-[#666B84]">
            Employees
          </p>

          <p className="mt-2 break-words text-xl font-bold tabular-nums tracking-tight text-[#20243A] sm:text-2xl">
            {loading
              ? "—"
              : summary.employees}
          </p>

          <p className="mt-1 text-xs text-[#8A8FA3]">
            Employees in selected payroll
          </p>
        </div>

        <div className="min-w-0 rounded-xl border border-[#E7E9F0] bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-[#666B84]">
            Gross Payroll
          </p>

          <p className="mt-2 break-words text-xl font-bold tabular-nums tracking-tight text-[#20243A] sm:text-2xl">
            {loading
              ? "—"
              : formatCurrency(
                  summary.grossPayroll
                )}
          </p>

          <p className="mt-1 text-xs text-[#8A8FA3]">
            Before employee deductions
          </p>
        </div>

        <div className="min-w-0 rounded-xl border border-[#E7E9F0] bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-[#666B84]">
            Deductions
          </p>

          <p className="mt-2 break-words text-xl font-bold tabular-nums tracking-tight text-[#20243A] sm:text-2xl">
            {loading
              ? "—"
              : formatCurrency(
                  summary.deductions
                )}
          </p>

          <p className="mt-1 text-xs text-[#8A8FA3]">
            Employee deductions
          </p>
        </div>

        <div className="min-w-0 rounded-xl border border-[#E7E9F0] bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-[#666B84]">
            Net Payroll
          </p>

          <p className="mt-2 break-words text-xl font-bold tabular-nums tracking-tight text-[#20243A] sm:text-2xl">
            {loading
              ? "—"
              : formatCurrency(
                  summary.netPayroll
                )}
          </p>

          <p className="mt-1 text-xs text-[#8A8FA3]">
            Amount payable to employees
          </p>
        </div>

      </div>

      {/* =====================================================
          PAYROLL REGISTER
          ===================================================== */}

      <div className="rounded-2xl border border-[#E7E9F0] bg-white shadow-sm">

        <div className="flex flex-col gap-4 border-b border-[#ECECF3] p-5 xl:flex-row xl:items-center xl:justify-between">

          <div className="min-w-0">

            <h2 className="text-lg font-bold text-[#20243A]">
              Payroll Register
            </h2>

            {selectedPeriod && (
              <p className="mt-1 text-sm text-[#666B84]">
                {selectedPeriod.name}
                {" · "}
                {formatDate(
                  selectedPeriod.periodStart
                )}
                {" — "}
                {formatDate(
                  selectedPeriod.periodEnd
                )}
              </p>
            )}

          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">

            {/* SEARCH */}

            <label className="relative min-w-0 sm:w-72">

              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8FA3]"
              />

              <input
                value={search}
                onChange={(event) =>
                  handleSearchChange(
                    event.target.value
                  )
                }
                placeholder="Search employees..."
                className="w-full rounded-xl border border-[#DCDDEA] bg-white py-2.5 pl-10 pr-3 text-sm text-[#20243A] outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
              />

            </label>

            {/* PERIOD */}

            <select
              value={
                selectedPeriodId ??
                ""
              }
              onChange={(event) =>
                handlePeriodChange(
                  event.target.value
                )
              }
              disabled={
                loading ||
                periods.length ===
                  0
              }
              className="rounded-xl border border-[#DCDDEA] bg-white px-3 py-2.5 text-sm font-medium text-[#20243A] outline-none focus:border-[#0D9488]"
            >
              {periods.length ===
              0 ? (
                <option value="">
                  No periods
                </option>
              ) : (
                periods.map(
                  (period) => (
                    <option
                      key={
                        period.id
                      }
                      value={
                        period.id
                      }
                    >
                      {
                        period.name
                      }
                    </option>
                  )
                )
              )}
            </select>

          </div>

        </div>

        {/* ===================================================
            ERROR
            =================================================== */}

        {error && (
          <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-4">

            <div className="flex gap-3">

              <AlertCircle
                className="mt-0.5 shrink-0 text-red-600"
                size={19}
              />

              <div>

                <p className="font-semibold text-red-700">
                  Payroll error
                </p>

                <p className="mt-1 text-sm text-red-600">
                  {error}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    void loadPayroll()
                  }
                  className="mt-2 text-sm font-semibold text-red-700 underline"
                >
                  Try again
                </button>

              </div>

            </div>

          </div>
        )}

        {/* ===================================================
            LOADING
            =================================================== */}

        {!error &&
        loading ? (
          <div className="flex min-h-[360px] items-center justify-center">

            <div className="flex items-center gap-3 text-sm font-medium text-[#666B84]">

              <Loader2
                size={20}
                className="animate-spin"
              />

              Loading payroll...

            </div>

          </div>
        ) : !error &&
          !selectedPeriod ? (

          /* =================================================
             EMPTY PERIOD
             ================================================= */

          <div className="p-12 text-center">

            <CalendarDays
              size={38}
              className="mx-auto text-[#8A8FA3]"
            />

            <h3 className="mt-4 text-lg font-bold text-[#20243A]">
              No payroll processed yet
            </h3>

            <p className="mt-1 text-sm text-[#666B84]">
              Run payroll to create
              the first payroll period.
            </p>

            <button
              type="button"
              onClick={
                openRunPayroll
              }
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#0D9488] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e]"
            >
              <Plus size={17} />
              Run Payroll
            </button>

          </div>

        ) : !error &&
          records.length ===
            0 ? (

          /* =================================================
             EMPTY RECORDS
             ================================================= */

          <div className="p-12 text-center">

            <Search
              size={38}
              className="mx-auto text-[#8A8FA3]"
            />

            <h3 className="mt-4 text-lg font-bold text-[#20243A]">
              No employees found
            </h3>

            <p className="mt-1 text-sm text-[#666B84]">
              {search.trim()
                ? "Try a different employee search."
                : "This payroll period has no records."}
            </p>

          </div>

        ) : !error ? (

          <>
            {/* =============================================
                TABLE
                ============================================= */}

            <div className="overflow-x-auto">

              <table className="w-full min-w-[1460px] table-fixed">

                <colgroup>
                  <col className="w-[245px]" />
                  <col className="w-[150px]" />
                  <col className="w-[145px]" />
                  <col className="w-[145px]" />
                  <col className="w-[150px]" />
                  <col className="w-[150px]" />
                  <col className="w-[150px]" />
                  <col className="w-[125px]" />
                  <col className="w-[220px]" />
                  <col className="w-[190px]" />
                </colgroup>

                <thead className="bg-[#F8F9FC]">

                  <tr className="border-b border-[#E7E9F0] text-left text-xs font-bold uppercase tracking-wide text-[#72778F]">

                    <th className="px-5 py-4">
                      Employee
                    </th>

                    <th className="px-4 py-4">
                      Department
                    </th>

                    <th className="px-4 py-4 text-right">
                      Basic
                    </th>

                    <th className="px-4 py-4 text-right">
                      Allowances
                    </th>

                    <th className="px-4 py-4 text-right">
                      Gross
                    </th>

                    <th className="px-4 py-4 text-right">
                      Deductions
                    </th>

                    <th className="px-4 py-4 text-right">
                      Net Pay
                    </th>

                    <th className="px-4 py-4">
                      Status
                    </th>

                    <th className="px-4 py-4">
                      Payment Details
                    </th>

                    <th className="px-5 py-4 text-right">
                      Actions
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {records.map(
                    (record) => (
                      <tr
                        key={
                          record.id
                        }
                        className="border-b border-[#EEF0F4] align-middle transition hover:bg-[#FAFBFC]"
                      >

                        {/* EMPLOYEE */}

                        <td className="px-5 py-4">

                          <div className="min-w-0">

                            <p className="truncate font-semibold text-[#20243A]">

                              {record
                                .employee
                                ?.name ||
                                [
                                  record
                                    .employee
                                    ?.firstName,

                                  record
                                    .employee
                                    ?.lastName,
                                ]
                                  .filter(
                                    Boolean
                                  )
                                  .join(
                                    " "
                                  ) ||
                                "Unknown employee"}

                            </p>

                            <p className="mt-1 truncate text-xs text-[#8A8FA3]">
                              {record
                                .employee
                                ?.employeeNumber ||
                                "—"}
                            </p>

                          </div>

                        </td>

                        {/* DEPARTMENT */}

                        <td className="px-4 py-4">

                          <span className="truncate text-sm text-[#666B84]">
                            {record
                              .employee
                              ?.department ||
                              "—"}
                          </span>

                        </td>

                        {/* BASIC */}

                        <td className="whitespace-nowrap px-4 py-4 text-right text-sm tabular-nums text-[#20243A]">
                          {formatCurrency(
                            record.basicSalary
                          )}
                        </td>

                        {/* ALLOWANCES */}

                        <td className="whitespace-nowrap px-4 py-4 text-right text-sm tabular-nums text-[#20243A]">
                          {formatCurrency(
                            record.allowances
                          )}
                        </td>

                        {/* GROSS */}

                        <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-semibold tabular-nums text-[#20243A]">
                          {formatCurrency(
                            record.grossSalary
                          )}
                        </td>

                        {/* DEDUCTIONS */}

                        <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-medium tabular-nums text-red-600">
                          {formatCurrency(
                            record.deductions
                          )}
                        </td>

                        {/* NET */}

                        <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-bold tabular-nums text-emerald-600">
                          {formatCurrency(
                            record.netSalary
                          )}
                        </td>

                        {/* STATUS */}

                        <td className="px-4 py-4">

                          <span
                            className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(
                              record.status
                            )}`}
                          >
                            {statusLabel(
                              record.status
                            )}
                          </span>

                        </td>

                        {/* PAYMENT DETAILS */}

                        <td className="px-4 py-4">
                          {(() => {
                            const method = String(record.employee?.paymentMethod ?? "").trim().toUpperCase();
                            const isMpesa = method === "MPESA" || method === "M-PESA" || method === "MOBILE_MONEY" || method.includes("MPESA");
                            const isBank = method === "BANK" || method === "BANK_TRANSFER" || method.includes("BANK");

                            if (isMpesa) {
                              return (
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8FA3]">M-Pesa</p>
                                  <p className="mt-1 truncate text-sm font-medium text-[#20243A]">
                                    {record.employee?.mobileMoneyNumber || "No phone number"}
                                  </p>
                                </div>
                              );
                            }

                            if (isBank) {
                              return (
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-[#20243A]">
                                    {record.employee?.bankName || "Bank not provided"}
                                  </p>
                                  <p className="mt-1 truncate text-xs text-[#666B84]">
                                    A/C: {record.employee?.bankAccountNumber || "Not provided"}
                                  </p>
                                </div>
                              );
                            }

                            return (
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-[#20243A]">
                                  {method ? statusLabel(method) : "Not configured"}
                                </p>
                              </div>
                            );
                          })()}
                        </td>

                        {/* ACTIONS */}

                        <td className="px-5 py-4">

                          <div className="flex justify-end gap-2 whitespace-nowrap">

                            <button
                              type="button"
                              disabled={
                                payslipLoadingId ===
                                record.id
                              }
                              onClick={() =>
                                void fetchPayslip(
                                  record.id
                                )
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCDDEA] bg-white px-3 py-2 text-xs font-semibold text-[#20243A] hover:bg-[#F8F9FC] disabled:opacity-60"
                            >
                              {payslipLoadingId ===
                              record.id ? (
                                <Loader2
                                  size={
                                    15
                                  }
                                  className="animate-spin"
                                />
                              ) : (
                                <Eye
                                  size={
                                    15
                                  }
                                />
                              )}

                              View
                            </button>

                            <button
                              type="button"
                              disabled={
                                payslipLoadingId ===
                                record.id
                              }
                              onClick={() =>
                                void fetchPayslip(
                                  record.id,
                                  true
                                )
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D9488] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0f766e] disabled:opacity-60"
                            >
                              <Download
                                size={
                                  15
                                }
                              />

                              PDF
                            </button>

                          </div>

                        </td>

                      </tr>
                    )
                  )}

                </tbody>

              </table>

            </div>

            {/* =============================================
                PAGINATION
                ============================================= */}

            <div className="flex flex-col gap-4 border-t border-[#E7E9F0] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">

              <div className="flex flex-wrap items-center gap-3 text-sm text-[#666B84]">

                <span>
                  Rows per page
                </span>

                <select
                  value={
                    pageSize
                  }
                  onChange={(
                    event
                  ) =>
                    changePageSize(
                      Number(
                        event
                          .target
                          .value
                      )
                    )
                  }
                  className="rounded-lg border border-[#DCDDEA] bg-white px-2.5 py-2 text-sm font-semibold text-[#20243A] outline-none focus:border-[#0D9488]"
                >

                  {PAGE_SIZE_OPTIONS.map(
                    (size) => (
                      <option
                        key={
                          size
                        }
                        value={
                          size
                        }
                      >
                        {size}
                      </option>
                    )
                  )}

                </select>

                <span>
                  {startRecord}–
                  {endRecord} of{" "}
                  {totalRecords}{" "}
                  employees
                </span>

              </div>

              <div className="flex items-center gap-2">

                <button
                  type="button"
                  onClick={() =>
                    goToPage(
                      page - 1
                    )
                  }
                  disabled={
                    page <=
                      1 ||
                    loading
                  }
                  aria-label="Previous page"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#DCDDEA] text-[#666B84] hover:border-[#0D9488] hover:text-[#0D9488] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft
                    size={17}
                  />
                </button>

                <span className="min-w-[92px] text-center text-sm font-semibold text-[#20243A]">
                  Page{" "}
                  {page} of{" "}
                  {totalPages ||
                    1}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    goToPage(
                      page + 1
                    )
                  }
                  disabled={
                    page >=
                      totalPages ||
                    totalPages ===
                      0 ||
                    loading
                  }
                  aria-label="Next page"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#DCDDEA] text-[#666B84] hover:border-[#0D9488] hover:text-[#0D9488] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight
                    size={17}
                  />
                </button>

              </div>

            </div>

            {/* =============================================
                PERIOD TOTALS
                ============================================= */}

            <div className="grid grid-cols-1 gap-4 border-t border-[#E7E9F0] bg-[#FAFBFC] p-5 md:grid-cols-3">

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8FA3]">
                  Period Gross
                </p>

                <p className="mt-1 font-bold tabular-nums text-[#20243A]">
                  {formatCurrency(
                    selectedPeriod
                      .totalGross
                  )}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8FA3]">
                  Period Deductions
                </p>

                <p className="mt-1 font-bold tabular-nums text-red-600">
                  {formatCurrency(
                    selectedPeriod
                      .totalDeductions
                  )}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8FA3]">
                  Period Net
                </p>

                <p className="mt-1 font-bold tabular-nums text-emerald-600">
                  {formatCurrency(
                    selectedPeriod
                      .totalNet
                  )}
                </p>
              </div>

            </div>

          </>

        ) : null}

      </div>

      {/* =====================================================
          RUN PAYROLL MODAL
          ===================================================== */}

      {showRunModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/50 p-4">

          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b border-[#E7E9F0] p-6">

              <div>

                <h2 className="text-xl font-bold text-[#20243A]">
                  Run Payroll
                </h2>

                <p className="mt-1 text-sm text-[#666B84]">
                  Process payroll for active employees.
                </p>

              </div>

              <button
                type="button"
                onClick={
                  closeRunPayroll
                }
                disabled={
                  processing
                }
                aria-label="Close payroll dialog"
                className="rounded-lg p-2 text-[#666B84] hover:bg-[#F8F9FC] disabled:opacity-50"
              >
                <X size={20} />
              </button>

            </div>

            <form
              onSubmit={
                submitPayroll
              }
              className="space-y-5 p-6"
            >

              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <label className="block">

                <span className="mb-2 block text-sm font-semibold text-[#20243A]">
                  Payroll Period Name
                </span>

                <input
                  value={
                    form.name
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,
                      name: event
                        .target
                        .value,
                    })
                  }
                  placeholder="e.g. September 2026 Payroll"
                  className="w-full rounded-xl border border-[#DCDDEA] px-3 py-2.5 text-sm text-[#20243A] outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
                  required
                />

              </label>

              <div className="grid gap-4 sm:grid-cols-2">

                <label>

                  <span className="mb-2 block text-sm font-semibold text-[#20243A]">
                    Start Date
                  </span>

                  <input
                    type="date"
                    value={
                      form.periodStart
                    }
                    onChange={(
                      event
                    ) =>
                      setForm({
                        ...form,
                        periodStart:
                          event
                            .target
                            .value,
                      })
                    }
                    className="w-full rounded-xl border border-[#DCDDEA] px-3 py-2.5 text-sm text-[#20243A] outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
                    required
                  />

                </label>

                <label>

                  <span className="mb-2 block text-sm font-semibold text-[#20243A]">
                    End Date
                  </span>

                  <input
                    type="date"
                    value={
                      form.periodEnd
                    }
                    onChange={(
                      event
                    ) =>
                      setForm({
                        ...form,
                        periodEnd:
                          event
                            .target
                            .value,
                      })
                    }
                    className="w-full rounded-xl border border-[#DCDDEA] px-3 py-2.5 text-sm text-[#20243A] outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
                    required
                  />

                </label>

              </div>

              <div className="rounded-xl bg-[#F8F9FC] p-4 text-sm leading-6 text-[#666B84]">

                <p className="font-semibold text-[#20243A]">
                  Automatic calculations
                </p>

                <p className="mt-1">
                  Configured PAYE,
                  NSSF, SHIF,
                  Housing Levy,
                  pension, HELB,
                  salary advances,
                  employee loans
                  and employer
                  contributions
                  are calculated
                  by the payroll
                  engine.
                </p>

              </div>

              <div className="flex justify-end gap-3 border-t border-[#E7E9F0] pt-5">

                <button
                  type="button"
                  onClick={
                    closeRunPayroll
                  }
                  disabled={
                    processing
                  }
                  className="rounded-xl border border-[#DCDDEA] px-5 py-2.5 text-sm font-semibold text-[#20243A] hover:bg-[#F8F9FC] disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    processing
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0D9488] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:cursor-not-allowed disabled:opacity-60"
                >

                  {processing && (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  )}

                  {processing
                    ? "Processing..."
                    : "Process Payroll"}

                </button>

              </div>

            </form>

          </div>

        </div>
      )}

      {/* =====================================================
          PAYSLIP MODAL
          ===================================================== */}

      {showPayslip &&
        selectedPayslip && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/55 p-4">

            <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

              {/* HEADER */}

              <div className="flex items-center justify-between border-b border-[#E7E9F0] px-6 py-4">

                <div className="min-w-0">

                  <p className="truncate text-xs font-semibold uppercase tracking-wide text-[#0D9488]">
                    {
                      selectedPayslip
                        .organization
                        .name
                    }
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-[#20243A]">
                    Employee Payslip
                  </h2>

                  <p className="mt-1 text-sm text-[#666B84]">
                    {
                      selectedPayslip
                        .employee
                        .fullName
                    }
                    {" · "}
                    {
                      selectedPayslip
                        .payrollPeriod
                        .name
                    }
                  </p>

                </div>

                <button
                  type="button"
                  onClick={
                    closePayslip
                  }
                  aria-label="Close payslip"
                  className="rounded-lg p-2 text-[#666B84] hover:bg-[#F8F9FC]"
                >
                  <X size={20} />
                </button>

              </div>

              {/* PAYSLIP DOCUMENT */}

              <div className="overflow-y-auto bg-[#F4F6F8] p-4 sm:p-8">

                <div className="mx-auto max-w-3xl bg-white p-6 shadow-sm sm:p-10">

                  {/* EMPLOYER HEADER */}

                  <div className="flex flex-col gap-4 border-b-2 border-[#0D9488] pb-6 sm:flex-row sm:items-start sm:justify-between">

                    <div className="min-w-0">

                      <p className="break-words text-xl font-bold text-[#20243A]">
                        {
                          selectedPayslip
                            .organization
                            .name
                        }
                      </p>

                      {selectedPayslip
                        .organization
                        .legalName && (
                        <p className="mt-1 text-xs text-[#666B84]">
                          {
                            selectedPayslip
                              .organization
                              .legalName
                          }
                        </p>
                      )}

                      <p className="mt-1 break-words text-xs text-[#666B84]">
                        {[
                          selectedPayslip
                            .organization
                            .address,

                          selectedPayslip
                            .organization
                            .phoneNumber,

                          selectedPayslip
                            .organization
                            .email,
                        ]
                          .filter(
                            Boolean
                          )
                          .join(
                            " · "
                          ) ||
                          "—"}
                      </p>

                    </div>

                    <div className="text-left sm:text-right">

                      <p className="text-2xl font-bold text-[#0D9488]">
                        PAYSLIP
                      </p>

                      <p className="mt-1 text-sm text-[#666B84]">
                        {
                          selectedPayslip
                            .payrollPeriod
                            .name
                        }
                      </p>

                      <span
                        className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(
                          selectedPayslip.status
                        )}`}
                      >
                        {statusLabel(
                          selectedPayslip
                            .status
                        )}
                      </span>

                    </div>

                  </div>

                  {/* EMPLOYEE INFORMATION */}

                  <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">

                    {[
                      [
                        "Employee",
                        selectedPayslip
                          .employee
                          .fullName,
                      ],

                      [
                        "Employee Number",
                        selectedPayslip
                          .employee
                          .employeeNumber,
                      ],

                      [
                        "Department",
                        selectedPayslip
                          .employee
                          .department ||
                          "—",
                      ],

                      [
                        "Position",
                        selectedPayslip
                          .employee
                          .jobTitle ||
                          "—",
                      ],

                      [
                        "Employment Type",
                        selectedPayslip
                          .employee
                          .employmentType ||
                          "—",
                      ],

                      [
                        "Pay Period",
                        `${formatDate(
                          selectedPayslip
                            .payrollPeriod
                            .periodStart
                        )} — ${formatDate(
                          selectedPayslip
                            .payrollPeriod
                            .periodEnd
                        )}`,
                      ],

                      [
                        "Processed",
                        formatDate(
                          selectedPayslip
                            .processedAt
                        ),
                      ],

                      [
                        "Payment Method",
                        paymentMethodLabel(selectedPayslip.employee.paymentMethod),
                      ],

                      ...(["BANK", "BANK_TRANSFER"].includes(String(selectedPayslip.employee.paymentMethod ?? "").toUpperCase())
                        ? [
                            ["Bank", selectedPayslip.employee.bankName || "—"],
                            ["Branch", selectedPayslip.employee.bankBranch || "—"],
                            ["Account Name", selectedPayslip.employee.bankAccountName || "—"],
                            ["Account Number", maskSensitive(selectedPayslip.employee.bankAccountNumber)],
                          ]
                        : ["MPESA", "M-PESA", "MOBILE_MONEY"].includes(String(selectedPayslip.employee.paymentMethod ?? "").toUpperCase())
                        ? [["M-Pesa Number", maskSensitive(selectedPayslip.employee.mobileMoneyNumber)]]
                        : []),
                    ].map(
                      ([
                        label,
                        value,
                      ]) => (
                        <div
                          key={
                            label
                          }
                        >

                          <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8FA3]">
                            {
                              label
                            }
                          </p>

                          <p className="mt-1 break-words font-semibold text-[#20243A]">
                            {
                              value
                            }
                          </p>

                        </div>
                      )
                    )}

                  </div>

                  {/* EARNINGS */}

                  <div className="mt-8">

                    <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-[#20243A]">
                      Earnings
                    </h3>

                    <div className="overflow-hidden rounded-xl border border-[#E7E9F0]">

                      <div className="flex justify-between gap-4 border-b border-[#EEF0F4] p-4 text-sm">
                        <span className="text-[#666B84]">
                          Basic Salary
                        </span>

                        <span className="whitespace-nowrap font-semibold tabular-nums text-[#20243A]">
                          {formatCurrency(
                            selectedPayslip
                              .earnings
                              .basicSalary
                          )}
                        </span>
                      </div>

                      {(selectedPayslip
                        .earnings
                        .items ?? []
                      ).length > 0 ? (
                        selectedPayslip
                          .earnings
                          .items
                          ?.map(
                            (
                              earning,
                              index
                            ) => (
                              <div
                                key={
                                  earning.id ||
                                  `${earning.type}-${index}`
                                }
                                className="flex justify-between gap-4 border-b border-[#EEF0F4] p-4 text-sm"
                              >
                                <div className="min-w-0">
                                  <p className="font-medium text-[#20243A]">
                                    {earning.description ||
                                      earningLabel(
                                        earning.type
                                      )}
                                  </p>
                                  <p className="mt-1 text-xs text-[#8A8FA3]">
                                    {earning.taxable
                                      ? "Taxable"
                                      : "Non-taxable"}
                                    {earning.recurring
                                      ? " · Recurring"
                                      : " · One-time"}
                                  </p>
                                </div>

                                <span className="whitespace-nowrap font-semibold tabular-nums text-[#20243A]">
                                  {formatCurrency(
                                    earning.amount
                                  )}
                                </span>
                              </div>
                            )
                          )
                      ) : (
                        <div className="flex justify-between gap-4 border-b border-[#EEF0F4] p-4 text-sm">
                          <span className="text-[#666B84]">
                            Allowances
                          </span>
                          <span className="whitespace-nowrap font-semibold tabular-nums text-[#20243A]">
                            {formatCurrency(
                              selectedPayslip
                                .earnings
                                .allowances
                            )}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between gap-4 bg-[#F8F9FC] p-4 text-sm font-bold">
                        <span>
                          Gross Salary
                        </span>

                        <span className="whitespace-nowrap tabular-nums">
                          {formatCurrency(
                            selectedPayslip
                              .earnings
                              .grossSalary
                          )}
                        </span>
                      </div>

                    </div>

                  </div>

                  {/* EMPLOYEE DEDUCTIONS */}

                  <div className="mt-7">

                    <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-[#20243A]">
                      Employee Deductions
                    </h3>

                    <div className="overflow-hidden rounded-xl border border-[#E7E9F0]">

                      {selectedPayslip
                        .deductions
                        .length ===
                      0 ? (
                        <div className="p-4 text-sm text-[#666B84]">
                          No deductions
                          for this
                          payroll.
                        </div>
                      ) : (
                        selectedPayslip.deductions.map(
                          (
                            deduction,
                            index
                          ) => (
                            <div
                              key={
                                deduction
                                  .id ||
                                `${deduction.type}-${index}`
                              }
                              className="flex justify-between gap-4 border-b border-[#EEF0F4] p-4 text-sm last:border-b-0"
                            >

                              <div className="min-w-0">

                                <p className="font-medium text-[#20243A]">
                                  {deductionLabel(
                                    deduction.type
                                  )}
                                </p>

                                {deduction.description && (
                                  <p className="mt-1 break-words text-xs text-[#8A8FA3]">
                                    {
                                      deduction.description
                                    }
                                  </p>
                                )}

                              </div>

                              <span className="whitespace-nowrap font-semibold tabular-nums text-red-600">
                                {formatCurrency(
                                  deduction.amount
                                )}
                              </span>

                            </div>
                          )
                        )
                      )}

                      <div className="flex justify-between gap-4 bg-[#FFF7ED] p-4 text-sm font-bold">

                        <span>
                          Total Deductions
                        </span>

                        <span className="whitespace-nowrap tabular-nums text-red-600">
                          {formatCurrency(
                            selectedPayslip
                              .totals
                              .totalDeductions
                          )}
                        </span>

                      </div>

                    </div>

                  </div>

                  {/* LOAN / ADVANCE BALANCES */}

                  <div className="mt-7">
                    <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-[#20243A]">
                      Loan / Advance Balances
                    </h3>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="rounded-xl border border-[#E7E9F0] bg-[#F8F9FC] p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8FA3]">Employee Loans</p>
                        <div className="mt-3 space-y-2 text-sm">
                          {(selectedPayslip.loanBalances?.loans ?? []).length === 0 ? (
                            <div className="flex justify-between"><span>Outstanding</span><span className="font-semibold">{formatCurrency(0)}</span></div>
                          ) : selectedPayslip.loanBalances?.loans.map((loan) => (
                            <div key={loan.id} className="rounded-lg bg-white p-3">
                              <div className="font-semibold text-[#20243A]">{loan.reference}</div>
                              <div className="mt-1 flex justify-between"><span>Opening</span><span>{formatCurrency(loan.openingBalance)}</span></div>
                              <div className="flex justify-between"><span>Repayment</span><span>{formatCurrency(loan.repayment)}</span></div>
                              <div className="flex justify-between font-semibold"><span>Closing</span><span>{formatCurrency(loan.closingBalance)}</span></div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-xl border border-[#E7E9F0] bg-[#F8F9FC] p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8FA3]">Salary Advances</p>
                        <div className="mt-3 space-y-2 text-sm">
                          {(selectedPayslip.salaryAdvanceBalances?.advances ?? []).length === 0 ? (
                            <div className="flex justify-between"><span>Outstanding</span><span className="font-semibold">{formatCurrency(0)}</span></div>
                          ) : selectedPayslip.salaryAdvanceBalances?.advances.map((advance) => (
                            <div key={advance.id} className="rounded-lg bg-white p-3">
                              <div className="font-semibold text-[#20243A]">{advance.reference}</div>
                              <div className="mt-1 flex justify-between"><span>Opening</span><span>{formatCurrency(advance.openingBalance)}</span></div>
                              <div className="flex justify-between"><span>Repayment</span><span>{formatCurrency(advance.repayment)}</span></div>
                              <div className="flex justify-between font-semibold"><span>Closing</span><span>{formatCurrency(advance.closingBalance)}</span></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* YEAR-TO-DATE */}

                  <div className="mt-7">
                    <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-[#20243A]">
                      Year-to-Date Summary
                    </h3>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {[
                        [
                          "YTD Basic Salary",
                          selectedPayslip.ytd?.basicSalary ?? 0,
                        ],
                        [
                          "YTD Gross Salary",
                          selectedPayslip.ytd?.grossSalary ?? 0,
                        ],
                        [
                          "YTD Deductions",
                          selectedPayslip.ytd?.totalDeductions ?? 0,
                        ],
                        [
                          "YTD Net Salary",
                          selectedPayslip.ytd?.netSalary ?? 0,
                        ],
                      ].map(
                        ([label, value]) => (
                          <div
                            key={label}
                            className="rounded-xl border border-[#E7E9F0] p-4"
                          >
                            <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8FA3]">
                              {label}
                            </p>
                            <p className="mt-2 font-bold tabular-nums text-[#20243A]">
                              {formatCurrency(
                                value as number
                              )}
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  {/* NET PAY */}

                  <div className="mt-7 rounded-xl bg-[#ECFDF5] p-5">

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

                      <span className="font-bold text-[#166534]">
                        NET PAY
                      </span>

                      <span className="text-2xl font-bold tabular-nums text-[#166534]">
                        {formatCurrency(
                          selectedPayslip
                            .totals
                            .netSalary
                        )}
                      </span>

                    </div>

                  </div>

                  {/* EMPLOYER CONTRIBUTIONS */}

                  <div className="mt-7">

                    <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-[#20243A]">
                      Employer Contributions
                    </h3>

                    <p className="mb-3 text-xs leading-5 text-[#8A8FA3]">
                      Employer
                      contributions
                      are employer
                      costs and are
                      not deducted
                      from employee
                      net pay.
                    </p>

                    <div className="overflow-hidden rounded-xl border border-[#E7E9F0]">

                      {selectedPayslip
                        .employerContributions
                        .length ===
                      0 ? (
                        <div className="p-4 text-sm text-[#666B84]">
                          No employer
                          contributions
                          recorded.
                        </div>
                      ) : (
                        selectedPayslip.employerContributions.map(
                          (
                            contribution,
                            index
                          ) => (
                            <div
                              key={
                                contribution
                                  .id ||
                                `${contribution.type}-${index}`
                              }
                              className="flex justify-between gap-4 border-b border-[#EEF0F4] p-4 text-sm last:border-b-0"
                            >

                              <div className="min-w-0">

                                <p className="break-words font-medium text-[#20243A]">
                                  {
                                    contribution.description ||
                                    deductionLabel(
                                      contribution.type
                                    )
                                  }
                                </p>

                                {!contribution.description && (
                                  <p className="mt-1 text-xs text-[#8A8FA3]">
                                    {statusLabel(
                                      contribution.type
                                    )}
                                  </p>
                                )}

                              </div>

                              <span className="whitespace-nowrap font-semibold tabular-nums text-[#20243A]">
                                {formatCurrency(
                                  contribution.amount
                                )}
                              </span>

                            </div>
                          )
                        )
                      )}

                      <div className="flex justify-between gap-4 bg-[#F8F9FC] p-4 text-sm font-bold">

                        <span>
                          Total Employer Contributions
                        </span>

                        <span className="whitespace-nowrap tabular-nums">
                          {formatCurrency(
                            selectedPayslip
                              .totals
                              .totalEmployerContributions
                          )}
                        </span>

                      </div>

                    </div>

                  </div>

                  {/* DOCUMENT FOOTER */}

                  <p className="mt-8 text-center text-xs leading-5 text-[#8A8FA3]">
                    This electronic payslip
                    is issued by{" "}
                    {
                      selectedPayslip
                        .organization
                        .name
                    }{" "}
                    for the payroll period
                    shown above.
                  </p>

                </div>

              </div>

              {/* PAYSLIP ACTIONS */}

              <div className="flex flex-col justify-end gap-3 border-t border-[#E7E9F0] p-4 sm:flex-row">

                <button
                  type="button"
                  onClick={
                    closePayslip
                  }
                  className="rounded-xl border border-[#DCDDEA] px-5 py-2.5 text-sm font-semibold text-[#20243A] hover:bg-[#F8F9FC]"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void generatePayslipPdf(
                      selectedPayslip
                    )
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D9488] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e]"
                >
                  <Download
                    size={17}
                  />

                  Download PDF
                </button>

              </div>

            </div>

          </div>
        )}

    </div>
  );
}