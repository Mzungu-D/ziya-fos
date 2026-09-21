import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Loader2,
  Network,
  RefreshCw,
  Search,
  UserCheck,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { FormEvent, ReactNode } from "react";
import { authenticatedFetch } from "../lib/auth-session";

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

  hireDate?: string | null;
  status?: string | null;

  managerId?: string | null;

  manager?: ManagerOption | null;

  directReports?: Employee[];
  directReportCount?: number;
}

interface ManagerOption {
  id: string;
  employeeNumber: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  name: string;
  jobTitle?: string | null;
  department?: string | null;
  status?: string | null;
}



interface ReportingStructureResponse {
  success: boolean;
  employees?: Employee[];
  count?: number;
  message?: string;
}

interface ManagerAssignmentResponse {
  success: boolean;
  message?: string;
  employee?: Employee;
}

type ViewMode = "ORG_CHART" | "LIST";

interface AssignManagerModalProps {
  employee: Employee;
  employees: Employee[];
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

export default function ReportingStructure() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [viewMode, setViewMode] =
    useState<ViewMode>("ORG_CHART");

  const [search, setSearch] = useState("");

  const [selectedEmployee, setSelectedEmployee] =
    useState<Employee | null>(null);

  const [error, setError] = useState("");

  const loadReportingStructure =
    useCallback(async () => {
      try {
        setError("");

        const response =
          await authenticatedFetch(
            "/api/employees/hierarchy",
            {
              method: "GET",
              headers: {
                Accept: "application/json",
              },
            }
          );

        const data =
          (await response.json()) as ReportingStructureResponse;

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Failed to load reporting structure."
          );
        }

        setEmployees(
          Array.isArray(data.employees)
            ? data.employees
            : []
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load reporting structure."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    }, []);

  useEffect(() => {
    void loadReportingStructure();
  }, [loadReportingStructure]);

  const refresh = async () => {
    setRefreshing(true);
    await loadReportingStructure();
  };

  const normalizedSearch =
    search.trim().toLowerCase();

  const filteredEmployees = useMemo(() => {
    if (!normalizedSearch) {
      return employees;
    }

    return employees.filter((employee) => {
      const haystack = [
        employee.employeeNumber,
        employee.name,
        employee.firstName,
        employee.middleName,
        employee.lastName,
        employee.email,
        employee.department,
        employee.jobTitle,
        employee.manager?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [employees, normalizedSearch]);

  const employeeById = useMemo(() => {
    return new Map(
      employees.map((employee) => [
        employee.id,
        employee,
      ])
    );
  }, [employees]);


  const unassignedEmployees = useMemo(
    () =>
      filteredEmployees.filter(
        (employee) => !employee.managerId
      ),
    [filteredEmployees]
  );

  const managers = useMemo(
    () =>
      employees.filter(
        (employee) =>
          employees.some(
            (child) =>
              child.managerId === employee.id
          )
      ),
    [employees]
  );

  const totalDirectReports = useMemo(
    () =>
      employees.reduce(
        (total, employee) =>
          total +
          Number(employee.directReportCount || 0),
        0
      ),
    [employees]
  );

  const openAssignManager = (
    employee: Employee
  ) => {
    setSelectedEmployee(employee);
  };

  const closeAssignManager = () => {
    setSelectedEmployee(null);
  };

  const handleAssignmentSuccess = async () => {
    setSelectedEmployee(null);
    await loadReportingStructure();
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="flex items-center gap-3 text-[#666B84]">
          <Loader2
            size={22}
            className="animate-spin"
          />
          <span>
            Loading reporting structure...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0D9488]/10 text-[#0D9488]">
              <Network size={22} />
            </div>

            <div>
              <h1 className="text-3xl font-bold text-[#20243A]">
                Reporting Structure
              </h1>

              <p className="mt-1 text-[#666B84]">
                Manage reporting relationships and
                organizational hierarchy.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          className="flex items-center justify-center gap-2 rounded-lg border border-[#DCDDEA] bg-white px-4 py-2.5 font-medium text-[#20243A] transition hover:bg-[#F8F9FC] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            size={17}
            className={
              refreshing
                ? "animate-spin"
                : ""
            }
          />
          Refresh
        </button>
      </div>

      {/* ERROR */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle
            size={19}
            className="mt-0.5 shrink-0"
          />

          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              Unable to load reporting structure
            </p>

            <p className="mt-1 text-sm">
              {error}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setError("")}
            className="rounded-md p-1 hover:bg-red-100"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* SUMMARY */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Employees"
          value={employees.length}
          icon={<Users size={19} />}
        />

        <SummaryCard
          label="Managers"
          value={managers.length}
          icon={<UserCheck size={19} />}
        />

        <SummaryCard
          label="Unassigned"
          value={unassignedEmployees.length}
          icon={<UserMinus size={19} />}
        />

        <SummaryCard
          label="Direct Reporting Links"
          value={totalDirectReports}
          icon={<GitBranch size={19} />}
        />
      </div>

      {/* WORKSPACE */}
      <div className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white shadow-sm">
        <div className="border-b border-[#ECECF3] p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setViewMode("ORG_CHART")
                }
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                  viewMode === "ORG_CHART"
                    ? "bg-[#0D9488] text-white"
                    : "border border-[#DCDDEA] bg-white text-[#666B84] hover:bg-[#F8F9FC]"
                }`}
              >
                <Network size={17} />
                Org Chart
              </button>

              <button
                type="button"
                onClick={() =>
                  setViewMode("LIST")
                }
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                  viewMode === "LIST"
                    ? "bg-[#0D9488] text-white"
                    : "border border-[#DCDDEA] bg-white text-[#666B84] hover:bg-[#F8F9FC]"
                }`}
              >
                <Users size={17} />
                List View
              </button>
            </div>

            <div className="relative w-full xl:max-w-sm">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888DA3]"
              />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search employees or managers..."
                className="w-full rounded-lg border border-[#DCDDEA] bg-white py-2.5 pl-10 pr-4 text-sm text-[#20243A] outline-none transition placeholder:text-[#A0A4B8] focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
              />
            </div>
          </div>
        </div>

        {viewMode === "ORG_CHART" ? (
          <OrgChart
            employees={filteredEmployees}
            employeeById={employeeById}
            onAssignManager={openAssignManager}
          />
        ) : (
          <ReportingList
            employees={filteredEmployees}
            employeeById={employeeById}
            onAssignManager={openAssignManager}
          />
        )}
      </div>

      {/* UNASSIGNED SECTION */}
      {unassignedEmployees.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50">
          <div className="flex flex-col gap-3 border-b border-amber-200 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-[#20243A]">
                Employees Requiring Assignment
              </h2>

              <p className="mt-1 text-sm text-[#666B84]">
                These employees currently have no
                reporting manager.
              </p>
            </div>

            <div className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-amber-700">
              {unassignedEmployees.length}{" "}
              unassigned
            </div>
          </div>

          <div className="divide-y divide-amber-200">
            {unassignedEmployees.map(
              (employee) => (
                <div
                  key={employee.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar
                      name={employee.name}
                    />

                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#20243A]">
                        {employee.name}
                      </p>

                      <p className="truncate text-sm text-[#666B84]">
                        {employee.jobTitle ||
                          "Employee"}
                        {employee.department
                          ? ` Â· ${employee.department}`
                          : ""}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      openAssignManager(
                        employee
                      )
                    }
                    className="flex items-center justify-center gap-2 rounded-lg bg-[#0D9488] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0f766e]"
                  >
                    <UserCheck size={16} />
                    Assign Manager
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {selectedEmployee && (
        <AssignManagerModal
          employee={selectedEmployee}
          employees={employees}
          onClose={closeAssignManager}
          onSuccess={handleAssignmentSuccess}
        />
      )}
    </div>
  );
}

/* =========================================================
   ORG CHART
========================================================= */

function OrgChart({
  employees,
  employeeById,
  onAssignManager,
}: {
  employees: Employee[];
  employeeById: Map<string, Employee>;
  onAssignManager: (employee: Employee) => void;
}) {
  const topLevelEmployees = employees.filter(
    (employee) =>
      !employee.managerId ||
      !employeeById.has(employee.managerId)
  );

  if (employees.length === 0) {
    return (
      <EmptyState
        title="No employees found"
        description="There are no employees matching the current search."
      />
    );
  }

  return (
    <div className="overflow-x-auto p-6">
      <div className="min-w-max">
        <div className="flex flex-col items-center gap-8">
          {topLevelEmployees.map(
            (employee) => (
              <OrgNode
                key={employee.id}
                employee={employee}
                employees={employees}
                depth={0}
                onAssignManager={
                  onAssignManager
                }
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}

function OrgNode({
  employee,
  employees,
  depth,
  onAssignManager,
}: {
  employee: Employee;
  employees: Employee[];
  depth: number;
  onAssignManager: (employee: Employee) => void;
}) {
  const [expanded, setExpanded] =
    useState(true);

  const directReports = employees.filter(
    (child) =>
      child.managerId === employee.id
  );

  return (
    <div className="flex flex-col items-center">
      <EmployeeOrgCard
        employee={employee}
        directReportCount={
          directReports.length
        }
        expanded={expanded}
        hasChildren={
          directReports.length > 0
        }
        onToggle={() =>
          setExpanded((value) => !value)
        }
        onAssignManager={
          onAssignManager
        }
      />

      {expanded &&
        directReports.length > 0 && (
          <>
            <div className="h-8 w-px bg-[#DCDDEA]" />

            <div className="relative flex gap-6 pt-6">
              {directReports.length > 1 && (
                <div className="absolute left-1/2 top-0 h-px w-[calc(100%-150px)] -translate-x-1/2 bg-[#DCDDEA]" />
              )}

              {directReports.map(
                (child) => (
                  <div
                    key={child.id}
                    className="relative"
                  >
                    <div className="absolute left-1/2 top-0 h-6 w-px -translate-x-1/2 bg-[#DCDDEA]" />

                    <OrgNode
                      employee={child}
                      employees={employees}
                      depth={depth + 1}
                      onAssignManager={
                        onAssignManager
                      }
                    />
                  </div>
                )
              )}
            </div>
          </>
        )}
    </div>
  );
}

function EmployeeOrgCard({
  employee,
  directReportCount,
  expanded,
  hasChildren,
  onToggle,
  onAssignManager,
}: {
  employee: Employee;
  directReportCount: number;
  expanded: boolean;
  hasChildren: boolean;
  onToggle: () => void;
  onAssignManager: (employee: Employee) => void;
}) {
  return (
    <div className="group relative w-[280px] rounded-2xl border border-[#DCDDEA] bg-white p-4 shadow-sm transition hover:border-[#0D9488]/40 hover:shadow-md">
      <div className="flex items-start gap-3">
        <Avatar
          name={employee.name}
          size="lg"
        />

        <div className="min-w-0 flex-1 text-left">
          <p className="truncate font-semibold text-[#20243A]">
            {employee.name}
          </p>

          <p className="mt-0.5 truncate text-sm text-[#666B84]">
            {employee.jobTitle ||
              "Employee"}
          </p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {employee.department && (
              <span className="rounded-full bg-[#F4F5F9] px-2 py-0.5 text-[11px] font-medium text-[#666B84]">
                {employee.department}
              </span>
            )}

            {employee.status && (
              <StatusBadge
                status={employee.status}
              />
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-[#ECECF3] pt-3">
        <div className="flex items-center gap-2 text-xs text-[#666B84]">
          <Users size={14} />

          <span>
            {directReportCount}{" "}
            {directReportCount === 1
              ? "direct report"
              : "direct reports"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {hasChildren && (
            <button
              type="button"
              onClick={onToggle}
              title={
                expanded
                  ? "Collapse"
                  : "Expand"
              }
              className="rounded-md p-1.5 text-[#666B84] hover:bg-[#F8F9FC] hover:text-[#20243A]"
            >
              {expanded ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              onAssignManager(employee)
            }
            className="rounded-md p-1.5 text-[#0D9488] hover:bg-[#0D9488]/10"
            title={
              employee.managerId
                ? "Change manager"
                : "Assign manager"
            }
          >
            <UserCheck size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   LIST VIEW
========================================================= */

function ReportingList({
  employees,
  employeeById,
  onAssignManager,
}: {
  employees: Employee[];
  employeeById: Map<string, Employee>;
  onAssignManager: (employee: Employee) => void;
}) {
  if (employees.length === 0) {
    return (
      <EmptyState
        title="No employees found"
        description="There are no employees matching the current search."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[980px] w-full">
        <thead>
          <tr className="border-b border-[#ECECF3] bg-[#F8F9FC] text-left">
            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#888DA3]">
              Employee
            </th>

            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#888DA3]">
              Job / Department
            </th>

            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#888DA3]">
              Reports To
            </th>

            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#888DA3]">
              Direct Reports
            </th>

            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#888DA3]">
              Status
            </th>

            <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#888DA3]">
              Action
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-[#ECECF3]">
          {employees.map((employee) => {
            const manager =
              employee.managerId
                ? employeeById.get(
                    employee.managerId
                  )
                : null;

            const directReportCount =
              employees.filter(
                (child) =>
                  child.managerId ===
                  employee.id
              ).length;

            return (
              <tr
                key={employee.id}
                className="transition hover:bg-[#FAFBFC]"
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={employee.name}
                    />

                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#20243A]">
                        {employee.name}
                      </p>

                      <p className="truncate text-xs text-[#888DA3]">
                        {employee.employeeNumber}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="px-5 py-4">
                  <p className="font-medium text-[#20243A]">
                    {employee.jobTitle ||
                      "â€”"}
                  </p>

                  <p className="mt-0.5 text-sm text-[#666B84]">
                    {employee.department ||
                      "No department"}
                  </p>
                </td>

                <td className="px-5 py-4">
                  {manager ? (
                    <div>
                      <p className="font-medium text-[#20243A]">
                        {manager.name}
                      </p>

                      <p className="mt-0.5 text-sm text-[#666B84]">
                        {manager.jobTitle ||
                          "Manager"}
                      </p>
                    </div>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                      No manager assigned
                    </span>
                  )}
                </td>

                <td className="px-5 py-4">
                  <div className="flex items-center gap-2 text-sm text-[#666B84]">
                    <Users size={15} />
                    {directReportCount}
                  </div>
                </td>

                <td className="px-5 py-4">
                  <StatusBadge
                    status={
                      employee.status ||
                      "ACTIVE"
                    }
                  />
                </td>

                <td className="px-5 py-4 text-right">
                  <button
                    type="button"
                    onClick={() =>
                      onAssignManager(
                        employee
                      )
                    }
                    className="rounded-lg border border-[#DCDDEA] bg-white px-3 py-2 text-sm font-medium text-[#20243A] transition hover:border-[#0D9488] hover:text-[#0D9488]"
                  >
                    {manager
                      ? "Change Manager"
                      : "Assign Manager"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* =========================================================
   ASSIGN MANAGER MODAL
========================================================= */

function AssignManagerModal({
  employee,
  employees,
  onClose,
  onSuccess,
}: AssignManagerModalProps) {
  const [managerId, setManagerId] =
    useState(employee.managerId || "");

  const [managerSearch, setManagerSearch] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const eligibleManagers = useMemo(() => {
    const query =
      managerSearch.trim().toLowerCase();

    return employees
      .filter(
        (candidate) =>
          candidate.id !== employee.id
      )
      .filter((candidate) => {
        if (!query) {
          return true;
        }

        const haystack = [
          candidate.employeeNumber,
          candidate.name,
          candidate.firstName,
          candidate.middleName,
          candidate.lastName,
          candidate.jobTitle,
          candidate.department,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      })
      .sort((a, b) =>
        a.name.localeCompare(b.name)
      );
  }, [
    employees,
    employee.id,
    managerSearch,
  ]);

  const selectedManager = employees.find(
    (candidate) =>
      candidate.id === managerId
  );

  const submit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");

      const response =
        await authenticatedFetch(
          `/api/employees/${employee.id}/manager`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
              Accept:
                "application/json",
            },
            body: JSON.stringify({
              managerId:
                managerId || null,
            }),
          }
        );

      const data =
        (await response.json()) as ManagerAssignmentResponse;

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to update reporting relationship."
        );
      }

      await onSuccess();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update reporting relationship."
      );
    } finally {
      setSaving(false);
    }
  };

  const removeManager = async () => {
    try {
      setSaving(true);
      setError("");

      const response =
        await authenticatedFetch(
          `/api/employees/${employee.id}/manager`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
              Accept:
                "application/json",
            },
            body: JSON.stringify({
              managerId: null,
            }),
          }
        );

      const data =
        (await response.json()) as ManagerAssignmentResponse;

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to remove manager."
        );
      }

      await onSuccess();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to remove manager."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-[#ECECF3] p-6">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0D9488]/10 text-[#0D9488]">
                <GitBranch size={20} />
              </div>

              <div>
                <h2 className="text-xl font-bold text-[#20243A]">
                  {employee.managerId
                    ? "Change Manager"
                    : "Assign Manager"}
                </h2>

                <p className="mt-1 text-sm text-[#666B84]">
                  Define the employee's
                  primary reporting relationship.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-2 text-[#666B84] transition hover:bg-[#F8F9FC] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={19} />
          </button>
        </div>

        <form
          onSubmit={submit}
          className="max-h-[calc(92vh-88px)] overflow-y-auto"
        >
          <div className="space-y-6 p-6">
            {/* EMPLOYEE */}
            <div className="rounded-xl border border-[#ECECF3] bg-[#F8F9FC] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#888DA3]">
                Employee
              </p>

              <div className="mt-3 flex items-center gap-3">
                <Avatar
                  name={employee.name}
                  size="lg"
                />

                <div className="min-w-0">
                  <p className="truncate font-semibold text-[#20243A]">
                    {employee.name}
                  </p>

                  <p className="mt-0.5 text-sm text-[#666B84]">
                    {employee.employeeNumber}
                    {employee.jobTitle
                      ? ` Â· ${employee.jobTitle}`
                      : ""}
                  </p>

                  {employee.department && (
                    <p className="mt-0.5 text-xs text-[#888DA3]">
                      {employee.department}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* MANAGER SEARCH */}
            <div className="space-y-3">
              <div>
                <label className="text-sm font-semibold text-[#20243A]">
                  Reports To
                </label>

                <p className="mt-1 text-xs text-[#888DA3]">
                  Select an employee who will
                  be this employee's primary
                  manager.
                </p>
              </div>

              <div className="relative">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888DA3]"
                />

                <input
                  type="text"
                  value={managerSearch}
                  onChange={(event) =>
                    setManagerSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search employees by name, number, role or department..."
                  className="w-full rounded-lg border border-[#DCDDEA] bg-white py-2.5 pl-10 pr-4 text-sm text-[#20243A] outline-none transition placeholder:text-[#A0A4B8] focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
                />
              </div>

              {selectedManager && (
                <div className="rounded-xl border border-[#0D9488]/30 bg-[#0D9488]/5 p-3">
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={
                        selectedManager.name
                      }
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-[#20243A]">
                        {
                          selectedManager.name
                        }
                      </p>

                      <p className="truncate text-sm text-[#666B84]">
                        {selectedManager.jobTitle ||
                          "Employee"}
                        {selectedManager.department
                          ? ` Â· ${selectedManager.department}`
                          : ""}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setManagerId("")
                      }
                      className="rounded-md p-1.5 text-[#666B84] hover:bg-white hover:text-[#20243A]"
                      title="Clear manager"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )}

              <div className="max-h-64 overflow-y-auto rounded-xl border border-[#DCDDEA] bg-white">
                {eligibleManagers.length === 0 ? (
                  <div className="p-6 text-center text-sm text-[#888DA3]">
                    No eligible employees found.
                  </div>
                ) : (
                  <div className="divide-y divide-[#ECECF3]">
                    {eligibleManagers.map(
                      (candidate) => {
                        const selected =
                          candidate.id ===
                          managerId;

                        return (
                          <button
                            key={
                              candidate.id
                            }
                            type="button"
                            onClick={() =>
                              setManagerId(
                                candidate.id
                              )
                            }
                            className={`flex w-full items-center gap-3 p-3 text-left transition ${
                              selected
                                ? "bg-[#0D9488]/5"
                                : "hover:bg-[#F8F9FC]"
                            }`}
                          >
                            <Avatar
                              name={
                                candidate.name
                              }
                            />

                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-[#20243A]">
                                {
                                  candidate.name
                                }
                              </p>

                              <p className="truncate text-xs text-[#888DA3]">
                                {
                                  candidate.employeeNumber
                                }

                                {candidate.jobTitle
                                  ? ` Â· ${candidate.jobTitle}`
                                  : ""}

                                {candidate.department
                                  ? ` Â· ${candidate.department}`
                                  : ""}
                              </p>
                            </div>

                            {selected && (
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0D9488] text-white">
                                <UserCheck
                                  size={
                                    13
                                  }
                                />
                              </div>
                            )}
                          </button>
                        );
                      }
                    )}
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle
                  size={17}
                  className="mt-0.5 shrink-0"
                />

                <span>
                  {error}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ECECF3] bg-white p-5">
            <div>
              {employee.managerId && (
                <button
                  type="button"
                  onClick={() =>
                    void removeManager()
                  }
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <UserMinus size={16} />
                  Remove Manager
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-lg border border-[#DCDDEA] px-5 py-2.5 text-sm font-medium text-[#20243A] transition hover:bg-[#F8F9FC] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  saving ||
                  !managerId
                }
                className="flex items-center gap-2 rounded-lg bg-[#0D9488] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#0f766e] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving && (
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                )}

                {employee.managerId
                  ? "Save Manager"
                  : "Assign Manager"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================================================
   SHARED UI
========================================================= */

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
    <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[#666B84]">
          {label}
        </p>

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0D9488]/10 text-[#0D9488]">
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

function Avatar({
  name,
  size = "md",
}: {
  name?: string | null;
  size?: "md" | "lg";
}) {
  const initials =
    String(name || "Employee")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) =>
        part.charAt(0).toUpperCase()
      )
      .join("") || "E";

  const classes =
    size === "lg"
      ? "h-12 w-12 text-sm"
      : "h-9 w-9 text-xs";

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-[#0D9488]/10 font-semibold text-[#0D9488] ${classes}`}
    >
      {initials}
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const normalized =
    status
      .toUpperCase()
      .replace(/\s+/g, "_");

  const tone =
    normalized === "ACTIVE"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : normalized === "ON_LEAVE"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : normalized === "TERMINATED"
          ? "bg-red-50 text-red-700 border-red-200"
          : "bg-gray-50 text-gray-700 border-gray-200";

  const label =
    normalized
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${tone}`}
    >
      {label}
    </span>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F8F9FC] text-[#888DA3]">
        <Users size={22} />
      </div>

      <h3 className="mt-4 font-semibold text-[#20243A]">
        {title}
      </h3>

      <p className="mt-1 max-w-md text-sm text-[#666B84]">
        {description}
      </p>
    </div>
  );
}

