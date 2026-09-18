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
  "SUBMITTED_FOR_APPROVAL",
  "APPROVE",
  "APPROVED",
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
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDetails(details: string) {
  if (!details) {
    return "No details recorded.";
  }

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
    case "APPROVED":
    case "POST":
      return "border-green-200 bg-green-50 text-green-700";

    case "DELETE":
    case "REJECT":
    case "REVERSE":
      return "border-red-200 bg-red-50 text-red-700";

    case "SUBMIT":
    case "SUBMITTED_FOR_APPROVAL":
    case "UPDATE":
      return "border-blue-200 bg-blue-50 text-blue-700";

    case "LOGIN":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "LOGOUT":
      return "border-gray-200 bg-gray-50 text-gray-700";

    default:
      return "border-[#E4E5EC] bg-[#F8F8FB] text-[#4E536A]";
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

  const [selectedLog, setSelectedLog] =
    useState<AuditLog | null>(null);

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

      const payload =
        (await response.json()) as AuditTrailResponse;

      if (!response.ok) {
        throw new Error(
          payload.message ||
            "Failed to load audit trails."
        );
      }

      if (
        !payload.success ||
        !Array.isArray(payload.data)
      ) {
        throw new Error(
          "Invalid audit trail response."
        );
      }

      setAuditLogs(payload.data);

      setTotals({
        auditEvents:
          payload.totals?.auditEvents ?? 0,
        users:
          payload.totals?.users ?? 0,
        modules:
          payload.totals?.modules ?? 0,
      });

      setPagination({
        page:
          payload.pagination?.page ?? page,
        pageSize:
          payload.pagination?.pageSize ??
          pageSize,
        total:
          payload.pagination?.total ?? 0,
        totalPages: Math.max(
          payload.pagination?.totalPages ?? 1,
          1
        ),
      });
    } catch (err) {
      console.error(
        "AUDIT TRAIL LOAD ERROR:",
        err
      );

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
      new Set(
        auditLogs
          .map((log) => log.module)
          .filter(Boolean)
      )
    ).sort();
  }, [auditLogs]);

  const hasFilters =
    Boolean(search.trim()) ||
    Boolean(moduleFilter) ||
    Boolean(actionFilter) ||
    Boolean(userFilter.trim()) ||
    Boolean(dateFilter);

  const clearFilters = () => {
    setSearch("");
    setModuleFilter("");
    setActionFilter("");
    setUserFilter("");
    setDateFilter("");
    setPage(1);
  };

  const startRecord =
    pagination.total === 0
      ? 0
      : (pagination.page - 1) *
          pagination.pageSize +
        1;

  const endRecord = Math.min(
    pagination.page * pagination.pageSize,
    pagination.total
  );

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-[#20243A]">
              Audit Trails
            </h1>

            {!loading && (
              <span className="rounded-full border border-[#E5E6ED] bg-[#F8F8FB] px-3 py-1 text-xs font-semibold text-[#666B84]">
                {totals.auditEvents.toLocaleString()} events
              </span>
            )}
          </div>

          <p className="mt-2 text-[#666B84]">
            Monitor and review recorded activity across
            Ziya FOS.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadAuditTrails()}
          disabled={loading}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#E1E2EA] bg-white px-5 text-sm font-semibold text-[#20243A] shadow-sm transition hover:bg-[#F8F8FB] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span
            className={
              loading
                ? "animate-spin"
                : ""
            }
          >
            ↻
          </span>

          {loading
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </div>

      {/* ERROR */}
      {error && (
        <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-red-700">
            {error}
          </p>

          <button
            type="button"
            onClick={() => void loadAuditTrails()}
            className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
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
            {loading
              ? "—"
              : totals.auditEvents.toLocaleString()}
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
            {loading
              ? "—"
              : totals.users.toLocaleString()}
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
            {loading
              ? "—"
              : totals.modules.toLocaleString()}
          </h2>

          <p className="mt-1 text-xs text-[#8A8EA3]">
            Modules with recorded activity
          </p>
        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-[#666B84]">
            System Integrity
          </p>

          <div className="mt-2 flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                error
                  ? "bg-red-500"
                  : "bg-green-500"
              }`}
            />

            <h2
              className={`text-2xl font-bold ${
                error
                  ? "text-red-500"
                  : "text-green-600"
              }`}
            >
              {loading
                ? "Checking..."
                : error
                ? "Attention"
                : "Healthy"}
            </h2>
          </div>

          <p className="mt-1 text-xs text-[#8A8EA3]">
            Audit service status
          </p>
        </div>
      </div>

      {/* FILTERS */}
      <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-1">
          <h2 className="font-semibold text-[#20243A]">
            Activity Log
          </h2>

          <p className="text-sm text-[#666B84]">
            Search, filter and inspect audit activity.
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
              placeholder="Search user, action, module or details..."
              className="h-11 w-full rounded-xl border border-[#E1E2EA] bg-white px-3.5 text-sm text-[#20243A] outline-none transition placeholder:text-[#A0A4B5] focus:border-[#B9A15A] focus:ring-2 focus:ring-[#B9A15A]/10"
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
              className="h-11 w-full rounded-xl border border-[#E1E2EA] bg-white px-3.5 text-sm text-[#20243A] outline-none focus:border-[#B9A15A]"
            >
              <option value="">
                All modules
              </option>

              {modules.map((module) => (
                <option
                  key={module}
                  value={module}
                >
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
              className="h-11 w-full rounded-xl border border-[#E1E2EA] bg-white px-3.5 text-sm text-[#20243A] outline-none focus:border-[#B9A15A]"
            >
              <option value="">
                All actions
              </option>

              {ACTIONS.map((action) => (
                <option
                  key={action}
                  value={action}
                >
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
              className="h-11 w-full rounded-xl border border-[#E1E2EA] px-3.5 text-sm text-[#20243A] outline-none focus:border-[#B9A15A] focus:ring-2 focus:ring-[#B9A15A]/10"
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
              className="h-11 w-full rounded-xl border border-[#E1E2EA] bg-white px-3.5 text-sm text-[#20243A] outline-none focus:border-[#B9A15A]"
            >
              {DATE_RANGES.map((range) => (
                <option
                  key={range.value}
                  value={range.value}
                >
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

      {/* AUDIT TABLE */}
      <div className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] table-fixed">
            <colgroup>
              <col className="w-[150px]" />
              <col className="w-[230px]" />
              <col className="w-[200px]" />
              <col className="w-[180px]" />
              <col />
              <col className="w-[100px]" />
            </colgroup>

            <thead className="border-b border-[#ECECF3] bg-[#FAFAFC]">
              <tr>
                <th className="whitespace-nowrap px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                  Time
                </th>

                <th className="whitespace-nowrap px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                  User
                </th>

                <th className="whitespace-nowrap px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                  Action
                </th>

                <th className="whitespace-nowrap px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                  Module
                </th>

                <th className="whitespace-nowrap px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                  Details
                </th>

                <th className="whitespace-nowrap px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-[#666B84]">
                  View
                </th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-14 text-center"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#D8D9E2] border-t-[#B9A15A]" />

                      <span className="text-sm text-[#666B84]">
                        Loading audit activity...
                      </span>
                    </div>
                  </td>
                </tr>
              )}

              {!loading &&
                !error &&
                auditLogs.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-14 text-center"
                    >
                      <p className="font-semibold text-[#20243A]">
                        No audit activity found
                      </p>

                      <p className="mt-1 text-sm text-[#666B84]">
                        Try changing your filters or
                        search criteria.
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
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-[#666B84]">
                      {formatDateTime(log.date)}
                    </td>

                    <td className="px-5 py-4">
                      <div
                        className="truncate text-sm font-semibold text-[#20243A]"
                        title={log.user}
                      >
                        {log.user || "System"}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex max-w-full items-center rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${getActionClasses(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className="block truncate text-sm font-semibold uppercase tracking-wide text-[#666B84]"
                        title={log.module}
                      >
                        {log.module || "—"}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <p
                        className="truncate text-sm text-[#666B84]"
                        title={log.details}
                      >
                        {log.details || "—"}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedLog(log)
                        }
                        className="inline-flex h-9 min-w-[68px] items-center justify-center rounded-lg border border-[#E1E2EA] bg-white px-3 text-sm font-semibold text-[#20243A] transition hover:border-[#D2D3DC] hover:bg-[#F8F8FB]"
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
          <div className="flex flex-wrap items-center gap-3 text-sm text-[#666B84]">
            <span>
              Showing{" "}
              <span className="font-semibold text-[#20243A]">
                {startRecord}
              </span>
              –
              <span className="font-semibold text-[#20243A]">
                {endRecord}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-[#20243A]">
                {pagination.total.toLocaleString()}
              </span>
            </span>

            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(
                  Number(event.target.value)
                );
                setPage(1);
              }}
              className="rounded-lg border border-[#E1E2EA] bg-white px-3 py-1.5 text-sm font-medium text-[#20243A] outline-none"
            >
              {PAGE_SIZE_OPTIONS.map(
                (size) => (
                  <option
                    key={size}
                    value={size}
                  >
                    {size} / page
                  </option>
                )
              )}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={
                pagination.page <= 1 ||
                loading
              }
              onClick={() =>
                setPage((current) =>
                  Math.max(
                    current - 1,
                    1
                  )
                )
              }
              className="rounded-lg border border-[#E1E2EA] bg-white px-4 py-2 text-sm font-semibold text-[#20243A] transition hover:bg-[#F8F8FB] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            <div className="min-w-[110px] rounded-lg border border-[#E1E2EA] bg-[#FAFAFC] px-4 py-2 text-center text-sm font-medium text-[#666B84]">
              Page{" "}
              <span className="font-semibold text-[#20243A]">
                {pagination.page}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-[#20243A]">
                {pagination.totalPages}
              </span>
            </div>

            <button
              type="button"
              disabled={
                pagination.page >=
                  pagination.totalPages ||
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
              className="rounded-lg border border-[#E1E2EA] bg-white px-4 py-2 text-sm font-semibold text-[#20243A] transition hover:bg-[#F8F8FB] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* DETAIL DRAWER */}
      {selectedLog && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close audit details"
            onClick={() =>
              setSelectedLog(null)
            }
            className="absolute inset-0 bg-black/30"
          />

          <aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#ECECF3] bg-white px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-[#20243A]">
                  Audit Event
                </h2>

                <p className="mt-1 text-sm text-[#666B84]">
                  Complete event information
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedLog(null)
                }
                className="rounded-lg border border-[#E1E2EA] px-3 py-2 text-sm font-semibold text-[#666B84] hover:bg-[#F8F8FB]"
              >
                Close
              </button>
            </div>

            <div className="space-y-6 p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-[#ECECF3] bg-[#FAFAFC] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8EA3]">
                    Action
                  </p>

                  <span
                    className={`mt-3 inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${getActionClasses(
                      selectedLog.action
                    )}`}
                  >
                    {selectedLog.action}
                  </span>
                </div>

                <div className="rounded-xl border border-[#ECECF3] bg-[#FAFAFC] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8EA3]">
                    Module
                  </p>

                  <p className="mt-3 font-semibold uppercase text-[#20243A]">
                    {selectedLog.module ||
                      "—"}
                  </p>
                </div>

                <div className="rounded-xl border border-[#ECECF3] bg-[#FAFAFC] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8EA3]">
                    User
                  </p>

                  <p className="mt-3 break-all font-medium text-[#20243A]">
                    {selectedLog.user ||
                      "System"}
                  </p>
                </div>

                <div className="rounded-xl border border-[#ECECF3] bg-[#FAFAFC] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8EA3]">
                    Timestamp
                  </p>

                  <p className="mt-3 text-sm font-medium text-[#20243A]">
                    {formatDateTime(
                      selectedLog.date
                    )}
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
                  Event Details
                </p>

                <pre className="mt-2 max-h-[520px] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-[#ECECF3] bg-[#FAFAFC] p-4 font-mono text-xs leading-6 text-[#20243A]">
                  {formatDetails(
                    selectedLog.details
                  )}
                </pre>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}