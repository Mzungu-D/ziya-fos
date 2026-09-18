import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { authenticatedFetch } from "../lib/auth";

/* =========================================================
   TYPES
========================================================= */

type AuditLog = {
  id: string;
  date: string;
  createdAt?: string;

  userId?: string;
  user: string;
  userName?: string | null;
  userEmail?: string | null;

  action: string;
  module: string;

  summary?: string;
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
    hasPreviousPage?: boolean;
    hasNextPage?: boolean;
  };

  message?: string;
};

/* =========================================================
   CONSTANTS
========================================================= */

const PAGE_SIZE_OPTIONS = [25, 50, 100];

const ACTIONS = [
  "CREATE",
  "CREATED",
  "UPDATE",
  "UPDATED",
  "DELETE",
  "DELETED",
  "SUBMIT",
  "SUBMITTED",
  "SUBMITTED_FOR_APPROVAL",
  "APPROVE",
  "APPROVED",
  "REJECT",
  "REJECTED",
  "POST",
  "POSTED",
  "REVERSE",
  "REVERSED",
  "LOGIN",
  "LOGOUT",
  "PAYMENT",
  "PAID",
  "ASSIGN",
  "UNASSIGN",
  "ACTIVATE",
  "DEACTIVATE",
  "INVITE",
  "INVITED",
];

const MODULES = [
  "ACCOUNT",
  "CHART_OF_ACCOUNTS",
  "JOURNAL",
  "JOURNAL_ENTRY",
  "EXPENSE",
  "EXPENSE_PAYMENT",
  "PROCUREMENT",
  "ACCOUNTS_PAYABLE",
  "ACCOUNTS_RECEIVABLE",
  "INVOICE",
  "PAYMENT",
  "PAYROLL",
  "ASSET",
  "ASSET_ASSIGNMENT",
  "BANK",
  "BANK_ACCOUNT",
  "MPESA",
  "BUDGET",
  "APPROVAL",
  "CUSTOMER",
  "VENDOR",
  "USER",
  "ORGANIZATION",
  "SETTINGS",
  "AUTH",
  "AUTHENTICATION",
  "REPORT",
  "HR",
  "EMPLOYEE",
];

const DATE_RANGES = [
  {
    value: "",
    label: "All time",
  },
  {
    value: "today",
    label: "Today",
  },
  {
    value: "7d",
    label: "Last 7 days",
  },
  {
    value: "30d",
    label: "Last 30 days",
  },
  {
    value: "90d",
    label: "Last 90 days",
  },
];

/* =========================================================
   FORMATTING
========================================================= */

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

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
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

function humanize(value: string) {
  if (!value) {
    return "—";
  }

  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function formatDetails(details: string) {
  if (!details) {
    return "No additional details were recorded.";
  }

  try {
    const parsed = JSON.parse(details);

    return JSON.stringify(
      parsed,
      null,
      2
    );
  } catch {
    return details;
  }
}

/* =========================================================
   USER DISPLAY
========================================================= */

function getDisplayName(log: AuditLog) {
  if (
    log.userName &&
    log.userName.trim()
  ) {
    return log.userName.trim();
  }

  if (
    log.user &&
    log.user !== "SYSTEM"
  ) {
    return log.user;
  }

  return "System";
}

function getDisplayEmail(log: AuditLog) {
  if (
    log.userEmail &&
    log.userEmail.trim()
  ) {
    return log.userEmail.trim();
  }

  if (
    log.user &&
    log.user.includes("@")
  ) {
    return log.user;
  }

  return "System activity";
}

function getInitials(value: string) {
  if (
    !value ||
    value === "System"
  ) {
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

/* =========================================================
   ACTION STYLING
========================================================= */

function getActionClasses(action: string) {
  switch (
    action.toUpperCase()
  ) {
    case "CREATE":
    case "CREATED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";

    case "APPROVE":
    case "APPROVED":
      return "bg-green-50 text-green-700 border-green-200";

    case "POST":
    case "POSTED":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";

    case "UPDATE":
    case "UPDATED":
      return "bg-blue-50 text-blue-700 border-blue-200";

    case "SUBMIT":
    case "SUBMITTED":
    case "SUBMITTED_FOR_APPROVAL":
      return "bg-amber-50 text-amber-700 border-amber-200";

    case "DELETE":
    case "DELETED":
    case "REJECT":
    case "REJECTED":
    case "REVERSE":
    case "REVERSED":
      return "bg-red-50 text-red-700 border-red-200";

    case "LOGIN":
      return "bg-cyan-50 text-cyan-700 border-cyan-200";

    case "LOGOUT":
      return "bg-slate-50 text-slate-700 border-slate-200";

    case "PAYMENT":
    case "PAID":
      return "bg-violet-50 text-violet-700 border-violet-200";

    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
}

function getActionDot(action: string) {
  switch (
    action.toUpperCase()
  ) {
    case "CREATE":
    case "CREATED":
    case "APPROVE":
    case "APPROVED":
      return "bg-emerald-500";

    case "POST":
    case "POSTED":
      return "bg-indigo-500";

    case "UPDATE":
    case "UPDATED":
      return "bg-blue-500";

    case "SUBMIT":
    case "SUBMITTED":
    case "SUBMITTED_FOR_APPROVAL":
      return "bg-amber-500";

    case "DELETE":
    case "DELETED":
    case "REJECT":
    case "REJECTED":
    case "REVERSE":
    case "REVERSED":
      return "bg-red-500";

    case "PAYMENT":
    case "PAID":
      return "bg-violet-500";

    case "LOGIN":
      return "bg-cyan-500";

    default:
      return "bg-slate-400";
  }
}

/* =========================================================
   DATE QUERY BUILDER
========================================================= */

function getDateQuery(
  range: string
) {
  if (!range) {
    return {};
  }

  const now = new Date();

  const start = new Date(now);
  const end = new Date(now);

  end.setHours(
    23,
    59,
    59,
    999
  );

  if (range === "today") {
    start.setHours(
      0,
      0,
      0,
      0
    );
  }

  if (range === "7d") {
    start.setDate(
      start.getDate() - 6
    );

    start.setHours(
      0,
      0,
      0,
      0
    );
  }

  if (range === "30d") {
    start.setDate(
      start.getDate() - 29
    );

    start.setHours(
      0,
      0,
      0,
      0
    );
  }

  if (range === "90d") {
    start.setDate(
      start.getDate() - 89
    );

    start.setHours(
      0,
      0,
      0,
      0
    );
  }

  return {
    startDate:
      start
        .toISOString(),
    endDate:
      end
        .toISOString(),
  };
}

/* =========================================================
   ICONS
========================================================= */

function ShieldIcon() {
  return (
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
  );
}

function SearchIcon() {
  return (
    <svg
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
  );
}

function RefreshIcon({
  loading,
}: {
  loading: boolean;
}) {
  return (
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
  );
}

function ActivityIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M4 5h16M4 12h16M4 19h16" />
      <circle
        cx="7"
        cy="5"
        r="1"
      />
      <circle
        cx="7"
        cy="12"
        r="1"
      />
      <circle
        cx="7"
        cy="19"
        r="1"
      />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle
        cx="9"
        cy="8"
        r="3"
      />
      <path d="M3 20c.8-3.5 2.8-5 6-5s5.2 1.5 6 5" />
      <path d="M16 5.5a3 3 0 0 1 0 5.8M18 15c1.8.7 2.9 2.2 3 5" />
    </svg>
  );
}

function ModuleIcon() {
  return (
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
  );
}

function EyeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
      <circle
        cx="12"
        cy="12"
        r="2.5"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
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
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/* =========================================================
   COMPONENT
========================================================= */

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

  const [totals, setTotals] =
    useState({
      auditEvents: 0,
      users: 0,
      modules: 0,
    });

  const [pagination, setPagination] =
    useState({
      page: 1,
      pageSize: 25,
      total: 0,
      totalPages: 0,
      hasPreviousPage: false,
      hasNextPage: false,
    });

  const [selectedLog, setSelectedLog] =
    useState<AuditLog | null>(null);

  /* =======================================================
     LOAD AUDIT TRAILS
  ======================================================= */

  const loadAuditTrails =
    useCallback(
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

          if (
            search.trim()
          ) {
            params.set(
              "search",
              search.trim()
            );
          }

          if (
            moduleFilter
          ) {
            params.set(
              "module",
              moduleFilter
            );
          }

          if (
            actionFilter
          ) {
            params.set(
              "action",
              actionFilter
            );
          }

          if (
            userFilter.trim()
          ) {
            params.set(
              "user",
              userFilter.trim()
            );
          }

          /*
           * Convert UI date ranges into
           * actual startDate/endDate values.
           */
          const dateQuery =
            getDateQuery(
              dateFilter
            );

          if (
            dateQuery.startDate
          ) {
            params.set(
              "startDate",
              dateQuery.startDate
            );
          }

          if (
            dateQuery.endDate
          ) {
            params.set(
              "endDate",
              dateQuery.endDate
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
            !Array.isArray(
              payload.data
            )
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
                ?.auditEvents ??
              0,

            users:
              payload.totals
                ?.users ??
              0,

            modules:
              payload.totals
                ?.modules ??
              0,
          });

          const totalPages =
            payload.pagination
              ?.totalPages ??
            0;

          setPagination({
            page:
              payload.pagination
                ?.page ??
              page,

            pageSize:
              payload.pagination
                ?.pageSize ??
              pageSize,

            total:
              payload.pagination
                ?.total ??
              0,

            totalPages,

            hasPreviousPage:
              payload.pagination
                ?.hasPreviousPage ??
              page > 1,

            hasNextPage:
              payload.pagination
                ?.hasNextPage ??
              page <
                totalPages,
          });

          /*
           * If a filter causes the current
           * page to disappear, move back to
           * the last available page.
           */
          if (
            totalPages > 0 &&
            page > totalPages
          ) {
            setPage(
              totalPages
            );
          }

          if (
            totalPages === 0 &&
            page !== 1
          ) {
            setPage(1);
          }
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
      },
      [
        page,
        pageSize,
        search,
        moduleFilter,
        actionFilter,
        userFilter,
        dateFilter,
      ]
    );

  /* =======================================================
     LOAD EFFECT
  ======================================================= */

  useEffect(() => {
    const timer =
      window.setTimeout(() => {
        void loadAuditTrails();
      }, 300);

    return () =>
      window.clearTimeout(
        timer
      );
  }, [loadAuditTrails]);

  /* =======================================================
     MODULE OPTIONS
  ======================================================= */

  const availableModules =
    useMemo(() => {
      const fromRecords =
        auditLogs
          .map(
            (log) =>
              log.module
          )
          .filter(Boolean);

      return Array.from(
        new Set([
          ...MODULES,
          ...fromRecords,
        ])
      ).sort();
    }, [auditLogs]);

  /* =======================================================
     FILTER STATE
  ======================================================= */

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

  /* =======================================================
     PAGINATION
  ======================================================= */

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

  /* =======================================================
     SELECTED USER
  ======================================================= */

  const selectedUserName =
    selectedLog
      ? getDisplayName(
          selectedLog
        )
      : "";

  const selectedUserEmail =
    selectedLog
      ? getDisplayEmail(
          selectedLog
        )
      : "";

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="min-h-full bg-[#F7F8FC]">
      <div className="mx-auto max-w-[1800px] space-y-6">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#20243A] text-white shadow-sm">
              <ShieldIcon />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-[#20243A] sm:text-3xl">
                  Audit Trails
                </h1>

                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Live
                </span>
              </div>

              <p className="mt-1 text-sm text-[#70758A]">
                Complete record of activity across
                your organization.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadAuditTrails()
            }
            disabled={loading}
            className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-xl bg-[#20243A] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2B304A] disabled:cursor-not-allowed disabled:opacity-60 xl:self-auto"
          >
            <RefreshIcon
              loading={loading}
            />

            {loading
              ? "Refreshing..."
              : "Refresh activity"}
          </button>
        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-sm font-bold text-red-600">
                !
              </div>

              <div>
                <p className="text-sm font-semibold text-red-700">
                  Unable to load audit activity
                </p>

                <p className="mt-0.5 text-xs text-red-600">
                  {error}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadAuditTrails()
              }
              className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        )}

        {/* =================================================
            SUMMARY CARDS
        ================================================= */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

          {/* Total events */}

          <div className="rounded-2xl border border-[#E8EAF0] bg-white p-5 shadow-[0_2px_8px_rgba(32,36,58,0.03)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#8A8FA1]">
                  Total activities
                </p>

                <p className="mt-2 text-3xl font-bold tracking-tight text-[#20243A]">
                  {loading
                    ? "—"
                    : totals.auditEvents.toLocaleString()}
                </p>

                <p className="mt-2 text-xs text-[#9A9EAE]">
                  Recorded system events
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F1F2F7] text-[#20243A]">
                <ActivityIcon />
              </div>
            </div>
          </div>

          {/* Users */}

          <div className="rounded-2xl border border-[#E8EAF0] bg-white p-5 shadow-[0_2px_8px_rgba(32,36,58,0.03)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#8A8FA1]">
                  Active users
                </p>

                <p className="mt-2 text-3xl font-bold tracking-tight text-[#20243A]">
                  {loading
                    ? "—"
                    : totals.users.toLocaleString()}
                </p>

                <p className="mt-2 text-xs text-[#9A9EAE]">
                  Users with recorded activity
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <UsersIcon />
              </div>
            </div>
          </div>

          {/* Modules */}

          <div className="rounded-2xl border border-[#E8EAF0] bg-white p-5 shadow-[0_2px_8px_rgba(32,36,58,0.03)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#8A8FA1]">
                  Modules tracked
                </p>

                <p className="mt-2 text-3xl font-bold tracking-tight text-[#20243A]">
                  {loading
                    ? "—"
                    : totals.modules.toLocaleString()}
                </p>

                <p className="mt-2 text-xs text-[#9A9EAE]">
                  Modules generating audit events
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <ModuleIcon />
              </div>
            </div>
          </div>

          {/* Integrity */}

          <div className="rounded-2xl border border-[#E8EAF0] bg-white p-5 shadow-[0_2px_8px_rgba(32,36,58,0.03)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#8A8FA1]">
                  Audit service
                </p>

                <p
                  className={`mt-2 text-2xl font-bold tracking-tight ${
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
                </p>

                <p className="mt-2 text-xs text-[#9A9EAE]">
                  Organization audit service
                </p>
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
          </div>
        </div>

        {/* =================================================
            FILTER WORKSPACE
        ================================================= */}

        <section className="overflow-hidden rounded-2xl border border-[#E8EAF0] bg-white shadow-[0_2px_8px_rgba(32,36,58,0.03)]">

          <div className="flex flex-col gap-4 border-b border-[#EEF0F4] px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-6">
            <div>
              <h2 className="text-base font-bold text-[#20243A]">
                Activity explorer
              </h2>

              <p className="mt-1 text-sm text-[#73788D]">
                Find exactly what happened, who did it,
                and when it happened.
              </p>
            </div>

            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-[#E1E3EA] bg-white px-3.5 text-xs font-semibold text-[#555A70] transition hover:bg-[#F7F8FA]"
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="p-5 lg:p-6">

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">

              {/* Search */}

              <div className="xl:col-span-4">
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#73788D]">
                  Search activity
                </label>

                <div className="relative">
                  <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A9EAE]">
                    <SearchIcon />
                  </div>

                  <input
                    type="text"
                    value={search}
                    onChange={(event) => {
                      setSearch(
                        event.target.value
                      );
                      setPage(1);
                    }}
                    placeholder="Search action, module, details or user..."
                    className="h-11 w-full rounded-xl border border-[#E1E3EA] bg-[#FBFBFD] pl-10 pr-4 text-sm text-[#20243A] outline-none transition placeholder:text-[#A0A4B2] focus:border-[#B9A15A] focus:bg-white focus:ring-2 focus:ring-[#B9A15A]/10"
                  />
                </div>
              </div>

              {/* Module */}

              <div className="xl:col-span-2">
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#73788D]">
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

                  {availableModules.map(
                    (module) => (
                      <option
                        key={module}
                        value={module}
                      >
                        {humanize(module)}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* Action */}

              <div className="xl:col-span-2">
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#73788D]">
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
                        {humanize(action)}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* User */}

              <div className="xl:col-span-2">
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#73788D]">
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
                  placeholder="Name or email..."
                  className="h-11 w-full rounded-xl border border-[#E1E3EA] bg-[#FBFBFD] px-3.5 text-sm text-[#20243A] outline-none transition placeholder:text-[#A0A4B2] focus:border-[#B9A15A] focus:bg-white focus:ring-2 focus:ring-[#B9A15A]/10"
                />
              </div>

              {/* Date */}

              <div className="xl:col-span-2">
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#73788D]">
                  Date range
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
              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[#EEF0F4] pt-4">

                <span className="text-xs font-semibold text-[#73788D]">
                  Active filters:
                </span>

                {search.trim() && (
                  <span className="rounded-full bg-[#F1F2F7] px-3 py-1 text-[11px] font-semibold text-[#555A70]">
                    Search: {search.trim()}
                  </span>
                )}

                {moduleFilter && (
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700">
                    Module: {humanize(moduleFilter)}
                  </span>
                )}

                {actionFilter && (
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">
                    Action: {humanize(actionFilter)}
                  </span>
                )}

                {userFilter.trim() && (
                  <span className="rounded-full bg-violet-50 px-3 py-1 text-[11px] font-semibold text-violet-700">
                    User: {userFilter.trim()}
                  </span>
                )}

                {dateFilter && (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                    {
                      DATE_RANGES.find(
                        (item) =>
                          item.value ===
                          dateFilter
                      )?.label
                    }
                  </span>
                )}
              </div>
            )}
          </div>
        </section>

        {/* =================================================
            AUDIT TABLE
        ================================================= */}

        <section className="overflow-hidden rounded-2xl border border-[#E8EAF0] bg-white shadow-[0_2px_8px_rgba(32,36,58,0.03)]">

          {/* Table header */}

          <div className="flex flex-col gap-3 border-b border-[#EEF0F4] px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-base font-bold text-[#20243A]">
                  Audit activity
                </h2>

                {!loading && (
                  <span className="rounded-full bg-[#F1F2F7] px-2.5 py-1 text-[10px] font-bold text-[#666B84]">
                    {pagination.total.toLocaleString()}
                  </span>
                )}
              </div>

              <p className="mt-1 text-xs text-[#8A8FA1]">
                Every recorded event is tied to an
                organization and user.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-[#8A8FA1]">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Tenant activity
            </div>
          </div>

          {/* Table */}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1150px]">
              <thead>
                <tr className="border-b border-[#EEF0F4] bg-[#FBFBFD]">
                  <th className="w-[170px] px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-[#7B8092]">
                    Date & time
                  </th>

                  <th className="w-[260px] px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-[#7B8092]">
                    User
                  </th>

                  <th className="w-[180px] px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-[#7B8092]">
                    Action
                  </th>

                  <th className="w-[180px] px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-[#7B8092]">
                    Module
                  </th>

                  <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-[#7B8092]">
                    Activity
                  </th>

                  <th className="w-[120px] px-6 py-4 text-right text-[10px] font-bold uppercase tracking-[0.1em] text-[#7B8092]">
                    Details
                  </th>
                </tr>
              </thead>

              <tbody>
                {/* Loading */}

                {loading && (
                  <>
                    {Array.from({
                      length: 7,
                    }).map(
                      (_, index) => (
                        <tr
                          key={index}
                          className="border-b border-[#F0F1F5]"
                        >
                          <td
                            colSpan={6}
                            className="px-6 py-4"
                          >
                            <div className="flex animate-pulse items-center gap-4">
                              <div className="h-10 w-10 rounded-xl bg-[#F0F1F5]" />

                              <div className="h-3 w-full max-w-[900px] rounded bg-[#F0F1F5]" />
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </>
                )}

                {/* Empty */}

                {!loading &&
                  !error &&
                  auditLogs.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-20"
                      >
                        <div className="mx-auto flex max-w-md flex-col items-center text-center">
                          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F1F2F7] text-[#8A8FA1]">
                            <ActivityIcon />
                          </div>

                          <h3 className="mt-5 text-base font-bold text-[#20243A]">
                            No audit activity found
                          </h3>

                          <p className="mt-2 text-sm leading-6 text-[#7B8092]">
                            There are no audit records matching
                            your current filters.
                          </p>

                          {hasFilters && (
                            <button
                              type="button"
                              onClick={
                                clearFilters
                              }
                              className="mt-5 rounded-lg bg-[#20243A] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#2B304A]"
                            >
                              Clear filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}

                {/* Data */}

                {!loading &&
                  auditLogs.map(
                    (log) => {
                      const displayName =
                        getDisplayName(
                          log
                        );

                      const displayEmail =
                        getDisplayEmail(
                          log
                        );

                      const summary =
                        log.summary ||
                        log.details ||
                        "No activity description recorded.";

                      return (
                        <tr
                          key={log.id}
                          className="group border-b border-[#F0F1F5] transition last:border-b-0 hover:bg-[#FCFCFE]"
                        >
                          {/* Date */}

                          <td className="px-6 py-4 align-middle">
                            <div>
                              <p className="whitespace-nowrap text-sm font-semibold text-[#20243A]">
                                {formatDate(
                                  log.date
                                )}
                              </p>

                              <p className="mt-1 whitespace-nowrap text-xs font-medium text-[#8A8FA1]">
                                {formatTime(
                                  log.date
                                )}
                              </p>
                            </div>
                          </td>

                          {/* User */}

                          <td className="px-6 py-4 align-middle">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ECEEF4] text-[11px] font-bold text-[#4E536A]">
                                {getInitials(
                                  displayName
                                )}
                              </div>

                              <div className="min-w-0">
                                <p
                                  className="truncate text-sm font-semibold text-[#20243A]"
                                  title={
                                    displayName
                                  }
                                >
                                  {displayName}
                                </p>

                                <p
                                  className="mt-0.5 truncate text-xs text-[#8A8FA1]"
                                  title={
                                    displayEmail
                                  }
                                >
                                  {displayEmail}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Action */}

                          <td className="px-6 py-4 align-middle">
                            <div className="flex items-center gap-2">
                              <span
                                className={`h-2 w-2 shrink-0 rounded-full ${getActionDot(
                                  log.action
                                )}`}
                              />

                              <span
                                className={`inline-flex whitespace-nowrap rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${getActionClasses(
                                  log.action
                                )}`}
                              >
                                {humanize(
                                  log.action
                                )}
                              </span>
                            </div>
                          </td>

                          {/* Module */}

                          <td className="px-6 py-4 align-middle">
                            <span
                              className="inline-flex max-w-[160px] truncate rounded-lg border border-[#E7E8EE] bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#555A70]"
                              title={
                                humanize(
                                  log.module
                                )
                              }
                            >
                              {humanize(
                                log.module
                              )}
                            </span>
                          </td>

                          {/* Activity */}

                          <td className="max-w-[520px] px-6 py-4 align-middle">
                            <p
                              className="line-clamp-2 text-sm font-medium leading-5 text-[#4F556B]"
                              title={
                                summary
                              }
                            >
                              {summary}
                            </p>
                          </td>

                          {/* View */}

                          <td className="px-6 py-4 text-right align-middle">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedLog(
                                  log
                                )
                              }
                              className="inline-flex h-9 w-[82px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#E1E3EA] bg-white px-3 text-xs font-bold text-[#20243A] shadow-sm transition hover:border-[#C9CBD5] hover:bg-[#F7F8FA]"
                            >
                              <EyeIcon />
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    }
                  )}
              </tbody>
            </table>
          </div>

          {/* =================================================
              PAGINATION
          ================================================= */}

          <div className="flex flex-col gap-4 border-t border-[#EEF0F4] bg-[#FCFCFD] px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">

            <div className="flex flex-wrap items-center gap-3 text-xs text-[#73788D]">
              <span>
                Showing{" "}
                <strong className="font-semibold text-[#20243A]">
                  {startRecord}
                </strong>{" "}
                –{" "}
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
                  !pagination.hasPreviousPage ||
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
                className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-[#E1E3EA] bg-white px-3 text-xs font-semibold text-[#555A70] transition hover:bg-[#F5F6F9] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeftIcon />
                Previous
              </button>

              <div className="flex h-9 min-w-[110px] items-center justify-center rounded-lg border border-[#E1E3EA] bg-white px-3 text-xs font-semibold text-[#555A70]">
                Page{" "}
                <span className="mx-1 font-bold text-[#20243A]">
                  {pagination.page}
                </span>
                of{" "}
                <span className="ml-1 font-bold text-[#20243A]">
                  {pagination.totalPages ||
                    0}
                </span>
              </div>

              <button
                type="button"
                disabled={
                  !pagination.hasNextPage ||
                  loading
                }
                onClick={() =>
                  setPage(
                    (current) =>
                      current + 1
                  )
                }
                className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-[#E1E3EA] bg-white px-3 text-xs font-semibold text-[#555A70] transition hover:bg-[#F5F6F9] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRightIcon />
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* ===================================================
          DETAIL DRAWER
      =================================================== */}

      {selectedLog && (
        <div className="fixed inset-0 z-50">

          {/* Backdrop */}

          <button
            type="button"
            aria-label="Close audit event details"
            onClick={() =>
              setSelectedLog(null)
            }
            className="absolute inset-0 bg-[#101321]/45 backdrop-blur-[2px]"
          />

          {/* Drawer */}

          <aside className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">

            {/* Drawer header */}

            <div className="flex items-center justify-between border-b border-[#ECEEF3] px-6 py-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8A8FA1]">
                  Audit event
                </p>

                <h2 className="mt-1 text-xl font-bold text-[#20243A]">
                  Activity details
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedLog(
                    null
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E1E3EA] text-[#666B84] transition hover:bg-[#F7F8FA] hover:text-[#20243A]"
                aria-label="Close audit event"
              >
                <CloseIcon />
              </button>
            </div>

            {/* Drawer body */}

            <div className="flex-1 overflow-y-auto p-6">

              {/* User */}

              <div className="rounded-2xl border border-[#E8EAF0] bg-[#FAFAFC] p-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#20243A] text-sm font-bold text-white">
                    {getInitials(
                      selectedUserName
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="text-base font-bold text-[#20243A]">
                      {selectedUserName}
                    </p>

                    <p className="mt-0.5 truncate text-sm text-[#73788D]">
                      {selectedUserEmail}
                    </p>

                    <p className="mt-1 text-xs text-[#979BAB]">
                      {formatDateTime(
                        selectedLog.date
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Activity summary */}

              <div className="mt-5 rounded-2xl border border-[#E8EAF0] bg-white p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#979BAB]">
                  What happened
                </p>

                <p className="mt-3 text-base font-semibold leading-6 text-[#20243A]">
                  {selectedLog.summary ||
                    selectedLog.details ||
                    "No activity description recorded."}
                </p>
              </div>

              {/* Metadata */}

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">

                <div className="rounded-xl border border-[#ECEEF3] bg-white p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#979BAB]">
                    Action
                  </p>

                  <span
                    className={`mt-3 inline-flex rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${getActionClasses(
                      selectedLog.action
                    )}`}
                  >
                    {humanize(
                      selectedLog.action
                    )}
                  </span>
                </div>

                <div className="rounded-xl border border-[#ECEEF3] bg-white p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#979BAB]">
                    Module
                  </p>

                  <p className="mt-3 text-sm font-bold uppercase tracking-wide text-[#20243A]">
                    {humanize(
                      selectedLog.module
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-[#ECEEF3] bg-white p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#979BAB]">
                    Date
                  </p>

                  <p className="mt-3 text-sm font-semibold text-[#20243A]">
                    {formatDate(
                      selectedLog.date
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-[#ECEEF3] bg-white p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#979BAB]">
                    Time
                  </p>

                  <p className="mt-3 text-sm font-semibold text-[#20243A]">
                    {formatTime(
                      selectedLog.date
                    )}
                  </p>
                </div>
              </div>

              {/* User identity */}

              <div className="mt-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#979BAB]">
                  User identity
                </p>

                <div className="mt-2 rounded-xl border border-[#ECEEF3] bg-[#FAFAFC] p-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-[#979BAB]">
                        Name
                      </p>

                      <p className="mt-1 break-words text-sm font-semibold text-[#20243A]">
                        {selectedUserName}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-[#979BAB]">
                        Email
                      </p>

                      <p className="mt-1 break-words text-sm font-semibold text-[#20243A]">
                        {selectedUserEmail}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Audit ID */}

              <div className="mt-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#979BAB]">
                  Audit ID
                </p>

                <div className="mt-2 break-all rounded-xl border border-[#ECEEF3] bg-[#FAFAFC] p-3 font-mono text-xs leading-5 text-[#666B84]">
                  {selectedLog.id}
                </div>
              </div>

              {/* User ID */}

              {selectedLog.userId && (
                <div className="mt-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#979BAB]">
                    User ID
                  </p>

                  <div className="mt-2 break-all rounded-xl border border-[#ECEEF3] bg-[#FAFAFC] p-3 font-mono text-xs leading-5 text-[#666B84]">
                    {selectedLog.userId}
                  </div>
                </div>
              )}

              {/* Raw details */}

              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#979BAB]">
                    Recorded details
                  </p>

                  <span className="text-[10px] font-medium text-[#A0A4B2]">
                    Original audit payload
                  </span>
                </div>

                <pre className="mt-2 max-h-[500px] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-[#ECEEF3] bg-[#FAFAFC] p-4 font-mono text-xs leading-6 text-[#30354A]">
                  {formatDetails(
                    selectedLog.details
                  )}
                </pre>
              </div>
            </div>

            {/* Drawer footer */}

            <div className="border-t border-[#ECEEF3] bg-white px-6 py-4">
              <button
                type="button"
                onClick={() =>
                  setSelectedLog(
                    null
                  )
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
  );
}


