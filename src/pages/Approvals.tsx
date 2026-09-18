import { useEffect, useMemo, useState } from "react";
import { authenticatedFetch } from "../lib/auth";

type Approval = {
  id: string;
  module: string;
  description: string;
  amount: number;
  requestedBy: string;
  requestedByUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
  actionedBy?: string | null;
  actionedAt?: string | null;
  actionedByUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
  status: string;
  createdAt?: string;
};

type ApiResponse = {
  success?: boolean;
  data?: Approval[];
  approvals?: Approval[];
  approval?: Approval;
  message?: string;
};

const PAGE_SIZE = 10;

const normalizeStatus = (status?: string) =>
  (status || "UNKNOWN").toUpperCase().replace(/\s+/g, "_");

const formatStatus = (status?: string) => {
  const value = normalizeStatus(status);

  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const formatModule = (module?: string) => {
  if (!module) return "Unknown";

  return module
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const formatAmount = (amount: number) =>
  `KES ${Number(amount || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (date?: string) => {
  if (!date) return "â€”";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "â€”";
  }

  return parsed.toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (date?: string) => {
  if (!date) return "â€”";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "â€”";
  }

  return parsed.toLocaleString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getStatusClass = (status?: string) => {
  switch (normalizeStatus(status)) {
    case "APPROVED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "REJECTED":
      return "border-red-200 bg-red-50 text-red-700";

    case "PENDING":
    case "PENDING_APPROVAL":
      return "border-amber-200 bg-amber-50 text-amber-700";

    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
};

const getModuleClass = (module?: string) => {
  const value = (module || "").toUpperCase();

  if (value.includes("EXPENSE")) {
    return "bg-teal-50 text-teal-700";
  }

  if (value.includes("PROCUREMENT")) {
    return "bg-indigo-50 text-indigo-700";
  }

  if (value.includes("PAYMENT")) {
    return "bg-blue-50 text-blue-700";
  }

  return "bg-slate-50 text-slate-600";
};

export default function Approvals() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [moduleFilter, setModuleFilter] = useState("ALL");

  const [currentPage, setCurrentPage] = useState(1);

  const [selectedApproval, setSelectedApproval] =
    useState<Approval | null>(null);

  const [actionLoading, setActionLoading] = useState<
    string | null
  >(null);

  const [actionError, setActionError] = useState("");

  /* =========================================================
     LOAD APPROVALS
  ========================================================= */

  const loadApprovals = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await authenticatedFetch(
        "/api/approvals"
      );

      const payload =
        (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(
          payload.message ||
            "Failed to load approvals."
        );
      }

      const records = Array.isArray(payload.data)
        ? payload.data
        : Array.isArray(payload.approvals)
        ? payload.approvals
        : [];

      setApprovals(records);
    } catch (err) {
      console.error(
        "APPROVALS LOAD ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load approvals."
      );

      setApprovals([]);
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     INITIAL LOAD
  ========================================================= */

  useEffect(() => {
    void loadApprovals();
  }, []);

  /* =========================================================
     MODULES
  ========================================================= */

  const modules = useMemo(() => {
    const values = approvals
      .map((approval) => approval.module)
      .filter(Boolean);

    return Array.from(new Set(values)).sort();
  }, [approvals]);

  /* =========================================================
     SUMMARY
  ========================================================= */

  const summary = useMemo(() => {
    const pending = approvals.filter((approval) => {
      const status = normalizeStatus(approval.status);

      return (
        status === "PENDING" ||
        status === "PENDING_APPROVAL"
      );
    }).length;

    const approved = approvals.filter(
      (approval) =>
        normalizeStatus(approval.status) === "APPROVED"
    ).length;

    const rejected = approvals.filter(
      (approval) =>
        normalizeStatus(approval.status) === "REJECTED"
    ).length;

    const pendingAmount = approvals
      .filter((approval) => {
        const status = normalizeStatus(
          approval.status
        );

        return (
          status === "PENDING" ||
          status === "PENDING_APPROVAL"
        );
      })
      .reduce(
        (total, approval) =>
          total + Number(approval.amount || 0),
        0
      );

    return {
      total: approvals.length,
      pending,
      approved,
      rejected,
      pendingAmount,
    };
  }, [approvals]);

  /* =========================================================
     FILTERING
  ========================================================= */

  const filteredApprovals = useMemo(() => {
    const query = search.trim().toLowerCase();

    return approvals.filter((approval) => {
      const status = normalizeStatus(
        approval.status
      );

      const matchesStatus =
        statusFilter === "ALL" ||
        status === statusFilter;

      const matchesModule =
        moduleFilter === "ALL" ||
        approval.module === moduleFilter;

      const matchesSearch =
        !query ||
        approval.id
          .toLowerCase()
          .includes(query) ||
        approval.module
          .toLowerCase()
          .includes(query) ||
        approval.description
          .toLowerCase()
          .includes(query) ||
        approval.requestedBy
          .toLowerCase()
          .includes(query);

      return (
        matchesStatus &&
        matchesModule &&
        matchesSearch
      );
    });
  }, [
    approvals,
    search,
    statusFilter,
    moduleFilter,
  ]);

  /* =========================================================
     PAGINATION
  ========================================================= */

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredApprovals.length / PAGE_SIZE
    )
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedApprovals = useMemo(() => {
    const start =
      (currentPage - 1) * PAGE_SIZE;

    return filteredApprovals.slice(
      start,
      start + PAGE_SIZE
    );
  }, [filteredApprovals, currentPage]);

  const startRecord =
    filteredApprovals.length === 0
      ? 0
      : (currentPage - 1) * PAGE_SIZE + 1;

  const endRecord = Math.min(
    currentPage * PAGE_SIZE,
    filteredApprovals.length
  );

  const goToPage = (page: number) => {
    setCurrentPage(
      Math.min(
        Math.max(page, 1),
        totalPages
      )
    );
  };

  /* =========================================================
     FILTER RESET
  ========================================================= */

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setModuleFilter("ALL");
    setCurrentPage(1);
  };

  /* =========================================================
     APPROVE / REJECT
  ========================================================= */

  const processApproval = async (
    approval: Approval,
    action: "approve" | "reject"
  ) => {
    try {
      setActionLoading(approval.id);
      setActionError("");

      const response =
        await authenticatedFetch(
          `/api/approvals/${approval.id}/${action}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
          }
        );

      const payload =
        (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(
          payload.message ||
            `Failed to ${action} approval.`
        );
      }

      setSelectedApproval(null);

      /*
       * Reload from the server rather than only
       * changing the local status. This keeps the
       * Approvals page synchronized with the
       * Expense / Payment / Procurement workflow.
       */
      await loadApprovals();
    } catch (err) {
      console.error(
        `${action.toUpperCase()} APPROVAL ERROR:`,
        err
      );

      setActionError(
        err instanceof Error
          ? err.message
          : `Failed to ${action} approval.`
      );
    } finally {
      setActionLoading(null);
    }
  };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="space-y-5">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#20243A]">
            Approvals
          </h1>

          <p className="mt-1 text-sm text-[#666B84]">
            Review and authorize financial requests
            across the FOS.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadApprovals()}
          disabled={loading}
          className="inline-flex h-8 items-center justify-center gap-1.5 self-start rounded-lg border border-[#DFE2E8] bg-white px-3 text-xs font-medium text-[#4F556B] transition hover:border-[#0D9488] hover:text-[#0D9488] disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-3.5 w-3.5"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          Refresh
        </button>
      </div>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-600">
            {error}
          </p>

          <button
            type="button"
            onClick={() => void loadApprovals()}
            className="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            Retry
          </button>
        </div>
      )}

      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-[#ECECF3] bg-white px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#858B9D]">
            Total Requests
          </p>

          <p className="mt-1 text-xl font-semibold text-[#20243A]">
            {summary.total}
          </p>

          <p className="mt-0.5 text-[11px] text-[#858B9D]">
            All approval records
          </p>
        </div>

        <div className="rounded-xl border border-amber-100 bg-white px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#858B9D]">
            Pending
          </p>

          <p className="mt-1 text-xl font-semibold text-amber-700">
            {summary.pending}
          </p>

          <p className="mt-0.5 text-[11px] text-[#858B9D]">
            Awaiting authorization
          </p>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-white px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#858B9D]">
            Approved
          </p>

          <p className="mt-1 text-xl font-semibold text-emerald-700">
            {summary.approved}
          </p>

          <p className="mt-0.5 text-[11px] text-[#858B9D]">
            Completed approvals
          </p>
        </div>

        <div className="rounded-xl border border-[#ECECF3] bg-white px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#858B9D]">
            Pending Value
          </p>

          <p className="mt-1 truncate text-lg font-semibold text-[#20243A]">
            {formatAmount(
              summary.pendingAmount
            )}
          </p>

          <p className="mt-0.5 text-[11px] text-[#858B9D]">
            Requests awaiting review
          </p>
        </div>
      </div>

      {/* =====================================================
          WORKSPACE
      ===================================================== */}

      <div className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white">
        {/* ===================================================
            TOOLBAR
        =================================================== */}

        <div className="border-b border-[#ECECF3] px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            {/* SEARCH */}

            <div className="relative min-w-0 flex-1">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9AA0B1]"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle
                  cx="11"
                  cy="11"
                  r="7"
                />
                <path
                  d="m20 20-4-4"
                  strokeLinecap="round"
                />
              </svg>

              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search approvals..."
                className="h-9 w-full rounded-lg border border-[#DFE2E8] bg-white pl-9 pr-3 text-xs text-[#20243A] outline-none transition placeholder:text-[#A0A5B5] focus:border-[#0D9488] focus:ring-4 focus:ring-[#0D9488]/10"
              />
            </div>

            {/* STATUS */}

            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(
                  event.target.value
                );
                setCurrentPage(1);
              }}
              className="h-9 rounded-lg border border-[#DFE2E8] bg-white px-3 text-xs text-[#4F556B] outline-none focus:border-[#0D9488]"
            >
              <option value="ALL">
                All statuses
              </option>
              <option value="PENDING">
                Pending
              </option>
              <option value="APPROVED">
                Approved
              </option>
              <option value="REJECTED">
                Rejected
              </option>
            </select>

            {/* MODULE */}

            <select
              value={moduleFilter}
              onChange={(event) => {
                setModuleFilter(
                  event.target.value
                );
                setCurrentPage(1);
              }}
              className="h-9 rounded-lg border border-[#DFE2E8] bg-white px-3 text-xs text-[#4F556B] outline-none focus:border-[#0D9488]"
            >
              <option value="ALL">
                All modules
              </option>

              {modules.map((module) => (
                <option
                  key={module}
                  value={module}
                >
                  {formatModule(module)}
                </option>
              ))}
            </select>

            {(search ||
              statusFilter !== "ALL" ||
              moduleFilter !== "ALL") && (
              <button
                type="button"
                onClick={clearFilters}
                className="h-9 rounded-lg px-3 text-xs font-medium text-[#666B84] transition hover:bg-[#F5F6F8] hover:text-[#20243A]"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* ===================================================
            TABLE TITLE
        =================================================== */}

        <div className="flex items-center justify-between border-b border-[#ECECF3] px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-[#20243A]">
              Approval Queue
            </h2>

            <p className="mt-0.5 text-[11px] text-[#858B9D]">
              Expense, payment and procurement
              authorization workflow
            </p>
          </div>

          <span className="text-[11px] text-[#858B9D]">
            {filteredApprovals.length}{" "}
            {filteredApprovals.length === 1
              ? "record"
              : "records"}
          </span>
        </div>

        {/* ===================================================
            TABLE
        =================================================== */}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead className="border-b border-[#ECECF3] bg-[#FAFAFC]">
              <tr>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[#858B9D]">
                  Request
                </th>

                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[#858B9D]">
                  Module
                </th>

                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[#858B9D]">
                  Description
                </th>

                <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-[#858B9D]">
                  Amount
                </th>

                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[#858B9D]">
                  Requested By
                </th>

                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[#858B9D]">
                  Date
                </th>

                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[#858B9D]">
                  Status
                </th>

                <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-[#858B9D]">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {/* LOADING */}

              {loading &&
                Array.from({ length: 6 }).map(
                  (_, index) => (
                    <tr
                      key={`loading-${index}`}
                      className="border-b border-[#F0F1F5]"
                    >
                      {Array.from({
                        length: 8,
                      }).map(
                        (_, cellIndex) => (
                          <td
                            key={cellIndex}
                            className="px-4 py-3"
                          >
                            <div className="h-3 w-full max-w-[110px] animate-pulse rounded bg-[#EEF0F4]" />
                          </td>
                        )
                      )}
                    </tr>
                  )
                )}

              {/* EMPTY */}

              {!loading &&
                !error &&
                filteredApprovals.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-14 text-center"
                    >
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#F3F5F7]">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          className="h-5 w-5 text-[#858B9D]"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        >
                          <path
                            d="M8 7h8M8 11h5M6 3h12a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2-2-2V5a2 2 0 0 1 2-2Z"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>

                      <p className="mt-3 text-sm font-medium text-[#20243A]">
                        No approval requests
                        found
                      </p>

                      <p className="mt-1 text-xs text-[#858B9D]">
                        Try changing your filters
                        or search criteria.
                      </p>
                    </td>
                  </tr>
                )}

              {/* RECORDS */}

              {!loading &&
                paginatedApprovals.map(
                  (approval) => {
                    const pending =
                      normalizeStatus(
                        approval.status
                      ) === "PENDING" ||
                      normalizeStatus(
                        approval.status
                      ) ===
                        "PENDING_APPROVAL";

                    const busy =
                      actionLoading ===
                      approval.id;

                    return (
                      <tr
                        key={approval.id}
                        className="border-b border-[#F0F1F5] transition hover:bg-[#FAFAFC]"
                      >
                        {/* REQUEST */}

                        <td className="px-4 py-3 align-middle">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedApproval(
                                approval
                              )
                            }
                            className="text-left"
                          >
                            <span className="block max-w-[125px] truncate font-mono text-[11px] font-medium text-[#20243A] hover:text-[#0D9488]">
                              {approval.id}
                            </span>

                            <span className="mt-0.5 block text-[10px] text-[#858B9D]">
                              View details
                            </span>
                          </button>
                        </td>

                        {/* MODULE */}

                        <td className="px-4 py-3 align-middle">
                          <span
                            className={`inline-flex rounded-md px-2 py-1 text-[10px] font-semibold ${getModuleClass(
                              approval.module
                            )}`}
                          >
                            {formatModule(
                              approval.module
                            )}
                          </span>
                        </td>

                        {/* DESCRIPTION */}

                        <td className="max-w-[300px] px-4 py-3 align-middle">
                          <p className="truncate text-xs font-medium text-[#20243A]">
                            {approval.description ||
                              "â€”"}
                          </p>
                        </td>

                        {/* AMOUNT */}

                        <td className="whitespace-nowrap px-4 py-3 text-right align-middle">
                          <span className="text-xs font-semibold tabular-nums text-[#20243A]">
                            {formatAmount(
                              approval.amount
                            )}
                          </span>
                        </td>

                        {/* REQUESTED BY */}

                        <td className="px-4 py-3 align-middle">
                          <span className="text-xs text-[#666B84]">
                            {approval.requestedBy ||
                              "â€”"}
                          </span>
                        </td>

                        {/* DATE */}

                        <td className="whitespace-nowrap px-4 py-3 align-middle">
                          <span className="text-xs text-[#666B84]">
                            {formatDate(
                              approval.createdAt
                            )}
                          </span>
                        </td>

                        {/* STATUS */}

                        <td className="px-4 py-3 align-middle">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${getStatusClass(
                              approval.status
                            )}`}
                          >
                            {formatStatus(
                              approval.status
                            )}
                          </span>
                        </td>

                        {/* ACTION */}

                        <td className="px-4 py-3 text-right align-middle">
                          {pending ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void processApproval(
                                    approval,
                                    "reject"
                                  )
                                }
                                className="h-7 rounded-md border border-red-200 bg-white px-2.5 text-[10px] font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {busy &&
                                actionLoading ===
                                  approval.id
                                  ? "..."
                                  : "Reject"}
                              </button>

                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void processApproval(
                                    approval,
                                    "approve"
                                  )
                                }
                                className="h-7 rounded-md bg-[#0D9488] px-2.5 text-[10px] font-semibold text-white transition hover:bg-[#0B7F75] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {busy &&
                                actionLoading ===
                                  approval.id
                                  ? "..."
                                  : "Approve"}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedApproval(
                                  approval
                                )
                              }
                              className="h-7 rounded-md border border-[#DFE2E8] bg-white px-2.5 text-[10px] font-medium text-[#4F556B] hover:border-[#0D9488] hover:text-[#0D9488]"
                            >
                              View
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  }
                )}
            </tbody>
          </table>
        </div>

        {/* ===================================================
            PAGINATION
        =================================================== */}

        {!loading &&
          filteredApprovals.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-[#ECECF3] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[#858B9D]">
                Showing{" "}
                <span className="font-medium text-[#4F556B]">
                  {startRecord}
                </span>{" "}
                to{" "}
                <span className="font-medium text-[#4F556B]">
                  {endRecord}
                </span>{" "}
                of{" "}
                <span className="font-medium text-[#4F556B]">
                  {filteredApprovals.length}
                </span>
              </p>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    goToPage(
                      currentPage - 1
                    )
                  }
                  disabled={currentPage === 1}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#DFE2E8] bg-white px-2.5 text-xs font-medium text-[#4F556B] hover:border-[#0D9488] hover:text-[#0D9488] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-3.5 w-3.5"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      d="m15 18-6-6 6-6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>

                  Previous
                </button>

                <span className="px-2 text-xs text-[#666B84]">
                  Page{" "}
                  <span className="font-semibold text-[#20243A]">
                    {currentPage}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-[#20243A]">
                    {totalPages}
                  </span>
                </span>

                <button
                  type="button"
                  onClick={() =>
                    goToPage(
                      currentPage + 1
                    )
                  }
                  disabled={
                    currentPage ===
                    totalPages
                  }
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#DFE2E8] bg-white px-2.5 text-xs font-medium text-[#4F556B] hover:border-[#0D9488] hover:text-[#0D9488] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next

                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-3.5 w-3.5"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      d="m9 18 6-6-6-6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}
      </div>

      {/* =====================================================
          APPROVAL DETAIL DRAWER
      ===================================================== */}

      {selectedApproval && (
        <div className="fixed inset-0 z-50">
          {/* BACKDROP */}

          <button
            type="button"
            aria-label="Close approval details"
            onClick={() =>
              setSelectedApproval(null)
            }
            className="absolute inset-0 cursor-default bg-black/20"
          />

          {/* DRAWER */}

          <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            {/* DRAWER HEADER */}

            <div className="flex items-center justify-between border-b border-[#ECECF3] px-5 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#858B9D]">
                  Approval Request
                </p>

                <h2 className="mt-1 text-base font-semibold text-[#20243A]">
                  {selectedApproval.id}
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedApproval(
                    null
                  )
                }
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#858B9D] hover:bg-[#F5F6F8] hover:text-[#20243A]"
                aria-label="Close"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-4 w-4"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    d="M6 6l12 12M18 6 6 18"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {/* DRAWER CONTENT */}

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="space-y-5">
                {/* STATUS */}

                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#858B9D]">
                    Status
                  </span>

                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${getStatusClass(
                      selectedApproval.status
                    )}`}
                  >
                    {formatStatus(
                      selectedApproval.status
                    )}
                  </span>
                </div>

                {/* MODULE */}

                <div className="flex items-center justify-between border-t border-[#F0F1F5] pt-4">
                  <span className="text-xs text-[#858B9D]">
                    Module
                  </span>

                  <span
                    className={`rounded-md px-2 py-1 text-[10px] font-semibold ${getModuleClass(
                      selectedApproval.module
                    )}`}
                  >
                    {formatModule(
                      selectedApproval.module
                    )}
                  </span>
                </div>

                {/* AMOUNT */}

                <div className="rounded-xl border border-[#ECECF3] bg-[#FAFAFC] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#858B9D]">
                    Approval Amount
                  </p>

                  <p className="mt-1 text-2xl font-semibold tracking-tight text-[#20243A]">
                    {formatAmount(
                      selectedApproval.amount
                    )}
                  </p>
                </div>

                {/* DESCRIPTION */}

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#858B9D]">
                    Description
                  </p>

                  <p className="mt-2 rounded-lg border border-[#ECECF3] bg-white p-3 text-sm leading-6 text-[#4F556B]">
                    {selectedApproval.description ||
                      "No description provided."}
                  </p>
                </div>

                {/* APPROVAL AUDIT */}

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-[#ECECF3] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#858B9D]">
                      Requested By
                    </p>

                    <p className="mt-1 text-xs font-medium text-[#20243A]">
                      {selectedApproval.requestedByUser?.name ||
                        selectedApproval.requestedByUser?.email ||
                        selectedApproval.requestedBy ||
                        "—"}
                    </p>
                  </div>

                  <div className="rounded-lg border border-[#ECECF3] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#858B9D]">
                      Requested At
                    </p>

                    <p className="mt-1 text-xs font-medium text-[#20243A]">
                      {formatDateTime(
                        selectedApproval.createdAt
                      )}
                    </p>
                  </div>

                  <div className="rounded-lg border border-[#ECECF3] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#858B9D]">
                      Actioned By
                    </p>

                    <p className="mt-1 text-xs font-medium text-[#20243A]">
                      {selectedApproval.actionedByUser?.name ||
                        selectedApproval.actionedByUser?.email ||
                        selectedApproval.actionedBy ||
                        "Pending action"}
                    </p>
                  </div>

                  <div className="rounded-lg border border-[#ECECF3] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#858B9D]">
                      Actioned At
                    </p>

                    <p className="mt-1 text-xs font-medium text-[#20243A]">
                      {selectedApproval.actionedAt
                        ? formatDateTime(
                            selectedApproval.actionedAt
                          )
                        : "Pending action"}
                    </p>
                  </div>
                </div>
                {/* WORKFLOW CONTEXT */}

                <div className="rounded-lg border border-[#ECECF3] bg-[#FAFAFC] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#858B9D]">
                    Workflow
                  </p>

                  <p className="mt-1 text-xs leading-5 text-[#666B84]">
                    This request is part of the{" "}
                    <span className="font-medium text-[#20243A]">
                      {formatModule(
                        selectedApproval.module
                      )}
                    </span>{" "}
                    approval workflow.
                  </p>
                </div>

                {/* ACTION ERROR */}

                {actionError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                    <p className="text-xs text-red-600">
                      {actionError}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* DRAWER ACTIONS */}

            {(normalizeStatus(
              selectedApproval.status
            ) === "PENDING" ||
              normalizeStatus(
                selectedApproval.status
              ) ===
                "PENDING_APPROVAL") && (
              <div className="border-t border-[#ECECF3] bg-white px-5 py-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={
                      actionLoading ===
                      selectedApproval.id
                    }
                    onClick={() =>
                      void processApproval(
                        selectedApproval,
                        "reject"
                      )
                    }
                    className="flex-1 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Reject Request
                  </button>

                  <button
                    type="button"
                    disabled={
                      actionLoading ===
                      selectedApproval.id
                    }
                    onClick={() =>
                      void processApproval(
                        selectedApproval,
                        "approve"
                      )
                    }
                    className="flex-1 rounded-lg bg-[#0D9488] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#0B7F75] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {actionLoading ===
                    selectedApproval.id
                      ? "Processing..."
                      : "Approve Request"}
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}






