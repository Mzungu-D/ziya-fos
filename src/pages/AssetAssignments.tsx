import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  ClipboardList,
  RefreshCw,
  Search,
  UserRound,
  Package,
  CheckCircle2,
  RotateCcw,
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
};

type Employee = {
  id: string;
  employeeNumber?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  department?: string | null;
  status?: string | null;
};

type Assignment = {
  id: string;
  assetId: string;
  employeeId: string;
  assignedAt: string;
  returnedAt?: string | null;
  conditionAtAssignment?: string | null;
  conditionAtReturn?: string | null;
  notes?: string | null;
  asset: Asset;
  employee: Employee;
};

const getAuthHeaders = (): Record<string, string> => {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("authToken");

  return token ? { Authorization: `Bearer ${token}` } : {};
};

const employeeName = (employee?: Employee | null) => {
  if (!employee) return "Unknown employee";

  if (employee.name?.trim()) return employee.name.trim();

  return [employee.firstName, employee.lastName]
    .filter(Boolean)
    .join(" ")
    .trim() || "Unnamed employee";
};

const assetIdentifier = (asset?: Asset | null) => {
  if (!asset) return "—";

  if (asset.serialNumber) return `Serial ${asset.serialNumber}`;
  if (asset.imei) return `IMEI ${asset.imei}`;
  if (asset.registrationNumber)
    return `Reg. ${asset.registrationNumber}`;

  return "No identifier";
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

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
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const normalizeAssignmentResponse = (data: any): Assignment[] => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.assignments)) return data.assignments;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
};

const normalizeEmployeesResponse = (data: any): Employee[] => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.employees)) return data.employees;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
};

export default function AssetAssignments() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "CURRENT" | "RETURNED">(
    "CURRENT"
  );
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] =
    useState<Assignment | null>(null);

  const [assignAssetId, setAssignAssetId] = useState("");
  const [assignEmployeeId, setAssignEmployeeId] = useState("");
  const [assignCondition, setAssignCondition] = useState("GOOD");
  const [assignNotes, setAssignNotes] = useState("");

  const [returnCondition, setReturnCondition] = useState("GOOD");
  const [returnNotes, setReturnNotes] = useState("");

  const [reassignEmployeeId, setReassignEmployeeId] = useState("");
  const [reassignCondition, setReassignCondition] = useState("GOOD");
  const [reassignNotes, setReassignNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const headers = getAuthHeaders();

      const [assignmentResponse, employeeResponse, assetResponse] =
        await Promise.all([
          fetch("/api/asset-assignments/assets", { headers }),
          fetch("/api/employees", { headers }),
          fetch("/api/assets", { headers }),
        ]);

      if (!assignmentResponse.ok) {
        throw new Error("Unable to load asset assignments.");
      }

      const assignmentData = await assignmentResponse.json();
      setAssignments(normalizeAssignmentResponse(assignmentData));

      if (employeeResponse.ok) {
        setEmployees(
          normalizeEmployeesResponse(await employeeResponse.json())
        );
      }

      if (assetResponse.ok) {
        const assetData = await assetResponse.json();

        const loadedAssets = Array.isArray(assetData)
          ? assetData
          : Array.isArray(assetData?.assets)
            ? assetData.assets
            : Array.isArray(assetData?.data)
              ? assetData.data
              : [];

        setAssets(loadedAssets);
      }
    } catch (err: any) {
      setError(err?.message || "Unable to load asset assignments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const categories = useMemo(() => {
    return Array.from(
      new Set(assignments.map((item) => item.asset?.category).filter(Boolean))
    ).sort();
  }, [assignments]);

  const currentAssignments = useMemo(
    () => assignments.filter((item) => !item.returnedAt),
    [assignments]
  );

  const returnedAssignments = useMemo(
    () => assignments.filter((item) => Boolean(item.returnedAt)),
    [assignments]
  );

  const assignedAssetIds = useMemo(
    () => new Set(currentAssignments.map((item) => item.assetId)),
    [currentAssignments]
  );

  const filteredAssignments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return assignments.filter((item) => {
      const isCurrent = !item.returnedAt;

      if (statusFilter === "CURRENT" && !isCurrent) return false;
      if (statusFilter === "RETURNED" && isCurrent) return false;

      if (
        categoryFilter !== "ALL" &&
        item.asset?.category !== categoryFilter
      ) {
        return false;
      }

      if (!query) return true;

      const employee = employeeName(item.employee).toLowerCase();
      const asset = item.asset;

      const haystack = [
        asset?.assetCode,
        asset?.name,
        asset?.category,
        asset?.serialNumber,
        asset?.serviceTag,
        asset?.imei,
        asset?.imei2,
        asset?.registrationNumber,
        asset?.phoneNumber,
        employee,
        item.employee?.employeeNumber,
        item.employee?.department,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [assignments, search, statusFilter, categoryFilter]);

  const availableAssets = useMemo(
    () => assets.filter((asset) => !assignedAssetIds.has(asset.id)),
    [assets, assignedAssetIds]
  );

  const submitAssignment = async () => {
    if (!assignAssetId || !assignEmployeeId) {
      setError("Select both an asset and an employee.");
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
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            employeeId: assignEmployeeId,
            conditionAtAssignment: assignCondition,
            notes: assignNotes.trim() || undefined,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message || data?.error || "Unable to assign asset."
        );
      }

      setShowAssignModal(false);
      resetAssignForm();
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Unable to assign asset.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitReturn = async () => {
    if (!selectedAssignment) return;

    try {
      setSubmitting(true);
      setError("");

      const response = await fetch(
        `/api/asset-assignments/assets/${selectedAssignment.assetId}/return`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            conditionAtReturn: returnCondition,
            notes: returnNotes.trim() || undefined,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message || data?.error || "Unable to return asset."
        );
      }

      setShowReturnModal(false);
      setSelectedAssignment(null);
      setReturnNotes("");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Unable to return asset.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitReassignment = async () => {
    if (!selectedAssignment || !reassignEmployeeId) {
      setError("Select the new employee.");
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
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            employeeId: reassignEmployeeId,
            conditionAtAssignment: reassignCondition,
            notes: reassignNotes.trim() || undefined,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message || data?.error || "Unable to reassign asset."
        );
      }

      setShowReassignModal(false);
      setSelectedAssignment(null);
      setReassignEmployeeId("");
      setReassignNotes("");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Unable to reassign asset.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetAssignForm = () => {
    setAssignAssetId("");
    setAssignEmployeeId("");
    setAssignCondition("GOOD");
    setAssignNotes("");
  };

  const openReturn = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setReturnCondition("GOOD");
    setReturnNotes("");
    setShowReturnModal(true);
  };

  const openReassign = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setReassignEmployeeId("");
    setReassignCondition("GOOD");
    setReassignNotes("");
    setShowReassignModal(true);
  };

  return (
    <div className="min-h-full bg-slate-50 p-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
                <ArrowRightLeft size={21} />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                  Asset Assignments
                </h1>
                <p className="mt-0.5 text-sm text-slate-500">
                  Track company assets, custodians and assignment history.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadData()}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <RefreshCw size={16} />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => {
                resetAssignForm();
                setShowAssignModal(true);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              <Package size={16} />
              Assign Asset
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              className="rounded p-1 hover:bg-red-100"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Total Assignments"
            value={assignments.length}
            icon={<ClipboardList size={19} />}
            description="All assignment records"
          />

          <SummaryCard
            title="Currently Assigned"
            value={currentAssignments.length}
            icon={<CheckCircle2 size={19} />}
            description="Assets currently with employees"
          />

          <SummaryCard
            title="Available Assets"
            value={availableAssets.length}
            icon={<Package size={19} />}
            description="Assets ready for assignment"
          />

          <SummaryCard
            title="Returned"
            value={returnedAssignments.length}
            icon={<RotateCcw size={19} />}
            description="Completed assignment records"
          />
        </div>

        {/* Workspace */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative min-w-0 flex-1 xl:max-w-xl">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search asset code, serial, IMEI, employee..."
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value as "ALL" | "CURRENT" | "RETURNED"
                    )
                  }
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400"
                >
                  <option value="CURRENT">Current</option>
                  <option value="RETURNED">Returned</option>
                  <option value="ALL">All assignments</option>
                </select>

                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400"
                >
                  <option value="ALL">All categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {formatCategory(category)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[360px] items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <RefreshCw size={17} className="animate-spin" />
                Loading assignments...
              </div>
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <ClipboardList size={25} />
              </div>
              <h3 className="text-base font-semibold text-slate-900">
                No assignments found
              </h3>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                {search
                  ? "Try a different search term or adjust your filters."
                  : "Assign an asset to an employee to start tracking custodianship."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left">
                <thead className="border-b border-slate-200 bg-slate-50/80">
                  <tr>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Asset
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Identifier
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Category
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Assigned To
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Assigned
                    </th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredAssignments.map((assignment) => {
                    const current = !assignment.returnedAt;

                    return (
                      <tr
                        key={assignment.id}
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                              <Package size={17} />
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900">
                                {assignment.asset?.assetCode || "—"}
                              </div>
                              <div className="max-w-[220px] truncate text-xs text-slate-500">
                                {assignment.asset?.name || "Unnamed asset"}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="font-mono text-xs font-medium text-slate-700">
                            {assetIdentifier(assignment.asset)}
                          </div>
                          {assignment.asset?.serviceTag && (
                            <div className="mt-1 text-xs text-slate-400">
                              Service Tag: {assignment.asset.serviceTag}
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <span className="inline-flex rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                            {formatCategory(assignment.asset?.category)}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                              <UserRound size={15} />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-slate-800">
                                {employeeName(assignment.employee)}
                              </div>
                              <div className="text-xs text-slate-400">
                                {assignment.employee?.employeeNumber ||
                                  assignment.employee?.department ||
                                  "Employee"}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          <div>{formatDate(assignment.assignedAt)}</div>
                          {assignment.returnedAt && (
                            <div className="mt-1 text-xs text-slate-400">
                              Returned {formatDate(assignment.returnedAt)}
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                              current
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                current ? "bg-emerald-500" : "bg-slate-400"
                              }`}
                            />
                            {current ? "Assigned" : "Returned"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          {current && (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openReassign(assignment)}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                <ArrowRightLeft size={14} />
                                Reassign
                              </button>

                              <button
                                type="button"
                                onClick={() => openReturn(assignment)}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                <RotateCcw size={14} />
                                Return
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filteredAssignments.length > 0 && (
            <div className="border-t border-slate-200 bg-slate-50/50 px-5 py-3 text-xs text-slate-500">
              Showing {filteredAssignments.length} of {assignments.length}{" "}
              assignment records
            </div>
          )}
        </div>
      </div>

      {/* Assign Modal */}
      {showAssignModal && (
        <Modal
          title="Assign Asset"
          description="Assign an available company asset to an active employee."
          onClose={() => !submitting && setShowAssignModal(false)}
        >
          <div className="space-y-4">
            <Field label="Asset">
              <select
                value={assignAssetId}
                onChange={(event) => setAssignAssetId(event.target.value)}
                className="input"
              >
                <option value="">Select an asset</option>
                {availableAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.assetCode} · {asset.name} · {assetIdentifier(asset)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Employee">
              <select
                value={assignEmployeeId}
                onChange={(event) => setAssignEmployeeId(event.target.value)}
                className="input"
              >
                <option value="">Select an employee</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employeeName(employee)}
                    {employee.employeeNumber
                      ? ` · ${employee.employeeNumber}`
                      : ""}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Condition at Assignment">
              <select
                value={assignCondition}
                onChange={(event) => setAssignCondition(event.target.value)}
                className="input"
              >
                <option value="NEW">New</option>
                <option value="EXCELLENT">Excellent</option>
                <option value="GOOD">Good</option>
                <option value="FAIR">Fair</option>
                <option value="POOR">Poor</option>
              </select>
            </Field>

            <Field label="Notes">
              <textarea
                value={assignNotes}
                onChange={(event) => setAssignNotes(event.target.value)}
                placeholder="Optional assignment notes..."
                rows={3}
                className="input resize-none"
              />
            </Field>

            <ModalActions
              onCancel={() => setShowAssignModal(false)}
              onSubmit={submitAssignment}
              submitting={submitting}
              submitLabel="Assign Asset"
            />
          </div>
        </Modal>
      )}

      {/* Return Modal */}
      {showReturnModal && selectedAssignment && (
        <Modal
          title="Return Asset"
          description={`Record the return of ${selectedAssignment.asset?.assetCode} from ${employeeName(
            selectedAssignment.employee
          )}.`}
          onClose={() => !submitting && setShowReturnModal(false)}
        >
          <div className="space-y-4">
            <Field label="Condition at Return">
              <select
                value={returnCondition}
                onChange={(event) => setReturnCondition(event.target.value)}
                className="input"
              >
                <option value="EXCELLENT">Excellent</option>
                <option value="GOOD">Good</option>
                <option value="FAIR">Fair</option>
                <option value="POOR">Poor</option>
                <option value="DAMAGED">Damaged</option>
              </select>
            </Field>

            <Field label="Notes">
              <textarea
                value={returnNotes}
                onChange={(event) => setReturnNotes(event.target.value)}
                placeholder="Describe the returned asset condition or any issues..."
                rows={4}
                className="input resize-none"
              />
            </Field>

            <ModalActions
              onCancel={() => setShowReturnModal(false)}
              onSubmit={submitReturn}
              submitting={submitting}
              submitLabel="Confirm Return"
            />
          </div>
        </Modal>
      )}

      {/* Reassign Modal */}
      {showReassignModal && selectedAssignment && (
        <Modal
          title="Reassign Asset"
          description={`Move ${selectedAssignment.asset?.assetCode} from ${employeeName(
            selectedAssignment.employee
          )} to another employee.`}
          onClose={() => !submitting && setShowReassignModal(false)}
        >
          <div className="space-y-4">
            <Field label="New Employee">
              <select
                value={reassignEmployeeId}
                onChange={(event) =>
                  setReassignEmployeeId(event.target.value)
                }
                className="input"
              >
                <option value="">Select employee</option>
                {employees
                  .filter(
                    (employee) =>
                      employee.id !== selectedAssignment.employeeId
                  )
                  .map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employeeName(employee)}
                      {employee.employeeNumber
                        ? ` · ${employee.employeeNumber}`
                        : ""}
                    </option>
                  ))}
              </select>
            </Field>

            <Field label="Condition at Reassignment">
              <select
                value={reassignCondition}
                onChange={(event) =>
                  setReassignCondition(event.target.value)
                }
                className="input"
              >
                <option value="EXCELLENT">Excellent</option>
                <option value="GOOD">Good</option>
                <option value="FAIR">Fair</option>
                <option value="POOR">Poor</option>
              </select>
            </Field>

            <Field label="Notes">
              <textarea
                value={reassignNotes}
                onChange={(event) => setReassignNotes(event.target.value)}
                placeholder="Optional reassignment notes..."
                rows={3}
                className="input resize-none"
              />
            </Field>

            <ModalActions
              onCancel={() => setShowReassignModal(false)}
              onSubmit={submitReassignment}
              submitting={submitting}
              submitLabel="Reassign Asset"
            />
          </div>
        </Modal>
      )}

      <style>{`
        .input {
          width: 100%;
          height: 42px;
          border: 1px solid rgb(226 232 240);
          border-radius: 8px;
          background: white;
          padding: 0 12px;
          font-size: 14px;
          color: rgb(51 65 85);
          outline: none;
        }

        .input:focus {
          border-color: rgb(148 163 184);
          box-shadow: 0 0 0 3px rgb(241 245 249);
        }

        textarea.input {
          height: auto;
          padding-top: 10px;
          padding-bottom: 10px;
        }
      `}</style>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon,
  description,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {value.toLocaleString()}
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400">{description}</p>
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
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6">{children}</div>
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
    <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
      <button
        type="button"
        onClick={onCancel}
        disabled={submitting}
        className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        Cancel
      </button>

      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting && <RefreshCw size={15} className="animate-spin" />}
        {submitting ? "Processing..." : submitLabel}
      </button>
    </div>
  );
}
