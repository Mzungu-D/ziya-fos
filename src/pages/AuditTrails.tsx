import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
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
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString("en-KE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDetails(details: string) {
  if (!details) {
    return "No additional details were recorded.";
  }

  try {
    const parsed = JSON.parse(details);

    return JSON.stringify(parsed, null, 2);
  } catch {
    return details;
  }
}

function getInitials(value: string) {
  if (!value || value === "SYSTEM") {
    return "SY";
  }

  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function getActionClasses(action: string) {
  switch (action.toUpperCase()) {
    case "CREATE":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200";

    case "APPROVE":
    case "APPROVED":
      return "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200";

    case "POST":
      return "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200";

    case "UPDATE":
      return "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200";

    case "SUBMIT":
    case "SUBMITTED_FOR_APPROVAL":
      return "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200";

    case "DELETE":
    case "REJECT":
    case "REVERSE":
      return "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200";

    case "LOGIN":
      return "bg-cyan-50 text-cyan-700 ring-1 ring-inset ring-cyan-200";

    case "LOGOUT":
      return "bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-200";

    default:
      return "bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-200";
  }
}

function getActionDot(action: string) {
  switch (action.toUpperCase()) {
    case "CREATE":
    case "APPROVE":
    case "APPROVED":
      return "bg-emerald-500";

    case "POST":
      return "bg-indigo-500";

    case "UPDATE":
      return "bg-blue-500";

    case "SUBMIT":
    case "SUBMITTED_FOR_APPROVAL":
      return "bg-amber-500";

    case "DELETE":
    case "REJECT":
    case "REVERSE":
      return "bg-red-500";

    default:
      return "bg-slate-400";
  }
}

export default function AuditTrails() {
  const [auditLogs, setAuditLogs] =
    useState<AuditLog[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [moduleFilter, setModuleFilter] =
    useState("");

  const [actionFilter, setActionFilter] =
    useState("");

  const [userFilter, setUserFilter] =
    useState("");

  const [dateFilter, setDateFilter] =
    useState("");

  const [page, setPage] =
    useState(1);

  const [pageSize, setPageSize] =
    useState(25);

  const [totals, setTotals] = useState({
    auditEvents: 0,
    users: 0,
    modules: 0,
  });

  const [pagination, setPagination] =
    useState({
      page: 1,
      pageSize: 25,
      total: 0,
      totalPages: 1,
    });

  const [selectedLog, setSelectedLog] =
    useState<AuditLog | null>(null);

  const loadAuditTrails =
    useCallback(async () => {
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

        if (moduleFilter) {
          params.set(
            "module",
            moduleFilter
          );
        }

        if (actionFilter) {
          params.set(
            "action",
            actionFilter
          );
        }

        if (userFilter.trim()) {
          params.set(
            "user",
            userFilter.trim()
          );
        }

        if (dateFilter) {
          params.set(
            "dateFilter",
            dateFilter
          );
        }

        const response =
          await authenticatedFetch(
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

        setAuditLogs(
          payload.data
        );

        setTotals({
          auditEvents:
            payload.totals
              ?.auditEvents ?? 0,

          users:
            payload.totals
              ?.users ?? 0,

          modules:
            payload.totals
              ?.modules ?? 0,
        });

        setPagination({
          page:
            payload.pagination
              ?.page ?? page,

          pageSize:
            payload.pagination
              ?.pageSize ?? pageSize,

          total:
            payload.pagination
              ?.total ?? 0,

          totalPages: Math.max(
            payload.pagination
              ?.totalPages ?? 1,
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
    const timer =
      window.setTimeout(() => {
        void loadAuditTrails();
      }, 300);

    return () =>
      window.clearTimeout(timer);
  }, [loadAuditTrails]);

  const modules = useMemo(() => {
    return Array.from(
      new Set(
        auditLogs
          .map(
            (log) => log.module
          )
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

  const endRecord =
    Math.min(
      pagination.page *
        pagination.pageSize,
      pagination.total
    );

  return (
    <div className="min-h-full bg-[#F7F8FC]">
      <div className="space-y-6">
        {/* =====================================================
            HEADER
        ===================================================== */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#20243A] text-white shadow-sm">
                <svg
                  width="21"
                  height="21"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M12 3l8 4v5c0 4.8-3.1 7.9-8 9-4.9-1.1-8-4.2-8-9V7l8-4z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </div>

              <div>
                <h1 className="text-2xl font-bold tracking-tight text-[#20243A] sm:text-3xl">
                  Audit Trails
                </h1>

                <p className="mt-1 text-sm text-[#70758A]">
                  Monitor system activity and
                  maintain a complete audit history.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadAuditTrails()
            }
            disabled={loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#20243A] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2B304A] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M20 11a8.1 8.1 0 0 0-15.3-3M4 4v4h4" />
              <path d="M4 13a8.1 8.1 0 0 0 15.3 3M20 20v-4h-4" />
            </svg>

            {loading
              ? "Refreshing..."
              : "Refresh"}
          </button>
        </div>

        {/* =====================================================
            ERROR
        ===================================================== */}
        {error && (
          <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                !
              </div>

              <p className="text-sm font-medium text-red-700">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadAuditTrails()
              }
              className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        )}

        {/* =====================================================
            KPI CARDS
        ===================================================== */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[#E9EAF0] bg-white p-5 shadow-[0_2px_8px_rgba(32,36,58,0.03)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[#73788D]">
                  Total Activities
                </p>

                <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#20243A]">
                  {loading
                    ? "—"
                    : totals.auditEvents.toLocaleString()}
                </h2>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F1F2F7] text-[#20243A]">
                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M4 5h16M4 12h16M4 19h16" />
                  <circle cx="7" cy="5" r="1" />
                  <circle cx="7" cy="12" r="1" />
                  <circle cx="7" cy="19" r="1" />
                </svg>
              </div>
            </div>

            <p className="mt-3 text-xs text-[#9A9EAE]">
              Recorded audit events
            </p>
          </div>

          <div className="rounded-2xl border border-[#E9EAF0] bg-white p-5 shadow-[0_2px_8px_rgba(32,36,58,0.03)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[#73788D]">
                  Active Users
                </p>

                <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#20243A]">
                  {loading
                    ? "—"
                    : totals.users.toLocaleString()}
                </h2>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <circle
                    cx="12"
                    cy="8"
                    r="3"
                  />
                  <path d="M5 20c.8-3.5 3-5 7-5s6.2 1.5 7 5" />
                </svg>
              </div>
            </div>

            <p className="mt-3 text-xs text-[#9A9EAE]">
              Users with recorded activity
            </p>
          </div>

          <div className="rounded-2xl border border-[#E9EAF0] bg-white p-5 shadow-[0_2px_8px_rgba(32,36,58,0.03)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[#73788D]">
                  Modules Tracked
                </p>

                <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#20243A]">
                  {loading
                    ? "—"
                    : totals.modules.toLocaleString()}
                </h2>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <rect
                    x="4"
                    y="4"
                    width="6"
                    height="6"
                    rx="1"
                  />
                  <rect
                    x="14"
                    y="4"
                    width="6"
                    height="6"
                    rx="1"
                  />
                  <rect
                    x="4"
                    y="14"
                    width="6"
                    height="6"
                    rx="1"
                  />
                  <rect
                    x="14"
                    y="14"
                    width="6"
                    height="6"
                    rx="1"
                  />
                </svg>
              </div>
            </div>

            <p className="mt-3 text-xs text-[#9A9EAE]">
              Modules with recorded activity
            </p>
          </div>

          <div className="rounded-2xl border border-[#E9EAF0] bg-white p-5 shadow-[0_2px_8px_rgba(32,36,58,0.03)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[#73788D]">
                  System Integrity
                </p>

                <h2
                  className={`mt-2 text-2xl font-bold ${
                    error
                      ? "text-red-500"
                      : "text-emerald-600"
                  }`}
                >
                  {loading
                    ? "Checking..."
                    : error
                    ? "Attention"
                    : "Healthy"}
                </h2>
              </div>

              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  error
                    ? "bg-red-50 text-red-600"
                    : "bg-emerald-50 text-emerald-600"
                }`}
              >
                <span className="relative flex h-3 w-3">
                  <span
                    className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-40 ${
                      error
                        ? "bg-red-500"
                        : "bg-emerald-500"
                    }`}
                  />
                  <span
                    className={`relative inline-flex h-3 w-3 rounded-full ${
                      error
                        ? "bg-red-500"
                        : "bg-emerald-500"
                    }`}
                  />
                </span>
              </div>
            </div>

            <p className="mt-3 text-xs text-[#9A9EAE]">
              Audit service status
            </p>
          </div>
        </div>

        {/* =====================================================
            FILTER WORKSPACE
        ===================================================== */}
        <div className="rounded-2xl border border-[#E9EAF0] bg-white shadow-[0_2px_8px_rgba(32,36,58,0.03)]">
          <div className="border-b border-[#EEF0F4] px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-bold text-[#20243A]">
                Activity Log
              </h2>

              <p className="text-sm text-[#73788D]">
                Search and filter recorded system
                activity.
              </p>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#73788D]">
                  Search
                </label>

                <div className="relative">
                  <svg
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A9EAE]"
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle
                      cx="11"
                      cy="11"
                      r="7"
                    />
                    <path d="m20 20-4-4" />
                  </svg>

                  <input
                    type="text"
                    value={search}
                    onChange={(event) => {
                      setSearch(
                        event.target.value
                      );
                      setPage(1);
                    }}
                    placeholder="Search activity..."
                    className="h-11 w-full rounded-xl border border-[#E1E3EA] bg-[#FBFBFD] pl-10 pr-4 text-sm text-[#20243A] outline-none transition placeholder:text-[#A0A4B2] focus:border-[#B9A15A] focus:bg-white focus:ring-2 focus:ring-[#B9A15A]/10"
                  />
                </div>
              </div>

              <div className="lg:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#73788D]">
                  Module
                </label>

                <select
                  value={moduleFilter}
                  onChange={(event) => {
                    setModuleFilter(
                      event.target.value
                    );
                    setPage(1);
                  }}
                  className="h-11 w-full rounded-xl border border-[#E1E3EA] bg-[#FBFBFD] px-3.5 text-sm text-[#20243A] outline-none transition focus:border-[#B9A15A] focus:bg-white"
                >
                  <option value="">
                    All modules
                  </option>

                  {modules.map(
                    (module) => (
                      <option
                        key={module}
                        value={module}
                      >
                        {module}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#73788D]">
                  Action
                </label>

                <select
                  value={actionFilter}
                  onChange={(event) => {
                    setActionFilter(
                      event.target.value
                    );
                    setPage(1);
                  }}
                  className="h-11 w-full rounded-xl border border-[#E1E3EA] bg-[#FBFBFD] px-3.5 text-sm text-[#20243A] outline-none transition focus:border-[#B9A15A] focus:bg-white"
                >
                  <option value="">
                    All actions
                  </option>

                  {ACTIONS.map(
                    (action) => (
                      <option
                        key={action}
                        value={action}
                      >
                        {action}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#73788D]">
                  User
                </label>

                <input
                  type="text"
                  value={userFilter}
                  onChange={(event) => {
                    setUserFilter(
                      event.target.value
                    );
                    setPage(1);
                  }}
                  placeholder="User..."
                  className="h-11 w-full rounded-xl border border-[#E1E3EA] bg-[#FBFBFD] px-3.5 text-sm text-[#20243A] outline-none transition placeholder:text-[#A0A4B2] focus:border-[#B9A15A] focus:bg-white focus:ring-2 focus:ring-[#B9A15A]/10"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#73788D]">
                  Date
                </label>

                <select
                  value={dateFilter}
                  onChange={(event) => {
                    setDateFilter(
                      event.target.value
                    );
                    setPage(1);
                  }}
                  className="h-11 w-full rounded-xl border border-[#E1E3EA] bg-[#FBFBFD] px-3.5 text-sm text-[#20243A] outline-none transition focus:border-[#B9A15A] focus:bg-white"
                >
                  {DATE_RANGES.map(
                    (range) => (
                      <option
                        key={range.value}
                        value={range.value}
                      >
                        {range.label}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            {hasFilters && (
              <div className="mt-4 flex items-center justify-between border-t border-[#EEF0F4] pt-4">
                <p className="text-xs text-[#8A8FA1]">
                  Filters are applied automatically.
                </p>

                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-sm font-semibold text-[#666B84] transition hover:text-[#20243A]"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        </div>

        {/* =====================================================
            TABLE
        ===================================================== */}
        <div className="overflow-hidden rounded-2xl border border-[#E9EAF0] bg-white shadow-[0_2px_8px_rgba(32,36,58,0.03)]">
          <div className="flex items-center justify-between border-b border-[#EEF0F4] px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-sm font-bold text-[#20243A]">
                Audit Events
              </h2>

              <p className="mt-0.5 text-xs text-[#8A8FA1]">
                {pagination.total.toLocaleString()} total
                events
              </p>
            </div>

            <div className="hidden items-center gap-2 text-xs text-[#8A8FA1] sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Live audit records
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px]">
              <thead>
                <tr className="border-b border-[#EEF0F4] bg-[#FBFBFD]">
                  <th className="w-[180px] px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[#7B8092]">
                    Time
                  </th>

                  <th className="w-[235px] px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[#7B8092]">
                    User
                  </th>

                  <th className="w-[205px] px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[#7B8092]">
                    Action
                  </th>

                  <th className="w-[190px] px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[#7B8092]">
                    Module
                  </th>

                  <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[#7B8092]">
                    Details
                  </th>

                  <th className="w-[90px] px-6 py-4 text-right text-[11px] font-bold uppercase tracking-[0.08em] text-[#7B8092]">
                    View
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-16"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E2E3E9] border-t-[#B9A15A]" />

                        <p className="mt-4 text-sm font-medium text-[#666B84]">
                          Loading audit events...
                        </p>
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
                        className="px-6 py-16"
                      >
                        <div className="mx-auto flex max-w-sm flex-col items-center text-center">
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F2F3F7] text-[#8A8FA1]">
                            <svg
                              width="24"
                              height="24"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.7"
                            >
                              <path d="M5 4h14v16H5z" />
                              <path d="M8 8h8M8 12h8M8 16h5" />
                            </svg>
                          </div>

                          <p className="mt-4 font-semibold text-[#20243A]">
                            No audit events found
                          </p>

                          <p className="mt-1 text-sm leading-6 text-[#7B8092]">
                            No records match the
                            current filters.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}

                {!loading &&
                  auditLogs.map(
                    (log) => (
                      <tr
                        key={log.id}
                        className="group border-b border-[#F0F1F5] transition last:border-b-0 hover:bg-[#FCFCFE]"
                      >
                        <td className="px-6 py-4 align-middle">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F2F3F7] text-[#7B8092]">
                              <svg
                                width="15"
                                height="15"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                              >
                                <circle
                                  cx="12"
                                  cy="12"
                                  r="8"
                                />
                                <path d="M12 8v4l2.5 2" />
                              </svg>
                            </div>

                            <div>
                              <p className="whitespace-nowrap text-sm font-semibold text-[#20243A]">
                                {formatTime(
                                  log.date
                                )}
                              </p>

                              <p className="mt-0.5 whitespace-nowrap text-[11px] text-[#979BAB]">
                                {formatDateTime(
                                  log.date
                                ).split(
                                  ", "
                                )[0]}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 align-middle">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ECEEF4] text-[11px] font-bold text-[#4E536A]">
                              {getInitials(
                                log.user
                              )}
                            </div>

                            <div className="min-w-0">
                              <p
                                className="truncate text-sm font-semibold text-[#20243A]"
                                title={
                                  log.user
                                }
                              >
                                {log.user ||
                                  "System"}
                              </p>

                              <p className="mt-0.5 text-[11px] text-[#979BAB]">
                                {log.user ===
                                "SYSTEM"
                                  ? "System"
                                  : "FOS user"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 align-middle">
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${getActionDot(
                                log.action
                              )}`}
                            />

                            <span
                              className={`inline-flex whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ${getActionClasses(
                                log.action
                              )}`}
                            >
                              {log.action}
                            </span>
                          </div>
                        </td>

                        <td className="px-6 py-4 align-middle">
                          <span className="inline-flex max-w-[160px] truncate rounded-lg border border-[#E7E8EE] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[#555A70]">
                            {log.module ||
                              "—"}
                          </span>
                        </td>

                        <td className="max-w-[360px] px-6 py-4 align-middle">
                          <p
                            className="truncate text-sm text-[#666B84]"
                            title={
                              log.details
                            }
                          >
                            {log.details ||
                              "No details recorded."}
                          </p>
                        </td>

                        <td className="px-6 py-4 text-right align-middle">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedLog(
                                log
                              )
                            }
                            className="inline-flex h-9 items-center justify-center rounded-lg border border-[#E1E3EA] bg-white px-3 text-xs font-bold text-[#20243A] opacity-90 shadow-sm transition hover:border-[#C9CBD5] hover:bg-[#F8F8FB] group-hover:opacity-100"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    )
                  )}
              </tbody>
            </table>
          </div>

          {/* ===================================================
              PAGINATION
          =================================================== */}
          <div className="flex flex-col gap-4 border-t border-[#EEF0F4] bg-[#FCFCFD] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-3 text-sm text-[#73788D]">
              <span>
                Showing{" "}
                <strong className="font-semibold text-[#20243A]">
                  {startRecord}
                </strong>{" "}
                to{" "}
                <strong className="font-semibold text-[#20243A]">
                  {endRecord}
                </strong>{" "}
                of{" "}
                <strong className="font-semibold text-[#20243A]">
                  {pagination.total.toLocaleString()}
                </strong>
              </span>

              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(
                    Number(
                      event.target.value
                    )
                  );
                  setPage(1);
                }}
                className="rounded-lg border border-[#E1E3EA] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#20243A] outline-none focus:border-[#B9A15A]"
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
                  pagination.page <=
                    1 ||
                  loading
                }
                onClick={() =>
                  setPage(
                    (current) =>
                      Math.max(
                        current - 1,
                        1
                      )
                  )
                }
                className="inline-flex h-9 items-center justify-center rounded-lg border border-[#E1E3EA] bg-white px-3.5 text-xs font-semibold text-[#555A70] transition hover:bg-[#F5F6F9] disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Previous
              </button>

              <div className="flex h-9 min-w-[100px] items-center justify-center rounded-lg border border-[#E1E3EA] bg-white px-3 text-xs font-semibold text-[#555A70]">
                Page{" "}
                <span className="mx-1 text-[#20243A]">
                  {pagination.page}
                </span>
                of{" "}
                <span className="ml-1 text-[#20243A]">
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
                  setPage(
                    (current) =>
                      Math.min(
                        current + 1,
                        pagination.totalPages
                      )
                  )
                }
                className="inline-flex h-9 items-center justify-center rounded-lg border border-[#E1E3EA] bg-white px-3.5 text-xs font-semibold text-[#555A70] transition hover:bg-[#F5F6F9] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        </div>

        {/* =====================================================
            DETAIL DRAWER
        ===================================================== */}
        {selectedLog && (
          <div className="fixed inset-0 z-50">
            <button
              type="button"
              aria-label="Close audit event details"
              onClick={() =>
                setSelectedLog(null)
              }
              className="absolute inset-0 bg-[#101321]/40 backdrop-blur-[1px]"
            />

            <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#ECEEF3] px-6 py-5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#8A8FA1]">
                    Audit Event
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-[#20243A]">
                    Event Details
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedLog(null)
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E1E3EA] text-[#666B84] transition hover:bg-[#F7F8FA] hover:text-[#20243A]"
                  aria-label="Close"
                >
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="rounded-2xl border border-[#ECEEF3] bg-[#FAFAFC] p-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#20243A] text-sm font-bold text-white">
                      {getInitials(
                        selectedLog.user
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="text-base font-bold text-[#20243A]">
                        {selectedLog.user ||
                          "System"}
                      </p>

                      <p className="mt-0.5 text-sm text-[#73788D]">
                        {formatDateTime(
                          selectedLog.date
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#ECEEF3] bg-white p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#979BAB]">
                      Action
                    </p>

                    <span
                      className={`mt-2 inline-flex rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ${getActionClasses(
                        selectedLog.action
                      )}`}
                    >
                      {selectedLog.action}
                    </span>
                  </div>

                  <div className="rounded-xl border border-[#ECEEF3] bg-white p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#979BAB]">
                      Module
                    </p>

                    <p className="mt-3 text-sm font-bold uppercase tracking-wide text-[#20243A]">
                      {selectedLog.module ||
                        "—"}
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#979BAB]">
                    Audit ID
                  </p>

                  <div className="mt-2 rounded-xl border border-[#ECEEF3] bg-[#FAFAFC] p-3 font-mono text-xs leading-5 text-[#666B84] break-all">
                    {selectedLog.id}
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#979BAB]">
                      Event Details
                    </p>
                  </div>

                  <pre className="mt-2 max-h-[520px] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-[#ECEEF3] bg-[#FAFAFC] p-4 font-mono text-xs leading-6 text-[#30354A]">
                    {formatDetails(
                      selectedLog.details
                    )}
                  </pre>
                </div>
              </div>

              <div className="border-t border-[#ECEEF3] bg-white px-6 py-4">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedLog(null)
                  }
                  className="h-10 w-full rounded-xl bg-[#20243A] text-sm font-semibold text-white transition hover:bg-[#2B304A]"
                >
                  Close
                </button>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}