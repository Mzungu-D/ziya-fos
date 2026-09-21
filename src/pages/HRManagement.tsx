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
import type { FormEvent } from "react";
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
    total: number;
    active: number;
    onLeave: number;
    inactive: number;
    terminated: number;
    departments: number;
    departmentBreakdown?: Array<{
      department: string | null;
      count: number;
    }>;
    recentHires?: Employee[];
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

  managerId: string;

  bankName: string;
  bankBranch: string;
  bankAccountName: string;
  bankAccountNumber: string;
  mobileMoneyNumber: string;
  paymentMethod: string;
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

  managerId: "",

  bankName: "",
  bankBranch: "",
  bankAccountName: "",
  bankAccountNumber: "",
  mobileMoneyNumber: "",
  paymentMethod: "",
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
    managers,
    setManagers,
  ] = useState<ManagerOption[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    managersLoading,
    setManagersLoading,
  ] = useState(false);

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
              data.stats.total,
            active:
              data.stats.active,
            onLeave:
              data.stats.onLeave,
            inactive:
              data.stats.inactive,
            terminated:
              data.stats.terminated,
            departments:
              data.stats.departments,
          });
        }
      } catch (err) {
        console.error(
          "[HR] Failed to load statistics:",
          err
        );
      }
    };

  const loadManagers =
    async (
      excludeEmployeeId?: string
    ) => {
      try {
        setManagersLoading(true);

        const response =
          await authenticatedFetch(
            "/api/employees?page=1&pageSize=100&status=ACTIVE",
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
              `Failed to load managers (${response.status}).`
          );
        }

        if (!data?.success) {
          throw new Error(
            data?.message ||
              "Failed to load managers."
          );
        }

        const availableManagers =
          (data.employees ?? [])
            .filter(
              (employee) =>
                employee.id !==
                excludeEmployeeId
            )
            .map(
              (employee) => ({
                id: employee.id,
                employeeNumber:
                  employee.employeeNumber,
                firstName:
                  employee.firstName,
                middleName:
                  employee.middleName,
                lastName:
                  employee.lastName,
                name:
                  employee.name,
                jobTitle:
                  employee.jobTitle,
                department:
                  employee.department,
              })
            )
            .sort(
              (a, b) =>
                a.name.localeCompare(
                  b.name
                )
            );

        setManagers(
          availableManagers
        );
      } catch (err) {
        console.error(
          "[HR] Failed to load managers:",
          err
        );

        setActionError(
          err instanceof Error
            ? err.message
            : "Failed to load managers."
        );
      } finally {
        setManagersLoading(false);
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
        (a, b) =>
          a.localeCompare(b)
      );
    }, [employees]);

  const openAddEmployee =
    () => {
      setForm(emptyForm);
      setFormError("");
      setActionError("");

      void loadManagers();

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

                  managerId:
                    form.managerId ||
                    undefined,

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

        if (!data?.success) {
          throw new Error(
            data?.message ||
              "Failed to create employee."
          );
        }

        closeAddEmployee();

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
    };

  const openEditEmployee =
    async (
      employee: Employee
    ) => {
      setEditError("");
      setActionError("");

      await loadManagers(
        employee.id
      );

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

        managerId:
          employee.managerId ??
          "",

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

                  managerId:
                    editForm.managerId ||
                    null,

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
      ) => void,
      mode: "create" | "edit"
    ) => (
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

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-[#20243A]">
                Reports To
              </label>

              <select
                value={
                  currentForm.managerId
                }
                onChange={(event) =>
                  updateField(
                    "managerId",
                    event.target.value
                  )
                }
                disabled={
                  managersLoading
                }
                className="w-full rounded-lg border border-[#DCDDEA] bg-white px-3 py-2.5 text-sm text-[#20243A] outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10 disabled:cursor-not-allowed disabled:bg-[#F8F9FC]"
              >
                <option value="">
                  {managersLoading
                    ? "Loading reporting managers..."
                    : mode ===
                        "create"
                      ? "Select reporting manager"
                      : "No direct manager assigned"}
                </option>

                {managers.map(
                  (manager) => (
                    <option
                      key={
                        manager.id
                      }
                      value={
                        manager.id
                      }
                    >
                      {manager.name}
                      {manager.jobTitle
                        ? ` — ${manager.jobTitle}`
                        : ""}
                    </option>
                  )
                )}
              </select>

              <p className="text-xs text-[#888DA3]">
                Select the person this employee directly reports to.
              </p>
            </div>

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
                updateFormField,
                "create"
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
                updateEditFormField,
                "edit"
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
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  type?: string;
  required?: boolean;
  min?: string;
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
        required={required}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className="w-full rounded-lg border border-[#DCDDEA] bg-white px-3 py-2.5 text-sm text-[#20243A] outline-none transition placeholder:text-[#A0A4B5] focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
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
  value: number;
  icon: React.ReactNode;
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
        {value.toLocaleString(
          "en-KE"
        )}
      </p>
    </div>
  );
}