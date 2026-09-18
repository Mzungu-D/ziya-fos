import { useCallback, useEffect, useMemo, useState } from "react";
import { authenticatedFetch } from "../lib/auth";

type AuditLog = {
  id: string;
  date: string;
  user: string;
  action: string;
  module: string;
  details: string;
};

type AuditTrailResponse = {
  success?: boolean;
  data?: AuditLog[];
  totals?: {
    auditEvents?: number;
    users?: number;
    modules?: number;
  };
  pagination?: {
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
  };
  message?: string;
};

const PAGE_SIZE_OPTIONS = [25, 50, 100];

const ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "SUBMIT",
  "APPROVE",
  "REJECT",
  "POST",
  "REVERSE",
  "LOGIN",
  "LOGOUT",
];

const DATE_RANGES = [
  { value: "", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-KE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDetails(details: string) {
  try {
    const parsed = JSON.parse(details);

    return JSON.stringify(parsed, null, 2);
  } catch {
    return details;
  }
}

function getActionClasses(action: string) {
  switch (action.toUpperCase()) {
    case "CREATE":
    case "APPROVE":
    case "POST":
      return "bg-green-50 text-green-700 border-green-200";

    case "DELETE":
    case "REJECT":
    case "REVERSE":
      return "bg-red-50 text-red-700 border-red-200";

    case "SUBMIT":
    case "UPDATE":
      return "bg-blue-50 text-blue-700 border-blue-200";

    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
}

export default function AuditTrails() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [totals, setTotals] = useState({
    auditEvents: 0,
    users: 0,
    modules: 0,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 1,
  });

  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const loadAuditTrails = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();

      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (moduleFilter) {
        params.set("module", moduleFilter);
      }

      if (actionFilter) {
        params.set("action", actionFilter);
      }

      if (userFilter.trim()) {
        params.set("user", userFilter.trim());
      }

      if (dateFilter) {
        params.set("dateFilter", dateFilter);
      }

      const response = await authenticatedFetch(
        `/api/financial-reports/audit-trail?${params.toString()}`
      );

      const payload = (await response.json()) as AuditTrailResponse;

      if (!response.ok) {
        throw new Error(
          payload.message || "Failed to load audit trails."
        );
      }

      if (!payload.success || !Array.isArray(payload.data)) {
        throw new Error("Invalid audit trail response.");
      }

      setAuditLogs(payload.data);

      setTotals({
        auditEvents: payload.totals?.auditEvents ?? 0,
        users: payload.totals?.users ?? 0,
        modules: payload.totals?.modules ?? 0,
      });

      setPagination({
        page: payload.pagination?.page ?? page,
        pageSize: payload.pagination?.pageSize ?? pageSize,
        total: payload.pagination?.total ?? 0,
        totalPages: Math.max(
          payload.pagination?.totalPages ?? 1,
          1
        ),
      });
    } catch (err) {
      console.error("AUDIT TRAIL LOAD ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load audit trails."
      );

      setAuditLogs([]);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    search,
    moduleFilter,
    actionFilter,
    userFilter,
    dateFilter,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAuditTrails();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [loadAuditTrails]);

  const modules = useMemo(() => {
    return Array.from(
      new Set(auditLogs.map((log) => log.module).filter(Boolean))
    ).sort();
  }, [auditLogs]);

  const clearFilters = () => {
    setSearch("");
    setModuleFilter("");
    setActionFilter("");
    setUserFilter("");
    setDateFilter("");
    setPage(1);
  };

  const hasFilters =
    Boolean(search.trim()) ||
    Boolean(moduleFilter) ||
    Boolean(actionFilter) ||
    Boolean(userFilter.trim()) ||
    Boolean(dateFilter);

  const startRecord =
    pagination.total === 0
      ? 0
      : (pagination.page - 1) * pagination.pageSize + 1;

  const endRecord = Math.min(
    pagination.page * pagination.pageSize,
    pagination.total
  );

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#20243A]">
            Audit Trails
          </h1>

          <p className="mt-2 text-[#666B84]">
            Track and review activity across Ziya FOS.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadAuditTrails()}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-xl border border-[#E4E5EC] bg-white px-4 py-2.5 text-sm font-semibold text-[#20243A] shadow-sm transition hover:bg-[#F8F8FB] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* ERROR */}
      {error && (
        <div className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-700">
            {error}
          </p>

          <button
            type="button"
            onClick={() => void loadAuditTrails()}
            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      )}

      {/* SUMMARY */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-[#666B84]">
            Total Activities
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#20243A]">
            {loading ? "—" : totals.auditEvents.toLocaleString()}
          </h2>

          <p className="mt-1 text-xs text-[#8A8EA3]">
            Recorded audit events
          </p>
        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-[#666B84]">
            Active Users
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#20243A]">
            {loading ? "—" : totals.users.toLocaleString()}
          </h2>

          <p className="mt-1 text-xs text-[#8A8EA3]">
            Users with recorded activity
          </p>
        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-[#666B84]">
            Modules Tracked
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#20243A]">
            {loading ? "—" : totals.modules.toLocaleString()}
          </h2>

          <p className="mt-1 text-xs text-[#8A8EA3]">
            Modules with audit activity
          </p>
        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-[#666B84]">
            System Integrity
          </p>

          <h2
            className={`mt-2 text-2xl font-bold ${
              error ? "text-red-500" : "text-green-600"
            }`}
          >
            {loading
              ? "Checking..."
              : error
              ? "Attention"
              : "Healthy"}
          </h2>

          <p className="mt-1 text-xs text-[#8A8EA3]">
            Audit service status
          </p>
        </div>
      </div>

      {/* FILTERS */}
      <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-1">
          <h2 className="font-semibold text-[#20243A]">
            Activity Log
          </h2>

          <p className="text-sm text-[#666B84]">
            Search and filter recorded system activity.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="xl:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold text-[#666B84]">
              Search
            </label>

            <input
              type="text"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search details, user, action..."
              className="w-full rounded-xl border border-[#E4E5EC] px-3.5 py-2.5 text-sm text-[#20243A] outline-none transition focus:border-[#B9A15A] focus:ring-2 focus:ring-[#B9A15A]/10"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#666B84]">
              Module
            </label>

            <select
              value={moduleFilter}
              onChange={(event) => {
                setModuleFilter(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-[#E4E5EC] bg-white px-3.5 py-2.5 text-sm text-[#20243A] outline-none focus:border-[#B9A15A]"
            >
              <option value="">All modules</option>

              {modules.map((module) => (
                <option key={module} value={module}>
                  {module}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#666B84]">
              Action
            </label>

            <select
              value={actionFilter}
              onChange={(event) => {
                setActionFilter(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-[#E4E5EC] bg-white px-3.5 py-2.5 text-sm text-[#20243A] outline-none focus:border-[#B9A15A]"
            >
              <option value="">All actions</option>

              {ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#666B84]">
              User
            </label>

            <input
              type="text"
              value={userFilter}
              onChange={(event) => {
                setUserFilter(event.target.value);
                setPage(1);
              }}
              placeholder="User..."
              className="w-full rounded-xl border border-[#E4E5EC] px-3.5 py-2.5 text-sm text-[#20243A] outline-none focus:border-[#B9A15A]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#666B84]">
              Date
            </label>

            <select
              value={dateFilter}
              onChange={(event) => {
                setDateFilter(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-[#E4E5EC] bg-white px-3.5 py-2.5 text-sm text-[#20243A] outline-none focus:border-[#B9A15A]"
            >
              {DATE_RANGES.map((range) => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {hasFilters && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-semibold text-[#666B84] hover:text-[#20243A]"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* TABLE */}
      <div className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="border-b border-[#ECECF3] bg-[#FAFAFC]">
              <tr>
                <th className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                  Time
                </th>

                <th className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                  User
                </th>

                <th className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                  Action
                </th>

                <th className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                  Module
                </th>

                <th className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                  Details
                </th>

                <th className="p-4 text-right text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                  View
                </th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-12 text-center text-sm text-[#666B84]"
                  >
                    Loading audit activity...
                  </td>
                </tr>
              )}

              {!loading &&
                !error &&
                auditLogs.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-12 text-center"
                    >
                      <p className="font-medium text-[#20243A]">
                        No audit activity found
                      </p>

                      <p className="mt-1 text-sm text-[#666B84]">
                        Try changing your filters or search criteria.
                      </p>
                    </td>
                  </tr>
                )}

              {!loading &&
                auditLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-t border-[#ECECF3] transition hover:bg-[#FAFAFC]"
                  >
                    <td className="whitespace-nowrap p-4 text-sm text-[#666B84]">
                      {formatDateTime(log.date)}
                    </td>

                    <td className="p-4">
                      <div className="max-w-[180px] truncate text-sm font-medium text-[#20243A]">
                        {log.user || "System"}
                      </div>
                    </td>

                    <td className="p-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getActionClasses(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>

                    <td className="p-4">
                      <span className="text-sm font-medium text-[#666B84]">
                        {log.module || "—"}
                      </span>
                    </td>

                    <td className="max-w-[420px] p-4">
                      <p className="truncate text-sm text-[#666B84]">
                        {log.details || "—"}
                      </p>
                    </td>

                    <td className="p-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedLog(log)}
                        className="rounded-lg border border-[#E4E5EC] bg-white px-3 py-1.5 text-xs font-semibold text-[#20243A] hover:bg-[#F8F8FB]"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="flex flex-col gap-4 border-t border-[#ECECF3] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-sm text-[#666B84]">
            <span>
              {startRecord}–{endRecord} of{" "}
              {pagination.total.toLocaleString()}
            </span>

            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="rounded-lg border border-[#E4E5EC] bg-white px-2.5 py-1.5 text-sm outline-none"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1 || loading}
              onClick={() =>
                setPage((current) => Math.max(current - 1, 1))
              }
              className="rounded-lg border border-[#E4E5EC] bg-white px-3 py-2 text-sm font-semibold text-[#20243A] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            <span className="min-w-[100px] text-center text-sm text-[#666B84]">
              Page {pagination.page} of {pagination.totalPages}
            </span>

            <button
              type="button"
              disabled={
                pagination.page >= pagination.totalPages ||
                loading
              }
              onClick={() =>
                setPage((current) =>
                  Math.min(
                    current + 1,
                    pagination.totalPages
                  )
                )
              }
              className="rounded-lg border border-[#E4E5EC] bg-white px-3 py-2 text-sm font-semibold text-[#20243A] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* DETAIL DRAWER */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Close audit details"
            onClick={() => setSelectedLog(null)}
            className="absolute inset-0 bg-black/30"
          />

          <aside className="relative z-10 h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-[#ECECF3] bg-white px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-[#20243A]">
                  Audit Event
                </h2>

                <p className="mt-1 text-sm text-[#666B84]">
                  Full event details
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="rounded-lg border border-[#E4E5EC] px-3 py-2 text-sm font-semibold text-[#666B84] hover:bg-[#F8F8FB]"
              >
                Close
              </button>
            </div>

            <div className="space-y-6 p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8EA3]">
                    Action
                  </p>

                  <span
                    className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getActionClasses(
                      selectedLog.action
                    )}`}
                  >
                    {selectedLog.action}
                  </span>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8EA3]">
                    Module
                  </p>

                  <p className="mt-2 font-medium text-[#20243A]">
                    {selectedLog.module || "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8EA3]">
                    User
                  </p>

                  <p className="mt-2 break-words font-medium text-[#20243A]">
                    {selectedLog.user || "System"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8EA3]">
                    Timestamp
                  </p>

                  <p className="mt-2 text-sm text-[#20243A]">
                    {formatDateTime(selectedLog.date)}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8EA3]">
                  Audit ID
                </p>

                <div className="mt-2 rounded-xl border border-[#ECECF3] bg-[#FAFAFC] p-3 font-mono text-xs break-all text-[#666B84]">
                  {selectedLog.id}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8EA3]">
                  Details
                </p>

                <pre className="mt-2 max-h-[500px] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-[#ECECF3] bg-[#FAFAFC] p-4 font-mono text-xs leading-6 text-[#20243A]">
                  {formatDetails(selectedLog.details || "No details recorded.")}
                </pre>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}