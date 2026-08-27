import {
  AlertCircle,
  CalendarDays,
  Download,
  Eye,
  FileText,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
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
  name: string;
  email?: string | null;
  phoneNumber?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  employmentType?: string | null;
  hireDate?: string | null;
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

interface PayrollResponse {
  success: boolean;

  summary?: {
    employees: number;
    grossPayroll: number;
    deductions: number;
    netPayroll: number;
  };

  periods?: PayrollPeriod[];

  message?: string;
}

interface PayslipResponse {
  success: boolean;

  message?: string;

  payslip?: {
    id: string;

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
      grossSalary: number;
    };

    deductions: PayrollDeduction[];

    totals: {
      grossSalary: number;
      totalDeductions: number;
      netSalary: number;
      totalEmployerContributions: number;
    };

    employerContributions: PayrollEmployerContribution[];

    status: string;

    processedAt?: string | null;
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

const emptyForm: RunPayrollForm = {
  name: "",
  periodStart: "",
  periodEnd: "",
};

/* =========================================================
   HELPERS
   ========================================================= */

function formatCurrency(
  value: number | string
): string {
  const amount =
    typeof value === "number"
      ? value
      : Number(
          String(value).replace(/,/g, "")
        );

  return new Intl.NumberFormat(
    "en-KE",
    {
      style: "currency",
      currency: "KES",
      maximumFractionDigits: 2,
    }
  ).format(
    Number.isFinite(amount)
      ? amount
      : 0
  );
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

function getCurrentMonthDates() {
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
    start:
      toInputDate(first),

    end:
      toInputDate(last),
  };
}

/* =========================================================
   PAYSLIP PDF
   ========================================================= */

function generatePayslipPdf(
  payslip: NonNullable<
    PayslipResponse["payslip"]
  >
) {
  const pdf =
    new jsPDF();

  const pageWidth =
    pdf.internal.pageSize.getWidth();

  let y = 20;

  const left = 20;

  const right =
    pageWidth - 20;

  const ensureSpace = (
    required = 10
  ) => {
    if (
      y + required >
      275
    ) {
      pdf.addPage();
      y = 20;
    }
  };

  const addLine = (
    label: string,
    value: string,
    bold = false
  ) => {
    ensureSpace(8);

    if (bold) {
      pdf.setFont(
        "helvetica",
        "bold"
      );
    } else {
      pdf.setFont(
        "helvetica",
        "normal"
      );
    }

    pdf.text(
      label,
      left,
      y
    );

    pdf.text(
      value,
      right,
      y,
      {
        align: "right",
      }
    );

    y += 8;
  };

  const addSection = (
    title: string
  ) => {
    ensureSpace(15);

    y += 5;

    pdf.setFont(
      "helvetica",
      "bold"
    );

    pdf.setFontSize(12);

    pdf.text(
      title,
      left,
      y
    );

    y += 8;

    pdf.setFontSize(10);
  };

  /* -------------------------------------------------------
     Header
     ------------------------------------------------------- */

  pdf.setFont(
    "helvetica",
    "bold"
  );

  pdf.setFontSize(20);

  pdf.text(
    "PAYSLIP",
    pageWidth / 2,
    y,
    {
      align: "center",
    }
  );

  y += 10;

  pdf.setFont(
    "helvetica",
    "normal"
  );

  pdf.setFontSize(10);

  pdf.text(
    payslip.payrollPeriod.name,
    pageWidth / 2,
    y,
    {
      align: "center",
    }
  );

  y += 12;

  pdf.line(
    left,
    y,
    right,
    y
  );

  y += 10;

  /* -------------------------------------------------------
     Employee
     ------------------------------------------------------- */

  addSection(
    "Employee Details"
  );

  addLine(
    "Employee",
    payslip.employee.fullName,
    true
  );

  addLine(
    "Employee Number",
    payslip.employee
      .employeeNumber
  );

  addLine(
    "Department",
    payslip.employee
      .department ??
      "—"
  );

  addLine(
    "Job Title",
    payslip.employee
      .jobTitle ??
      "—"
  );

  addLine(
    "Employment Type",
    payslip.employee
      .employmentType ??
      "—"
  );

  /* -------------------------------------------------------
     Period
     ------------------------------------------------------- */

  addSection(
    "Payroll Period"
  );

  addLine(
    "Period",
    `${formatDate(
      payslip.payrollPeriod
        .periodStart
    )} - ${formatDate(
      payslip.payrollPeriod
        .periodEnd
    )}`
  );

  addLine(
    "Processed",
    formatDate(
      payslip.processedAt
    )
  );

  /* -------------------------------------------------------
     Earnings
     ------------------------------------------------------- */

  addSection(
    "Earnings"
  );

  addLine(
    "Basic Salary",
    formatCurrency(
      payslip.earnings
        .basicSalary
    )
  );

  addLine(
    "Allowances",
    formatCurrency(
      payslip.earnings
        .allowances
    )
  );

  addLine(
    "Gross Salary",
    formatCurrency(
      payslip.earnings
        .grossSalary
    ),
    true
  );

  /* -------------------------------------------------------
     Deductions
     ------------------------------------------------------- */

  addSection(
    "Employee Deductions"
  );

  if (
    payslip.deductions
      .length === 0
  ) {
    addLine(
      "No deductions",
      formatCurrency(0)
    );
  } else {
    for (
      const deduction of
        payslip.deductions
    ) {
      addLine(
        deductionLabel(
          deduction.type
        ),
        formatCurrency(
          deduction.amount
        )
      );
    }
  }

  addLine(
    "Total Deductions",
    formatCurrency(
      payslip.totals
        .totalDeductions
    ),
    true
  );

  /* -------------------------------------------------------
     Net
     ------------------------------------------------------- */

  addSection(
    "Net Pay"
  );

  ensureSpace(15);

  pdf.setFont(
    "helvetica",
    "bold"
  );

  pdf.setFontSize(14);

  pdf.text(
    "NET SALARY",
    left,
    y
  );

  pdf.text(
    formatCurrency(
      payslip.totals
        .netSalary
    ),
    right,
    y,
    {
      align: "right",
    }
  );

  y += 12;

  /* -------------------------------------------------------
     Employer Contributions
     ------------------------------------------------------- */

  addSection(
    "Employer Contributions"
  );

  if (
    payslip
      .employerContributions
      .length === 0
  ) {
    addLine(
      "No employer contributions",
      formatCurrency(0)
    );
  } else {
    for (
      const contribution of
        payslip.employerContributions
    ) {
      addLine(
        contribution
          .description ||
          deductionLabel(
            contribution.type
          ),
        formatCurrency(
          contribution.amount
        )
      );
    }
  }

  addLine(
    "Total Employer Contributions",
    formatCurrency(
      payslip.totals
        .totalEmployerContributions
    ),
    true
  );

  /* -------------------------------------------------------
     Footer
     ------------------------------------------------------- */

  ensureSpace(25);

  y += 10;

  pdf.setFont(
    "helvetica",
    "normal"
  );

  pdf.setFontSize(8);

  pdf.text(
    "This payslip was generated from the Ziya Financial Operating System.",
    pageWidth / 2,
    y,
    {
      align: "center",
    }
  );

  y += 5;

  pdf.text(
    `Generated: ${formatDate(
      new Date().toISOString()
    )}`,
    pageWidth / 2,
    y,
    {
      align: "center",
    }
  );

  const safeEmployeeNumber =
    payslip.employee
      .employeeNumber
      .replace(
        /[^a-zA-Z0-9_-]/g,
        "_"
      );

  const safePeriod =
    payslip.payrollPeriod.name
      .replace(
        /[^a-zA-Z0-9_-]/g,
        "_"
      );

  pdf.save(
    `Payslip_${safeEmployeeNumber}_${safePeriod}.pdf`
  );
}

/* =========================================================
   COMPONENT
   ========================================================= */

export default function Payroll() {
  const [
    periods,
    setPeriods,
  ] = useState<
    PayrollPeriod[]
  >([]);

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
  ] = useState<
    string | null
  >(null);

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
    selectedPeriodId,
    setSelectedPeriodId,
  ] = useState<
    string | null
  >(null);

  const [
    selectedPayslip,
    setSelectedPayslip,
  ] = useState<
    NonNullable<
      PayslipResponse["payslip"]
    > | null
  >(null);

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

  const loadPayroll =
    async () => {
      try {
        setLoading(true);
        setError("");

        const response =
          await authenticatedFetch(
            "/api/payroll",
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
          !response.ok
        ) {
          throw new Error(
            data?.message ||
              `Failed to load payroll (${response.status}).`
          );
        }

        if (
          !data?.success
        ) {
          throw new Error(
            data?.message ||
              "Failed to load payroll."
          );
        }

        const loadedPeriods =
          data.periods ??
          [];

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

        if (
          selectedPeriodId &&
          loadedPeriods.some(
            (period) =>
              period.id ===
              selectedPeriodId
          )
        ) {
          return;
        }

        setSelectedPeriodId(
          loadedPeriods[0]
            ?.id ??
            null
        );
      } catch (
        err
      ) {
        setPeriods([]);

        setSummary({
          employees: 0,
          grossPayroll: 0,
          deductions: 0,
          netPayroll: 0,
        });

        setError(
          err instanceof
            Error
            ? err.message
            : "Failed to load payroll."
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    void loadPayroll();
  }, []);

  /* =======================================================
     SELECTED PERIOD
     ======================================================= */

  const selectedPeriod =
    useMemo(
      () =>
        periods.find(
          (period) =>
            period.id ===
            selectedPeriodId
        ) ??
        periods[0] ??
        null,
      [
        periods,
        selectedPeriodId,
      ]
    );

  /* =======================================================
     FILTER RECORDS
     ======================================================= */

  const records =
    useMemo(() => {
      const source =
        selectedPeriod
          ?.payrollRecords ??
        [];

      const term =
        search
          .trim()
          .toLowerCase();

      if (!term) {
        return source;
      }

      return source.filter(
        (record) => {
          const employee =
            record.employee;

          if (!employee) {
            return false;
          }

          return [
            employee.name,
            employee.employeeNumber,
            employee.department ??
              "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(
              term
            );
        }
      );
    }, [
      selectedPeriod,
      search,
    ]);

  /* =======================================================
     OPEN RUN PAYROLL
     ======================================================= */

  const openRunPayroll =
    () => {
      const dates =
        getCurrentMonthDates();

      setForm({
        name: "",
        periodStart:
          dates.start,
        periodEnd:
          dates.end,
      });

      setFormError("");
      setSuccess("");
      setShowRunModal(
        true
      );
    };

  const closeRunPayroll =
    () => {
      if (processing) {
        return;
      }

      setShowRunModal(
        false
      );

      setForm(emptyForm);

      setFormError("");
    };

  /* =======================================================
     RUN PAYROLL
     ======================================================= */

  const submitPayroll =
    async (
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
        setProcessing(
          true
        );

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

              body: JSON.stringify(
                {
                  name:
                    form.name.trim(),

                  periodStart:
                    start.toISOString(),

                  periodEnd:
                    end.toISOString(),

                  allowances: {},
                }
              ),
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
          !response.ok
        ) {
          throw new Error(
            data?.message ||
              `Failed to process payroll (${response.status}).`
          );
        }

        if (
          !data?.success
        ) {
          throw new Error(
            data?.message ||
              "Failed to process payroll."
          );
        }

        setSuccess(
          data.message ||
            "Payroll processed successfully."
        );

        setShowRunModal(
          false
        );

        setForm(emptyForm);

        await loadPayroll();

        if (
          data.period?.id
        ) {
          setSelectedPeriodId(
            data.period.id
          );
        }
      } catch (
        err
      ) {
        setFormError(
          err instanceof
            Error
            ? err.message
            : "Failed to process payroll."
        );
      } finally {
        setProcessing(
          false
        );
      }
    };

  /* =======================================================
     FETCH PAYSLIP
     ======================================================= */

  const fetchPayslip =
    async (
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
          !response.ok
        ) {
          throw new Error(
            data?.message ||
              `Failed to retrieve payslip (${response.status}).`
          );
        }

        if (
          !data?.success ||
          !data.payslip
        ) {
          throw new Error(
            data?.message ||
              "Payslip is not available."
          );
        }

        setSelectedPayslip(
          data.payslip
        );

        if (download) {
          generatePayslipPdf(
            data.payslip
          );
        } else {
          setShowPayslip(
            true
          );
        }
      } catch (
        err
      ) {
        setError(
          err instanceof
            Error
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

  const closePayslip =
    () => {
      setShowPayslip(
        false
      );

      setSelectedPayslip(
        null
      );
    };

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div className="space-y-6">
      {/* =====================================================
          HEADER
          ===================================================== */}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#20243A]">
            Payroll
          </h1>

          <p className="mt-2 text-[#666B84]">
            Manage salaries, deductions,
            payroll processing and payslips.
          </p>
        </div>

        <button
          type="button"
          onClick={
            openRunPayroll
          }
          className="flex items-center justify-center gap-2 rounded-lg bg-[#0D9488] px-4 py-2 font-medium text-white transition hover:bg-[#0f766e]"
        >
          <Plus size={18} />

          Run Payroll
        </button>
      </div>

      {/* =====================================================
          SUCCESS
          ===================================================== */}

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {success}
        </div>
      )}

      {/* =====================================================
          SUMMARY
          ===================================================== */}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-[#ECECF3] bg-white p-6">
          <p className="text-[#666B84]">
            Employees
          </p>

          <h2 className="mt-2 text-3xl font-bold leading-tight text-[#20243A]">
            {loading
              ? "—"
              : summary.employees}
          </h2>
        </div>

        <div className="min-w-0 overflow-hidden rounded-2xl border border-[#ECECF3] bg-white p-6">
          <p className="text-[#666B84]">
            Gross Payroll
          </p>

          <h2 className="mt-2 min-w-0 text-2xl font-bold leading-tight tracking-tight text-[#20243A] sm:text-3xl">
            {loading
              ? "—"
              : formatCurrency(
                  summary.grossPayroll
                )}
          </h2>
        </div>

        <div className="min-w-0 overflow-hidden rounded-2xl border border-[#ECECF3] bg-white p-6">
          <p className="text-[#666B84]">
            Deductions
          </p>

          <h2 className="mt-2 min-w-0 text-2xl font-bold leading-tight tracking-tight text-yellow-600 sm:text-3xl">
            {loading
              ? "—"
              : formatCurrency(
                  summary.deductions
                )}
          </h2>
        </div>

        <div className="min-w-0 overflow-hidden rounded-2xl border border-[#ECECF3] bg-white p-6">
          <p className="text-[#666B84]">
            Net Payroll
          </p>

          <h2 className="mt-2 min-w-0 text-2xl font-bold leading-tight tracking-tight text-green-600 sm:text-3xl">
            {loading
              ? "—"
              : formatCurrency(
                  summary.netPayroll
                )}
          </h2>
        </div>
      </div>

      {/* =====================================================
          PERIOD SELECTOR
          ===================================================== */}

      {!loading &&
        periods.length >
          0 && (
          <div className="rounded-2xl border border-[#ECECF3] bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
              <CalendarDays
                size={18}
                className="text-[#666B84]"
              />

              <span className="text-sm font-medium text-[#666B84]">
                Payroll Period
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {periods.map(
                (
                  period
                ) => (
                  <button
                    key={
                      period.id
                    }
                    type="button"
                    onClick={() =>
                      setSelectedPeriodId(
                        period.id
                      )
                    }
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                      selectedPeriod?.id ===
                      period.id
                        ? "border-[#0D9488] bg-[#0D9488]/10 text-[#0D9488]"
                        : "border-[#ECECF3] text-[#666B84] hover:border-[#0D9488]"
                    }`}
                  >
                    {
                      period.name
                    }
                  </button>
                )
              )}
            </div>
          </div>
        )}

      {/* =====================================================
          SEARCH
          ===================================================== */}

      <div className="rounded-2xl border border-[#ECECF3] bg-white p-4">
        <div className="flex items-center rounded-lg px-3">
          <Search
            size={18}
            className="text-[#666B84]"
          />

          <input
            type="text"
            value={search}
            onChange={(
              event
            ) =>
              setSearch(
                event.target
                  .value
              )
            }
            placeholder="Search employees..."
            className="flex-1 bg-transparent px-3 py-3 text-[#20243A] outline-none"
          />
        </div>
      </div>

      {/* =====================================================
          ERROR
          ===================================================== */}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle
              size={20}
              className="mt-0.5 shrink-0 text-red-600"
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
                className="mt-3 text-sm font-semibold text-red-700 underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          PAYROLL TABLE
          ===================================================== */}

      {!error && (
        <div className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white">
          {loading ? (
            <div className="flex min-h-[20rem] items-center justify-center text-[#666B84]">
              <div className="flex items-center gap-3">
                <Loader2
                  size={22}
                  className="animate-spin"
                />

                Loading payroll...
              </div>
            </div>
          ) : !selectedPeriod ? (
            <div className="p-12 text-center">
              <CalendarDays
                size={40}
                className="mx-auto text-[#666B84]"
              />

              <h2 className="mt-4 text-lg font-semibold text-[#20243A]">
                No payroll has been processed
              </h2>

              <p className="mt-2 text-sm text-[#666B84]">
                Run your first payroll to
                populate this table.
              </p>

              <button
                type="button"
                onClick={
                  openRunPayroll
                }
                className="mt-5 rounded-lg bg-[#0D9488] px-5 py-2.5 font-medium text-white hover:bg-[#0f766e]"
              >
                Run Payroll
              </button>
            </div>
          ) : records.length ===
            0 ? (
            <div className="p-12 text-center">
              <Search
                size={40}
                className="mx-auto text-[#666B84]"
              />

              <h2 className="mt-4 text-lg font-semibold text-[#20243A]">
                No payroll records found
              </h2>

              <p className="mt-2 text-sm text-[#666B84]">
                {search.trim()
                  ? "Try a different search."
                  : "This payroll period has no records."}
              </p>
            </div>
          ) : (
            <>
              <div className="border-b border-[#ECECF3] px-6 py-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="font-semibold text-[#20243A]">
                      {
                        selectedPeriod.name
                      }
                    </h2>

                    <p className="mt-1 text-sm text-[#666B84]">
                      {formatDate(
                        selectedPeriod.periodStart
                      )}{" "}
                      —{" "}
                      {formatDate(
                        selectedPeriod.periodEnd
                      )}
                    </p>
                  </div>

                  <span
                    className={`w-fit rounded-full px-3 py-1 text-sm ${
                      selectedPeriod.status ===
                      "PROCESSED"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {statusLabel(
                      selectedPeriod.status
                    )}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1150px]">
                  <thead className="bg-[#F8F9FC] text-[#666B84]">
                    <tr>
                      <th className="p-4 text-left font-medium">
                        Employee
                      </th>

                      <th className="p-4 text-left font-medium">
                        Department
                      </th>

                      <th className="p-4 text-right font-medium">
                        Basic
                      </th>

                      <th className="p-4 text-right font-medium">
                        Allowances
                      </th>

                      <th className="p-4 text-right font-medium">
                        Gross
                      </th>

                      <th className="p-4 text-right font-medium">
                        Deductions
                      </th>

                      <th className="p-4 text-right font-medium">
                        Net
                      </th>

                      <th className="p-4 text-left font-medium">
                        Status
                      </th>

                      <th className="p-4 text-right font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {records.map(
                      (
                        record
                      ) => (
                        <tr
                          key={
                            record.id
                          }
                          className="border-t border-[#ECECF3] hover:bg-[#FAFBFD]"
                        >
                          <td className="p-4">
                            <div>
                              <p className="font-medium text-[#20243A]">
                                {record
                                  .employee
                                  ?.name ||
                                  "Unknown employee"}
                              </p>

                              <p className="mt-1 text-xs text-[#888DA3]">
                                {record
                                  .employee
                                  ?.employeeNumber ||
                                  "—"}
                              </p>
                            </div>
                          </td>

                          <td className="p-4 text-[#666B84]">
                            {record
                              .employee
                              ?.department ||
                              "—"}
                          </td>

                          <td className="p-4 text-right text-[#20243A]">
                            {formatCurrency(
                              record.basicSalary
                            )}
                          </td>

                          <td className="p-4 text-right text-[#20243A]">
                            {formatCurrency(
                              record.allowances
                            )}
                          </td>

                          <td className="p-4 text-right font-medium text-[#20243A]">
                            {formatCurrency(
                              record.grossSalary
                            )}
                          </td>

                          <td className="p-4 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                void fetchPayslip(
                                  record.id
                                )
                              }
                              className="font-medium text-red-600 underline decoration-dotted underline-offset-2 hover:text-red-700"
                            >
                              {formatCurrency(
                                record.deductions
                              )}
                            </button>
                          </td>

                          <td className="p-4 text-right font-semibold text-green-600">
                            {formatCurrency(
                              record.netSalary
                            )}
                          </td>

                          <td className="p-4">
                            <span
                              className={`rounded-full px-3 py-1 text-sm ${
                                record.status ===
                                "PROCESSED"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-yellow-100 text-yellow-700"
                              }`}
                            >
                              {statusLabel(
                                record.status
                              )}
                            </span>
                          </td>

                          <td className="p-4">
                            <div className="flex justify-end gap-2">
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
                                className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCDDEA] px-3 py-2 text-sm font-medium text-[#20243A] hover:bg-[#F8F9FC] disabled:opacity-60"
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
                                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D9488] px-3 py-2 text-sm font-medium text-white hover:bg-[#0f766e] disabled:opacity-60"
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

              {/* =================================================
                  PERIOD TOTALS
                  ================================================= */}

              <div className="grid grid-cols-1 gap-4 border-t border-[#ECECF3] bg-[#F8F9FC] p-6 md:grid-cols-3">
                <div>
                  <p className="text-sm text-[#666B84]">
                    Period Gross
                  </p>

                  <p className="mt-1 text-lg font-semibold text-[#20243A]">
                    {formatCurrency(
                      selectedPeriod.totalGross
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-[#666B84]">
                    Period Deductions
                  </p>

                  <p className="mt-1 text-lg font-semibold text-red-600">
                    {formatCurrency(
                      selectedPeriod.totalDeductions
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-[#666B84]">
                    Period Net
                  </p>

                  <p className="mt-1 text-lg font-semibold text-green-600">
                    {formatCurrency(
                      selectedPeriod.totalNet
                    )}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* =====================================================
          RUN PAYROLL MODAL
          ===================================================== */}

      {showRunModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#ECECF3] p-6">
              <div>
                <h2 className="text-xl font-bold text-[#20243A]">
                  Run Payroll
                </h2>

                <p className="mt-1 text-sm text-[#666B84]">
                  Process payroll for all
                  active employees.
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
                className="rounded-lg p-2 text-[#666B84] hover:bg-[#F8F9FC]"
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

              <label className="block space-y-2">
                <span className="text-sm font-medium text-[#20243A]">
                  Payroll Period Name *
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
                      name:
                        event.target
                          .value,
                    })
                  }
                  placeholder="e.g. August 2026 Payroll"
                  className="w-full rounded-lg border border-[#DCDDEA] px-3 py-2.5 text-[#20243A] outline-none focus:border-[#0D9488]"
                  required
                />
              </label>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#20243A]">
                    Start Date *
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
                    className="w-full rounded-lg border border-[#DCDDEA] px-3 py-2.5 text-[#20243A] outline-none focus:border-[#0D9488]"
                    required
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#20243A]">
                    End Date *
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
                    className="w-full rounded-lg border border-[#DCDDEA] px-3 py-2.5 text-[#20243A] outline-none focus:border-[#0D9488]"
                    required
                  />
                </label>
              </div>

              <div className="rounded-xl bg-[#F8F9FC] p-4 text-sm text-[#666B84]">
                <p className="font-semibold text-[#20243A]">
                  Automatic payroll deductions
                </p>

                <p className="mt-2">
                  Payroll will calculate configured
                  PAYE, NSSF, SHIF, Housing Levy,
                  pension, HELB, salary advances,
                  employee loans and other deductions.
                </p>

                <p className="mt-2">
                  Employer NSSF, Housing Levy and
                  training levy are recorded separately
                  and are not deducted from employee
                  net salary.
                </p>
              </div>

              <div className="flex justify-end gap-3 border-t border-[#ECECF3] pt-5">
                <button
                  type="button"
                  onClick={
                    closeRunPayroll
                  }
                  disabled={
                    processing
                  }
                  className="rounded-lg border border-[#DCDDEA] px-5 py-2.5 font-medium text-[#20243A] hover:bg-[#F8F9FC]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    processing
                  }
                  className="flex items-center gap-2 rounded-lg bg-[#0D9488] px-5 py-2.5 font-medium text-white hover:bg-[#0f766e] disabled:cursor-not-allowed disabled:opacity-60"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
              {/* Header */}

              <div className="flex items-center justify-between border-b border-[#ECECF3] p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-[#0D9488]/10 p-3 text-[#0D9488]">
                    <FileText
                      size={22}
                    />
                  </div>

                  <div>
                    <h2 className="text-xl font-bold text-[#20243A]">
                      Payslip
                    </h2>

                    <p className="mt-1 text-sm text-[#666B84]">
                      {
                        selectedPayslip
                          .employee
                          .fullName
                      }{" "}
                      ·{" "}
                      {
                        selectedPayslip
                          .employee
                          .employeeNumber
                      }
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={
                    closePayslip
                  }
                  className="rounded-lg p-2 text-[#666B84] hover:bg-[#F8F9FC]"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content */}

              <div className="max-h-[70vh] overflow-y-auto p-6">
                {/* Employee details */}

                <div className="grid grid-cols-1 gap-4 rounded-xl bg-[#F8F9FC] p-5 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[#888DA3]">
                      Employee
                    </p>

                    <p className="mt-1 font-semibold text-[#20243A]">
                      {
                        selectedPayslip
                          .employee
                          .fullName
                      }
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-[#888DA3]">
                      Employee Number
                    </p>

                    <p className="mt-1 font-semibold text-[#20243A]">
                      {
                        selectedPayslip
                          .employee
                          .employeeNumber
                      }
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-[#888DA3]">
                      Department
                    </p>

                    <p className="mt-1 font-semibold text-[#20243A]">
                      {selectedPayslip
                        .employee
                        .department ||
                        "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-[#888DA3]">
                      Payroll Period
                    </p>

                    <p className="mt-1 font-semibold text-[#20243A]">
                      {
                        selectedPayslip
                          .payrollPeriod
                          .name
                      }
                    </p>
                  </div>
                </div>

                {/* Earnings */}

                <div className="mt-6">
                  <h3 className="mb-3 font-semibold text-[#20243A]">
                    Earnings
                  </h3>

                  <div className="overflow-hidden rounded-xl border border-[#ECECF3]">
                    <div className="flex justify-between border-b border-[#ECECF3] p-4">
                      <span className="text-[#666B84]">
                        Basic Salary
                      </span>

                      <span className="font-medium text-[#20243A]">
                        {formatCurrency(
                          selectedPayslip
                            .earnings
                            .basicSalary
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between border-b border-[#ECECF3] p-4">
                      <span className="text-[#666B84]">
                        Allowances
                      </span>

                      <span className="font-medium text-[#20243A]">
                        {formatCurrency(
                          selectedPayslip
                            .earnings
                            .allowances
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between bg-[#F8F9FC] p-4">
                      <span className="font-semibold text-[#20243A]">
                        Gross Salary
                      </span>

                      <span className="font-bold text-[#20243A]">
                        {formatCurrency(
                          selectedPayslip
                            .earnings
                            .grossSalary
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Deductions */}

                <div className="mt-6">
                  <h3 className="mb-3 font-semibold text-[#20243A]">
                    Employee Deductions
                  </h3>

                  <div className="overflow-hidden rounded-xl border border-[#ECECF3]">
                    {selectedPayslip
                      .deductions
                      .length ===
                    0 ? (
                      <div className="p-5 text-sm text-[#666B84]">
                        No deductions for this
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
                              deduction.id ||
                              `${deduction.type}-${index}`
                            }
                            className="flex justify-between border-b border-[#ECECF3] p-4 last:border-b-0"
                          >
                            <div>
                              <p className="font-medium text-[#20243A]">
                                {deductionLabel(
                                  deduction.type
                                )}
                              </p>

                              {deduction.description && (
                                <p className="mt-1 text-xs text-[#888DA3]">
                                  {
                                    deduction.description
                                  }
                                </p>
                              )}
                            </div>

                            <span className="font-medium text-red-600">
                              {formatCurrency(
                                deduction.amount
                              )}
                            </span>
                          </div>
                        )
                      )
                    )}

                    <div className="flex justify-between bg-[#FFF7ED] p-4">
                      <span className="font-semibold text-[#20243A]">
                        Total Deductions
                      </span>

                      <span className="font-bold text-red-600">
                        {formatCurrency(
                          selectedPayslip
                            .totals
                            .totalDeductions
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Net salary */}

                <div className="mt-6 rounded-xl bg-[#ECFDF5] p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-[#166534]">
                      Net Salary
                    </span>

                    <span className="text-2xl font-bold text-[#166534]">
                      {formatCurrency(
                        selectedPayslip
                          .totals
                          .netSalary
                      )}
                    </span>
                  </div>
                </div>

                {/* Employer contributions */}

                <div className="mt-6">
                  <h3 className="mb-3 font-semibold text-[#20243A]">
                    Employer Contributions
                  </h3>

                  <p className="mb-3 text-xs text-[#888DA3]">
                    These are employer costs and are
                    not deducted from the employee's
                    net salary.
                  </p>

                  <div className="overflow-hidden rounded-xl border border-[#ECECF3]">
                    {selectedPayslip
                      .employerContributions
                      .map(
                        (
                          contribution,
                          index
                        ) => (
                          <div
                            key={
                              contribution.id ||
                              `${contribution.type}-${index}`
                            }
                            className="flex justify-between border-b border-[#ECECF3] p-4 last:border-b-0"
                          >
                            <div>
                              <p className="font-medium text-[#20243A]">
                                {
                                  contribution.description
                                }
                              </p>

                              <p className="mt-1 text-xs text-[#888DA3]">
                                {statusLabel(
                                  contribution.type
                                )}
                              </p>
                            </div>

                            <span className="font-medium text-[#20243A]">
                              {formatCurrency(
                                contribution.amount
                              )}
                            </span>
                          </div>
                        )
                      )}

                    <div className="flex justify-between bg-[#F8F9FC] p-4">
                      <span className="font-semibold text-[#20243A]">
                        Total Employer Contributions
                      </span>

                      <span className="font-bold text-[#20243A]">
                        {formatCurrency(
                          selectedPayslip
                            .totals
                            .totalEmployerContributions
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}

              <div className="flex flex-col justify-end gap-3 border-t border-[#ECECF3] p-6 sm:flex-row">
                <button
                  type="button"
                  onClick={
                    closePayslip
                  }
                  className="rounded-lg border border-[#DCDDEA] px-5 py-2.5 font-medium text-[#20243A] hover:bg-[#F8F9FC]"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() =>
                    generatePayslipPdf(
                      selectedPayslip
                    )
                  }
                  className="flex items-center justify-center gap-2 rounded-lg bg-[#0D9488] px-5 py-2.5 font-medium text-white hover:bg-[#0f766e]"
                >
                  <Download
                    size={17}
                  />

                  Download Payslip PDF
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}