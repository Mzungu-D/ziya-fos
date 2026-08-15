import {
  AlertCircle,
  Briefcase,
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

interface Employee {
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
  hireDate: string;
  basicSalary: number | string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
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
}

interface EmployeeResponse {
  success: boolean;
  employee?: Employee;
  payrollRecords?: PayrollRecord[];
  message?: string;
}

interface EmployeeForm {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  department: string;
  jobTitle: string;
  employmentType: string;
  hireDate: string;
  basicSalary: string;
  status: string;
}

const emptyForm: EmployeeForm = {
  employeeNumber: "",
  firstName: "",
  lastName: "",
  email: "",
  phoneNumber: "",
  department: "",
  jobTitle: "",
  employmentType: "FULL_TIME",
  hireDate: "",
  basicSalary: "",
  status: "ACTIVE",
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
  value: string
): string {
  if (!value) return "—";

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
  value: string
): string {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return date
    .toISOString()
    .slice(0, 10);
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

export default function HRManagement() {
  const [employees, setEmployees] =
    useState<Employee[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [editingSaving, setEditingSaving] =
    useState(false);

  const [
    deletingEmployeeId,
    setDeletingEmployeeId,
  ] = useState<string | null>(null);

  const [error, setError] =
    useState("");

  const [formError, setFormError] =
    useState("");

  const [editError, setEditError] =
    useState("");

  const [actionError, setActionError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [showAddModal, setShowAddModal] =
    useState(false);

  const [
    viewingEmployee,
    setViewingEmployee,
  ] = useState<
    (Employee & {
      payrollRecords?: PayrollRecord[];
    }) | null
  >(null);

  const [
    editingEmployee,
    setEditingEmployee,
  ] = useState<Employee | null>(null);

  const [form, setForm] =
    useState<EmployeeForm>(
      emptyForm
    );

  const [
    editForm,
    setEditForm,
  ] = useState<EmployeeForm>(
    emptyForm
  );

  const loadEmployees =
    async () => {
      try {
        setLoading(true);
        setError("");

        const query = search.trim()
          ? `?search=${encodeURIComponent(
              search.trim()
            )}`
          : "";

        const response =
          await authenticatedFetch(
            `/api/employees${query}`,
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
  }, [search]);

  const departments =
    useMemo(() => {
      return new Set(
        employees
          .map(
            (employee) =>
              employee.department
          )
          .filter(Boolean)
      ).size;
    }, [employees]);

  const openAddEmployee =
    () => {
      setForm(emptyForm);
      setFormError("");
      setShowAddModal(true);
    };

  const closeAddEmployee =
    () => {
      if (saving) return;

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
        Number(form.basicSalary);

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
              body: JSON.stringify({
                employeeNumber:
                  form.employeeNumber.trim(),
                firstName:
                  form.firstName.trim(),
                lastName:
                  form.lastName.trim(),
                email:
                  form.email.trim() ||
                  undefined,
                phoneNumber:
                  form.phoneNumber.trim() ||
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
                basicSalary:
                  salary,
                status:
                  form.status ||
                  "ACTIVE",
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

        await loadEmployees();
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
      }
    };

  const closeViewEmployee =
    () => {
      setViewingEmployee(null);
    };

  const openEditEmployee =
    (employee: Employee) => {
      setEditError("");

      setEditForm({
        employeeNumber:
          employee.employeeNumber ||
          "",
        firstName:
          employee.firstName ||
          "",
        lastName:
          employee.lastName ||
          "",
        email:
          employee.email || "",
        phoneNumber:
          employee.phoneNumber ||
          "",
        department:
          employee.department ||
          "",
        jobTitle:
          employee.jobTitle ||
          "",
        employmentType:
          employee.employmentType ||
          "FULL_TIME",
        hireDate:
          dateInputValue(
            employee.hireDate
          ),
        basicSalary:
          String(
            employee.basicSalary ??
              ""
          ),
        status:
          employee.status ||
          "ACTIVE",
      });

      setEditingEmployee(
        employee
      );
    };

  const closeEditEmployee =
    () => {
      if (editingSaving) return;

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
              body: JSON.stringify({
                firstName:
                  editForm.firstName.trim(),
                lastName:
                  editForm.lastName.trim(),
                email:
                  editForm.email.trim(),
                phoneNumber:
                  editForm.phoneNumber.trim(),
                department:
                  editForm.department.trim(),
                jobTitle:
                  editForm.jobTitle.trim(),
                employmentType:
                  editForm.employmentType ||
                  "FULL_TIME",
                hireDate:
                  editForm.hireDate,
                basicSalary:
                  salary,
                status:
                  editForm.status ||
                  "ACTIVE",
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

        await loadEmployees();
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
            code?: string;
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

        await loadEmployees();
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#20243A]">
            HR Management
          </h1>

          <p className="mt-2 text-[#666B84]">
            Manage employees, departments and workforce information.
          </p>
        </div>

        <button
          type="button"
          onClick={
            openAddEmployee
          }
          className="flex items-center justify-center gap-2 rounded-lg bg-[#0D9488] px-4 py-2 font-medium text-white transition hover:bg-[#0f766e]"
        >
          <Plus size={18} />
          Add Employee
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6">
          <p className="text-[#666B84]">
            Employees
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#20243A]">
            {loading
              ? "—"
              : employees.length}
          </h2>
        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6">
          <p className="text-[#666B84]">
            Departments
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#20243A]">
            {loading
              ? "—"
              : departments}
          </h2>
        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-6">
          <p className="text-[#666B84]">
            Active Employees
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#20243A]">
            {loading
              ? "—"
              : employees.filter(
                  (employee) =>
                    employee.status ===
                    "ACTIVE"
                ).length}
          </h2>
        </div>
      </div>

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
                event.target.value
              )
            }
            placeholder="Search employees..."
            className="flex-1 bg-transparent px-3 py-3 text-[#20243A] outline-none"
          />

          {loading && (
            <Loader2
              size={18}
              className="animate-spin text-[#666B84]"
            />
          )}
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
                className="mt-3 text-sm font-semibold text-red-700 underline"
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
                className="mt-3 text-sm font-semibold text-red-700 underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {!error && (
        <>
          {loading ? (
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
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {employees.map(
                (employee) => (
                  <div
                    key={
                      employee.id
                    }
                    className="rounded-2xl border border-[#ECECF3] bg-white p-6 transition hover:border-[#20243A]"
                  >
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#0D9488]/10">
                          <Users
                            size={28}
                            className="text-[#20243A]"
                          />
                        </div>

                        <div>
                          <h2 className="text-xl font-semibold text-[#20243A]">
                            {employee.name}
                          </h2>

                          <p className="text-[#666B84]">
                            {employee.jobTitle ||
                              "Employee"}
                          </p>

                          <p className="mt-1 text-xs text-[#888DA3]">
                            {
                              employee.employeeNumber
                            }
                          </p>
                        </div>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-sm ${
                          employee.status ===
                          "ACTIVE"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {statusLabel(
                          employee.status
                        )}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-[#666B84]">
                        <Briefcase
                          size={16}
                        />

                        <span>
                          {employee.department ||
                            "No department"}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[#666B84]">
                        <Mail
                          size={16}
                        />

                        <span>
                          {employee.email ||
                            "No email"}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[#666B84]">
                        <Phone
                          size={16}
                        />

                        <span>
                          {employee.phoneNumber ||
                            "No phone number"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-[#ECECF3] pt-4">
                      <div>
                        <p className="text-xs text-[#888DA3]">
                          Basic Salary
                        </p>

                        <p className="mt-1 font-semibold text-[#20243A]">
                          {formatCurrency(
                            employee.basicSalary
                          )}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-[#888DA3]">
                          Hire Date
                        </p>

                        <p className="mt-1 text-sm font-medium text-[#20243A]">
                          {formatDate(
                            employee.hireDate
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[#ECECF3] pt-4">
                      <button
                        type="button"
                        onClick={() =>
                          void viewEmployee(
                            employee
                          )
                        }
                        className="flex items-center gap-2 rounded-lg border border-[#DCDDEA] px-3 py-2 text-sm font-medium text-[#20243A] transition hover:bg-[#F8F9FC]"
                      >
                        <Eye
                          size={16}
                        />
                        View
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          openEditEmployee(
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
                )
              )}
            </div>
          )}
        </>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#ECECF3] p-6">
              <div>
                <h2 className="text-xl font-bold text-[#20243A]">
                  Add Employee
                </h2>

                <p className="mt-1 text-sm text-[#666B84]">
                  Add a new employee to this organization.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeAddEmployee
                }
                disabled={saving}
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
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#20243A]">
                    Employee Number *
                  </span>

                  <input
                    value={
                      form.employeeNumber
                    }
                    onChange={(
                      event
                    ) =>
                      setForm({
                        ...form,
                        employeeNumber:
                          event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-[#DCDDEA] px-3 py-2.5 text-[#20243A] outline-none focus:border-[#0D9488]"
                    required
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#20243A]">
                    Hire Date *
                  </span>

                  <input
                    type="date"
                    value={
                      form.hireDate
                    }
                    onChange={(
                      event
                    ) =>
                      setForm({
                        ...form,
                        hireDate:
                          event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-[#DCDDEA] px-3 py-2.5 text-[#20243A] outline-none focus:border-[#0D9488]"
                    required
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#20243A]">
                    First Name *
                  </span>

                  <input
                    value={
                      form.firstName
                    }
                    onChange={(
                      event
                    ) =>
                      setForm({
                        ...form,
                        firstName:
                          event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-[#DCDDEA] px-3 py-2.5 text-[#20243A] outline-none focus:border-[#0D9488]"
                    required
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#20243A]">
                    Last Name *
                  </span>

                  <input
                    value={
                      form.lastName
                    }
                    onChange={(
                      event
                    ) =>
                      setForm({
                        ...form,
                        lastName:
                          event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-[#DCDDEA] px-3 py-2.5 text-[#20243A] outline-none focus:border-[#0D9488]"
                    required
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#20243A]">
                    Job Title
                  </span>

                  <input
                    value={
                      form.jobTitle
                    }
                    onChange={(
                      event
                    ) =>
                      setForm({
                        ...form,
                        jobTitle:
                          event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-[#DCDDEA] px-3 py-2.5 text-[#20243A] outline-none focus:border-[#0D9488]"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#20243A]">
                    Department
                  </span>

                  <input
                    value={
                      form.department
                    }
                    onChange={(
                      event
                    ) =>
                      setForm({
                        ...form,
                        department:
                          event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-[#DCDDEA] px-3 py-2.5 text-[#20243A] outline-none focus:border-[#0D9488]"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#20243A]">
                    Email
                  </span>

                  <input
                    type="email"
                    value={
                      form.email
                    }
                    onChange={(
                      event
                    ) =>
                      setForm({
                        ...form,
                        email:
                          event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-[#DCDDEA] px-3 py-2.5 text-[#20243A] outline-none focus:border-[#0D9488]"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#20243A]">
                    Phone Number
                  </span>

                  <input
                    type="tel"
                    value={
                      form.phoneNumber
                    }
                    onChange={(
                      event
                    ) =>
                      setForm({
                        ...form,
                        phoneNumber:
                          event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-[#DCDDEA] px-3 py-2.5 text-[#20243A] outline-none focus:border-[#0D9488]"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#20243A]">
                    Employment Type
                  </span>

                  <select
                    value={
                      form.employmentType
                    }
                    onChange={(
                      event
                    ) =>
                      setForm({
                        ...form,
                        employmentType:
                          event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-[#DCDDEA] bg-white px-3 py-2.5 text-[#20243A] outline-none focus:border-[#0D9488]"
                  >
                    <option value="FULL_TIME">
                      Full Time
                    </option>

                    <option value="PART_TIME">
                      Part Time
                    </option>

                    <option value="CONTRACT">
                      Contract
                    </option>

                    <option value="CASUAL">
                      Casual
                    </option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#20243A]">
                    Basic Salary *
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      form.basicSalary
                    }
                    onChange={(
                      event
                    ) =>
                      setForm({
                        ...form,
                        basicSalary:
                          event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-[#DCDDEA] px-3 py-2.5 text-[#20243A] outline-none focus:border-[#0D9488]"
                    required
                  />
                </label>
              </div>

              <div className="flex justify-end gap-3 border-t border-[#ECECF3] pt-5">
                <button
                  type="button"
                  onClick={
                    closeAddEmployee
                  }
                  disabled={saving}
                  className="rounded-lg border border-[#DCDDEA] px-5 py-2.5 font-medium text-[#20243A] hover:bg-[#F8F9FC]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
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
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#ECECF3] p-6">
              <div>
                <h2 className="text-xl font-bold text-[#20243A]">
                  Employee Details
                </h2>

                <p className="mt-1 text-sm text-[#666B84]">
                  Complete employee information.
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
              <div className="flex flex-col gap-4 rounded-xl border border-[#ECECF3] bg-[#F8F9FC] p-5 sm:flex-row sm:items-center sm:justify-between">
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

                <span
                  className={`w-fit rounded-full px-3 py-1 text-sm ${
                    viewingEmployee.status ===
                    "ACTIVE"
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {statusLabel(
                    viewingEmployee.status
                  )}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-[#ECECF3] p-4">
                  <p className="text-xs text-[#888DA3]">
                    Department
                  </p>

                  <p className="mt-1 font-medium text-[#20243A]">
                    {viewingEmployee.department ||
                      "—"}
                  </p>
                </div>

                <div className="rounded-xl border border-[#ECECF3] p-4">
                  <p className="text-xs text-[#888DA3]">
                    Employment Type
                  </p>

                  <p className="mt-1 font-medium text-[#20243A]">
                    {viewingEmployee.employmentType
                      ? statusLabel(
                          viewingEmployee.employmentType
                        )
                      : "—"}
                  </p>
                </div>

                <div className="rounded-xl border border-[#ECECF3] p-4">
                  <p className="text-xs text-[#888DA3]">
                    Email
                  </p>

                  <p className="mt-1 break-all font-medium text-[#20243A]">
                    {viewingEmployee.email ||
                      "—"}
                  </p>
                </div>

                <div className="rounded-xl border border-[#ECECF3] p-4">
                  <p className="text-xs text-[#888DA3]">
                    Phone
                  </p>

                  <p className="mt-1 font-medium text-[#20243A]">
                    {viewingEmployee.phoneNumber ||
                      "—"}
                  </p>
                </div>

                <div className="rounded-xl border border-[#ECECF3] p-4">
                  <p className="text-xs text-[#888DA3]">
                    Basic Salary
                  </p>

                  <p className="mt-1 font-semibold text-[#20243A]">
                    {formatCurrency(
                      viewingEmployee.basicSalary
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-[#ECECF3] p-4">
                  <p className="text-xs text-[#888DA3]">
                    Hire Date
                  </p>

                  <p className="mt-1 font-medium text-[#20243A]">
                    {formatDate(
                      viewingEmployee.hireDate
                    )}
                  </p>
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-[#20243A]">
                    Payroll History
                  </h3>

                  <span className="text-sm text-[#666B84]">
                    {(
                      viewingEmployee.payrollRecords ??
                      []
                    ).length}{" "}
                    record
                    {(
                      viewingEmployee.payrollRecords ??
                      []
                    ).length === 1
                      ? ""
                      : "s"}
                  </span>
                </div>

                {(
                  viewingEmployee.payrollRecords ??
                  []
                ).length === 0 ? (
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

                    if (employee) {
                      closeViewEmployee();
                      openEditEmployee(
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
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#ECECF3] p-6">
              <div>
                <h2 className="text-xl font-bold text-[#20243A]">
                  Edit Employee
                </h2>

                <p className="mt-1 text-sm text-[#666B84]">
                  Update employee information.
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
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {editError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#20243A]">
                    Employee Number
                  </span>

                  <input
                    value={
                      editForm.employeeNumber
                    }
                    readOnly
                    className="w-full cursor-not-allowed rounded-lg border border-[#DCDDEA] bg-[#F8F9FC] px-3 py-2.5 text-[#666B84] outline-none"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#20243A]">
                    Hire Date *
                  </span>

                  <input
                    type="date"
                    value={
                      editForm.hireDate
                    }
                    onChange={(
                      event
                    ) =>
                      setEditForm({
                        ...editForm,
                        hireDate:
                          event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-[#DCDDEA] px-3 py-2.5 text-[#20243A] outline-none focus:border-[#0D9488]"
                    required
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#20243A]">
                    First Name *
                  </span>

                  <input
                    value={
                      editForm.firstName
                    }
                    onChange={(
                      event
                    ) =>
                      setEditForm({
                        ...editForm,
                        firstName:
                          event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-[#DCDDEA] px-3 py-2.5 text-[#20243A] outline-none focus:border-[#0D9488]"
                    required
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#20243A]">
                    Last Name *
                  </span>

                  <input
                    value={
                      editForm.lastName
                    }
                    onChange={(
                      event
                    ) =>
                      setEditForm({
                        ...editForm,
                        lastName:
                          event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-[#DCDDEA] px-3 py-2.5 text-[#20243A] outline-none focus:border-[#0D9488]"
                    required
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#20243A]">
                    Job Title
                  </span>

                  <input
                    value={
                      editForm.jobTitle
                    }
                    onChange={(
                      event
                    ) =>
                      setEditForm({
                        ...editForm,
                        jobTitle:
                          event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-[#DCDDEA] px-3 py-2.5 text-[#20243A] outline-none focus:border-[#0D9488]"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#20243A]">
                    Department
                  </span>

                  <input
                    value={
                      editForm.department
                    }
                    onChange={(
                      event
                    ) =>
                      setEditForm({
                        ...editForm,
                        department:
                          event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-[#DCDDEA] px-3 py-2.5 text-[#20243A] outline-none focus:border-[#0D9488]"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#20243A]">
                    Email
                  </span>

                  <input
                    type="email"
                    value={
                      editForm.email
                    }
                    onChange={(
                      event
                    ) =>
                      setEditForm({
                        ...editForm,
                        email:
                          event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-[#DCDDEA] px-3 py-2.5 text-[#20243A] outline-none focus:border-[#0D9488]"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#20243A]">
                    Phone Number
                  </span>

                  <input
                    type="tel"
                    value={
                      editForm.phoneNumber
                    }
                    onChange={(
                      event
                    ) =>
                      setEditForm({
                        ...editForm,
                        phoneNumber:
                          event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-[#DCDDEA] px-3 py-2.5 text-[#20243A] outline-none focus:border-[#0D9488]"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#20243A]">
                    Employment Type
                  </span>

                  <select
                    value={
                      editForm.employmentType
                    }
                    onChange={(
                      event
                    ) =>
                      setEditForm({
                        ...editForm,
                        employmentType:
                          event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-[#DCDDEA] bg-white px-3 py-2.5 text-[#20243A] outline-none focus:border-[#0D9488]"
                  >
                    <option value="FULL_TIME">
                      Full Time
                    </option>

                    <option value="PART_TIME">
                      Part Time
                    </option>

                    <option value="CONTRACT">
                      Contract
                    </option>

                    <option value="CASUAL">
                      Casual
                    </option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#20243A]">
                    Employee Status
                  </span>

                  <select
                    value={
                      editForm.status
                    }
                    onChange={(
                      event
                    ) =>
                      setEditForm({
                        ...editForm,
                        status:
                          event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-[#DCDDEA] bg-white px-3 py-2.5 text-[#20243A] outline-none focus:border-[#0D9488]"
                  >
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
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#20243A]">
                    Basic Salary *
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      editForm.basicSalary
                    }
                    onChange={(
                      event
                    ) =>
                      setEditForm({
                        ...editForm,
                        basicSalary:
                          event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-[#DCDDEA] px-3 py-2.5 text-[#20243A] outline-none focus:border-[#0D9488]"
                    required
                  />
                </label>
              </div>

              <div className="flex justify-end gap-3 border-t border-[#ECECF3] pt-5">
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