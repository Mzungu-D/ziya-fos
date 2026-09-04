import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Download,
  RefreshCw,
  SlidersHorizontal,
  X,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

import { API_URL } from "../lib/api";
import { authenticatedFetch } from "../lib/auth";

type LedgerEntry = {
  id: string;
  journalId?: string;
  date: string;
  transactionDate?: string;
  reference: string;
  description: string;
  accountId: string;
  accountCode: string;
  account: string;
  debit: number;
  credit: number;
  balance: number;
  status?: string;
};

type Filters = {
  search: string;
  startDate: string;
  endDate: string;
  account: string;
  reference: string;
  status: string;
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function GeneralLedger() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState<Filters>({
    search: "",
    startDate: "",
    endDate: "",
    account: "",
    reference: "",
    status: "",
  });

  const [appliedFilters, setAppliedFilters] = useState<Filters>({
    search: "",
    startDate: "",
    endDate: "",
    account: "",
    reference: "",
    status: "",
  });

  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedEntry, setSelectedEntry] =
    useState<LedgerEntry | null>(null);

  /* =========================================================
     LOAD LEDGER
  ========================================================= */

  const loadLedger = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await authenticatedFetch(
        `${API_URL}/api/ledger`,
        {
          method: "GET",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to load General Ledger"
        );
      }

      setEntries(data.entries || []);
    } catch (error) {
      console.error("LEDGER ERROR:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Unable to load General Ledger"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLedger();
  }, []);

  /* =========================================================
     FILTER OPTIONS
  ========================================================= */

  const accountOptions = useMemo(() => {
    const values = new Map<string, string>();

    entries.forEach((entry) => {
      values.set(
        entry.accountId,
        `${entry.accountCode} — ${entry.account}`
      );
    });

    return Array.from(values.entries()).sort((a, b) =>
      a[1].localeCompare(b[1])
    );
  }, [entries]);

  const referenceOptions = useMemo(() => {
    return Array.from(
      new Set(
        entries
          .map((entry) => entry.reference)
          .filter(Boolean)
      )
    ).sort();
  }, [entries]);

  const statusOptions = useMemo(() => {
    return Array.from(
      new Set(
        entries
          .map((entry) => entry.status)
          .filter(Boolean)
      )
    ).sort();
  }, [entries]);

  /* =========================================================
     FILTER LEDGER
  ========================================================= */

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const query =
        appliedFilters.search.trim().toLowerCase();

      const matchesSearch =
        !query ||
        entry.account
          ?.toLowerCase()
          .includes(query) ||
        entry.accountCode
          ?.toLowerCase()
          .includes(query) ||
        entry.reference
          ?.toLowerCase()
          .includes(query) ||
        entry.description
          ?.toLowerCase()
          .includes(query);

      const entryDate = new Date(entry.date);

      const matchesStartDate =
        !appliedFilters.startDate ||
        entryDate >=
          new Date(
            `${appliedFilters.startDate}T00:00:00`
          );

      const matchesEndDate =
        !appliedFilters.endDate ||
        entryDate <=
          new Date(
            `${appliedFilters.endDate}T23:59:59`
          );

      const matchesAccount =
        !appliedFilters.account ||
        entry.accountId === appliedFilters.account;

      const matchesReference =
        !appliedFilters.reference ||
        entry.reference === appliedFilters.reference;

      const matchesStatus =
        !appliedFilters.status ||
        entry.status === appliedFilters.status;

      return (
        matchesSearch &&
        matchesStartDate &&
        matchesEndDate &&
        matchesAccount &&
        matchesReference &&
        matchesStatus
      );
    });
  }, [entries, appliedFilters]);

  /* =========================================================
     PAGINATION
  ========================================================= */

  const totalPages = Math.max(
    1,
    Math.ceil(filteredEntries.length / pageSize)
  );

  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;

    return filteredEntries.slice(
      start,
      start + pageSize
    );
  }, [filteredEntries, currentPage, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  /* =========================================================
     TOTALS
  ========================================================= */

  const totalDebit = filteredEntries.reduce(
    (total, entry) =>
      total + Number(entry.debit || 0),
    0
  );

  const totalCredit = filteredEntries.reduce(
    (total, entry) =>
      total + Number(entry.credit || 0),
    0
  );

  const balance = totalDebit - totalCredit;

  /* =========================================================
     FORMATTING
  ========================================================= */

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(
      "en-KE",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    );
  };

  const formatCompactNumber = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      maximumFractionDigits: 2,
    }).format(amount);
  };

  /* =========================================================
     FILTER ACTIONS
  ========================================================= */

  const applyFilters = () => {
    setAppliedFilters({ ...filters });
    setCurrentPage(1);
    setSelectedEntries([]);
  };

  const clearFilters = () => {
    const emptyFilters: Filters = {
      search: "",
      startDate: "",
      endDate: "",
      account: "",
      reference: "",
      status: "",
    };

    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setCurrentPage(1);
    setSelectedEntries([]);
  };

  const hasActiveFilters = Object.values(
    appliedFilters
  ).some(Boolean);

  /* =========================================================
     SELECTION
  ========================================================= */

  const allVisibleSelected =
    paginatedEntries.length > 0 &&
    paginatedEntries.every((entry) =>
      selectedEntries.includes(entry.id)
    );

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedEntries((current) =>
        current.filter(
          (id) =>
            !paginatedEntries.some(
              (entry) => entry.id === id
            )
        )
      );
    } else {
      setSelectedEntries((current) => {
        const ids = new Set(current);

        paginatedEntries.forEach((entry) =>
          ids.add(entry.id)
        );

        return Array.from(ids);
      });
    }
  };

  const toggleEntry = (id: string) => {
    setSelectedEntries((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  };

  /* =========================================================
     EXPORT
  ========================================================= */

  const exportLedger = () => {
    if (filteredEntries.length === 0) {
      alert(
        "There are no ledger entries to export."
      );
      return;
    }

    const headers = [
      "Date",
      "Reference",
      "Account Code",
      "Account",
      "Description",
      "Debit",
      "Credit",
      "Balance",
      "Status",
    ];

    const rows = filteredEntries.map((entry) => [
      formatDate(entry.date),
      entry.reference,
      entry.accountCode,
      entry.account,
      entry.description,
      entry.debit,
      entry.credit,
      entry.balance,
      entry.status || "",
    ]);

    const csv = [
      headers,
      ...rows,
    ]
      .map((row) =>
        row
          .map((value) => {
            const text = String(value ?? "");

            return `"${text.replace(
              /"/g,
              '""'
            )}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download =
      `ziya-general-ledger-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  /* =========================================================
     STATUS BADGE
  ========================================================= */

  const renderStatus = (status?: string) => {
    const normalized =
      status?.toUpperCase() || "UNKNOWN";

    let className =
      "bg-slate-100 text-slate-600 border-slate-200";

    let icon = (
      <AlertCircle size={13} />
    );

    if (
      normalized === "POSTED" ||
      normalized === "APPROVED"
    ) {
      className =
        "bg-emerald-50 text-emerald-700 border-emerald-200";

      icon = (
        <CheckCircle2 size={13} />
      );
    }

    if (normalized === "REVERSED") {
      className =
        "bg-red-50 text-red-700 border-red-200";
    }

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${className}`}
      >
        {icon}
        {normalized}
      </span>
    );
  };

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div className="min-h-full bg-[#F7F8FA] text-[#20243A]">
      <div className="space-y-6">

        {/* =====================================================
            HEADER
        ===================================================== */}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#20243A]">
              General Ledger
            </h1>

            <p className="mt-1.5 text-sm text-[#666B84]">
              View all posted financial transactions across the organization.
            </p>
          </div>

          <div className="flex items-center gap-3">

            <button
              type="button"
              onClick={loadLedger}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-medium text-[#20243A] shadow-sm transition hover:bg-[#F8F9FC] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={17}
                className={
                  loading
                    ? "animate-spin"
                    : ""
                }
              />

              Refresh
            </button>

            <button
              type="button"
              onClick={exportLedger}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D9488] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0B7F74]"
            >
              <Download size={17} />
              Export
            </button>

          </div>
        </div>

        {/* =====================================================
            KPI CARDS
        ===================================================== */}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">

          {/* Transactions */}

          <div className="rounded-2xl border border-[#E8EAF0] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">

              <div>
                <p className="text-sm font-medium text-[#666B84]">
                  Ledger Lines
                </p>

                <h2 className="mt-2 text-2xl font-bold text-[#20243A]">
                  {formatCompactNumber(
                    filteredEntries.length
                  )}
                </h2>

                <p className="mt-1 text-xs text-[#8A8FA3]">
                  Filtered entries
                </p>
              </div>

              <div className="rounded-xl bg-[#EEF7F6] p-2.5 text-[#0D9488]">
                <ArrowUpRight size={19} />
              </div>

            </div>
          </div>

          {/* Debits */}

          <div className="rounded-2xl border border-[#E8EAF0] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">

              <div>
                <p className="text-sm font-medium text-[#666B84]">
                  Total Debits
                </p>

                <h2 className="mt-2 text-xl font-bold text-emerald-600">
                  {formatCurrency(totalDebit)}
                </h2>

                <p className="mt-1 text-xs text-[#8A8FA3]">
                  Debit movements
                </p>
              </div>

              <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
                <ArrowDownRight size={19} />
              </div>

            </div>
          </div>

          {/* Credits */}

          <div className="rounded-2xl border border-[#E8EAF0] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">

              <div>
                <p className="text-sm font-medium text-[#666B84]">
                  Total Credits
                </p>

                <h2 className="mt-2 text-xl font-bold text-red-600">
                  {formatCurrency(totalCredit)}
                </h2>

                <p className="mt-1 text-xs text-[#8A8FA3]">
                  Credit movements
                </p>
              </div>

              <div className="rounded-xl bg-red-50 p-2.5 text-red-600">
                <ArrowDownRight size={19} />
              </div>

            </div>
          </div>

          {/* Balance */}

          <div className="rounded-2xl border border-[#E8EAF0] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">

              <div>
                <p className="text-sm font-medium text-[#666B84]">
                  Balance
                </p>

                <h2
                  className={`mt-2 text-xl font-bold ${
                    balance === 0
                      ? "text-emerald-600"
                      : "text-[#20243A]"
                  }`}
                >
                  {formatCurrency(balance)}
                </h2>

                <p className="mt-1 text-xs text-[#8A8FA3]">
                  {balance === 0
                    ? "Ledger is balanced"
                    : "Debit − Credit"}
                </p>
              </div>

              <div
                className={`rounded-xl p-2.5 ${
                  balance === 0
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-amber-50 text-amber-600"
                }`}
              >
                {balance === 0 ? (
                  <CheckCircle2 size={19} />
                ) : (
                  <AlertCircle size={19} />
                )}
              </div>

            </div>
          </div>

        </div>

        {/* =====================================================
            FILTER PANEL
        ===================================================== */}

        <div className="rounded-2xl border border-[#E8EAF0] bg-white p-5 shadow-sm">

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(300px,1fr)_160px_160px]">

            {/* Search */}

            <div className="relative">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A8FA3]"
              />

              <input
                type="text"
                value={filters.search}
                onChange={(e) =>
                  setFilters((current) => ({
                    ...current,
                    search: e.target.value,
                  }))
                }
                placeholder="Search by account, code, reference or description..."
                className="w-full rounded-xl border border-[#E5E7EB] bg-white py-2.5 pl-10 pr-4 text-sm text-[#20243A] outline-none transition placeholder:text-[#A0A4B5] focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
              />
            </div>

            {/* From */}

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#666B84]">
                From
              </label>

              <input
                type="date"
                value={filters.startDate}
                onChange={(e) =>
                  setFilters((current) => ({
                    ...current,
                    startDate: e.target.value,
                  }))
                }
                className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#20243A] outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
              />
            </div>

            {/* To */}

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#666B84]">
                To
              </label>

              <input
                type="date"
                value={filters.endDate}
                onChange={(e) =>
                  setFilters((current) => ({
                    ...current,
                    endDate: e.target.value,
                  }))
                }
                className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#20243A] outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10"
              />
            </div>

          </div>

          {/* More filters */}

          {showMoreFilters && (
            <div className="mt-4 grid grid-cols-1 gap-4 border-t border-[#EEF0F4] pt-4 md:grid-cols-3">

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#666B84]">
                  Account
                </label>

                <select
                  value={filters.account}
                  onChange={(e) =>
                    setFilters((current) => ({
                      ...current,
                      account: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#20243A] outline-none focus:border-[#0D9488]"
                >
                  <option value="">
                    All accounts
                  </option>

                  {accountOptions.map(
                    ([id, label]) => (
                      <option
                        key={id}
                        value={id}
                      >
                        {label}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#666B84]">
                  Reference
                </label>

                <select
                  value={filters.reference}
                  onChange={(e) =>
                    setFilters((current) => ({
                      ...current,
                      reference: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#20243A] outline-none focus:border-[#0D9488]"
                >
                  <option value="">
                    All references
                  </option>

                  {referenceOptions.map(
                    (reference) => (
                      <option
                        key={reference}
                        value={reference}
                      >
                        {reference}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#666B84]">
                  Status
                </label>

                <select
                  value={filters.status}
                  onChange={(e) =>
                    setFilters((current) => ({
                      ...current,
                      status: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#20243A] outline-none focus:border-[#0D9488]"
                >
                  <option value="">
                    All statuses
                  </option>

                  {statusOptions.map(
                    (status) => (
                      <option
                        key={status}
                        value={status}
                      >
                        {status}
                      </option>
                    )
                  )}
                </select>
              </div>

            </div>
          )}

          {/* Filter controls */}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">

            <button
              type="button"
              onClick={() =>
                setShowMoreFilters(
                  (current) => !current
                )
              }
              className="inline-flex items-center gap-2 text-sm font-medium text-[#666B84] transition hover:text-[#20243A]"
            >
              <SlidersHorizontal size={16} />

              {showMoreFilters
                ? "Hide filters"
                : "More filters"}
            </button>

            <div className="flex items-center gap-2">

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-medium text-[#666B84] hover:bg-[#F7F8FA]"
                >
                  <X size={15} />
                  Clear
                </button>
              )}

              <button
                type="button"
                onClick={applyFilters}
                className="rounded-xl bg-[#20243A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#171A2C]"
              >
                Apply Filters
              </button>

            </div>
          </div>

        </div>

        {/* =====================================================
            ERROR
        ===================================================== */}

        {error && (
          <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <span>{error}</span>

            <button
              type="button"
              onClick={loadLedger}
              className="font-semibold underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* =====================================================
            TABLE
        ===================================================== */}

        <div className="overflow-hidden rounded-2xl border border-[#E8EAF0] bg-white shadow-sm">

          <div className="overflow-x-auto">

            <table className="w-full min-w-[1200px]">

              <thead className="border-b border-[#E8EAF0] bg-[#FAFBFC]">

                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-[#8A8FA3]">

                  <th className="w-12 px-4 py-4">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 accent-[#0D9488]"
                    />
                  </th>

                  <th className="px-4 py-4">
                    Date
                  </th>

                  <th className="px-4 py-4">
                    Reference
                  </th>

                  <th className="px-4 py-4">
                    Code
                  </th>

                  <th className="px-4 py-4">
                    Account
                  </th>

                  <th className="px-4 py-4">
                    Description
                  </th>

                  <th className="px-4 py-4 text-right">
                    Debit (Ksh)
                  </th>

                  <th className="px-4 py-4 text-right">
                    Credit (Ksh)
                  </th>

                  <th className="px-4 py-4">
                    Status
                  </th>

                  <th className="w-16 px-4 py-4 text-center">
                    Actions
                  </th>

                </tr>

              </thead>

              <tbody className="divide-y divide-[#EEF0F4]">

                {loading ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-6 py-16 text-center"
                    >
                      <div className="flex flex-col items-center gap-3 text-[#666B84]">
                        <RefreshCw
                          size={22}
                          className="animate-spin text-[#0D9488]"
                        />

                        <span className="text-sm">
                          Loading General Ledger...
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedEntries.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-6 py-16 text-center"
                    >
                      <div className="mx-auto max-w-sm">
                        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#F3F4F7] text-[#8A8FA3]">
                          <Search size={20} />
                        </div>

                        <p className="font-semibold text-[#20243A]">
                          No ledger transactions found
                        </p>

                        <p className="mt-1 text-sm text-[#8A8FA3]">
                          Try adjusting your filters or search terms.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedEntries.map(
                    (entry) => (
                      <tr
                        key={entry.id}
                        className="group transition hover:bg-[#FAFBFC]"
                      >

                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={selectedEntries.includes(
                              entry.id
                            )}
                            onChange={() =>
                              toggleEntry(entry.id)
                            }
                            className="h-4 w-4 rounded border-gray-300 accent-[#0D9488]"
                          />
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-sm text-[#666B84]">
                          {formatDate(entry.date)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-[#20243A]">
                          {entry.reference || "—"}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-[#666B84]">
                          {entry.accountCode}
                        </td>

                        <td className="px-4 py-4">
                          <div className="text-sm font-semibold text-[#20243A]">
                            {entry.account}
                          </div>
                        </td>

                        <td className="max-w-[260px] px-4 py-4 text-sm text-[#666B84]">
                          <span
                            className="block truncate"
                            title={entry.description}
                          >
                            {entry.description || "—"}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-semibold text-emerald-600">
                          {entry.debit > 0
                            ? formatCurrency(
                                entry.debit
                              )
                            : "—"}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-semibold text-red-600">
                          {entry.credit > 0
                            ? formatCurrency(
                                entry.credit
                              )
                            : "—"}
                        </td>

                        <td className="px-4 py-4">
                          {renderStatus(
                            entry.status
                          )}
                        </td>

                        <td className="px-4 py-4 text-center">

                          <button
                            type="button"
                            title="View ledger entry"
                            onClick={() =>
                              setSelectedEntry(
                                entry
                              )
                            }
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#8A8FA3] transition hover:bg-[#F1F3F6] hover:text-[#20243A]"
                          >
                            <MoreHorizontal
                              size={18}
                            />
                          </button>

                        </td>

                      </tr>
                    )
                  )
                )}

              </tbody>

              {!loading &&
                filteredEntries.length > 0 && (
                  <tfoot className="border-t-2 border-[#E8EAF0] bg-[#FAFBFC]">

                    <tr>

                      <td
                        colSpan={6}
                        className="px-4 py-4 text-right text-sm font-bold text-[#20243A]"
                      >
                        TOTAL
                      </td>

                      <td className="px-4 py-4 text-right text-sm font-bold text-emerald-600">
                        {formatCurrency(
                          totalDebit
                        )}
                      </td>

                      <td className="px-4 py-4 text-right text-sm font-bold text-red-600">
                        {formatCurrency(
                          totalCredit
                        )}
                      </td>

                      <td
                        colSpan={2}
                        className="px-4 py-4"
                      />

                    </tr>

                  </tfoot>
                )}

            </table>

          </div>

          {/* ===================================================
              PAGINATION
          =================================================== */}

          {!loading &&
            filteredEntries.length > 0 && (
              <div className="flex flex-col gap-4 border-t border-[#E8EAF0] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

                <p className="text-sm text-[#666B84]">
                  Showing{" "}
                  <span className="font-semibold text-[#20243A]">
                    {(currentPage - 1) *
                      pageSize +
                      1}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold text-[#20243A]">
                    {Math.min(
                      currentPage *
                        pageSize,
                      filteredEntries.length
                    )}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-[#20243A]">
                    {filteredEntries.length}
                  </span>{" "}
                  entries
                </p>

                <div className="flex items-center gap-4">

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#666B84]">
                      Rows per page
                    </span>

                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(
                          Number(
                            e.target.value
                          )
                        );
                        setCurrentPage(1);
                      }}
                      className="rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-sm text-[#20243A] outline-none focus:border-[#0D9488]"
                    >
                      {PAGE_SIZE_OPTIONS.map(
                        (size) => (
                          <option
                            key={size}
                            value={size}
                          >
                            {size}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="flex items-center gap-1">

                    <button
                      type="button"
                      disabled={
                        currentPage === 1
                      }
                      onClick={() =>
                        setCurrentPage(
                          (page) =>
                            Math.max(
                              1,
                              page - 1
                            )
                        )
                      }
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#666B84] transition hover:bg-[#F7F8FA] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft
                        size={16}
                      />
                    </button>

                    <span className="min-w-8 text-center text-sm font-semibold text-[#20243A]">
                      {currentPage}
                    </span>

                    <button
                      type="button"
                      disabled={
                        currentPage >=
                        totalPages
                      }
                      onClick={() =>
                        setCurrentPage(
                          (page) =>
                            Math.min(
                              totalPages,
                              page + 1
                            )
                        )
                      }
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#666B84] transition hover:bg-[#F7F8FA] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronRight
                        size={16}
                      />
                    </button>

                  </div>

                </div>

              </div>
            )}

        </div>

        {/* =====================================================
            ENTRY DETAIL MODAL
        ===================================================== */}

        {selectedEntry && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
            onClick={() =>
              setSelectedEntry(null)
            }
          >
            <div
              className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
              onClick={(e) =>
                e.stopPropagation()
              }
            >

              <div className="flex items-start justify-between">

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#8A8FA3]">
                    Ledger Entry
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-[#20243A]">
                    {selectedEntry.reference ||
                      "Journal Entry"}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedEntry(null)
                  }
                  className="rounded-lg p-2 text-[#8A8FA3] hover:bg-[#F5F6F8] hover:text-[#20243A]"
                >
                  <X size={18} />
                </button>

              </div>

              <div className="mt-6 grid grid-cols-2 gap-4">

                <div>
                  <p className="text-xs text-[#8A8FA3]">
                    Date
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#20243A]">
                    {formatDate(
                      selectedEntry.date
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-[#8A8FA3]">
                    Status
                  </p>
                  <div className="mt-1">
                    {renderStatus(
                      selectedEntry.status
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-[#8A8FA3]">
                    Account
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#20243A]">
                    {selectedEntry.accountCode} —{" "}
                    {selectedEntry.account}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-[#8A8FA3]">
                    Journal ID
                  </p>
                  <p className="mt-1 break-all text-sm font-medium text-[#666B84]">
                    {selectedEntry.journalId ||
                      "—"}
                  </p>
                </div>

                <div className="col-span-2">
                  <p className="text-xs text-[#8A8FA3]">
                    Description
                  </p>
                  <p className="mt-1 text-sm text-[#20243A]">
                    {selectedEntry.description ||
                      "—"}
                  </p>
                </div>

                <div className="rounded-xl bg-emerald-50 p-4">
                  <p className="text-xs font-medium text-emerald-700">
                    Debit
                  </p>
                  <p className="mt-1 text-base font-bold text-emerald-700">
                    {formatCurrency(
                      selectedEntry.debit
                    )}
                  </p>
                </div>

                <div className="rounded-xl bg-red-50 p-4">
                  <p className="text-xs font-medium text-red-700">
                    Credit
                  </p>
                  <p className="mt-1 text-base font-bold text-red-700">
                    {formatCurrency(
                      selectedEntry.credit
                    )}
                  </p>
                </div>

                <div className="col-span-2 rounded-xl bg-[#F7F8FA] p-4">
                  <p className="text-xs font-medium text-[#666B84]">
                    Running Balance
                  </p>
                  <p className="mt-1 text-lg font-bold text-[#20243A]">
                    {formatCurrency(
                      selectedEntry.balance
                    )}
                  </p>
                </div>

              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedEntry(null)
                  }
                  className="rounded-xl bg-[#20243A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#171A2C]"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
