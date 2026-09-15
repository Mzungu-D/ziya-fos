import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  Filter,
  Package,
  RefreshCw,
  RotateCcw,
  Search,
  UserRound,
  X,
} from "lucide-react";

type Asset = {
  id: string;
  assetCode: string;
  name: string;
  category: string;
  value?: number | string | null;
  status?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  serviceTag?: string | null;
  imei?: string | null;
  imei2?: string | null;
  phoneNumber?: string | null;
  registrationNumber?: string | null;
  condition?: string | null;
  location?: string | null;
};

type Employee = {
  id: string;
  employeeNumber?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  status?: string | null;
};

type Assignment = {
  id: string;
  assetId: string;
  employeeId: string;
  organizationId?: string;
  assignedAt: string;
  returnedAt?: string | null;
  conditionAtAssignment?: string | null;
  conditionAtReturn?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  asset: Asset;
  employee: Employee;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type RegisterSummary = {
  totalAssignments: number;
  assignedCount: number;
  returnedCount: number;
};

type RegisterResponse = {
  success?: boolean;
  assignments?: Assignment[];
  pagination?: Pagination;
  summary?: RegisterSummary;
  message?: string;
  error?: string;
};

type EmployeesResponse = {
  employees?: Employee[];
  data?: Employee[];
  items?: Employee[];
};

type AssetsResponse = {
  assets?: Asset[];
  data?: Asset[];
  items?: Asset[];
  pagination?: Pagination;
};

const getAuthHeaders = (): Record<string, string> => {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("authToken");

  return token
    ? { Authorization: `Bearer ${token}` }
    : {};
};

const employeeName = (employee?: Employee | null) => {
  if (!employee) return "Unknown employee";

  if (employee.name?.trim()) {
    return employee.name.trim();
  }

  return (
    [employee.firstName, employee.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() || "Unnamed employee"
  );
};

const employeeInitials = (employee?: Employee | null) => {
  const name = employeeName(employee);

  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
};

const assetIdentifier = (asset?: Asset | null) => {
  if (!asset) return "No identifier";

  if (asset.serialNumber) {
    return `Serial ${asset.serialNumber}`;
  }

  if (asset.serviceTag) {
    return `Service Tag ${asset.serviceTag}`;
  }

  if (asset.imei) {
    return `IMEI ${asset.imei}`;
  }

  if (asset.registrationNumber) {
    return `Reg. ${asset.registrationNumber}`;
  }

  return "No identifier";
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatCategory = (value?: string | null) => {
  if (!value) return "Uncategorized";

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
};

const normalizeEmployeesResponse = (
  data: EmployeesResponse | Employee[] | null
): Employee[] => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.employees)) {
    return data.employees;
  }
  if (Array.isArray(data?.data)) {
    return data.data;
  }
  if (Array.isArray(data?.items)) {
    return data.items;
  }

  return [];
};

const normalizeAssetsResponse = (
  data: AssetsResponse | Asset[] | null
): Asset[] => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.assets)) {
    return data.assets;
  }
  if (Array.isArray(data?.data)) {
    return data.data;
  }
  if (Array.isArray(data?.items)) {
    return data.items;
  }

  return [];
};

const normalizeRegisterResponse = (
  data: RegisterResponse | null
): Assignment[] => {
  if (Array.isArray(data?.assignments)) {
    return data.assignments;
  }

  return [];
};

export default function AssetAssignments() {
  const [assignments, setAssignments] =
    useState<Assignment[]>([]);

  const [employees, setEmployees] =
    useState<Employee[]>([]);

  const [assets, setAssets] =
    useState<Asset[]>([]);

  const [pagination, setPagination] =
    useState<Pagination>({
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 1,
    });

  const [summary, setSummary] =
    useState<RegisterSummary>({
      totalAssignments: 0,
      assignedCount: 0,
      returnedCount: 0,
    });

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState<"ALL" | "ASSIGNED" | "RETURNED">(
      "ASSIGNED"
    );

  const [departmentFilter, setDepartmentFilter] =
    useState("ALL");

  const [categoryFilter, setCategoryFilter] =
    useState("ALL");

  const [showFilters, setShowFilters] =
    useState(false);

  const [selectedAssignment, setSelectedAssignment] =
    useState<Assignment | null>(null);

  const [showDetailsModal, setShowDetailsModal] =
    useState(false);

  const [showAssignModal, setShowAssignModal] =
    useState(false);

  const [showReturnModal, setShowReturnModal] =
    useState(false);

  const [showReassignModal, setShowReassignModal] =
    useState(false);

  const [assignAssetId, setAssignAssetId] =
    useState("");

  const [assignEmployeeId, setAssignEmployeeId] =
    useState("");

  const [assignCondition, setAssignCondition] =
    useState("GOOD");

  const [assignNotes, setAssignNotes] =
    useState("");

  const [returnCondition, setReturnCondition] =
    useState("GOOD");

  const [returnNotes, setReturnNotes] =
    useState("");

  const [reassignEmployeeId, setReassignEmployeeId] =
    useState("");

  const [reassignCondition, setReassignCondition] =
    useState("GOOD");

  const [reassignNotes, setReassignNotes] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const departments = useMemo(() => {
    return Array.from(
      new Set(
        employees
          .map((employee) =>
            employee.department?.trim()
          )
          .filter(Boolean) as string[]
      )
    ).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [employees]);

  const categories = useMemo(() => {
    return Array.from(
      new Set(
        assets
          .map((asset) =>
            asset.category?.trim()
          )
          .filter(Boolean) as string[]
      )
    ).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [assets]);

  const availableAssets = useMemo(() => {
    return assets.filter((asset) => {
      const status = (asset.status || "ACTIVE").toUpperCase();
      return status !== "DISPOSED" && status !== "INACTIVE";
    });
  }, [assets]);

  const loadSupportingData = useCallback(
    async () => {
      const headers = getAuthHeaders();

      const [
        employeeResponse,
        assetResponse,
      ] = await Promise.all([
        fetch("/api/employees", {
          headers,
        }),
        fetch("/api/asset-assignments/available-assets", {
          headers,
        }),
      ]);

      if (employeeResponse.ok) {
        const data =
          (await employeeResponse.json()) as
            | EmployeesResponse
            | Employee[];

        setEmployees(
          normalizeEmployeesResponse(data)
        );
      }

      if (assetResponse.ok) {
        const data =
          (await assetResponse.json()) as
            | AssetsResponse
            | Asset[];

        setAssets(
          normalizeAssetsResponse(data)
        );
      }
    },
    []
  );

  const loadAssignments = useCallback(
    async (
      options?: {
        silent?: boolean;
        page?: number;
      }
    ) => {
      const targetPage =
        options?.page ?? pagination.page;

      try {
        if (options?.silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const params =
          new URLSearchParams();

        params.set(
          "page",
          String(targetPage)
        );

        params.set(
          "pageSize",
          String(pagination.pageSize)
        );

        if (search.trim()) {
          params.set(
            "search",
            search.trim()
          );
        }

        if (
          statusFilter !== "ALL"
        ) {
          params.set(
            "status",
            statusFilter
          );
        }

        if (
          departmentFilter !== "ALL"
        ) {
          params.set(
            "department",
            departmentFilter
          );
        }

        const response = await fetch(
          `/api/asset-assignments?${params.toString()}`,
          {
            headers: getAuthHeaders(),
          }
        );

        const data =
          (await response.json()) as RegisterResponse;

        if (!response.ok) {
          throw new Error(
            data?.message ||
              data?.error ||
              "Unable to load asset assignments."
          );
        }

        setAssignments(
          normalizeRegisterResponse(data)
        );

        if (data.pagination) {
          setPagination(
            data.pagination
          );
        } else {
          setPagination((current) => ({
            ...current,
            page: targetPage,
            total:
              normalizeRegisterResponse(
                data
              ).length,
            totalPages: 1,
          }));
        }

        if (data.summary) {
          setSummary(
            data.summary
          );
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Unable to load asset assignments.";

        setError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      departmentFilter,
      pagination.page,
      pagination.pageSize,
      search,
      statusFilter,
    ]
  );

  useEffect(() => {
    void loadSupportingData();
  }, [loadSupportingData]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAssignments({
        page: 1,
      });
    }, search.trim() ? 300 : 0);

    return () =>
      window.clearTimeout(timer);
  }, [
    search,
    statusFilter,
    departmentFilter,
    pagination.pageSize,
  ]);

  useEffect(() => {
    if (
      pagination.page > 1 &&
      pagination.page > pagination.totalPages
    ) {
      void loadAssignments({
        page: pagination.totalPages,
      });
    }
  }, [
    loadAssignments,
    pagination.page,
    pagination.totalPages,
  ]);

  const refreshAll = async () => {
    await Promise.all([
      loadSupportingData(),
      loadAssignments({
        silent: true,
        page: pagination.page,
      }),
    ]);
  };

  const resetAssignForm = () => {
    setAssignAssetId("");
    setAssignEmployeeId("");
    setAssignCondition("GOOD");
    setAssignNotes("");
  };

  const openReturn = (
    assignment: Assignment
  ) => {
    setSelectedAssignment(assignment);
    setReturnCondition("GOOD");
    setReturnNotes("");
    setShowReturnModal(true);
  };

  const openReassign = (
    assignment: Assignment
  ) => {
    setSelectedAssignment(assignment);
    setReassignEmployeeId("");
    setReassignCondition("GOOD");
    setReassignNotes("");
    setShowReassignModal(true);
  };

  const openDetails = (
    assignment: Assignment
  ) => {
    setSelectedAssignment(assignment);
    setShowDetailsModal(true);
  };

  const submitAssignment = async () => {
    if (
      !assignAssetId ||
      !assignEmployeeId
    ) {
      setError(
        "Select both an asset and an employee."
      );
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const response = await fetch(
        `/api/asset-assignments/assets/${assignAssetId}/assign`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            employeeId:
              assignEmployeeId,
            conditionAtAssignment:
              assignCondition,
            notes:
              assignNotes.trim() ||
              undefined,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            "Unable to assign asset."
        );
      }

      setShowAssignModal(false);
      resetAssignForm();

      await Promise.all([
        loadSupportingData(),
        loadAssignments({
          silent: true,
          page: 1,
        }),
      ]);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to assign asset."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submitReturn = async () => {
    if (!selectedAssignment) {
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const response = await fetch(
        `/api/asset-assignments/assets/${selectedAssignment.assetId}/return`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            conditionAtReturn:
              returnCondition,
            notes:
              returnNotes.trim() ||
              undefined,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            "Unable to return asset."
        );
      }

      setShowReturnModal(false);
      setSelectedAssignment(null);
      setReturnNotes("");

      await loadAssignments({
        silent: true,
        page: pagination.page,
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to return asset."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submitReassignment =
    async () => {
      if (
        !selectedAssignment ||
        !reassignEmployeeId
      ) {
        setError(
          "Select the new employee."
        );
        return;
      }

      try {
        setSubmitting(true);
        setError("");

        const response = await fetch(
          `/api/asset-assignments/assets/${selectedAssignment.assetId}/reassign`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              ...getAuthHeaders(),
            },
            body: JSON.stringify({
              employeeId:
                reassignEmployeeId,
              conditionAtAssignment:
                reassignCondition,
              notes:
                reassignNotes.trim() ||
                undefined,
            }),
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.message ||
              data?.error ||
              "Unable to reassign asset."
          );
        }

        setShowReassignModal(false);
        setSelectedAssignment(null);
        setReassignEmployeeId("");
        setReassignNotes("");

        await loadAssignments({
          silent: true,
          page: pagination.page,
        });
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to reassign asset."
        );
      } finally {
        setSubmitting(false);
      }
    };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("ASSIGNED");
    setDepartmentFilter("ALL");
    setCategoryFilter("ALL");
    setPagination((current) => ({
      ...current,
      page: 1,
    }));
  };

  const goToPage = (
    page: number
  ) => {
    const safePage = Math.max(
      1,
      Math.min(
        pagination.totalPages,
        page
      )
    );

    if (
      safePage === pagination.page
    ) {
      return;
    }

    setPagination((current) => ({
      ...current,
      page: safePage,
    }));

    void loadAssignments({
      page: safePage,
    });
  };

  const pageNumbers = useMemo(() => {
    const totalPages =
      pagination.totalPages;

    if (totalPages <= 7) {
      return Array.from(
        { length: totalPages },
        (_, index) => index + 1
      );
    }

    const current =
      pagination.page;

    const pages: Array<
      number | string
    > = [1];

    if (current > 4) {
      pages.push("...");
    }

    const start = Math.max(
      2,
      current - 1
    );

    const end = Math.min(
      totalPages - 1,
      current + 1
    );

    for (
      let page = start;
      page <= end;
      page += 1
    ) {
      pages.push(page);
    }

    if (
      current <
      totalPages - 3
    ) {
      pages.push("...");
    }

    pages.push(totalPages);

    return pages;
  }, [
    pagination.page,
    pagination.totalPages,
  ]);

  const showingFrom =
    pagination.total === 0
      ? 0
      : (pagination.page - 1) *
          pagination.pageSize +
        1;

  const showingTo =
    Math.min(
      pagination.page *
        pagination.pageSize,
      pagination.total
    );

  const hasActiveFilters =
    Boolean(search.trim()) ||
    statusFilter !== "ASSIGNED" ||
    departmentFilter !== "ALL" ||
    categoryFilter !== "ALL";

  const displayedAssignments =
    useMemo(() => {
      if (
        categoryFilter === "ALL"
      ) {
        return assignments;
      }

      return assignments.filter(
        (assignment) =>
          assignment.asset?.category ===
          categoryFilter
      );
    }, [
      assignments,
      categoryFilter,
    ]);

  return (
    <div className="min-h-full bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
                <ArrowRightLeft
                  size={21}
                />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                    Asset Assignments
                  </h1>

                  <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 sm:inline-flex">
                    Custody register
                  </span>
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  Manage company asset custody,
                  employee assignments and
                  return history.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                void refreshAll()
              }
              disabled={refreshing}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                className={
                  refreshing
                    ? "animate-spin"
                    : ""
                }
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => {
                resetAssignForm();
                setShowAssignModal(
                  true
                );
              }}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              <Package size={16} />
              Assign Asset
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              className="rounded p-1 text-red-500 transition hover:bg-red-100"
              aria-label="Dismiss error"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Total Assignments"
            value={
              summary.totalAssignments
            }
            description="All custody records"
            icon={
              <ClipboardList
                size={19}
              />
            }
          />

          <SummaryCard
            title="Currently Assigned"
            value={
              summary.assignedCount
            }
            description="Assets currently with employees"
            icon={
              <CheckCircle2
                size={19}
              />
            }
            emphasis="positive"
          />

          <SummaryCard
            title="Available Assets"
            value={
              availableAssets.length
            }
            description="Assets ready for assignment"
            icon={
              <Package size={19} />
            }
          />

          <SummaryCard
            title="Returned"
            value={
              summary.returnedCount
            }
            description="Completed custody records"
            icon={
              <RotateCcw
                size={19}
              />
            }
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative min-w-0 flex-1 xl:max-w-2xl">
                <Search
                  size={17}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search by employee, asset, serial number, IMEI, registration or asset code..."
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target
                        .value as
                        | "ALL"
                        | "ASSIGNED"
                        | "RETURNED"
                    )
                  }
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-400"
                >
                  <option value="ASSIGNED">
                    Assigned
                  </option>
                  <option value="RETURNED">
                    Returned
                  </option>
                  <option value="ALL">
                    All assignments
                  </option>
                </select>

                <button
                  type="button"
                  onClick={() =>
                    setShowFilters(
                      (current) =>
                        !current
                    )
                  }
                  className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition ${
                    showFilters ||
                    departmentFilter !==
                      "ALL" ||
                    categoryFilter !==
                      "ALL"
                      ? "border-slate-300 bg-slate-100 text-slate-800"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Filter size={16} />
                  Filters
                </button>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={
                      resetFilters
                    }
                    className="inline-flex h-10 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {showFilters && (
              <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
                <Field
                  label="Department"
                >
                  <select
                    value={
                      departmentFilter
                    }
                    onChange={(event) =>
                      setDepartmentFilter(
                        event.target
                          .value
                      )
                    }
                    className="input"
                  >
                    <option value="ALL">
                      All departments
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
                </Field>

                <Field
                  label="Asset Category"
                >
                  <select
                    value={
                      categoryFilter
                    }
                    onChange={(event) =>
                      setCategoryFilter(
                        event.target
                          .value
                      )
                    }
                    className="input"
                  >
                    <option value="ALL">
                      All categories
                    </option>

                    {categories.map(
                      (category) => (
                        <option
                          key={category}
                          value={category}
                        >
                          {formatCategory(
                            category
                          )}
                        </option>
                      )
                    )}
                  </select>
                </Field>
              </div>
            )}
          </div>

          {loading ? (
            <LoadingState />
          ) : displayedAssignments.length ===
            0 ? (
            <EmptyState
              hasFilters={
                hasActiveFilters
              }
              onAssign={() => {
                resetAssignForm();
                setShowAssignModal(
                  true
                );
              }}
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1180px] text-left">
                  <thead className="border-b border-slate-200 bg-slate-50/80">
                    <tr>
                      <TableHeader>
                        Asset
                      </TableHeader>

                      <TableHeader>
                        Identifier
                      </TableHeader>

                      <TableHeader>
                        Category
                      </TableHeader>

                      <TableHeader>
                        Assigned To
                      </TableHeader>

                      <TableHeader>
                        Department
                      </TableHeader>

                      <TableHeader>
                        Assigned
                      </TableHeader>

                      <TableHeader>
                        Condition
                      </TableHeader>

                      <TableHeader>
                        Status
                      </TableHeader>

                      <TableHeader align="right">
                        Actions
                      </TableHeader>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {displayedAssignments.map(
                      (assignment) => {
                        const current =
                          !assignment.returnedAt;

                        return (
                          <tr
                            key={
                              assignment.id
                            }
                            className="group transition hover:bg-slate-50/70"
                          >
                            <td className="px-5 py-4">
                              <button
                                type="button"
                                onClick={() =>
                                  openDetails(
                                    assignment
                                  )
                                }
                                className="flex items-center gap-3 text-left"
                              >
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition group-hover:bg-white group-hover:shadow-sm">
                                  <Package
                                    size={17}
                                  />
                                </div>

                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-900">
                                    {assignment
                                      .asset
                                      ?.assetCode ||
                                      "-"}
                                  </div>

                                  <div className="mt-0.5 max-w-[220px] truncate text-xs text-slate-500">
                                    {assignment
                                      .asset
                                      ?.name ||
                                      "Unnamed asset"}
                                  </div>
                                </div>
                              </button>
                            </td>

                            <td className="px-5 py-4">
                              <div className="font-mono text-xs font-medium text-slate-700">
                                {assetIdentifier(
                                  assignment.asset
                                )}
                              </div>

                              {assignment
                                .asset
                                ?.model && (
                                <div className="mt-1 text-xs text-slate-400">
                                  {
                                    assignment
                                      .asset
                                      .manufacturer
                                  }{" "}
                                  {
                                    assignment
                                      .asset
                                      .model
                                  }
                                </div>
                              )}
                            </td>

                            <td className="px-5 py-4">
                              <span className="inline-flex rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                                {formatCategory(
                                  assignment
                                    .asset
                                    ?.category
                                )}
                              </span>
                            </td>

                            <td className="px-5 py-4">
                              <button
                                type="button"
                                onClick={() =>
                                  openDetails(
                                    assignment
                                  )
                                }
                                className="flex items-center gap-2.5 text-left"
                              >
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                                  {employeeInitials(
                                    assignment.employee
                                  )}
                                </div>

                                <div>
                                  <div className="text-sm font-medium text-slate-800 transition group-hover:text-slate-950">
                                    {employeeName(
                                      assignment.employee
                                    )}
                                  </div>

                                  <div className="mt-0.5 text-xs text-slate-400">
                                    {assignment
                                      .employee
                                      ?.employeeNumber ||
                                      assignment
                                        .employee
                                        ?.email ||
                                      "Employee"}
                                  </div>
                                </div>
                              </button>
                            </td>

                            <td className="px-5 py-4">
                              <div className="text-sm text-slate-700">
                                {assignment
                                  .employee
                                  ?.department ||
                                  "-"}
                              </div>

                              {assignment
                                .employee
                                ?.jobTitle && (
                                <div className="mt-0.5 text-xs text-slate-400">
                                  {
                                    assignment
                                      .employee
                                      .jobTitle
                                  }
                                </div>
                              )}
                            </td>

                            <td className="px-5 py-4">
                              <div className="text-sm text-slate-700">
                                {formatDate(
                                  assignment.assignedAt
                                )}
                              </div>

                              {assignment.returnedAt && (
                                <div className="mt-1 text-xs text-slate-400">
                                  Returned{" "}
                                  {formatDate(
                                    assignment.returnedAt
                                  )}
                                </div>
                              )}
                            </td>

                            <td className="px-5 py-4">
                              <ConditionBadge
                                value={
                                  current
                                    ? assignment.conditionAtAssignment
                                    : assignment.conditionAtReturn ||
                                      assignment.conditionAtAssignment
                                }
                              />
                            </td>

                            <td className="px-5 py-4">
                              <StatusBadge
                                current={
                                  current
                                }
                              />
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex justify-end gap-1.5">
                                <ActionButton
                                  label="View"
                                  icon={
                                    <Eye
                                      size={
                                        14
                                      }
                                    />
                                  }
                                  onClick={() =>
                                    openDetails(
                                      assignment
                                    )
                                  }
                                />

                                {current && (
                                  <>
                                    <ActionButton
                                      label="Reassign"
                                      icon={
                                        <ArrowRightLeft
                                          size={
                                            14
                                          }
                                        />
                                      }
                                      onClick={() =>
                                        openReassign(
                                          assignment
                                        )
                                      }
                                    />

                                    <ActionButton
                                      label="Return"
                                      icon={
                                        <RotateCcw
                                          size={
                                            14
                                          }
                                        />
                                      }
                                      onClick={() =>
                                        openReturn(
                                          assignment
                                        )
                                      }
                                    />
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-slate-500">
                  Showing{" "}
                  <span className="font-medium text-slate-700">
                    {showingFrom}
                  </span>{" "}
                  to{" "}
                  <span className="font-medium text-slate-700">
                    {showingTo}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium text-slate-700">
                    {pagination.total}
                  </span>{" "}
                  assignments
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={
                      pagination.pageSize
                    }
                    onChange={(event) => {
                      const pageSize =
                        Number(
                          event.target
                            .value
                        );

                      setPagination(
                        (current) => ({
                          ...current,
                          page: 1,
                          pageSize,
                        })
                      );
                    }}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 outline-none"
                    aria-label="Rows per page"
                  >
                    <option value={20}>
                      20 / page
                    </option>
                    <option value={50}>
                      50 / page
                    </option>
                    <option value={100}>
                      100 / page
                    </option>
                  </select>

                  <button
                    type="button"
                    onClick={() =>
                      goToPage(
                        pagination.page -
                          1
                      )
                    }
                    disabled={
                      pagination.page <=
                        1 ||
                      loading
                    }
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Previous page"
                  >
                    <ChevronLeft
                      size={16}
                    />
                  </button>

                  <div className="hidden items-center gap-1 sm:flex">
                    {pageNumbers.map(
                      (page, index) =>
                        page ===
                        "..." ? (
                          <span
                            key={`ellipsis-${index}`}
                            className="px-1 text-xs text-slate-400"
                          >
                            ...
                          </span>
                        ) : (
                          <button
                            key={page}
                            type="button"
                            onClick={() =>
                              goToPage(Number(page))
                            }
                            className={`h-9 min-w-9 rounded-lg px-2 text-xs font-semibold transition ${
                              page ===
                              pagination.page
                                ? "bg-slate-900 text-white"
                                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            {page}
                          </button>
                        )
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      goToPage(
                        pagination.page +
                          1
                      )
                    }
                    disabled={
                      pagination.page >=
                        pagination.totalPages ||
                      loading
                    }
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Next page"
                  >
                    <ChevronRight
                      size={16}
                    />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showDetailsModal &&
        selectedAssignment && (
          <AssignmentDetailsModal
            assignment={
              selectedAssignment
            }
            onClose={() =>
              setShowDetailsModal(
                false
              )
            }
            onReturn={() => {
              setShowDetailsModal(
                false
              );
              openReturn(
                selectedAssignment
              );
            }}
            onReassign={() => {
              setShowDetailsModal(
                false
              );
              openReassign(
                selectedAssignment
              );
            }}
          />
        )}

      {showAssignModal && (
        <Modal
          title="Assign Asset"
          description="Place a company asset in the custody of an active employee."
          onClose={() =>
            !submitting &&
            setShowAssignModal(false)
          }
          maxWidth="max-w-2xl"
        >
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm ring-1 ring-slate-200">
                  <Package size={17} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Custody assignment</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">Select an unassigned asset and the employee responsible for it. The assignment is recorded in the tenant asset history.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field label="Asset">
                <SearchablePicker
                  placeholder="Search and select an asset"
                  searchPlaceholder="Search by asset code, name, serial..."
                  emptyMessage={
                    availableAssets.length
                      ? "No assets match your search."
                      : "No unassigned active assets are available."
                  }
                  value={assignAssetId}
                  onChange={setAssignAssetId}
                  options={availableAssets
                    .slice()
                    .sort((a, b) =>
                      a.assetCode.localeCompare(b.assetCode)
                    )
                    .map((asset) => ({
                      id: asset.id,
                      label: `${asset.assetCode} � ${asset.name}`,
                      meta: `${formatCategory(asset.category)}${assetIdentifier(asset) !== "No identifier" ? ` � ${assetIdentifier(asset)}` : ""}`,
                      icon: <Package size={16} />,
                    }))}
                />
                {availableAssets.length === 0 && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                    Create or activate an asset in Fixed Assets before assigning it.
                  </div>
                )}
              </Field>

              <Field label="Employee">
                <SearchablePicker
                  placeholder="Search and select employee"
                  searchPlaceholder="Search by name, employee no..."
                  emptyMessage="No active employees match your search."
                  value={assignEmployeeId}
                  onChange={setAssignEmployeeId}
                  options={employees
                    .filter(
                      (employee) =>
                        (employee.status || "ACTIVE").toUpperCase() === "ACTIVE"
                    )
                    .slice()
                    .sort((a, b) =>
                      employeeName(a).localeCompare(employeeName(b))
                    )
                    .map((employee) => ({
                      id: employee.id,
                      label: employeeName(employee),
                      meta: [
                        employee.employeeNumber,
                        employee.department,
                      ]
                        .filter(Boolean)
                        .join(" � ") || "Active employee",
                      icon: <UserRound size={16} />,
                    }))}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field label="Condition at Assignment">
                <select
                  value={assignCondition}
                  onChange={(event) =>
                    setAssignCondition(event.target.value)
                  }
                  className="input h-11 rounded-xl bg-white"
                >
                  <option value="NEW">New</option>
                  <option value="EXCELLENT">Excellent</option>
                  <option value="GOOD">Good</option>
                  <option value="FAIR">Fair</option>
                  <option value="POOR">Poor</option>
                </select>
              </Field>

              <div>
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Assignment date</span>
                <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-600">
                  {formatDate(new Date().toISOString())}
                  <span className="ml-auto text-xs text-slate-400">Today</span>
                </div>
              </div>
            </div>

            <Field label="Assignment Notes">
              <textarea
                value={assignNotes}
                onChange={(event) =>
                  setAssignNotes(event.target.value)
                }
                placeholder="Add handover notes, accessories, or other custody details..."
                rows={4}
                className="input min-h-[104px] resize-none rounded-xl bg-white"
              />
            </Field>

            <div className="flex items-center justify-between border-t border-slate-200 pt-5">
              <p className="text-xs text-slate-400">Assignment history is retained for audit and custody tracking.</p>
              <ModalActions
                onCancel={() => setShowAssignModal(false)}
                onSubmit={submitAssignment}
                submitting={submitting}
                submitLabel="Assign Asset"
              />
            </div>
          </div>
        </Modal>
      )}

      {showReturnModal &&
        selectedAssignment && (
          <Modal
            title="Return Asset"
            description={`Record the return of ${selectedAssignment.asset?.assetCode || "this asset"} from ${employeeName(selectedAssignment.employee)}.`}
            onClose={() =>
              !submitting &&
              setShowReturnModal(
                false
              )
            }
          >
            <div className="space-y-5">
              <AssignmentContext
                assignment={
                  selectedAssignment
                }
              />

              <Field label="Condition at Return">
                <select
                  value={
                    returnCondition
                  }
                  onChange={(event) =>
                    setReturnCondition(
                      event.target.value
                    )
                  }
                  className="input"
                >
                  <option value="EXCELLENT">
                    Excellent
                  </option>
                  <option value="GOOD">
                    Good
                  </option>
                  <option value="FAIR">
                    Fair
                  </option>
                  <option value="POOR">
                    Poor
                  </option>
                  <option value="DAMAGED">
                    Damaged
                  </option>
                </select>
              </Field>

              <Field label="Notes">
                <textarea
                  value={returnNotes}
                  onChange={(event) =>
                    setReturnNotes(
                      event.target.value
                    )
                  }
                  placeholder="Describe the returned asset condition or any issues..."
                  rows={4}
                  className="input resize-none"
                />
              </Field>

              <ModalActions
                onCancel={() =>
                  setShowReturnModal(
                    false
                  )
                }
                onSubmit={
                  submitReturn
                }
                submitting={submitting}
                submitLabel="Confirm Return"
              />
            </div>
          </Modal>
        )}

      {showReassignModal &&
        selectedAssignment && (
          <Modal
            title="Reassign Asset"
            description={`Move ${selectedAssignment.asset?.assetCode || "this asset"} from ${employeeName(selectedAssignment.employee)} to another employee.`}
            onClose={() =>
              !submitting &&
              setShowReassignModal(
                false
              )
            }
          >
            <div className="space-y-5">
              <AssignmentContext
                assignment={
                  selectedAssignment
                }
              />

              <Field label="New Employee">
                <select
                  value={
                    reassignEmployeeId
                  }
                  onChange={(event) =>
                    setReassignEmployeeId(
                      event.target.value
                    )
                  }
                  className="input"
                >
                  <option value="">
                    Select an active employee
                  </option>

                  {employees
                    .filter(
                      (employee) =>
                        employee.id !==
                          selectedAssignment.employeeId &&
                        (
                          employee.status ||
                          "ACTIVE"
                        ).toUpperCase() ===
                          "ACTIVE"
                    )
                    .sort((a, b) =>
                      employeeName(
                        a
                      ).localeCompare(
                        employeeName(b)
                      )
                    )
                    .map(
                      (employee) => (
                        <option
                          key={
                            employee.id
                          }
                          value={
                            employee.id
                          }
                        >
                          {employeeName(
                            employee
                          )}
                          {employee
                            .employeeNumber
                            ? ` - ${employee.employeeNumber}`
                            : ""}
                        </option>
                      )
                    )}
                </select>
              </Field>

              <Field label="Condition at Reassignment">
                <select
                  value={
                    reassignCondition
                  }
                  onChange={(event) =>
                    setReassignCondition(
                      event.target.value
                    )
                  }
                  className="input"
                >
                  <option value="EXCELLENT">
                    Excellent
                  </option>
                  <option value="GOOD">
                    Good
                  </option>
                  <option value="FAIR">
                    Fair
                  </option>
                  <option value="POOR">
                    Poor
                  </option>
                </select>
              </Field>

              <Field label="Notes">
                <textarea
                  value={
                    reassignNotes
                  }
                  onChange={(event) =>
                    setReassignNotes(
                      event.target.value
                    )
                  }
                  placeholder="Optional reassignment notes..."
                  rows={4}
                  className="input resize-none"
                />
              </Field>

              <ModalActions
                onCancel={() =>
                  setShowReassignModal(
                    false
                  )
                }
                onSubmit={
                  submitReassignment
                }
                submitting={submitting}
                submitLabel="Reassign Asset"
              />
            </div>
          </Modal>
        )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon,
  emphasis,
}: {
  title: string;
  value: number;
  description: string;
  icon: React.ReactNode;
  emphasis?: "positive";
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p
            className={`mt-2 text-2xl font-semibold tracking-tight ${
              emphasis === "positive"
                ? "text-emerald-700"
                : "text-slate-900"
            }`}
          >
            {value.toLocaleString()}
          </p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          {icon}
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        {description}
      </p>
    </div>
  );
}

function TableHeader({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
        align === "right"
          ? "text-right"
          : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function StatusBadge({
  current,
}: {
  current: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        current
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          current
            ? "bg-emerald-500"
            : "bg-slate-400"
        }`}
      />

      {current
        ? "Assigned"
        : "Returned"}
    </span>
  );
}

function ConditionBadge({
  value,
}: {
  value?: string | null;
}) {
  const label = value
    ? formatCategory(value)
    : "Not recorded";

  return (
    <span className="inline-flex rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
      {label}
    </span>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
    >
      {icon}
      <span className="hidden xl:inline">
        {label}
      </span>
    </button>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[420px] items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <RefreshCw
          size={17}
          className="animate-spin"
        />
        Loading assignments...
      </div>
    </div>
  );
}

function EmptyState({
  hasFilters,
  onAssign,
}: {
  hasFilters: boolean;
  onAssign: () => void;
}) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <ClipboardList
          size={25}
        />
      </div>

      <h3 className="text-base font-semibold text-slate-900">
        No assignments found
      </h3>

      <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
        {hasFilters
          ? "Try a different search term or adjust your filters."
          : "Assign an asset to an employee to start tracking company asset custody."}
      </p>

      {!hasFilters && (
        <button
          type="button"
          onClick={onAssign}
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          <Package size={16} />
          Assign Asset
        </button>
      )}
    </div>
  );
}

function AssignmentContext({
  assignment,
}: {
  assignment: Assignment;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm">
          <Package size={17} />
        </div>

        <div className="min-w-0">
          <div className="font-semibold text-slate-900">
            {assignment.asset?.assetCode ||
              "Unknown asset"}
          </div>

          <div className="mt-0.5 text-xs text-slate-500">
            {assignment.asset?.name ||
              "Unnamed asset"}{" "}
            -{" "}
            {employeeName(
              assignment.employee
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AssignmentDetailsModal({
  assignment,
  onClose,
  onReturn,
  onReassign,
}: {
  assignment: Assignment;
  onClose: () => void;
  onReturn: () => void;
  onReassign: () => void;
}) {
  const current =
    !assignment.returnedAt;

  return (
    <Modal
      title="Assignment Details"
      description="Review the asset, custodian and assignment record."
      onClose={onClose}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm">
              <Package size={20} />
            </div>

            <div>
              <div className="text-lg font-semibold text-slate-900">
                {assignment.asset
                  ?.assetCode ||
                  "Unknown asset"}
              </div>

              <div className="text-sm text-slate-500">
                {assignment.asset
                  ?.name ||
                  "Unnamed asset"}
              </div>
            </div>
          </div>

          <StatusBadge
            current={current}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <DetailGroup title="Asset Information">
            <DetailRow
              label="Category"
              value={formatCategory(
                assignment.asset
                  ?.category
              )}
            />

            <DetailRow
              label="Manufacturer"
              value={
                assignment.asset
                  ?.manufacturer
              }

            />

            <DetailRow
              label="Model"
              value={
                assignment.asset
                  ?.model
              }
            />

            <DetailRow
              label="Identifier"
              value={assetIdentifier(
                assignment.asset
              )}
              mono
            />

            <DetailRow
              label="Location"
              value={
                assignment.asset
                  ?.location
              }
            />
          </DetailGroup>

          <DetailGroup title="Custodian">
            <DetailRow
              label="Employee"
              value={employeeName(
                assignment.employee
              )}
            />

            <DetailRow
              label="Employee Number"
              value={
                assignment.employee
                  ?.employeeNumber
              }
            />

            <DetailRow
              label="Department"
              value={
                assignment.employee
                  ?.department
              }
            />

            <DetailRow
              label="Job Title"
              value={
                assignment.employee
                  ?.jobTitle
              }
            />

            <DetailRow
              label="Email"
              value={
                assignment.employee
                  ?.email
              }
          />
          </DetailGroup>

          <DetailGroup title="Assignment">
            <DetailRow
              label="Assigned Date"
              value={formatDate(
                assignment.assignedAt
              )}
            />

            <DetailRow
              label="Assignment Condition"
              value={
                assignment.conditionAtAssignment
              }
            />

            <DetailRow
              label="Return Date"
              value={
                assignment.returnedAt
                  ? formatDate(
                      assignment.returnedAt
                    )
                  : "Currently assigned"
              }
            />

            <DetailRow
              label="Return Condition"
              value={
                assignment.conditionAtReturn
              }
            />
          </DetailGroup>

          <DetailGroup title="Record">
            <DetailRow
              label="Assignment ID"
              value={assignment.id}
              mono
            />

            <DetailRow
              label="Created"
              value={formatDate(
                assignment.createdAt
              )}
            />

            <DetailRow
              label="Updated"
              value={formatDate(
                assignment.updatedAt
              )}
            />
          </DetailGroup>
        </div>

        {assignment.notes && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Notes
            </p>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {assignment.notes}
            </p>
          </div>
        )}

        {current && (
          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Close
            </button>

            <button
              type="button"
              onClick={onReassign}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <ArrowRightLeft
                size={15}
              />
              Reassign
            </button>

            <button
              type="button"
              onClick={onReturn}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <RotateCcw
                size={15}
              />
              Return Asset
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function DetailGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h3>

      <div className="space-y-2.5">
        {children}
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | number | null;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-slate-400">
        {label}
      </span>

      <span
        className={`max-w-[65%] text-right text-sm font-medium text-slate-700 ${
          mono
            ? "font-mono text-xs"
            : ""
        }`}
      >
        {value ||
          "Not recorded"}
      </span>
    </div>
  );
}

function SearchablePicker({
  placeholder,
  searchPlaceholder,
  emptyMessage,
  value,
  onChange,
  options,
}: {
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{
    id: string;
    label: string;
    meta?: string;
    icon?: React.ReactNode;
  }>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((option) => option.id === value);
  const filtered = options.filter((option) => {
    const haystack = `${option.label} ${option.meta || ""}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          setQuery("");
        }}
        className={`flex min-h-11 w-full items-center gap-3 rounded-xl border bg-white px-3.5 text-left transition ${
          open
            ? "border-slate-400 ring-4 ring-slate-100"
            : "border-slate-200 hover:border-slate-300"
        }`}
      >
        <span className={`min-w-0 flex-1 ${selected ? "text-slate-800" : "text-slate-400"}`}>
          {selected ? (
            <>
              <span className="block truncate text-sm font-medium">{selected.label}</span>
              {selected.meta && (
                <span className="mt-0.5 block truncate text-xs text-slate-400">{selected.meta}</span>
              )}
            </>
          ) : (
            <span className="text-sm">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          size={17}
          className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 p-2.5">
            <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3">
              <Search size={15} className="shrink-0 text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
                  <Search size={16} />
                </div>
                <p className="mt-2 text-sm font-medium text-slate-600">{emptyMessage}</p>
              </div>
            ) : (
              filtered.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                    option.id === value
                      ? "bg-slate-50"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    {option.icon || <Package size={15} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-700">{option.label}</span>
                    {option.meta && (
                      <span className="mt-0.5 block truncate text-xs text-slate-400">{option.meta}</span>
                    )}
                  </span>
                  {option.id === value && (
                    <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}

function Modal({
  title,
  description,
  children,
  onClose,
  maxWidth = "max-w-lg",
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onClose: () => void;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div
        className={`max-h-[calc(100vh-2rem)] w-full ${maxWidth} overflow-y-auto rounded-2xl bg-white shadow-2xl`}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {title}
            </h2>

            <p className="mt-1 text-sm leading-5 text-slate-500">
              {description}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

function ModalActions({
  onCancel,
  onSubmit,
  submitting,
  submitLabel,
}: {
  onCancel: () => void;
  onSubmit: () => void;
  submitting: boolean;
  submitLabel: string;
}) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onCancel}
        disabled={submitting}
        className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
      >
        Cancel
      </button>

      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting && (
          <RefreshCw
            size={15}
            className="animate-spin"
          />
        )}

        {submitting
          ? "Processing..."
          : submitLabel}
      </button>
    </div>
  );
}

