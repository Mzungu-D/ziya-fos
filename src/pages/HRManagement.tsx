import {
  AlertCircle,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  FormEvent,
  ReactNode,
} from "react";
import { authenticatedFetch } from "../lib/auth-session";

interface ManagerOption {
  id: string;
  employeeNumber: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  name: string;
  jobTitle?: string | null;
  department?: string | null;
}

interface Employee {
  id: string;
  employeeNumber: string;

  firstName: string;
  middleName?: string | null;
  lastName: string;
  name: string;

  email?: string | null;
  phoneNumber?: string | null;
  alternativePhone?: string | null;

  department?: string | null;
  jobTitle?: string | null;
  employmentType?: string | null;

  hireDate: string;
  probationEndDate?: string | null;
  terminationDate?: string | null;
  workLocation?: string | null;

  basicSalary: number | string;
  status: string;

  dateOfBirth?: string | null;
  gender?: string | null;
  maritalStatus?: string | null;
  nationality?: string | null;

  nationalId?: string | null;
  passportNumber?: string | null;

  address?: string | null;
  city?: string | null;
  county?: string | null;
  postalCode?: string | null;

  emergencyContactName?: string | null;
  emergencyContactRelationship?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactEmail?: string | null;

  employmentNotes?: string | null;

  /* Statutory & Tax */
  kraPin?: string | null;
  nssfNumber?: string | null;
  shaNumber?: string | null;
  payeApplicable?: boolean;
  housingLevyApplicable?: boolean;

  managerId?: string | null;

  manager?: ManagerOption | null;

  bankName?: string | null;
  bankBranch?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  mobileMoneyNumber?: string | null;
  paymentMethod?: string | null;

  createdAt?: string;
  updatedAt?: string;
}

interface DirectReport {
  id: string;
  employeeNumber: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  name: string;
  jobTitle?: string | null;
  department?: string | null;
  status?: string;
}

interface PayrollRecord {
  id: string;
  payrollPeriodId: string;
  basicSalary: number | string;
  allowances: number | string;
  grossSalary: number | string;
  deductions: number | string;
  netSalary: number | string;
  status: string;
  processedAt?: string | null;
  createdAt: string;
}

interface EmployeeEarning {
  id: string;
  employeeId: string;
  organizationId?: string;
  type: string;
  description?: string | null;
  amount: number | string;
  recurring: boolean;
  taxable: boolean;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

interface EmployeeLoan {
  id: string;
  employeeId: string;
  organizationId?: string;
  reference: string;
  description?: string | null;
  principalAmount: number | string;
  outstandingBalance: number | string;
  monthlyRepayment: number | string;
  startDate: string;
  endDate?: string | null;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

interface EmployeeLoansResponse {
  success: boolean;
  loans?: EmployeeLoan[];
  count?: number;
  message?: string;
}

interface EmployeeLoanResponse {
  success: boolean;
  loan?: EmployeeLoan;
  message?: string;
}

interface EmployeeLoanForm {
  reference: string;
  description: string;
  principalAmount: string;
  repaymentMonths: string;
  outstandingBalance: string;
  monthlyRepayment: string;
  startDate: string;
  endDate: string;
  status: string;
}

const emptyEmployeeLoanForm: EmployeeLoanForm = {
  reference: "",
  description: "",
  principalAmount: "",
  repaymentMonths: "",
  outstandingBalance: "",
  monthlyRepayment: "",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
  status: "ACTIVE",
};

interface SalaryAdvance {
  id: string;
  employeeId: string;
  organizationId?: string;
  reference: string;
  amount: number | string;
  outstandingBalance: number | string;
  monthlyRepayment: number | string;
  issuedDate: string;
  status: string;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface SalaryAdvancesResponse {
  success: boolean;
  salaryAdvances?: SalaryAdvance[];
  count?: number;
  message?: string;
}

interface SalaryAdvanceResponse {
  success: boolean;
  salaryAdvance?: SalaryAdvance;
  message?: string;
}

interface SalaryAdvanceForm {
  reference: string;
  amount: string;
  repaymentMonths: string;
  outstandingBalance: string;
  monthlyRepayment: string;
  issuedDate: string;
  status: string;
  notes: string;
}

const emptySalaryAdvanceForm: SalaryAdvanceForm = {
  reference: "",
  amount: "",
  repaymentMonths: "",
  outstandingBalance: "",
  monthlyRepayment: "",
  issuedDate: new Date().toISOString().slice(0, 10),
  status: "ACTIVE",
  notes: "",
};

interface EmployeeEarningsResponse {
  success: boolean;
  earnings?: EmployeeEarning[];
  message?: string;
}

interface EmployeeEarningResponse {
  success: boolean;
  earning?: EmployeeEarning;
  message?: string;
}

interface EmployeeEarningForm {
  type: string;
  description: string;
  amount: string;
  recurring: boolean;
  taxable: boolean;
  effectiveFrom: string;
  effectiveTo: string;
  status: string;
}

const emptyEmployeeEarningForm: EmployeeEarningForm = {
  type: "HOUSING_ALLOWANCE",
  description: "",
  amount: "",
  recurring: true,
  taxable: true,
  effectiveFrom: new Date().toISOString().slice(0, 10),
  effectiveTo: "",
  status: "ACTIVE",
};

interface EmployeesResponse {
  success: boolean;
  employees?: Employee[];
  count?: number;
  message?: string;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

interface EmployeeResponse {
  success: boolean;
  employee?: Employee;
  payrollRecords?: PayrollRecord[];
  message?: string;
}

interface EmployeeStatsResponse {
  success: boolean;
  stats?: {
    totalEmployees: number;
    activeEmployees: number;
    onLeaveEmployees: number;
    inactiveEmployees: number;
    terminatedEmployees: number;

    departments: Array<{
      name: string;
      count: number;
    }>;

    departmentCount: number;

    employmentTypes?: Array<{
      type: string;
      count: number;
    }>;
  };
  message?: string;
}

interface EmployeeForm {
  employeeNumber: string;

  firstName: string;
  middleName: string;
  lastName: string;

  email: string;
  phoneNumber: string;
  alternativePhone: string;

  department: string;
  jobTitle: string;
  employmentType: string;

  hireDate: string;
  probationEndDate: string;
  terminationDate: string;
  workLocation: string;

  basicSalary: string;
  status: string;

  dateOfBirth: string;
  gender: string;
  maritalStatus: string;
  nationality: string;

  nationalId: string;
  passportNumber: string;

  address: string;
  city: string;
  county: string;
  postalCode: string;

  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactPhone: string;
  emergencyContactEmail: string;

  employmentNotes: string;

  kraPin: string;
  nssfNumber: string;
  shaNumber: string;
  payeApplicable: string;
  housingLevyApplicable: string;

  bankName: string;
  bankBranch: string;
  bankAccountName: string;
  bankAccountNumber: string;
  mobileMoneyNumber: string;
  paymentMethod: string;

  // Optional initial payroll financial records
  initialLoanAmount: string;
  initialLoanRepaymentMonths: string;
  initialLoanStartDate: string;
  initialLoanReference: string;
  initialAdvanceAmount: string;
  initialAdvanceRepaymentMonths: string;
  initialAdvanceIssuedDate: string;
  initialAdvanceReference: string;
}

const emptyForm: EmployeeForm = {
  employeeNumber: "",

  firstName: "",
  middleName: "",
  lastName: "",

  email: "",
  phoneNumber: "",
  alternativePhone: "",

  department: "",
  jobTitle: "",
  employmentType: "FULL_TIME",

  hireDate: "",
  probationEndDate: "",
  terminationDate: "",
  workLocation: "",

  basicSalary: "",
  status: "ACTIVE",

  dateOfBirth: "",
  gender: "",
  maritalStatus: "",
  nationality: "Kenyan",

  nationalId: "",
  passportNumber: "",

  address: "",
  city: "",
  county: "",
  postalCode: "",

  emergencyContactName: "",
  emergencyContactRelationship: "",
  emergencyContactPhone: "",
  emergencyContactEmail: "",

  employmentNotes: "",

  kraPin: "",
  nssfNumber: "",
  shaNumber: "",
  payeApplicable: "true",
  housingLevyApplicable: "true",

  bankName: "",
  bankBranch: "",
  bankAccountName: "",
  bankAccountNumber: "",
  mobileMoneyNumber: "",
  paymentMethod: "",

  initialLoanAmount: "",
  initialLoanRepaymentMonths: "",
  initialLoanStartDate: new Date().toISOString().slice(0, 10),
  initialLoanReference: "",
  initialAdvanceAmount: "",
  initialAdvanceRepaymentMonths: "",
  initialAdvanceIssuedDate: new Date().toISOString().slice(0, 10),
  initialAdvanceReference: "",
};

function formatCurrency(
  value: number | string
): string {
  const amount =
    typeof value === "number"
      ? value
      : Number(
          String(value).replace(/,/g, "")
        );

  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(
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

  if (Number.isNaN(date.getTime())) {
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

function dateInputValue(
  value?: string | null
): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return date
    .toISOString()
    .slice(0, 10);
}

function statusLabel(
  status?: string | null
): string {
  if (!status) {
    return "—";
  }

  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(
      /\b\w/g,
      (char) =>
        char.toUpperCase()
    );
}

function statusClasses(
  status?: string | null
): string {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";

    case "ON_LEAVE":
      return "bg-amber-50 text-amber-700 border-amber-200";

    case "TERMINATED":
      return "bg-red-50 text-red-700 border-red-200";

    case "INACTIVE":
      return "bg-slate-100 text-slate-600 border-slate-200";

    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

function fieldValue(
  value?: string | null
): string {
  return value?.trim()
    ? value
    : "—";
}

export default function HRManagement() {
  const [
    employees,
    setEmployees,
  ] = useState<Employee[]>([]);
const [
    loading,
    setLoading,
  ] = useState(true);
const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    editingSaving,
    setEditingSaving,
  ] = useState(false);

  const [
    deletingEmployeeId,
    setDeletingEmployeeId,
  ] = useState<string | null>(null);

  const [
    loadingEmployeeId,
    setLoadingEmployeeId,
  ] = useState<string | null>(null);

  const [
    error,
    setError,
  ] = useState("");

  const [
    formError,
    setFormError,
  ] = useState("");

  const [
    editError,
    setEditError,
  ] = useState("");

  const [
    actionError,
    setActionError,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("");

  const [
    departmentFilter,
    setDepartmentFilter,
  ] = useState("");

  const [
    page,
    setPage,
  ] = useState(1);

  const pageSize = 25;

  const [
    totalEmployees,
    setTotalEmployees,
  ] = useState(0);

  const [
    totalPages,
    setTotalPages,
  ] = useState(0);

  const [
    showAddModal,
    setShowAddModal,
  ] = useState(false);

  const [
    viewingEmployee,
    setViewingEmployee,
  ] = useState<
    (Employee & {
      payrollRecords?: PayrollRecord[];
      directReports?: DirectReport[];
    }) | null
  >(null);

  const [
    employeeEarnings,
    setEmployeeEarnings,
  ] = useState<EmployeeEarning[]>([]);

  const [
    earningsLoading,
    setEarningsLoading,
  ] = useState(false);

  const [
    earningSaving,
    setEarningSaving,
  ] = useState(false);

  const [
    earningDeletingId,
    setEarningDeletingId,
  ] = useState<string | null>(null);

  const [
    earningError,
    setEarningError,
  ] = useState("");

  const [
    showEarningForm,
    setShowEarningForm,
  ] = useState(false);

  const [
    editingEarning,
    setEditingEarning,
  ] = useState<EmployeeEarning | null>(null);

  const [
    earningForm,
    setEarningForm,
  ] = useState<EmployeeEarningForm>(
    emptyEmployeeEarningForm
  );

  // Employee loan state
  const [
    employeeLoans,
    setEmployeeLoans,
  ] = useState<EmployeeLoan[]>([]);

  const [
    loansLoading,
    setLoansLoading,
  ] = useState(false);

  const [
    loanSaving,
    setLoanSaving,
  ] = useState(false);

  const [
    loanDeletingId,
    setLoanDeletingId,
  ] = useState<string | null>(null);

  const [
    loanError,
    setLoanError,
  ] = useState("");

  const [
    showLoanForm,
    setShowLoanForm,
  ] = useState(false);

  const [
    editingLoan,
    setEditingLoan,
  ] = useState<EmployeeLoan | null>(null);

  const [
    loanForm,
    setLoanForm,
  ] = useState<EmployeeLoanForm>(
    emptyEmployeeLoanForm
  );

  // Salary advance state
  const [
    salaryAdvances,
    setSalaryAdvances,
  ] = useState<SalaryAdvance[]>([]);

  const [
    advancesLoading,
    setAdvancesLoading,
  ] = useState(false);

  const [
    advanceSaving,
    setAdvanceSaving,
  ] = useState(false);

  const [
    advanceDeletingId,
    setAdvanceDeletingId,
  ] = useState<string | null>(null);

  const [
    advanceError,
    setAdvanceError,
  ] = useState("");

  const [
    showAdvanceForm,
    setShowAdvanceForm,
  ] = useState(false);

  const [
    editingAdvance,
    setEditingAdvance,
  ] = useState<SalaryAdvance | null>(null);

  const [
    advanceForm,
    setAdvanceForm,
  ] = useState<SalaryAdvanceForm>(
    emptySalaryAdvanceForm
  );

  const [
    editingEmployee,
    setEditingEmployee,
  ] = useState<Employee | null>(null);

  const [
    form,
    setForm,
  ] = useState<EmployeeForm>(
    emptyForm
  );

  const [
    editForm,
    setEditForm,
  ] = useState<EmployeeForm>(
    emptyForm
  );

  const [
    stats,
    setStats,
  ] = useState({
    total: 0,
    active: 0,
    onLeave: 0,
    inactive: 0,
    terminated: 0,
    departments: 0,
  });

  const loadEmployees =
    async () => {
      try {
        setLoading(true);
        setError("");

        const params =
          new URLSearchParams();

        params.set(
          "page",
          String(page)
        );

        params.set(
          "pageSize",
          String(pageSize)
        );

        if (search.trim()) {
          params.set(
            "search",
            search.trim()
          );
        }

        if (statusFilter) {
          params.set(
            "status",
            statusFilter
          );
        }

        if (departmentFilter) {
          params.set(
            "department",
            departmentFilter
          );
        }

        const response =
          await authenticatedFetch(
            `/api/employees?${params.toString()}`,
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
            | EmployeesResponse
            | null;

        if (!response.ok) {
          throw new Error(
            data?.message ||
              `Failed to load employees (${response.status}).`
          );
        }

        if (!data?.success) {
          throw new Error(
            data?.message ||
              "Failed to load employees."
          );
        }

        setEmployees(
          data.employees ?? []
        );

        setTotalEmployees(
          data.pagination?.total ??
            data.count ??
            0
        );

        setTotalPages(
          data.pagination?.totalPages ??
            0
        );
      } catch (err) {
        setEmployees([]);

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load employees."
        );
      } finally {
        setLoading(false);
      }
    };

  const loadStats =
    async () => {
      try {
        const response =
          await authenticatedFetch(
            "/api/employees/stats",
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
            | EmployeeStatsResponse
            | null;

        if (!response.ok) {
          return;
        }

        if (
          data?.success &&
          data.stats
        ) {
          setStats({
            total:
              data.stats.totalEmployees ?? 0,

            active:
              data.stats.activeEmployees ?? 0,

            onLeave:
              data.stats.onLeaveEmployees ?? 0,

            inactive:
              data.stats.inactiveEmployees ?? 0,

            terminated:
              data.stats.terminatedEmployees ?? 0,

            departments:
              data.stats.departmentCount ?? 0,
          });
        }
      } catch (err) {
        console.error(
          "[HR] Failed to load statistics:",
          err
        );
      }
    };
useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          void loadEmployees();
        },
        search.trim()
          ? 300
          : 0
      );

    return () => {
      window.clearTimeout(
        timer
      );
    };
  }, [
    page,
    search,
    statusFilter,
    departmentFilter,
  ]);

  useEffect(() => {
    void loadStats();
  }, []);

  const departments =
    useMemo(() => {
      return Array.from(
        new Set(
          employees
            .map(
              (employee) =>
                employee.department
            )
            .filter(
              (
                department
              ): department is string =>
                Boolean(
                  department
                )
            )
        )
      ).sort(
        (a: string, b: string) =>
          a.localeCompare(b)
      );
    }, [employees]);

  const openAddEmployee =
    () => {
      setForm(emptyForm);
      setFormError("");
      setActionError("");

      setShowAddModal(true);
    };

  const closeAddEmployee =
    () => {
      if (saving) {
        return;
      }

      setShowAddModal(false);
      setForm(emptyForm);
      setFormError("");
    };

  const submitEmployee =
    async (
      event: FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      setFormError("");

      if (
        !form.employeeNumber.trim() ||
        !form.firstName.trim() ||
        !form.lastName.trim() ||
        !form.hireDate
      ) {
        setFormError(
          "Employee number, first name, last name and hire date are required."
        );
        return;
      }

      const salary =
        Number(
          form.basicSalary
        );

      if (
        !Number.isFinite(
          salary
        ) ||
        salary < 0
      ) {
        setFormError(
          "Please enter a valid non-negative basic salary."
        );
        return;
      }

      const initialLoanAmount = Number(form.initialLoanAmount);
      const initialLoanRepaymentMonths = Number(form.initialLoanRepaymentMonths);
      const initialAdvanceAmount = Number(form.initialAdvanceAmount);
      const initialAdvanceRepaymentMonths = Number(form.initialAdvanceRepaymentMonths);
      const hasInitialLoan = form.initialLoanAmount.trim() !== "";
      const hasInitialAdvance = form.initialAdvanceAmount.trim() !== "";

      if (hasInitialLoan) {
        if (!Number.isFinite(initialLoanAmount) || initialLoanAmount <= 0) {
          setFormError("Initial employee loan amount must be greater than zero.");
          return;
        }
        if (
          !Number.isInteger(initialLoanRepaymentMonths) ||
          initialLoanRepaymentMonths < 1 ||
          initialLoanRepaymentMonths > 120
        ) {
          setFormError("Employee loan repayment period must be between 1 and 120 months.");
          return;
        }
        if (!form.initialLoanStartDate) {
          setFormError("Employee loan start date is required.");
          return;
        }
      }

      if (hasInitialAdvance) {
        if (!Number.isFinite(initialAdvanceAmount) || initialAdvanceAmount <= 0) {
          setFormError("Initial salary advance amount must be greater than zero.");
          return;
        }
        if (
          !Number.isInteger(initialAdvanceRepaymentMonths) ||
          initialAdvanceRepaymentMonths < 1 ||
          initialAdvanceRepaymentMonths > 120
        ) {
          setFormError("Salary advance repayment period must be between 1 and 120 months.");
          return;
        }
        if (!form.initialAdvanceIssuedDate) {
          setFormError("Salary advance issue date is required.");
          return;
        }
      }

      try {
        setSaving(true);

        const response =
          await authenticatedFetch(
            "/api/employees",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
                Accept:
                  "application/json",
              },
              body:
                JSON.stringify({
                  employeeNumber:
                    form.employeeNumber.trim(),

                  firstName:
                    form.firstName.trim(),

                  middleName:
                    form.middleName.trim() ||
                    undefined,

                  lastName:
                    form.lastName.trim(),

                  email:
                    form.email.trim() ||
                    undefined,

                  phoneNumber:
                    form.phoneNumber.trim() ||
                    undefined,

                  alternativePhone:
                    form.alternativePhone.trim() ||
                    undefined,

                  department:
                    form.department.trim() ||
                    undefined,

                  jobTitle:
                    form.jobTitle.trim() ||
                    undefined,

                  employmentType:
                    form.employmentType.trim() ||
                    "FULL_TIME",

                  hireDate:
                    form.hireDate,

                  probationEndDate:
                    form.probationEndDate ||
                    undefined,

                  terminationDate:
                    form.terminationDate ||
                    undefined,

                  workLocation:
                    form.workLocation.trim() ||
                    undefined,

                  basicSalary:
                    salary,

                  status:
                    form.status ||
                    "ACTIVE",

                  dateOfBirth:
                    form.dateOfBirth ||
                    undefined,

                  gender:
                    form.gender.trim() ||
                    undefined,

                  maritalStatus:
                    form.maritalStatus.trim() ||
                    undefined,

                  nationality:
                    form.nationality.trim() ||
                    undefined,

                  nationalId:
                    form.nationalId.trim() ||
                    undefined,

                  passportNumber:
                    form.passportNumber.trim() ||
                    undefined,

                  address:
                    form.address.trim() ||
                    undefined,

                  city:
                    form.city.trim() ||
                    undefined,

                  county:
                    form.county.trim() ||
                    undefined,

                  postalCode:
                    form.postalCode.trim() ||
                    undefined,

                  emergencyContactName:
                    form.emergencyContactName.trim() ||
                    undefined,

                  emergencyContactRelationship:
                    form.emergencyContactRelationship.trim() ||
                    undefined,

                  emergencyContactPhone:
                    form.emergencyContactPhone.trim() ||
                    undefined,

                  emergencyContactEmail:
                    form.emergencyContactEmail.trim() ||
                    undefined,

                  employmentNotes:
                    form.employmentNotes.trim() ||
                    undefined,

                  kraPin:
                    form.kraPin.trim() ||
                    undefined,

                  nssfNumber:
                    form.nssfNumber.trim() ||
                    undefined,

                  shaNumber:
                    form.shaNumber.trim() ||
                    undefined,

                  payeApplicable:
                    form.payeApplicable === "true",

                  housingLevyApplicable:
                    form.housingLevyApplicable === "true",

                  bankName:
                    form.bankName.trim() ||
                    undefined,

                  bankBranch:
                    form.bankBranch.trim() ||
                    undefined,

                  bankAccountName:
                    form.bankAccountName.trim() ||
                    undefined,

                  bankAccountNumber:
                    form.bankAccountNumber.trim() ||
                    undefined,

                  mobileMoneyNumber:
                    form.mobileMoneyNumber.trim() ||
                    undefined,

                  paymentMethod:
                    form.paymentMethod.trim() ||
                    undefined,
                }),
            }
          );

        const data =
          (await response
            .json()
            .catch(
              () => null
            )) as {
            success?: boolean;
            message?: string;
            employee?: Employee;
          } | null;

        if (!response.ok) {
          throw new Error(
            data?.message ||
              `Failed to create employee (${response.status}).`
          );
        }

        if (!data?.success || !data.employee) {
          throw new Error(
            data?.message ||
              "Failed to create employee."
          );
        }

        const createdEmployeeId = data.employee.id;
        const financialRecordErrors: string[] = [];

        if (hasInitialLoan) {
          try {
            const loanResponse = await authenticatedFetch(
              `/api/employees/${createdEmployeeId}/loans`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Accept: "application/json",
                },
                body: JSON.stringify({
                  reference:
                    form.initialLoanReference.trim() ||
                    `LOAN-${form.employeeNumber.trim()}-${form.initialLoanStartDate.replace(/-/g, "")}`,
                  description: "Initial employee loan",
                  principalAmount: initialLoanAmount,
                  repaymentMonths: initialLoanRepaymentMonths,
                  outstandingBalance: initialLoanAmount,
                  monthlyRepayment: Number(
                    (initialLoanAmount / initialLoanRepaymentMonths).toFixed(2)
                  ),
                  startDate: form.initialLoanStartDate,
                  status: "ACTIVE",
                }),
              }
            );

            const loanData = (await loanResponse.json().catch(() => null)) as {
              success?: boolean;
              message?: string;
            } | null;

            if (!loanResponse.ok || !loanData?.success) {
              financialRecordErrors.push(
                loanData?.message || "The initial employee loan could not be recorded."
              );
            }
          } catch (loanError) {
            financialRecordErrors.push(
              loanError instanceof Error
                ? loanError.message
                : "The initial employee loan could not be recorded."
            );
          }
        }

        if (hasInitialAdvance) {
          try {
            const advanceResponse = await authenticatedFetch(
              `/api/employees/${createdEmployeeId}/advances`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Accept: "application/json",
                },
                body: JSON.stringify({
                  reference:
                    form.initialAdvanceReference.trim() ||
                    `ADV-${form.employeeNumber.trim()}-${form.initialAdvanceIssuedDate.replace(/-/g, "")}`,
                  amount: initialAdvanceAmount,
                  outstandingBalance: initialAdvanceAmount,
                  repaymentMonths: initialAdvanceRepaymentMonths,
                  monthlyRepayment: Number(
                    (initialAdvanceAmount / initialAdvanceRepaymentMonths).toFixed(2)
                  ),
                  issuedDate: form.initialAdvanceIssuedDate,
                  status: "ACTIVE",
                  notes: "Initial salary advance",
                }),
              }
            );

            const advanceData = (await advanceResponse.json().catch(() => null)) as {
              success?: boolean;
              message?: string;
            } | null;

            if (!advanceResponse.ok || !advanceData?.success) {
              financialRecordErrors.push(
                advanceData?.message || "The initial salary advance could not be recorded."
              );
            }
          } catch (advanceError) {
            financialRecordErrors.push(
              advanceError instanceof Error
                ? advanceError.message
                : "The initial salary advance could not be recorded."
            );
          }
        }

        closeAddEmployee();

        if (financialRecordErrors.length > 0) {
          setActionError(
            `Employee ${form.employeeNumber.trim()} was created, but one or more payroll financial records could not be saved. Open the employee profile and add the missing loan/advance. ${financialRecordErrors.join(" ")}`
          );
        }

        await Promise.all([
          loadEmployees(),
          loadStats(),
        ]);
      } catch (err) {
        setFormError(
          err instanceof Error
            ? err.message
            : "Failed to create employee."
        );
      } finally {
        setSaving(false);
      }
    };

  const viewEmployee =
    async (
      employee: Employee
    ) => {
      try {
        setLoadingEmployeeId(
          employee.id
        );

        setActionError("");

        const response =
          await authenticatedFetch(
            `/api/employees/${employee.id}`,
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
            | EmployeeResponse
            | null;

        if (!response.ok) {
          throw new Error(
            data?.message ||
              `Failed to load employee (${response.status}).`
          );
        }

        if (
          !data?.success ||
          !data.employee
        ) {
          throw new Error(
            data?.message ||
              "Failed to load employee."
          );
        }

        setViewingEmployee({
          ...data.employee,
          payrollRecords:
            data.payrollRecords ??
            [],
        });

        await Promise.all([
          loadEmployeeEarnings(employee.id),
          loadEmployeeLoans(employee.id),
          loadSalaryAdvances(employee.id),
        ]);
      } catch (err) {
        setActionError(
          err instanceof Error
            ? err.message
            : "Failed to load employee."
        );
      } finally {
        setLoadingEmployeeId(
          null
        );
      }
    };

  const closeViewEmployee =
    () => {
      setViewingEmployee(
        null
      );
      setEmployeeEarnings([]);
      setEarningError("");
      setShowEarningForm(false);
      setEditingEarning(null);
      setEmployeeLoans([]);
      setLoanError("");
      setShowLoanForm(false);
      setEditingLoan(null);
      setSalaryAdvances([]);
      setAdvanceError("");
      setShowAdvanceForm(false);
      setEditingAdvance(null);
    };

  const loadEmployeeEarnings =
    async (
      employeeId: string
    ) => {
      try {
        setEarningsLoading(true);
        setEarningError("");

        const response =
          await authenticatedFetch(
            `/api/employees/${employeeId}/earnings`,
            {
              method: "GET",
              headers: {
                Accept: "application/json",
              },
            }
          );

        const data =
          (await response
            .json()
            .catch(() => null)) as
            | EmployeeEarningsResponse
            | null;

        if (!response.ok) {
          throw new Error(
            data?.message ||
              `Failed to load employee earnings (${response.status}).`
          );
        }

        if (!data?.success) {
          throw new Error(
            data?.message ||
              "Failed to load employee earnings."
          );
        }

        setEmployeeEarnings(
          data.earnings ?? []
        );
      } catch (err) {
        setEmployeeEarnings([]);
        setEarningError(
          err instanceof Error
            ? err.message
            : "Failed to load employee earnings."
        );
      } finally {
        setEarningsLoading(false);
      }
    };

  const openAddEarning =
    () => {
      setEarningError("");
      setEditingEarning(null);
      setEarningForm({
        ...emptyEmployeeEarningForm,
        effectiveFrom:
          new Date()
            .toISOString()
            .slice(0, 10),
      });
      setShowEarningForm(true);
    };

  const openEditEarning =
    (
      earning: EmployeeEarning
    ) => {
      setEarningError("");
      setEditingEarning(earning);
      setEarningForm({
        type:
          earning.type ||
          "OTHER_EARNING",
        description:
          earning.description ||
          "",
        amount:
          String(earning.amount ?? ""),
        recurring:
          Boolean(
            earning.recurring
          ),
        taxable:
          Boolean(
            earning.taxable
          ),
        effectiveFrom:
          dateInputValue(
            earning.effectiveFrom
          ),
        effectiveTo:
          dateInputValue(
            earning.effectiveTo
          ),
        status:
          earning.status ||
          "ACTIVE",
      });
      setShowEarningForm(true);
    };

  const closeEarningForm =
    () => {
      if (earningSaving) {
        return;
      }

      setShowEarningForm(false);
      setEditingEarning(null);
      setEarningForm(
        emptyEmployeeEarningForm
      );
      setEarningError("");
    };

  const submitEmployeeEarning =
    async (
      event: FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      if (!viewingEmployee) {
        return;
      }

      setEarningError("");

      const amount =
        Number(
          earningForm.amount
        );

      if (
        !earningForm.type.trim()
      ) {
        setEarningError(
          "Earning type is required."
        );
        return;
      }

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        setEarningError(
          "Please enter an earning amount greater than zero."
        );
        return;
      }

      if (
        !earningForm.effectiveFrom
      ) {
        setEarningError(
          "Effective from date is required."
        );
        return;
      }

      if (
        earningForm.effectiveTo &&
        earningForm.effectiveTo <
          earningForm.effectiveFrom
      ) {
        setEarningError(
          "Effective to date cannot be before the effective from date."
        );
        return;
      }

      try {
        setEarningSaving(true);

        const isEditing =
          Boolean(
            editingEarning
          );

        const url = isEditing
          ? `/api/employees/${viewingEmployee.id}/earnings/${editingEarning?.id}`
          : `/api/employees/${viewingEmployee.id}/earnings`;

        const response =
          await authenticatedFetch(
            url,
            {
              method: isEditing
                ? "PATCH"
                : "POST",
              headers: {
                "Content-Type":
                  "application/json",
                Accept:
                  "application/json",
              },
              body:
                JSON.stringify({
                  type:
                    earningForm.type.trim(),
                  description:
                    earningForm.description.trim() ||
                    null,
                  amount,
                  recurring:
                    earningForm.recurring,
                  taxable:
                    earningForm.taxable,
                  effectiveFrom:
                    earningForm.effectiveFrom,
                  effectiveTo:
                    earningForm.effectiveTo ||
                    null,
                  status:
                    earningForm.status ||
                    "ACTIVE",
                }),
            }
          );

        const data =
          (await response
            .json()
            .catch(() => null)) as
            | EmployeeEarningResponse
            | null;

        if (!response.ok) {
          throw new Error(
            data?.message ||
              `Failed to ${isEditing ? "update" : "create"} employee earning (${response.status}).`
          );
        }

        if (!data?.success) {
          throw new Error(
            data?.message ||
              `Failed to ${isEditing ? "update" : "create"} employee earning.`
          );
        }

        closeEarningForm();

        await loadEmployeeEarnings(
          viewingEmployee.id
        );
      } catch (err) {
        setEarningError(
          err instanceof Error
            ? err.message
            : "Failed to save employee earning."
        );
      } finally {
        setEarningSaving(false);
      }
    };

  const deleteEmployeeEarning =
    async (
      earning: EmployeeEarning
    ) => {
      if (!viewingEmployee) {
        return;
      }

      const confirmed =
        window.confirm(
          `Delete ${earning.description || earning.type}? This earning will no longer be available for future payroll calculations.`
        );

      if (!confirmed) {
        return;
      }

      try {
        setEarningDeletingId(
          earning.id
        );
        setEarningError("");

        const response =
          await authenticatedFetch(
            `/api/employees/${viewingEmployee.id}/earnings/${earning.id}`,
            {
              method: "DELETE",
              headers: {
                Accept:
                  "application/json",
              },
            }
          );

        const data =
          (await response
            .json()
            .catch(() => null)) as {
            success?: boolean;
            message?: string;
          } | null;

        if (!response.ok) {
          throw new Error(
            data?.message ||
              `Failed to delete employee earning (${response.status}).`
          );
        }

        if (!data?.success) {
          throw new Error(
            data?.message ||
              "Failed to delete employee earning."
          );
        }

        await loadEmployeeEarnings(
          viewingEmployee.id
        );
      } catch (err) {
        setEarningError(
          err instanceof Error
            ? err.message
            : "Failed to delete employee earning."
        );
      } finally {
        setEarningDeletingId(
          null
        );
      }
    };

  const updateEarningFormField =
    (
      field: keyof EmployeeEarningForm,
      value:
        | string
        | boolean
    ) => {
      setEarningForm(
        (current) => ({
          ...current,
          [field]: value,
        })
      );
    };

  const earningTypeLabel =
    (
      type: string
    ): string => {
      return type
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(
          /\b\w/g,
          (char) =>
            char.toUpperCase()
        );
    };

  const loadEmployeeLoans = async (employeeId: string) => {
    try {
      setLoansLoading(true);
      setLoanError("");

      const response = await authenticatedFetch(
        `/api/employees/${employeeId}/loans`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const data = (await response.json().catch(() => null)) as
        | EmployeeLoansResponse
        | null;

      if (!response.ok) {
        throw new Error(
          data?.message ||
            `Failed to load employee loans (${response.status}).`
        );
      }

      if (!data?.success) {
        throw new Error(data?.message || "Failed to load employee loans.");
      }

      setEmployeeLoans(data.loans ?? []);
    } catch (err) {
      setEmployeeLoans([]);
      setLoanError(
        err instanceof Error ? err.message : "Failed to load employee loans."
      );
    } finally {
      setLoansLoading(false);
    }
  };

  const openAddLoan = () => {
    setLoanError("");
    setEditingLoan(null);
    setLoanForm({
      ...emptyEmployeeLoanForm,
      startDate: new Date().toISOString().slice(0, 10),
    });
    setShowLoanForm(true);
  };

  const openEditLoan = (loan: EmployeeLoan) => {
    setLoanError("");
    setEditingLoan(loan);
    setLoanForm({
      reference: loan.reference || "",
      description: loan.description || "",
      principalAmount: String(loan.principalAmount ?? ""),
      repaymentMonths: String(
        Math.max(1, Math.ceil(
          Number(loan.outstandingBalance ?? 0) /
            Math.max(Number(loan.monthlyRepayment ?? 0), 0.01)
        ))
      ),
      outstandingBalance: String(loan.outstandingBalance ?? ""),
      monthlyRepayment: String(loan.monthlyRepayment ?? ""),
      startDate: dateInputValue(loan.startDate),
      endDate: dateInputValue(loan.endDate),
      status: loan.status || "ACTIVE",
    });
    setShowLoanForm(true);
  };

  const closeLoanForm = () => {
    if (loanSaving) return;
    setShowLoanForm(false);
    setEditingLoan(null);
    setLoanForm(emptyEmployeeLoanForm);
    setLoanError("");
  };

  const submitEmployeeLoan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!viewingEmployee) return;

    setLoanError("");

    const principalAmount = Number(loanForm.principalAmount);
    const repaymentMonths = Number(loanForm.repaymentMonths);
    const existingOutstandingBalance = Number(loanForm.outstandingBalance);
    const outstandingBalance = editingLoan
      ? existingOutstandingBalance
      : principalAmount;
    const monthlyRepayment = Number(
      (outstandingBalance / repaymentMonths).toFixed(2)
    );

    if (!loanForm.reference.trim()) {
      setLoanError("Loan reference is required.");
      return;
    }

    if (!Number.isFinite(principalAmount) || principalAmount <= 0) {
      setLoanError("Loan principal must be greater than zero.");
      return;
    }

    if (editingLoan && (!Number.isFinite(existingOutstandingBalance) || existingOutstandingBalance < 0)) {
      setLoanError("The existing outstanding balance is invalid.");
      return;
    }

    if (!Number.isInteger(repaymentMonths) || repaymentMonths < 1 || repaymentMonths > 120) {
      setLoanError("Repayment period must be between 1 and 120 months.");
      return;
    }

    if (outstandingBalance > principalAmount) {
      setLoanError("Outstanding balance cannot exceed the loan principal.");
      return;
    }

    if (outstandingBalance > 0 && (!Number.isFinite(monthlyRepayment) || monthlyRepayment <= 0)) {
      setLoanError("The repayment period must produce a valid monthly repayment.");
      return;
    }

    if (!loanForm.startDate) {
      setLoanError("Loan start date is required.");
      return;
    }

    if (loanForm.endDate && loanForm.endDate < loanForm.startDate) {
      setLoanError("Loan end date cannot be before the start date.");
      return;
    }

    if (loanForm.status === "COMPLETED" && outstandingBalance > 0) {
      setLoanError("A completed loan must have an outstanding balance of zero.");
      return;
    }

    try {
      setLoanSaving(true);

      const isEditing = Boolean(editingLoan);
      const url = isEditing
        ? `/api/employees/${viewingEmployee.id}/loans/${editingLoan?.id}`
        : `/api/employees/${viewingEmployee.id}/loans`;

      const response = await authenticatedFetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          reference: loanForm.reference.trim(),
          description: loanForm.description.trim() || null,
          principalAmount,
          ...(isEditing ? { outstandingBalance } : {}),
          repaymentMonths,
          startDate: loanForm.startDate,
          endDate: loanForm.endDate || null,
          status: loanForm.status || "ACTIVE",
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | EmployeeLoanResponse
        | null;

      if (!response.ok) {
        throw new Error(
          data?.message ||
            `Failed to ${isEditing ? "update" : "create"} employee loan (${response.status}).`
        );
      }

      if (!data?.success) {
        throw new Error(
          data?.message ||
            `Failed to ${isEditing ? "update" : "create"} employee loan.`
        );
      }

      closeLoanForm();
      await loadEmployeeLoans(viewingEmployee.id);
    } catch (err) {
      setLoanError(
        err instanceof Error ? err.message : "Failed to save employee loan."
      );
    } finally {
      setLoanSaving(false);
    }
  };

  const deleteEmployeeLoan = async (loan: EmployeeLoan) => {
    if (!viewingEmployee) return;

    const confirmed = window.confirm(
      `Delete loan ${loan.reference}? This should only be used when the loan was entered incorrectly.`
    );

    if (!confirmed) return;

    try {
      setLoanDeletingId(loan.id);
      setLoanError("");

      const response = await authenticatedFetch(
        `/api/employees/${viewingEmployee.id}/loans/${loan.id}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const data = (await response.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
      } | null;

      if (!response.ok) {
        throw new Error(
          data?.message ||
            `Failed to delete employee loan (${response.status}).`
        );
      }

      if (!data?.success) {
        throw new Error(data?.message || "Failed to delete employee loan.");
      }

      await loadEmployeeLoans(viewingEmployee.id);
    } catch (err) {
      setLoanError(
        err instanceof Error ? err.message : "Failed to delete employee loan."
      );
    } finally {
      setLoanDeletingId(null);
    }
  };

  const loadSalaryAdvances = async (employeeId: string) => {
    try {
      setAdvancesLoading(true);
      setAdvanceError("");

      const response = await authenticatedFetch(
        `/api/employees/${employeeId}/advances`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const data = (await response.json().catch(() => null)) as
        | SalaryAdvancesResponse
        | null;

      if (!response.ok) {
        throw new Error(
          data?.message ||
            `Failed to load salary advances (${response.status}).`
        );
      }

      if (!data?.success) {
        throw new Error(data?.message || "Failed to load salary advances.");
      }

      setSalaryAdvances(data.salaryAdvances ?? []);
    } catch (err) {
      setSalaryAdvances([]);
      setAdvanceError(
        err instanceof Error
          ? err.message
          : "Failed to load salary advances."
      );
    } finally {
      setAdvancesLoading(false);
    }
  };

  const openAddAdvance = () => {
    setAdvanceError("");
    setEditingAdvance(null);
    setAdvanceForm({
      ...emptySalaryAdvanceForm,
      issuedDate: new Date().toISOString().slice(0, 10),
    });
    setShowAdvanceForm(true);
  };

  const openEditAdvance = (advance: SalaryAdvance) => {
    setAdvanceError("");
    setEditingAdvance(advance);
    setAdvanceForm({
      reference: advance.reference || "",
      amount: String(advance.amount ?? ""),
      repaymentMonths: String(
        Math.max(1, Math.ceil(
          Number(advance.outstandingBalance ?? 0) /
            Math.max(Number(advance.monthlyRepayment ?? 0), 0.01)
        ))
      ),
      outstandingBalance: String(advance.outstandingBalance ?? ""),
      monthlyRepayment: String(advance.monthlyRepayment ?? ""),
      issuedDate: dateInputValue(advance.issuedDate),
      status: advance.status || "ACTIVE",
      notes: advance.notes || "",
    });
    setShowAdvanceForm(true);
  };

  const closeAdvanceForm = () => {
    if (advanceSaving) return;
    setShowAdvanceForm(false);
    setEditingAdvance(null);
    setAdvanceForm(emptySalaryAdvanceForm);
    setAdvanceError("");
  };

  const submitSalaryAdvance = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!viewingEmployee) return;

    setAdvanceError("");

    const amount = Number(advanceForm.amount);
    const repaymentMonths = Number(advanceForm.repaymentMonths);
    const existingOutstandingBalance = Number(advanceForm.outstandingBalance);
    const outstandingBalance = editingAdvance
      ? existingOutstandingBalance
      : amount;
    const monthlyRepayment = Number(
      (outstandingBalance / repaymentMonths).toFixed(2)
    );

    if (!advanceForm.reference.trim()) {
      setAdvanceError("Salary advance reference is required.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setAdvanceError("Salary advance amount must be greater than zero.");
      return;
    }

    if (editingAdvance && (!Number.isFinite(existingOutstandingBalance) || existingOutstandingBalance < 0)) {
      setAdvanceError("The existing outstanding balance is invalid.");
      return;
    }

    if (!Number.isInteger(repaymentMonths) || repaymentMonths < 1 || repaymentMonths > 120) {
      setAdvanceError("Repayment period must be between 1 and 120 months.");
      return;
    }

    if (outstandingBalance > amount) {
      setAdvanceError("Outstanding balance cannot exceed the salary advance amount.");
      return;
    }

    if (outstandingBalance > 0 && (!Number.isFinite(monthlyRepayment) || monthlyRepayment <= 0)) {
      setAdvanceError("The repayment period must produce a valid monthly repayment.");
      return;
    }

    if (!advanceForm.issuedDate) {
      setAdvanceError("Issue date is required.");
      return;
    }

    if (advanceForm.status === "COMPLETED" && outstandingBalance > 0) {
      setAdvanceError(
        "A completed salary advance must have an outstanding balance of zero."
      );
      return;
    }

    try {
      setAdvanceSaving(true);

      const isEditing = Boolean(editingAdvance);
      const url = isEditing
        ? `/api/employees/${viewingEmployee.id}/advances/${editingAdvance?.id}`
        : `/api/employees/${viewingEmployee.id}/advances`;

      const response = await authenticatedFetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          reference: advanceForm.reference.trim(),
          amount,
          ...(isEditing ? { outstandingBalance } : {}),
          repaymentMonths,
          issuedDate: advanceForm.issuedDate,
          status: advanceForm.status || "ACTIVE",
          notes: advanceForm.notes.trim() || null,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | SalaryAdvanceResponse
        | null;

      if (!response.ok) {
        throw new Error(
          data?.message ||
            `Failed to ${isEditing ? "update" : "create"} salary advance (${response.status}).`
        );
      }

      if (!data?.success) {
        throw new Error(
          data?.message ||
            `Failed to ${isEditing ? "update" : "create"} salary advance.`
        );
      }

      closeAdvanceForm();
      await loadSalaryAdvances(viewingEmployee.id);
    } catch (err) {
      setAdvanceError(
        err instanceof Error
          ? err.message
          : "Failed to save salary advance."
      );
    } finally {
      setAdvanceSaving(false);
    }
  };

  const deleteSalaryAdvance = async (advance: SalaryAdvance) => {
    if (!viewingEmployee) return;

    const confirmed = window.confirm(
      `Delete salary advance ${advance.reference}? This should only be used when the advance was entered incorrectly.`
    );

    if (!confirmed) return;

    try {
      setAdvanceDeletingId(advance.id);
      setAdvanceError("");

      const response = await authenticatedFetch(
        `/api/employees/${viewingEmployee.id}/advances/${advance.id}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const data = (await response.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
      } | null;

      if (!response.ok) {
        throw new Error(
          data?.message ||
            `Failed to delete salary advance (${response.status}).`
        );
      }

      if (!data?.success) {
        throw new Error(
          data?.message || "Failed to delete salary advance."
        );
      }

      await loadSalaryAdvances(viewingEmployee.id);
    } catch (err) {
      setAdvanceError(
        err instanceof Error
          ? err.message
          : "Failed to delete salary advance."
      );
    } finally {
      setAdvanceDeletingId(null);
    }
  };

  const updateLoanFormField = (
    field: keyof EmployeeLoanForm,
    value: string
  ) => {
    setLoanForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateAdvanceFormField = (
    field: keyof SalaryAdvanceForm,
    value: string
  ) => {
    setAdvanceForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const openEditEmployee =
    async (
      employee: Employee
    ) => {
      setEditError("");
      setActionError("");
setEditForm({
        employeeNumber:
          employee.employeeNumber ??
          "",

        firstName:
          employee.firstName ??
          "",

        middleName:
          employee.middleName ??
          "",

        lastName:
          employee.lastName ??
          "",

        email:
          employee.email ??
          "",

        phoneNumber:
          employee.phoneNumber ??
          "",

        alternativePhone:
          employee.alternativePhone ??
          "",

        department:
          employee.department ??
          "",

        jobTitle:
          employee.jobTitle ??
          "",

        employmentType:
          employee.employmentType ??
          "FULL_TIME",

        hireDate:
          dateInputValue(
            employee.hireDate
          ),

        probationEndDate:
          dateInputValue(
            employee.probationEndDate
          ),

        terminationDate:
          dateInputValue(
            employee.terminationDate
          ),

        workLocation:
          employee.workLocation ??
          "",

        basicSalary:
          String(
            employee.basicSalary ??
              ""
          ),

        status:
          employee.status ??
          "ACTIVE",

        dateOfBirth:
          dateInputValue(
            employee.dateOfBirth
          ),

        gender:
          employee.gender ??
          "",

        maritalStatus:
          employee.maritalStatus ??
          "",

        nationality:
          employee.nationality ??
          "Kenyan",

        nationalId:
          employee.nationalId ??
          "",

        passportNumber:
          employee.passportNumber ??
          "",

        address:
          employee.address ??
          "",

        city:
          employee.city ??
          "",

        county:
          employee.county ??
          "",

        postalCode:
          employee.postalCode ??
          "",

        emergencyContactName:
          employee.emergencyContactName ??
          "",

        emergencyContactRelationship:
          employee.emergencyContactRelationship ??
          "",

        emergencyContactPhone:
          employee.emergencyContactPhone ??
          "",

        emergencyContactEmail:
          employee.emergencyContactEmail ??
          "",

        employmentNotes:
          employee.employmentNotes ??
          "",

        kraPin:
          employee.kraPin ??
          "",

        nssfNumber:
          employee.nssfNumber ??
          "",

        shaNumber:
          employee.shaNumber ??
          "",

        payeApplicable:
          employee.payeApplicable !== false
            ? "true"
            : "false",

        housingLevyApplicable:
          employee.housingLevyApplicable !== false
            ? "true"
            : "false",

        bankName:
          employee.bankName ??
          "",

        bankBranch:
          employee.bankBranch ??
          "",

        bankAccountName:
          employee.bankAccountName ??
          "",

        bankAccountNumber:
          employee.bankAccountNumber ??
          "",

        mobileMoneyNumber:
          employee.mobileMoneyNumber ??
          "",

        paymentMethod:
          employee.paymentMethod ??
          "",

        // Initial payroll financial records are only used by the Add Employee flow.
        // Keep them empty when editing an existing employee.
        initialLoanAmount: "",
        initialLoanRepaymentMonths: "",
        initialLoanStartDate: new Date().toISOString().slice(0, 10),
        initialLoanReference: "",
        initialAdvanceAmount: "",
        initialAdvanceRepaymentMonths: "",
        initialAdvanceIssuedDate: new Date().toISOString().slice(0, 10),
        initialAdvanceReference: "",
      });

      setEditingEmployee(
        employee
      );
    };

  const closeEditEmployee =
    () => {
      if (editingSaving) {
        return;
      }

      setEditingEmployee(
        null
      );

      setEditForm(
        emptyForm
      );

      setEditError("");
    };

  const submitEditEmployee =
    async (
      event: FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      if (!editingEmployee) {
        return;
      }

      setEditError("");

      if (
        !editForm.firstName.trim() ||
        !editForm.lastName.trim() ||
        !editForm.hireDate
      ) {
        setEditError(
          "First name, last name and hire date are required."
        );
        return;
      }

      const salary =
        Number(
          editForm.basicSalary
        );

      if (
        !Number.isFinite(
          salary
        ) ||
        salary < 0
      ) {
        setEditError(
          "Please enter a valid non-negative basic salary."
        );
        return;
      }

      try {
        setEditingSaving(
          true
        );

        const response =
          await authenticatedFetch(
            `/api/employees/${editingEmployee.id}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type":
                  "application/json",
                Accept:
                  "application/json",
              },
              body:
                JSON.stringify({
                  employeeNumber:
                    editForm.employeeNumber.trim(),

                  firstName:
                    editForm.firstName.trim(),

                  middleName:
                    editForm.middleName.trim() ||
                    null,

                  lastName:
                    editForm.lastName.trim(),

                  email:
                    editForm.email.trim() ||
                    null,

                  phoneNumber:
                    editForm.phoneNumber.trim() ||
                    null,

                  alternativePhone:
                    editForm.alternativePhone.trim() ||
                    null,

                  department:
                    editForm.department.trim() ||
                    null,

                  jobTitle:
                    editForm.jobTitle.trim() ||
                    null,

                  employmentType:
                    editForm.employmentType.trim(),

                  hireDate:
                    editForm.hireDate,

                  probationEndDate:
                    editForm.probationEndDate ||
                    null,

                  terminationDate:
                    editForm.terminationDate ||
                    null,

                  workLocation:
                    editForm.workLocation.trim() ||
                    null,

                  basicSalary:
                    salary,

                  status:
                    editForm.status,

                  dateOfBirth:
                    editForm.dateOfBirth ||
                    null,

                  gender:
                    editForm.gender.trim() ||
                    null,

                  maritalStatus:
                    editForm.maritalStatus.trim() ||
                    null,

                  nationality:
                    editForm.nationality.trim() ||
                    null,

                  nationalId:
                    editForm.nationalId.trim() ||
                    null,

                  passportNumber:
                    editForm.passportNumber.trim() ||
                    null,

                  address:
                    editForm.address.trim() ||
                    null,

                  city:
                    editForm.city.trim() ||
                    null,

                  county:
                    editForm.county.trim() ||
                    null,

                  postalCode:
                    editForm.postalCode.trim() ||
                    null,

                  emergencyContactName:
                    editForm.emergencyContactName.trim() ||
                    null,

                  emergencyContactRelationship:
                    editForm.emergencyContactRelationship.trim() ||
                    null,

                  emergencyContactPhone:
                    editForm.emergencyContactPhone.trim() ||
                    null,

                  emergencyContactEmail:
                    editForm.emergencyContactEmail.trim() ||
                    null,

                  employmentNotes:
                    editForm.employmentNotes.trim() ||
                    null,

                  kraPin:
                    editForm.kraPin.trim() ||
                    null,

                  nssfNumber:
                    editForm.nssfNumber.trim() ||
                    null,

                  shaNumber:
                    editForm.shaNumber.trim() ||
                    null,

                  payeApplicable:
                    editForm.payeApplicable === "true",

                  housingLevyApplicable:
                    editForm.housingLevyApplicable === "true",

                  bankName:
                    editForm.bankName.trim() ||
                    null,

                  bankBranch:
                    editForm.bankBranch.trim() ||
                    null,

                  bankAccountName:
                    editForm.bankAccountName.trim() ||
                    null,

                  bankAccountNumber:
                    editForm.bankAccountNumber.trim() ||
                    null,

                  mobileMoneyNumber:
                    editForm.mobileMoneyNumber.trim() ||
                    null,

                  paymentMethod:
                    editForm.paymentMethod.trim() ||
                    null,
                }),
            }
          );

        const data =
          (await response
            .json()
            .catch(
              () => null
            )) as {
            success?: boolean;
            message?: string;
            employee?: Employee;
          } | null;

        if (!response.ok) {
          throw new Error(
            data?.message ||
              `Failed to update employee (${response.status}).`
          );
        }

        if (!data?.success) {
          throw new Error(
            data?.message ||
              "Failed to update employee."
          );
        }

        closeEditEmployee();

        await Promise.all([
          loadEmployees(),
          loadStats(),
        ]);
      } catch (err) {
        setEditError(
          err instanceof Error
            ? err.message
            : "Failed to update employee."
        );
      } finally {
        setEditingSaving(
          false
        );
      }
    };

  const deleteEmployee =
    async (
      employee: Employee
    ) => {
      const confirmed =
        window.confirm(
          `Delete ${employee.name}? This action cannot be undone.`
        );

      if (!confirmed) {
        return;
      }

      try {
        setDeletingEmployeeId(
          employee.id
        );

        setActionError("");

        const response =
          await authenticatedFetch(
            `/api/employees/${employee.id}`,
            {
              method: "DELETE",
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
            )) as {
            success?: boolean;
            message?: string;
          } | null;

        if (!response.ok) {
          throw new Error(
            data?.message ||
              `Failed to delete employee (${response.status}).`
          );
        }

        if (!data?.success) {
          throw new Error(
            data?.message ||
              "Failed to delete employee."
          );
        }

        setViewingEmployee(
          null
        );

        await Promise.all([
          loadEmployees(),
          loadStats(),
        ]);
      } catch (err) {
        setActionError(
          err instanceof Error
            ? err.message
            : "Failed to delete employee."
        );
      } finally {
        setDeletingEmployeeId(
          null
        );
      }
    };

  const updateFormField =
    (
      field: keyof EmployeeForm,
      value: string
    ) => {
      setForm(
        (current) => ({
          ...current,
          [field]: value,
        })
      );
    };

  const updateEditFormField =
    (
      field: keyof EmployeeForm,
      value: string
    ) => {
      setEditForm(
        (current) => ({
          ...current,
          [field]: value,
        })
      );
    };

  const renderFormFields =
    (
      currentForm: EmployeeForm,
      updateField: (
        field: keyof EmployeeForm,
        value: string
      ) => void) => (
      <>
        <div className="rounded-xl border border-[#ECECF3] bg-[#F8F9FC] p-5">
          <h3 className="text-base font-semibold text-[#20243A]">
            Employee Identity
          </h3>

          <p className="mt-1 text-sm text-[#666B84]">
            Core employee identification details.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field
              label="Employee Number"
              required
              value={
                currentForm.employeeNumber
              }
              onChange={(value) =>
                updateField(
                  "employeeNumber",
                  value
                )
              }
            />

            <Field
              label="First Name"
              required
              value={
                currentForm.firstName
              }
              onChange={(value) =>
                updateField(
                  "firstName",
                  value
                )
              }
            />

            <Field
              label="Middle Name"
              value={
                currentForm.middleName
              }
              onChange={(value) =>
                updateField(
                  "middleName",
                  value
                )
              }
            />

            <Field
              label="Last Name"
              required
              value={
                currentForm.lastName
              }
              onChange={(value) =>
                updateField(
                  "lastName",
                  value
                )
              }
            />

            <Field
              label="Email"
              type="email"
              value={
                currentForm.email
              }
              onChange={(value) =>
                updateField(
                  "email",
                  value
                )
              }
            />

            <Field
              label="Phone Number"
              value={
                currentForm.phoneNumber
              }
              onChange={(value) =>
                updateField(
                  "phoneNumber",
                  value
                )
              }
            />

            <Field
              label="Alternative Phone"
              value={
                currentForm.alternativePhone
              }
              onChange={(value) =>
                updateField(
                  "alternativePhone",
                  value
                )
              }
            />
          </div>
        </div>

        <div className="rounded-xl border border-[#ECECF3] bg-[#F8F9FC] p-5">
          <h3 className="text-base font-semibold text-[#20243A]">
            Employment & Reporting
          </h3>

          <p className="mt-1 text-sm text-[#666B84]">
            Position, employment status and reporting structure.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="Department"
              value={
                currentForm.department
              }
              onChange={(value) =>
                updateField(
                  "department",
                  value
                )
              }
            />

            <Field
              label="Job Title"
              value={
                currentForm.jobTitle
              }
              onChange={(value) =>
                updateField(
                  "jobTitle",
                  value
                )
              }
            />

            <SelectField
              label="Employment Type"
              value={
                currentForm.employmentType
              }
              onChange={(value) =>
                updateField(
                  "employmentType",
                  value
                )
              }
              options={[
                {
                  value:
                    "FULL_TIME",
                  label:
                    "Full Time",
                },
                {
                  value:
                    "PART_TIME",
                  label:
                    "Part Time",
                },
                {
                  value:
                    "CONTRACT",
                  label:
                    "Contract",
                },
                {
                  value:
                    "CASUAL",
                  label:
                    "Casual",
                },
                {
                  value:
                    "INTERN",
                  label:
                    "Intern",
                },
              ]}
            />

            <SelectField
              label="Employment Status"
              value={
                currentForm.status
              }
              onChange={(value) =>
                updateField(
                  "status",
                  value
                )
              }
              options={[
                {
                  value:
                    "ACTIVE",
                  label:
                    "Active",
                },
                {
                  value:
                    "ON_LEAVE",
                  label:
                    "On Leave",
                },
                {
                  value:
                    "INACTIVE",
                  label:
                    "Inactive",
                },
                {
                  value:
                    "TERMINATED",
                  label:
                    "Terminated",
                },
              ]}
            />

            <Field
              label="Hire Date"
              required
              type="date"
              value={
                currentForm.hireDate
              }
              onChange={(value) =>
                updateField(
                  "hireDate",
                  value
                )
              }
            />

            <Field
              label="Probation End Date"
              type="date"
              value={
                currentForm.probationEndDate
              }
              onChange={(value) =>
                updateField(
                  "probationEndDate",
                  value
                )
              }
            />

            <Field
              label="Termination Date"
              type="date"
              value={
                currentForm.terminationDate
              }
              onChange={(value) =>
                updateField(
                  "terminationDate",
                  value
                )
              }
            />

            <Field
              label="Work Location"
              value={
                currentForm.workLocation
              }
              onChange={(value) =>
                updateField(
                  "workLocation",
                  value
                )
              }
            />

            <Field
              label="Basic Salary"
              type="number"
              min="0"
              value={
                currentForm.basicSalary
              }
              onChange={(value) =>
                updateField(
                  "basicSalary",
                  value
                )
              }
            />
          </div>
        </div>

        <div className="rounded-xl border border-[#ECECF3] bg-[#F8F9FC] p-5">
          <h3 className="text-base font-semibold text-[#20243A]">
            Personal Information
          </h3>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="Date of Birth"
              type="date"
              value={
                currentForm.dateOfBirth
              }
              onChange={(value) =>
                updateField(
                  "dateOfBirth",
                  value
                )
              }
            />

            <SelectField
              label="Gender"
              value={
                currentForm.gender
              }
              onChange={(value) =>
                updateField(
                  "gender",
                  value
                )
              }
              options={[
                {
                  value:
                    "MALE",
                  label:
                    "Male",
                },
                {
                  value:
                    "FEMALE",
                  label:
                    "Female",
                },
                {
                  value:
                    "OTHER",
                  label:
                    "Other",
                },
              ]}
              placeholder="Select gender"
            />

            <SelectField
              label="Marital Status"
              value={
                currentForm.maritalStatus
              }
              onChange={(value) =>
                updateField(
                  "maritalStatus",
                  value
                )
              }
              options={[
                {
                  value:
                    "SINGLE",
                  label:
                    "Single",
                },
                {
                  value:
                    "MARRIED",
                  label:
                    "Married",
                },
                {
                  value:
                    "DIVORCED",
                  label:
                    "Divorced",
                },
                {
                  value:
                    "WIDOWED",
                  label:
                    "Widowed",
                },
              ]}
              placeholder="Select marital status"
            />

            <Field
              label="Nationality"
              value={
                currentForm.nationality
              }
              onChange={(value) =>
                updateField(
                  "nationality",
                  value
                )
              }
            />

            <Field
              label="National ID"
              value={
                currentForm.nationalId
              }
              onChange={(value) =>
                updateField(
                  "nationalId",
                  value
                )
              }
            />

            <Field
              label="Passport Number"
              value={
                currentForm.passportNumber
              }
              onChange={(value) =>
                updateField(
                  "passportNumber",
                  value
                )
              }
            />
          </div>
        </div>

        <div className="rounded-xl border border-[#ECECF3] bg-[#F8F9FC] p-5">
          <h3 className="text-base font-semibold text-[#20243A]">
            Address
          </h3>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Field
                label="Address"
                value={
                  currentForm.address
                }
                onChange={(value) =>
                  updateField(
                    "address",
                    value
                  )
                }
              />
            </div>

            <Field
              label="City"
              value={
                currentForm.city
              }
              onChange={(value) =>
                updateField(
                  "city",
                  value
                )
              }
            />

            <Field
              label="County"
              value={
                currentForm.county
              }
              onChange={(value) =>
                updateField(
                  "county",
                  value
                )
              }
            />

            <Field
              label="Postal Code"
              value={
                currentForm.postalCode
              }
              onChange={(value) =>
                updateField(
                  "postalCode",
                  value
                )
              }
            />
          </div>
        </div>

        <div className="rounded-xl border border-[#ECECF3] bg-[#F8F9FC] p-5">
          <h3 className="text-base font-semibold text-[#20243A]">
            Emergency Contact
          </h3>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="Contact Name"
              value={
                currentForm.emergencyContactName
              }
              onChange={(value) =>
                updateField(
                  "emergencyContactName",
                  value
                )
              }
            />

            <Field
              label="Relationship"
              value={
                currentForm.emergencyContactRelationship
              }
              onChange={(value) =>
                updateField(
                  "emergencyContactRelationship",
                  value
                )
              }
            />

            <Field
              label="Contact Phone"
              value={
                currentForm.emergencyContactPhone
              }
              onChange={(value) =>
                updateField(
                  "emergencyContactPhone",
                  value
                )
              }
            />

            <Field
              label="Contact Email"
              type="email"
              value={
                currentForm.emergencyContactEmail
              }
              onChange={(value) =>
                updateField(
                  "emergencyContactEmail",
                  value
                )
              }
            />
          </div>
        </div>

        <div className="rounded-xl border border-[#ECECF3] bg-[#F8F9FC] p-5">
          <h3 className="text-base font-semibold text-[#20243A]">
            Banking & Payment
          </h3>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="Bank Name"
              value={
                currentForm.bankName
              }
              onChange={(value) =>
                updateField(
                  "bankName",
                  value
                )
              }
            />

            <Field
              label="Bank Branch"
              value={
                currentForm.bankBranch
              }
              onChange={(value) =>
                updateField(
                  "bankBranch",
                  value
                )
              }
            />

            <Field
              label="Bank Account Name"
              value={
                currentForm.bankAccountName
              }
              onChange={(value) =>
                updateField(
                  "bankAccountName",
                  value
                )
              }
            />

            <Field
              label="Bank Account Number"
              value={
                currentForm.bankAccountNumber
              }
              onChange={(value) =>
                updateField(
                  "bankAccountNumber",
                  value
                )
              }
            />

            <Field
              label="Mobile Money Number"
              value={
                currentForm.mobileMoneyNumber
              }
              onChange={(value) =>
                updateField(
                  "mobileMoneyNumber",
                  value
                )
              }
            />

            <SelectField
              label="Payment Method"
              value={
                currentForm.paymentMethod
              }
              onChange={(value) =>
                updateField(
                  "paymentMethod",
                  value
                )
              }
              options={[
                {
                  value:
                    "BANK",
                  label:
                    "Bank",
                },
                {
                  value:
                    "MPESA",
                  label:
                    "M-Pesa",
                },
                {
                  value:
                    "CASH",
                  label:
                    "Cash",
                },
              ]}
              placeholder="Select payment method"
            />
          </div>
        </div>

        <div className="rounded-xl border border-[#ECECF3] bg-[#F8F9FC] p-5">
          <h3 className="text-base font-semibold text-[#20243A]">
            Statutory & Tax Information
          </h3>

          <p className="mt-1 text-sm text-[#666B84]">
            Employee statutory identifiers and tax applicability settings.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="KRA PIN"
              value={
                currentForm.kraPin
              }
              onChange={(value) =>
                updateField(
                  "kraPin",
                  value
                )
              }
            />

            <Field
              label="NSSF Number"
              value={
                currentForm.nssfNumber
              }
              onChange={(value) =>
                updateField(
                  "nssfNumber",
                  value
                )
              }
            />

            <Field
              label="SHA / SHIF Number"
              value={
                currentForm.shaNumber
              }
              onChange={(value) =>
                updateField(
                  "shaNumber",
                  value
                )
              }
            />

            <SelectField
              label="PAYE Applicable"
              value={
                currentForm.payeApplicable
              }
              onChange={(value) =>
                updateField(
                  "payeApplicable",
                  value
                )
              }
              options={[
                {
                  value: "true",
                  label: "Yes",
                },
                {
                  value: "false",
                  label: "No",
                },
              ]}
            />

            <SelectField
              label="Housing Levy Applicable"
              value={
                currentForm.housingLevyApplicable
              }
              onChange={(value) =>
                updateField(
                  "housingLevyApplicable",
                  value
                )
              }
              options={[
                {
                  value: "true",
                  label: "Yes",
                },
                {
                  value: "false",
                  label: "No",
                },
              ]}
            />
          </div>
        </div>

        <div className="rounded-xl border border-[#D7ECE9] bg-[#F6FFFD] p-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-base font-semibold text-[#20243A]">
                Loans & Salary Advances
              </h3>
              <p className="mt-1 text-sm leading-6 text-[#666B84]">
                Optional initial payroll financial records. Once saved, Payroll will deduct the configured monthly repayment automatically and reduce the outstanding balance each payroll period.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className="rounded-xl border border-[#ECECF3] bg-white p-4">
              <h4 className="font-semibold text-[#20243A]">Employee Loan</h4>
              <p className="mt-1 text-xs leading-5 text-[#666B84]">
                Leave the amount blank if there is no loan at onboarding.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field
                  label="Loan Amount"
                  type="number"
                  value={currentForm.initialLoanAmount}
                  onChange={(value) => updateField("initialLoanAmount", value)}
                />

                <Field
                  label="Repayment Period (Months)"
                  type="number"
                  value={currentForm.initialLoanRepaymentMonths}
                  onChange={(value) => updateField("initialLoanRepaymentMonths", value)}
                />

                <Field
                  label="Start Date"
                  type="date"
                  value={currentForm.initialLoanStartDate}
                  onChange={(value) => updateField("initialLoanStartDate", value)}
                />

                <Field
                  label="Reference (Optional)"
                  value={currentForm.initialLoanReference}
                  onChange={(value) => updateField("initialLoanReference", value)}
                />
              </div>

              {Number(currentForm.initialLoanAmount) > 0 &&
                Number(currentForm.initialLoanRepaymentMonths) > 0 && (
                  <div className="mt-4 rounded-lg border border-[#D7ECE9] bg-[#F6FFFD] p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[#666B84]">Estimated monthly deduction</span>
                      <span className="font-semibold text-[#0D9488]">
                        {formatCurrency(
                          Number(currentForm.initialLoanAmount) /
                            Number(currentForm.initialLoanRepaymentMonths)
                        )}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <span className="text-[#666B84]">Starting outstanding balance</span>
                      <span className="font-semibold text-[#20243A]">
                        {formatCurrency(Number(currentForm.initialLoanAmount))}
                      </span>
                    </div>
                  </div>
                )}
            </div>

            <div className="rounded-xl border border-[#ECECF3] bg-white p-4">
              <h4 className="font-semibold text-[#20243A]">Salary Advance</h4>
              <p className="mt-1 text-xs leading-5 text-[#666B84]">
                Leave the amount blank if there is no salary advance at onboarding.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field
                  label="Advance Amount"
                  type="number"
                  value={currentForm.initialAdvanceAmount}
                  onChange={(value) => updateField("initialAdvanceAmount", value)}
                />

                <Field
                  label="Repayment Period (Months)"
                  type="number"
                  value={currentForm.initialAdvanceRepaymentMonths}
                  onChange={(value) => updateField("initialAdvanceRepaymentMonths", value)}
                />

                <Field
                  label="Issue Date"
                  type="date"
                  value={currentForm.initialAdvanceIssuedDate}
                  onChange={(value) => updateField("initialAdvanceIssuedDate", value)}
                />

                <Field
                  label="Reference (Optional)"
                  value={currentForm.initialAdvanceReference}
                  onChange={(value) => updateField("initialAdvanceReference", value)}
                />
              </div>

              {Number(currentForm.initialAdvanceAmount) > 0 &&
                Number(currentForm.initialAdvanceRepaymentMonths) > 0 && (
                  <div className="mt-4 rounded-lg border border-[#D7ECE9] bg-[#F6FFFD] p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[#666B84]">Estimated monthly deduction</span>
                      <span className="font-semibold text-[#0D9488]">
                        {formatCurrency(
                          Number(currentForm.initialAdvanceAmount) /
                            Number(currentForm.initialAdvanceRepaymentMonths)
                        )}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <span className="text-[#666B84]">Starting outstanding balance</span>
                      <span className="font-semibold text-[#20243A]">
                        {formatCurrency(Number(currentForm.initialAdvanceAmount))}
                      </span>
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#ECECF3] bg-[#F8F9FC] p-5">
          <h3 className="text-base font-semibold text-[#20243A]">
            Employment Notes
          </h3>

          <textarea
            value={
              currentForm.employmentNotes
            }
            onChange={(event) =>
              updateField(
                "employmentNotes",
                event.target.value
              )
            }
            rows={4}
            placeholder="Additional employment notes..."
            className="mt-4 w-full resize-none rounded-lg border border-[#DCDDEA] bg-white px-3 py-3 text-sm text-[#20243A] outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
          />
        </div>
      </>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#20243A]">
            HR Management
          </h1>

          <p className="mt-2 text-[#666B84]">
            Manage employees, workforce records and reporting structures.
          </p>
        </div>

        <button
          type="button"
          onClick={
            openAddEmployee
          }
          className="flex items-center justify-center gap-2 rounded-lg bg-[#0D9488] px-5 py-2.5 font-medium text-white transition hover:bg-[#0f766e]"
        >
          <Plus size={18} />
          Add Employee
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          label="Total Employees"
          value={
            stats.total
          }
          icon={
            <Users size={20} />
          }
        />

        <SummaryCard
          label="Active"
          value={
            stats.active
          }
          icon={
            <Briefcase
              size={20}
            />
          }
        />

        <SummaryCard
          label="On Leave"
          value={
            stats.onLeave
          }
          icon={
            <Users size={20} />
          }
        />

        <SummaryCard
          label="Departments"
          value={
            stats.departments
          }
          icon={
            <Briefcase
              size={20}
            />
          }
        />

        <SummaryCard
          label="Terminated"
          value={
            stats.terminated
          }
          icon={
            <Users size={20} />
          }
        />
      </div>

      <div className="rounded-2xl border border-[#ECECF3] bg-white p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="flex flex-1 items-center rounded-lg border border-[#DCDDEA] px-3">
            <Search
              size={18}
              className="shrink-0 text-[#666B84]"
            />

            <input
              type="text"
              value={search}
              onChange={(
                event
              ) => {
                setPage(1);
                setSearch(
                  event.target.value
                );
              }}
              placeholder="Search employees by name, number, department or job title..."
              className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-[#20243A] outline-none"
            />

            {loading && (
              <Loader2
                size={18}
                className="animate-spin text-[#666B84]"
              />
            )}
          </div>

          <select
            value={
              departmentFilter
            }
            onChange={(
              event
            ) => {
              setPage(1);
              setDepartmentFilter(
                event.target.value
              );
            }}
            className="rounded-lg border border-[#DCDDEA] bg-white px-3 py-3 text-sm text-[#20243A] outline-none focus:border-[#0D9488]"
          >
            <option value="">
              All Departments
            </option>

            {departments.map(
              (department) => (
                <option
                  key={
                    department
                  }
                  value={
                    department
                  }
                >
                  {department}
                </option>
              )
            )}
          </select>

          <select
            value={
              statusFilter
            }
            onChange={(
              event
            ) => {
              setPage(1);
              setStatusFilter(
                event.target.value
              );
            }}
            className="rounded-lg border border-[#DCDDEA] bg-white px-3 py-3 text-sm text-[#20243A] outline-none focus:border-[#0D9488]"
          >
            <option value="">
              All Statuses
            </option>

            <option value="ACTIVE">
              Active
            </option>

            <option value="ON_LEAVE">
              On Leave
            </option>

            <option value="INACTIVE">
              Inactive
            </option>

            <option value="TERMINATED">
              Terminated
            </option>
          </select>
        </div>
      </div>

      {actionError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle
              size={20}
              className="mt-0.5 shrink-0 text-red-600"
            />

            <div>
              <p className="font-semibold text-red-700">
                Employee action failed
              </p>

              <p className="mt-1 text-sm text-red-600">
                {actionError}
              </p>

              <button
                type="button"
                onClick={() =>
                  setActionError(
                    ""
                  )
                }
                className="mt-2 text-sm font-semibold text-red-700 underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle
              size={20}
              className="mt-0.5 shrink-0 text-red-600"
            />

            <div>
              <p className="font-semibold text-red-700">
                Unable to load employees
              </p>

              <p className="mt-1 text-sm text-red-600">
                {error}
              </p>

              <button
                type="button"
                onClick={() =>
                  void loadEmployees()
                }
                className="mt-2 text-sm font-semibold text-red-700 underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {!error &&
        (loading ? (
          <div className="flex min-h-[20rem] items-center justify-center rounded-2xl border border-[#ECECF3] bg-white">
            <div className="flex items-center gap-3 text-[#666B84]">
              <Loader2
                size={22}
                className="animate-spin"
              />
              Loading employees...
            </div>
          </div>
        ) : employees.length ===
          0 ? (
          <div className="rounded-2xl border border-[#ECECF3] bg-white p-12 text-center">
            <Users
              size={40}
              className="mx-auto text-[#666B84]"
            />

            <h2 className="mt-4 text-lg font-semibold text-[#20243A]">
              No employees found
            </h2>

            <p className="mt-2 text-sm text-[#666B84]">
              {search.trim()
                ? "Try a different search."
                : "Add your first employee to begin managing HR."}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              {employees.map(
                (employee) => (
                  <div
                    key={
                      employee.id
                    }
                    className="rounded-2xl border border-[#ECECF3] bg-white p-5 transition hover:border-[#C8CBD8] hover:shadow-sm"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0D9488]/10">
                            <Users
                              size={24}
                              className="text-[#0D9488]"
                            />
                          </div>

                          <div className="min-w-0">
                            <h2 className="truncate text-lg font-semibold text-[#20243A]">
                              {
                                employee.name
                              }
                            </h2>

                            <p className="truncate text-sm text-[#666B84]">
                              {employee.jobTitle ||
                                "Employee"}
                            </p>

                            <p className="mt-1 text-xs text-[#888DA3]">
                              Employee No.{" "}
                              {
                                employee.employeeNumber
                              }
                            </p>
                          </div>
                        </div>

                        <span
                          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${statusClasses(
                            employee.status
                          )}`}
                        >
                          {statusLabel(
                            employee.status
                          )}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="flex min-w-0 items-center gap-2 text-sm text-[#666B84]">
                          <Mail
                            size={16}
                            className="shrink-0"
                          />

                          <span className="truncate">
                            {fieldValue(
                              employee.email
                            )}
                          </span>
                        </div>

                        <div className="flex min-w-0 items-center gap-2 text-sm text-[#666B84]">
                          <Phone
                            size={16}
                            className="shrink-0"
                          />

                          <span className="truncate">
                            {fieldValue(
                              employee.phoneNumber
                            )}
                          </span>
                        </div>

                        <div className="flex min-w-0 items-center gap-2 text-sm text-[#666B84]">
                          <Briefcase
                            size={16}
                            className="shrink-0"
                          />

                          <span className="truncate">
                            {fieldValue(
                              employee.department
                            )}
                          </span>
                        </div>

                        <div className="flex min-w-0 items-center gap-2 text-sm text-[#666B84]">
                          <Users
                            size={16}
                            className="shrink-0"
                          />

                          <span className="truncate">
                            {employee.manager
                              ? `Reports to ${employee.manager.name}`
                              : "No reporting manager assigned"}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-xl border border-[#ECECF3] bg-[#F8F9FC] p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#888DA3]">
                          Reporting Structure
                        </p>

                        {employee.manager ? (
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[#20243A]">
                                {
                                  employee.manager.name
                                }
                              </p>

                              <p className="truncate text-xs text-[#666B84]">
                                {employee.manager.jobTitle ||
                                  "Direct Manager"}
                              </p>
                            </div>

                            <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs text-[#666B84]">
                              Direct Manager
                            </span>
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-[#888DA3]">
                            No direct manager assigned.
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 border-t border-[#ECECF3] pt-4">
                        <button
                          type="button"
                          onClick={() =>
                            void viewEmployee(
                              employee
                            )
                          }
                          disabled={
                            loadingEmployeeId ===
                            employee.id
                          }
                          className="flex items-center gap-2 rounded-lg border border-[#DCDDEA] px-3 py-2 text-sm font-medium text-[#20243A] transition hover:bg-[#F8F9FC] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {loadingEmployeeId ===
                          employee.id ? (
                            <Loader2
                              size={16}
                              className="animate-spin"
                            />
                          ) : (
                            <Eye
                              size={16}
                            />
                          )}

                          View
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void openEditEmployee(
                              employee
                            )
                          }
                          className="flex items-center gap-2 rounded-lg border border-[#DCDDEA] px-3 py-2 text-sm font-medium text-[#20243A] transition hover:bg-[#F8F9FC]"
                        >
                          <Pencil
                            size={16}
                          />
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void deleteEmployee(
                              employee
                            )
                          }
                          disabled={
                            deletingEmployeeId ===
                            employee.id
                          }
                          className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingEmployeeId ===
                          employee.id ? (
                            <Loader2
                              size={16}
                              className="animate-spin"
                            />
                          ) : (
                            <Trash2
                              size={16}
                            />
                          )}

                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>

            {totalPages >
              0 && (
              <div className="flex flex-col gap-3 rounded-2xl border border-[#ECECF3] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-[#666B84]">
                  Showing{" "}
                  <span className="font-medium text-[#20243A]">
                    {employees.length}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium text-[#20243A]">
                    {totalEmployees}
                  </span>{" "}
                  employees
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setPage(
                        (current) =>
                          Math.max(
                            1,
                            current - 1
                          )
                      )
                    }
                    disabled={
                      page <= 1
                    }
                    className="flex items-center gap-1 rounded-lg border border-[#DCDDEA] px-3 py-2 text-sm text-[#20243A] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft
                      size={16}
                    />
                    Previous
                  </button>

                  <span className="px-2 text-sm text-[#666B84]">
                    Page{" "}
                    <span className="font-semibold text-[#20243A]">
                      {page}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-[#20243A]">
                      {totalPages}
                    </span>
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setPage(
                        (current) =>
                          Math.min(
                            totalPages,
                            current + 1
                          )
                      )
                    }
                    disabled={
                      page >=
                      totalPages
                    }
                    className="flex items-center gap-1 rounded-lg border border-[#DCDDEA] px-3 py-2 text-sm text-[#20243A] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                    <ChevronRight
                      size={16}
                    />
                  </button>
                </div>
              </div>
            )}
          </>
        ))}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#ECECF3] bg-white p-6">
              <div>
                <h2 className="text-xl font-bold text-[#20243A]">
                  Add Employee
                </h2>

                <p className="mt-1 text-sm text-[#666B84]">
                  Create a complete employee HR record.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeAddEmployee
                }
                disabled={
                  saving
                }
                className="rounded-lg p-2 text-[#666B84] hover:bg-[#F8F9FC]"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={
                submitEmployee
              }
              className="space-y-5 p-6"
            >
              {formError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {formError}
                </div>
              )}

              {renderFormFields(
                form,
                updateFormField
              )}

              <div className="flex flex-wrap justify-end gap-3 border-t border-[#ECECF3] pt-5">
                <button
                  type="button"
                  onClick={
                    closeAddEmployee
                  }
                  disabled={
                    saving
                  }
                  className="rounded-lg border border-[#DCDDEA] px-5 py-2.5 font-medium text-[#20243A] hover:bg-[#F8F9FC]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    saving
                  }
                  className="flex items-center gap-2 rounded-lg bg-[#0D9488] px-5 py-2.5 font-medium text-white hover:bg-[#0f766e] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  )}

                  {saving
                    ? "Saving..."
                    : "Add Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#ECECF3] bg-white p-6">
              <div>
                <h2 className="text-xl font-bold text-[#20243A]">
                  Employee Profile
                </h2>

                <p className="mt-1 text-sm text-[#666B84]">
                  Complete employee information and reporting structure.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeViewEmployee
                }
                className="rounded-lg p-2 text-[#666B84] hover:bg-[#F8F9FC]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6 p-6">
              <div className="flex flex-col gap-4 rounded-xl border border-[#ECECF3] bg-[#F8F9FC] p-5 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#0D9488]/10">
                    <Users
                      size={30}
                      className="text-[#0D9488]"
                    />
                  </div>

                  <div>
                    <h3 className="text-2xl font-bold text-[#20243A]">
                      {
                        viewingEmployee.name
                      }
                    </h3>

                    <p className="mt-1 text-[#666B84]">
                      {viewingEmployee.jobTitle ||
                        "Employee"}
                    </p>

                    <p className="mt-1 text-sm text-[#888DA3]">
                      Employee No.{" "}
                      {
                        viewingEmployee.employeeNumber
                      }
                    </p>
                  </div>
                </div>

                <span
                  className={`w-fit rounded-full border px-3 py-1 text-sm font-medium ${statusClasses(
                    viewingEmployee.status
                  )}`}
                >
                  {statusLabel(
                    viewingEmployee.status
                  )}
                </span>
              </div>

              <div className="rounded-xl border border-[#ECECF3] bg-[#F8F9FC] p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
                    <Users
                      size={20}
                    />
                  </div>

                  <div>
                    <h3 className="font-semibold text-[#20243A]">
                      Reporting Structure
                    </h3>

                    <p className="text-sm text-[#666B84]">
                      Who this employee reports to and the team structure.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-[#DCDDEA] bg-white p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-[#888DA3]">
                      Reports To
                    </p>

                    {viewingEmployee.manager ? (
                      <div className="mt-3">
                        <p className="font-semibold text-[#20243A]">
                          {
                            viewingEmployee
                              .manager
                              .name
                          }
                        </p>

                        <p className="mt-1 text-sm text-[#666B84]">
                          {viewingEmployee
                            .manager
                            .jobTitle ||
                            "Direct Manager"}
                        </p>

                        <p className="mt-1 text-xs text-[#888DA3]">
                          Employee No.{" "}
                          {
                            viewingEmployee
                              .manager
                              .employeeNumber
                          }
                        </p>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-[#888DA3]">
                        No direct manager assigned.
                      </p>
                    )}
                  </div>

                  <div className="rounded-lg border border-[#DCDDEA] bg-white p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-[#888DA3]">
                      Reporting Status
                    </p>

                    <p className="mt-3 font-medium text-[#20243A]">
                      {viewingEmployee.manager
                        ? "Direct reporting relationship assigned"
                        : "Reporting relationship not assigned"}
                    </p>

                    <p className="mt-1 text-sm text-[#666B84]">
                      {viewingEmployee.manager
                        ? `Reports directly to ${viewingEmployee.manager.name}.`
                        : "Use Edit Employee to assign the direct manager."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#ECECF3] p-5">
                <h3 className="text-lg font-semibold text-[#20243A]">
                  Employment Information
                </h3>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <ProfileField
                    label="Department"
                    value={
                      viewingEmployee.department
                    }
                  />

                  <ProfileField
                    label="Job Title"
                    value={
                      viewingEmployee.jobTitle
                    }
                  />

                  <ProfileField
                    label="Employment Type"
                    value={statusLabel(
                      viewingEmployee.employmentType
                    )}
                  />

                  <ProfileField
                    label="Hire Date"
                    value={formatDate(
                      viewingEmployee.hireDate
                    )}
                  />

                  <ProfileField
                    label="Probation End"
                    value={formatDate(
                      viewingEmployee.probationEndDate
                    )}
                  />

                  <ProfileField
                    label="Termination Date"
                    value={formatDate(
                      viewingEmployee.terminationDate
                    )}
                  />

                  <ProfileField
                    label="Work Location"
                    value={
                      viewingEmployee.workLocation
                    }
                  />

                  <ProfileField
                    label="Basic Salary"
                    value={formatCurrency(
                      viewingEmployee.basicSalary
                    )}
                  />

                  <ProfileField
                    label="Status"
                    value={statusLabel(
                      viewingEmployee.status
                    )}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-[#D7ECE9] bg-[#F6FFFD] p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-[#20243A]">
                      Payroll & Financial Records
                    </h3>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-[#666B84]">
                      Manage this employee&apos;s earnings, company loans and salary advances.
                      Active records are used automatically when payroll is processed, including
                      loan and advance repayments.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={openAddEarning}
                      className="flex items-center justify-center gap-2 rounded-lg border border-[#0D9488] bg-white px-4 py-2.5 text-sm font-medium text-[#0D9488] transition hover:bg-[#F0FDFA]"
                    >
                      <Plus size={16} />
                      Add Earning
                    </button>

                    <button
                      type="button"
                      onClick={openAddLoan}
                      className="flex items-center justify-center gap-2 rounded-lg border border-[#0D9488] bg-[#0D9488] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0f766e]"
                    >
                      <Plus size={16} />
                      Add Loan
                    </button>

                    <button
                      type="button"
                      onClick={openAddAdvance}
                      className="flex items-center justify-center gap-2 rounded-lg border border-[#DCDDEA] bg-white px-4 py-2.5 text-sm font-medium text-[#20243A] transition hover:bg-[#F8F9FC]"
                    >
                      <Plus size={16} />
                      Add Advance
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#ECECF3] p-5">
                <h3 className="text-lg font-semibold text-[#20243A]">
                  Personal Information
                </h3>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <ProfileField
                    label="Date of Birth"
                    value={formatDate(
                      viewingEmployee.dateOfBirth
                    )}
                  />

                  <ProfileField
                    label="Gender"
                    value={statusLabel(
                      viewingEmployee.gender
                    )}
                  />

                  <ProfileField
                    label="Marital Status"
                    value={statusLabel(
                      viewingEmployee.maritalStatus
                    )}
                  />

                  <ProfileField
                    label="Nationality"
                    value={
                      viewingEmployee.nationality
                    }
                  />

                  <ProfileField
                    label="National ID"
                    value={
                      viewingEmployee.nationalId
                    }
                  />

                  <ProfileField
                    label="Passport Number"
                    value={
                      viewingEmployee.passportNumber
                    }
                  />
                </div>
              </div>

              <div className="rounded-xl border border-[#ECECF3] p-5">
                <h3 className="text-lg font-semibold text-[#20243A]">
                  Contact Information
                </h3>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <ProfileField
                    label="Email"
                    value={
                      viewingEmployee.email
                    }
                  />

                  <ProfileField
                    label="Phone"
                    value={
                      viewingEmployee.phoneNumber
                    }
                  />

                  <ProfileField
                    label="Alternative Phone"
                    value={
                      viewingEmployee.alternativePhone
                    }
                  />

                  <ProfileField
                    label="Address"
                    value={
                      viewingEmployee.address
                    }
                  />

                  <ProfileField
                    label="City"
                    value={
                      viewingEmployee.city
                    }
                  />

                  <ProfileField
                    label="County"
                    value={
                      viewingEmployee.county
                    }
                  />

                  <ProfileField
                    label="Postal Code"
                    value={
                      viewingEmployee.postalCode
                    }
                  />
                </div>
              </div>

              <div className="rounded-xl border border-[#ECECF3] p-5">
                <h3 className="text-lg font-semibold text-[#20243A]">
                  Emergency Contact
                </h3>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <ProfileField
                    label="Name"
                    value={
                      viewingEmployee.emergencyContactName
                    }
                  />

                  <ProfileField
                    label="Relationship"
                    value={
                      viewingEmployee.emergencyContactRelationship
                    }
                  />

                  <ProfileField
                    label="Phone"
                    value={
                      viewingEmployee.emergencyContactPhone
                    }
                  />

                  <ProfileField
                    label="Email"
                    value={
                      viewingEmployee.emergencyContactEmail
                    }
                  />
                </div>
              </div>

              <div className="rounded-xl border border-[#ECECF3] p-5">
                <h3 className="text-lg font-semibold text-[#20243A]">
                  Banking & Payment
                </h3>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <ProfileField
                    label="Bank Name"
                    value={
                      viewingEmployee.bankName
                    }
                  />

                  <ProfileField
                    label="Bank Branch"
                    value={
                      viewingEmployee.bankBranch
                    }
                  />

                  <ProfileField
                    label="Account Name"
                    value={
                      viewingEmployee.bankAccountName
                    }
                  />

                  <ProfileField
                    label="Account Number"
                    value={
                      viewingEmployee.bankAccountNumber
                    }
                  />

                  <ProfileField
                    label="Mobile Money Number"
                    value={
                      viewingEmployee.mobileMoneyNumber
                    }
                  />

                  <ProfileField
                    label="Payment Method"
                    value={statusLabel(
                      viewingEmployee.paymentMethod
                    )}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-[#ECECF3] p-5">
                <h3 className="text-lg font-semibold text-[#20243A]">
                  Employment Notes
                </h3>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#666B84]">
                  {viewingEmployee.employmentNotes ||
                    "No employment notes recorded."}
                </p>
              </div>

              <div className="rounded-xl border border-[#ECECF3] p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-[#20243A]">
                      Earnings & Compensation
                    </h3>

                    <p className="mt-1 text-sm text-[#666B84]">
                      Maintain recurring and non-recurring employee earnings used by payroll calculations.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={openAddEarning}
                    className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#0D9488] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0f766e]"
                  >
                    <Plus size={16} />
                    Add Earning
                  </button>
                </div>

                {earningError && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {earningError}
                  </div>
                )}

                {earningsLoading ? (
                  <div className="mt-4 flex items-center justify-center rounded-xl border border-dashed border-[#DCDDEA] p-8 text-sm text-[#666B84]">
                    <Loader2
                      size={18}
                      className="mr-2 animate-spin"
                    />
                    Loading earnings...
                  </div>
                ) : employeeEarnings.length === 0 ? (
                  <div className="mt-4 rounded-xl border border-dashed border-[#DCDDEA] bg-[#F8F9FC] p-8 text-center">
                    <p className="font-medium text-[#20243A]">
                      No employee earnings configured
                    </p>
                    <p className="mt-1 text-sm text-[#666B84]">
                      Add allowances, commissions, bonuses or other earnings before running payroll.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 overflow-x-auto rounded-xl border border-[#ECECF3]">
                    <table className="min-w-[860px] w-full text-sm">
                      <thead className="bg-[#F8F9FC]">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-[#20243A]">
                            Earning
                          </th>
                          <th className="px-4 py-3 text-right font-semibold text-[#20243A]">
                            Amount
                          </th>
                          <th className="px-4 py-3 text-center font-semibold text-[#20243A]">
                            Recurring
                          </th>
                          <th className="px-4 py-3 text-center font-semibold text-[#20243A]">
                            Taxable
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-[#20243A]">
                            Effective From
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-[#20243A]">
                            Status
                          </th>
                          <th className="px-4 py-3 text-right font-semibold text-[#20243A]">
                            Actions
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {employeeEarnings.map(
                          (earning) => (
                            <tr
                              key={earning.id}
                              className="border-t border-[#ECECF3]"
                            >
                              <td className="px-4 py-3">
                                <p className="font-medium text-[#20243A]">
                                  {earningTypeLabel(
                                    earning.type
                                  )}
                                </p>
                                <p className="mt-1 max-w-xs truncate text-xs text-[#666B84]">
                                  {earning.description ||
                                    "No description"}
                                </p>
                              </td>

                              <td className="px-4 py-3 text-right font-semibold text-[#20243A]">
                                {formatCurrency(
                                  earning.amount
                                )}
                              </td>

                              <td className="px-4 py-3 text-center text-[#666B84]">
                                {earning.recurring
                                  ? "Yes"
                                  : "No"}
                              </td>

                              <td className="px-4 py-3 text-center text-[#666B84]">
                                {earning.taxable
                                  ? "Yes"
                                  : "No"}
                              </td>

                              <td className="px-4 py-3 text-[#666B84]">
                                {formatDate(
                                  earning.effectiveFrom
                                )}
                              </td>

                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses(
                                    earning.status
                                  )}`}
                                >
                                  {statusLabel(
                                    earning.status
                                  )}
                                </span>
                              </td>

                              <td className="px-4 py-3">
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openEditEarning(
                                        earning
                                      )
                                    }
                                    className="rounded-lg border border-[#DCDDEA] p-2 text-[#20243A] transition hover:bg-[#F8F9FC]"
                                    title="Edit earning"
                                  >
                                    <Pencil size={15} />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      void deleteEmployeeEarning(
                                        earning
                                      )
                                    }
                                    disabled={
                                      earningDeletingId ===
                                      earning.id
                                    }
                                    className="rounded-lg border border-red-200 p-2 text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    title="Delete earning"
                                  >
                                    {earningDeletingId ===
                                    earning.id ? (
                                      <Loader2
                                        size={15}
                                        className="animate-spin"
                                      />
                                    ) : (
                                      <Trash2 size={15} />
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-[#ECECF3] p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-[#20243A]">
                      Employee Loans
                    </h3>
                    <p className="mt-1 text-sm text-[#666B84]">
                      Record employee loans and maintain the outstanding balance and monthly repayment used by payroll.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={openAddLoan}
                    className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#0D9488] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0f766e]"
                  >
                    <Plus size={16} />
                    Add Loan
                  </button>
                </div>

                {loanError && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {loanError}
                  </div>
                )}

                {loansLoading ? (
                  <div className="mt-4 flex items-center justify-center rounded-xl border border-dashed border-[#DCDDEA] p-8 text-sm text-[#666B84]">
                    <Loader2 size={18} className="mr-2 animate-spin" />
                    Loading employee loans...
                  </div>
                ) : employeeLoans.length === 0 ? (
                  <div className="mt-4 rounded-xl border border-dashed border-[#DCDDEA] bg-[#F8F9FC] p-8 text-center">
                    <p className="font-medium text-[#20243A]">
                      No employee loans recorded
                    </p>
                    <p className="mt-1 text-sm text-[#666B84]">
                      Add a loan here when an employee receives a company loan.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 overflow-x-auto rounded-xl border border-[#ECECF3]">
                    <table className="min-w-[1050px] w-full text-sm">
                      <thead className="bg-[#F8F9FC]">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-[#20243A]">
                            Loan
                          </th>
                          <th className="px-4 py-3 text-right font-semibold text-[#20243A]">
                            Principal
                          </th>
                          <th className="px-4 py-3 text-right font-semibold text-[#20243A]">
                            Outstanding
                          </th>
                          <th className="px-4 py-3 text-right font-semibold text-[#20243A]">
                            Monthly Repayment
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-[#20243A]">
                            Start Date
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-[#20243A]">
                            Status
                          </th>
                          <th className="px-4 py-3 text-right font-semibold text-[#20243A]">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeeLoans.map((loan) => (
                          <tr key={loan.id} className="border-t border-[#ECECF3]">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-[#20243A]">
                                {loan.reference}
                              </p>
                              <p className="mt-1 max-w-xs truncate text-xs text-[#666B84]">
                                {loan.description || "No description"}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-right text-[#20243A]">
                              {formatCurrency(loan.principalAmount)}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-[#20243A]">
                              {formatCurrency(loan.outstandingBalance)}
                            </td>
                            <td className="px-4 py-3 text-right text-[#666B84]">
                              {formatCurrency(loan.monthlyRepayment)}
                            </td>
                            <td className="px-4 py-3 text-[#666B84]">
                              {formatDate(loan.startDate)}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                                  loan.status === "ACTIVE"
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : loan.status === "COMPLETED"
                                      ? "border-blue-200 bg-blue-50 text-blue-700"
                                      : "border-slate-200 bg-slate-100 text-slate-600"
                                }`}
                              >
                                {statusLabel(loan.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => openEditLoan(loan)}
                                  className="rounded-lg border border-[#DCDDEA] p-2 text-[#20243A] transition hover:bg-[#F8F9FC]"
                                  title="Edit loan"
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void deleteEmployeeLoan(loan)}
                                  disabled={loanDeletingId === loan.id}
                                  className="rounded-lg border border-red-200 p-2 text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  title="Delete loan"
                                >
                                  {loanDeletingId === loan.id ? (
                                    <Loader2 size={15} className="animate-spin" />
                                  ) : (
                                    <Trash2 size={15} />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-[#ECECF3] p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-[#20243A]">
                      Salary Advances
                    </h3>
                    <p className="mt-1 text-sm text-[#666B84]">
                      Record salary advances separately from employee loans so payroll can recover them automatically.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={openAddAdvance}
                    className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#0D9488] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0f766e]"
                  >
                    <Plus size={16} />
                    Add Advance
                  </button>
                </div>

                {advanceError && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {advanceError}
                  </div>
                )}

                {advancesLoading ? (
                  <div className="mt-4 flex items-center justify-center rounded-xl border border-dashed border-[#DCDDEA] p-8 text-sm text-[#666B84]">
                    <Loader2 size={18} className="mr-2 animate-spin" />
                    Loading salary advances...
                  </div>
                ) : salaryAdvances.length === 0 ? (
                  <div className="mt-4 rounded-xl border border-dashed border-[#DCDDEA] bg-[#F8F9FC] p-8 text-center">
                    <p className="font-medium text-[#20243A]">
                      No salary advances recorded
                    </p>
                    <p className="mt-1 text-sm text-[#666B84]">
                      Add an advance when an employee receives an early salary payment.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 overflow-x-auto rounded-xl border border-[#ECECF3]">
                    <table className="min-w-[980px] w-full text-sm">
                      <thead className="bg-[#F8F9FC]">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-[#20243A]">
                            Advance
                          </th>
                          <th className="px-4 py-3 text-right font-semibold text-[#20243A]">
                            Amount
                          </th>
                          <th className="px-4 py-3 text-right font-semibold text-[#20243A]">
                            Outstanding
                          </th>
                          <th className="px-4 py-3 text-right font-semibold text-[#20243A]">
                            Monthly Repayment
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-[#20243A]">
                            Issue Date
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-[#20243A]">
                            Status
                          </th>
                          <th className="px-4 py-3 text-right font-semibold text-[#20243A]">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {salaryAdvances.map((advance) => (
                          <tr
                            key={advance.id}
                            className="border-t border-[#ECECF3]"
                          >
                            <td className="px-4 py-3">
                              <p className="font-semibold text-[#20243A]">
                                {advance.reference}
                              </p>
                              <p className="mt-1 max-w-xs truncate text-xs text-[#666B84]">
                                {advance.notes || "No notes"}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-right text-[#20243A]">
                              {formatCurrency(advance.amount)}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-[#20243A]">
                              {formatCurrency(advance.outstandingBalance)}
                            </td>
                            <td className="px-4 py-3 text-right text-[#666B84]">
                              {formatCurrency(advance.monthlyRepayment)}
                            </td>
                            <td className="px-4 py-3 text-[#666B84]">
                              {formatDate(advance.issuedDate)}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                                  advance.status === "ACTIVE"
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : advance.status === "COMPLETED"
                                      ? "border-blue-200 bg-blue-50 text-blue-700"
                                      : "border-slate-200 bg-slate-100 text-slate-600"
                                }`}
                              >
                                {statusLabel(advance.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => openEditAdvance(advance)}
                                  className="rounded-lg border border-[#DCDDEA] p-2 text-[#20243A] transition hover:bg-[#F8F9FC]"
                                  title="Edit salary advance"
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void deleteSalaryAdvance(advance)}
                                  disabled={advanceDeletingId === advance.id}
                                  className="rounded-lg border border-red-200 p-2 text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  title="Delete salary advance"
                                >
                                  {advanceDeletingId === advance.id ? (
                                    <Loader2 size={15} className="animate-spin" />
                                  ) : (
                                    <Trash2 size={15} />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-[#20243A]">
                    Payroll History
                  </h3>

                  <span className="text-sm text-[#666B84]">
                    {
                      (
                        viewingEmployee.payrollRecords ??
                        []
                      ).length
                    }{" "}
                    record
                    {(
                      viewingEmployee.payrollRecords ??
                      []
                    ).length ===
                    1
                      ? ""
                      : "s"}
                  </span>
                </div>

                {(
                  viewingEmployee.payrollRecords ??
                  []
                ).length ===
                0 ? (
                  <div className="rounded-xl border border-dashed border-[#DCDDEA] p-6 text-center text-sm text-[#666B84]">
                    No payroll records found for this employee.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[#ECECF3]">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#F8F9FC]">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-[#20243A]">
                            Date
                          </th>

                          <th className="px-4 py-3 text-right font-semibold text-[#20243A]">
                            Gross
                          </th>

                          <th className="px-4 py-3 text-right font-semibold text-[#20243A]">
                            Deductions
                          </th>

                          <th className="px-4 py-3 text-right font-semibold text-[#20243A]">
                            Net
                          </th>

                          <th className="px-4 py-3 text-left font-semibold text-[#20243A]">
                            Status
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {(
                          viewingEmployee.payrollRecords ??
                          []
                        ).map(
                          (
                            record
                          ) => (
                            <tr
                              key={
                                record.id
                              }
                              className="border-t border-[#ECECF3]"
                            >
                              <td className="px-4 py-3 text-[#666B84]">
                                {formatDate(
                                  record.createdAt
                                )}
                              </td>

                              <td className="px-4 py-3 text-right font-medium text-[#20243A]">
                                {formatCurrency(
                                  record.grossSalary
                                )}
                              </td>

                              <td className="px-4 py-3 text-right text-[#666B84]">
                                {formatCurrency(
                                  record.deductions
                                )}
                              </td>

                              <td className="px-4 py-3 text-right font-semibold text-[#20243A]">
                                {formatCurrency(
                                  record.netSalary
                                )}
                              </td>

                              <td className="px-4 py-3 text-[#666B84]">
                                {statusLabel(
                                  record.status
                                )}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-3 border-t border-[#ECECF3] pt-5">
                <button
                  type="button"
                  onClick={() => {
                    const employee =
                      employees.find(
                        (item) =>
                          item.id ===
                          viewingEmployee.id
                      );

                    if (
                      employee
                    ) {
                      closeViewEmployee();

                      void openEditEmployee(
                        employee
                      );
                    }
                  }}
                  className="flex items-center gap-2 rounded-lg border border-[#DCDDEA] px-5 py-2.5 font-medium text-[#20243A] hover:bg-[#F8F9FC]"
                >
                  <Pencil
                    size={17}
                  />
                  Edit Employee
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void deleteEmployee(
                      viewingEmployee
                    )
                  }
                  disabled={
                    deletingEmployeeId ===
                    viewingEmployee.id
                  }
                  className="flex items-center gap-2 rounded-lg border border-red-200 px-5 py-2.5 font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deletingEmployeeId ===
                  viewingEmployee.id ? (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <Trash2
                      size={17}
                    />
                  )}

                  Delete Employee
                </button>

                <button
                  type="button"
                  onClick={
                    closeViewEmployee
                  }
                  className="rounded-lg bg-[#0D9488] px-5 py-2.5 font-medium text-white hover:bg-[#0f766e]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLoanForm && viewingEmployee && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#ECECF3] bg-white p-6">
              <div>
                <h2 className="text-xl font-bold text-[#20243A]">
                  {editingLoan ? "Edit Employee Loan" : "Add Employee Loan"}
                </h2>
                <p className="mt-1 text-sm text-[#666B84]">
                  {viewingEmployee.name}
                </p>
              </div>
              <button
                type="button"
                onClick={closeLoanForm}
                disabled={loanSaving}
                className="rounded-lg p-2 text-[#666B84] hover:bg-[#F8F9FC]"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submitEmployeeLoan} className="space-y-5 p-6">
              {loanError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {loanError}
                </div>
              )}

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Payroll uses the outstanding balance and monthly repayment configured here. Do not enter the monthly deduction manually in the payroll run.
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field
                  label="Loan Reference"
                  required
                  value={loanForm.reference}
                  onChange={(value) =>
                    updateLoanFormField("reference", value)
                  }
                />

                <SelectField
                  label="Status"
                  value={loanForm.status}
                  onChange={(value) => updateLoanFormField("status", value)}
                  options={[
                    { value: "ACTIVE", label: "Active" },
                    { value: "COMPLETED", label: "Completed" },
                    { value: "CANCELLED", label: "Cancelled" },
                  ]}
                />

                <Field
                  label="Principal Amount"
                  type="number"
                  min="0.01"
                  required
                  value={loanForm.principalAmount}
                  onChange={(value) =>
                    updateLoanFormField("principalAmount", value)
                  }
                />

                <Field
                  label="Repayment Period (Months)"
                  type="number"
                  min="1"
                  max="120"
                  step="1"
                  required
                  value={loanForm.repaymentMonths}
                  onChange={(value) =>
                    updateLoanFormField("repaymentMonths", value)
                  }
                />

                <Field
                  label="Monthly Repayment (Calculated)"
                  type="number"
                  value={loanForm.repaymentMonths && loanForm.principalAmount
                    ? String((Number(editingLoan ? loanForm.outstandingBalance : loanForm.principalAmount) / Number(loanForm.repaymentMonths)).toFixed(2))
                    : ""}
                  readOnly
                />

                <Field
                  label="Start Date"
                  type="date"
                  required
                  value={loanForm.startDate}
                  onChange={(value) =>
                    updateLoanFormField("startDate", value)
                  }
                />

                <Field
                  label="End Date"
                  type="date"
                  value={loanForm.endDate}
                  onChange={(value) =>
                    updateLoanFormField("endDate", value)
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[#20243A]">
                  Description
                </label>
                <textarea
                  value={loanForm.description}
                  onChange={(event) =>
                    updateLoanFormField("description", event.target.value)
                  }
                  rows={3}
                  placeholder="Describe the purpose or terms of the employee loan..."
                  className="w-full resize-none rounded-lg border border-[#DCDDEA] bg-white px-3 py-2.5 text-sm text-[#20243A] outline-none transition placeholder:text-[#A0A4B5] focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
                />
              </div>

              <div className="flex flex-wrap justify-end gap-3 border-t border-[#ECECF3] pt-5">
                <button
                  type="button"
                  onClick={closeLoanForm}
                  disabled={loanSaving}
                  className="rounded-lg border border-[#DCDDEA] px-5 py-2.5 font-medium text-[#20243A] hover:bg-[#F8F9FC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loanSaving}
                  className="flex items-center gap-2 rounded-lg bg-[#0D9488] px-5 py-2.5 font-medium text-white hover:bg-[#0f766e] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loanSaving && (
                    <Loader2 size={17} className="animate-spin" />
                  )}
                  {loanSaving
                    ? "Saving..."
                    : editingLoan
                      ? "Save Changes"
                      : "Add Loan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAdvanceForm && viewingEmployee && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#ECECF3] bg-white p-6">
              <div>
                <h2 className="text-xl font-bold text-[#20243A]">
                  {editingAdvance
                    ? "Edit Salary Advance"
                    : "Add Salary Advance"}
                </h2>
                <p className="mt-1 text-sm text-[#666B84]">
                  {viewingEmployee.name}
                </p>
              </div>
              <button
                type="button"
                onClick={closeAdvanceForm}
                disabled={advanceSaving}
                className="rounded-lg p-2 text-[#666B84] hover:bg-[#F8F9FC]"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submitSalaryAdvance} className="space-y-5 p-6">
              {advanceError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {advanceError}
                </div>
              )}

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Payroll uses the outstanding balance and monthly repayment configured here. Do not enter the monthly deduction manually in the payroll run.
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field
                  label="Advance Reference"
                  required
                  value={advanceForm.reference}
                  onChange={(value) =>
                    updateAdvanceFormField("reference", value)
                  }
                />

                <SelectField
                  label="Status"
                  value={advanceForm.status}
                  onChange={(value) =>
                    updateAdvanceFormField("status", value)
                  }
                  options={[
                    { value: "ACTIVE", label: "Active" },
                    { value: "COMPLETED", label: "Completed" },
                    { value: "CANCELLED", label: "Cancelled" },
                  ]}
                />

                <Field
                  label="Advance Amount"
                  type="number"
                  min="0.01"
                  required
                  value={advanceForm.amount}
                  onChange={(value) =>
                    updateAdvanceFormField("amount", value)
                  }
                />

                <Field
                  label="Repayment Period (Months)"
                  type="number"
                  min="1"
                  max="120"
                  step="1"
                  required
                  value={advanceForm.repaymentMonths}
                  onChange={(value) =>
                    updateAdvanceFormField("repaymentMonths", value)
                  }
                />

                <Field
                  label="Monthly Repayment (Calculated)"
                  type="number"
                  value={advanceForm.repaymentMonths && advanceForm.amount
                    ? String((Number(editingAdvance ? advanceForm.outstandingBalance : advanceForm.amount) / Number(advanceForm.repaymentMonths)).toFixed(2))
                    : ""}
                  readOnly
                />

                <Field
                  label="Issue Date"
                  type="date"
                  required
                  value={advanceForm.issuedDate}
                  onChange={(value) =>
                    updateAdvanceFormField("issuedDate", value)
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[#20243A]">
                  Notes
                </label>
                <textarea
                  value={advanceForm.notes}
                  onChange={(event) =>
                    updateAdvanceFormField("notes", event.target.value)
                  }
                  rows={3}
                  placeholder="Add notes about this salary advance..."
                  className="w-full resize-none rounded-lg border border-[#DCDDEA] bg-white px-3 py-2.5 text-sm text-[#20243A] outline-none transition placeholder:text-[#A0A4B5] focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
                />
              </div>

              <div className="flex flex-wrap justify-end gap-3 border-t border-[#ECECF3] pt-5">
                <button
                  type="button"
                  onClick={closeAdvanceForm}
                  disabled={advanceSaving}
                  className="rounded-lg border border-[#DCDDEA] px-5 py-2.5 font-medium text-[#20243A] hover:bg-[#F8F9FC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={advanceSaving}
                  className="flex items-center gap-2 rounded-lg bg-[#0D9488] px-5 py-2.5 font-medium text-white hover:bg-[#0f766e] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {advanceSaving && (
                    <Loader2 size={17} className="animate-spin" />
                  )}
                  {advanceSaving
                    ? "Saving..."
                    : editingAdvance
                      ? "Save Changes"
                      : "Add Advance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEarningForm && viewingEmployee && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#ECECF3] bg-white p-6">
              <div>
                <h2 className="text-xl font-bold text-[#20243A]">
                  {editingEarning
                    ? "Edit Earning"
                    : "Add Earning"}
                </h2>
                <p className="mt-1 text-sm text-[#666B84]">
                  {viewingEmployee.name}
                </p>
              </div>

              <button
                type="button"
                onClick={closeEarningForm}
                disabled={earningSaving}
                className="rounded-lg p-2 text-[#666B84] hover:bg-[#F8F9FC]"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={submitEmployeeEarning}
              className="space-y-5 p-6"
            >
              {earningError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {earningError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <SelectField
                  label="Earning Type"
                  value={earningForm.type}
                  onChange={(value) =>
                    updateEarningFormField(
                      "type",
                      value
                    )
                  }
                  options={[
                    {
                      value: "HOUSING_ALLOWANCE",
                      label: "Housing Allowance",
                    },
                    {
                      value: "TRANSPORT_ALLOWANCE",
                      label: "Transport Allowance",
                    },
                    {
                      value: "COMMUNICATION_ALLOWANCE",
                      label: "Communication Allowance",
                    },
                    {
                      value: "MEDICAL_ALLOWANCE",
                      label: "Medical Allowance",
                    },
                    {
                      value: "RESPONSIBILITY_ALLOWANCE",
                      label: "Responsibility Allowance",
                    },
                    {
                      value: "OVERTIME",
                      label: "Overtime",
                    },
                    {
                      value: "COMMISSION",
                      label: "Commission",
                    },
                    {
                      value: "BONUS",
                      label: "Bonus",
                    },
                    {
                      value: "OTHER_EARNING",
                      label: "Other Earning",
                    },
                  ]}
                />

                <Field
                  label="Amount"
                  type="number"
                  min="0.01"
                  required
                  value={earningForm.amount}
                  onChange={(value) =>
                    updateEarningFormField(
                      "amount",
                      value
                    )
                  }
                />

                <Field
                  label="Effective From"
                  type="date"
                  required
                  value={earningForm.effectiveFrom}
                  onChange={(value) =>
                    updateEarningFormField(
                      "effectiveFrom",
                      value
                    )
                  }
                />

                <Field
                  label="Effective To"
                  type="date"
                  value={earningForm.effectiveTo}
                  onChange={(value) =>
                    updateEarningFormField(
                      "effectiveTo",
                      value
                    )
                  }
                />

                <SelectField
                  label="Status"
                  value={earningForm.status}
                  onChange={(value) =>
                    updateEarningFormField(
                      "status",
                      value
                    )
                  }
                  options={[
                    {
                      value: "ACTIVE",
                      label: "Active",
                    },
                    {
                      value: "INACTIVE",
                      label: "Inactive",
                    },
                  ]}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[#20243A]">
                  Description
                </label>

                <textarea
                  value={earningForm.description}
                  onChange={(event) =>
                    updateEarningFormField(
                      "description",
                      event.target.value
                    )
                  }
                  rows={3}
                  placeholder="Describe this earning..."
                  className="w-full resize-none rounded-lg border border-[#DCDDEA] bg-white px-3 py-2.5 text-sm text-[#20243A] outline-none transition placeholder:text-[#A0A4B5] focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#ECECF3] bg-[#F8F9FC] p-4">
                  <input
                    type="checkbox"
                    checked={earningForm.recurring}
                    onChange={(event) =>
                      updateEarningFormField(
                        "recurring",
                        event.target.checked
                      )
                    }
                    className="mt-0.5 h-4 w-4 accent-[#0D9488]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-[#20243A]">
                      Recurring earning
                    </span>
                    <span className="mt-1 block text-xs text-[#666B84]">
                      Include this earning automatically for applicable payroll periods.
                    </span>
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#ECECF3] bg-[#F8F9FC] p-4">
                  <input
                    type="checkbox"
                    checked={earningForm.taxable}
                    onChange={(event) =>
                      updateEarningFormField(
                        "taxable",
                        event.target.checked
                      )
                    }
                    className="mt-0.5 h-4 w-4 accent-[#0D9488]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-[#20243A]">
                      Taxable earning
                    </span>
                    <span className="mt-1 block text-xs text-[#666B84]">
                      Mark whether this earning should be considered taxable by payroll.
                    </span>
                  </span>
                </label>
              </div>

              <div className="flex flex-wrap justify-end gap-3 border-t border-[#ECECF3] pt-5">
                <button
                  type="button"
                  onClick={closeEarningForm}
                  disabled={earningSaving}
                  className="rounded-lg border border-[#DCDDEA] px-5 py-2.5 font-medium text-[#20243A] hover:bg-[#F8F9FC]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={earningSaving}
                  className="flex items-center gap-2 rounded-lg bg-[#0D9488] px-5 py-2.5 font-medium text-white hover:bg-[#0f766e] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {earningSaving && (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  )}
                  {earningSaving
                    ? "Saving..."
                    : editingEarning
                      ? "Save Changes"
                      : "Add Earning"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#ECECF3] bg-white p-6">
              <div>
                <h2 className="text-xl font-bold text-[#20243A]">
                  Edit Employee
                </h2>

                <p className="mt-1 text-sm text-[#666B84]">
                  Update employee information and reporting structure.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeEditEmployee
                }
                disabled={
                  editingSaving
                }
                className="rounded-lg p-2 text-[#666B84] hover:bg-[#F8F9FC]"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={
                submitEditEmployee
              }
              className="space-y-5 p-6"
            >
              {editError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {editError}
                </div>
              )}

              {renderFormFields(
                editForm,
                updateEditFormField
              )}

              <div className="flex flex-wrap justify-end gap-3 border-t border-[#ECECF3] pt-5">
                <button
                  type="button"
                  onClick={
                    closeEditEmployee
                  }
                  disabled={
                    editingSaving
                  }
                  className="rounded-lg border border-[#DCDDEA] px-5 py-2.5 font-medium text-[#20243A] hover:bg-[#F8F9FC]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    editingSaving
                  }
                  className="flex items-center gap-2 rounded-lg bg-[#0D9488] px-5 py-2.5 font-medium text-white hover:bg-[#0f766e] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {editingSaving && (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  )}

                  {editingSaving
                    ? "Saving..."
                    : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  min,
  max,
  step,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange?: (
    value: string
  ) => void;
  type?: string;
  required?: boolean;
  min?: string;
  max?: string;
  step?: string;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-[#20243A]">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </label>

      <input
        type={type}
        value={value}
        min={min}
        max={max}
        step={step}
        required={required}
        readOnly={readOnly}
        onChange={(event) =>
          onChange?.(
            event.target.value
          )
        }
        className={`w-full rounded-lg border border-[#DCDDEA] bg-white px-3 py-2.5 text-sm text-[#20243A] outline-none transition placeholder:text-[#A0A4B5] focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10 ${
          readOnly ? "cursor-not-allowed bg-[#F8F9FC]" : ""
        }`}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  options: Array<{
    value: string;
    label: string;
  }>;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-[#20243A]">
        {label}
      </label>

      <select
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className="w-full rounded-lg border border-[#DCDDEA] bg-white px-3 py-2.5 text-sm text-[#20243A] outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
      >
        {placeholder && (
          <option value="">
            {placeholder}
          </option>
        )}

        {options.map(
          (option) => (
            <option
              key={
                option.value
              }
              value={
                option.value
              }
            >
              {
                option.label
              }
            </option>
          )
        )}
      </select>
    </div>
  );
}

function ProfileField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-lg border border-[#ECECF3] bg-[#F8F9FC] p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[#888DA3]">
        {label}
      </p>

      <p className="mt-1 break-words font-medium text-[#20243A]">
        {fieldValue(value)}
      </p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | null | undefined;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#ECECF3] bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[#666B84]">
          {label}
        </p>

        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
          {icon}
        </div>
      </div>

      <p className="mt-3 break-words text-2xl font-bold leading-tight text-[#20243A]">
        {(Number(value) || 0).toLocaleString(
          "en-KE"
        )}
      </p>
    </div>
  );
}






